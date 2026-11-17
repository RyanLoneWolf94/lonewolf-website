import * as THREE from 'three';

/*
 * The particle field.
 *
 * One THREE.Points with a custom shader. Every particle carries two target
 * positions (A and B) and two colours; a single uniform morphs between them,
 * staggered per particle so a shape change reads as a swarm, not a slide.
 * The vertex shader also adds idle drift, scroll turbulence, and a cursor
 * force that repels (or, while the mouse is held, attracts).
 *
 * Shapes are plain Float32Arrays built in generateShapes(). The wolf is the
 * real logo: its pixels are sampled from the lockup image, colours included.
 */

const VERT = /* glsl */ `
attribute vec3 aPosA;
attribute vec3 aPosB;
attribute vec3 aColA;
attribute vec3 aColB;
attribute float aRand;
uniform float uMix, uTime, uSize, uDpr, uTurb, uHold, uPointerR, uPointerF;
uniform vec3 uPointer;
uniform vec3 uTint;
uniform float uTintMix;
varying vec3 vColor;
varying float vFade;

void main() {
  float m = clamp(uMix * 1.35 - aRand * 0.35, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 p = mix(aPosA, aPosB, m);

  // a swoop while travelling between shapes
  float arc = sin(m * 3.14159);
  p += vec3(sin(aRand * 6.283) * 1.4, 0.6 + aRand, cos(aRand * 6.283) * 1.4) * arc;

  // idle drift, amplified by scroll turbulence
  float t = uTime * 0.5 + aRand * 6.283;
  p += vec3(sin(t * 1.1), cos(t * 0.9), sin(t * 0.7)) * (0.045 + uTurb * 0.7) * (0.5 + aRand);

  // the cursor: a push, or a pull while held
  vec3 d = p - uPointer;
  d.z *= 0.35;
  float dist = length(d);
  float k = smoothstep(uPointerR, 0.0, dist);
  p += normalize(d + 0.0001) * k * uPointerF * (1.0 - uHold * 2.2);

  vColor = mix(mix(aColA, aColB, m), uTint, uTintMix);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * uDpr * (0.55 + aRand * 0.9) * (14.0 / -mv.z);
  vFade = 1.0 - smoothstep(18.0, 40.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vFade;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.14, d);
  float core = smoothstep(0.22, 0.0, d);
  gl_FragColor = vec4(vColor + core * 0.3, a * uOpacity * vFade);
}`;

// ---------- brand colours for particles (sRGB, written straight to the canvas) ----------
const PALETTE = ['#FFB300', '#FF8A1A', '#FF6B00', '#E2471E', '#B0274A', '#8A4DFF', '#C9B2F2'];
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const PAL = PALETTE.map(hexToRgb);

function brandColors(n, rand) {
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rgb = PAL[Math.floor(rand() * PAL.length)];
    c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2];
  }
  return c;
}

