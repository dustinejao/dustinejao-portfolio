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
     A keypress, not a beep.

     A pitched blip never sounds like a key, because a key is two things at
     once: a broadband transient where the stem bottoms out, and a low woody
     body from the case under it. So this is a bandpassed noise burst decaying
     in ~18ms sitting on a sine that falls to ~150Hz. "Creamy" is the ratio
     between them: the bandpass sits low enough to keep the clack off it, and
     the body carries most of the level.
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

  const thock = (tone, body, gain, dur) => {
    const c = audio();
    if (!c) return;
    const t = c.currentTime;

    const src = c.createBufferSource();
    src.buffer = noise(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tone;
    bp.Q.value = 0.9;
    const ng = c.createGain();
    ng.gain.setValueAtTime(gain, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    src.connect(bp).connect(ng).connect(c.destination);
    src.start(t);
    src.stop(t + 0.05);

    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(body * 1.7, t);
    osc.frequency.exponentialRampToValueAtTime(body, t + 0.03);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain * 0.95, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const SOUNDS = {
    /* A lighter, higher key for passing over something. */
    hover: () => thock(2600, 320, 0.07, 0.03),
    tap:   () => thock(1600, 150, 0.5, 0.06),
    on:    () => { thock(1600, 150, 0.45, 0.06); setTimeout(() => blip(760, 1150, 0.09, 0.14), 70); },
    off:   () => { thock(1600, 150, 0.45, 0.06); setTimeout(() => blip(760, 420, 0.11, 0.12), 70); },
  };

  const play = (name) => { if (soundOn && SOUNDS[name]) SOUNDS[name](); };

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
    if (e.target.closest(INTERACTIVE)) play('tap');
  }, { passive: true });

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

  /* ---------- Active nav link (anchor sections on home) ----------------- */
  const anchorLinks = document.querySelectorAll('.nav-pill a[href^="#"]');
  if (anchorLinks.length && 'IntersectionObserver' in window) {
    const map = new Map();
    anchorLinks.forEach((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) map.set(target, link);
    });
    const hero = document.querySelector('.hero');
    if (hero) map.set(hero, null);
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          anchorLinks.forEach((l) => l.classList.remove('active'));
          const link = map.get(entry.target);
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    map.forEach((_, target) => navIO.observe(target));
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
