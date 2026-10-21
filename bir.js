/* The BIR Registration Seal Badge, opened large so its QR code can be scanned.
   Used by the app pages (Barya, Liriko, Singil), each of which styles
   the small badge in its own footer; the home, Real Estate, Apps and Music
   pages carry the same thing in app.js and styles.css. The dialog's styles
   live here so every app shows it identically, whatever its own CSS resets.
   The full image (about 270 KB) loads on the first open, never with the page.
   Without JavaScript or <dialog>, the link opens it in a new tab, and a
   modifier click still does. */
(function () {
  'use strict';
  var link = document.querySelector('a.bir');
  if (!link || !window.HTMLDialogElement) return;

  var css = document.createElement('style');
  css.textContent =
    'dialog.birbox{box-sizing:border-box;width:min(720px,calc(100vw - 32px));max-width:none;margin:auto;' +
      'padding:40px 20px 16px;border:0;border-radius:14px;background:#fff;color:#333;' +
      'box-shadow:0 24px 80px rgba(0,0,0,.45);opacity:1}' +
    'dialog.birbox::backdrop{background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}' +
    'dialog.birbox img{display:block;width:100%;max-width:none;height:auto;margin:0}' +
    'dialog.birbox p{margin:10px 0 0;padding:0;text-align:center;font-size:13px;line-height:1.4;color:#555}' +
    /* Above the badge, never over it, so it cannot cover the QR code. */
    'dialog.birbox .birbox-x{position:absolute;top:8px;right:10px;margin:0;padding:4px 8px;border:0;' +
      'background:none;box-shadow:none;color:#777;font:24px/1 system-ui,sans-serif;cursor:pointer}' +
    'dialog.birbox .birbox-x:hover{color:#111}' +
    'dialog.birbox .birbox-x:focus:not(:focus-visible){outline:none}';
  document.head.appendChild(css);

  var box = document.createElement('dialog');
  box.className = 'birbox';
  box.setAttribute('aria-label', 'BIR Registration Seal Badge');
  box.innerHTML = '<button type="button" class="birbox-x" aria-label="Close">&times;</button>' +
    '<img alt="BIR Registration Seal Badge, RSN 53ARC20260000004907" width="1640" height="535">' +
    '<p>Scan the QR code to verify our registration with the BIR.</p>';
  document.body.appendChild(box);
  var big = box.querySelector('img');

  link.addEventListener('click', function (e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!big.getAttribute('src')) big.src = link.getAttribute('href');
    box.showModal();
  });
  box.addEventListener('click', function (e) {
    if (e.target.closest('.birbox-x')) { box.close(); return; }
    if (e.target !== box) return;
    // A click on the backdrop lands on the dialog itself, and so does one on
    // the card's own padding; only the first is outside its box.
    var r = box.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
  });
})();
