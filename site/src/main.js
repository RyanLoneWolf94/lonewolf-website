import './styles.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initProjects } from './projects.js';
import { initCaseStudies } from './case-studies.js';
import { initSignup } from './signup.js';
import { initFx } from './fx.js';

gsap.registerPlugin(ScrollTrigger);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const dev = import.meta.env.DEV;
if (dev) window.__lw = { gsap, ScrollTrigger };

/* ---------- smooth scroll ---------- */
let lenis = null;
let velocity = 0;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', (e) => { velocity = e.velocity; ScrollTrigger.update(); });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  if (dev) window.__lw.lenis = lenis;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href') === '#') return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { offset: -8, duration: 1.6 });
  else target.scrollIntoView();
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

/* ---------- preloader ---------- */
const loader = document.querySelector('[data-loader]');
const countEl = document.querySelector('[data-loader-count]');
const loaderWords = [...document.querySelectorAll('[data-loader-words] span')];
let shown = 0, target = 30, loaderDone = false;
const finishLoader = () => { loaderDone = true; target = 100; };
if (reduceMotion) {
  loader.remove();
} else {
  let wi = 0;
  loaderWords[0].classList.add('is-on');
  const wordTimer = setInterval(() => {
    loaderWords[wi].classList.remove('is-on');
    wi = (wi + 1) % loaderWords.length;
    loaderWords[wi].classList.add('is-on');
  }, 520);
  const tickLoader = () => {
    shown += (target - shown) * 0.07 + 0.35;
    if (shown > target) shown = target;
    countEl.textContent = String(Math.floor(shown)).padStart(3, '0');
    loader.style.setProperty('--p', (shown / 100).toFixed(3));
    if (shown >= 100) {
      clearInterval(wordTimer);
      gsap.to(loader, { yPercent: -100, duration: 1.1, ease: 'power4.inOut', onComplete: () => loader.remove() });
      gsap.from('.head > *', { y: -16, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.5 });
      gsap.from('[data-chapter="0"] > *', { y: 30, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, delay: 0.7 });
      gsap.from('[data-acts] a', { x: 16, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.05, delay: 1 });
      return;
    }
    requestAnimationFrame(tickLoader);
  };
  requestAnimationFrame(tickLoader);
  setTimeout(finishLoader, 3200);
}

/* ---------- the world ---------- */
let world = null;
const worldCanvas = document.querySelector('[data-world]');
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
const worldReady = hasWebGL()
  ? import('./world.js')
    .then(({ createWorld }) => createWorld({ canvas: worldCanvas, reduceMotion, logoSrc: '/assets/brand/logo-lockup.webp' }))
    .then((w) => { world = w; if (dev) window.__lw.world = w; applyPending(); })
    .catch((err) => { console.warn('3D world unavailable, showing the static version.', err); noWorld(); })
    .finally(finishLoader)
  : (noWorld(), finishLoader(), Promise.resolve());
function noWorld() {
  worldCanvas.remove();
  document.querySelector('[data-world-fallback]').hidden = false;
  document.documentElement.classList.add('no-world');
}
// The scroll triggers may fire before the world exists; remember the last ask.
const pending = { chapter: 0, scatter: 0, shape: null, opacity: 0, tint: null, focus: 'center' };
function applyPending() {
  world.setChapter(pending.chapter);
  world.setScatter(pending.scatter);
  if (pending.shape) world.setShape(pending.shape, { duration: 0 });
  world.setParticleOpacity(pending.opacity);
  world.setTint(pending.tint);
  world.setFocus(pending.focus);
}
const W = {
  chapter: (c) => { pending.chapter = c; world?.setChapter(c); },
  scatter: (v) => { pending.scatter = v; world?.setScatter(v); },
  shape: (s, o) => { pending.shape = s; world?.setShape(s, o); },
  opacity: (v) => { pending.opacity = v; world?.setParticleOpacity(v); },
  tint: (h) => { pending.tint = h; world?.setTint(h); },
  focus: (f) => { pending.focus = f; world?.setFocus(f); },
};
gsap.ticker.add(() => { world?.setVelocity(velocity); velocity *= 0.9; });

/* ---------- ACT I: arrival ---------- */
const chapters = [...document.querySelectorAll('[data-chapter]')];
const dots = [...document.querySelectorAll('.progress li')];
const cue = document.querySelector('.hero-cue');
const hint = document.querySelector('[data-hint]');
const LAST = chapters.length - 1;
let currentChapter = -1;
function onJourney(progress) {
  const c = Math.min(LAST, progress * (LAST + 0.7));
  chapters.forEach((el, i) => {
    // each chapter holds fully readable for a while, then crossfades
    const o = Math.max(0, 1 - Math.max(0, Math.abs(c - i) - 0.22) * 3.2);
    el.style.opacity = o.toFixed(3);
    el.style.transform = reduceMotion ? '' : `translateY(${((c - i) * -32).toFixed(1)}px)`;
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  });
  const active = Math.round(c);
  if (active !== currentChapter) {
    currentChapter = active;
    chapters.forEach((el, i) => el.classList.toggle('is-active', i === active));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    W.chapter(active);
  }
  cue.style.opacity = String(Math.max(0, 1 - progress * 10));
  // the last stretch: the pile scatters and the particle field fades in behind it
  const tail = Math.max(0, (progress - 0.82) / 0.18);
  W.scatter(tail);
  W.opacity(Math.min(1, tail * 1.4));
}
ScrollTrigger.create({
  trigger: '[data-journey]', start: 'top top', end: 'bottom bottom',
  // Not guarded: when a jump lands far below, this must still run at progress 1 so the pile scatters and sleeps.
  onUpdate: (s) => onJourney(s.progress), onRefresh: (s) => onJourney(s.progress),
});
onJourney(0);
// the hint goes once you've tried it
['pointerdown', 'pointermove'].forEach((ev) => window.addEventListener(ev, function once(e) {
  if (e.type === 'pointermove' && e.pointerType !== 'mouse') return;
  setTimeout(() => hint.classList.add('is-gone'), 2500);
  window.removeEventListener('pointerdown', once); window.removeEventListener('pointermove', once);
}, { passive: true }));

