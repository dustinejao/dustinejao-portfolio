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

  /* Built once and reused. Filling it is cheap but not free, and it is filled
     during warm-up rather than during the first click. */
  let noiseBuf = null;
  const noise = (c) => {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.05), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  };

  let actx = null;

  const makeContext = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    /* 'interactive' asks the platform for the smallest buffer it will give.
       Left to its own devices Safari in particular picks a comfortable one,
       which is audible as lateness on a click. */
    try { actx = new Ctx({ latencyHint: 'interactive' }); } catch (e) { actx = new Ctx(); }
    return actx;
  };

  /*
     Everything expensive happens on the first gesture, not on the first sound.

     Constructing an AudioContext, resuming it and filling the noise buffer all
     cost real milliseconds, and doing them inside the handler that is supposed
     to click means the click arrives after them. Worse, `resume()` is async: a
     sound scheduled while the context is still suspended does not play late,
     it plays whenever the context finally starts, so a handful of early taps
     arrive in a bunch. That is the lag.

     So the first pointerdown anywhere on the page builds the context, resumes
     it, fills the buffer and pushes one silent sample through to open the
     output path. From then on a click is a few oscillator nodes and nothing
     else, which is inaudible in scheduling terms.
  */
  const warmUp = () => {
    const c = actx || makeContext();
    if (!c) return;
    noise(c);
    try {
      const silent = c.createBufferSource();
      silent.buffer = c.createBuffer(1, 1, c.sampleRate);
      silent.connect(c.destination);
      silent.start(0);
    } catch (e) {}
    if (c.state !== 'running') c.resume();
  };

  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, warmUp, { once: true, capture: true, passive: true });
  });

  const audio = () => {
    const c = actx || makeContext();
    if (!c) return null;
    /* Not running yet: ask, and drop this one. A skipped first click reads as
       nothing happening, which is fine; a queued one arrives seconds later
       against an unrelated action, which reads as broken. */
    if (c.state !== 'running') {
      c.resume();
      return null;
    }
    return c;
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

  const INTERACTIVE = '.btn, .nav-link, .icon-btn, .work-card, .work-main, .sub-chip, .bt, .social a, .footer-links a, .crumb, .cf-item, .platform-btn, a.st-row, .st-today, .st-avatar, .ap-btn, .ap-link, .fd';

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
    /* Start the moment any of it enters, not once it is well inside: a tall
       tile waiting for 5% of itself to clear the fold left a blank gap on a
       phone and then snapped in. */
    }, { rootMargin: '0px 0px 40px 0px', threshold: 0 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  /* ---------- Navigation -------------------------------------------------
     The current page owns the active pill. Hover, focus and scroll never move
     it; section links keep their native anchor navigation.
  --------------------------------------------------------------------- */
  document.querySelectorAll('.nav-pill .nav-link').forEach((link) => {
    if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');

    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
          event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash) return;
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (location.hash) history.replaceState(null, '', location.pathname);
    });
  });

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

  /* ---------- Home: copy that lights up as it is read -------------------
     Each word is wrapped in a span and lit in order as the paragraph moves
     up the screen: dark at the bottom of the viewport, fully lit by the time
     its last line passes the middle. Without motion it is simply lit. */
  const lit = document.querySelector('[data-lit]');
  if (lit && !reduceMotion) {
    const words = [];
    const split = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 1) { split(child); return; }
        if (child.nodeType !== 3) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          words.push(w);
          frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      });
    };
    split(lit);
    lit.classList.add('is-split');

    let shown = -1;
    let queued = false;
    const paint = () => {
      queued = false;
      const r = lit.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      const n = Math.round(p * words.length);
      if (n === shown) return;
      const lo = Math.min(n, shown < 0 ? 0 : shown);
      const hi = Math.max(n, shown < 0 ? words.length : shown);
      for (let i = lo; i < hi; i++) words[i].classList.toggle('on', i < n);
      shown = n;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    /* Only listen while the paragraph is near the screen; the rest of the
       page scrolls without it measuring anything. */
    const listen = (on) => {
      const fn = on ? 'addEventListener' : 'removeEventListener';
      window[fn]('scroll', queue, { passive: true });
      window[fn]('resize', queue);
    };
    /* No paint at start-up: every word already starts dim, and measuring the
       paragraph straight after splitting it forced a layout of the page. The
       observer's first callback paints it if it is already on screen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => { listen(entry.isIntersecting); if (entry.isIntersecting) queue(); });
      }, { rootMargin: '200px 0px' }).observe(lit);
    } else {
      listen(true);
      queue();
    }
  }

  /* ---------- Home: numbers count up the first time they are seen -------- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        cio.unobserve(entry.target);
        const el = entry.target;
        const to = Number(el.dataset.count);
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / 1200);
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => { c.textContent = '0'; cio.observe(c); });
  }

  /* ---------- Loops rest while they are off screen ---------------------- */
  const loopers = document.querySelectorAll('[data-loop]');
  if (loopers.length && 'IntersectionObserver' in window) {
    const lio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-paused', !entry.isIntersecting));
    }, { rootMargin: '120px 0px' });
    loopers.forEach((el) => lio.observe(el));
  }

  /* ---------- Apps: the Today tab's date over the large title ------------ */
  const stDate = document.getElementById('st-date');
  if (stDate) {
    stDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  /* ---------- BIR badge: opens large so the QR code can be scanned -------
     The full image (about 270 KB) loads on the first open, never with the
     page. Without JavaScript or <dialog>, the link opens it in a new tab, and
     a modifier click still does. Esc, the close button and a click outside
     the card all close it. */
  const bir = document.querySelector('a.bir');
  if (bir && window.HTMLDialogElement) {
    const box = document.createElement('dialog');
    box.className = 'birbox';
    box.setAttribute('aria-label', 'BIR Registration Seal Badge');
    box.innerHTML = '<button type="button" class="birbox-x" aria-label="Close">&times;</button>' +
      '<img alt="BIR Registration Seal Badge, RSN 53ARC20260000004907" width="1640" height="535">' +
      '<p>Scan the QR code to verify our registration with the BIR.</p>';
    document.body.appendChild(box);
    const big = box.querySelector('img');

    bir.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (!big.getAttribute('src')) big.src = bir.getAttribute('href');
      box.showModal();
    });
    box.addEventListener('click', (e) => {
      if (e.target.closest('.birbox-x')) { box.close(); return; }
      if (e.target !== box) return;
      /* A click on the backdrop lands on the dialog itself, and so does one
         on the card's own padding; only the first is outside its box. */
      const r = box.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
    });
  }

  /* ---------- Footer year ------------------------------------------------ */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

})();
