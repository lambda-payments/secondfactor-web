/* SecondFactor.ai — product analytics (PostHog) and its consent banner.
   Loaded with `defer` in <head> on every page, next to js/theme.js, so this file is the one place
   analytics is configured. It sends to the same PostHog project as the dashboard
   (app.secondfactor.ai); the `app` and `environment` properties on every event tell the two apart.

   Hosts: only the production domain (and a `uat-` host, should one ever exist) starts PostHog.
   Local servers, forks and anything else send nothing, so development never pollutes the data.

   Consent: until the visitor answers the banner, PostHog keeps its state in memory only. It writes
   no cookie and no storage entry, and every page load counts as a new anonymous visitor. Accepting
   moves that state into a cookie and local storage so returning visitors are recognised; declining
   keeps the memory-only tracking, matching the dashboard. The answer is remembered under
   "sf-analytics-consent" so the banner is not shown again. Google Analytics, Google Ads and the
   signup_click event run through Google Tag Manager (GTM-5KHCJLB6, in each page's <head>) and are
   not governed by this banner.

   Privacy: every PostHog feature the site does not use is switched off, because several of them
   (the /flags request, heatmaps) send the full page address through paths that `before_send`
   never sees. `before_send` then removes the query string and fragment from every address an
   event carries, and autocapture masks element text and attributes so nothing a visitor types or
   reads (a phone number in the tools, a support message) is recorded. */
(function () {
  var host = window.location.hostname;
  var environment = host === 'secondfactor.ai' || host === 'www.secondfactor.ai' ? 'production'
    : /^uat[-.]/.test(host) ? 'uat' : null;
  if (!environment) return;

  var CONSENT_KEY = 'sf-analytics-consent';
  // Storage can throw (blocked site data, some private modes). A failed read counts as "not yet
  // answered" and a failed write only means the banner is shown again on the next visit.
  function readConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function writeConsent(value) { try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {} }
  var consent = readConsent();

  // Removes the query string and fragment from every absolute address anywhere in the event,
  // including nested ones such as `$set_once.$initial_current_url`. Stripping everything rather
  // than naming parameters means a new parameter can never leak, and nothing useful is lost:
  // PostHog has already copied the utm_* campaign parameters into properties of their own.
  function stripUrls(value) {
    for (var key in value) {
      var item = value[key];
      if (typeof item === 'string' && /^https?:\/\//i.test(item)) value[key] = item.split(/[?#]/)[0];
      else if (item && typeof item === 'object') stripUrls(item);
    }
  }

  // PostHog's official loader, copied verbatim from https://posthog.com/docs/libraries/js.
  // Do not edit it by hand: a single wrong character breaks it without any error.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init('phc_yQBQiVHYpNh5P6X4MSmFhy4eKggcfnnUuinBVnSgUjU7', {
    api_host: 'https://us.i.posthog.com',
    // Pins PostHog's default behaviour to the version this file was written against, so a later
    // library release cannot change what the site collects without a change here.
    defaults: '2026-08-30',
    person_profiles: 'identified_only',
    persistence: consent === 'accepted' ? 'localStorage+cookie' : 'memory',
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_session_recording: true,
    advanced_disable_flags: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    // Throwing here makes PostHog drop the event, which is the safe failure.
    before_send: function (event) { stripUrls(event); return event; },
    // `loaded` runs before the first pageview is captured, so that event carries these too.
    loaded: function (ph) { ph.register({ environment: environment, app: 'website' }); }
  });

  // One delegated listener covers every call to action on every page, so the links themselves
  // carry no tracking markup. Only a fixed slug is sent, never link text or form values; the page
  // is already on the event as `$pathname`. `sendBeacon` lets the event survive a same-tab
  // navigation to /support/.
  var SIGNUP = 'https://app.secondfactor.ai/signup';
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href'), cta = null;
    if (href.indexOf(SIGNUP) === 0) {
      cta = link.closest('header') ? 'header-get-started' : link.closest('footer') ? 'footer-get-started' : 'get-started';
    } else if (href === '/support/' && link.closest('main')) {
      cta = 'contact-sales';
    }
    if (cta) posthog.capture('cta_clicked', { cta: cta }, { transport: 'sendBeacon' });
  });

  if (consent === 'accepted' || consent === 'declined') return;

  // The banner is placed first in <body> so keyboard and screen-reader users meet it early,
  // while CSS (css/chrome.css, `.sf-consent`) pins it to the bottom of the viewport.
  var banner = document.createElement('div');
  banner.className = 'sf-consent';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Analytics consent');
  banner.innerHTML =
    '<p>We count visits anonymously to improve this site. May we store an anonymous ID so we can ' +
    'recognise you when you come back? <a href="/privacy/">Privacy Policy</a></p>' +
    '<div class="sf-consent-a">' +
      '<button type="button" class="sf-consent-b" data-choice="declined">Decline</button>' +
      '<button type="button" class="sf-consent-b sf-consent-ok" data-choice="accepted">Accept</button>' +
    '</div>';
  banner.addEventListener('click', function (e) {
    var button = e.target.closest('[data-choice]');
    if (!button) return;
    var choice = button.getAttribute('data-choice');
    writeConsent(choice);
    if (choice === 'accepted') posthog.set_config({ persistence: 'localStorage+cookie' });
    banner.remove();
  });
  document.body.insertBefore(banner, document.body.firstChild);
})();
