/* SecondFactor.ai — /compare/twilio-sms/: SecondFactor's price per OTP sent versus Twilio's
   published outbound SMS price, country by country.
   SecondFactor prices: window.SFPricing (data/pricing.json). Twilio prices: data/twilio-sms.json,
   written by scripts/fetch-twilio-sms.py from Twilio's public CSV (lowest carrier rate per
   country). Twilio Verify adds TWILIO_VERIFY_FEE per successful verification on top of the SMS. */
(function () {
  'use strict';
  var P = window.SFPricing, table = document.getElementById('cmpTable');
  if (!P || !table) return;
  var TWILIO_VERIFY_FEE = 0.05;   // USD per successful verification, published by Twilio
  var fmtInt = new Intl.NumberFormat('en-US');
  var search = document.getElementById('cmpSearch'), sortSel = document.getElementById('cmpSort'), modeSel = document.getElementById('cmpMode');
  var countEl = document.getElementById('cmpCount'), stampEl = document.getElementById('cmpStamp'), volEl = document.getElementById('cmpVolume');
  var rows = [];

  /* round a number UP to 4 decimals as a string, matching SFPricing.display */
  function up4(n) { return P.roundUp4(n.toFixed(6)); }
  function usd4(s) { return '$' + s; }
  function usdInt(n) { return '$' + fmtInt.format(Math.round(n)); }

  function twilioCost(tw) { return modeSel.value === 'verify' ? tw + TWILIO_VERIFY_FEE : tw; }

  function render() {
    var q = search.value.trim().toLowerCase(), vol = parseInt(volEl.value, 10) || 0;
    var list = rows.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) >= 0 || r.country.toLowerCase() === q; });
    var key = sortSel.value;
    list.sort(function (a, b) {
      if (key === 'name') return a.name.localeCompare(b.name);
      var da = a.tw == null ? -Infinity : twilioCost(a.tw) - a.sf, db = b.tw == null ? -Infinity : twilioCost(b.tw) - b.sf;
      return key === 'saving' ? db - da : da - db;
    });
    table.innerHTML = '';
    var cheaper = 0;
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      var tw = r.tw == null ? null : twilioCost(r.tw);
      var diff = tw == null ? null : tw - r.sf, pct = tw ? diff / tw * 100 : null;
      if (diff != null && diff > 0) cheaper++;
      var cells = [
        r.name + ' <span class="cmp-code">' + r.country + '</span>',
        tw == null ? '<span class="cmp-muted">Not published</span>' : usd4(up4(tw)),
        usd4(P.roundUp4(r.price)),
        diff == null ? '<span class="cmp-muted">&mdash;</span>' : '<span class="' + (diff >= 0 ? 'cmp-pos' : 'cmp-neg') + '">' + (diff >= 0 ? '' : '&minus;') + usd4(up4(Math.abs(diff))) + ' <small>(' + Math.abs(pct).toFixed(0) + '% ' + (diff >= 0 ? 'less' : 'more') + ')</small></span>',
        diff == null ? '<span class="cmp-muted">&mdash;</span>' : '<span class="' + (diff >= 0 ? 'cmp-pos' : 'cmp-neg') + '">' + (diff >= 0 ? '' : '&minus;') + usdInt(Math.abs(diff) * vol) + '</span>'
      ];
      cells.forEach(function (c, i) { var td = document.createElement('td'); td.innerHTML = c; if (i) td.className = 'num'; tr.appendChild(td); });
      table.appendChild(tr);
    });
    countEl.textContent = list.length + ' of ' + rows.length + ' countries' + (q ? '' : ' · SecondFactor is cheaper in ' + cheaper);
    document.getElementById('cmpVolumeOut').textContent = fmtInt.format(vol);
    document.querySelectorAll('[data-mode-label]').forEach(function (el) { el.textContent = modeSel.value === 'verify' ? 'Twilio Verify (SMS + $0.05 fee)' : 'Twilio SMS'; });
  }

  Promise.all([
    P.getPrices(),
    fetch('/data/twilio-sms.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (res) {
    var sf = res[0], tw = res[1], twBy = {};
    if (tw && tw.prices) tw.prices.forEach(function (t) { twBy[t.country] = t; });
    rows = sf.map(function (r) { return { country: r.country, name: r.name, price: r.price, sf: parseFloat(r.price), tw: twBy[r.country] ? parseFloat(twBy[r.country].min) : null }; });
    var when = function (iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown'; };
    stampEl.textContent = 'SecondFactor prices from ' + when(P.fetchedAt()) + '. Twilio prices from Twilio’s published SMS price list, ' + when(tw && tw.fetched_at) + ', lowest carrier rate per country.';
    if (!sf.length) { table.innerHTML = '<tr><td colspan="5">Price list unavailable right now. <a href="/support/">Contact us</a> for a quote.</td></tr>'; return; }
    [search, sortSel, modeSel, volEl].forEach(function (el) { el.addEventListener('input', render); });
    render();
  });
})();
