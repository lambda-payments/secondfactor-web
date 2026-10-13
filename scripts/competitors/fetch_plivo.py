#!/usr/bin/env python3
"""Download Plivo's published outbound SMS price list and write data/competitors/plivo.json.

Source. Plivo's human pricing page is https://www.plivo.com/sms/pricing/ (one page per
country, e.g. /sms/pricing/np/). Those pages are an Astro site; every country page is
rendered from one JavaScript data module that the SMS pricing component imports, named
/_astro/sms-pricing-page.<hash>.js. Plivo publishes no CSV or JSON download, so this
script finds that module the same way a browser does:

    /sms/pricing/  ->  component-url="/_astro/SMSPricingPage.<hash>.js"
                   ->  import "./sms-pricing-page.<hash>.js"   (per-country rates)
                   ->  import "./pricing-data.<hash>.js"       (country names)

The hashes change on every Plivo deploy, so they are looked up on each run. The data
module holds one object per country (the same 133 countries that have a
/sms/pricing/<cc>/ page) with `smsRates` (per sender type, e.g. Longcode / Toll-Free /
Shortcode) and `smsNetworkRates` (per carrier), each written like "$0.2546/sms" or
"Starts at $0.2546/sms".

What a number means. For each country, `price` is the LOWEST USD per-message outbound
SMS rate published for any carrier or sender type, as a decimal string exactly as Plivo
prints it (4 decimals). Rates in other currencies are ignored, never converted: India's
domestic (DLT) route is published only in INR ("₹0.20/sms"), so India's price is the
USD international (ILDO) rate. US/Canada carrier surcharges, which Plivo lists
separately, are not included.

Plivo Verify. https://www.plivo.com/verify/pricing/ advertises a "$0 Verification fee":
Verify only charges the channel (SMS) fee. The fee is read from that page and stored as
`verify_fee`; if the page no longer states it, the script fails rather than guess.

Safety. Standard library only. On any failure (network, page layout change, fewer than
50 countries parsed) the script exits non-zero and leaves the existing output file alone.
The file is only rewritten when `prices` or `verify_fee` changed; the write is atomic.

    python3 scripts/competitors/fetch_plivo.py
"""
import html
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'competitors' / 'plivo.json'
BASE = 'https://www.plivo.com'
PRICE_PAGE = BASE + '/sms/pricing/'
VERIFY_PAGE = BASE + '/verify/pricing/'
UA = 'Mozilla/5.0 (compatible; secondfactor-web pricing sync)'
MIN_COUNTRIES = 50
USD_RATE = re.compile(r'^\s*(?:Starts at\s*)?\$(\d+(?:\.\d+)?)\s*/\s*sms\s*$', re.I)


def fail(msg):
    print(f'fetch_plivo: {msg}', file=sys.stderr)
    sys.exit(1)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            body = res.read().decode('utf-8')
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, OSError) as e:
        fail(f'request failed for {url}: {e}')
    time.sleep(0.5)  # be polite: a handful of sequential requests
    return body


def find_import(js, stem):
    m = re.search(r'from\s*["\']\./(' + re.escape(stem) + r'\.[\w-]+\.js)["\']', js)
    return f'{BASE}/_astro/{m.group(1)}' if m else None


# --- minimal JS object literal -> JSON (enough for minified data literals) ----------

TOKEN = re.compile(r'''
    (?P<ws>\s+)
  | (?P<dstr>"(?:[^"\\]|\\.)*")
  | (?P<sstr>'(?:[^'\\]|\\.)*')
  | (?P<num>-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)
  | (?P<bang>![01])
  | (?P<ident>[A-Za-z_$][\w$]*)
  | (?P<punct>[{}\[\]:,])
''', re.X | re.S)


def js_string_value(tok):
    body = tok[1:-1]
    out, i = [], 0
    while i < len(body):
        c = body[i]
        if c != '\\':
            out.append(c)
            i += 1
            continue
        n = body[i + 1]
        simple = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}
        if n in simple:
            out.append(simple[n])
            i += 2
        elif n == 'x':
            out.append(chr(int(body[i + 2:i + 4], 16)))
            i += 4
        elif n == 'u':
            out.append(chr(int(body[i + 2:i + 6], 16)))
            i += 6
        else:
            out.append(n)
            i += 2
    return ''.join(out)


def js_literal_to_python(src):
    """Parse a JS object/array literal made only of literals. Raises ValueError otherwise."""
    parts, pos, toks = [], 0, []
    while pos < len(src):
        m = TOKEN.match(src, pos)
        if not m:
            raise ValueError(f'unexpected character {src[pos]!r}')
        pos = m.end()
        if m.lastgroup != 'ws':
            toks.append((m.lastgroup, m.group()))
    for i, (kind, val) in enumerate(toks):
        nxt = toks[i + 1][1] if i + 1 < len(toks) else ''
        if kind in ('dstr', 'sstr'):
            parts.append(json.dumps(js_string_value(val)))
        elif kind == 'num':
            parts.append(json.dumps(float(val)) if not re.fullmatch(r'-?\d+', val) else val)
        elif kind == 'bang':
            parts.append('true' if val == '!0' else 'false')
        elif kind == 'ident':
            if nxt == ':':
                parts.append(json.dumps(val))
            elif val in ('true', 'false', 'null'):
                parts.append(val)
            else:
                raise ValueError(f'non-literal identifier {val!r}')
        else:
            parts.append(val)
    return json.loads(''.join(parts))


