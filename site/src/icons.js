import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * The studio's toolkit as chunky 3D icons, modelled on the LoneWolf
 * illustrations: code tag, gear, light bulb, pencil, magnifier, chat bubble,
 * colour swatch fan, play button and heart.
 *
 * Each icon is a handful of primitives merged into ONE geometry, with its
 * colours baked into a vertex colour attribute. That lets every copy of an
 * icon render in a single instanced draw call while keeping its multi-colour
 * design. Icons face +Z and fit roughly inside a 1.3 unit box.
 */

const C = {
  ember: '#FF6B00', emberLight: '#FF9A45', peach: '#FFC48F', cream: '#F6E9DC',
  violet: '#5B0FA8', plum: '#8A3D7A', lilac: '#C9B2F2', night: '#2A1446',
  grey: '#9A93A6', pink: '#E2206E', white: '#FFFFFF',
};

// ---------- helpers ----------
function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const col = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function at(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = {}) {
  geo.scale(s, s, s);
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}
function extrude(shape, depth, bevel = 0.03, segs = 3) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
function poly(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
function merge(parts) {
  // Keep each part's own normals: recomputing on merged, non-indexed geometry would facet the spheres.
  const g = mergeGeometries(parts.map((p) => { p.clearGroups(); return p; }));
  g.computeBoundingSphere();
  return g;
}

// ---------- the icons ----------
function codeTag(q) {
  const lt = poly([[0.14, 0.27], [-0.16, 0], [0.14, -0.27], [0.14, -0.13], [-0.01, 0], [0.14, 0.13]]);
  const gt = poly([[-0.14, 0.27], [0.16, 0], [-0.14, -0.27], [-0.14, -0.13], [0.01, 0], [-0.14, 0.13]]);
  const slash = poly([[0.05, 0.3], [0.15, 0.3], [-0.05, -0.3], [-0.15, -0.3]]);
  return merge([
    paint(new RoundedBoxGeometry(1.35, 1.0, 0.32, q, 0.14), C.ember),
    paint(at(extrude(lt, 0.08, 0.02, 2), { x: -0.36, z: 0.19 }), C.cream),
    paint(at(extrude(slash, 0.08, 0.02, 2), { z: 0.19 }), C.cream),
    paint(at(extrude(gt, 0.08, 0.02, 2), { x: 0.36, z: 0.19 }), C.cream),
  ]);
}

function gear() {
  const teeth = 8, ro = 0.62, ri = 0.48, hole = 0.2;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = (i % 4 === 0 || i % 4 === 1) ? ro : ri;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  return merge([paint(extrude(s, 0.22, 0.04, 2), C.white)]);
}

function bulb(q) {
  const seg = q * 6;
  return merge([
    paint(at(new THREE.SphereGeometry(0.46, seg, seg), { y: 0.18 }), C.emberLight),
    paint(at(new THREE.CylinderGeometry(0.24, 0.3, 0.26, seg), { y: -0.28 }), C.emberLight),
    paint(at(new THREE.TorusGeometry(0.22, 0.055, 8, seg), { y: -0.44, rx: Math.PI / 2 }), C.violet),
    paint(at(new THREE.TorusGeometry(0.21, 0.055, 8, seg), { y: -0.54, rx: Math.PI / 2 }), C.violet),
    paint(at(new THREE.TorusGeometry(0.19, 0.055, 8, seg), { y: -0.64, rx: Math.PI / 2 }), C.violet),
    paint(at(new THREE.SphereGeometry(0.13, seg, seg / 2), { y: -0.72, s: 1 }), C.night),
    // filament, a little zigzag facing forward
    paint(at(extrude(poly([[-0.2, 0.0], [-0.1, 0.12], [0, 0.0], [0.1, 0.12], [0.2, 0], [0.2, 0.05], [0.1, 0.17], [0, 0.05], [-0.1, 0.17], [-0.2, 0.05]]), 0.04, 0.01, 1), { y: 0.14, z: 0.45 }), C.cream),
  ]);
}

function pencil(q) {
  const seg = 6; // hexagonal body reads as a pencil
  const parts = [
    paint(at(new THREE.CylinderGeometry(0.15, 0.15, 1.15, seg), {}), C.ember),
    paint(at(new THREE.CylinderGeometry(0.0, 0.15, 0.32, seg), { y: 0.735 }), C.cream),
    paint(at(new THREE.CylinderGeometry(0.0, 0.052, 0.11, seg), { y: 0.855 }), C.night),
    paint(at(new THREE.CylinderGeometry(0.155, 0.155, 0.12, q * 4), { y: -0.635 }), C.grey),
    paint(at(new THREE.CylinderGeometry(0.15, 0.15, 0.2, q * 4), { y: -0.79 }), C.violet),
  ];
  const g = merge(parts);
  g.rotateZ(-Math.PI / 4);
  return g;
}

function magnifier(q) {
  const seg = q * 6;
  return merge([
    paint(at(new THREE.TorusGeometry(0.38, 0.1, 12, seg), { x: -0.12, y: 0.12 }), C.ember),
    paint(at(new THREE.CylinderGeometry(0.31, 0.31, 0.06, seg), { x: -0.12, y: 0.12, rx: Math.PI / 2 }), C.lilac),
    paint(at(new THREE.CylinderGeometry(0.09, 0.11, 0.62, q * 4), { x: 0.36, y: -0.36, rz: Math.PI / 4 }), C.violet),
  ]);
}

function chat(q) {
  const tail = poly([[-0.42, -0.3], [-0.05, -0.3], [-0.38, -0.66]]);
  return merge([
    paint(new RoundedBoxGeometry(1.35, 0.85, 0.3, q, 0.2), C.violet),
    paint(at(extrude(tail, 0.24, 0.02, 2), {}), C.violet),
    paint(at(new THREE.SphereGeometry(0.1, q * 4, q * 3), { x: -0.32, z: 0.16 }), C.cream),
    paint(at(new THREE.SphereGeometry(0.1, q * 4, q * 3), { x: 0, z: 0.16 }), C.cream),
    paint(at(new THREE.SphereGeometry(0.1, q * 4, q * 3), { x: 0.32, z: 0.16 }), C.lilac),
  ]);
}

function swatch(q) {
  const shades = ['#FF6B00', '#FF8326', '#FFA552', '#F9C58E', '#F6DDBE'];
  const parts = shades.map((hex, i) => {
    const b = new RoundedBoxGeometry(0.3, 1.15, 0.06, q, 0.03);
    b.translate(0, 0.5, 0); // pivot at the bottom, like a real fan deck
    return paint(at(b, { rz: (i - 2) * -0.32, z: i * 0.07, y: -0.45 }), hex);
  });
  parts.push(paint(at(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12), { y: -0.4, z: 0.12, rx: Math.PI / 2 }), C.night));
  return merge(parts);
}

