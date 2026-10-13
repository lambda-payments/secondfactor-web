#!/usr/bin/env python3
"""Fetch SecondFactor's per-country OTP price list and write data/pricing.json.

The site is static, so this is the server side of the pricing integration: it runs in
GitHub Actions (.github/workflows/pricing.yml) every 10 minutes and on demand, with the
API key from the SF_PRICING_KEY secret. Browsers only ever read the committed JSON.

    SF_PRICING_KEY=sf_... python3 scripts/fetch-pricing.py            # production list
    SF_PRICING_URL=https://uat-api.secondfactor.ai/v2/Pricing ...      # UAT

On any failure (network, non-200, malformed body, empty list) the script exits non-zero
and leaves the existing data/pricing.json untouched, so the site keeps serving the last
good list. The output is written only when the list actually changed, so the workflow's
commit step has nothing to commit most of the time.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'pricing.json'
URL = os.environ.get('SF_PRICING_URL', 'https://api.secondfactor.ai/v2/Pricing')
PRICE_RE = re.compile(r'^\d+\.\d{6}$')


def fail(msg):
    print(f'fetch-pricing: {msg}', file=sys.stderr)
    sys.exit(1)


def fetch(key):
    req = urllib.request.Request(URL, headers={'X-API-Key': key, 'Accept': 'application/json',
                                               'User-Agent': 'secondfactor-web pricing sync'})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except (urllib.error.URLError, TimeoutError) as e:
        fail(f'request failed: {e}')


def validate(body):
    try:
        data = json.loads(body)
    except ValueError as e:
        fail(f'response is not JSON: {e}')
    if not isinstance(data, list) or not data:
        fail('response is not a non-empty array')
    seen = set()
    for row in data:
        if not isinstance(row, dict):
            fail(f'row is not an object: {row!r}')
        code, name, price, cur = row.get('country'), row.get('name'), row.get('price'), row.get('currency')
        if not (isinstance(code, str) and re.fullmatch(r'[A-Z]{2}', code)):
            fail(f'bad country code: {row!r}')
        if not (isinstance(name, str) and name.strip()):
            fail(f'missing name: {row!r}')
        if not (isinstance(price, str) and PRICE_RE.match(price)):
            fail(f'price is not a six-place decimal string: {row!r}')
        if cur != 'USD':
            fail(f'unexpected currency: {row!r}')
        if code in seen:
            fail(f'duplicate country: {code}')
        seen.add(code)
    # keep only the documented fields, sorted by code, so the file is stable
    return sorted(({'country': r['country'], 'name': r['name'].strip(), 'price': r['price'], 'currency': r['currency']}
                   for r in data), key=lambda r: r['country'])


def main():
    key = os.environ.get('SF_PRICING_KEY', '').strip()
    if not key:
        fail('SF_PRICING_KEY is not set')
    status, body = fetch(key)
    if status != 200:
        fail(f'HTTP {status}: {body[:300]}')
    prices = validate(body)

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch-pricing: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'source': URL,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch-pricing: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
