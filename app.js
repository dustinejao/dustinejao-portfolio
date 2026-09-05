/* Dustine Jao : Portfolio 2026. Vanilla JS, no dependencies. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle (pre-paint script in <head> sets initial) ---- */
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const applyThemeMeta = () => {
    if (themeMeta) themeMeta.content = root.dataset.theme === 'dark' ? '#0b0b0e' : '#ffffff';
  };
  applyThemeMeta();

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
      toggle.setAttribute('aria-pressed', String(next === 'dark'));
      applyThemeMeta();
    });
  }

  /* ---------- Interface sounds ------------------------------------------
     Synthesised with the Web Audio API rather than shipped as files: four
     short blips would be four requests and a few hundred KB for something most
     visitors will never switch on. Off by default, because a site that makes
     noise uninvited is a site people close, and browsers block audio before a
     gesture anyway. Music on the releases page is unaffected; this only covers
     interface feedback.
  --------------------------------------------------------------------- */
  const SOUND_KEY = 'sound';
  /* On unless switched off. Nothing can actually sound until the first click,
     because browsers refuse to start an AudioContext before a gesture, so the
     first thing anyone hears is a sound they caused. */
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) {}
  root.dataset.sound = soundOn ? 'on' : 'off';

  let actx = null;
  const audio = () => {
    if (!actx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      actx = new Ctx();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  };

  /* One oscillator, a fast pitch fall and a short decay. Kept for the toggle's
     own confirmation, where a pitched note says on/off better than a click. */
  const blip = (from, to, dur, gain, type) => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  /*
     A click, not a thump.

     Two earlier passes put a low sine under the transient to give the key a
     "body", and both times the body was the problem: at 150Hz carrying a third
     of the level it dominates everything, which is what "thumpy" sounds like.
     Measured, that version's zero-crossing rate was 290Hz over a 28ms decay,
     i.e. mostly a low tone with a tick on the front.

     This is the transient and almost nothing else: bandpassed noise at 2.4kHz
     gone in 14ms, with a 460Hz tick underneath at an eighth of the level purely
     so it does not sound brittle. 827Hz over 11ms, against 213Hz over 33ms for
     the thump it replaces. The band started at 3kHz and read slightly tinny, so
     it came down a step: enough to lose the glassiness, not enough to put the
     thump back.
  */
  let noiseBuf = null;
  const noise = (c) => {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.05), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  };

  /* A narrow bandpass throws away most of the noise's energy, so `gain` here
     runs well above 1. The rendered peak is what matters, not the number. */
  const key = (tone, q, snap, gain, body, fall, ratio) => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noise(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tone;
    bp.Q.value = q;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const ng = c.createGain();
    ng.gain.setValueAtTime(gain, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + snap);
    src.connect(bp).connect(hp).connect(ng).connect(c.destination);
    src.start(t);
    src.stop(t + 0.05);

    if (!ratio) return;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(body * 1.5, t);
    osc.frequency.exponentialRampToValueAtTime(body, t + 0.012);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain * ratio, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + fall);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + fall + 0.02);
  };

  const SOUNDS = {
    /* Same click, a fifth of the level, nothing underneath. */
    hover: () => key(2900, 4, 0.006, 0.9, 0, 0, 0),
    tap:   () => key(2400, 3.5, 0.014, 2.4, 460, 0.020, 0.13),
    on:    () => { key(2400, 3.5, 0.014, 2.2, 460, 0.020, 0.13); setTimeout(() => blip(760, 1150, 0.09, 0.14), 70); },
    off:   () => { key(2400, 3.5, 0.014, 2.2, 460, 0.020, 0.13); setTimeout(() => blip(760, 420, 0.11, 0.12), 70); },
    /* The mark gets its own sound: the click, then D5-A5-D6 on sine, an open
       fifth and octave. Longer and softer than anything else on the page,
       because going home is the one navigation worth marking. */
    home:  (semitones = 0) => {
      const t = Math.pow(2, (semitones || 0) / 12);
      key(2400, 3.5, 0.014, 2.2, 460, 0.020, 0.13);
      [587.33, 880, 1174.66].forEach((f, i) => {
        setTimeout(() => blip(f * t, f * t * 0.995, 0.2, 0.1, 'sine'), 45 + i * 75);
      });
    },
  };

  const play = (name, arg) => { if (soundOn && SOUNDS[name]) SOUNDS[name](arg); };

  const INTERACTIVE = '.btn, .nav-link, .icon-btn, .work-card, .work-main, .sub-chip, .bt, .social a, .footer-links a, .crumb, .cf-item, .platform-btn';

  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      root.dataset.sound = soundOn ? 'on' : 'off';
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) {}
      /* The confirmation has to bypass the flag on the way off, otherwise
         switching sound off is the one action that gives no feedback. */
      if (soundOn) SOUNDS.on(); else SOUNDS.off();
    });
  }

  /* Hover fires on entering a new target only, so sweeping the cursor across a
     row of chips does not machine-gun the speaker. */
  let lastHovered = null;
  document.addEventListener('pointerover', (e) => {
    if (!soundOn || e.pointerType !== 'mouse') return;
    const hit = e.target.closest(INTERACTIVE);
    if (hit && hit !== lastHovered) { lastHovered = hit; play('hover'); }
    else if (!hit) lastHovered = null;
  }, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    if (!soundOn) return;
    if (e.target.closest('#sound-toggle')) return;
    if (e.target.closest('.logo')) return;      /* has its own, on click */
    if (e.target.closest(INTERACTIVE)) play('tap');
  }, { passive: true });

  /* The logo, and its flourish.

     On the home page it scrolls rather than reloading, which also lets the
     three notes finish. Off the home page it still navigates, so the chime is
     cut short by the page change; that is the right trade against holding a
     navigation back to wait for a sound. */
  const logo = document.querySelector('.logo');
  if (logo) {
    /* Each press moves the mark one step around the wheel and the chime one
       step up the scale, so the two land together. Seven steps and it is pink
       again: the brand is index 0, and nothing here is sticky, so a fresh load
       always opens on it. */
    /* Hue-rotate is a fixed matrix, not a hue wheel: it keeps roughly the same
       luminance, and pink is a dark colour, so the angles that would be yellow
       come out as brown. These seven were measured and are the vivid ones -
       pink, red, green, ocean, blue, violet, magenta. */
    const HUES = [0, 40, 176, 224, 264, 304, 336];
    const STEPS = [0, 2, 4, 5, 7, 9, 11];
    let spin = 0;

    logo.addEventListener('click', (e) => {
      spin = (spin + 1) % HUES.length;
      logo.style.setProperty('--logo-hue', HUES[spin] + 'deg');
      if (!reduceMotion) {
        logo.classList.remove('pop');
        void logo.offsetWidth;          /* restart the animation on each press */
        logo.classList.add('pop');
      }
      play('home', STEPS[spin]);
      const goesHome = new URL(logo.href, location.href).pathname === location.pathname;
      if (goesHome) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (location.hash) history.replaceState(null, '', location.pathname);
      }
    });
  }

  /* ---------- Reveal on scroll ------------------------------------------ */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  /* ---------- Nav capsule ------------------------------------------------
     One element that travels, rather than a background switching between
     links. Three things can move it, in priority order: the cursor while it is
     inside the pill, keyboard focus, and otherwise the section you have
     scrolled to. On touch there is no cursor, so only the last two apply and a
     tap settles straight back to wherever you actually are.
  --------------------------------------------------------------------- */
  const navPill = document.querySelector('.nav-pill');
  const glide = navPill && navPill.querySelector('.nav-glide');
  const navLinks = navPill ? Array.from(navPill.querySelectorAll('.nav-link')) : [];

  /* Tracked explicitly rather than read back off :hover, which goes stale on
     touch: a tap leaves the element matching :hover with no pointer on it, and
     the capsule then refuses to follow the page. */
  let pointerInPill = false;

  /* Clicking a link starts a smooth scroll that crosses every section in
     between, and the observer fires for each one it passes. Left alone the
     capsule hops through all of them before it lands, which is the bouncing:
     it is chasing the scroll rather than the destination. So a click pins it
     to the link you pressed and the observer is ignored until the page has
     actually stopped moving. */
  let navLocked = false;
  let lockFallback = 0;

  /* Once a click has committed to another page, nothing may move the capsule
     again. The browser keeps painting this page while the next one loads, and
     a capsule that flies off to a hovered link, or back to the section you
     were in, during that window is the flicker just before the page changes. */
  let frozen = false;

  /* While the pill is scrolling itself, links slide under a stationary cursor
     and each one fires pointerenter. Following those is a feedback loop: the
     capsule chases the links, the links keep moving. That is the vibration. */
  let pillSettling = 0;
  const unlockNav = () => { navLocked = false; clearTimeout(lockFallback); };
  const lockNav = (ms = 1400) => {
    navLocked = true;
    clearTimeout(lockFallback);
    /* A safety net, in case the scroll is interrupted and scrollend never
       comes (or the browser does not have it). */
    lockFallback = setTimeout(() => { navLocked = false; }, ms);
  };
  if ('onscrollend' in window) window.addEventListener('scrollend', unlockNav);

  const glideTo = (el, animate) => {
    if (!glide || frozen) return;
    /* A link can be hidden at this width: Experience is desktop-only, and its
       section is still on the page you are scrolling through. Measuring one
       gives 0x0, which collapsed the capsule to nothing in the far corner and
       then threw it back across when the next section arrived. Leave it where
       it is instead. */
    if (el && !el.offsetWidth) return;
    if (!el) {
      glide.classList.remove('is-on');
      navLinks.forEach((l) => l.classList.remove('is-lit'));
      return;
    }
    if (animate === false) glide.classList.add('no-anim');
    glide.style.setProperty('--x', el.offsetLeft + 'px');
    glide.style.setProperty('--w', el.offsetWidth + 'px');
    glide.classList.add('is-on');
    navLinks.forEach((l) => l.classList.toggle('is-lit', l === el));
    if (animate === false) {
      /* Force a reflow so the jump lands before transitions come back on. */
      void glide.offsetWidth;
      glide.classList.remove('no-anim');
    }
  };
  const currentNav = () => navPill && navPill.querySelector('.nav-link.active');
  const settle = () => glideTo(currentNav(), true);

  /* On a phone the pill scrolls, so the link the capsule is under can sit off
     the edge. Bring it back into view rather than animating to somewhere the
     user cannot see. */
  const keepInView = (el, smooth) => {
    if (!el || !navPill || navPill.scrollWidth <= navPill.clientWidth) return;
    const l = el.offsetLeft, r = l + el.offsetWidth;
    const view = navPill.scrollLeft, edge = view + navPill.clientWidth;
    if (l < view + 8 || r > edge - 8) {
      /* Animate this only when the nav itself was used. Sliding it while the
         page is being scrolled means a horizontal animation running against a
         vertical one, which on a phone reads as the nav shivering. */
      const glideIt = smooth && !reduceMotion;
      pillSettling = Date.now() + (glideIt ? 500 : 150);
      navPill.scrollTo({
        left: l - (navPill.clientWidth - el.offsetWidth) / 2,
        behavior: glideIt ? 'smooth' : 'auto',
      });
    }
  };

  if (glide) {
    glideTo(currentNav(), false);
    keepInView(currentNav());

    navLinks.forEach((l) => {
      l.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        pointerInPill = true;
        if (Date.now() < pillSettling) return;   /* the link came to the cursor */
        glideTo(l, true);
      });
      l.addEventListener('focus', () => { glideTo(l, true); keepInView(l, true); });

      /* Go straight to the destination and mark it active now, rather than
         waiting for the scroll to arrive. A link to another page holds the
         lock longer: the browser keeps painting this page while the next one
         loads, and without it the capsule flies back to the section you were
         in a moment before the page changes. */
      l.addEventListener('click', (e) => {
        const sameDoc = (l.getAttribute('href') || '').startsWith('#');
        /* A modifier click opens a tab and leaves this page where it is. */
        const leaving = !sameDoc && e.button === 0 &&
          !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
        navLinks.forEach((o) => o.classList.remove('active'));
        l.classList.add('active');
        lockNav(sameDoc ? 1400 : 6000);
        glideTo(l, true);
        keepInView(l, true);
        if (leaving) {
          frozen = true;                /* this page is on its way out */
          setTimeout(() => { frozen = false; }, 6000);   /* unless it is not */
        }
      });
    });

    navPill.addEventListener('pointerleave', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      pointerInPill = false;
      settle();
    });
    /* A tap is not a hover. Let the scroll it triggers land, then settle. */
    navPill.addEventListener('touchend', () => {
      pointerInPill = false;
      setTimeout(settle, 80);
    }, { passive: true });

    /* A middle-click, a modifier-click or a cancelled navigation leaves the
       page in place, so thaw when it turns out we are staying. */
    window.addEventListener('pageshow', () => { frozen = false; navLocked = false; });

    navPill.addEventListener('focusout', () => {
      if (!navPill.contains(document.activeElement)) settle();
    });

    /* Fonts landing late change link widths, so re-measure once they are in. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => glideTo(currentNav(), false));
    }
    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { glideTo(currentNav(), false); keepInView(currentNav()); }, 120);
    });
  }

  /* ---------- Active nav link (anchor sections on home) ----------------- */
  const anchorLinks = Array.from(document.querySelectorAll('.nav-pill a[href^="#"]'));
  if (anchorLinks.length && 'IntersectionObserver' in window) {
    const map = new Map();
    anchorLinks.forEach((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) map.set(target, link);
    });
    /* The hero belongs to the first link rather than to nothing. Mapping it to
       null used to blank the capsule out, so every trip past the top of the
       page was a fade out and a fade back in. */
    const hero = document.querySelector('.hero');
    if (hero) map.set(hero, anchorLinks[0]);

    const lastLink = anchorLinks[anchorLinks.length - 1];
    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

    const applyActive = (link) => {
      if (!link) return;
      anchorLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      /* The cursor outranks the page: only steer if it is not driving. */
      if (!pointerInPill) { glideTo(link, true); keepInView(link); }
    };

    const navIO = new IntersectionObserver((entries) => {
      if (navLocked) return;            /* the click owns it until it lands */
      entries.forEach((entry) => {
        if (entry.isIntersecting) applyActive(atBottom() ? lastLink : map.get(entry.target));
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    map.forEach((_, target) => navIO.observe(target));

    /* The last section can start below the furthest the page will ever
       scroll, so it never crosses the observer's band and the capsule snaps
       back to whatever is still in it: the bounce. The bottom of the page is
       the last link, whatever the band thinks. */
    window.addEventListener('scroll', () => {
      if (navLocked || pointerInPill) return;
      if (atBottom() && !lastLink.classList.contains('active')) applyActive(lastLink);
    }, { passive: true });
  }

  /* ---------- Music coverflow -------------------------------------------- */
  const stage = document.getElementById('cf-stage');
  if (stage) {
    const items = Array.from(stage.querySelectorAll('.cf-item'));
    const n = items.length;
    const titleEl = document.getElementById('cf-title');
    const yearEl = document.getElementById('cf-year');
    let active = 0;

    const render = () => {
      const half = n / 2;
      items.forEach((it, i) => {
        let off = i - active;
        if (off > half) off -= n;
        if (off < -half) off += n;
        const abs = Math.abs(off);
        const visible = abs <= 2;
        it.style.setProperty('--off', off);
        it.style.setProperty('--abs', abs);
        it.style.zIndex = String(100 - abs);
        it.style.opacity = visible ? (abs === 2 ? '0.5' : '1') : '0';
        it.style.pointerEvents = visible ? 'auto' : 'none';
        it.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
        it.classList.toggle('is-active', off === 0);
      });
      const a = items[active];
      if (titleEl) titleEl.textContent = a.dataset.title;
      if (yearEl) yearEl.textContent = a.dataset.year;
    };
    const go = (dir) => { active = (active + dir + n) % n; render(); };
    const setActive = (i) => { active = ((i % n) + n) % n; render(); };

    /* Every cover opens on the first click. It used to take two: the first
       only centred the sleeve, which reads as a dead link. A cover still
       centres itself on the way through, and a drag suppresses the click so
       browsing the shelf never opens anything by accident. */
    let dragged = false;
    items.forEach((it, i) => {
      it.addEventListener('click', (e) => {
        if (dragged) { e.preventDefault(); dragged = false; return; }
        if (i !== active) setActive(i);
      });
    });
    document.getElementById('cf-prev').addEventListener('click', () => go(-1));
    document.getElementById('cf-next').addEventListener('click', () => go(1));

    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    // swipe / drag
    let startX = null;
    const onStart = (x) => { startX = x; };
    const onEnd = (x) => {
      if (startX === null) return;
      const dx = x - startX;
      dragged = Math.abs(dx) > 8;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      startX = null;
    };
    stage.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
    stage.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientX), { passive: true });
    stage.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mouseup', (e) => { if (startX !== null) onEnd(e.clientX); });

    render();
  }

  /* ---------- Footer year ------------------------------------------------ */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

})();
