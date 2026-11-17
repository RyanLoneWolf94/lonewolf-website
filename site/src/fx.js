/*
 * Cursor and scroll effects that live in the DOM (the 3D world is in world.js).
 *
 *   cursor     a dot and a trailing ring that labels what you're over
 *   magnetic   pills and buttons lean toward the pointer
 *   parallax   [data-depth] elements drift with the mouse
 *   reveal     headlines rise out of a mask when they arrive
 *   decode     headings resolve from scrambled glyphs
 *   words      the manifesto lights up word by word as you read
 *   ticker     service bands that speed up and lean with scroll velocity
 *   cards      work images wipe in, then tilt under the cursor
 *   drift      giant lines fill with ink as they pass
 *   giant      the footer wordmark rises letter by letter
 *   progress   a hairline across the top tracks how far you've read
 *
 * Everything is scrubbed to scroll or answers the pointer. With reduced
 * motion each one shows its finished state or doesn't run.
 */

export function initFx({ gsap, ScrollTrigger, lenis, reduceMotion }) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  progressLine();
  words();
  drift();
  giant();
  reveal();
  if (reduceMotion) return;
  decode();
  ticker();
  cards();
  if (fine) { cursor(); magnetic(); parallax(); }

  function progressLine() {
    const bar = document.createElement('div');
    bar.className = 'scroll-line';
    bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => bar.style.setProperty('--p', s.progress.toFixed(4)) });
  }

  function reveal() {
    document.querySelectorAll('.reveal').forEach((h) => {
      const lines = [...h.querySelectorAll(':scope > span')];
      lines.forEach((l) => { const i = document.createElement('i'); i.textContent = l.textContent; l.replaceChildren(i); });
      if (reduceMotion) return;
      gsap.from(lines.map((l) => l.firstChild), {
        yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.12,
        scrollTrigger: { trigger: h, start: 'top 85%', once: true },
      });
    });
  }

  function words() {
    const p = document.querySelector('[data-words]');
    if (!p) return;
    const out = [];
    p.childNodes.forEach((node) => {
      const accent = node.nodeName === 'EM';
      node.textContent.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { out.push(document.createTextNode(tok)); return; }
        const w = document.createElement('span');
        w.className = accent ? 'w w-accent' : 'w';
        w.textContent = tok;
        out.push(w);
      });
    });
    p.setAttribute('aria-label', p.textContent.replace(/\s+/g, ' ').trim());
    p.replaceChildren(...out);
    const ws = [...p.querySelectorAll('.w')];
    if (reduceMotion) { ws.forEach((w) => w.classList.add('is-lit')); return; }
    ScrollTrigger.create({
      trigger: p, start: 'top 75%', end: 'bottom 40%', scrub: true,
      onUpdate: (s) => { const lit = Math.round(s.progress * ws.length); ws.forEach((w, i) => w.classList.toggle('is-lit', i < lit)); },
    });
  }

  function drift() {
    document.querySelectorAll('[data-drift-line]').forEach((el) => {
      if (reduceMotion) { el.style.setProperty('--fill', '100%'); return; }
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', end: 'bottom 35%', scrub: true,
        onUpdate: (s) => el.style.setProperty('--fill', `${(s.progress * 100).toFixed(1)}%`),
      });
      const dir = Number(el.dataset.driftLine);
      gsap.fromTo(el, { xPercent: dir * -14 }, { xPercent: dir * 10, ease: 'none', scrollTrigger: { trigger: '[data-drift]', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  function giant() {
    const el = document.querySelector('[data-giant]');
    if (!el) return;
    const stops = ['#FFB300', '#FF8A1A', '#FF6B00', '#E2471E', '#B0274A', '#82196E', '#5B0FA8', '#4A0C8C'];
    const letters = [...el.textContent];
    el.replaceChildren(...letters.map((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--c', stops[Math.round((i / Math.max(1, letters.length - 1)) * (stops.length - 1))]);
      return s;
    }));
    if (reduceMotion) return;
    gsap.fromTo(el.children, { yPercent: 105 }, { yPercent: 0, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  function decode() {
    const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFxyz';
    document.querySelectorAll('[data-decode]').forEach((el) => {
      const final = el.textContent;
      el.setAttribute('aria-label', final);
      ScrollTrigger.create({
        trigger: el, start: 'top 85%', once: true,
        onEnter: () => {
          const total = 26 + final.length;
          let frame = 0;
          const tick = () => {
            frame += 1;
            let s = '';
            for (let i = 0; i < final.length; i++) {
              const ch = final[i];
              s += (ch === ' ' || frame > i * 0.9 + 14) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            el.textContent = s;
            if (frame < total) requestAnimationFrame(tick);
            else { el.textContent = final; el.removeAttribute('aria-label'); }
          };
          tick();
        },
      });
    });
  }

  function ticker() {
    const rows = [...document.querySelectorAll('[data-ticker]')].map((row) => {
      const track = row.querySelector('.ticker-track');
      const items = [...track.children];
      do items.forEach((li) => track.append(li.cloneNode(true)));
      while (track.scrollWidth < window.innerWidth * 2.2 && track.children.length < items.length * 8);
      [...track.children].slice(items.length).forEach((li) => li.setAttribute('aria-hidden', 'true'));
      const setWidth = () => track.children[items.length].offsetLeft - track.children[0].offsetLeft;
      return { row, track, setWidth, dir: Number(row.dataset.ticker), x: 0 };
    });
    let velocity = 0;
    lenis?.on('scroll', (e) => { velocity = e.velocity; });
    let skew = 0;
    gsap.ticker.add((time, dms) => {
      const dt = dms / 1000;
      const boost = 1 + Math.min(6, Math.abs(velocity) * 0.25);
      skew += (Math.max(-12, Math.min(12, velocity * 0.6)) - skew) * 0.12;
      rows.forEach((r) => {
        const w = r.setWidth();
        r.x -= r.dir * 60 * boost * dt * (velocity < 0 ? -1 : 1);
        if (r.x <= -w) r.x += w;
        if (r.x > 0) r.x -= w;
        r.track.style.transform = `translate3d(${r.x.toFixed(1)}px,0,0) skewX(${(-skew * r.dir).toFixed(2)}deg)`;
      });
      velocity *= 0.92;
    });
  }

  function cards() {
    document.querySelectorAll('.card-media').forEach((m) => {
      gsap.fromTo(m, { clipPath: 'inset(100% 0% 0% 0% round 16px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 16px)', ease: 'none',
        scrollTrigger: { trigger: m, start: 'top 95%', end: 'top 55%', scrub: true },
      });
      if (!fine) return;
      const card = m.closest('.card');
      card.addEventListener('pointermove', (e) => {
        const r = m.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(m, { rotateY: x * 10, rotateX: -y * 10, transformPerspective: 900, duration: 0.5, ease: 'power3.out' });
        m.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
        m.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => gsap.to(m, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' }));
    });
  }

  function parallax() {
    const els = [...document.querySelectorAll('[data-depth]')];
    let mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    els.forEach((el) => {
      const d = Number(el.dataset.depth) * 24;
      const x = gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3.out' });
      gsap.ticker.add(() => { x(-mx * d); y(-my * d); });
    });
  }

  function cursor() {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    const label = document.createElement('span');
    label.className = 'cursor-label';
    ring.append(label);
    [dot, ring].forEach((n) => n.setAttribute('aria-hidden', 'true'));
    document.body.append(dot, ring);
    document.documentElement.classList.add('has-cursor');

    const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') };
    let mx = -100, my = -100, rx = -100, ry = -100, lastX = 0, lastY = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      setDot.x(mx); setDot.y(my);
      document.documentElement.classList.remove('cursor-hidden');
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.documentElement.classList.add('cursor-hidden'));

    gsap.ticker.add(() => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      const vx = mx - lastX, vy = my - lastY;
      lastX = mx; lastY = my;
      const speed = Math.min(1, Math.hypot(vx, vy) / 60);
      const angle = Math.atan2(vy, vx) * 180 / Math.PI;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) scale(${(1 + speed * 0.5).toFixed(3)}, ${(1 - speed * 0.3).toFixed(3)})`;
      label.style.transform = `translate(-50%, -50%) rotate(${(-angle).toFixed(1)}deg)`;
    });

    const labelFor = (t) => {
      if (t.closest('[data-journey], [data-wolf]')) return 'Push';
      if (t.closest('[data-case], [data-project]')) return 'Open';
      if (t.closest('.pill-dark, [href="#contact"]')) return 'Talk';
      if (t.closest('a, button, label, select, input')) return '';
      return null;
    };
    document.addEventListener('pointerover', (e) => {
      const l = labelFor(e.target);
      ring.classList.toggle('is-hover', l !== null);
      ring.classList.toggle('has-label', !!l);
      label.textContent = l || '';
    });
    document.addEventListener('pointerdown', (e) => {
      ring.classList.add('is-down');
      if (e.target.closest('[data-journey], [data-wolf]')) { label.textContent = 'Hold'; ring.classList.add('has-label'); }
    });
    document.addEventListener('pointerup', () => { ring.classList.remove('is-down'); if (label.textContent === 'Hold') label.textContent = 'Push'; });
  }

  function magnetic() {
    document.querySelectorAll('.pill, .btn').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.3, y: (e.clientY - (r.top + r.height / 2)) * 0.3, duration: 0.4, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
    });
  }
}
