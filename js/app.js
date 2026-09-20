/* SecondFactor.ai — site behaviour: hero console, scroll reveal, pricing selector, form note. */
(function () {
  'use strict';
  var money = function (n) { return '$' + n.toFixed(4); };

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
      document.querySelectorAll('section .crd, section .sfd, section h2, section details, section .field')
    );
    if (!nodes.length) return;
    var n = 0;
    nodes.forEach(function (el) {
      el.classList.add('rv');
      el.style.transitionDelay = ((n++ % 5) * 70) + 'ms';
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

  /* ---------- support form ---------- */
  var form = document.getElementById('supportForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.getElementById('formNote');
      if (note) note.hidden = false;
    });
  }

  /* ---------- pricing ---------- */
  var priceRoot = document.getElementById('routedPrice');
  if (priceRoot && window.SF) {
    var RATES = window.SF.RATES, META = window.SF.CHANNEL_META;
    var state = {
      mode: 'pie',
      channel: 'whatsapp',
      country: 'United States',
      connected: {sms: true, whatsapp: false, viber: false, rcs: false}
    };
    var COPY = {
      pie: {
        title: 'Routed pricing',
        blurb: 'One rate per country, covering delivery and verification. Routing is handled for you.'
      },
      fine: {
        title: 'Per-channel pricing',
        blurb: 'Available on request for accounts that need more control over delivery.'
      }
    };
    var selCountry = document.getElementById('country');
    var selChan = document.getElementById('chan');
    var pieBlock = document.getElementById('pieBlock');
    var fineBlock = document.getElementById('fineBlock');
    var connEl = document.getElementById('connToggles');
    var titleEl = document.getElementById('modeTitle');
    var blurbEl = document.getElementById('modeBlurb');
    var cLabel = document.getElementById('cLabel');

    function render() {
      var row = RATES[state.country];
      titleEl.textContent = COPY[state.mode].title;
      blurbEl.textContent = COPY[state.mode].blurb;
      if (cLabel) { cLabel.textContent = state.country; }
      pieBlock.hidden = state.mode !== 'pie';
      fineBlock.hidden = state.mode !== 'fine';
      var ratesBlock = document.getElementById('ratesBlock');
      var countryField = document.getElementById('countryField');
      if (ratesBlock) { ratesBlock.hidden = state.mode !== 'pie'; }
      if (countryField) { countryField.style.display = state.mode === 'pie' ? '' : 'none'; }

      Array.prototype.forEach.call(document.querySelectorAll('.mode-t'), function (b) {
        var on = b.getAttribute('data-mode') === state.mode;
        b.classList.toggle('on', on);
      });

      /* single routed price for the country */
      var priceEl = document.getElementById('routedPrice');
      if (priceEl) {
        var vals = META.map(function (m) { return row[m.key]; }).filter(function (v) { return v != null; });
        priceEl.textContent = vals.length ? money(Math.min.apply(null, vals)) : 'On request';
      }
    }

    Array.prototype.forEach.call(document.querySelectorAll('.mode-t'), function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); render(); });
    });
    selCountry.addEventListener('change', function () { state.country = selCountry.value; render(); });
    if (selChan) selChan.addEventListener('change', function () { state.channel = selChan.value; render(); });
    render();
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
