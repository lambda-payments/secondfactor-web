#!/usr/bin/env python3
"""Download Twilio's published outbound SMS price list and write data/competitors/twilio.json.

Twilio publishes one CSV (ISO, Country, Description, Price / msg) with a row per carrier.
This keeps, per country, the lowest and highest published per-message price in USD, which
/compare/twilio-sms/ shows next to SecondFactor's price per OTP sent (js/compare.js). Rows without an ISO
code (satellite routes) are skipped. On any failure the script exits non-zero and leaves
the existing file alone. No credentials are involved.

    python3 scripts/competitors/fetch_twilio.py
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

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'twilio.json'
URL = 'https://assets.cdn.prod.twilio.com/pricing-csv/SMSPricing.csv'
PRICE_PAGE = 'https://www.twilio.com/en-us/sms/pricing'


def fail(msg):
    print(f'fetch_twilio: {msg}', file=sys.stderr)
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
    prices = [{'country': p['country'], 'name': p['name'], 'price': f"{p['min']:.5f}"}
              for p in sorted(per.values(), key=lambda x: x['country'])]
    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch_twilio: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'provider': 'Twilio', 'slug': 'twilio', 'source': URL, 'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': 'Published outbound SMS price per message segment in USD, lowest carrier rate per country.',
        'verify_fee': 0.05,
        'verify_fee_note': 'Twilio Verify: $0.05 per successful verification, on top of the channel fee (twilio.com/en-us/verify/pricing).',
        'verify_label': 'Twilio Verify (SMS + $0.05 fee)', 'sms_label': 'Twilio SMS',
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch_twilio: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
