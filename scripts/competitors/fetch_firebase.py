#!/usr/bin/env python3
"""Download Google's published Firebase phone-auth SMS rates and write data/competitors/firebase.json.

Firebase Authentication bills phone (SMS) sign-in per SMS sent. The Firebase pricing page
(firebase.google.com/pricing, "Phone Auth - All regions: Billed per SMS sent, See current
rates") links to the Google Cloud Identity Platform pricing page, which carries the rate table
"For phone authentication and multi-factor authentication": one row per region, written as
"Country Name (CC)" with "$0.07 / 1 count, per 1 month / project", i.e. USD per SMS sent.
There is no CSV/JSON behind it, so this script parses that HTML table.

Each price is Google's list price in USD for one SMS sent to that country (one OTP send).
There is no separate per-verification fee, so verify_fee is null. The free allowance
("the first ten SMS that you send per day are not billed"; phone auth needs the Blaze plan)
is mentioned in "basis" but not applied to the numbers.

On any failure (network, page layout change, fewer than 50 countries) the script exits
non-zero and leaves the existing file alone. The file is only rewritten when the prices
change. Standard library only, no credentials.

    python3 scripts/competitors/fetch_firebase.py
"""
import html
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'firebase.json'
URL = 'https://cloud.google.com/identity-platform/pricing'
PRICE_PAGE = 'https://firebase.google.com/pricing'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')
MIN_COUNTRIES = 50

ROW_NAME = re.compile(r'^(.+?)\s*\(([A-Z]{2})\)$')
ROW_PRICE = re.compile(r'^\$(\d+(?:\.\d+)?)\s*/\s*1 count\b')


def fail(msg):
    print(f'fetch_firebase: {msg}', file=sys.stderr)
    sys.exit(1)


def text(fragment):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).split())


def sms_table(page):
    """Return the <table> whose header reads 'Price per SMS sent'."""
    for table in re.findall(r'<table\b.*?</table>', page, re.S | re.I):
        if 'Price per SMS sent' in text(table):
            return table
    fail('SMS rate table ("Price per SMS sent") not found on page')


def main():
    req = urllib.request.Request(URL, headers={'User-Agent': UA, 'Accept-Language': 'en-US,en'})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            page = res.read().decode('utf-8', 'replace')
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        fail(f'request failed: {e}')

    per = {}
    for row in re.findall(r'<tr\b.*?</tr>', sms_table(page), re.S | re.I):
        cells = [text(c) for c in re.findall(r'<t[dh]\b[^>]*>.*?</t[dh]>', row, re.S | re.I)]
        if len(cells) != 2:
            continue
        m_name, m_price = ROW_NAME.match(cells[0]), ROW_PRICE.match(cells[1])
        if not m_name or not m_price:
            continue  # header row or unparseable row
        name, iso = m_name.group(1), m_name.group(2)
        try:
            price = Decimal(m_price.group(1))
        except InvalidOperation:
            continue
        if iso in per and per[iso]['price'] != price:
            fail(f'conflicting prices for {iso}: {per[iso]["price"]} vs {price}')
        per[iso] = {'country': iso, 'name': name, 'price': price}

    if len(per) < MIN_COUNTRIES:
        fail(f'only {len(per)} countries parsed; refusing to overwrite')

    prices = [{'country': p['country'], 'name': p['name'], 'price': f"{p['price']:.5f}"}
              for p in sorted(per.values(), key=lambda x: x['country'])]

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text()).get('prices')
        except ValueError:
            previous = None
    if previous == prices:
        print(f'fetch_firebase: {len(prices)} countries, unchanged')
        return

    doc = {
        'provider': 'Firebase Authentication',
        'slug': 'firebase',
        'source': URL,
        'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': ('Google list price in USD per SMS sent for Firebase phone authentication to that '
                  'country (one OTP send), from the Identity Platform SMS rate table; the first 10 SMS '
                  'per day per project are not billed and phone auth requires the Blaze plan, but that '
                  'allowance is not applied here.'),
        'verify_fee': None,
        'verify_fee_note': None,
        'prices': prices,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=OUT.parent, prefix='.firebase.', suffix='.json')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(json.dumps(doc, indent=1, ensure_ascii=False) + '\n')
        os.replace(tmp, OUT)
    except OSError as e:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        fail(f'write failed: {e}')
    print(f'fetch_firebase: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
