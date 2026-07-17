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

  /* ---------- Hero folder: open + pointer parallax ---------------------- */
  const folder = document.querySelector('.folder');
  if (folder) {
    requestAnimationFrame(() => {
      setTimeout(() => folder.classList.add('loaded'), 250);
    });

    const scene = document.querySelector('.hero-scene');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (scene && canHover && !reduceMotion) {
      let raf = 0;
      scene.addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = scene.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          folder.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
          folder.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
        });
      });
      scene.addEventListener('pointerleave', () => {
        folder.style.setProperty('--ry', '0deg');
        folder.style.setProperty('--rx', '0deg');
      });
    }
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

    items.forEach((it, i) => {
      it.addEventListener('click', (e) => {
        if (i !== active) { e.preventDefault(); setActive(i); }
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

  /* ---------- Terminal typewriter (apps page) ---------------------------- */
  const term = document.getElementById('term-lines');
  if (term) {
    const lines = JSON.parse(term.dataset.lines || '[]');
    const cursor = document.getElementById('term-cursor');
    if (reduceMotion) {
      term.innerHTML = lines.map((l) => `<span class="ln ${l.c || ''}">${l.t}</span>`).join('');
    } else {
      let li = 0;
      const typeLine = () => {
        if (li >= lines.length) return;
        const line = lines[li];
        const el = document.createElement('span');
        el.className = 'ln ' + (line.c || '');
        term.appendChild(el);
        if (cursor) term.appendChild(cursor);
        let ci = 0;
        const tick = () => {
          ci += 1 + Math.floor(Math.random() * 2);
          el.textContent = line.t.slice(0, ci);
          if (ci < line.t.length) {
            setTimeout(tick, line.fast ? 8 : 26);
          } else {
            li += 1;
            setTimeout(typeLine, line.pause || 300);
          }
        };
        tick();
      };
      setTimeout(typeLine, 500);
    }
  }
})();
