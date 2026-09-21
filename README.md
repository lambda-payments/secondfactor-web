# SecondFactor.ai — static website

Plain HTML / CSS / JS. No build step, no dependencies. Upload the contents of this
folder to any static host (Netlify, Vercel, Cloudflare Pages, S3 + CloudFront,
Nginx, Apache) and it works as-is.

## Pages

Clean URLs, one directory per page (each holds an `index.html`):

    /                     index.html                    Home (animated hero, routing diagram, testimonials, FAQ)
    /channels/            channels/index.html           Channels overview
    /channels/sms/        channels/sms/index.html       SMS OTP
    /channels/whatsapp/   channels/whatsapp/index.html  WhatsApp OTP
    /channels/viber/      channels/viber/index.html     Viber OTP
    /channels/rcs/        channels/rcs/index.html       RCS OTP
    /pricing/             pricing/index.html            Pricing (one routed rate per country, per-channel on request)
    /support/             support/index.html            Support / contact
    /docs/                docs/index.html               API documentation (send, check, fetch, webhooks)
    /privacy/             privacy/index.html            Privacy Policy (full text; footer links point here)
    /terms/               terms/index.html              Terms & Conditions (full text; footer links point here)
    /blog/                blog/index.html               Blog listing: published articles as clickable cards, planned ones as "Coming soon"
    (not published)       blog/_template/index.html     Article template. Copy it to blog/<slug>/ to write a post (see below)

Internal links and asset paths are root-absolute (`/pricing/`, `/css/styles.css`), so the
site must be served from the domain root. Every page carries a `<link rel="canonical">`
and is listed in `sitemap.xml` (referenced from `robots.txt`).

## Header and footer

Every page uses the same header/footer markup (`header.band > .hd`, `footer.band > .ft` +
`.ftb`). When you change either, change it on all pages (a quick `grep -l '<header' -r .`
lists them). Mark the current section's nav link with class `on`. Geometry and colours come
from `css/chrome.css`; do not put width/padding inline on `.hd`, `.ft` or `.ftb`.

## Publishing a blog article

`blog/_template/` is the master copy. The leading underscore means GitHub Pages (Jekyll)
never publishes it, but it still previews locally at `/blog/_template/`.

1. Copy the folder: `cp -r blog/_template blog/<slug>` (lowercase, hyphenated, keyword-led slug).
2. In the new `index.html`, edit every line marked `<!-- EDIT -->`: title, description,
   canonical and `og:url` (slug), Open Graph / Twitter text and image, both dates, the JSON-LD
   block, breadcrumb, category, h1, standfirst, byline and author box.
3. Change the robots meta to `index, follow, max-image-preview:large, max-snippet:-1`.
4. Write the body with the ready-made blocks: `.post-tldr` (key takeaways), `.post-table`
   (comparison table, add `class="is-us"` to our row), `.post-item` (one per provider, with
   `.post-facts` and `.post-proscons`), `.post-note`, `.post-cta`, `.post-faq`. Delete the
   "Body styles reference" block. Give every `<h2>` an `id` and list it in `.post-toc`.
5. Do not wrap body content in `<section>` or use `.crd`: `motion.css` restyles both.
6. Link the article: turn its card on `/blog/` into a link, and fill "Keep reading" with
   published posts only.
7. Add the URL to `sitemap.xml` (and bump the `/blog/` entry's `lastmod`).

## SEO head

Each page's `<head>` carries, in order: title, meta description, canonical, robots,
theme-color, Open Graph tags, Twitter card tags, apple-touch-icon, then a JSON-LD block.
The JSON-LD is a `@graph`: the home page declares `Organization` + `WebSite` + `WebPage`;
every other page declares `BreadcrumbList` + `WebPage`. When you add a page, copy the head
of the closest sibling and update the URL, title, description and breadcrumb name.

The old flat URLs (`/sms.html`, `/pricing.html`, ...) are kept as tiny redirect stubs
(meta refresh + canonical + noindex) so existing links and search results still resolve.
GitHub Pages cannot issue server-side 301s; if the site moves to a host that can
(Netlify `_redirects`, Cloudflare Pages, Nginx), replace the stubs with real 301s.

## Assets

    css/styles.css    Base tokens and components
    css/motion.css    Shared design layer: gradients, cards, animation, responsive rules
    css/article.css   Blog article layout (.post-* classes). Loaded only by /blog/<slug>/ pages
    css/chrome.css    Header + footer: the ONLY place their width, spacing and colours live.
                      Loaded last on every page (the home page has its own inline CSS, so this
                      is what keeps its header/footer identical to the inner pages).
    js/data.js        Per-country rate data (DEMO VALUES — replace before launch)
    js/app.js         Scroll reveal, mobile drawer, pricing logic, support form
    assets/           Logo mark (mark-v4.png) and lockup
    assets/legal/     PDF copies of the Privacy Policy and Terms (offered as "Download PDF" on
                      /privacy/ and /terms/ — keep them in sync with the page text)
    assets/og-default.png  1200x630 share image used by the Open Graph / Twitter tags on every page
    robots.txt        Allows all crawlers, points at sitemap.xml
    sitemap.xml       All canonical page URLs
    404.html          Custom not-found page (GitHub Pages serves it automatically; noindex)

## Fonts

Sora (display) + JetBrains Mono (labels, code) load from Google Fonts. To self-host,
download both families into assets/ and swap the <link> in each page's <head>.

## Replacing the demo rates

Rates live in js/data.js under RATES, one entry per country:

    "India": {dial:"+91", sms:0.0038, whatsapp:0.0014, viber:null, rcs:0.0009},

Values are USD per delivered OTP. The pricing page publishes ONE routed price per
country (the lowest available value) and never discloses channels or per-channel
rates. Adding a country also needs a matching <option> in pricing/index.html's dropdown.

## Links to wire up

* Sign in      -> https://app.secondfactor.ai/login
* Get started  -> https://app.secondfactor.ai/signup
* LinkedIn     -> https://www.linkedin.com/company/secondfactorai/home
* Support form shows a confirmation note only — point the <form> action at your
  backend or a form service and remove the preventDefault handler in js/app.js.

## Notes

* All motion respects prefers-reduced-motion.
* Layout is fluid: containers cap at min(1640px, 94vw); grids collapse at 1100/900/720px;
  the header becomes a hamburger drawer below 860px.
* Rate figures in copy are illustrative — update with your real price list.
