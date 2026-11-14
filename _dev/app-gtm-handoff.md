# app.secondfactor.ai: Google Tag Manager + signup conversion tracking

<!-- Developer handoff, not a website page. The leading underscore in _dev/ keeps GitHub Pages (Jekyll) from publishing it. -->

**Goal:** count real signups (account created) as a conversion in GA4 and Google Ads, and keep the visitor's session from secondfactor.ai when they cross to the app.

Everything else (GA4, Google Ads Conversion Linker, cross-domain settings, the event tags) is already configured and published inside GTM. The app only needs the snippet and one dataLayer event.

IDs: GTM container `GTM-5KHCJLB6` (the same container as secondfactor.ai) · GA4 `G-YG63Q66ERF`

---

## 1. Add the GTM snippet to the app's HTML shell

Add it to every page or route the app serves, including signup, login and dashboard. In a SPA, it goes in `index.html` (or the root layout), so it loads once.

**As high in `<head>` as possible:**

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5KHCJLB6');</script>
<!-- End Google Tag Manager -->
```

**Immediately after the opening `<body>` tag:**

```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5KHCJLB6"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

**Do not** also add a separate GA4 `gtag.js` snippet (`googletagmanager.com/gtag/js?id=G-YG63Q66ERF`). GTM already loads GA4, so a second copy double-counts every pageview. If the app has one today, remove it.

**SPA page views:** GTM sends a page view on the initial load. If you want in-app route changes counted as page views too, tell us (Naman) and we'll enable GA4's history-change page views in GTM. No code needed.

---

## 2. Push `sign_up` when an account is actually created

Fire this **once**, only **after** the signup succeeds (the server has created the account). Do not fire it when the form renders, on validation errors, on login, or on page refresh.

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: 'sign_up',
  method: 'email'   // how they signed up: 'email', 'google', 'github', ...
});
```

- Put it in the success handler or callback of the signup request, or on the first load after the account is created if signup ends with a redirect.
- In SPAs, guard against re-renders, for example by firing it from the success callback rather than a component effect. If you have to use an effect, set a one-time flag in `sessionStorage`.
- Social and OAuth signups (Google, GitHub) count too: push with the matching `method` when the OAuth flow creates a **new** account, not when an existing user signs in.
- **No personal data in the dataLayer:** no email, name, phone number or user ID. `method` is enough.

---

## 3. Keep the cross-domain parameter

Links from secondfactor.ai to the app arrive with a `_gl=...` query parameter. GTM reads it to continue the same session and the Google Ads click.

- Keep the query string on `/signup` (and `/login`) until GTM has loaded. If the app redirects these routes (for example `/signup` → `/register` or `/auth/signup`), carry the query string through the redirect.
- Don't strip unknown query parameters on first load.

---

## 4. Store the Google Ads click ID with the new account (recommended)

This lets us later upload offline conversions such as "activated" or "first paid OTP" without more front-end work.

On successful signup, read the Google Ads click ID and save it on the user or account record:

1. If the current URL has `gclid` (or `gbraid` / `wbraid`), use that.
2. Otherwise read the first-party cookie that GTM's Conversion Linker sets on the app domain:
   - `_gcl_aw` has the format `GCL.<timestamp>.<gclid>`; the gclid is everything after the second dot.
   - `_gcl_gb` holds `gbraid` in the same format (iOS app-to-web clicks).
3. Save the value with the signup timestamp (for example `gclid`, `gclid_captured_at`). It may be empty; most signups won't come from ads.

---

## 5. Content Security Policy (only if the app sends a CSP header)

Allow these hosts, or GTM, GA4 and Ads will be blocked:

- `script-src`: `https://www.googletagmanager.com` `https://*.googletagmanager.com` `https://www.google.com` `https://www.googleadservices.com` `https://googleads.g.doubleclick.net`
- `connect-src`: `https://*.google-analytics.com` `https://*.analytics.google.com` `https://*.googletagmanager.com` `https://www.google.com` `https://*.doubleclick.net` `https://www.googleadservices.com`
- `img-src`: `https://*.google-analytics.com` `https://*.googletagmanager.com` `https://www.google.com` `https://*.doubleclick.net` `https://www.googleadservices.com`
- `frame-src`: `https://www.googletagmanager.com` (the noscript iframe)

---

## 6. How to test before release

1. Open GTM → **Preview**, enter the app URL (staging is fine) and connect.
2. On page load, check that **GA4 - Google tag** and **Google Ads - Conversion Linker** fire.
3. Start from secondfactor.ai, click **Get started**, and check that the app URL contains `_gl=`.
4. Complete a test signup. In Tag Assistant you should see one `sign_up` event in the dataLayer and **GA4 - Event - sign_up (dataLayer from app)** fired once. It also shows in GA4 → Realtime / DebugView.
5. Refresh the page after signup: `sign_up` must **not** fire again.
6. Check the network tab for exactly one `page_view` hit per page load (no duplicate GA4).

Questions about the GTM or GA4 side: Naman.
