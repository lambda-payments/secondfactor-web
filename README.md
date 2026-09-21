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

Internal links and asset paths are root-absolute (`/pricing/`, `/css/styles.css`), so the
site must be served from the domain root. Every page carries a `<link rel="canonical">`
and is listed in `sitemap.xml` (referenced from `robots.txt`).

The old flat URLs (`/sms.html`, `/pricing.html`, ...) are kept as tiny redirect stubs
(meta refresh + canonical + noindex) so existing links and search results still resolve.
GitHub Pages cannot issue server-side 301s; if the site moves to a host that can
(Netlify `_redirects`, Cloudflare Pages, Nginx), replace the stubs with real 301s.

## Assets

    css/styles.css    Base tokens and components
    css/motion.css    Shared design layer: gradients, cards, animation, responsive rules
    js/data.js        Per-country rate data (DEMO VALUES — replace before launch)
    js/app.js         Scroll reveal, mobile drawer, pricing logic, support form
    assets/logo/      Brand files: secondFactor-full.png (header/footer lockup), secondfactor-icon.png
                      (favicon); the -white variants are for dark backgrounds and are not used yet
    assets/legal/     PDF copies of the Privacy Policy and Terms (offered as "Download PDF" on
                      /privacy/ and /terms/ — keep them in sync with the page text)
    robots.txt        Allows all crawlers, points at sitemap.xml
    sitemap.xml       All canonical page URLs

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
