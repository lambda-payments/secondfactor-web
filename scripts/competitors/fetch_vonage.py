#!/usr/bin/env python3
"""Download Vonage's published outbound SMS prices and write data/competitors/vonage.json.

Vonage's pricing pages (https://www.vonage.com/communications-apis/sms/pricing/) are an
Adobe AEM site. The price box on the page is filled by JavaScript from a public per-country
JSON servlet:

    /bin/vonage/communications-api/messaging/<ISO2>.messaging.USD.json

e.g. {"title": "Nepal", "usd": "1.17", "outgoing": {"outgoing": "0.31269"}, ...}

www.vonage.com sits behind a Cloudflare JavaScript challenge that blocks non-browser clients,
but the same AEM content and servlet are served without a challenge on Vonage's regional
sites, so this script reads them from www.vonage.co.uk (it uses the same USD price book:
the .com.au and .sg sites return identical figures). In the USD response the SMS prices are
already US dollars (the page's JS prints them without conversion). For each country the
script keeps the LOWEST positive outbound SMS price among "outgoing.outgoing" and, for US/CA,
the virtual-number, toll-free and short-code send rates. Countries without a published
outbound price are skipped.

The per-network "networks[]" list that a handful of countries carry (ID, PH, RU, TH, VN) is
deliberately ignored: its figures are identical in the USD and EUR responses (i.e. not
converted to USD) and include internal-looking routes such as "PH-ydsms" at 0.0059, so they
are not a reliable public USD price. The headline "outgoing" rate is what the page shows as
the country's SMS price. The country list is
the <datalist id="vng-pricing-country"> on the pricing page itself.

Not included: US/CA carrier pass-through fees (10DLC/toll-free/short code surcharges),
number rental and registration fees, volume discounts.

Verify: Vonage Verify ("Verify Conversion" model, https://www.vonage.com/communications-apis/verify/pricing/)
charges a flat fee per SUCCESSFUL verification, plus the normal Messaging/Voice rates for every
attempt. The page text reads "EUR 0.052/$0.06084 per successful verification"; the USD figure is
parsed from that text into verify_fee. (Vonage's "Verify Success" all-in model is contact-sales
only, so it is not represented.)

On any failure the script exits non-zero and leaves the existing file alone. It refuses
to write fewer than 50 countries and rewrites the file only when the prices changed.
No credentials are involved.

    python3 scripts/competitors/fetch_vonage.py
"""
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'vonage.json'
HOST = 'https://www.vonage.co.uk'
LIST_PAGE = HOST + '/communications-apis/sms/pricing/'
VERIFY_PAGE = HOST + '/communications-apis/verify/pricing/'
COUNTRY_JSON = HOST + '/bin/vonage/communications-api/messaging/{cc}.messaging.USD.json'
PRICE_PAGE = 'https://www.vonage.com/communications-apis/sms/pricing/'
VERIFY_PRICE_PAGE = 'https://www.vonage.com/communications-apis/verify/pricing/'
MIN_COUNTRIES = 50
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36')
DATALIST = re.compile(r'<datalist id="vng-pricing-country"[^>]*>(.*?)</datalist>', re.S)
OPTION = re.compile(r'<option data-value="([A-Z]{2})" value="([^"]+)"')
VERIFY_FEE = re.compile(r'\$\s*([0-9]+\.[0-9]+)\s+per successful verification', re.I)


class FetchError(Exception):
    pass


def fail(msg):
    print(f'fetch_vonage: {msg}', file=sys.stderr)
    sys.exit(1)


def get(url, accept='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', tries=3):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en-US,en;q=0.9'})
    err = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
            try:
                return raw.decode('utf-8')
            except UnicodeDecodeError:  # some country JSONs are served as Latin-1 (e.g. accented titles)
                return raw.decode('latin-1')
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise FetchError(f'{url}: HTTP {e.code}')
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        time.sleep(1.5 * (attempt + 1))
    raise FetchError(f'{url}: {err}')


def countries():
    """(ISO2, name) pairs from the pricing page's country picker."""
    m = DATALIST.search(get(LIST_PAGE))
    if not m:
        raise FetchError('country datalist not found on the SMS pricing page')
    return sorted({cc: html.unescape(name) for cc, name in OPTION.findall(m.group(1))}.items())


def verify_fee():
    text = re.sub(r'<[^>]+>', ' ', html.unescape(get(VERIFY_PAGE)))
    fees = {Decimal(x) for x in VERIFY_FEE.findall(text)}
    if len(fees) != 1:
        raise FetchError(f'expected one "$X per successful verification" on the Verify page, found {sorted(fees)}')
    return fees.pop()


def dec(value):
    if value in (None, ''):
        return None
    try:
        d = Decimal(str(value))
    except InvalidOperation:
        raise FetchError(f'unparseable price {value!r}')
    return d if d > 0 else None


def lowest_sms(data):
    """Lowest positive outbound SMS price in a country JSON, or None."""
    out = data.get('outgoing') or {}
    vn = data.get('virtualNumber') or {}
    tf = data.get('tollFree') or {}
    sc = data.get('shortCode') or {}
    candidates = [out.get('outgoing'), vn.get('virtualoutgoing'), vn.get('outgoing'),
                  tf.get('tollFreeouting'), sc.get('outgoingshortCode')]
    prices = [p for p in map(dec, candidates) if p is not None]
    return min(prices) if prices else None


def fetch_country(item):
    cc, name = item
    body = get(COUNTRY_JSON.format(cc=cc), accept='application/json, */*')
    try:
        data = json.loads(body)
    except ValueError:
        raise FetchError(f'{cc}: response is not JSON')
    return cc, name, lowest_sms(data)


def main():
    try:
        items = countries()
        if len(items) < MIN_COUNTRIES:
            fail(f'pricing page lists only {len(items)} countries; refusing to continue')
        fee = verify_fee()
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(fetch_country, items))
    except (FetchError, OSError, ValueError) as e:
        fail(str(e))

    prices, skipped = [], []
    for cc, name, price in results:
        if price is None:
            skipped.append(cc)
            continue
        prices.append({'country': cc, 'name': name, 'price': f'{price:.5f}'})
    prices.sort(key=lambda p: p['country'])
    if len(prices) < MIN_COUNTRIES:
        fail(f'only {len(prices)} countries parsed; refusing to overwrite')

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch_vonage: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'provider': 'Vonage',
        'slug': 'vonage',
        'source': COUNTRY_JSON.replace('{cc}', '<ISO2>'),
        'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': ('Published Vonage SMS API outbound price per message in USD to that destination country, '
                  'lowest across the published send routes (headline rate; US/CA long code, toll-free, short code), excluding US/CA carrier pass-through, '
                  'number rental and registration fees; Vonage Verify adds verify_fee per successful verification '
                  'on top of this.'),
        'verify_fee': float(fee),
        'verify_fee_note': (f'Vonage Verify "Verify Conversion" model: ${fee} per successful verification, plus '
                            'Messaging/Voice rates for every attempt ({}).'.format(VERIFY_PRICE_PAGE)),
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch_vonage: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries '
          f'({len(skipped)} with no published outbound SMS price skipped: {", ".join(skipped) or "none"})')


if __name__ == '__main__':
    main()
