# SecondFactor.ai — static website

Plain HTML / CSS / JS. No build step, no dependencies. Upload the contents of this
folder to any static host (Netlify, Vercel, Cloudflare Pages, S3 + CloudFront,
Nginx, Apache) and it works as-is.

## Pages

    index.html        Home (animated hero, routing diagram, testimonials, FAQ)
    channels.html     Channels overview
    sms.html          SMS OTP
    whatsapp.html     WhatsApp OTP
    viber.html        Viber OTP
    rcs.html          RCS OTP
    pricing.html      Pricing (one routed rate per country, per-channel on request)
    support.html      Support / contact
    docs.html         API documentation (send, check, fetch, webhooks)
    privacy.html      Privacy Policy (full text; footer links point here)
    terms.html        Terms & Conditions (full text; footer links point here)

## Assets

    css/styles.css    Base tokens and components
    css/motion.css    Shared design layer: gradients, cards, animation, responsive rules
    js/data.js        Per-country rate data (DEMO VALUES — replace before launch)
    js/app.js         Scroll reveal, mobile drawer, pricing logic, support form
    assets/           Logo mark (mark-v4.png) and lockup
    docs/             PDF copies of the Privacy Policy and Terms (offered as "Download PDF" on
                      privacy.html / terms.html — keep them in sync with the page text)
    robots.txt

## Fonts

Sora (display) + JetBrains Mono (labels, code) load from Google Fonts. To self-host,
download both families into assets/ and swap the <link> in each page's <head>.

## Replacing the demo rates

Rates live in js/data.js under RATES, one entry per country:

    "India": {dial:"+91", sms:0.0038, whatsapp:0.0014, viber:null, rcs:0.0009},

Values are USD per delivered OTP. The pricing page publishes ONE routed price per
country (the lowest available value) and never discloses channels or per-channel
rates. Adding a country also needs a matching <option> in pricing.html's dropdown.

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
