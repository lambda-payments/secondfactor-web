#!/usr/bin/env python3
"""Render static country drafts from the approved India layout. No build needed to serve."""
import argparse
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'country/india/index.html'
COUNTRIES = json.loads((ROOT / 'country/countries.json').read_text())


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f'Expected one template fragment: {old[:90]}')
    return source.replace(old, new, 1)


def render_country(template, country):
    name, prose = country['name'], country['prose_name']
    slug, dial = country['slug'], country['dial']
    page = template
    # Replace entire India-specific passages before localizing shared labels.
    description = (f'Send and verify OTPs in {prose} with SecondFactor. '
                   'One API for cost-based routing, automatic fallback and managed verification.')
    old_description = re.search(r'<meta name="description" content="([^"]+)">', page)[1]
    page = page.replace(old_description, description)
    page = replace_once(page,
        'Verify users in India through SMS, WhatsApp, Viber and RCS. One API handles code generation, cost-based routing and automatic fallback.',
        f'Verify users in {prose} through one API. SecondFactor handles code generation, cost-based routing and automatic fallback.')
    page = replace_once(page,
        'Send codes to Indian mobile numbers using your registered sender and OTP template.',
        f'Reach mobile users in {prose} without requiring a messaging app.')
    page = replace_once(page,
        'Use free credits to send a real OTP to an Indian number. See the route, then verify the code.',
        f'Use free credits to send a real OTP to a number in {prose}. See the route, then verify the code.')
    page = replace_once(page, 'to Indian numbers across', f'to numbers in {prose} across')
    page = replace_once(page, '+91 98XXX XXX21', country['masked_example'])
    page = replace_once(page,
        'Availability depends on sender approvals and the recipient&rsquo;s device and network.',
        f'Channel availability in {prose} depends on your account, sender approvals and recipient support.')
    faq = '<details><summary><span>{}</span><i aria-hidden="true">+</i></summary><p>{}</p></details>'
    old = re.search(r'<details><summary><span>Do I Need DLT Registration\?.*?</details>', page)[0]
    page = replace_once(page, old, faq.format(
        f'How Do I Set Up OTP Delivery in {prose}?',
        f'Connect your chosen channels and complete their sender and template approvals. '
        f'Our team can confirm the setup needed for your traffic to {prose}.'))
    old = re.search(r'<details><summary><span>How Do I Format Indian Phone Numbers\?.*?</details>', page)[0]
    page = replace_once(page, old, faq.format(
        f'How Do I Format Phone Numbers in {prose}?',
        f'{country["number_format"]} Example format: <code>{country["example"]}</code>.'))
    page = replace_once(page,
        'SMS, WhatsApp, Viber and RCS through one API. Enable the channels you need; routing depends on sender approvals and recipient availability.',
        f'SecondFactor supports SMS, WhatsApp, Viber and RCS through one API. '
        f'Availability in {prose} depends on your account, sender approvals and recipient support.')
    # Natural articles belong in prose, never in rate keys, breadcrumbs or page titles.
    for prefix in ('in ', 'to ', 'for ', 'Outside '):
        page = page.replace(prefix + 'India', prefix + prose)
    page = page.replace('your India setup', f'your {country["short_name"]} setup')
    page = page.replace('INDIA +91', country['short_name'].upper() + ' ' + dial)
    page = page.replace('india', slug).replace('India', name).replace('+91', dial)
    if re.search(r'\bIndia\b|\bIndian\b|\bDLT\b|\bTRAI\b|\+91', page):
        raise ValueError(f'India content remains in {slug}')
    return page


def render_index(template):
    head = template[:template.index('<body>')]
    title = 'OTP Delivery by Country | SecondFactor.ai'
    description = 'Explore OTP delivery and verification with SecondFactor by country, including dialing codes, setup guidance and indicative pricing.'
    head = re.sub(r'<title>.*?</title>', '<title>' + title + '</title>', head)
    head = re.sub(r'(name="description" content=")[^"]*', r'\g<1>' + description, head)
    head = re.sub(r'(property="og:title" content=")[^"]*', r'\g<1>' + title, head)
    head = re.sub(r'(name="twitter:title" content=")[^"]*', r'\g<1>' + title, head)
    head = re.sub(r'((?:property="og:description"|name="twitter:description") content=")[^"]*', r'\g<1>' + description, head)
    head = head.replace('/country/india/', '/country/')
    structured = {'@context':'https://schema.org','@graph':[
        {'@type':'BreadcrumbList','@id':'https://secondfactor.ai/country/#breadcrumb','itemListElement':[
            {'@type':'ListItem','position':1,'name':'Home','item':'https://secondfactor.ai/'},
            {'@type':'ListItem','position':2,'name':'Countries','item':'https://secondfactor.ai/country/'}]},
        {'@type':'CollectionPage','@id':'https://secondfactor.ai/country/#webpage','url':'https://secondfactor.ai/country/',
         'name':title,'description':description,'inLanguage':'en','isPartOf':{'@id':'https://secondfactor.ai/#website'},
         'breadcrumb':{'@id':'https://secondfactor.ai/country/#breadcrumb'}}]}
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', '<script type="application/ld+json">\n'+json.dumps(structured,indent=2)+'\n</script>',head,flags=re.S)
    chrome = template[template.index('<body>'):template.index('<main')]
    footer = template[template.index('<footer'):]
    all_countries = sorted(COUNTRIES + [{'name':'India','slug':'india','dial':'+91'}],key=lambda c:c['name'])
    cards = []
    for c in all_countries:
        cards.append(f'''      <a class="cell" href="/country/{c['slug']}/" style="color:var(--fg)">
        <h2 class="h3">{html.escape(c['name'])}</h2>
        <p class="s">{c['dial']} &middot; <span data-routed-price="{html.escape(c['name'])}">&mdash;</span> / delivered OTP</p>
        <span class="lbl" style="color:var(--ac)">View Country &rarr;</span>
      </a>''')
    main = '''<main style="flex:1">
  <section class="sec country-content">
    <h1 class="h2" style="margin:18px 0 16px">OTP Delivery by Country</h1>
    <p class="p" style="max-width:64ch">Explore delivery, verification and setup for each destination. Rates are indicative and quoted in USD.</p>
    <div class="grid g4" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:36px">
''' + '\n'.join(cards) + '''
    </div>
  </section>
</main>
'''
    return head + chrome + main + footer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check generated HTML without writing files')
    args = parser.parse_args()
    template = SOURCE.read_text()
    rates = dict(re.findall(r'"([^"]+)":\{dial:"([^"]+)"', (ROOT/'js/data.js').read_text()))
    assert {c['name'] for c in COUNTRIES} == set(rates) - {'India'}, 'Country list must match pricing'
    outputs = {}
    for c in COUNTRIES:
        assert rates[c['name']] == c['dial'], f'Dialing code mismatch: {c["name"]}'
        outputs[ROOT/'country'/c['slug']/'index.html'] = render_country(template,c)
    outputs[ROOT/'country/index.html'] = render_index(template)
    stale = []
    for path, content in outputs.items():
        if args.check:
            if not path.exists() or path.read_text() != content: stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(content)
    if stale: raise SystemExit('Regenerate pages: '+', '.join(stale))
    print(('Checked' if args.check else 'Generated') + ' 19 country pages and the country index.')


if __name__ == '__main__':
    main()
