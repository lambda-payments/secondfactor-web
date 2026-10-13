#!/usr/bin/env python3
"""Download Bird's (formerly MessageBird) published outbound SMS rates and write data/competitors/bird.json.

Bird has no single CSV. Its pricing site serves one Markdown page per destination at
https://bird.com/pricing/sms/<iso2>.md (the same data as the HTML page
https://bird.com/pricing/sms/<iso2>), each with a table row like

    | Destination | Code | Alphanumeric | Long code | Toll-free | Short code |
    | Nepal       | NP   | $0.24        | not published | not published | not published |

Prices are USD per outbound message segment, one column per sender type. The list of
destinations comes from Bird's sitemap (https://bird.com/sitemap.xml). For each country this
keeps the LOWEST published rate across sender types, which /compare/ pages show next to
SecondFactor's price per OTP sent. Destinations whose page says no outbound rate is published
are skipped. Carrier pass-through fees (US, CA, PR, VI; https://bird.com/pricing/sms/fees),
10DLC/registration fees and number rental are NOT included.

Bird Verify has no separate per-verification fee (https://bird.com/pricing/verify): you pay
only the channel rate for each code sent, so verify_fee is 0. The script checks that wording
and fails if it changes.

On any failure (network, unexpected page format, fewer than 50 countries) the script exits
non-zero and leaves the existing file alone. The file is rewritten only when `prices` changed.
Standard library only, no credentials.

    python3 scripts/competitors/fetch_bird.py
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'bird.json'
BASE = 'https://bird.com'
SITEMAP = BASE + '/sitemap.xml'
COUNTRY_MD = BASE + '/pricing/sms/{cc}.md'
VERIFY_MD = BASE + '/pricing/verify.md'
PRICE_PAGE = BASE + '/pricing/sms'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36 secondfactor-web pricing sync')
MIN_COUNTRIES = 50
SENDER_TYPES = ('Alphanumeric', 'Long code', 'Toll-free', 'Short code')


def fail(msg):
    print(f'fetch_bird: {msg}', file=sys.stderr)
    sys.exit(1)


class FetchError(Exception):
    pass


def get(url, tries=3):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/markdown, text/plain, */*'})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:
                raise FetchError(f'{url}: HTTP {e.code}')
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        time.sleep(1.5 * (attempt + 1))
    raise FetchError(f'{url}: {err}')


def country_codes():
    """ISO codes that have an SMS pricing page, read from the sitemap index."""
    index = get(SITEMAP)
    maps = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', index)
    if not maps:
        raise FetchError('sitemap index has no <loc> entries')
    codes = set()
    for m in maps:
        body = get(m) if m.endswith('.xml') else ''
        codes.update(re.findall(r'<loc>\s*https://bird\.com/pricing/sms/([a-z]{2})\s*</loc>', body))
    return sorted(codes)


ROW_HEADER = re.compile(r'^\|\s*Destination\s*\|\s*Code\s*\|(.*)\|\s*$', re.M)
NO_RATE = re.compile(r'No outbound SMS rate is published for', re.I)
PRICE = re.compile(r'^\$(\d+(?:\.\d+)?)$')


def parse_country(cc, md):
    """Return (name, lowest Decimal price, sender type) or None if no rate is published."""
    if 'All prices in US dollars (USD)' not in md and not NO_RATE.search(md):
        raise FetchError(f'{cc}: page does not state USD pricing')
    head = ROW_HEADER.search(md)
    if not head:
        if NO_RATE.search(md):
            return None
        raise FetchError(f'{cc}: rate table not found')
    columns = [c.strip() for c in head.group(1).split('|')]
    if tuple(columns) != SENDER_TYPES:
        raise FetchError(f'{cc}: unexpected columns {columns}')
    row = None
    for line in md[head.end():].splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) == 2 + len(SENDER_TYPES) and cells[1].upper() == cc.upper():
            row = cells
            break
    if row is None:
        raise FetchError(f'{cc}: no table row for this destination')
    best = None
    for kind, cell in zip(SENDER_TYPES, row[2:]):
        m = PRICE.match(cell)
        if m:
            price = Decimal(m.group(1))
            if price > 0 and (best is None or price < best[0]):
                best = (price, kind)
        elif cell.lower() != 'not published':
            raise FetchError(f'{cc}: unexpected cell {cell!r}')
    if best is None:
        return None
    return row[0], best[0], best[1]


def fetch_country(cc):
    return cc, parse_country(cc, get(COUNTRY_MD.format(cc=cc)))


def main():
    try:
        codes = country_codes()
        if len(codes) < MIN_COUNTRIES:
            fail(f'sitemap lists only {len(codes)} SMS pricing pages; refusing to continue')
        verify = get(VERIFY_MD)
        if 'No separate Verify fee' not in verify and 'no separate Verify fee' not in verify:
            fail('Verify pricing page no longer says "no separate Verify fee"; check it by hand')
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(fetch_country, codes))
    except FetchError as e:
        fail(str(e))

    prices, skipped = [], []
    for cc, parsed in results:
        if parsed is None:
            skipped.append(cc.upper())
            continue
        name, price, _kind = parsed
        prices.append({'country': cc.upper(), 'name': name, 'price': f'{price:.5f}'})
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
        print(f'fetch_bird: {len(prices)} countries, unchanged')
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'provider': 'Bird',
        'slug': 'bird',
        'source': COUNTRY_MD.replace('{cc}', '<iso2>'),
        'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': ('Published Bird outbound SMS rate per message segment in USD, lowest across sender types '
                  '(alphanumeric, long code, toll-free, short code) per country, excluding carrier pass-through '
                  'and registration fees.'),
        'verify_fee': 0,
        'verify_fee_note': ('Bird Verify has no separate fee: each code sent is billed at the SMS/WhatsApp/email '
                            'channel rate and code checks are free (bird.com/pricing/verify).'),
        'prices': prices,
    }, indent=1) + '\n')
    print(f'fetch_bird: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries '
          f'({len(skipped)} destinations with no published rate skipped)')


if __name__ == '__main__':
    main()
