/* SecondFactor.ai — site behaviour: hero console, scroll reveal, pricing selector, form note. */
(function () {
  'use strict';

  /* ---------- sticky header shadow ---------- */
  var hdr = document.querySelector('header');
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, {passive: true});
    onScroll();
  }

  /* ---------- scroll reveal (rect-based, works in any scroll container) ---------- */
  (function () {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('section .crd, section .sfd, section h2, section details, section .field, section .logos-row li')
    );
    if (!nodes.length) return;
    var n = 0;
    nodes.forEach(function (el) {
      el.classList.add('rv');
      if (!el.style.transitionDelay) el.style.transitionDelay = ((n++ % 5) * 70) + 'ms';
    });
    var pending = nodes.slice();
    function show(el) { el.classList.add('in'); }
    function check() {
      var h = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < h * 0.94 && r.bottom > 0) { show(el); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', onEvt, true);
        window.removeEventListener('resize', onEvt);
      }
    }
    var queued = false;
    function onEvt() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; check(); });
    }
    window.addEventListener('scroll', onEvt, true);
    window.addEventListener('resize', onEvt);
    document.addEventListener('scroll', onEvt, true);
    check();
    setTimeout(check, 400);
    /* failsafe: never leave content hidden */
    setTimeout(function () { pending.forEach(show); }, 4000);
  })();

  /* ---------- hero live console + OTP boxes ---------- */
  var LIVE = [
    {number: '+62 812 5540 118', route: 'WhatsApp \u00b7 $0.0163', status: 'Delivered 1.6s'},
    {number: '+977 98 4512 7730', route: 'Viber \u00b7 $0.0098', status: 'Delivered 2.1s'},
    {number: '+1 415 555 2671', route: 'WhatsApp \u00b7 $0.0042', status: 'Delivered 1.4s'},
    {number: '+91 98730 55121', route: 'RCS \u00b7 $0.0009', status: 'Delivered 1.8s'}
  ];
  var CODE = ['7', '2', '9', '4', '1', '5'];
  var elNum = document.getElementById('liveNumber');
  var boxes = document.querySelectorAll('.otpb');
  if (elNum || boxes.length) {
    var elRoute = document.getElementById('liveRoute');
    var elStat = document.getElementById('liveStatus');
    var i = 0, step = 0;
    setInterval(function () {
      step = (step + 1) % 9;
      if (step === 0) {
        i = (i + 1) % LIVE.length;
        if (elNum) elNum.textContent = LIVE[i].number;
        if (elRoute) elRoute.innerHTML = LIVE[i].route;
        if (elStat) elStat.textContent = LIVE[i].status;
      }
      Array.prototype.forEach.call(boxes, function (b) {
        var idx = +b.getAttribute('data-i');
        var show = step >= idx + 3;
        b.textContent = show ? CODE[idx] : '\u00b7';
        b.style.color = show ? 'var(--ac)' : 'var(--mut2)';
      });
    }, 1300);
  }

  /* ---------- copy install command ---------- */
  var copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = 'npm i @secondfactor/otp';
      if (navigator.clipboard) { navigator.clipboard.writeText(text); }
      copyBtn.textContent = 'copied';
      setTimeout(function () { copyBtn.textContent = 'copy'; }, 1600);
    });
  }

  /* ---------- support form ----------
     POST https://api.secondfactor.ai/api/support/tickets (the form's data-endpoint), JSON, no auth,
     no cookies. Body: name, email, company ("" when empty), topic (integration | channel_setup |
     pricing | billing | other), message, website (honeypot, always sent, empty for humans).
     201 {"id":"SUP…"} = created; 400 = field errors keyed by field (+ non_field_errors);
     429 = throttled (5/hour per IP, 3/hour per email). Anything else falls back to email. */
  var form = document.getElementById('supportForm');
  if (form && window.fetch) {
    var FIELDS = { name: 'sn', email: 'se', company: 'sc', topic: 'st', message: 'sm' };
    var LIMITS = { name: 120, email: 254, company: 120, message: 5000 };
    var note = document.getElementById('formNote'), btn = document.getElementById('supportSubmit');
    var btnLabel = btn ? btn.textContent : 'Send message';
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };

    function fieldError(key, msg) {
      var input = document.getElementById(FIELDS[key]), err = document.getElementById(FIELDS[key] + '-err');
      if (!input || !err) return false;
      err.textContent = msg; err.hidden = !msg;
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      return !!msg;
    }
    function clearErrors() { Object.keys(FIELDS).forEach(function (k) { fieldError(k, ''); }); }
    function showNote(kind, html) { note.className = 'sf-fnote sf-fnote-' + kind; note.innerHTML = html; note.hidden = false; }
    function mailtoFallback(lead) {
      var body = encodeURIComponent('Name: ' + val('sn') + '\nCompany: ' + val('sc') + '\n\n' + val('sm'));
      showNote('err', lead + ' Please email us at <a href="mailto:support@secondfactor.ai?subject=' +
        encodeURIComponent('Website enquiry') + '&body=' + body + '">support@secondfactor.ai</a> instead. Your message is still in the form.');
    }
    function validate(data) {
      var bad = false;
      if (!data.name) bad = fieldError('name', 'Enter your name.') || bad;
      if (!data.email) bad = fieldError('email', 'Enter your work email.') || bad;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) bad = fieldError('email', 'Enter a valid email address.') || bad;
      if (!data.message) bad = fieldError('message', 'Tell us how we can help.') || bad;
      Object.keys(LIMITS).forEach(function (k) { if (data[k].length > LIMITS[k]) bad = fieldError(k, 'Keep this under ' + LIMITS[k] + ' characters.') || bad; });
      return !bad;
    }
    function setBusy(busy) {
      if (!btn) return;
      btn.disabled = busy; btn.textContent = busy ? 'Sending\u2026' : btnLabel;
      form.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn && btn.disabled) return;
      clearErrors(); note.hidden = true;
      var data = { name: val('sn'), email: val('se'), company: val('sc'), topic: val('st') || 'other', message: val('sm'), website: val('sw') };
      if (!validate(data)) {
        var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus();
        return;
      }
      setBusy(true);
      fetch(form.getAttribute('data-endpoint'), {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { status: res.status, body: body }; });
      }).then(function (r) {
        setBusy(false);
        if (r.status === 201) {
          var ref = r.body && r.body.id ? String(r.body.id) : '';
          form.reset();
          showNote('ok', '<strong>Thanks, your message is on its way.</strong> We\u2019ll reply from support@secondfactor.ai.' +
            (ref ? ' Your reference is <strong class="sf-fref"></strong>.' : ''));
          if (ref) note.querySelector('.sf-fref').textContent = ref;
          note.focus && note.setAttribute('tabindex', '-1'); note.focus && note.focus();
          return;
        }
        if (r.status === 400 && r.body && typeof r.body === 'object') {
          var placed = false, general = [];
          Object.keys(r.body).forEach(function (k) {
            var msgs = [].concat(r.body[k]).join(' ');
            if (FIELDS[k]) placed = fieldError(k, msgs) || placed; else general.push(msgs);
          });
          if (general.length || !placed) showNote('err', '');
          if (general.length || !placed) note.textContent = general.join(' ') || 'Please check the form and try again.';
          var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus();
          return;
        }
        if (r.status === 429) {
          var m = /(\d+)\s*seconds/.exec((r.body && r.body.detail) || ''), mins = m ? Math.max(1, Math.ceil(+m[1] / 60)) : null;
          mailtoFallback('We\u2019ve received several messages from you recently' + (mins ? ', so the form is paused for about ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' : '.'));
          return;
        }
        mailtoFallback('We couldn\u2019t send your message just now.');
      }).catch(function () {
        setBusy(false);
        mailtoFallback('We couldn\u2019t reach our servers.');
      });
    });
  }

  /* ---------- pricing ---------- */
  /* Every price on the site comes from window.SFPricing (js/pricing-client.js), which reads
     data/pricing.json; the API is only called server-side. Prices are shown rounded UP to
     four decimals; countries without a price of their own show "Contact us". */
  var P = window.SFPricing;
  function priceInto(el, row) {
    if (row) { el.textContent = P.display(row); el.removeAttribute('data-no-price'); return; }
    el.textContent = '';
    var a = document.createElement('a'); a.href = P.CONTACT_URL; a.textContent = 'Contact us'; a.style.font = 'inherit';
    el.appendChild(a); el.setAttribute('data-no-price', '');
  }
  /* country pages: <span data-price-country="NP"> */
  if (P && document.querySelector('[data-price-country]')) {
    P.getPrices().then(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-price-country]'), function (el) {
        P.getPrice(el.getAttribute('data-price-country')).then(function (row) { priceInto(el, row); });
      });
    });
  }

  var priceRoot = document.getElementById('routedPrice');
  if (priceRoot && P) {
    var state = { mode: 'pie', country: 'US' };
    var COPY = {
      pie: { title: 'Routed pricing', blurb: 'One rate per country per OTP sent, whichever channel delivers it. Routing is handled for you.' },
      fine: { title: 'Per-channel pricing', blurb: 'Available on request for accounts that need more control over delivery.' }
    };
    var selCountry = document.getElementById('country');
    var pieBlock = document.getElementById('pieBlock');
    var fineBlock = document.getElementById('fineBlock');
    var titleEl = document.getElementById('modeTitle');
    var blurbEl = document.getElementById('modeBlurb');
    var cLabel = document.getElementById('cLabel');
    var byCode = {};

    function render() {
      var row = byCode[state.country] || null;
      titleEl.textContent = COPY[state.mode].title;
      blurbEl.textContent = COPY[state.mode].blurb;
      if (cLabel) { cLabel.textContent = row ? row.name : (selCountry.selectedOptions[0] ? selCountry.selectedOptions[0].textContent : state.country); }
      pieBlock.hidden = state.mode !== 'pie';
      fineBlock.hidden = state.mode !== 'fine';
      var countryField = document.getElementById('countryField');
      if (countryField) { countryField.style.display = state.mode === 'pie' ? '' : 'none'; }
      Array.prototype.forEach.call(document.querySelectorAll('.mode-t'), function (b) {
        var on = b.getAttribute('data-mode') === state.mode;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      priceInto(priceRoot, row);
      var stamp = document.getElementById('priceUpdated');
      if (stamp && P.fetchedAt()) { stamp.textContent = 'Price list updated ' + new Date(P.fetchedAt()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'; }
    }

    P.getPrices().then(function (list) {
      selCountry.innerHTML = '';
      list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (row) {
        byCode[row.country] = row;
        var o = document.createElement('option'); o.value = row.country; o.textContent = row.name; selCountry.appendChild(o);
      });
      if (!list.length) {
        var o = document.createElement('option'); o.value = ''; o.textContent = 'Price list unavailable'; selCountry.appendChild(o); selCountry.disabled = true;
      }
      var q = new URLSearchParams(location.search).get('country');
      state.country = q && byCode[q.toUpperCase()] ? q.toUpperCase() : (byCode.US ? 'US' : (list[0] ? list[0].country : ''));
      selCountry.value = state.country;
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.mode-t'), function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); render(); });
    });
    selCountry.addEventListener('change', function () { state.country = selCountry.value; render(); });
  }
  /* ---------- article table of contents: highlight the section being read ----------
     The current section is the last heading that has scrolled past the top of the viewport,
     so the highlight stays correct inside long sections, when scrolling back up, and after
     jumping to an anchor. */
  var tocLinks = document.querySelectorAll('.post-toc a[href^="#"]');
  if (tocLinks.length) {
    var tocHeads = [];
    Array.prototype.forEach.call(tocLinks, function (a) {
      var h = document.getElementById(a.getAttribute('href').slice(1));
      if (h) tocHeads.push({h: h, a: a});
    });
    var spy = function () {
      var cur = null;
      for (var k = 0; k < tocHeads.length; k++) {
        if (tocHeads[k].h.getBoundingClientRect().top <= 140) cur = tocHeads[k].a; else break;
      }
      Array.prototype.forEach.call(tocLinks, function (a) { a.classList.toggle('on', a === cur); });
    };
    /* cheap enough (one rect read per heading) to run directly on scroll */
    window.addEventListener('scroll', spy, {passive: true});
    window.addEventListener('resize', spy);
    spy();
  }

  /* article code samples: colour <figure class="post-code" data-lang="js|bash|json|env">.
     Patterns are built with new RegExp so a browser without lookbehind just shows plain text. */
  (function () {
    var blocks = document.querySelectorAll('.post-code[data-lang] pre code');
    if (!blocks.length) return;
    var R = String.raw, STR = R`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"`, rules;
    try {
      rules = {
        js: new RegExp([
          R`(?<c>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
          '(?<s>' + STR + R`|\x60(?:\\.|[^\x60\\])*\x60)`,
          R`(?<r>(?<=[(,=:!&|?]\s*)\/(?![\/*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\n])+\/[dgimsuy]*)`,
          R`(?<k>\b(?:const|let|var|function|return|if|else|try|catch|finally|async|await|new|delete|typeof|throw|for|while|of|in|class|import|from|export|default)\b)`,
          R`(?<l>\b(?:true|false|null|undefined)\b)`,
          R`(?<n>\b\d+(?:\.\d+)?\b)`,
          R`(?<f>\b[A-Za-z_$][\w$]*(?=\s*\())`
        ].join('|'), 'g'),
        bash: new RegExp([
          R`(?<c>(?:^|(?<=\s))#[^\n]*)`,
          '(?<s>' + STR + ')',
          R`(?<v>\$\{?\w+\}?)`,
          R`(?<o>(?<=\s)--?[A-Za-z][\w-]*)`,
          R`(?<f>^[ \t]*[a-z][\w.-]*)`
        ].join('|'), 'gm'),
        json: new RegExp([
          R`(?<p>"(?:\\.|[^"\\])*"(?=\s*:))`,
          R`(?<s>"(?:\\.|[^"\\])*")`,
          R`(?<l>\b(?:true|false|null)\b)`,
          R`(?<n>-?\b\d+(?:\.\d+)?\b)`
        ].join('|'), 'g'),
        env: new RegExp([
          R`(?<c>^#[^\n]*)`,
          R`(?<p>^[A-Za-z_][A-Za-z0-9_]*(?==))`,
          R`(?<s>(?<==)[^\n]+)`
        ].join('|'), 'gm')
      };
    } catch (err) { return; }
    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    Array.prototype.forEach.call(blocks, function (code) {
      var re = rules[code.closest('.post-code').getAttribute('data-lang')];
      if (!re) return;
      /* one block per source line, so a long line wraps under its own indentation */
      var src = code.textContent.replace(/\n$/, ''), lines = [''], last = 0, m, k;
      var put = function (text, cls) {
        text.split('\n').forEach(function (part, i) {
          if (i) lines.push('');
          if (part) lines[lines.length - 1] += cls ? '<span class="tk-' + cls + '">' + esc(part) + '</span>' : esc(part);
        });
      };
      re.lastIndex = 0;
      while ((m = re.exec(src))) {
        if (!m[0]) { re.lastIndex++; continue; }
        for (k in m.groups) if (m.groups[k] !== undefined) break;
        put(src.slice(last, m.index));
        put(m[0], k);
        last = m.index + m[0].length;
      }
      put(src.slice(last));
      code.innerHTML = src.split('\n').map(function (raw, i) {
        var n = raw.match(/^ */)[0].length, html = lines[i] || '';
        /* the indent keeps white-space:pre so the line cannot break right after it */
        if (n && html.slice(0, n) === raw.slice(0, n)) html = '<span class="ws">' + html.slice(0, n) + '</span>' + html.slice(n);
        return '<span class="ln" style="--i:' + n + '">' + html + '\n</span>';
      }).join('');
    });
  })();

  /* article code samples: copy button */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.post-code-copy') : null;
    if (!btn || !navigator.clipboard) return;
    var pre = btn.closest('.post-code').querySelector('pre');
    navigator.clipboard.writeText(pre.textContent).then(function () {
      btn.textContent = 'Copied'; btn.classList.add('done');
      setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1600);
    });
  });

  /* mobile drawer */
  var burger = document.querySelector('.burger'), navlinks = document.querySelector('.navlinks');
  if (burger && navlinks) {
    burger.addEventListener('click', function () {
      var open = navlinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navlinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { navlinks.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
    });
  }
})();
