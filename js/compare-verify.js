/* Embedded savings calculator and country table. Both use the site's maintained
   SecondFactor and Twilio rate files. Assumes one send per completed verification. */
(function () {
  'use strict';
  // The header wraps at tablet widths. Keep the section nav and anchor offsets
  // aligned with its actual size, independently of pricing-data availability.
  var page = document.querySelector('.cv-page');
  var header = document.querySelector('header.band');
  var nav = document.querySelector('.cv-chapter-nav');
  if (page && header && nav) {
    function sizeNavigation() {
      page.style.setProperty('--cv-header-height', header.getBoundingClientRect().height + 'px');
      page.style.setProperty('--cv-nav-height', nav.getBoundingClientRect().height + 'px');
    }
    sizeNavigation();
    if (window.ResizeObserver) {
      var navigationObserver = new ResizeObserver(sizeNavigation);
      navigationObserver.observe(header);
      navigationObserver.observe(nav);
    } else {
      window.addEventListener('resize', sizeNavigation);
    }
  }
  var P = window.SFPricing;
  var country = document.getElementById('cv-country');
  if (!P || !country) return;
  var volume = document.getElementById('cv-volume');
  var sfRate = document.getElementById('cv-sf-rate');
  var twRate = document.getElementById('cv-tw-rate');
  var status = document.getElementById('cv-price-status');
  var search = document.getElementById('cv-country-search');
  var expand = document.getElementById('cv-expand-countries');
  var body = document.getElementById('cv-country-rows');
  var rows = [], byCode = {}, expanded = false;
  var previewCodes = ['AU', 'DE', 'IN', 'ID', 'NP', 'PH', 'GB', 'US'];
  var fmt = new Intl.NumberFormat('en-US');
  var money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
  function set(id, value) { document.getElementById(id).textContent = value; }
  function price(n) { return '$' + n.toFixed(4); }
  function validRate(input) {
    return input.value.trim() !== '' && input.validity.valid && Number.isFinite(input.valueAsNumber) && input.valueAsNumber >= 0;
  }
  function resetRates() {
    var row = byCode[country.value];
    if (!row) return;
    sfRate.value = row.sf.toFixed(4);
    twRate.value = row.tw == null ? '' : row.tw.toFixed(4);
    twRate.placeholder = row.tw == null ? 'Enter your quote' : '';
    renderCalculator();
  }
  function renderCalculator() {
    var row = byCode[country.value];
    if (!row) return;
    var count = Number(volume.value);
    set('cv-volume-out', fmt.format(count));
    volume.setAttribute('aria-valuetext', fmt.format(count) + ' monthly verifications');
    set('cv-result-country', row.name);
    if (!validRate(sfRate) || !validRate(twRate)) {
      ['cv-saving-value', 'cv-sf-total', 'cv-tw-total', 'cv-year-total'].forEach(function (id) { set(id, '—'); });
      set('cv-saving-label', 'Estimate unavailable');
      set('cv-saving-pct', row.tw == null && twRate.value === '' ? 'No published Twilio rate for this country. Enter your quote to compare.' : 'Enter a rate from $0 to $100 in both fields.');
      sfRate.setAttribute('aria-invalid', String(!validRate(sfRate)));
      twRate.setAttribute('aria-invalid', String(!validRate(twRate)));
      return;
    }
    sfRate.removeAttribute('aria-invalid'); twRate.removeAttribute('aria-invalid');
    var sf = sfRate.valueAsNumber, tw = twRate.valueAsNumber;
    var delta = Math.round((tw - sf) * count * 100) / 100;
    var higher = delta < 0;
    set('cv-saving-value', money.format(Math.abs(delta)));
    set('cv-saving-label', higher ? 'Additional monthly cost with SecondFactor' : 'Estimated monthly savings');
    set('cv-saving-pct', delta === 0 ? 'Same estimated cost at these rates.' : tw > 0 ? (Math.abs(tw - sf) / tw * 100).toFixed(1) + '% ' + (higher ? 'higher' : 'lower') + ' than Twilio Verify at these rates.' : 'SecondFactor costs more at these rates.');
    set('cv-sf-total', money.format(sf * count));
    set('cv-tw-total', money.format(tw * count));
    set('cv-year-total', money.format(Math.abs(delta) * 12) + (delta === 0 ? '' : higher ? ' more' : ' less'));
    document.querySelector('.cv-saving').classList.toggle('is-higher', higher);
  }
  function renderCountries() {
    var query = search.value.trim().toLowerCase();
    var filtered = rows.filter(function (row) { return !query || row.name.toLowerCase().includes(query) || row.country.toLowerCase() === query; });
    var shown = query || expanded ? filtered : rows.filter(function (row) { return previewCodes.indexOf(row.country) !== -1; });
    body.replaceChildren();
    if (!shown.length) {
      var empty = document.createElement('tr'), cell = document.createElement('td');
      cell.colSpan = 4; cell.textContent = 'No matching country. Try its name or two-letter code.';
      empty.appendChild(cell); body.appendChild(empty);
    }
    shown.forEach(function (row) {
      var tr = document.createElement('tr');
      var th = document.createElement('th'); th.scope = 'row'; th.textContent = row.name;
      var code = document.createElement('small'); code.textContent = row.country; th.appendChild(code); tr.appendChild(th);
      var sf = document.createElement('td'); sf.textContent = price(row.sf); tr.appendChild(sf);
      var tw = document.createElement('td'); tw.textContent = row.tw == null ? 'Not published' : price(row.tw); tr.appendChild(tw);
      var difference = document.createElement('td');
      if (row.tw == null) { difference.textContent = '—'; }
      else {
        var delta = Math.round((row.tw - row.sf) * 10000) / 10000;
        difference.textContent = delta === 0 ? 'Same price' : price(Math.abs(delta)) + (delta > 0 ? ' less' : ' more');
        if (delta < 0) difference.className = 'cv-price-higher';
      }
      tr.appendChild(difference); body.appendChild(tr);
    });
    set('cv-country-count', query ? filtered.length + ' matching countries' : 'Showing ' + shown.length + ' of ' + rows.length + ' countries');
    expand.hidden = !!query || rows.length <= shown.length && !expanded;
    expand.textContent = expanded ? 'Show fewer countries' : 'Show all ' + rows.length + ' countries';
    expand.setAttribute('aria-expanded', String(expanded));
  }
  function date(iso) {
    var d = new Date(iso);
    return !iso || Number.isNaN(d.getTime()) ? 'date unavailable' : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  }
  function fail() {
    status.textContent = 'Prices could not be loaded. Reload the page or contact us for a quote.';
    set('cv-saving-pct', 'Pricing data unavailable.');
    body.replaceChildren();
    var tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 4; td.textContent = 'Country prices are unavailable right now.';
    tr.appendChild(td); body.appendChild(tr);
  }
  Promise.all([
    P.getPrices(),
    fetch('/data/competitors/twilio.json', {cache: 'no-cache'}).then(function (r) { if (!r.ok) throw new Error('Twilio prices unavailable'); return r.json(); })
  ]).then(function (data) {
    var sf = data[0], twilio = data[1], twByCode = {};
    if (!sf.length || !Array.isArray(twilio.prices) || !twilio.prices.length || !Number.isFinite(twilio.verify_fee) || twilio.verify_fee < 0) throw new Error('Invalid price list');
    twilio.prices.forEach(function (row) {
      var value = Number(row.price);
      if (row.price !== '' && row.price != null && Number.isFinite(value) && value >= 0) twByCode[row.country] = value;
    });
    sf.forEach(function (row) {
      var rounded = P.roundUp4(row.price);
      if (rounded == null || !row.country || !row.name) return;
      var their = twByCode[row.country];
      var item = {country: row.country, name: row.name, sf: Number(rounded), tw: their == null ? null : Number(P.roundUp4((their + twilio.verify_fee).toFixed(6)))};
      rows.push(item); byCode[item.country] = item;
    });
    if (!rows.length) throw new Error('No valid rates');
    rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
    country.replaceChildren();
    rows.forEach(function (row) { var option = document.createElement('option'); option.value = row.country; option.textContent = row.name; country.appendChild(option); });
    var params = new URLSearchParams(location.search), requested = (params.get('country') || '').toUpperCase();
    country.value = byCode[requested] ? requested : byCode.US ? 'US' : rows[0].country;
    var requestedVolume = Number(params.get('volume'));
    if (Number.isFinite(requestedVolume) && requestedVolume >= 1000 && requestedVolume <= 1000000) volume.value = Math.round(requestedVolume / 1000) * 1000;
    document.getElementById('cv-calc-controls').disabled = false; search.disabled = false;
    status.textContent = 'List prices: SecondFactor ' + date(P.fetchedAt()) + ' · Twilio ' + date(twilio.fetched_at) + '. USD.';
    var sources = document.getElementById('cv-price-sources');
    sources.appendChild(document.createTextNode('Source data: SecondFactor (' + date(P.fetchedAt()) + '); Twilio (' + date(twilio.fetched_at) + '). '));
    country.addEventListener('change', resetRates);
    [volume, sfRate, twRate].forEach(function (input) { input.addEventListener('input', renderCalculator); });
    document.getElementById('cv-reset-rates').addEventListener('click', resetRates);
    search.addEventListener('input', renderCountries);
    expand.addEventListener('click', function () {
      expanded = !expanded; renderCountries();
      if (!expanded) document.getElementById('country-prices-title').scrollIntoView({block: 'start', behavior: 'instant'});
    });
    resetRates(); renderCountries();
  }).catch(fail);
})();
