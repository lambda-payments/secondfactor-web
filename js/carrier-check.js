/* Carrier checker UI with local fixtures. No network requests or persistence.
   Replace lookupCarrier with the backend adapter described in tools/README.md. */
(function () {
  'use strict';

  // Fictional number-to-carrier pairings. Never infer a carrier from a prefix.
  var SAMPLES = {
    '+14155550123': { number: '+1 415 555 0123', carrier: 'AT&T', country: 'United States', countryCode: 'US', callingCode: '+1' },
    '+447700900123': { number: '+44 7700 900123', carrier: 'Vodafone', country: 'United Kingdom', countryCode: 'GB', callingCode: '+44' },
    '+16045550123': { number: '+1 604 555 0123', carrier: 'TELUS', country: 'Canada', countryCode: 'CA', callingCode: '+1' }
  };

  var form = document.getElementById('carrier-form');
  if (!form) return;
  var input = document.getElementById('phone-number');
  var submit = document.getElementById('check-carrier');
  var error = document.getElementById('phone-error');
  var result = document.getElementById('carrier-result');
  var data = document.getElementById('result-data');
  var message = document.getElementById('result-message');
  var label = document.getElementById('result-label');
  var status = document.getElementById('lookup-status');
  var copy = document.getElementById('copy-result');
  var copyMarkup = copy.innerHTML;
  var submitMarkup = submit.innerHTML;
  var selected = SAMPLES['+14155550123'];
  var requestId = 0;
  var copyTimer;

  // Temporary delay to exercise the loading state before backend integration.
  async function lookupCarrier(number) {
    await new Promise(function (resolve) { setTimeout(resolve, 600); });
    return SAMPLES[number] || null;
  }

  function clearError() {
    error.hidden = true;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
  }

  function resetCopy() {
    clearTimeout(copyTimer);
    copy.innerHTML = copyMarkup;
  }

  function showMessage(title, text) {
    selected = null;
    data.hidden = true;
    message.hidden = false;
    document.getElementById('result-message-title').textContent = title;
    document.getElementById('result-message-text').textContent = text;
    status.textContent = title + '. ' + text;
  }

  function render(sample) {
    selected = sample;
    data.hidden = false;
    message.hidden = true;
    label.textContent = 'CARRIER DETAILS';
    document.getElementById('result-carrier').textContent = sample.carrier;
    document.getElementById('result-number').textContent = sample.number;
    document.getElementById('result-country').textContent = sample.country;
    document.getElementById('result-code').textContent = sample.countryCode;
    document.getElementById('result-dial').textContent = sample.callingCode;
    status.textContent = 'Carrier details for ' + sample.number + ': ' + sample.carrier + ', ' + sample.country + '.';
  }

  function stopLoading() {
    result.setAttribute('aria-busy', 'false');
    submit.disabled = false;
    submit.innerHTML = submitMarkup;
  }

  async function checkCarrier() {
    var id = ++requestId;
    clearError();
    resetCopy();
    stopLoading();
    var raw = input.value.trim();
    var normalized = raw.replace(/[\s().-]/g, '');
    // Basic input sanity check only, not phone number validity verification.
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      error.textContent = !raw ? 'Enter a phone number, including the country code.' : 'Use + followed by 7–15 digits, including the country code. Spaces, parentheses, dots, and hyphens are allowed.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      label.textContent = 'CARRIER DETAILS';
      showMessage('Check the number format', 'Include the country code, such as +1.');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Checking…';
    label.textContent = 'CHECKING CARRIER';
    showMessage('Checking carrier…', 'Looking up carrier information.');
    result.setAttribute('aria-busy', 'true');
    try {
      var sample = await lookupCarrier(normalized);
      if (id !== requestId) return;
      if (sample) {
        render(sample);
      } else {
        label.textContent = 'CARRIER DETAILS';
        showMessage('Carrier information unavailable', 'We couldn’t retrieve carrier information for this number. Please try again later.');
      }
    } catch (err) {
      if (id !== requestId) return;
      label.textContent = 'LOOKUP UNAVAILABLE';
      showMessage('We couldn’t complete the lookup', 'Please try again in a moment.');
    } finally {
      if (id === requestId) stopLoading();
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    checkCarrier();
  });

  input.addEventListener('input', function () {
    // Invalidate pending work so an earlier submission cannot overwrite a new edit.
    ++requestId;
    stopLoading();
    clearError();
    resetCopy();
    label.textContent = 'READY TO CHECK';
    showMessage('Check a number', 'Select Check carrier to look up the number.');
  });

  document.querySelectorAll('[data-sample]').forEach(function (button) {
    button.addEventListener('click', function () {
      input.value = button.getAttribute('data-sample');
      checkCarrier();
    });
  });

  copy.addEventListener('click', async function () {
    if (!selected) return;
    var sample = selected;
    var id = requestId;
    var text = 'SecondFactor carrier check\n' +
      'Phone number: ' + sample.number + '\nCarrier: ' + sample.carrier + '\nCountry: ' + sample.country +
      '\nCountry code: ' + sample.countryCode + '\nCalling code: ' + sample.callingCode;
    try {
      await navigator.clipboard.writeText(text);
      if (id !== requestId) return;
      copy.textContent = 'Copied';
      status.textContent = 'Carrier details copied to clipboard.';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopy, 2000);
    } catch (err) {
      if (id !== requestId) return;
      status.textContent = 'Copy isn’t available in this browser. You can select and copy the result text instead.';
      copy.textContent = 'Select text to copy';
    }
  });
})();