export function createParticles({ count, dpr, reduceMotion }) {
  const geo = new THREE.BufferGeometry();
  const zero = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) rand[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(zero, 3)); // unused, keeps three happy
  geo.setAttribute('aPosA', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aPosB', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aColA', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aColB', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uMix: { value: 1 },
      uTime: { value: 0 },
      uSize: { value: 1.6 },
      uDpr: { value: dpr },
      uTurb: { value: 0 },
      uHold: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 0) },
      uPointerR: { value: 2.2 },
      uPointerF: { value: 0.9 },
      uTint: { value: new THREE.Color('#FF6B00') },
      uTintMix: { value: 0 },
      uOpacity: { value: 0 },
    },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 1;

  const u = mat.uniforms;
  const targets = { opacity: 0, tintMix: 0, turb: 0, hold: 0 };
  let scrubbing = false;

  function writeCurrentIntoA() {
    // Freeze whatever is on screen as the new start, so a mid-morph change doesn't jump.
    const A = geo.attributes.aPosA.array, B = geo.attributes.aPosB.array;
    const CA = geo.attributes.aColA.array, CB = geo.attributes.aColB.array;
    const mixv = u.uMix.value;
    for (let i = 0; i < count; i++) {
      let m = Math.min(1, Math.max(0, mixv * 1.35 - rand[i] * 0.35));
      m = m * m * (3 - 2 * m);
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        A[j] = A[j] + (B[j] - A[j]) * m;
        CA[j] = CA[j] + (CB[j] - CA[j]) * m;
      }
    }
    geo.attributes.aPosA.needsUpdate = true;
    geo.attributes.aColA.needsUpdate = true;
  }

  function setTargetB(shape) {
    geo.attributes.aPosB.array.set(shape.positions);
    geo.attributes.aColB.array.set(shape.colors);
    geo.attributes.aPosB.needsUpdate = true;
    geo.attributes.aColB.needsUpdate = true;
  }

  let current = null;
  const api = {
    points,
    uniforms: u,
    /** Morph to a shape over `duration` seconds (0 jumps). */
    setShape(shape, { duration = 1.6 } = {}) {
      if (!shape || shape === current) return;
      current = shape;
      scrubbing = false;
      writeCurrentIntoA();
      setTargetB(shape);
      u.uMix.value = 0;
      if (reduceMotion || duration === 0) { u.uMix.value = 1; return; }
      morph.from = 0; morph.to = 1; morph.t = 0; morph.dur = duration;
    },
    /** Set A and B explicitly so scroll can drive the mix. */
    setScrub(fromShape, toShape) {
      current = toShape;
      scrubbing = true;
      geo.attributes.aPosA.array.set(fromShape.positions);
      geo.attributes.aColA.array.set(fromShape.colors);
      geo.attributes.aPosA.needsUpdate = true;
      geo.attributes.aColA.needsUpdate = true;
      setTargetB(toShape);
      morph.dur = 0;
    },
    setMix(v) { if (scrubbing) u.uMix.value = reduceMotion ? (v > 0.5 ? 1 : 0) : v; },
    setPointer(x, y, z = 0) { u.uPointer.value.set(x, y, z); },
    setHold(on) { targets.hold = on ? 1 : 0; },
    setTurb(v) { targets.turb = v; },
    pulse(strength = 0.6) { u.uTurb.value = Math.max(u.uTurb.value, strength); },
    setOpacity(v) { targets.opacity = v; },
    setTint(hex) {
      if (!hex) { targets.tintMix = 0; return; }
      u.uTint.value.set(hex);
      targets.tintMix = 0.85;
    },
    update(dt, time) {
      u.uTime.value = time;
      if (morph.dur > 0) {
        morph.t = Math.min(morph.dur, morph.t + dt);
        u.uMix.value = morph.from + (morph.to - morph.from) * (morph.t / morph.dur);
        if (morph.t >= morph.dur) morph.dur = 0;
      }
      const k = 1 - Math.pow(0.02, dt);
      u.uOpacity.value += (targets.opacity - u.uOpacity.value) * k;
      u.uTintMix.value += (targets.tintMix - u.uTintMix.value) * k * 0.6;
      u.uHold.value += (targets.hold - u.uHold.value) * k;
      u.uTurb.value += (targets.turb - u.uTurb.value) * k * 0.5;
    },
  };
  const morph = { from: 0, to: 1, t: 0, dur: 0 };
  return api;
}

/* =====================================================================
   Shape generators. Each returns { positions, colors } of length count.
   ===================================================================== */

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shape = (positions, colors) => ({ positions, colors });

function cloud(n, rand) {
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 7.5 * Math.cbrt(rand());
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    p[i * 3] = r * Math.sin(ph) * Math.cos(th);
    p[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    p[i * 3 + 2] = r * Math.cos(ph) * 0.5;
  }
  return shape(p, brandColors(n, rand));
}

function sphere(n, rand, R = 3.4) {
  const p = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const jit = 1 + (rand() - 0.5) * 0.06;
    p[i * 3] = Math.cos(th) * r * R * jit;
    p[i * 3 + 1] = y * R * jit;
    p[i * 3 + 2] = Math.sin(th) * r * R * jit;
  }
  return shape(p, brandColors(n, rand));
}

// Points scattered along a polyline, with thickness.
function alongPath(n, rand, pts, thick = 0.12, zspread = 0.4) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push({ a: pts[i - 1], b: pts[i], L });
    total += L;
  }
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let d = rand() * total;
    let s = segs[0];
    for (const seg of segs) { if (d <= seg.L) { s = seg; break; } d -= seg.L; }
    const t = d / s.L;
    const nx = -(s.b[1] - s.a[1]) / s.L, ny = (s.b[0] - s.a[0]) / s.L;
    const off = (rand() - 0.5) * 2 * thick;
    p[i * 3] = s.a[0] + (s.b[0] - s.a[0]) * t + nx * off;
    p[i * 3 + 1] = s.a[1] + (s.b[1] - s.a[1]) * t + ny * off;
    p[i * 3 + 2] = (rand() - 0.5) * zspread;
  }
  return p;
}

function wave(n, rand) {
  const pts = [];
  for (let x = -5.5; x <= 5.5; x += 0.08) pts.push([x, Math.sin(x * 1.6) * 1.5 * Math.exp(-(x * x) / 24)]);
  return shape(alongPath(n, rand, pts, 0.14), brandColors(n, rand));
}

function spiral(n, rand) {
  const pts = [];
  for (let t = 0; t <= Math.PI * 6.5; t += 0.05) { const r = 0.19 * t; pts.push([r * Math.cos(t), r * Math.sin(t)]); }
  return shape(alongPath(n, rand, pts, 0.13, 1.2), brandColors(n, rand));
}

