/* CalOff site behaviour, shared by every page under /caloff/.
   Everything here is an enhancement: each page reads and works with it off. */
(function () {
  'use strict';

  // Old links from the App Store listing point at /caloff/#privacy and
  // /caloff/#terms, from when the legal pages lived inside the home page.
  var legacy = { '#privacy': 'privacy/', '#terms': 'terms/', '#support': 'support/' };
  if (/^\/caloff\/?$/.test(location.pathname) && legacy[location.hash]) {
    location.replace('/caloff/' + legacy[location.hash]);
    return;
  }

  // The hairline under the bar appears only once content scrolls beneath it.
  var bar = document.querySelector('.bar');
  var dock = document.querySelector('.dock');
  var hero = document.querySelector('[data-hero]');
  function onScroll() {
    if (bar) bar.classList.toggle('is-stuck', window.scrollY > 4);
    if (dock) {
      var past = hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > 520;
      var nearEnd = (window.innerHeight + window.scrollY) > (document.body.scrollHeight - 260);
      dock.classList.toggle('show', past && !nearEnd);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Prices: US dollars by default, pesos for visitors in the Philippines,
  // because those are the two storefronts CalOff is priced for.
  var ph = false;
  try {
    ph = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Manila' ||
         /-PH$/i.test(navigator.language || '');
  } catch (e) {}
  if (ph) {
    document.documentElement.classList.add('in-ph');
    Array.prototype.forEach.call(document.querySelectorAll('[data-php]'), function (el) {
      el.textContent = el.getAttribute('data-php');
    });
  }
})();
