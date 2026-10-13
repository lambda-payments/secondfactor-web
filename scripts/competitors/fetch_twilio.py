#!/usr/bin/env python3
"""Download Twilio's published outbound SMS price list and write data/twilio-sms.json.

Twilio publishes one CSV (ISO, Country, Description, Price / msg) with a row per carrier.
This keeps, per country, the lowest and highest published per-message price in USD, which
/compare/twilio-sms/ shows next to SecondFactor's price per OTP sent. Rows without an ISO
code (satellite routes) are skipped. On any failure the script exits non-zero and leaves
the existing file alone. No credentials are involved.

    python3 scripts/fetch-twilio-sms.py
"""
import csv
import io
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'twilio-sms.json'
URL = 'https://assets.cdn.prod.twilio.com/pricing-csv/SMSPricing.csv'
PRICE_PAGE = 'https://www.twilio.com/en-us/sms/pricing'


def fail(msg):
    print(f'fetch-twilio-sms: {msg}', file=sys.stderr)
    sys.exit(1)


def main():
    req = urllib.request.Request(URL, headers={'User-Agent': 'secondfactor-web pricing sync'})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = res.read().decode('utf-8-sig')
    except (urllib.error.URLError, TimeoutError) as e:
        fail(f'request failed: {e}')
    rows = list(csv.DictReader(io.StringIO(body)))
    if not rows or not {'ISO', 'Country', 'Price / msg'} <= set(rows[0].keys()):
        fail('unexpected CSV columns')
    per = {}
    for r in rows:
        iso = (r.get('ISO') or '').strip().upper()
        if not re.fullmatch(r'[A-Z]{2}', iso):
            continue
        try:
            price = float(r['Price / msg'])
        except (TypeError, ValueError):
            continue
        p = per.setdefault(iso, {'country': iso, 'name': r['Country'].strip(), 'min': price, 'max': price, 'carriers': 0})
        p['min'] = min(p['min'], price)
        p['max'] = max(p['max'], price)
        p['carriers'] += 1
    if len(per) < 100:
        fail(f'only {len(per)} countries parsed; refusing to overwrite')
    prices = [{'country': p['country'], 'name': p['name'], 'min': f"{p['min']:.5f}", 'max': f"{p['max']:.5f}",
               'carriers': p['carriers'], 'currency': 'USD'} for p in sorted(per.values(), key=lambda x: x['country'])]
    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch-twilio-sms: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'source': URL, 'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'note': 'Twilio published outbound SMS price per message segment, USD, lowest and highest carrier rate per country. Twilio Verify adds its own fee per successful verification.',
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch-twilio-sms: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