function play(q) {
  const tri = poly([[-0.17, 0.24], [0.27, 0], [-0.17, -0.24]]);
  return merge([
    paint(new RoundedBoxGeometry(1.35, 0.92, 0.28, q, 0.2), C.plum),
    paint(at(extrude(tri, 0.07, 0.025, 2), { z: 0.17 }), C.cream),
  ]);
}

function heart() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.36, -0.6, -0.08, -0.6, 0.18);
  s.bezierCurveTo(-0.6, 0.45, -0.25, 0.58, 0, 0.3);
  s.bezierCurveTo(0.25, 0.58, 0.6, 0.45, 0.6, 0.18);
  s.bezierCurveTo(0.6, -0.08, 0.15, -0.36, 0, -0.5);
  return merge([paint(extrude(s, 0.22, 0.06, 4), C.white)]);
}

/*
 * The icon types, in a fixed order. `group` ties each one to a scroll chapter
 * (1 brand, 2 code, 3 growth) so those icons can come forward when that
 * chapter is on screen. `tints` are instance colours: white keeps the baked
 * colours, anything else recolours a single-colour icon.
 */
export const ICONS = [
  { name: 'code', group: 2, build: codeTag, tints: ['#FFFFFF'] },
  { name: 'gear', group: 2, build: gear, tints: ['#7A3FC4', '#FF6B00', '#B3ADBD'] },
  { name: 'bulb', group: 1, build: bulb, tints: ['#FFFFFF'] },
  { name: 'pencil', group: 1, build: pencil, tints: ['#FFFFFF'] },
  { name: 'swatch', group: 1, build: swatch, tints: ['#FFFFFF'] },
  { name: 'magnifier', group: 3, build: magnifier, tints: ['#FFFFFF'] },
  { name: 'chat', group: 3, build: chat, tints: ['#FFFFFF'] },
  { name: 'play', group: 3, build: play, tints: ['#FFFFFF'] },
  { name: 'heart', group: 3, build: heart, tints: ['#E2206E', '#FF6B00'] },
];

export function buildIconGeometries(quality) {
  const q = quality === 'low' ? 3 : 5;
  return ICONS.map((icon) => icon.build(q));
}
