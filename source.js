/* Which platform sent this visitor, passed on to every app and CastCut link.
   The bio links on Instagram, TikTok, Facebook and YouTube all point at this site, so this is
   where a visit from a bio is still known. The platform comes from ?s= or utm_source on the
   address, else from the app's own browser (Instagram, TikTok and Facebook name themselves),
   else from the page that linked here. It is kept for this tab only, and added to:
     getcastcut.com      getcastcut.com/go/<code>-bio (counted by CastCut's link tracking)
     apps.apple.com      pt= and ct=<code>-bio (App Store Connect > Analytics > Campaigns)
     play.google.com     referrer=utm_source=… (Play Console acquisition by UTM)
   The codes are the same as CastCut's site/api/_campaigns.js. Nothing about the visitor is stored. */
(function () {
  'use strict';
  var PROVIDER = '129128273';   // App Store provider number, the same for every app
  var KEY = 'dj-source';
  var CODES = { instagram: 'ig', tiktok: 'tt', facebook: 'fb', youtube: 'yt', x: 'x', threads: 'th', reddit: 'rd', linkedin: 'li', email: 'em' };

  function clean(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

  function fromAddress() {
    var q = new URLSearchParams(location.search);
    var s = clean(q.get('s') || q.get('utm_source'));
    if (!s) return null;
    return { source: s, campaign: clean(q.get('utm_campaign')) || 'bio' };
  }
  function fromApp() {
    var ua = navigator.userAgent || '';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/Barcelona/.test(ua)) return 'threads';   // the Threads app's browser
    if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) return 'tiktok';
    if (/FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS/i.test(ua)) return 'facebook';
    return null;
  }
  function fromReferrer() {
    var host = '';
    try { host = new URL(document.referrer).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ''); } catch (e) { return null; }
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
    if (/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/.test(host)) return 'facebook';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
    if (/(^|\.)threads\.(net|com)$/.test(host)) return 'threads';
    if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(host)) return 'x';
    if (/(^|\.)reddit\.com$/.test(host)) return 'reddit';
    if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin';
    return null;
  }

  var found = fromAddress();
  if (!found) { var s = fromApp() || fromReferrer(); if (s) found = { source: s, campaign: 'bio' }; }
  try {
    if (found) sessionStorage.setItem(KEY, JSON.stringify(found));
    else found = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch (e) {}
  if (!found || !found.source) return;

  var code = (CODES[found.source] || found.source) + '-' + found.campaign;   // e.g. ig-bio
  var medium = found.source === 'email' ? 'email' : 'social';

  function tag(a) {
    var url;
    try { url = new URL(a.href); } catch (e) { return; }
    var host = url.hostname.replace(/^www\./, '');
    if (host === 'getcastcut.com' && !/^\/go\//.test(url.pathname)) {
      var page = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
      a.href = 'https://getcastcut.com/go/' + code + (page && /^[a-z0-9-]{1,40}$/.test(page) ? '/' + page : '') + (url.hash || '');
    } else if (host === 'apps.apple.com' && /\/id\d+/.test(url.pathname)) {
      url.searchParams.set('pt', PROVIDER);
      url.searchParams.set('ct', code.slice(0, 30));
      url.searchParams.set('mt', '8');
      a.href = url.toString();
    } else if (host === 'play.google.com' && url.searchParams.get('id')) {
      url.searchParams.set('referrer', 'utm_source=' + found.source + '&utm_medium=' + medium + '&utm_campaign=' + found.campaign);
      a.href = url.toString();
    }
  }
  function tagAll() { Array.prototype.forEach.call(document.querySelectorAll('a[href]'), tag); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagAll); else tagAll();
  // Links added later, or changed by another script, are tagged as they are pressed.
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a) tag(a); }, true);
})();
