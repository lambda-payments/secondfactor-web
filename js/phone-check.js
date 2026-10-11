/* Phone type and number validation UI. Lookups go through window.SFLookup (js/sf-lookup.js),
   the browser adapter for the SecondFactor Lookup API. Nothing is stored. */
(function () {
  'use strict';

  // Per-tool copy, plus the result shown before the first lookup (the first example's real answer).
  var CONFIG = {
    'phone-type-check': {
      title: 'Phone type check', details: 'PHONE TYPE DETAILS', loading: 'Checking phone type…',
      loadingText: 'Looking up the number’s line type.', action: 'Check phone type',
      unavailable: 'Phone type unavailable', unavailableText: 'We couldn’t retrieve the phone type for this number. Please try again later.',
      initial: { value: 'Mobile', number: '+977 984-1234567', country: 'Nepal', carrier: 'Nepal Telecom', callingCode: '+977' },
      lookup: function (n) { return window.SFLookup.phoneType(n); }
    },
    'phone-number-validation': {
      title: 'Phone number validation', details: 'VALIDATION RESULT', loading: 'Validating number…',
      loadingText: 'Checking the number’s format and numbering rules.', action: 'Validate number',
      unavailable: 'Validation unavailable', unavailableText: 'We couldn’t validate this number. Please try again later. This does not mean the number is invalid.',
      initial: { value: 'Valid format', valid: true, number: '+977 984-1234567', country: 'Nepal', international: '+9779841234567', reason: 'Matches the numbering plan' },
      lookup: function (n) { return window.SFLookup.validate(n); }
    }
  };

  var form = document.getElementById('phone-check-form');
  if (!form) return;
  var config = CONFIG[form.dataset.tool];
  if (!config) return;
  var input = document.getElementById('phone-number');
  var submit = document.getElementById('check-number');
  var error = document.getElementById('phone-error');
  var result = document.getElementById('phone-result');
  var data = document.getElementById('result-data');
  var message = document.getElementById('result-message');
  var label = document.getElementById('result-label');
  var status = document.getElementById('lookup-status');
  var copy = document.getElementById('copy-result');
  var copyMarkup = copy.innerHTML;
  var submitMarkup = submit.innerHTML;
  var selected = config.initial;
  var requestId = 0;
  var copyTimer;

  async function lookupPhone(number) {
    if (!window.SFLookup) throw new Error('adapter missing');
    return config.lookup(number);
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
    result.removeAttribute('data-validity');
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
    label.textContent = config.details;
    document.getElementById('result-value').textContent = sample.value;
    document.querySelectorAll('[data-result-field]').forEach(function (field) {
      field.textContent = sample[field.dataset.resultField] || 'Unavailable';
    });
    if (typeof sample.valid === 'boolean' && (sample.invalid || form.dataset.tool === 'phone-number-validation')) {
      result.setAttribute('data-validity', sample.valid ? 'valid' : 'invalid');
    } else {
      result.removeAttribute('data-validity');
    }
    status.textContent = config.title + ' for ' + sample.number + ': ' + sample.value + '. ' +
      (sample.reason || sample.country) + '. ' + document.getElementById('result-note').textContent;
  }

  function stopLoading() {
    result.setAttribute('aria-busy', 'false');
    submit.disabled = false;
    submit.innerHTML = submitMarkup;
  }

  async function checkPhone() {
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
      label.textContent = config.details;
      showMessage('Check the number format', 'Include the country code, such as +1.');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Checking…';
    label.textContent = 'CHECKING NUMBER';
    showMessage(config.loading, config.loadingText);
    result.setAttribute('aria-busy', 'true');
    try {
      var sample = await lookupPhone(normalized);
      if (id !== requestId) return;
      if (sample) {
        render(sample);
      } else {
        label.textContent = config.details;
        showMessage(config.unavailable, config.unavailableText);
      }
    } catch (err) {
      if (id !== requestId) return;
      label.textContent = 'LOOKUP UNAVAILABLE';
      showMessage('We couldn’t complete the lookup', err && err.status === 429 ? 'Too many lookups right now. Please try again in a minute.' : 'Please try again in a moment.');
    } finally {
      if (id === requestId) stopLoading();
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    checkPhone();
  });

  input.addEventListener('input', function () {
    // Invalidate pending work so an earlier submission cannot overwrite a new edit.
    ++requestId;
    stopLoading();
    clearError();
    resetCopy();
    label.textContent = 'READY TO CHECK';
    showMessage('Check a number', 'Select ' + config.action + ' to check the number.');
  });

  document.querySelectorAll('[data-sample]').forEach(function (button) {
    button.addEventListener('click', function () {
      input.value = button.getAttribute('data-sample');
      checkPhone();
    });
  });

  copy.addEventListener('click', async function () {
    if (!selected) return;
    var sample = selected;
    var id = requestId;
    var lines = ['SecondFactor ' + config.title.toLowerCase(), 'Result: ' + sample.value];
    document.querySelectorAll('[data-result-field]').forEach(function (field) {
      lines.push(field.previousElementSibling.textContent + ': ' + (sample[field.dataset.resultField] || 'Unavailable'));
    });
    lines.push(document.getElementById('result-note').textContent);
    var text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      if (id !== requestId) return;
      copy.textContent = 'Copied';
      status.textContent = 'Result copied to clipboard.';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(resetCopy, 2000);
    } catch (err) {
      if (id !== requestId) return;
      status.textContent = 'Copy isn’t available in this browser. You can select and copy the result text instead.';
      copy.textContent = 'Select text to copy';
    }
  });
})();
