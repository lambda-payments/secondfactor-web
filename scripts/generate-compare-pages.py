#!/usr/bin/env python3
"""Generate the direct-link comparison landing pages under /compare/.

Each page compares SecondFactor's price per OTP sent with one competitor's published price,
country by country. Pages are noindex and are not linked from the site; share them directly.
The table is filled in the browser by js/compare.js from data/pricing.json and
data/competitors/<slug>.json (scripts/competitors/fetch_<slug>.py).

    python3 scripts/generate-compare-pages.py            # write pages
    python3 scripts/generate-compare-pages.py --check    # fail if a page is out of date

The page shell (head, header, footer) is taken from tools/savings-calculator/index.html so it
stays identical to the rest of the site. Add a provider by adding an entry to PROVIDERS and a
fetch script that writes data/competitors/<slug>.json.
"""
import argparse
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHELL = ROOT / 'tools' / 'savings-calculator' / 'index.html'

# path: URL under /compare/; slug: data/competitors/<slug>.json; name: as shown in copy.
PROVIDERS = [
    {'path': 'twilio-sms', 'slug': 'twilio', 'name': 'Twilio',
     'h1': 'SecondFactor vs Twilio SMS, Country by Country',
     'what': 'Twilio&rsquo;s published outbound SMS rate, and with Twilio Verify, which adds a $0.05 fee per successful verification on top of the SMS'},
    {'path': 'plivo', 'slug': 'plivo', 'name': 'Plivo',
     'h1': 'SecondFactor vs Plivo, Country by Country',
     'what': 'Plivo&rsquo;s published outbound SMS rate'},
    {'path': 'firebase', 'slug': 'firebase', 'name': 'Firebase Authentication',
     'h1': 'SecondFactor vs Firebase Phone Auth, Country by Country',
     'what': 'the per-SMS rate Google publishes for Firebase phone sign-in'},
    {'path': 'aws-sns', 'slug': 'aws-sns', 'name': 'AWS SNS',
     'h1': 'SecondFactor vs AWS SNS, Country by Country',
     'what': 'Amazon&rsquo;s published outbound SMS rate for SNS and End User Messaging'},
    {'path': 'vonage', 'slug': 'vonage', 'name': 'Vonage',
     'h1': 'SecondFactor vs Vonage, Country by Country',
     'what': 'Vonage&rsquo;s published outbound SMS rate, and with Vonage Verify, which adds a fee of about $0.06 per successful verification on top of the SMS'},
    {'path': 'bird', 'slug': 'bird', 'name': 'Bird',
     'h1': 'SecondFactor vs Bird (MessageBird), Country by Country',
     'what': 'Bird&rsquo;s published outbound SMS rate'},
    {'path': 'messagecentral', 'slug': 'messagecentral', 'name': 'Message Central',
     'h1': 'SecondFactor vs Message Central, Country by Country',
     'what': 'Message Central&rsquo;s published VerifyNow price'},
]


def shell():
    src = SHELL.read_text()
    top = src[:src.index('<main id="main"')]
    foot = src[src.index('</main>') + len('</main>'):]
    top = re.sub(r'<script type="application/ld\+json">.*?</script>\n', '', top, flags=re.S)
    top = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex, nofollow">', top)
    foot = re.sub(r'<script src="/js/savings\.js"></script>', '<script src="/js/compare.js"></script>', foot)
    return top, foot


