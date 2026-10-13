/* SecondFactor.ai — /tools/savings-calculator/: cost per OTP versus Twilio Verify.
   Prices come from window.SFPricing (js/pricing-client.js). Inputs: #svCountry (select, ISO codes),
   #svVolume (range), #svTwilio and #svSf (cost per completion, USD). The SecondFactor field follows
   the selected country's published price (rounded up to four decimals) until the user edits it; the
   Twilio default is the published Verify fee plus the US SMS channel charge. The query string
   (?country=NP&volume=250000) preselects values. */
(function () {
  'use strict';
  var P = window.SFPricing;
  var country = document.getElementById('svCountry');
  if (!country || !P) return;

  var volume = document.getElementById('svVolume'), tw = document.getElementById('svTwilio'), sf = document.getElementById('svSf');
  var fmtInt = new Intl.NumberFormat('en-US');
  var usd = function (n) { return '$' + fmtInt.format(Math.round(n)); };
  var signed = function (n) { return (n < 0 ? '−' : '') + usd(Math.abs(n)); };
  var num = function (el) { var v = parseFloat(el.value); return isFinite(v) && v >= 0 ? v : 0; };
  var sfTouched = false;

  var byCode = {};
  function rateFor(code) { var row = byCode[code]; return row ? P.roundUp4(row.price) : null; }

  function fill(list) {
    list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (row) {
      byCode[row.country] = row;
      var o = document.createElement('option'); o.value = row.country; o.textContent = row.name; country.appendChild(o);
    });
    var q = new URLSearchParams(location.search);
    var want = (q.get('country') || '').toUpperCase();
    country.value = byCode[want] ? want : (byCode.US ? 'US' : (list[0] ? list[0].country : ''));
    if (q.get('volume') && +q.get('volume') >= +volume.min && +q.get('volume') <= +volume.max) volume.value = Math.round(+q.get('volume') / volume.step) * volume.step;
  }

  function countryName() { return byCode[country.value] ? byCode[country.value].name : country.value; }
  function syncRate() {
    var r = rateFor(country.value);
    document.getElementById('svCountryName').textContent = countryName();
    if (sfTouched) return;
    if (r != null) { sf.value = r; sf.placeholder = ''; }
    else { sf.value = ''; sf.placeholder = 'Contact us'; }
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
    document.getElementById('svResultCountry').textContent = countryName();

    var url = new URL(location.href);
    url.searchParams.set('country', country.value); url.searchParams.set('volume', vol);
    history.replaceState(null, '', url);
  }

  country.addEventListener('change', function () { sfTouched = false; syncRate(); render(); });
  [volume, tw, sf].forEach(function (el) { el.addEventListener('input', render); });
  sf.addEventListener('input', function () { sfTouched = true; });
  P.getPrices().then(function (list) { fill(list); syncRate(); render(); });
})();
