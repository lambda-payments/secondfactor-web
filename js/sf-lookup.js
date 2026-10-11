/* SecondFactor.ai — browser adapter for the Lookup API used by the /tools/ pages.
   Loaded before js/phone-check.js and js/carrier-check.js, which call window.SFLookup.

   GET https://api.secondfactor.ai/v2/PhoneNumbers/{E164}?Fields=line_type_intelligence
   with an X-API-Key header. The key below belongs to a demo account that can only run
   lookups; it is stored base64-encoded in pieces so it does not sit in the source as plain
   text, but anything a browser can send is readable by anyone who opens DevTools, so treat
   it as public: keep the account read-only, prepaid and rate-limited, and rotate it from
   https://app.secondfactor.ai/dashboard/keys if it is abused.

   The API only answers browser requests from origins on its CORS allowlist, so this works on
   https://secondfactor.ai once that origin is allowed (local previews fall back to an
   "unavailable" state). */
(function () {
  'use strict';

  var BASE = 'https://api.secondfactor.ai/v2/PhoneNumbers/';
  var PARTS = ['c2ZfY2ZkOGEzNDMx', 'NTQyLnlpd2g0R0M1', 'ZnctcEZnRjRnWmI4', 'V2tEOFhmYl9vMzQz'];
  function key() { return atob(PARTS.join('')); }

  var TYPES = { mobile: 'Mobile', landline: 'Landline', fixedVoip: 'VoIP', nonFixedVoip: 'VoIP', voip: 'VoIP',
    tollFree: 'Toll-free', premium: 'Premium rate', sharedCost: 'Shared cost', uan: 'Universal access', voicemail: 'Voicemail',
    pager: 'Pager', personal: 'Personal number', unknown: null };
  var ERRORS = { TOO_SHORT: 'Too short for this country', TOO_LONG: 'Too long for this country',
    INVALID_COUNTRY_CODE: 'Unknown country code', INVALID_LENGTH: 'Wrong length for this country',
    INVALID_BUT_POSSIBLE: 'Possible length, but not an assigned number', NOT_A_NUMBER: 'Not an assigned number in this numbering plan' };

  var names;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { names = null; }
  function countryName(code) {
    if (!code) return null;
    try { return (names && names.of(code)) || code; } catch (e) { return code; }
  }
  function display(r) {
    var cc = r.calling_country_code ? '+' + r.calling_country_code : '';
    return r.national_format && cc ? cc + ' ' + r.national_format : r.phone_number;
  }
  function reason(r) {
    var codes = r.validation_errors || [];
    return codes.length ? codes.map(function (c) { return ERRORS[c] || c.replace(/_/g, ' ').toLowerCase(); }).join('; ') : 'Matches the numbering plan';
  }

  /* Fetch one number. Resolves the raw API object; rejects with an Error carrying .status. */
  async function fetchNumber(e164) {
    var res = await fetch(BASE + encodeURIComponent(e164) + '?Fields=line_type_intelligence', {
      headers: { 'X-API-Key': key(), 'Accept': 'application/json' }
    });
    if (!res.ok) {
      var err = new Error('lookup failed');
      err.status = res.status;
      try { err.body = await res.json(); } catch (e) {}
      throw err;
    }
    return res.json();
  }

  var common = function (r) {
    return { number: display(r), international: r.phone_number, country: countryName(r.country_code) || 'Unavailable',
      countryCode: r.country_code, callingCode: r.calling_country_code ? '+' + r.calling_country_code : 'Unavailable',
      valid: r.valid === true, reason: reason(r) };
  };

  window.SFLookup = {
    /* /tools/phone-type-check/: { value, number, country, carrier, callingCode } or null when the type is unknown */
    async phoneType(e164) {
      var r = await fetchNumber(e164), lti = r.line_type_intelligence || {};
      var value = TYPES[lti.type] || (lti.type ? lti.type : null);
      if (!r.valid) return Object.assign(common(r), { value: 'Not a valid number', carrier: 'Unavailable', invalid: true });
      if (!value) return null;
      return Object.assign(common(r), { value: value, carrier: lti.carrier_name || 'Unavailable' });
    },
    /* /tools/phone-number-validation/: { value, valid, number, country, international, reason } */
    async validate(e164) {
      var r = await fetchNumber(e164);
      return Object.assign(common(r), { value: r.valid ? 'Valid format' : 'Invalid format' });
    },
    /* /tools/carrier-check/: { number, carrier, country, countryCode, callingCode } or null when no carrier is known */
    async carrier(e164) {
      var r = await fetchNumber(e164), lti = r.line_type_intelligence || {};
      if (!r.valid || !lti.carrier_name) return null;
      return Object.assign(common(r), { carrier: lti.carrier_name });
    }
  };
})();