def page(p, top, foot):
    url = f'https://secondfactor.ai/compare/{p["path"]}/'
    title = html.unescape(re.sub('<[^>]+>', '', p['h1'])).replace(', Country by Country', ': OTP Price by Country')
    desc = f'Country-by-country comparison of SecondFactor’s price per OTP sent with {p["name"]}’s published price.'
    t = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)} | SecondFactor.ai</title>', top)
    for pat in (r'(<meta name="description" content=")[^"]*', r'(<meta property="og:description" content=")[^"]*', r'(<meta name="twitter:description" content=")[^"]*'):
        t = re.sub(pat, lambda m: m.group(1) + html.escape(desc, quote=True), t)
    for pat in (r'(<meta property="og:title" content=")[^"]*', r'(<meta name="twitter:title" content=")[^"]*'):
        t = re.sub(pat, lambda m: m.group(1) + html.escape(title, quote=True), t)
    t = re.sub(r'https://secondfactor\.ai/tools/savings-calculator/', url, t)
    name = html.escape(p['name'])
    main = f'''<main id="main" class="tools-page cmp-page" data-competitor="{p['slug']}">
<div class="tool-frame">
  <div class="tools-heading"><span class="tool-eyebrow">PRICE COMPARISON</span><h1>{p['h1']}</h1><p class="tool-lead">What one OTP costs with SecondFactor compared with {p['what']}. SecondFactor&rsquo;s price is per OTP sent, whichever channel delivers it (SMS, WhatsApp, Viber or RCS), with delivery and verification included.</p></div>

  <div class="cmp-controls">
    <div class="pr-field"><label for="cmpSearch">Find a country</label><input class="pr-select sv-num" id="cmpSearch" type="search" placeholder="Nepal, IN, United&hellip;" autocomplete="off"></div>
    <div class="pr-field"><label for="cmpMode">Compare against</label><select class="pr-select" id="cmpMode"><option value="verify">{name} with verification fee</option><option value="sms">{name} SMS only</option></select></div>
    <div class="pr-field"><label for="cmpSort">Sort by</label><select class="pr-select" id="cmpSort"><option value="saving">Biggest saving first</option><option value="name">Country name</option><option value="worst">Smallest saving first</option></select></div>
    <div class="pr-field"><label for="cmpVolume">Monthly OTPs: <output id="cmpVolumeOut" for="cmpVolume">100,000</output></label><input type="range" id="cmpVolume" min="1000" max="1000000" step="1000" value="100000" class="cmp-range"></div>
  </div>
  <p class="sv-help cmp-count" id="cmpCount" aria-live="polite"></p>

  <div class="sv-table-wrap"><table class="sv-table cmp-table"><thead><tr><th scope="col">Country</th><th scope="col" class="num"><span data-mode-label>{name}</span><br><small>per OTP</small></th><th scope="col" class="num">SecondFactor<br><small>per OTP sent</small></th><th scope="col" class="num">You save<br><small>per OTP</small></th><th scope="col" class="num">You save<br><small>per month</small></th></tr></thead><tbody id="cmpTable"></tbody></table></div>
  <p class="sv-note cmp-note" id="cmpStamp"></p>
  <p class="sv-note cmp-note">{name} figures are its published US-dollar list prices as described above; volume discounts, retries, failed attempts, sender registration and monthly fees are not included for either provider. SecondFactor prices are rounded up to four decimals. Countries not listed can still be sent to: <a href="/support/">contact us</a> for a rate.</p>

  <div class="tool-cta"><div><h2>Ready to switch?</h2><p>Start with free credits, or talk to us about volume pricing for your markets.</p></div><a class="tool-button" href="https://app.secondfactor.ai/signup" target="_blank" rel="noopener">Get started <span aria-hidden="true">&rarr;</span></a></div>
</div>
<noscript><p class="tool-error" style="padding:0 20px">Enable JavaScript to see the comparison.</p></noscript>
</main>'''
    return t + main + foot


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    top, foot = shell()
    stale = []
    for p in PROVIDERS:
        out = ROOT / 'compare' / p['path'] / 'index.html'
        content = page(p, top, foot)
        if args.check:
            if not out.exists() or out.read_text() != content:
                stale.append(str(out.relative_to(ROOT)))
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content)
    if stale:
        print('Out of date: ' + ', '.join(stale), file=sys.stderr)
        sys.exit(1)
    if not args.check:
        print(f'Generated {len(PROVIDERS)} comparison pages.')


if __name__ == '__main__':
    main()
