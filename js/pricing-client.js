/* SecondFactor.ai — the one price client for the site.
   Prices come from data/pricing.json, which scripts/fetch-pricing.py writes from
   GET /v2/Pricing on the server side (GitHub Actions, key in the SF_PRICING_KEY secret).
   Nothing here talks to the API and no price is hard-coded. Every page that shows a price
   uses window.SFPricing; js/app.js also fills any <span data-price-country="NP"> element.

   @typedef {Object} Price
   @property {string} country   ISO 3166-1 alpha-2 code, e.g. "NP"
   @property {string} name      country name in English
   @property {string} price     USD per OTP sent, a decimal string with six places
   @property {string} currency  always "USD" */
(function () {
  'use strict';
  var DATA_URL = '/data/pricing.json';
  var promise = null, fetchedAt = null;

  /** @returns {Promise<Price[]>} the current list, sorted by country code; [] if the data file cannot be read */
  function getPrices() {
    if (!promise) {
      promise = fetch(DATA_URL, { cache: 'no-cache', headers: { 'Accept': 'application/json' } })
        .then(function (res) { if (!res.ok) throw new Error('pricing.json ' + res.status); return res.json(); })
        .then(function (doc) {
          var list = Array.isArray(doc) ? doc : (doc && doc.prices);
          if (!Array.isArray(list)) throw new Error('pricing.json has no prices array');
          fetchedAt = doc.fetched_at || null;
          return list;
        })
        .catch(function (err) { console.warn('SFPricing:', err.message); promise = null; return []; });
    }
    return promise;
  }

  /** @param {string} code ISO code, any case @returns {Promise<Price|null>} null when the country has no price of its own */
  function getPrice(code) {
    code = String(code || '').toUpperCase();
    return getPrices().then(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].country === code) return list[i];
      return null;
    });
  }

  /* Round UP to four decimals using integer arithmetic on the decimal string, so the site
     never shows less than the real charge: "0.006420" -> "0.0065", "0.019217" -> "0.0193". */
  function roundUp4(price) {
    var m = /^(\d+)(?:\.(\d*))?$/.exec(String(price).trim());
    if (!m) return null;
    var frac = (m[2] || '').slice(0, 6); while (frac.length < 6) frac += '0';
    var micro = parseInt(m[1], 10) * 1000000 + parseInt(frac, 10);   // whole-number micro-dollars
    var units = Math.floor(micro / 100) + (micro % 100 ? 1 : 0);      // ceil to 1/10000
    var whole = Math.floor(units / 10000), rest = String(units % 10000);
    while (rest.length < 4) rest = '0' + rest;
    return whole + '.' + rest;
  }

  /** @param {Price|string|null} p @returns {string} "$0.0065", or "Contact us" when there is no price */
  function display(p) {
    var raw = p && typeof p === 'object' ? p.price : p;
    var r = raw == null ? null : roundUp4(raw);
    return r ? '$' + r : 'Contact us';
  }

  window.SFPricing = {
    getPrices: getPrices,
    getPrice: getPrice,
    roundUp4: roundUp4,
    display: display,
    /** @returns {string|null} ISO timestamp of the committed list */
    fetchedAt: function () { return fetchedAt; },
    CONTACT_URL: '/support/'
  };
})();