def match_bracket(src, start):
    """Index just past the bracket that closes src[start] ('{' or '['), skipping strings."""
    depth, i, quote = 0, start, None
    while i < len(src):
        c = src[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '"\'`':
            quote = c
        elif c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError('unbalanced brackets')


# --- Plivo specifics ----------------------------------------------------------------

def parse_countries(js):
    expected = js.count('smsNetworkRates:')
    countries = {}
    for m in re.finditer(r'[{,]([A-Z]{2}):\{', js):
        start = m.end() - 1
        try:
            end = match_bracket(js, start)
        except ValueError:
            continue
        chunk = js[start:end]
        if 'smsNetworkRates:' not in chunk or 'smsRates:' not in chunk:
            continue
        try:
            obj = js_literal_to_python(chunk)
        except (ValueError, IndexError) as e:
            fail(f'could not parse rates for {m.group(1)}: {e}')
        if isinstance(obj, dict) and 'smsNetworkRates' in obj:
            countries[m.group(1)] = obj
    if expected and len(countries) != expected:
        fail(f'parsed {len(countries)} country objects but the module has {expected}; layout changed?')
    return countries


def lowest_usd(obj):
    candidates = [obj.get('smsOutbound')]
    candidates += [r.get('outbound') for r in obj.get('smsRates') or [] if isinstance(r, dict)]
    candidates += [r.get('rate') for r in obj.get('smsNetworkRates') or [] if isinstance(r, dict)]
    best = None
    for c in candidates:
        m = USD_RATE.match(c) if isinstance(c, str) else None
        if m and Decimal(m.group(1)) > 0 and (best is None or Decimal(m.group(1)) < Decimal(best)):
            best = m.group(1)
    return best


def parse_names(js):
    best = {}
    for m in re.finditer(r'\{((?:[A-Z]{2}:"[^"\\]*",?){100,})\}', js):
        names = dict(re.findall(r'([A-Z]{2}):"([^"\\]*)"', m.group(1)))
        if len(names) > len(best):
            best = names
    return best


def name_from_page(cc):
    page = get(f'{PRICE_PAGE}{cc.lower()}/')
    m = re.search(r'<title>\s*SMS Messaging API Pricing\s*-\s*(.*?)\s*\|\s*Plivo\s*</title>', page, re.S)
    if not m:
        fail(f'no country name for {cc}')
    return html.unescape(m.group(1)).strip()


def verify_fee():
    text = re.sub(r'<[^>]+>', ' ', get(VERIFY_PAGE))
    text = re.sub(r'\s+', ' ', html.unescape(text))
    m = re.search(r'\$(\d+(?:\.\d+)?)\s*Verification fee', text, re.I)
    if not m:
        fail(f'could not find the per-verification fee on {VERIFY_PAGE}')
    return float(m.group(1))


def main():
    page = get(PRICE_PAGE)
    m = re.search(r'component-url="(/_astro/SMSPricingPage\.[\w-]+\.js)"', page)
    if not m:
        fail(f'SMSPricingPage component not found on {PRICE_PAGE}')
    component = get(BASE + m.group(1))
    data_url = find_import(component, 'sms-pricing-page')
    if not data_url:
        fail('sms-pricing-page data module not referenced by the SMS pricing component')
    data_js = get(data_url)
    countries = parse_countries(data_js)
    if len(countries) < MIN_COUNTRIES:
        fail(f'only {len(countries)} countries parsed; refusing to write')

    names_url = find_import(data_js, 'pricing-data') or find_import(component, 'pricing-data')
    names = parse_names(get(names_url)) if names_url else {}

    prices = []
    for cc in sorted(countries):
        price = lowest_usd(countries[cc])
        if price is None:
            continue  # no USD per-message outbound rate published for this country
        name = names.get(cc) or name_from_page(cc)
        prices.append({'country': cc, 'name': name, 'price': price})
    if len(prices) < MIN_COUNTRIES:
        fail(f'only {len(prices)} countries with a USD rate; refusing to write')

    fee = verify_fee()

    previous = None
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text())
        except ValueError:
            previous = None
    if previous and previous.get('prices') == prices and previous.get('verify_fee') == fee:
        print(f'fetch_plivo: {len(prices)} countries, unchanged')
        return

    doc = {
        'provider': 'Plivo',
        'slug': 'plivo',
        'source': data_url,
        'source_page': PRICE_PAGE,
        'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'basis': 'Published outbound SMS price per message segment in USD, lowest carrier or sender-type '
                 'rate per country (USD rates only; US/CA carrier surcharges not included).',
        'verify_fee': fee,
        'verify_fee_note': f'Plivo Verify advertises a ${fee:g} verification fee: only the SMS channel rate '
                           f'is charged per OTP ({VERIFY_PAGE}).',
        'prices': prices,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=OUT.parent, prefix='.plivo.', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(json.dumps(doc, indent=1, ensure_ascii=False) + '\n')
        os.replace(tmp, OUT)
    except OSError as e:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        fail(f'could not write {OUT}: {e}')
    print(f'fetch_plivo: wrote {OUT.relative_to(ROOT)} with {len(prices)} countries')


if __name__ == '__main__':
    main()
