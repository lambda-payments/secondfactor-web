#!/usr/bin/env python3
"""Scrape Message Central's public VerifyNow (SMS OTP) country price table into
data/competitors/messagecentral.json.

Source: https://www.messagecentral.com/product/verify-now/pricing
The page is a Webflow site. Its "SMS OTP Pricing by Country" table is a server-rendered
CMS collection list (columns: Country, Code, Rate in USD; each row also carries the ISO
alpha-2 code) that Webflow paginates 100 rows at a time via a `?<listid>_page=N` query
parameter. This script walks every page and reads each row.

Meaning of a price: the published USD rate for one SMS OTP sent with VerifyNow to that
destination country, pay-as-you-go list price (the page says high-volume senders can ask
for custom rates; there are no published volume tiers). The same page states the
verification fee is $0 ("per successful verification in addition to SMS cost"), so the
rate is the whole per-OTP price. verify_fee is written as 0 only when that statement is
still found on the page, otherwise null.

Row handling: rates are kept exactly as published (leading decimal number only, e.g.
India's "0.00332 (30 paise INR)" -> "0.00332"). Rows whose rate is not a number ("-",
"NULL", "Only active on WhatsApp") are skipped. A few rows are published without an ISO
code; those are mapped by name in ISO_BY_NAME. Rows with an obsolete or unknown code
(e.g. AN, Netherlands Antilles) are skipped.

On any failure (network, layout change, fewer than MIN_COUNTRIES countries, currency
header not USD, conflicting duplicate rows) the script exits non-zero and leaves the
existing JSON untouched. The file is only rewritten when `prices` changed. Standard
library only; no credentials.

    python3 scripts/competitors/fetch_messagecentral.py
"""
import html
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'messagecentral.json'
URL = 'https://www.messagecentral.com/product/verify-now/pricing'
PRICE_PAGE = URL
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')
MIN_COUNTRIES = 150  # the table currently lists ~225 priced countries
MAX_PAGES = 20

# Rows the page publishes with an empty ISO cell.
ISO_BY_NAME = {
    'congo': 'CG',
    'namibia': 'NA',
    'sint maarten': 'SX',
    'south sudan': 'SS',
}
# Codes that are not current ISO 3166-1 alpha-2 country codes.
SKIP_ISO = {'AN'}

ROW_SPLIT = '<div role="listitem" class="pricing-breakdown_item w-dyn-item">'


def fail(msg):
    print(f'fetch_messagecentral: {msg}', file=sys.stderr)
    sys.exit(1)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read().decode('utf-8', 'replace')
    except (urllib.error.URLError, TimeoutError) as e:
        fail(f'request failed for {url}: {e}')


def field(block, cls):
    m = re.search(r'class="' + cls + r'(?: [^"]*)?"[^>]*>([^<]*)<', block)
    return html.unescape(m.group(1)).strip() if m else ''


def parse_rows(page):
    rows = []
    for block in page.split(ROW_SPLIT)[1:]:
        block = block[:4000]
        rows.append({
            'name': field(block, 'pricing-breakdown_country-name'),
            'iso': field(block, 'pricing-breakdown_country-iso').upper(),
            'rate': field(block, 'pricing-breakdown_country-rate'),
        })
    return rows


def main():
    first = get(URL)
    if not re.search(r'Rate in\s+USD', first):
        fail('price table header "Rate in USD" not found; layout or currency changed')
    m = re.search(r'href="\?([0-9a-f]+_page)=\d+"', first)
    page_param = m.group(1) if m else None

    rows = parse_rows(first)
    if page_param:
        for n in range(2, MAX_PAGES + 1):
            more = parse_rows(get(f'{URL}?{page_param}={n}'))
            if not more:
                break
            rows.extend(more)
    if not rows:
        fail('no table rows found; layout changed')

    per, skipped = {}, []
    for r in rows:
        iso = r['iso'] or ISO_BY_NAME.get(r['name'].lower(), '')
        num = re.match(r'\s*(\d+(?:\.\d+)?)', r['rate'])
        if not re.fullmatch(r'[A-Z]{2}', iso) or iso in SKIP_ISO or not num:
            skipped.append(f"{r['name'] or '?'} ({r['iso'] or '-'}: {r['rate'] or '-'})")
            continue
        try:
            price = Decimal(num.group(1))
        except InvalidOperation:
            skipped.append(r['name'])
            continue
        if price <= 0 or price > 5:
            fail(f"implausible rate {price} for {r['name']}")
        prev = per.get(iso)
        if prev and prev['price'] != price:
            fail(f"conflicting rates for {iso}: {prev['price']} vs {price}")
        per[iso] = {'name': r['name'], 'price': price}

    if len(per) < MIN_COUNTRIES:
        fail(f'only {len(per)} countries parsed (of {len(rows)} rows); refusing to overwrite')

    prices = [{'country': iso, 'name': per[iso]['name'], 'price': format(per[iso]['price'], 'f')}
              for iso in sorted(per)]

    text = re.sub(r'<[^>]+>', ' ', first)
    zero_fee = re.search(r'\$0\s*(?:&nbsp;|\s)*per successful verification', html.unescape(text))
    verify_fee = 0 if zero_fee else None
    verify_fee_note = ('VerifyNow states "$0 per successful verification in addition to SMS cost"; '
                       'the per-country rate is the full price per OTP sent.') if zero_fee else None
    if not zero_fee:
        print('fetch_messagecentral: warning: $0 verification-fee statement not found; verify_fee=null',
              file=sys.stderr)

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch_messagecentral: {len(prices)} countries, unchanged')
        return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix('.json.tmp')
    tmp.write_text(json.dumps({
        'provider': 'Message Central',
        'slug': 'messagecentral',
        'source': URL,
        'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': 'Published pay-as-you-go VerifyNow rate in USD for one SMS OTP sent to that country '
                 '(no separate verification fee).',
        'verify_fee': verify_fee,
        'verify_fee_note': verify_fee_note,
        'prices': prices,
    }, indent=1) + '\n')
    tmp.replace(OUT)
    print(f'fetch_messagecentral: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries '
          f'({len(skipped)} rows skipped: {", ".join(skipped)})')


if __name__ == '__main__':
    main()
