/* SecondFactor.ai — /tools/savings-calculator/: cost per completed verification versus Twilio Verify.
   Needs js/data.js (window.SF.RATES, CHANNEL_META). Inputs: #svCountry (select), #svVolume (range),
   #svTwilio and #svSf (cost per completion, USD). The SecondFactor field follows the selected
   country's routed rate (lowest available channel rate) until the user edits it; the Twilio default
   is the published Verify fee plus the US SMS channel charge. The query string (?country=India&volume=250000) preselects values. */
(function () {
  'use strict';
  var SF = window.SF;
  var country = document.getElementById('svCountry');
  if (!country || !SF) return;

  var volume = document.getElementById('svVolume'), tw = document.getElementById('svTwilio'), sf = document.getElementById('svSf');
  var fmtInt = new Intl.NumberFormat('en-US');
  var usd = function (n) { return '$' + fmtInt.format(Math.round(n)); };
  var signed = function (n) { return (n < 0 ? '−' : '') + usd(Math.abs(n)); };
  var num = function (el) { var v = parseFloat(el.value); return isFinite(v) && v >= 0 ? v : 0; };
  var sfTouched = false;

  /* one routed rate per country: the lowest available channel rate */
  function routedRate(name) {
    var row = SF.RATES[name];
    if (!row) return null;
    var vals = SF.CHANNEL_META.map(function (m) { return row[m.key]; }).filter(function (v) { return v != null; });
    return vals.length ? Math.min.apply(null, vals) : null;
  }

  var names = Object.keys(SF.RATES).sort();
  names.forEach(function (n) {
    var o = document.createElement('option');
    o.value = n; o.textContent = n + ' (' + SF.RATES[n].dial + ')';
    country.appendChild(o);
  });

  var q = new URLSearchParams(location.search);
  if (q.get('country') && SF.RATES[q.get('country')]) country.value = q.get('country'); else country.value = 'United States';
  if (q.get('volume') && +q.get('volume') >= +volume.min && +q.get('volume') <= +volume.max) volume.value = Math.round(+q.get('volume') / volume.step) * volume.step;

  function syncRate() {
    var r = routedRate(country.value);
    document.getElementById('svCountryName').textContent = country.value;
    if (sfTouched) return;
    if (r != null) { sf.value = r.toFixed(4); sf.placeholder = ''; }
    else { sf.value = ''; sf.placeholder = 'On request'; }
  }

  function render() {
    var vol = parseInt(volume.value, 10) || 0, t = num(tw), s = num(sf);
    var saving = (t - s) * vol, pct = t > 0 ? (t - s) / t * 100 : 0;
    document.getElementById('svVolumeOut').textContent = fmtInt.format(vol);
    volume.style.setProperty('--sv-fill', ((vol - volume.min) / (volume.max - volume.min) * 100) + '%');
    document.getElementById('svSavings').textContent = signed(saving);
    var pctEl = document.getElementById('svPct');
    pctEl.textContent = Math.abs(pct).toFixed(1) + '% ' + (pct >= 0 ? 'lower' : 'higher');
    pctEl.classList.toggle('is-neg', pct < 0);
    document.getElementById('svTwilioTotal').textContent = usd(t * vol);
    document.getElementById('svSfTotal').textContent = usd(s * vol);
    document.getElementById('svYear').textContent = signed(saving * 12);
    document.getElementById('svResultCountry').textContent = country.value;

    var url = new URL(location.href);
    url.searchParams.set('country', country.value); url.searchParams.set('volume', vol);
    history.replaceState(null, '', url);
  }

  country.addEventListener('change', function () { sfTouched = false; syncRate(); render(); });
  [volume, tw, sf].forEach(function (el) { el.addEventListener('input', render); });
  sf.addEventListener('input', function () { sfTouched = true; });
  syncRate();
  render();
})();
