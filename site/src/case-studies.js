import { cases } from './cases.js';

const DIR = (c) => `/assets/cases/${c.id}/`;
const FALLBACK = ['#FF6B00', '#5B0FA8', '#FFB300', '#140824', '#F4EFFB'];

/* A case's cover: its real image, or until there is one, a composition of
   its own brand colours with the name set over it. */
function cover(c, cls, { eager = false } = {}) {
  if (c.cover) {
    const img = new Image();
    img.src = DIR(c) + c.cover;
    img.alt = `${c.title}, cover image`;
    img.decoding = 'async';
    if (!eager) img.loading = 'lazy';
    return el('span', `${cls} has-image`, [img]);
  }
  const colors = c.palette || FALLBACK;
  const art = el('span', `${cls} is-drawn`, [el('span', 'drawn-name', c.title)]);
  art.style.setProperty('--a', colors[0]);
  art.style.setProperty('--b', colors[1 % colors.length]);
  art.style.setProperty('--c', colors[2 % colors.length]);
  art.style.setProperty('--d', colors[3 % colors.length]);
  art.setAttribute('role', 'img');
  art.setAttribute('aria-label', `${c.title}, colour study`);
  return art;
}

// Small DOM helper: el('p', 'class', 'text') or el('div', 'class', [children])
function el(tag, cls, content) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (Array.isArray(content)) n.append(...content.filter(Boolean));
  else if (content != null) n.textContent = content;
  return n;
}

function swatches(colors, cls) {
  return el('ul', cls, colors.map((c) => {
    const li = el('li');
    li.style.setProperty('--c', c);
    li.title = c;
    return li;
  }));
}

function chips(items, cls) {
  return el('ul', cls, items.map((t) => el('li', null, t)));
}

function renderRow(c) {
  const btn = el('button', 'case-row', [
    cover(c, 'case-thumb'),
    el('span', 'case-title', c.title),
    el('span', 'case-summary', c.summary),
    el('span', 'case-type micro', c.type),
    c.stats
      ? el('span', 'case-stat', [el('strong', null, c.stats[0].value), el('span', null, c.stats[0].label)])
      : c.palette
        ? swatches(c.palette, 'case-swatches')
        : chips(c.stack.slice(0, 3), 'case-chips micro'),
  ]);
  btn.type = 'button';
  btn.dataset.case = c.id;
  return el('li', null, [btn]);
}

function renderSheet(c) {
  const facts = [
    ['Sector', c.sector],
    ['My role', c.role],
    ['Status', c.status],
  ];
  const factList = el('dl', 'cs-facts', facts.flatMap(([k, v]) => [el('dt', 'micro', k), el('dd', null, v)]));
  if (c.link) {
    const a = el('a', null, c.link.label);
    a.href = c.link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    factList.append(el('dt', 'micro', 'See it'), el('dd', null, [a]));
  }

  const cta = el('a', 'btn', 'Start a project like this');
  cta.href = '#contact';
  cta.dataset.csCta = '';

  const close = el('button', 'pill cs-close', 'Close');
  close.type = 'button';
  close.dataset.csClose = '';

  return [
    el('header', 'cs-head', [
      el('div', null, [el('p', 'micro cs-type', c.type), el('h2', 'cs-title', c.title)]),
      close,
    ]),
    cover(c, 'cs-cover', { eager: true }),
    el('p', 'cs-summary', c.summary),
    factList,
    c.stats && el('ul', 'cs-stats', c.stats.map((s) => el('li', null, [el('strong', null, s.value), el('span', null, s.label)]))),
    c.gallery?.length && el('div', 'cs-images', c.gallery.map((src, i) => {
      const img = new Image();
      img.src = DIR(c) + src;
      img.alt = `${c.title}, image ${i + 1} of ${c.gallery.length}`;
      img.decoding = 'async';
      img.loading = 'lazy';
      return img;
    })),
    el('section', 'cs-block', [el('h3', null, 'The brief'), el('p', null, c.brief)]),
    el('section', 'cs-block', [el('h3', null, 'What I did'), el('ul', 'cs-did', c.did.map((d) => el('li', null, d)))]),
    el('section', 'cs-block', [el('h3', null, 'What changed'), el('p', null, c.outcome)]),
    c.palette && el('section', 'cs-block', [el('h3', null, 'Palette'), swatches(c.palette, 'cs-swatches')]),
    c.stack && el('section', 'cs-block', [el('h3', null, 'Built with'), chips(c.stack, 'cs-chips micro')]),
    el('footer', 'cs-foot', [cta]),
  ];
}

let openCaseImpl = () => false;

// Lets other parts of the page (the work grid) open a case study by id.
export function openCase(id, from) { return openCaseImpl(id, from); }

export function initCaseStudies() {
  const list = document.querySelector('[data-case-list]');
  const sheet = document.querySelector('[data-case-sheet]');
  const body = sheet.querySelector('[data-cs]');
  let opener = null;

  list.append(...cases.map(renderRow));

  openCaseImpl = (id, from) => {
    const c = cases.find((x) => x.id === id);
    if (!c) return false;
    opener = from || null;
    body.replaceChildren(...renderSheet(c).filter(Boolean));
    body.querySelector('.cs-title').id = 'cs-title';
    sheet.showModal();
    sheet.scrollTop = 0;
    return true;
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-case]');
    if (btn) { peek?.classList.remove('is-on'); openCaseImpl(btn.dataset.case, btn); }
  });

  // A glimpse of the case follows the cursor across the list (fine pointers only).
  const peek = document.querySelector('[data-case-peek]');
  if (peek && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let x = 0, y = 0, px = 0, py = 0, raf = 0, current = null;
    const follow = () => {
      px += (x - px) * 0.16; py += (y - py) * 0.16;
      peek.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      raf = Math.abs(x - px) + Math.abs(y - py) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    list.addEventListener('pointermove', (e) => {
      x = e.clientX + 28; y = e.clientY - peek.offsetHeight / 2;
      if (!raf) raf = requestAnimationFrame(follow);
    });
    list.querySelectorAll('[data-case]').forEach((btn) => {
      btn.addEventListener('pointerenter', (e) => {
        if (current !== btn.dataset.case) {
          current = btn.dataset.case;
          peek.replaceChildren(cover(cases.find((c) => c.id === current), 'peek-media', { eager: true }));
        }
        if (!peek.classList.contains('is-on')) { px = x = e.clientX + 28; py = y = e.clientY - peek.offsetHeight / 2; }
        peek.classList.add('is-on');
      });
    });
    list.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
  }

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('[data-cs-close]')) sheet.close();
    if (e.target.closest('[data-cs-cta]')) { opener = null; sheet.close(); }
  });
  sheet.addEventListener('close', () => opener?.focus());
}
