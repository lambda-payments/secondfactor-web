/* SecondFactor.ai — colour theme.
   Loaded in <head> on every page, before the stylesheets paint, so the chosen theme is on
   <html data-theme="light|dark"> from the first frame (no flash). css/dark.css styles the
   dark theme. The choice is saved in localStorage ("sf-theme"); with no saved choice the OS
   preference is followed and tracked live. A sun/moon toggle is injected into the header. */
(function () {
  var KEY = 'sf-theme', root = document.documentElement, mq = window.matchMedia('(prefers-color-scheme: dark)');
  var LOGO = {light: '/assets/logo/secondFactor-full.png', dark: '/assets/logo/secondfactor-full-white.png'};

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { return saved() || (mq.matches ? 'dark' : 'light'); }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { if (!meta.dataset.light) meta.dataset.light = meta.content; meta.content = theme === 'dark' ? '#0b1020' : meta.dataset.light; }
    Array.prototype.forEach.call(document.querySelectorAll('img.brand-logo'), function (img) { img.src = LOGO[theme]; });
    Array.prototype.forEach.call(document.querySelectorAll('.theme-t'), function (b) {
      var toDark = theme !== 'dark';
      b.setAttribute('aria-label', toDark ? 'Switch to dark mode' : 'Switch to light mode');
      b.setAttribute('title', toDark ? 'Dark mode' : 'Light mode');
    });
  }

  apply(current());
  mq.addEventListener && mq.addEventListener('change', function () { if (!saved()) apply(current()); });

  function toggle() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply(next);
  }

  function mount() {
    var hd = document.querySelector('header .hd, header .nav');
    if (!hd || hd.querySelector('.theme-t')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'theme-t';
    b.innerHTML =
      '<svg class="theme-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>' +
      '<svg class="theme-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
    b.addEventListener('click', toggle);
    var before = hd.querySelector('.signin') || hd.querySelector('.hdcta') || hd.querySelector('.burger');
    before ? hd.insertBefore(b, before) : hd.appendChild(b);
    apply(current());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
