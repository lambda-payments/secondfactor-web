#!/usr/bin/env python3
"""Download AWS's published outbound SMS prices and write data/competitors/aws-sns.json.

Amazon SNS bills SMS at AWS End User Messaging SMS rates. The pricing widget on
https://aws.amazon.com/end-user-messaging/pricing/ loads its table from a public JSON file
(OUTBOUND_JSON below, referenced in the page's plc-setup.js). It has one entry per
destination country (ISO 3166-1 alpha-2 key) with a per-message base price and a carrier
fee, split by origination type where AWS publishes a split:

    domesticPrice + carrierFee                          long code (or the only rate)
    shortCodeDomesticPrice + shortCodeCarrierFee        short code   (US, CA)
    tollFreeDomesticPrice + tollFreeCarrierFee          toll-free    (US)
    tenDlcDomesticPrice + tenDlcCarrierFee              10DLC        (US)
    internationalPrice + carrierFee                     India's default ILDO route

One number per country = the LOWEST base + carrier fee among those combinations, using
the "transactional" rates (what OTPs are sent as) and the lowest carrier where several
are listed. India's "domesticPrice" is the local route, which needs DLT registration under
India's rules; the default international (ILDO) route costs more. Canada's toll-free rate
is published only as a sentence on the pricing page, so it is read from there and used
when it is lower. Country names come from the per-country CSV linked on the same page.

Not included: 10DLC/toll-free/short code registration and monthly number fees, SMS
Protect, and the End User Messaging OTP/Notify fees (which SNS sends do not incur).

On any failure the script exits non-zero and leaves the existing file alone. It refuses
to write fewer than 50 countries and rewrites the file only when the prices changed.
No credentials are involved.

    python3 scripts/competitors/fetch_aws_sns.py
"""
import csv
import html
import io
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'aws-sns.json'
OUTBOUND_JSON = 'https://s3.amazonaws.com/aws-messaging-pricing-information/TextMessageOutbound/prices.json'
PRICE_PAGE = 'https://aws.amazon.com/end-user-messaging/pricing/'
MIN_COUNTRIES = 50
BASIS = ('AWS End User Messaging SMS (the rate SNS SMS is billed at) published outbound transactional '
         'SMS price per message in USD to that destination country, base price plus carrier fee, taking '
         'the lowest published origination type, route and carrier (e.g. US short code, Canada toll-free, '
         'India local DLT route).')
CA_TOLL_FREE = re.compile(
    r'Messages sent to Canada via a toll-free number will be charged \$([0-9.]+) per message fee '
    r'and \$([0-9.]+) carrier fee')
CSV_LINK = re.compile(r'href="(https://[^"]+End-User-Messaging-SMS-Prices[^"]*\.csv)"')


def fail(msg):
    print(f'fetch_aws_sns: {msg}', file=sys.stderr)
    sys.exit(1)


def warn(msg):
    print(f'fetch_aws_sns: warning: {msg}', file=sys.stderr)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (secondfactor-web pricing sync)'})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read().decode('utf-8-sig')
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError) as e:
        fail(f'request failed for {url}: {e}')


def dec(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        d = Decimal(str(value))
    except InvalidOperation:
        return None
    return d if d.is_finite() else None


def entry_candidates(entry):
    """Every published base + carrier fee combination in one carrier entry."""
    out = []
    fallback_fee = dec(entry.get('carrierFee')) or Decimal(0)
    for key, value in entry.items():
        if key == 'domesticPrice' or key == 'internationalPrice':
            fee = fallback_fee
        elif key.endswith('DomesticPrice'):
            fee = dec(entry.get(key[:-len('DomesticPrice')] + 'CarrierFee'))
            fee = fallback_fee if fee is None else fee
        else:
            continue
        base = dec(value)
        if base is not None and base > 0 and fee >= 0:
            out.append(base + fee)
    return out


def fmt(d):
    q = d.quantize(Decimal('0.00001'))
    return f'{q:.5f}' if q == d else format(d.normalize(), 'f')


def main():
    try:
        data = json.loads(get(OUTBOUND_JSON), parse_float=Decimal)
        countries = data['SMS']['countryPrices']
    except (ValueError, KeyError, TypeError) as e:
        fail(f'unexpected JSON shape: {e}')
    if not isinstance(countries, dict):
        fail('countryPrices is not an object')

    page = get(PRICE_PAGE)
    text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', page)))
    extra = {}
    m = CA_TOLL_FREE.search(text)
    if m:
        extra['CA'] = [Decimal(m.group(1)) + Decimal(m.group(2))]
    else:
        warn('Canada toll-free sentence not found on the pricing page; using the JSON rates only')

    link = CSV_LINK.search(page)
    if not link:
        fail('per-country CSV link not found on the pricing page')
    rows = list(csv.DictReader(io.StringIO(get(html.unescape(link.group(1))))))
    if not rows or not {'ISO Country', 'Country Name'} <= set(rows[0].keys()):
        fail('unexpected CSV columns')
    names = {r['ISO Country'].strip().upper(): r['Country Name'].strip() for r in rows if r.get('Country Name')}

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    old_names = {p['country']: p['name'] for p in previous or [] if isinstance(p, dict) and 'name' in p}

    prices = []
    for iso, info in countries.items():
        iso = str(iso).strip().upper()
        if not re.fullmatch(r'[A-Z]{2}', iso):
            continue
        entries = info.get('transactional') if isinstance(info, dict) else None
        cands = [c for e in entries or [] if isinstance(e, dict) for c in entry_candidates(e)]
        cands += extra.get(iso, [])
        if not cands:
            warn(f'{iso}: no usable transactional price, skipped')
            continue
        name = names.get(iso) or old_names.get(iso)
        if not name:
            fail(f'{iso}: no country name in the CSV')
        prices.append({'country': iso, 'name': name, 'price': fmt(min(cands))})
    prices.sort(key=lambda p: p['country'])

    if len(prices) < MIN_COUNTRIES:
        fail(f'only {len(prices)} countries parsed; refusing to overwrite')
    if previous == prices:
        print(f'fetch_aws_sns: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'provider': 'AWS SNS', 'slug': 'aws-sns', 'source': OUTBOUND_JSON, 'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': BASIS,
        'verify_fee': None,
        'verify_fee_note': None,
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch_aws_sns: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
