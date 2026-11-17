import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ICONS, buildIconGeometries } from './icons.js';
import { createParticles, generateShapes } from './particles.js';

/*
 * The world: one WebGL scene fixed behind the whole page.
 *
 *   pile       the studio's toolkit icons (Act I). Springs, separation, a
 *              cursor shove, and a hold-to-gather pull. They scatter and hide
 *              once the opening chapter has scrolled away.
 *   particles  the field that forms the wolf, the sphere, the process glyphs
 *              and the contact portal (see particles.js).
 *   lamp       a point light that rides the cursor, so icons are lit from
 *              wherever the mouse is.
 *   rig        everything hangs off this group, which leans with the mouse.
 *
 * Scroll never moves the camera through space; instead the content of the
 * scene changes under a steady camera. That keeps the DOM copy and the 3D
 * perfectly in step, since both are driven by the same scroll triggers.
 */

const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emphasisFor = (chapter, group) => (chapter === 0 ? 1 : group === chapter ? 1.32 : 0.62);

export async function createWorld({ canvas, reduceMotion, logoSrc }) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const PER_TYPE = coarse ? 3 : 5;
  const PARTICLES = coarse ? 9000 : 22000;
  const rand = mulberry32(1108);

  // ---------- renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const dprLevels = [Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2), 1.25, 1, 0.75].filter((v, i, a) => i === 0 || v < a[0]);
  let dprIndex = 0;
  renderer.setPixelRatio(dprLevels[0]);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.AmbientLight('#FFFFFF', 0.3));
  const key = new THREE.DirectionalLight('#FFF4E8', 1.6);
  key.position.set(3, 5, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8A55FF', 1.8);
  rim.position.set(-6, -3, -4);
  scene.add(rim);
  // the cursor lamp
  const lamp = new THREE.PointLight('#FF8A1A', coarse ? 0 : 60, 14, 2);
  lamp.position.set(0, 0, 3);
  scene.add(lamp);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 15);

  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- Act I: the icon pile ----------
  const pile = new THREE.Group();
  rig.add(pile);
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  const geometries = buildIconGeometries(coarse ? 'low' : 'high');
  const meshes = geometries.map((geo, t) => {
    const m = new THREE.InstancedMesh(geo, material, PER_TYPE);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < PER_TYPE; k++) m.setColorAt(k, new THREE.Color(ICONS[t].tints[k % ICONS[t].tints.length]));
    m.instanceColor.needsUpdate = true;
    m.frustumCulled = false;
    pile.add(m);
    return m;
  });

  const COUNT = ICONS.length * PER_TYPE;
  const type = new Uint8Array(COUNT);
  const slot = new Uint8Array(COUNT);
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const home = new Float32Array(COUNT * 3);
  const base = new Float32Array(COUNT);
  const ang = new Float32Array(COUNT * 3);
  const angV = new Float32Array(COUNT * 3);
  const tilt = [];
  const emph = new Float32Array(ICONS.length).fill(1);
  const phase = new Float32Array(COUNT);
  const bounds = { x: 6.2, y: 3.3 };

  let n = 0;
  for (let t = 0; t < ICONS.length; t++) {
    for (let k = 0; k < PER_TYPE; k++, n++) {
      type[n] = t; slot[n] = k;
      base[n] = 0.85 + rand() * 0.35;
      phase[n] = rand() * Math.PI * 2;
      tilt.push(new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.7, (rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9)));
    }
  }
  const order = [...Array(COUNT).keys()].sort(() => rand() - 0.5);
  let portrait = false;

  // Homes keep clear of where the chapter copy sits.
  const inKeepOut = (x, y) => {
    const sx = portrait ? -y / bounds.y : x / bounds.x;
    const sy = portrait ? x / bounds.x : y / bounds.y;
    return portrait ? sy < -0.3 : (sx < -0.12 && sy < 0.1);
  };
  function seedHomes() {
    for (const i of order) {
      let x, y, tries = 0;
      do {
        const r = Math.pow(rand(), 0.6), a = rand() * Math.PI * 2;
        x = Math.cos(a) * r * bounds.x; y = Math.sin(a) * r * bounds.y; tries++;
      } while (tries < 30 && inKeepOut(x, y));
      home[i * 3] = x; home[i * 3 + 1] = y; home[i * 3 + 2] = (rand() - 0.5) * 2.6;
    }
    pos.set(home);
    for (let k = 0; k < 50; k++) separate(1);
    home.set(pos);
  }
  const radius = (i) => base[i] * emph[type[i]] * 0.72;
  function separate(strength) {
    for (let i = 0; i < COUNT; i++) {
      const ri = radius(i);
      for (let j = i + 1; j < COUNT; j++) {
        const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = (pos[j * 3 + 2] - pos[i * 3 + 2]) * 0.6;
        const min = ri + radius(j);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5 * strength;
        pos[i * 3] -= dx * push; pos[i * 3 + 1] -= dy * push; pos[i * 3 + 2] -= dz * push;
        pos[j * 3] += dx * push; pos[j * 3 + 1] += dy * push; pos[j * 3 + 2] += dz * push;
      }
    }
  }

  // ---------- particles ----------
  const particles = createParticles({ count: PARTICLES, dpr: dprLevels[0], reduceMotion });
  rig.add(particles.points);
  const shapes = await generateShapes(PARTICLES, { logoSrc });
  particles.setShape(shapes.cloud, { duration: 0 });

  // ---------- input ----------
  // the pointer starts far away, so nothing is pushed before the mouse has moved
  const pointer = { active: false, ndc: new THREE.Vector2(), world: new THREE.Vector3(999, 999, 0), prev: new THREE.Vector3(999, 999, 0), speed: 0, hold: false, burst: 0 };
  // where the particle field sits: beside the copy, or centred
  const focus = { x: 0, y: 0, tx: 0, ty: 0 };
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const state = { chapter: 0, scatter: 0, velocity: 0, t: 0, pileAlive: true, pileScale: 1 };

  function updatePointer(clientX, clientY) {
    pointer.ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(pointer.ndc, camera);
    pointer.prev.copy(pointer.world);
    ray.ray.intersectPlane(plane, pointer.world);
    rig.worldToLocal(pointer.world);
    pointer.active = true;
  }
  window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    updatePointer(e.clientX, e.clientY);
    // holding anywhere that isn't a control gathers the world toward the cursor
    if (!e.target.closest('a, button, input, select, label, dialog, .brief-wrap, .menu')) { pointer.hold = true; particles.setHold(true); }
  }, { passive: true });
  const release = () => {
    if (pointer.hold) { pointer.burst = 1; particles.pulse(0.9); }
    pointer.hold = false; particles.setHold(false);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  document.addEventListener('pointerleave', () => { pointer.active = false; });

  // ---------- simulation ----------
  function step(dt) {
    state.t += dt;
    for (let k = 0; k < ICONS.length; k++) emph[k] += (emphasisFor(state.chapter, ICONS[k].group) - emph[k]) * Math.min(1, dt * 3.2);

    if (coarse && !pointer.active && !reduceMotion) {
      pointer.prev.copy(pointer.world);
      pointer.world.set(Math.sin(state.t * 0.35) * bounds.x * 0.7, Math.sin(state.t * 0.53) * bounds.y * 0.6, 0);
    }
    const ghost = coarse && !pointer.active;
    const pushing = pointer.active || ghost;
    pointer.speed = Math.min(1, pointer.world.distanceTo(pointer.prev) / Math.max(dt, 1e-3) / 18);
    pointer.burst = Math.max(0, pointer.burst - dt * 2.5);

    // lamp and particle pointer follow the cursor
    lamp.position.set(pointer.world.x, pointer.world.y, 3);
    particles.setPointer(pointer.world.x, pointer.world.y, 0);
    particles.setTurb(Math.min(1, Math.abs(state.velocity) / 45) * 0.8);

    if (state.pileAlive) {
      const R = pointer.hold ? 5 : 2.2;
      const spring = 2.4, damp = Math.pow(0.04, dt), spread = 1 + state.scatter * 2.2;
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        let fx = (home[ix] * spread - pos[ix]) * spring;
        let fy = (home[ix + 1] * spread - pos[ix + 1]) * spring;
        let fz = (home[ix + 2] * spread - pos[ix + 2]) * spring;
        if (pushing) {
          const dx = pos[ix] - pointer.world.x, dy = pos[ix + 1] - pointer.world.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-3;
          if (d < R) {
            const k = (R - d) / R;
            let f = ((ghost ? 12 : 30 + pointer.speed * 60) * k * k) / d;
            if (pointer.hold) f = -26 * k / d; // gather
            if (pointer.burst > 0) f += (120 * pointer.burst * k) / d; // let go: fling
            fx += dx * f; fy += dy * f; fz += Math.abs(f) * 0.4;
            angV[ix] += -dy * k * 6 * dt * 10; angV[ix + 1] += dx * k * 6 * dt * 10; angV[ix + 2] += (dx - dy) * k * 2 * dt * 10;
          }
        }
        vel[ix] = (vel[ix] + fx * dt) * damp; vel[ix + 1] = (vel[ix + 1] + fy * dt) * damp; vel[ix + 2] = (vel[ix + 2] + fz * dt) * damp;
        pos[ix] += vel[ix] * dt; pos[ix + 1] += vel[ix + 1] * dt; pos[ix + 2] += vel[ix + 2] * dt;
        for (let a = 0; a < 3; a++) {
          const sway = reduceMotion ? 0 : Math.sin(state.t * 0.6 + phase[i] + a) * 0.07;
          angV[ix + a] += ((sway - ang[ix + a]) * 9 - angV[ix + a] * 2.6) * dt;
          ang[ix + a] += angV[ix + a] * dt;
        }
      }
      if (!pointer.hold) separate(0.5);
      writeInstances();
    }

    // the whole world leans toward the cursor
    const tx = pointer.active ? pointer.ndc.y * -0.06 : 0;
    const ty = pointer.active ? pointer.ndc.x * 0.09 : 0;
    rig.rotation.x += (tx - rig.rotation.x) * Math.min(1, dt * 2);
    rig.rotation.y += (ty - rig.rotation.y) * Math.min(1, dt * 2);
    // the particle field turns very slowly, so even a still shape breathes
    particles.points.rotation.y = reduceMotion ? 0 : Math.sin(state.t * 0.12) * 0.12;
    focus.x += (focus.tx - focus.x) * Math.min(1, dt * 2.2);
    focus.y += (focus.ty - focus.y) * Math.min(1, dt * 2.2);
    particles.points.position.set(focus.x, focus.y, 0);
    particles.update(dt, state.t);
  }

  function writeInstances() {
    const s = state.pileScale * (1 - state.scatter * 0.6);
    for (let i = 0; i < COUNT; i++) {
      tmpV.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      tmpE.set(ang[i * 3], ang[i * 3 + 1], ang[i * 3 + 2] - pile.rotation.z);
      tmpQ.setFromEuler(tmpE).multiply(tilt[i]);
      tmpS.setScalar(base[i] * emph[type[i]] * s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      meshes[type[i]].setMatrixAt(slot[i], tmpM);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  }

  // ---------- sizing ----------
  let seeded = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wasPortrait = portrait;
    portrait = camera.aspect < 0.9;
    pile.rotation.z = portrait ? Math.PI / 2 : 0;
    if (portrait !== wasPortrait || !seeded) { seedHomes(); seeded = true; }
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    const spanW = (portrait ? bounds.y : bounds.x) * 2.2, spanH = (portrait ? bounds.x : bounds.y) * 2.2;
    pile.scale.setScalar(Math.min(visW / spanW, visH / spanH) * (portrait ? 1.1 : 1));
    // particles: fit the 13-unit-wide shapes into the view
    const fit = Math.min(visW / 13.5, visH / 8.5);
    particles.points.scale.setScalar(Math.min(1, fit));
    writeInstances();
    if (!running) render();
  }

  const render = () => renderer.render(scene, camera);

  // ---------- loop ----------
  let running = false, raf = 0, last = 0;
  const perf = { frames: 0, time: 0 };
  function loop(now) {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(1 / 30, raw);
    if (raw < 0.5) {
      perf.frames += 1; perf.time += raw;
      if (perf.frames >= 45) {
        const avg = perf.time / perf.frames;
        perf.frames = 0; perf.time = 0;
        if (avg > 1 / 30 && dprIndex < dprLevels.length - 1) {
          dprIndex += 1;
          renderer.setPixelRatio(dprLevels[dprIndex]);
          particles.uniforms.uDpr.value = dprLevels[dprIndex];
          resize();
        }
      }
    }
    step(dt);
    render();
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (running || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', resize);
  resize();
  render();
  start();

  return {
    shapes,
    uniforms: particles.uniforms,
    points: particles.points,
    camera, rig, renderer,
    setChapter(c) { state.chapter = c; },
    /** 0..1: how far the opening act has scrolled away. The pile spreads, shrinks and finally sleeps. */
    setScatter(v) {
      state.scatter = Math.max(0, Math.min(1, v));
      const alive = state.scatter < 0.999;
      if (alive !== state.pileAlive) { state.pileAlive = alive; pile.visible = alive; }
    },
    setShape(name, opts) { particles.setShape(shapes[name], opts); },
    /** 'side': the field sits beside the copy (right on desktop, above it on phones). 'center': dead centre. */
    setFocus(where) {
      if (where === 'side') { focus.tx = portrait ? 0 : 2.4; focus.ty = portrait ? 1.6 : 0.2; }
      else { focus.tx = 0; focus.ty = 0; }
    },
    setScrub(from, to) { particles.setScrub(shapes[from], shapes[to]); },
    setMix(v) { particles.setMix(v); },
    setParticleOpacity(v) { particles.setOpacity(v); },
    setTint(hex) { particles.setTint(hex); },
    setVelocity(v) { state.velocity = v; },
    pulse(s) { particles.pulse(s); },
    // Dev QA: run the simulation without requestAnimationFrame.
    settle(frames = 90) { for (let i = 0; i < frames; i++) step(1 / 60); render(); },
    poke(x, y) { updatePointer(x, y); },
  };
}
