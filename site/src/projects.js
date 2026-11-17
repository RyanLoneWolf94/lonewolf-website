import { openCase } from './case-studies.js';

const W = '/assets/work/';

const projects = {
  koki: {
    title: 'Koki Delivery',
    kind: 'Brand, app, launch campaign',
    desc: 'A last mile delivery platform that needed a name people would remember and an app they would trust with their money. I built the identity around a single motion mark, designed and shipped the cross platform app, then ran the launch around one promise: select, pay and receive.',
    images: ['koki-billboard.webp', 'koki-logo-suite.webp', 'koki-app-ad.webp', 'koki-03.webp'],
  },
  greenwortts: {
    title: 'GreenWortts Agritech',
    kind: 'Ecommerce site, social ads',
    desc: 'An agritech business in Zimbabwe selling greenhouse builds, agronomy services and farm inputs. I designed and built the online shop and an ad series that explains technical services to farmers in plain terms.',
    images: ['greenwortts-site.webp', 'greenwortts-ads.webp', 'greenwortts-agronomy.webp', 'greenwortts-greenhouse.webp'],
  },
  vibrant: {
    title: 'Vibrant Investors',
    kind: 'Website design and build',
    desc: 'An investment firm working across three continents. The site leads with people and track record, and turns dense information about their expertise into something a first time visitor can scan in a minute.',
    images: ['vibrant-investors.webp', 'vibrant-investors-2.webp'],
  },
  tinygiants: {
    title: 'Tiny Giants Academy',
    kind: 'Brand identity, merchandise',
    desc: 'A school identity that works for children and reassures parents. A tree of overlapping colour that reads as playful from a distance and grows from a pen nib up close, carried across stationery, uniforms and bags.',
    images: ['tiny-giants-suite.webp', 'tiny-giants-01.webp'],
  },
  neza: {
    title: 'NezaBuy',
    kind: 'Mini program UI, product campaigns',
    desc: 'An online store for shoppers in China, sold through a WeChat mini program. I designed the shopping experience, including seasonal themes, and the product ads that drive people to it.',
    images: ['nezabuy-miniprogram.webp', 'neza-masala-tea.webp', 'neza-cashews.webp', 'neza-iphone-ad.webp'],
  },
  shalotex: {
    title: 'Shalotex Kitchen & Home',
    kind: 'Product ad series',
    desc: 'A Harare home appliance store. A run of product ads built to stop the scroll and send people to the shop, each one ending with the address and a WhatsApp number.',
    images: ['shalotex-heaters.webp', 'shalotex-blender.webp', 'shalotex-iron.webp', 'shalotex-bottle.webp'],
  },
  panther: {
    title: 'Panther Care',
    kind: 'Social media content',
    desc: 'A consistent social presence: posts designed as a set so the brand is recognisable before anyone reads the caption.',
    images: ['panther-care-2.webp', 'panther-care-1.webp'],
  },
  haku: {
    title: 'Haku Cafe & Arepa',
    kind: 'Logo, packaging',
    desc: 'A cafe mark with a steaming cup drawn in one line, and packaging that carries it from the counter into the street.',
    images: ['haku-cafe.webp'],
  },
};

export function initProjects() {
  const list = document.querySelector('[data-work-list]');
  const peek = document.querySelector('[data-peek]');
  const peekImg = peek?.querySelector('img');
  const lb = document.querySelector('[data-lightbox]');
  const lbTitle = lb.querySelector('[data-lb-title]');
  const lbKind = lb.querySelector('[data-lb-kind]');
  const lbDesc = lb.querySelector('[data-lb-desc]');
  const lbImages = lb.querySelector('[data-lb-images]');
  let opener = null;

  // Desktop: a preview follows the cursor over the list. Answers the pointer, so it's not ambient motion.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && peek) {
    let x = 0, y = 0, px = 0, py = 0, raf = 0;
    const follow = () => {
      px += (x - px) * 0.18; py += (y - py) * 0.18;
      peek.style.transform = `translate(${px}px, ${py}px)`;
      raf = Math.abs(x - px) + Math.abs(y - py) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    list.addEventListener('pointermove', (e) => {
      x = e.clientX + 24; y = e.clientY - 120;
      if (!raf) raf = requestAnimationFrame(follow);
    });
    list.querySelectorAll('button').forEach((b) => {
      b.addEventListener('pointerenter', () => {
        peekImg.src = b.querySelector('img').src;
        peek.classList.add('is-on');
      });
    });
    list.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-project]');
    // Projects with a full write-up open the case study instead of the gallery.
    if (btn?.dataset.caseLink && openCase(btn.dataset.caseLink, btn)) return;
    const p = btn && projects[btn.dataset.project];
    if (!p) return;
    opener = btn;
    peek?.classList.remove('is-on');
    lbTitle.textContent = p.title;
    lbKind.textContent = p.kind;
    lbDesc.textContent = p.desc;
    lbImages.replaceChildren(...p.images.map((src, i) => {
      const img = new Image();
      img.src = W + src;
      img.alt = `${p.title}, image ${i + 1} of ${p.images.length}`;
      img.decoding = 'async';
      img.addEventListener('load', () => { if (img.naturalWidth / img.naturalHeight > 1.3) img.classList.add('is-wide'); });
      return img;
    }));
    lb.showModal();
    lb.scrollTop = 0;
  });
  lb.querySelector('[data-lb-close]').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => opener?.focus());
}