/* ---------- ACT II: the wolf assembles under scroll ---------- */
{
  const sec = document.querySelector('[data-wolf]');
  let scrubbing = false;
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom bottom',
    onEnter: () => { world?.setScrub('cloud', 'wolf'); scrubbing = true; W.focus('side'); },
    onEnterBack: () => { W.shape('wolf', { duration: 1.4 }); scrubbing = false; W.focus('side'); },
    onLeave: () => { scrubbing = false; },
    onUpdate: (s) => {
      if (!world) return;
      const p = Math.min(1, s.progress / 0.6);
      if (!scrubbing && s.direction < 0 && p < 0.85) { world.setScrub('cloud', 'wolf'); scrubbing = true; }
      if (scrubbing) { world.setMix(p); pending.shape = 'wolf'; }
      W.opacity(1);
    },
  });
}

/* ---------- any section with data-shape asks the field for that shape ---------- */
document.querySelectorAll('[data-shape]:not(.stage)').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 60%', end: 'bottom 40%',
    onToggle: (s) => { if (s.isActive) { W.shape(sec.dataset.shape, { duration: 1.8 }); W.opacity(sec.classList.contains('cases') ? 0.8 : sec.classList.contains('manifesto') ? 0.7 : 1); W.focus('center'); } },
  });
});
// paper: the field dims to a violet dust
ScrollTrigger.create({
  trigger: '[data-theme="paper"]', start: 'top 55%', end: 'bottom 45%',
  onToggle: (s) => {
    document.body.classList.toggle('theme-paper', s.isActive);
    if (s.isActive) { W.opacity(0.22); W.tint('#5B0FA8'); } else { W.tint(null); W.opacity(1); }
  },
});

/* ---------- PROCESS: five stages, pinned ---------- */
{
  const sec = document.querySelector('[data-process]');
  const stages = [...sec.querySelectorAll('[data-stage]')];
  const sdots = [...sec.querySelectorAll('.stage-dots li')];
  let cur = -1;
  const onProcess = (p) => {
    const c = Math.min(stages.length - 1, p * (stages.length + 0.3) - 0.15);
    stages.forEach((el, i) => {
      const o = Math.max(0, 1 - Math.max(0, Math.abs(c - i) - 0.22) * 3.2);
      el.style.opacity = o.toFixed(3);
      el.style.transform = reduceMotion ? '' : `translateY(${((c - i) * -28).toFixed(1)}px)`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
    const active = Math.max(0, Math.round(c));
    if (active !== cur) {
      cur = active;
      stages.forEach((el, i) => el.classList.toggle('is-active', i === active));
      sdots.forEach((d, i) => d.classList.toggle('is-active', i === active));
      W.shape(stages[active].dataset.shape, { duration: 1.4 });
      W.opacity(1);
      W.focus('side');
    }
  };
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    // Only while pinned: on a long jump this fires once more as the section leaves, after the next act has already spoken.
    onUpdate: (s) => { if (s.isActive) onProcess(s.progress); },
    onToggle: (s) => { if (s.isActive) onProcess(s.progress); else cur = -1; },
  });
  onProcess(0);
}

/* ---------- chapter nav ---------- */
const actLinks = [...document.querySelectorAll('[data-act-link]')];
document.querySelectorAll('[data-act]').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: (s) => { if (s.isActive) actLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.actLink === sec.dataset.act)); },
  });
});

/* ---------- the header floats once you've scrolled ---------- */
const head = document.querySelector('.head');
ScrollTrigger.create({ start: 80, end: 'max', onToggle: (s) => head.classList.toggle('is-scrolled', s.isActive) });

/* ---------- menu ---------- */
const menuBtn = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
  if (open) menu.querySelector('a').focus();
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('[data-menu], [data-menu-toggle]')) setMenu(false); });

/* ---------- case hover recolours the world ---------- */
const CASE_TINT = { 'marbl-hearth': '#D1672C', koki: '#E3001B', illuminer: '#0052E0', greyview: '#2E9E5B', wyfix: '#FE5F04', packforge: '#F47B20' };
initProjects();
initCaseStudies();
{
  const list = document.querySelector('[data-case-list]');
  list.addEventListener('pointerover', (e) => {
    const row = e.target.closest('[data-case]');
    if (row) { W.tint(CASE_TINT[row.dataset.case] || null); world?.pulse(0.35); }
  });
  list.addEventListener('pointerleave', () => W.tint(null));
}

initSignup();
initFx({ gsap, ScrollTrigger, lenis, reduceMotion });
document.querySelector('[data-year]').textContent = new Date().getFullYear();
worldReady.then(() => ScrollTrigger.refresh());
