/* SecondFactor.ai — /compare/<provider>/ landing pages: SecondFactor's price per OTP sent versus
   one competitor's published price, country by country.
   The page names its provider on <main data-competitor="plivo">. Competitor prices come from
   /data/competitors/<slug>.json (written by scripts/competitors/fetch_<slug>.py from the provider's
   public price list); SecondFactor prices from window.SFPricing (data/pricing.json).
   If the competitor file has a verify_fee, a "Compare against" switch shows SMS-only or SMS + fee. */
(function () {
  'use strict';
  var P = window.SFPricing, main = document.querySelector('main[data-competitor]'), table = document.getElementById('cmpTable');
  if (!P || !main || !table) return;
  var slug = main.getAttribute('data-competitor');
  var fmtInt = new Intl.NumberFormat('en-US');
  var search = document.getElementById('cmpSearch'), sortSel = document.getElementById('cmpSort'), modeSel = document.getElementById('cmpMode');
  var countEl = document.getElementById('cmpCount'), stampEl = document.getElementById('cmpStamp'), volEl = document.getElementById('cmpVolume');
  var rows = [], comp = null;

  function up4(n) { return P.roundUp4(n.toFixed(6)); }
  function usd4(s) { return '$' + s; }
  function usdInt(n) { return '$' + fmtInt.format(Math.round(n)); }
  function fee() { return comp && comp.verify_fee && modeSel && modeSel.value === 'verify' ? comp.verify_fee : 0; }
  function theirLabel() {
    if (!comp) return '';
    return comp.verify_fee && modeSel && modeSel.value === 'verify' ? comp.verify_label || (comp.provider + ' (SMS + $' + comp.verify_fee + ' fee)') : comp.sms_label || comp.provider;
  }

  function render() {
    var q = search.value.trim().toLowerCase(), vol = parseInt(volEl.value, 10) || 0, f = fee();
    var list = rows.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) >= 0 || r.country.toLowerCase() === q; });
    var key = sortSel.value;
    var diffOf = function (r) { return r.their == null ? -Infinity : r.their + f - r.sf; };
    list.sort(function (a, b) {
      if (key === 'name') return a.name.localeCompare(b.name);
      return key === 'saving' ? diffOf(b) - diffOf(a) : diffOf(a) - diffOf(b);
    });
    table.innerHTML = '';
    var cheaper = 0, compared = 0;
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      var their = r.their == null ? null : r.their + f;
      var diff = their == null ? null : their - r.sf, pct = their ? diff / their * 100 : null;
      if (diff != null) { compared++; if (diff > 0) cheaper++; }
      var cls = diff != null && diff >= 0 ? 'cmp-pos' : 'cmp-neg', sign = diff != null && diff < 0 ? '&minus;' : '';
      var cells = [
        r.name + ' <span class="cmp-code">' + r.country + '</span>',
        their == null ? '<span class="cmp-muted">Not published</span>' : usd4(up4(their)),
        usd4(P.roundUp4(r.price)),
        diff == null ? '<span class="cmp-muted">&mdash;</span>' : '<span class="' + cls + '">' + sign + usd4(up4(Math.abs(diff))) + ' <small>(' + Math.abs(pct).toFixed(0) + '% ' + (diff >= 0 ? 'less' : 'more') + ')</small></span>',
        diff == null ? '<span class="cmp-muted">&mdash;</span>' : '<span class="' + cls + '">' + sign + usdInt(Math.abs(diff) * vol) + '</span>'
      ];
      cells.forEach(function (c, i) { var td = document.createElement('td'); td.innerHTML = c; if (i) td.className = 'num'; tr.appendChild(td); });
      table.appendChild(tr);
    });
    countEl.textContent = list.length + ' of ' + rows.length + ' countries' + (q ? '' : ' · SecondFactor is cheaper in ' + cheaper + ' of the ' + compared + ' where ' + comp.provider + ' publishes a price');
    document.getElementById('cmpVolumeOut').textContent = fmtInt.format(vol);
    document.querySelectorAll('[data-mode-label]').forEach(function (el) { el.textContent = theirLabel(); });
  }

  Promise.all([
    P.getPrices(),
    fetch('/data/competitors/' + slug + '.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (res) {
    var sf = res[0], by = {};
    comp = res[1];
    if (!comp) { table.innerHTML = '<tr><td colspan="5">Comparison data unavailable right now.</td></tr>'; return; }
    comp.prices.forEach(function (t) { by[t.country] = t; });
    rows = sf.map(function (r) { return { country: r.country, name: r.name, price: r.price, sf: parseFloat(r.price), their: by[r.country] ? parseFloat(by[r.country].price) : null }; });
    if (modeSel && !comp.verify_fee) { var f = modeSel.closest('.pr-field'); if (f) f.hidden = true; }
    var when = function (iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown'; };
    stampEl.innerHTML = '';
    stampEl.appendChild(document.createTextNode('SecondFactor prices from ' + when(P.fetchedAt()) + '. ' + comp.provider + ' prices from its published price list (' + when(comp.fetched_at) + '): ' + comp.basis + ' Source: '));
    var a = document.createElement('a'); a.href = comp.source_page; a.target = '_blank'; a.rel = 'noopener nofollow'; a.textContent = comp.source_page.replace(/^https?:\/\//, '');
    stampEl.appendChild(a); stampEl.appendChild(document.createTextNode('.'));
    if (!sf.length) { table.innerHTML = '<tr><td colspan="5">Price list unavailable right now. <a href="/support/">Contact us</a> for a quote.</td></tr>'; return; }
    [search, sortSel, modeSel, volEl].forEach(function (el) { if (el) el.addEventListener('input', render); });
    render();
  });
})();