function forms(n, rand) {
  const circle = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) circle.push([-3.2 + Math.cos(a) * 1.5, 0.3 + Math.sin(a) * 1.5]);
  const square = [[-1.4, -1.6], [1.4, -1.6], [1.4, 1.2], [-1.4, 1.2], [-1.4, -1.6]];
  const tri = [[2.2, -1.6], [5.2, -1.6], [3.7, 1.4], [2.2, -1.6]];
  const per = Math.floor(n / 3);
  const p = new Float32Array(n * 3);
  p.set(alongPath(per, rand, circle, 0.13), 0);
  p.set(alongPath(per, rand, square, 0.13), per * 3);
  p.set(alongPath(n - per * 2, rand, tri, 0.13), per * 6);
  return shape(p, brandColors(n, rand));
}

function growth(n, rand) {
  const line = [[-5.2, -2.6], [-2.6, -1.1], [-0.9, -1.9], [1.5, 0.5], [3.3, 0.1], [5.2, 2.6]];
  const head = [[3.9, 2.7], [5.2, 2.6], [5.1, 1.3]];
  const p = new Float32Array(n * 3);
  const a = Math.floor(n * 0.86);
  p.set(alongPath(a, rand, line, 0.14), 0);
  p.set(alongPath(n - a, rand, head, 0.14), a * 3);
  return shape(p, brandColors(n, rand));
}

function portal(n, rand, R = 4.2, r = 0.55) {
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2, v = rand() * Math.PI * 2;
    const rr = r * (0.4 + rand() * 0.6);
    const x = (R + rr * Math.cos(v)) * Math.cos(u);
    const y = (R + rr * Math.cos(v)) * Math.sin(u);
    const z = rr * Math.sin(v);
    // tilt the ring back a little
    p[i * 3] = x;
    p[i * 3 + 1] = y * 0.86 + z * 0.5;
    p[i * 3 + 2] = -y * 0.5 + z * 0.86;
  }
  return shape(p, brandColors(n, rand));
}

// Sample a string rendered on a canvas.
function text(n, rand, str, { worldWidth = 11, weight = 700 } = {}) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = `${weight} 300px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, 600, 210);
  return shape(sampleCanvas(n, rand, c, worldWidth, (x, y) => true), brandColors(n, rand));
}

function sampleCanvas(n, rand, canvas, worldWidth, accept, colorsOut) {
  const g = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const data = g.getImageData(0, 0, W, H).data;
  const cand = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4;
    if (data[i + 3] > 110 && accept(x, y)) cand.push(i);
  }
  const p = new Float32Array(n * 3);
  const scale = worldWidth / W;
  for (let k = 0; k < n; k++) {
    const i = cand[Math.floor(rand() * cand.length)];
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    p[k * 3] = (px - W / 2) * scale + (rand() - 0.5) * scale * 2;
    p[k * 3 + 1] = -(py - H / 2) * scale + (rand() - 0.5) * scale * 2;
    p[k * 3 + 2] = (rand() - 0.5) * 0.5;
    if (colorsOut) { colorsOut[k * 3] = data[i] / 255; colorsOut[k * 3 + 1] = data[i + 1] / 255; colorsOut[k * 3 + 2] = data[i + 2] / 255; }
  }
  return p;
}

// The wolf: sampled from the logo lockup, mark region only, colours from the pixels.
async function wolf(n, rand, src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  const W = 1000, H = Math.round(1000 * img.naturalHeight / img.naturalWidth);
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(img, 0, 0, W, H);
  const colors = new Float32Array(n * 3);
  // same clip as the header mark: full height for the left 26.5%, below the wordmark out to 43%
  const accept = (x, y) => x < W * 0.265 || (x < W * 0.43 && y > H * 0.627);
  const positions = sampleCanvas(n, rand, c, 19, accept, colors);
  // recentre on the mark (it sits at the left of the lockup)
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += positions[i * 3]; sy += positions[i * 3 + 1]; }
  sx /= n; sy /= n;
  for (let i = 0; i < n; i++) { positions[i * 3] -= sx; positions[i * 3 + 1] -= sy - 0.2; }
  // The logo's deep purples vanish against the night background: lift the dark pixels toward lilac.
  const lilac = hexToRgb('#B48CFF');
  for (let i = 0; i < n; i++) {
    const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const k = lum < 0.4 ? 0.65 : 0.15;
    colors[i * 3] = r + (lilac[0] - r) * k;
    colors[i * 3 + 1] = g + (lilac[1] - g) * k;
    colors[i * 3 + 2] = b + (lilac[2] - b) * k;
  }
  return shape(positions, colors);
}

export async function generateShapes(count, { logoSrc } = {}) {
  const rand = mulberry32(2026);
  const shapes = {
    cloud: cloud(count, rand),
    sphere: sphere(count, rand),
    wave: wave(count, rand),
    spiral: spiral(count, rand),
    forms: forms(count, rand),
    code: text(count, rand, '</>', { worldWidth: 9 }),
    growth: growth(count, rand),
    portal: portal(count, rand),
    pack: text(count, rand, 'PACK', { worldWidth: 12 }),
  };
  try {
    shapes.wolf = await wolf(count, rand, logoSrc);
  } catch (err) {
    console.warn('Could not sample the logo for the particle wolf, using the sphere.', err);
    shapes.wolf = shapes.sphere;
  }
  return shapes;
}
