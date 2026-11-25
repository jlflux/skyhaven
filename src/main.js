import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= noise + helpers ================= */
function hash(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s / 0.9375; }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const R = (a, b) => a + (b - a) * Math.random();
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmtN = n => Math.round(n).toLocaleString('en-US');

/* ================= renderer / scene ================= */
const canvas = $('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch (e) { $('#fail').hidden = false; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const DPR = renderer.getPixelRatio();

const scene = new THREE.Scene();
const VIEW = 24;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
const HOME = new THREE.Vector3(60, 60, 60);
camera.position.copy(HOME);
scene.add(camera);
const hemi = new THREE.HemisphereLight(0xd4ecff, 0x6b5640, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
function fitShadow(r) { Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix(); }

const controls = new MapControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minZoom = 0.3; controls.maxZoom = 3.2;
controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.2;
controls.zoomToCursor = true;

function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  const vh = a >= 1 ? VIEW : Math.max(VIEW, 22 / a);
  camera.left = -vh * a / 2; camera.right = vh * a / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ================= materials ================= */
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
const winMat = new THREE.MeshStandardMaterial({ color: '#3a2c2a', emissive: '#ffb45c', emissiveIntensity: 0, flatShading: true });
const crystalMat = new THREE.MeshStandardMaterial({ color: '#c39bff', emissive: '#7a3cff', emissiveIntensity: 0.6, roughness: 0.25, flatShading: true });
const white = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 });
const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, roughness: 0.9 });
const MATS = [vcMat, winMat];

/* ================= geometry kit ================= */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function part(geo, color, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.clearGroups();
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function assemble(base, glow = []) {
  const b = mergeGeometries(base);
  if (!glow.length) { b.addGroup(0, b.attributes.position.count, 0); return b; }
  return mergeGeometries([b, mergeGeometries(glow)], true);
}
const Bx = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cy = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
const Co = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const Ic = r => new THREE.IcosahedronGeometry(r, 0);
function roofG(w, h, d) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2); }
const WOOD = '#6b4a2f', DARK = '#4a3220', CREAM = '#efe3c8', STONE = '#b9b2a6';

const TYPES = {};
function cottage(roof) {
  const b = [
    part(Bx(0.66, 0.05, 0.54), WOOD, 0, 0.025, 0),
    part(Bx(0.62, 0.4, 0.5), CREAM, 0, 0.22, 0),
    part(roofG(0.78, 0.34, 0.62), roof, 0, 0.42, 0),
    part(Bx(0.1, 0.28, 0.1), '#8a7f74', 0.18, 0.66, -0.12),
    part(Bx(0.14, 0.24, 0.03), DARK, 0, 0.14, 0.255),
    part(Ic(0.08), '#5aa83e', 0.34, 0.06, 0.34), part(Ic(0.06), '#ff7aa2', -0.36, 0.05, 0.33)
  ];
  const g = [part(Bx(0.11, 0.11, 0.03), '#000', -0.2, 0.26, 0.255), part(Bx(0.11, 0.11, 0.03), '#000', 0.2, 0.26, 0.255), part(Bx(0.03, 0.11, 0.11), '#000', 0.315, 0.26, 0), part(Bx(0.03, 0.11, 0.11), '#000', -0.315, 0.26, 0)];
  return assemble(b, g);
}
TYPES.cottage = [cottage('#c0563f'), cottage('#5d7fb8'), cottage('#7a9a4a'), cottage('#8b5ea8')];
TYPES.hall = [assemble([
  part(Bx(0.92, 0.12, 0.92), STONE, 0, 0.06, 0),
  part(Bx(0.72, 0.5, 0.62), '#e9dcc0', 0, 0.37, 0),
  part(roofG(0.86, 0.36, 0.74), '#3f6fb5', 0, 0.62, 0),
  part(Bx(0.24, 0.5, 0.24), '#e9dcc0', 0, 0.95, 0.02),
  part(Co(0.21, 0.32, 4), '#3f6fb5', 0, 1.36, 0.02, Math.PI / 4),
  part(Cy(0.07, 0.07, 0.02, 12), '#ffffff', 0, 1.02, 0.145, 0, 1, 1, 1, Math.PI / 2),
  part(Bx(0.18, 0.3, 0.03), DARK, 0, 0.27, 0.315),
  part(Bx(0.32, 0.05, 0.12), STONE, 0, 0.145, 0.39),
  part(Cy(0.03, 0.03, 0.38), '#f5f2ea', -0.15, 0.31, 0.36), part(Cy(0.03, 0.03, 0.38), '#f5f2ea', 0.15, 0.31, 0.36),
  part(Cy(0.012, 0.012, 0.36), WOOD, 0, 1.68, 0.02), part(Bx(0.2, 0.11, 0.01), '#d94f4f', 0.1, 1.79, 0.02)
], [part(Bx(0.12, 0.14, 0.03), '#000', -0.24, 0.42, 0.315), part(Bx(0.12, 0.14, 0.03), '#000', 0.24, 0.42, 0.315), part(Bx(0.03, 0.14, 0.12), '#000', 0.365, 0.42, 0.1), part(Bx(0.03, 0.14, 0.12), '#000', -0.365, 0.42, 0.1)])];
TYPES.farm = [assemble([
  part(Bx(0.88, 0.04, 0.5), '#8b5e3c', 0, 0.02, 0.18),
  ...[0, 0.12, 0.24, 0.36].map((z, k) => part(Bx(0.8, 0.1, 0.07), k % 2 ? '#7fbf4a' : '#e8c35a', 0, 0.07, z)),
  part(Bx(0.44, 0.34, 0.34), '#b84a3a', -0.18, 0.17, -0.24),
  part(roofG(0.52, 0.22, 0.4), '#5a3a2a', -0.18, 0.34, -0.24),
  part(Bx(0.14, 0.2, 0.02), '#f3e9d2', -0.18, 0.1, -0.065),
  part(Cy(0.09, 0.09, 0.5), '#d9d2c0', 0.26, 0.25, -0.26), part(Co(0.1, 0.12), '#8a8f96', 0.26, 0.56, -0.26)
], [part(Bx(0.08, 0.07, 0.02), '#000', -0.18, 0.27, -0.065)])];
TYPES.garden = [assemble([
  part(Bx(0.88, 0.03, 0.88), '#8fd16a', 0, 0.015, 0),
  part(Bx(0.16, 0.035, 0.88), '#d6c49a', 0, 0.02, 0), part(Bx(0.88, 0.035, 0.16), '#d6c49a', 0, 0.02, 0),
  part(Ic(0.1), '#ff7aa2', -0.26, 0.09, 0.26), part(Ic(0.1), '#ffd166', 0.26, 0.09, 0.26), part(Ic(0.1), '#b388ff', -0.26, 0.09, -0.26),
  part(Cy(0.035, 0.05, 0.26), WOOD, 0.26, 0.13, -0.26), part(Ic(0.2), '#5fae46', 0.26, 0.4, -0.26),
  part(Bx(0.22, 0.04, 0.07), '#8b5e3c', 0.08, 0.12, 0.33), part(Bx(0.03, 0.1, 0.06), DARK, -0.01, 0.05, 0.33), part(Bx(0.03, 0.1, 0.06), DARK, 0.17, 0.05, 0.33)
])];
TYPES.well = [assemble([
  part(Bx(0.7, 0.02, 0.7), '#cdbb92', 0, 0.01, 0),
  part(Cy(0.24, 0.26, 0.2, 10), '#a39c92', 0, 0.1, 0), part(Cy(0.18, 0.18, 0.02, 10), '#4aa3df', 0, 0.2, 0),
  part(Bx(0.04, 0.42, 0.04), WOOD, -0.21, 0.38, 0), part(Bx(0.04, 0.42, 0.04), WOOD, 0.21, 0.38, 0),
  part(roofG(0.58, 0.18, 0.3), '#a04a3a', 0, 0.59, 0, Math.PI / 2), part(Cy(0.04, 0.03, 0.06), '#8b5e3c', 0, 0.38, 0)
])];
TYPES.lumber = [assemble([
  part(Bx(0.5, 0.34, 0.4), '#8a5a36', -0.12, 0.17, -0.12), part(roofG(0.6, 0.24, 0.5), '#5c3b22', -0.12, 0.34, -0.12),
  part(Cy(0.06, 0.06, 0.5, 7), '#a8743f', 0.15, 0.06, 0.28, 0, 1, 1, 1, 0, Math.PI / 2),
  part(Cy(0.06, 0.06, 0.5, 7), '#a8743f', 0.15, 0.06, 0.16, 0, 1, 1, 1, 0, Math.PI / 2),
  part(Cy(0.06, 0.06, 0.5, 7), '#b88450', 0.15, 0.16, 0.22, 0, 1, 1, 1, 0, Math.PI / 2),
  part(Cy(0.12, 0.12, 0.12), '#b08458', 0.3, 0.06, -0.26), part(Bx(0.13, 0.22, 0.02), DARK, -0.22, 0.11, 0.085)
], [part(Bx(0.1, 0.09, 0.02), '#000', 0.0, 0.2, 0.085)])];
TYPES.market = [assemble([
  part(Bx(0.9, 0.03, 0.9), '#cbbfa8', 0, 0.015, 0),
  ...[[-0.28, '#d94f4f'], [0, '#ffd166'], [0.28, '#4f8fd9']].flatMap(([sx, c]) => [
    part(Bx(0.22, 0.16, 0.18), '#8b5e3c', sx, 0.08, 0.1),
    part(Bx(0.02, 0.36, 0.02), DARK, sx - 0.1, 0.18, -0.04), part(Bx(0.02, 0.36, 0.02), DARK, sx + 0.1, 0.18, -0.04),
    part(Bx(0.26, 0.03, 0.3), c, sx, 0.36, 0.06, 0, 1, 1, 1, 0.3),
    part(Ic(0.04), pick(['#ff6b6b', '#ffd166', '#7fbf4a']), sx - 0.05, 0.19, 0.1), part(Ic(0.04), '#ff9f43', sx + 0.05, 0.19, 0.12)
  ]),
  part(Bx(0.12, 0.12, 0.12), '#a8743f', 0.3, 0.06, -0.3), part(Bx(0.12, 0.12, 0.12), '#b88450', 0.16, 0.06, -0.33)
], [part(Bx(0.05, 0.07, 0.05), '#000', -0.28, 0.28, 0.2), part(Bx(0.05, 0.07, 0.05), '#000', 0.28, 0.28, 0.2)])];
TYPES.windmill = [assemble([
  part(Cy(0.2, 0.3, 0.9), CREAM, 0, 0.45, 0), part(Cy(0.26, 0.27, 0.05), WOOD, 0, 0.35, 0),
  part(Co(0.28, 0.3), '#7a4a2e', 0, 1.05, 0), part(Bx(0.12, 0.2, 0.03), DARK, 0, 0.1, 0.27)
], [part(Bx(0.07, 0.09, 0.03), '#000', 0, 0.62, 0.225)])];
const bladesGeo = mergeGeometries([0, 1, 2, 3].flatMap(k => [
  part(Bx(0.03, 0.6, 0.02).translate(0, 0.32, 0), WOOD, 0, 0, 0, 0, 1, 1, 1, 0, k * Math.PI / 2),
  part(Bx(0.13, 0.44, 0.01).translate(0.08, 0.36, 0), '#f4efe4', 0, 0, 0, 0, 1, 1, 1, 0, k * Math.PI / 2)
]));
TYPES.tavern = [assemble([
  part(Bx(0.7, 0.36, 0.56), '#e9dcc0', 0, 0.18, 0), part(Bx(0.74, 0.3, 0.6), '#c8a27a', 0, 0.51, 0),
  part(roofG(0.86, 0.32, 0.72), '#7b3b2e', 0, 0.66, 0), part(Bx(0.12, 0.3, 0.12), '#8a7f74', 0.24, 0.9, -0.15),
  part(Bx(0.16, 0.26, 0.03), DARK, 0, 0.13, 0.29), part(Bx(0.03, 0.03, 0.2), WOOD, 0.3, 0.46, 0.38), part(Bx(0.15, 0.1, 0.02), '#d9a441', 0.3, 0.38, 0.46)
], [part(Bx(0.12, 0.1, 0.03), '#000', -0.22, 0.2, 0.285), part(Bx(0.12, 0.1, 0.03), '#000', 0.22, 0.2, 0.285), part(Bx(0.1, 0.1, 0.03), '#000', -0.2, 0.52, 0.305), part(Bx(0.1, 0.1, 0.03), '#000', 0.2, 0.52, 0.305)])];
TYPES.workshop = [assemble([
  part(Bx(0.8, 0.4, 0.6), '#9d958a', 0, 0.2, 0), part(roofG(0.9, 0.26, 0.7), '#5a5f6b', 0, 0.4, 0),
  part(Bx(0.14, 0.55, 0.14), '#6f6a64', -0.28, 0.62, -0.18), part(Bx(0.3, 0.28, 0.03), DARK, -0.12, 0.14, 0.305),
  part(Cy(0.07, 0.08, 0.1), '#8b5e3c', 0.28, 0.05, 0.4), part(Bx(0.13, 0.06, 0.06), '#3b3b3b', 0.28, 0.13, 0.4)
], [part(Bx(0.14, 0.12, 0.03), '#000', 0.22, 0.22, 0.305)])];
TYPES.manor = [assemble([
  part(Bx(0.5, 0.62, 0.44), '#f2ece0', 0, 0.31, -0.04), part(roofG(0.62, 0.32, 0.56), '#3f5f8f', 0, 0.62, -0.04),
  part(Bx(0.22, 0.42, 0.34), '#f2ece0', -0.36, 0.21, -0.06), part(Bx(0.22, 0.42, 0.34), '#f2ece0', 0.36, 0.21, -0.06),
  part(Co(0.2, 0.2, 4), '#3f5f8f', -0.36, 0.52, -0.06, Math.PI / 4), part(Co(0.2, 0.2, 4), '#3f5f8f', 0.36, 0.52, -0.06, Math.PI / 4),
  part(Cy(0.025, 0.025, 0.34), '#ffffff', -0.1, 0.17, 0.24), part(Cy(0.025, 0.025, 0.34), '#ffffff', 0.1, 0.17, 0.24),
  part(Bx(0.26, 0.04, 0.12), '#ffffff', 0, 0.36, 0.24), part(Bx(0.12, 0.22, 0.02), DARK, 0, 0.11, 0.185),
  part(Bx(0.34, 0.12, 0.08), '#4f9a3c', -0.28, 0.06, 0.42), part(Bx(0.34, 0.12, 0.08), '#4f9a3c', 0.28, 0.06, 0.42)
], [-0.13, 0.13].flatMap(x => [part(Bx(0.08, 0.1, 0.02), '#000', x, 0.46, 0.185)]).concat([part(Bx(0.08, 0.1, 0.02), '#000', -0.36, 0.24, 0.115), part(Bx(0.08, 0.1, 0.02), '#000', 0.36, 0.24, 0.115)]))];
TYPES.mine = [assemble([
  part(new THREE.DodecahedronGeometry(0.42, 0), '#7b746c', 0, 0.12, -0.1, 0.3, 1, 0.62, 1),
  part(Bx(0.05, 0.3, 0.05), WOOD, -0.13, 0.15, 0.22), part(Bx(0.05, 0.3, 0.05), WOOD, 0.13, 0.15, 0.22),
  part(Bx(0.34, 0.05, 0.06), WOOD, 0, 0.31, 0.22), part(Bx(0.22, 0.26, 0.03), '#1b1622', 0, 0.13, 0.2),
  part(Bx(0.02, 0.01, 0.5), '#5a5f6b', -0.05, 0.005, 0.42), part(Bx(0.02, 0.01, 0.5), '#5a5f6b', 0.05, 0.005, 0.42),
  part(Bx(0.16, 0.09, 0.12), '#5a5f6b', 0, 0.06, 0.4)
])];
const mineCrystalGeo = mergeGeometries([[-0.12, 0.42, -0.1, 0.3], [0.1, 0.38, -0.2, -0.2], [0.02, 0.48, -0.02, 0.1], [0, 0.13, 0.42, 0]].map(([x, y, z, t]) => { const g = new THREE.OctahedronGeometry(0.07, 0); g.scale(1, 2, 1); g.rotateZ(t); g.translate(x, y, z); return g; }));
TYPES.dock = [assemble([
  part(Bx(0.9, 0.06, 0.9), '#8b5e3c', 0, 0.12, 0), part(Bx(0.36, 0.05, 0.9), '#a8743f', 0, 0.12, 0.85),
  ...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4], [-0.16, 1.26], [0.16, 1.26]].map(([x, z]) => part(Cy(0.03, 0.03, 0.42), DARK, x, 0.21, z)),
  part(Bx(0.06, 0.72, 0.06), WOOD, -0.34, 0.5, -0.3), part(Bx(0.5, 0.04, 0.04), WOOD, -0.12, 0.84, -0.3),
  part(Bx(0.14, 0.14, 0.14), '#a8743f', 0.22, 0.22, -0.2), part(Bx(0.12, 0.12, 0.12), '#b88450', 0.3, 0.21, 0.05)
], [part(Bx(0.05, 0.07, 0.05), '#000', 0.16, 0.46, 1.26), part(Bx(0.05, 0.07, 0.05), '#000', -0.16, 0.46, 1.26)])];
const shipGeo = mergeGeometries([
  part(new THREE.SphereGeometry(0.3, 10, 6), '#f2d0a4', 0, 0.42, 0, 0, 1.7, 0.8, 0.8),
  part(Bx(0.5, 0.12, 0.22), '#8b5e3c', 0, 0, 0), part(Bx(0.16, 0.1, 0.16), '#6b4a2f', -0.3, 0.02, 0),
  part(Bx(0.02, 0.28, 0.02), DARK, -0.18, 0.18, 0), part(Bx(0.02, 0.28, 0.02), DARK, 0.18, 0.18, 0),
  part(Bx(0.1, 0.1, 0.02), '#d94f4f', -0.56, 0.42, 0)
]);
TYPES.temple = [assemble([
  part(Bx(0.92, 0.08, 0.92), '#e8e4dc', 0, 0.04, 0), part(Bx(0.78, 0.08, 0.78), '#efe9dd', 0, 0.12, 0),
  ...[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28], [-0.28, 0], [0.28, 0]].map(([x, z]) => part(Cy(0.04, 0.045, 0.44), '#f5f2ea', x, 0.38, z)),
  part(Bx(0.72, 0.08, 0.72), '#efe9dd', 0, 0.63, 0),
  part(new THREE.SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e0b44c', 0, 0.67, 0)
], [part(Bx(0.22, 0.26, 0.22), '#000', 0, 0.3, 0)])];

// terrain decorations
function treeCluster(seed) {
  const parts = [], n = 2 + (hash(seed, 7) * 2 | 0);
  for (let t = 0; t < n; t++) {
    const x = (hash(seed, t * 3) - 0.5) * 0.6, z = (hash(seed, t * 3 + 1) - 0.5) * 0.6, s = 0.7 + hash(seed, t * 3 + 2) * 0.5;
    parts.push(part(Cy(0.05, 0.07, 0.34, 6), WOOD, x, 0.17 * s, z, 0, s, s, s));
    if (hash(seed, t + 40) < 0.6) {
      parts.push(part(Co(0.32, 0.45, 7), '#2f7a43', x, 0.42 * s, z, 0, s, s, s), part(Co(0.24, 0.38, 7), '#367f47', x, 0.64 * s, z, 0, s, s, s));
    } else parts.push(part(Ic(0.28), hash(seed, t + 50) < 0.8 ? '#6db34a' : '#e08a3c', x, 0.48 * s, z, 0, s, s, s));
  }
  return mergeGeometries(parts);
}
const TREE_GEOS = [0, 1, 2, 3, 4].map(treeCluster);
const ROCK_GEO = mergeGeometries([part(new THREE.DodecahedronGeometry(0.3, 0), '#8a847c', 0, 0.12, 0, 0.4, 1.1, 0.8, 1), part(new THREE.DodecahedronGeometry(0.16, 0), '#9a948c', 0.25, 0.06, 0.2), part(new THREE.DodecahedronGeometry(0.12, 0), '#7b746c', -0.25, 0.05, 0.25)]);
const CRYSTAL_GEO = mergeGeometries([[0, 0.25, 0, 0, 1.1], [0.2, 0.15, 0.15, 0.4, 0.8], [-0.18, 0.14, 0.1, -0.35, 0.7], [0.05, 0.12, -0.22, 0.2, 0.65]].map(([x, y, z, t, s]) => { const g = new THREE.OctahedronGeometry(0.12 * s, 0); g.scale(1, 2.2, 1); g.rotateZ(t); g.translate(x, y * s, z); return g; }));

/* ================= definitions ================= */
const RANKS = [{ name: 'Hamlet', pop: 0 }, { name: 'Village', pop: 20 }, { name: 'Town', pop: 60 }, { name: 'City', pop: 150 }, { name: 'Sky Capital', pop: 300 }];
const DEFS = {
  cottage: { name: 'Cottage', cost: 40, rank: 0, housing: 4, upkeep: 0, desc: 'Houses 4 settlers.' },
  farm: { name: 'Farm', cost: 60, rank: 0, jobs: 4, food: 12, bonus: 4, upkeep: 1, desc: '4 jobs. Feeds 12 settlers.' },
  garden: { name: 'Garden', cost: 25, rank: 0, appeal: 6, radius: 2, upkeep: 0, free: true, desc: '+6 appeal for homes within 2 tiles.' },
  well: { name: 'Well', cost: 35, rank: 0, appeal: 8, radius: 2, upkeep: 0, free: true, desc: '+8 appeal for homes within 2 tiles.' },
  lumber: { name: 'Lumber Mill', cost: 80, rank: 0, jobs: 3, upkeep: 1, desc: '3 jobs. +8 coins a day for each forest tile beside it.' },
  market: { name: 'Market', cost: 120, rank: 1, jobs: 4, upkeep: 2, desc: '4 jobs. Earns from every settler living within 3 tiles.' },
  windmill: { name: 'Windmill', cost: 100, rank: 1, jobs: 2, upkeep: 1, desc: '2 jobs. Farms beside it grow 50% more food.' },
  tavern: { name: 'Tavern', cost: 150, rank: 1, jobs: 3, bonus: 4, appeal: 12, radius: 3, upkeep: 2, desc: '3 jobs. +12 appeal for homes within 3 tiles.' },
  workshop: { name: 'Workshop', cost: 180, rank: 2, jobs: 6, bonus: 10, upkeep: 3, noise: 8, desc: '6 jobs, +40 coins a day. Noisy: −8 appeal for homes beside it.' },
  manor: { name: 'Manor', cost: 220, rank: 2, housing: 10, upkeep: 1, needAppeal: 65, desc: 'Houses 10 if its appeal is 65 or more, otherwise 3.' },
  mine: { name: 'Crystal Mine', cost: 300, rank: 2, jobs: 6, bonus: 30, upkeep: 4, on: 'crystal', desc: 'Must sit on a crystal vein. 6 jobs, +120 coins a day.' },
  dock: { name: 'Sky Dock', cost: 400, rank: 3, jobs: 4, bonus: 15, upkeep: 5, edge: true, desc: 'Must sit on the island edge. Airships bring 50% more settlers.' },
  temple: { name: 'Temple', cost: 500, rank: 3, jobs: 2, appeal: 20, radius: 5, upkeep: 4, desc: '+20 appeal for homes within 5 tiles.' }
};
for (const d of Object.values(DEFS)) { if (d.bonus) d.bonus *= 4; if (d.upkeep) d.upkeep *= 4; }
const ORDER = Object.keys(DEFS);
const HOUSES = new Set(['cottage', 'manor']);
const FAMILIES = ['Hollis', 'Ashdown', 'Merrow', 'Thistle', 'Brightwater', 'Fenwick', 'Oakhart', 'Larkin', 'Pell', 'Corrin', 'Wren', 'Marlow'];
const TERR = { g: 'grass', f: 'forest', r: 'rock', w: 'water', c: 'crystal' };
const TCOL = { grass: '#7cc15a', forest: '#5c9e45', rock: '#9a948c', water: '#3d9bd6', crystal: '#8fb873', road: '#d6bf8f' };

/* ================= world ================= */
const N = 48, HALF = N / 2, GROUND = 1;
const toW = i => i - HALF + 0.5;
const K = (i, j) => i * N + j;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const tiles = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) tiles.push({ k: K(i, j), i, j, x: toW(i), z: toW(j), land: false, terr: 'grass', road: false, b: null, deco: null, bottom: -2, anim: 0 });
const T = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? null : tiles[K(i, j)];
const tileAtW = (x, z) => T(Math.floor(x + HALF), Math.floor(z + HALF));
const HALL_K = K(HALF, HALF);
const isEdge = t => DIRS.some(([a, b]) => { const n = T(t.i + a, t.j + b); return !n || !n.land; });

const capGeo = Bx(1, 0.22, 1).translate(0, -0.11, 0);
const bodyGeo = Bx(1, 1, 1).translate(0, 0.5, 0);
{ const p = bodyGeo.attributes.position, c = []; for (let k = 0; k < p.count; k++) { const v = p.getY(k) > 0.5 ? 1 : 0.32; c.push(v, v, v); } bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
const capMesh = new THREE.InstancedMesh(capGeo, white, N * N);
const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, N * N);
capMesh.receiveShadow = true; bodyMesh.receiveShadow = true; bodyMesh.castShadow = true; capMesh.castShadow = true;
scene.add(capMesh, bodyMesh);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpO = new THREE.Object3D(), tmpC = new THREE.Color();
for (let k = 0; k < N * N; k++) { capMesh.setMatrixAt(k, ZERO); bodyMesh.setMatrixAt(k, ZERO); capMesh.setColorAt(k, tmpC.set('#fff')); bodyMesh.setColorAt(k, tmpC); }

const topOf = t => t.terr === 'water' ? 0.8 : t.terr === 'rock' ? 1.15 : GROUND;
function capColor(t) {
  const base = t.road ? TCOL.road : TCOL[t.terr];
  return tmpC.set(base).offsetHSL(0, 0, (hash(t.i, t.j) - 0.5) * (t.road ? 0.04 : 0.07));
}
function writeTile(t) {
  const off = t.anim ? -5 * Math.pow(1 - t.anim, 3) : 0;
  if (!t.land) { capMesh.setMatrixAt(t.k, ZERO); bodyMesh.setMatrixAt(t.k, ZERO); return; }
  const top = topOf(t);
  tmpO.position.set(t.x, top + off, t.z); tmpO.rotation.set(0, 0, 0); tmpO.scale.set(1, 1, 1); tmpO.updateMatrix();
  capMesh.setMatrixAt(t.k, tmpO.matrix); capMesh.setColorAt(t.k, capColor(t));
  tmpO.position.set(t.x, t.bottom + off, t.z); tmpO.scale.set(1, top - 0.22 - t.bottom, 1); tmpO.updateMatrix();
  bodyMesh.setMatrixAt(t.k, tmpO.matrix);
  bodyMesh.setColorAt(t.k, tmpC.set(t.terr === 'rock' ? '#77716b' : '#8b5e3c').offsetHSL(0, 0, (hash(t.j, t.i) - 0.5) * 0.05));
  if (t.deco) t.deco.position.y = top + off;
  if (t.b) t.b.mesh.position.y = GROUND + off;
}
function flushTiles() { capMesh.instanceMatrix.needsUpdate = true; bodyMesh.instanceMatrix.needsUpdate = true; capMesh.instanceColor.needsUpdate = true; bodyMesh.instanceColor.needsUpdate = true; capMesh.computeBoundingSphere(); capMesh.computeBoundingBox?.(); }

let islandR = 6;
function recomputeDepths() {
  const dist = new Int16Array(N * N).fill(-1), q = [];
  for (const t of tiles) if (t.land && isEdge(t)) { dist[t.k] = 1; q.push(t); }
  for (let h = 0; h < q.length; h++) { const t = q[h]; for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && n.land && dist[n.k] < 0) { dist[n.k] = dist[t.k] + 1; q.push(n); } } }
  islandR = 4;
  for (const t of tiles) if (t.land) {
    const d = dist[t.k];
    t.bottom = Math.round((-1.2 - Math.min(d, 12) * 0.85 - fbm(t.x * 0.3 + 7, t.z * 0.3 + 7) * 2) * 2) / 2;
    islandR = Math.max(islandR, Math.hypot(t.x, t.z) + 1);
    writeTile(t);
  }
  fitShadow(islandR + 4);
  flushTiles();
}

const pickables = new Set([capMesh]);
function setDeco(t) {
  if (t.deco) { scene.remove(t.deco); pickables.delete(t.deco); t.deco = null; }
  if (!t.land || t.b || t.road) return;
  let m = null;
  if (t.terr === 'forest') m = new THREE.Mesh(TREE_GEOS[(t.i * 7 + t.j * 3) % TREE_GEOS.length], vcMat);
  else if (t.terr === 'rock') m = new THREE.Mesh(ROCK_GEO, vcMat);
  else if (t.terr === 'crystal') m = new THREE.Mesh(CRYSTAL_GEO, crystalMat);
  if (!m) return;
  m.position.set(t.x, topOf(t), t.z); m.rotation.y = (t.i * 1.7 + t.j) % 6; m.castShadow = true; m.receiveShadow = true; m.userData.k = t.k;
  scene.add(m); pickables.add(m); t.deco = m;
}

/* ================= state ================= */
let S = null; // serialisable state
const anims = [];
function roadDirFor(t, preferEdge) {
  if (preferEdge) for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (!n || !n.land) return [a, b]; }
  for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && (n.road || n.k === HALL_K) && n.conn) return [a, b]; }
  for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && n.road) return [a, b]; }
  return [1, 0];
}
function placeBuilding(t, type, variant = 0, animate = true) {
  const geo = TYPES[type][variant % TYPES[type].length];
  const mesh = new THREE.Mesh(geo, MATS);
  const [a, b] = roadDirFor(t, DEFS[type]?.edge);
  mesh.position.set(t.x, GROUND, t.z); mesh.rotation.y = Math.atan2(a, b);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.k = t.k;
  scene.add(mesh); pickables.add(mesh);
  const bld = { type, variant, mesh, extra: null };
  if (type === 'windmill') { const bl = new THREE.Mesh(bladesGeo, vcMat); bl.position.set(0, 0.85, 0.27); bl.castShadow = true; mesh.add(bl); bld.extra = bl; }
  if (type === 'mine') { const c = new THREE.Mesh(mineCrystalGeo, crystalMat); mesh.add(c); }
  if (type === 'dock') { const s = new THREE.Mesh(shipGeo, vcMat); s.position.set(0, 0.95, 1.05); s.castShadow = true; mesh.add(s); bld.extra = s; }
  t.b = bld; setDeco(t);
  if (animate && !reduce) { mesh.scale.set(1, 0.01, 1); anims.push({ m: mesh, t: 0 }); }
}
function removeBuilding(t) {
  if (!t.b) return;
  scene.remove(t.b.mesh); pickables.delete(t.b.mesh); t.b = null; setDeco(t);
}

function genIsland() {
  for (const t of tiles) { removeBuilding(t); t.land = false; t.road = false; t.terr = 'grass'; t.anim = 0; setDeco(t); }
  const seed = Math.random() * 100;
  for (const t of tiles) {
    const d = Math.hypot(t.x - 0.5, t.z - 0.5) + (fbm(t.x * 0.4 + seed, t.z * 0.4) - 0.5) * 1.4;
    if (d > 4.7) continue;
    t.land = true;
    const f = fbm(t.x * 0.35 + 40 + seed, t.z * 0.35 + 40);
    const dc = Math.hypot(t.x - 0.5, t.z - 0.5);
    t.terr = dc > 2.2 && f > 0.58 ? 'forest' : 'grass';
  }
  // a little pond and a rock
  const ring = tiles.filter(t => t.land && Math.hypot(t.x - 0.5, t.z - 0.5) > 3 && Math.hypot(t.x - 0.5, t.z - 0.5) < 4.2 && t.terr === 'grass');
  if (ring.length) { const p = pick(ring); p.terr = 'water'; const n = T(p.i + 1, p.j) ; if (n && n.land && Math.hypot(n.x - 0.5, n.z - 0.5) > 2.5) n.terr = 'water'; }
  if (ring.length > 3) { const r = pick(ring); if (r.terr === 'grass') r.terr = 'rock'; }
  const hall = tiles[HALL_K]; hall.terr = 'grass';
  for (const [i, j] of [[HALF + 1, HALF], [HALF + 2, HALF], [HALF, HALF + 1], [HALF, HALF + 2], [HALF - 1, HALF], [HALF - 2, HALF]]) { const t = T(i, j); t.land = true; t.terr = 'grass'; t.road = true; }
  for (const t of tiles) setDeco(t);
  recomputeDepths();
  placeBuilding(hall, 'hall', 0, false);
  S = { v: 1, coins: 300, pop: 0, day: 1, f: 0.05, speed: 1, expansions: 0, active: [0, 1, 2], nextQ: 3, ready: [], pet: null, nextPet: 2, name: 'Skyhaven', stats: { built: 0 } };
}

function serialize() {
  let land = '';
  for (const t of tiles) land += t.land ? ({ grass: 'g', forest: 'f', rock: 'r', water: 'w', crystal: 'c' })[t.terr] : '.';
  return { ...S, land, roads: tiles.filter(t => t.road).map(t => t.k), blds: tiles.filter(t => t.b).map(t => [t.k, t.b.type, t.b.variant]) };
}
function deserialize(d) {
  for (const t of tiles) { removeBuilding(t); t.road = false; t.anim = 0; const c = d.land[t.k]; t.land = c !== '.'; t.terr = TERR[c] || 'grass'; }
  for (const k of d.roads) tiles[k].road = true;
  for (const t of tiles) setDeco(t);
  recomputeDepths();
  const { land, roads, blds, ...rest } = d; S = rest;
  const pop = S.pop;
  recomputeSim();
  for (const [k, type, v] of blds) placeBuilding(tiles[k], type, v, false);
  S.pop = pop; recomputeSim();
}
function save() { try { localStorage.setItem('skyhaven-v1', JSON.stringify(serialize())); } catch (e) { /* storage unavailable */ } }
let saveTimer = 0;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); };
window.claude?.hot?.snapshot?.(() => serialize());

/* ================= simulation ================= */
let ST = {};
const cheb = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
function recomputeSim() {
  // road connectivity from the hall
  for (const t of tiles) t.conn = false;
  const hall = tiles[HALL_K]; hall.conn = true;
  const q = [hall];
  for (let h = 0; h < q.length; h++) { const t = q[h]; for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && n.land && n.road && !n.conn) { n.conn = true; q.push(n); } } }
  const blds = tiles.filter(t => t.b && t.b.type !== 'hall');
  for (const t of blds) t.b.ok = DIRS.some(([a, b]) => { const n = T(t.i + a, t.j + b); return n && n.conn; });
  const ok = t => t.b.ok || DEFS[t.b.type].free;
  const houses = blds.filter(t => HOUSES.has(t.b.type) && t.b.ok);
  const appealSrc = blds.filter(t => DEFS[t.b.type].appeal && ok(t));
  const noisy = blds.filter(t => DEFS[t.b.type].noise && t.b.ok);
  const work = blds.filter(t => DEFS[t.b.type].jobs && t.b.ok);
  const jobs = work.reduce((s, t) => s + DEFS[t.b.type].jobs, 0);
  const pop = S.pop;
  const employed = Math.min(pop, jobs), fill = jobs ? employed / jobs : 0;
  // food
  let food = 0;
  for (const t of work) if (t.b.type === 'farm') {
    const boosted = DIRS.some(([a, b]) => { const n = T(t.i + a, t.j + b); return n && n.b && n.b.type === 'windmill' && n.b.ok; });
    food += DEFS.farm.food * fill * (boosted ? 1.5 : 1);
  }
  food = Math.round(food);
  const foodOK = pop === 0 || food >= pop;
  const jobsOK = pop < 5 || (pop - employed) / pop <= 0.3;
  // appeal per house
  let housing = 0, wsum = 0, hsum = 0;
  for (const h of houses) {
    let ap = 40 + (foodOK ? 10 : -15) + (jobsOK ? 5 : -10);
    for (const s of appealSrc) { const d = DEFS[s.b.type]; if (cheb(h, s) <= d.radius) ap += d.appeal; }
    for (const s of noisy) if (cheb(h, s) <= 1) ap -= DEFS[s.b.type].noise;
    h.b.appeal = clamp(Math.round(ap), 0, 100);
    const cap = h.b.type === 'manor' ? (h.b.appeal >= 65 ? 10 : 3) : 4;
    h.b.cap = cap; housing += cap; wsum += cap * h.b.appeal; hsum += cap;
  }
  const happy = hsum ? Math.round(wsum / hsum) : 55;
  // residents per house, for markets and inspect
  for (const h of houses) h.b.res = housing ? Math.round(pop * h.b.cap / housing) : 0;
  // income
  let income = employed * 12 + (pop - employed) * 4, upkeep = 0;
  const lines = { taxes: income, work: 0 };
  for (const t of blds) upkeep += DEFS[t.b.type].upkeep || 0;
  for (const t of work) {
    const d = DEFS[t.b.type]; let g = (d.bonus || 0) * fill;
    if (t.b.type === 'lumber') g += 8 * DIRS.filter(([a, b]) => { const n = T(t.i + a, t.j + b); return n && n.land && n.terr === 'forest' && !n.b && !n.road; }).length * fill;
    if (t.b.type === 'market') g += 2.4 * houses.reduce((s, h) => s + (cheb(h, t) <= 3 ? h.b.res : 0), 0) * fill;
    t.b.earn = Math.round(g); lines.work += g;
  }
  income += lines.work;
  const net = Math.round(income - upkeep);
  const count = {}; for (const t of blds) count[t.b.type] = (count[t.b.type] || 0) + (t.b.ok || DEFS[t.b.type].free ? 1 : 0);
  const land = tiles.reduce((s, t) => s + (t.land ? 1 : 0), 0);
  const roads = tiles.reduce((s, t) => s + (t.road ? 1 : 0), 0);
  const rank = RANKS.reduce((r, x, i) => pop >= x.pop ? i : r, 0);
  const fullManors = houses.filter(h => h.b.type === 'manor' && h.b.cap === 10).length;
  ST = { housing, jobs, employed, food, foodOK, jobsOK, happy, net, upkeep, income, count, land, roads, rank, fullManors, dock: (count.dock || 0) > 0, disconnected: blds.filter(t => !t.b.ok && !DEFS[t.b.type].free) };
  if (S.pop > housing) S.pop = housing;
  updateMarkers();
}

/* ================= quests ================= */
const QUESTS = [
  { t: 'Lay the first road', d: 'Have 10 road tiles', goal: 10, val: () => ST.roads, reward: 50 },
  { t: 'Home sweet home', d: 'Build 3 cottages beside a road', goal: 3, val: () => ST.count.cottage || 0, reward: 80 },
  { t: 'Put people to work', d: 'Build a farm beside a road', goal: 1, val: () => ST.count.farm || 0, reward: 60 },
  { wait: true, t: 'First settlers', d: 'Reach 10 settlers', goal: 10, val: () => S.pop, reward: 100 },
  { t: 'Room to grow', d: 'Expand the island by 3 tiles', goal: 3, val: () => S.expansions, reward: 120 },
  { wait: true, t: 'A pleasant place', d: 'Reach 65% happiness', goal: 65, val: () => ST.happy, reward: 100, pct: true },
  { wait: true, t: 'Village charter', d: 'Reach 20 settlers', goal: 20, val: () => S.pop, reward: 150 },
  { t: 'Market day', d: 'Build a market', goal: 1, val: () => ST.count.market || 0, reward: 120 },
  { wait: true, t: 'Breadbasket', d: 'Grow food for 40 settlers', goal: 40, val: () => ST.food, reward: 150 },
  { wait: true, t: 'Busy hands', d: 'Employ 30 settlers', goal: 30, val: () => ST.employed, reward: 200 },
  { t: 'Spread your wings', d: 'Grow the island to 150 tiles', goal: 150, val: () => ST.land, reward: 250 },
  { wait: true, t: 'Town charter', d: 'Reach 60 settlers', goal: 60, val: () => S.pop, reward: 300 },
  { t: 'Strike crystal', d: 'Build a crystal mine (expand to find a vein)', goal: 1, val: () => ST.count.mine || 0, reward: 300 },
  { t: 'Grand homes', d: 'Fill 2 manors (appeal 65+)', goal: 2, val: () => ST.fullManors, reward: 300 },
  { wait: true, t: 'City charter', d: 'Reach 150 settlers', goal: 150, val: () => S.pop, reward: 500 },
  { t: 'Open the skies', d: 'Build a sky dock', goal: 1, val: () => ST.count.dock || 0, reward: 400 },
  { wait: true, t: 'Sky Capital', d: 'Reach 300 settlers', goal: 300, val: () => S.pop, reward: 1000 }
];
function quest(q) {
  if (q < QUESTS.length) return QUESTS[q];
  const n = q - QUESTS.length;
  if (n % 2 === 0) { const g = 350 + n * 50; return { wait: true, t: `Growing capital ${n / 2 + 1}`, d: `Reach ${g} settlers`, goal: g, val: () => S.pop, reward: 600 + n * 40 }; }
  const g = 250 + n * 30; return { t: `Wider skies ${Math.ceil(n / 2)}`, d: `Grow the island to ${g} tiles`, goal: g, val: () => ST.land, reward: 500 + n * 30 };
}
const qDone = q => { const Q = quest(q); return Q.val() >= Q.goal; };

/* ================= placement rules ================= */
const expandCost = () => Math.round(15 + S.expansions * 2.2 + Math.max(0, S.expansions - 40) * 1.5);
const clearCost = t => t.terr === 'forest' ? 10 : 0;
function canPlace(type, t) {
  if (!t || !t.land) return 'Not on the island';
  const d = DEFS[type];
  if (d.rank > ST.rank) return `Unlocks at ${RANKS[d.rank].name} (${RANKS[d.rank].pop} settlers)`;
  if (t.b || t.road) return 'Tile is taken';
  if (d.on === 'crystal' && t.terr !== 'crystal') return 'Needs a crystal vein';
  if (d.on !== 'crystal' && t.terr === 'crystal') return 'Crystal veins are for mines';
  if (t.terr === 'water') return 'Can’t build on water';
  if (t.terr === 'rock') return 'Clear the boulder first';
  if (d.edge && !isEdge(t)) return 'Must be on the island edge';
  if (S.coins < d.cost + clearCost(t)) return `Needs ${d.cost + clearCost(t)} coins`;
  return '';
}
function canRoad(t) {
  if (!t || !t.land) return 'Not on the island';
  if (t.road || t.b) return 'Tile is taken';
  if (t.terr === 'water' || t.terr === 'rock' || t.terr === 'crystal') return `Can’t build a road on ${t.terr}`;
  if (S.coins < 5 + clearCost(t)) return 'Not enough coins';
  return '';
}
function bulldozeInfo(t) {
  if (!t || !t.land) return { err: 'Not on the island' };
  if (t.k === HALL_K) return { err: 'The town hall stays' };
  if (t.b) return { label: `Demolish ${DEFS[t.b.type].name} (+${Math.floor(DEFS[t.b.type].cost / 2)} refund)`, cost: -Math.floor(DEFS[t.b.type].cost / 2) };
  if (t.road) return { label: 'Remove road', cost: 0 };
  if (t.terr === 'forest') return { label: 'Clear forest (10 coins)', cost: 10 };
  if (t.terr === 'rock') return { label: 'Break boulder (40 coins)', cost: 40 };
  return { err: 'Nothing to clear here' };
}
function canExpand(t) {
  if (!t) return 'Off the map';
  if (t.land) return 'Already land';
  if (!DIRS.some(([a, b]) => { const n = T(t.i + a, t.j + b); return n && n.land; })) return 'Must touch the island';
  if (S.coins < expandCost()) return `Needs ${expandCost()} coins`;
  return '';
}

/* ================= actions ================= */
function spend(n) { S.coins -= n; bump('coins'); }
function doBuild(type, t) {
  const err = canPlace(type, t); if (err) { toast(err, 'warn'); return false; }
  spend(DEFS[type].cost + clearCost(t));
  if (t.terr === 'forest') t.terr = 'grass';
  writeTile(t); flushTiles();
  placeBuilding(t, type, type === 'cottage' ? Math.floor(Math.random() * 4) : 0);
  S.stats.built++;
  afterChange();
  if (!t.b.ok && !DEFS[type].free) toast(`${DEFS[type].name} needs a road beside it to open`, 'warn');
  return true;
}
function doRoad(t) {
  if (canRoad(t)) return false;
  spend(5 + clearCost(t));
  if (t.terr === 'forest') t.terr = 'grass';
  t.road = true; setDeco(t); writeTile(t); flushTiles();
  // re-orient neighbours that had no road before
  for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && n.b && n.b.type !== 'hall' && !DEFS[n.b.type].edge) { const [x, z] = roadDirFor(n); n.b.mesh.rotation.y = Math.atan2(x, z); } }
  afterChange(); return true;
}
function doBulldoze(t) {
  const info = bulldozeInfo(t); if (info.err) return false;
  if (info.cost > 0 && S.coins < info.cost) { toast('Not enough coins', 'warn'); return false; }
  if (t.b) { S.coins += Math.floor(DEFS[t.b.type].cost / 2); removeBuilding(t); }
  else if (t.road) t.road = false;
  else if (t.terr === 'forest' || t.terr === 'rock') { spend(info.cost); t.terr = 'grass'; }
  bump('coins'); setDeco(t); writeTile(t); flushTiles(); afterChange(); return true;
}
function doExpand(t) {
  const err = canExpand(t); if (err) { toast(err, 'warn'); return false; }
  spend(expandCost());
  const dist = Math.hypot(t.x, t.z), r = Math.random();
  const hasCrystal = tiles.some(x => x.land && x.terr === 'crystal');
  const crystalP = (ST.rank >= 2 && !hasCrystal) ? 0.3 : 0.015 + dist * 0.002;
  t.terr = r < crystalP ? 'crystal' : r < crystalP + 0.2 ? 'forest' : r < crystalP + 0.26 ? 'rock' : r < crystalP + 0.29 ? 'water' : 'grass';
  t.land = true; t.anim = reduce ? 1 : 0.001; S.expansions++;
  setDeco(t); recomputeDepths();
  if (t.terr === 'crystal') toast('A crystal vein! Mines can be built here.', 'good');
  afterChange(); refreshExpandOverlay(); return true;
}
function afterChange() { recomputeSim(); updateHUD(); renderQuests(); refreshCards(); saveSoon(); }

/* ================= markers / overlays ================= */
const markerGeo = new THREE.OctahedronGeometry(0.12, 0);
const markerMat = new THREE.MeshBasicMaterial({ color: '#ff5a5a' });
const markers = new Map();
function updateMarkers() {
  const want = new Set((ST.disconnected || []).map(t => t.k));
  for (const [k, m] of markers) if (!want.has(k)) { scene.remove(m); markers.delete(k); }
  for (const k of want) if (!markers.has(k)) { const m = new THREE.Mesh(markerGeo, markerMat); m.scale.y = 1.6; m.position.set(tiles[k].x, GROUND + 1.25, tiles[k].z); m.userData.base = m.position.y; scene.add(m); markers.set(k, m); }
}
const petMarker = new THREE.Group();
{ const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); const c = new THREE.Mesh(Co(0.07, 0.14, 6), b.material); c.position.set(0.05, -0.17, 0); c.rotation.z = 0.5; const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: '#c7a6ff' })); d.position.z = 0.15; petMarker.add(b, c, d); petMarker.visible = false; scene.add(petMarker); }

const cursor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }));
cursor.visible = false; scene.add(cursor);
const cursorEdge = new THREE.LineSegments(new THREE.EdgesGeometry(Bx(1, 0.02, 1)), new THREE.LineBasicMaterial({ color: '#ffffff' }));
cursor.add(cursorEdge);
const ghostOk = [Object.assign(vcMat.clone(), { transparent: true, opacity: 0.72, depthWrite: false }), Object.assign(winMat.clone(), { transparent: true, opacity: 0.72, depthWrite: false })];
const badMat = new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.6, depthWrite: false });
const ghostBad = [badMat, badMat];
const ghost = new THREE.Mesh(TYPES.cottage[0], ghostOk); ghost.visible = false; scene.add(ghost);
const radiusMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.3, depthWrite: false }), 121);
radiusMesh.count = 0; scene.add(radiusMesh);
const expandMesh = new THREE.InstancedMesh(Bx(0.92, 0.12, 0.92), new THREE.MeshBasicMaterial({ color: '#bfffd0', transparent: true, opacity: 0.32, depthWrite: false }), N * N);
expandMesh.count = 0; expandMesh.frustumCulled = false; scene.add(expandMesh);
function refreshExpandOverlay() {
  let c = 0;
  if (tool === 'expand') for (const t of tiles) if (!canExpand(t) || (!t.land && DIRS.some(([a, b]) => { const n = T(t.i + a, t.j + b); return n && n.land; }))) {
    if (t.land) continue;
    tmpO.position.set(t.x, GROUND - 0.06, t.z); tmpO.scale.set(1, 1, 1); tmpO.rotation.set(0, 0, 0); tmpO.updateMatrix(); expandMesh.setMatrixAt(c++, tmpO.matrix);
  }
  expandMesh.count = c; expandMesh.instanceMatrix.needsUpdate = true;
}
function showRadius(t, r) {
  let c = 0;
  if (t && r) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const n = T(t.i + a, t.j + b); if (n && n.land) { tmpO.position.set(n.x, topOf(n) + 0.03, n.z); tmpO.scale.set(1, 1, 1); tmpO.rotation.set(0, 0, 0); tmpO.updateMatrix(); radiusMesh.setMatrixAt(c++, tmpO.matrix); } }
  radiusMesh.count = c; radiusMesh.instanceMatrix.needsUpdate = true;
}

/* ================= walkers ================= */
const MAXW = 70;
const walkBody = new THREE.InstancedMesh(Cy(0.045, 0.06, 0.16, 6).translate(0, 0.08, 0), white, MAXW);
const walkHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshStandardMaterial({ color: '#f1c7a0', flatShading: true }), MAXW);
walkBody.castShadow = true; walkBody.frustumCulled = false; walkHead.frustumCulled = false;
const SHIRTS = ['#d94f4f', '#4f8fd9', '#7fbf4a', '#ffd166', '#b388ff', '#ff9f43', '#f5f2ea'];
for (let i = 0; i < MAXW; i++) walkBody.setColorAt(i, tmpC.set(SHIRTS[i % SHIRTS.length]));
scene.add(walkBody, walkHead);
const walkers = [];
function roadNeighbors(t) { const r = []; for (const [a, b] of DIRS) { const n = T(t.i + a, t.j + b); if (n && n.land && n.road && n.conn) r.push(n); } return r; }
function spawnWalker() {
  const roads = tiles.filter(t => t.road && t.conn); if (!roads.length) return null;
  const from = pick(roads), nb = roadNeighbors(from);
  return { from, to: nb.length ? pick(nb) : from, prev: null, t: Math.random(), v: R(0.5, 0.8), lane: R(-0.2, 0.2), ph: R(0, 6) };
}
function updateWalkers(dt) {
  const want = Math.min(MAXW, Math.floor(S.pop / 2));
  while (walkers.length < want) { const w = spawnWalker(); if (!w) break; walkers.push(w); }
  while (walkers.length > want) walkers.pop();
  for (let i = 0; i < walkers.length; i++) {
    let w = walkers[i];
    if (!w.from.road || !w.to.road || !w.from.conn) { const n = spawnWalker(); if (!n) { walkers.length = i; break; } walkers[i] = w = n; }
    w.t += dt * w.v;
    if (w.t >= 1) {
      w.t -= 1; const nb = roadNeighbors(w.to).filter(n => n !== w.from);
      const all = roadNeighbors(w.to);
      w.prev = w.from; w.from = w.to; w.to = nb.length ? pick(nb) : (all.length ? pick(all) : w.to);
    }
    const dx = w.to.x - w.from.x, dz = w.to.z - w.from.z;
    const x = w.from.x + dx * w.t + (-dz) * w.lane * (dx || dz ? 1 : 0), z = w.from.z + dz * w.t + dx * w.lane;
    const y = GROUND + Math.abs(Math.sin((w.t + w.ph) * Math.PI * 4)) * 0.025;
    tmpO.position.set(x, y, z); tmpO.rotation.set(0, Math.atan2(dx, dz), 0); tmpO.scale.set(1, 1, 1); tmpO.updateMatrix(); walkBody.setMatrixAt(i, tmpO.matrix);
    tmpO.position.y = y + 0.2; tmpO.updateMatrix(); walkHead.setMatrixAt(i, tmpO.matrix);
  }
  walkBody.count = walkHead.count = walkers.length;
  walkBody.instanceMatrix.needsUpdate = walkHead.instanceMatrix.needsUpdate = true;
  if (walkBody.instanceColor) walkBody.instanceColor.needsUpdate = true;
}

/* ================= sky dressing ================= */
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
const clouds = [];
for (let k = 0; k < 9; k++) {
  const g = new THREE.Group(); scene.add(g);
  for (let p = 0, n = 4 + (Math.random() * 3 | 0); p < n; p++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(R(0.7, 1.3), 1), cloudMat); m.position.set(p * 1 - n * 0.5, R(-0.2, 0.4), R(-0.5, 0.5)); m.scale.y = 0.65; g.add(m); }
  clouds.push({ g, a: k / 9 * Math.PI * 2, off: R(5, 11), y: R(-6, 6), sp: R(0.01, 0.025) });
}
const rocks = [];
for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.2, 0.55), 0), new THREE.MeshStandardMaterial({ color: '#7b746c', flatShading: true })); scene.add(m); rocks.push({ m, a: R(0, 6.28), off: R(3, 7), y: R(-6, 2), ph: R(0, 6) }); }
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#fff', size: 2.2 * DPR, map: glowTex(), transparent: true, depthWrite: false, opacity: 0 }));
{ const a = []; for (let k = 0; k < 700; k++) a.push(R(-95, 95), R(-60, 60), -900); stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); stars.frustumCulled = false; camera.add(stars); }

/* ================= day / night ================= */
const C = h => new THREE.Color(h);
const SKY = { dayT: C('#4f9fe8'), dayB: C('#cdeaff'), duskT: C('#4b4f9a'), duskB: C('#ffb38a'), nightT: C('#0b1030'), nightB: C('#2a3266') };
const cTop = new THREE.Color(), cBot = new THREE.Color(), sunCol = new THREE.Color(), moonCol = C('#9fb4ff');
const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), dir = new THREE.Vector3();
let night = 0, lastBg = '';
function applyTime(h) {
  const a = (h - 6) / 24 * Math.PI * 2, elev = Math.sin(a);
  const dl = smooth(-0.2, 0.28, elev); night = 1 - dl;
  const dusk = Math.exp(-((elev / 0.24) ** 2));
  sunDir.set(-Math.cos(a) * 0.85, Math.max(elev, 0), 0.55); moonDir.set(0.55, Math.max(-elev, 0.4), 0.75);
  dir.copy(moonDir).lerp(sunDir, dl); dir.y = Math.max(dir.y, 0.3); dir.normalize();
  sun.position.copy(dir).multiplyScalar(60);
  sunCol.set('#ffb27a').lerp(C('#fff3df'), smooth(0, 0.6, elev));
  sun.color.copy(moonCol).lerp(sunCol, dl); sun.intensity = lerp(0.95, 2.6, dl);
  hemi.intensity = lerp(0.8, 1.0, dl); hemi.color.set('#6f80c8').lerp(C('#d4ecff'), dl); hemi.groundColor.set('#544c72').lerp(C('#6b5640'), dl);
  cTop.copy(SKY.nightT).lerp(SKY.dayT, dl).lerp(SKY.duskT, dusk * 0.7);
  cBot.copy(SKY.nightB).lerp(SKY.dayB, dl).lerp(SKY.duskB, dusk * 0.85);
  const bg = `linear-gradient(180deg, #${cTop.getHexString()} 0%, #${cBot.getHexString()} 85%)`;
  if (bg !== lastBg) { lastBg = bg; document.body.style.background = bg; }
  cloudMat.color.set('#b9bdd8').lerp(C('#ffffff'), dl).lerp(C('#ffc6b0'), dusk * 0.5);
  const lit = smooth(0.3, 0.8, night);
  winMat.emissiveIntensity = 0.05 + 2.4 * lit; crystalMat.emissiveIntensity = 0.5 + 1.8 * lit;
  stars.material.opacity = smooth(0.5, 1, night);
}

/* ================= UI ================= */
const ui = { coins: $('#v-coins'), net: $('#v-net'), pop: $('#v-pop'), jobs: $('#v-jobs'), happy: $('#v-happy'), food: $('#v-food'), rank: $('#rank'), rankFill: $('#rank-fill'), rankNext: $('#rank-next'), day: $('#v-day'), clock: $('#v-clock') };
function bump(id) { const el = $(`#s-${id}`); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function updateHUD() {
  ui.coins.textContent = fmtN(Math.floor(S.coins));
  ui.coins.parentElement.classList.toggle('bad', S.coins < 0);
  ui.net.textContent = `${ST.net >= 0 ? '+' : '−'}${fmtN(Math.abs(ST.net))} a day`;
  ui.net.classList.toggle('bad', ST.net < 0);
  ui.pop.textContent = `${fmtN(S.pop)} / ${fmtN(ST.housing)}`;
  ui.jobs.textContent = `${fmtN(ST.employed)} / ${fmtN(ST.jobs)}`;
  ui.happy.textContent = `${ST.happy}%`;
  ui.happy.parentElement.classList.toggle('bad', ST.happy < 45);
  ui.food.textContent = `${fmtN(ST.food)} / ${fmtN(S.pop)}`;
  ui.food.parentElement.classList.toggle('bad', !ST.foodOK);
  const r = ST.rank, nx = RANKS[r + 1];
  ui.rank.textContent = RANKS[r].name;
  if (nx) { const p = (S.pop - RANKS[r].pop) / (nx.pop - RANKS[r].pop); ui.rankFill.style.width = `${clamp(p, 0, 1) * 100}%`; ui.rankNext.textContent = `${nx.pop - S.pop} more settlers to ${nx.name}`; }
  else { ui.rankFill.style.width = '100%'; ui.rankNext.textContent = 'The highest charter in the sky'; }
}
function fmtClock(f) { const m = Math.floor(((f * 24 + 6) % 24) * 60), h = Math.floor(m / 60), mm = m % 60; return `${(h + 11) % 12 + 1}:${String(mm - mm % 10).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }

// toolbar
const TOOL_HELP = {
  inspect: matchMedia('(pointer:coarse)').matches ? 'Tap anything to see what it does. Drag to pan, pinch to zoom.' : 'Hover anything to see what it does. Drag to pan, right-drag to orbit, scroll to zoom.',
  road: 'Roads cost 5 coins. Click or drag to lay them. Buildings must touch a road connected to the town hall.',
  bulldoze: 'Click to demolish (half refund), remove roads, or clear forest and boulders.',
  expand: 'Click a glowing slot beside the island to raise new land. Each tile costs a little more.'
};
const thumbs = {};
function makeThumbs() {
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(128, 128); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xd4ecff, 0x6b5640, 1.2)); const dl = new THREE.DirectionalLight(0xfff3df, 2.4); dl.position.set(3, 5, 4); sc.add(dl);
    const cam = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 50); cam.position.set(5, 5, 5); cam.lookAt(0, 0.45, 0);
    const tile = new THREE.Mesh(Bx(1, 0.22, 1).translate(0, -0.11, 0), new THREE.MeshStandardMaterial({ color: '#7cc15a', flatShading: true })); sc.add(tile);
    for (const type of ORDER) {
      const m = new THREE.Mesh(TYPES[type][type === 'cottage' ? 0 : 0], MATS); sc.add(m);
      let ex = null;
      if (type === 'windmill') { ex = new THREE.Mesh(bladesGeo, vcMat); ex.position.set(0, 0.85, 0.27); m.add(ex); }
      if (type === 'mine') { ex = new THREE.Mesh(mineCrystalGeo, crystalMat); m.add(ex); tile.material.color.set('#8fb873'); }
      if (type === 'dock') { ex = new THREE.Mesh(shipGeo, vcMat); ex.position.set(0, 0.95, 1.05); m.add(ex); m.position.z = -0.3; }
      r.render(sc, cam); thumbs[type] = r.domElement.toDataURL();
      sc.remove(m); m.position.z = 0; tile.material.color.set('#7cc15a');
    }
    r.dispose(); r.forceContextLoss();
  } catch (e) { /* thumbnails optional */ }
}
const ICONS = {
  inspect: '<path d="M5 3l14 7-6 2-2 6z" fill="currentColor"/>',
  road: '<path d="M8 3l-3 18M16 3l3 18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M12 5v3M12 11v3M12 17v3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  bulldoze: '<path d="M4 20h16M6 20l2-9h8l2 9M9 11V7h6v4" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  expand: '<path d="M4 16l8 4 8-4-8-4z" fill="currentColor" opacity=".55"/><path d="M12 3v8M8 7l4-4 4 4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
};
let tool = 'inspect';
function buildToolbar() {
  const tools = ['inspect', 'road', 'bulldoze', 'expand'].map(t => `<button class="tool" type="button" data-tool="${t}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t]}</svg><span>${{ inspect: 'Inspect', road: 'Road', bulldoze: 'Clear', expand: 'Expand' }[t]}</span></button>`).join('');
  const cards = ORDER.map((t, i) => `<button class="card" type="button" data-tool="${t}" aria-pressed="false"><img alt="" src="${thumbs[t] || ''}"><span class="nm">${DEFS[t].name}</span><span class="cost">${DEFS[t].cost}</span><span class="lock"></span></button>`).join('');
  $('#tools').innerHTML = tools; $('#cards').innerHTML = cards;
  for (const b of document.querySelectorAll('[data-tool]')) {
    b.addEventListener('click', () => setTool(tool === b.dataset.tool && b.dataset.tool !== 'inspect' ? 'inspect' : b.dataset.tool));
    b.addEventListener('mouseenter', () => { if (DEFS[b.dataset.tool]) setStatus(cardHelp(b.dataset.tool)); });
    b.addEventListener('mouseleave', () => setStatus(helpFor(tool)));
  }
}
function cardHelp(t) { const d = DEFS[t]; const lock = d.rank > ST.rank ? ` Unlocks at ${RANKS[d.rank].name}.` : ''; return `${d.name}, ${d.cost} coins. ${d.desc}${lock}`; }
const TOUCH = matchMedia('(pointer:coarse)').matches;
function helpFor(t) { const h = DEFS[t] ? cardHelp(t) : TOOL_HELP[t]; return TOUCH && t !== 'inspect' ? `${h} Use two fingers to move the camera.` : h; }
function refreshCards() {
  for (const b of document.querySelectorAll('.card')) {
    const d = DEFS[b.dataset.tool], locked = d.rank > ST.rank;
    b.classList.toggle('locked', locked); b.classList.toggle('poor', !locked && S.coins < d.cost);
    b.querySelector('.lock').textContent = locked ? RANKS[d.rank].name : '';
  }
}
const statusEl = $('#status');
function setStatus(s) { statusEl.textContent = s; }
function setTool(t) {
  tool = t;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  const building = t !== 'inspect';
  controls.mouseButtons.LEFT = building ? -1 : THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = building ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  controls.touches.ONE = building ? -1 : THREE.TOUCH.PAN;
  canvas.style.cursor = building ? 'crosshair' : '';
  if (DEFS[t]) ghost.geometry = TYPES[t][0];
  setStatus(helpFor(t));
  refreshExpandOverlay(); hoverDirty = true;
}

// quests
const qList = $('#quest-list');
function renderQuests() {
  let html = '';
  if (S.pet) {
    const t = tiles[S.pet.k], left = S.pet.due - S.day;
    html += `<li class="q pet"><div class="qt">${S.pet.family} family petition</div><div class="qd">${S.pet.kind === 'garden' ? 'Wants a garden or well within 2 tiles of their home' : 'Wants a market within 3 tiles of their home'}</div><div class="qrow"><span class="due">${left > 0 ? `${left} day${left > 1 ? 's' : ''} left` : 'Last day'}</span><span class="rw">+${S.pet.reward}</span><button type="button" class="mini" data-show="${t.k}">Show</button></div></li>`;
  }
  for (const q of S.active) {
    const Q = quest(q), v = Q.val(), done = v >= Q.goal, p = clamp(v / Q.goal, 0, 1);
    html += `<li class="q${done ? ' done' : ''}"><div class="qt">${Q.t}</div><div class="qd">${Q.d}</div><div class="bar"><i style="width:${p * 100}%"></i></div><div class="qrow"><span class="prog">${fmtN(Math.min(v, Q.goal))}${Q.pct ? '%' : ''} of ${fmtN(Q.goal)}${Q.pct ? '%' : ''}</span><span class="rw">+${Q.reward}</span>${done ? `<button type="button" class="mini claim" data-claim="${q}">Claim</button>` : Q.wait ? '<button type="button" class="mini" data-skip="12">Skip 12h</button>' : ''}</div></li>`;
  }
  qList.innerHTML = html;
  const n = S.active.filter(qDone).length;
  $('#q-badge').textContent = n ? String(n) : ''; $('#q-badge').hidden = !n;
}
qList.addEventListener('click', e => {
  const c = e.target.closest('[data-claim]');
  if (c) { const q = +c.dataset.claim, Q = quest(q); if (!qDone(q)) return; S.coins += Q.reward; bump('coins'); S.active = S.active.filter(x => x !== q); S.active.push(S.nextQ++); toast(`${Q.t} complete: +${Q.reward} coins`, 'good'); afterChange(); return; }
  const s = e.target.closest('[data-show]');
  if (s) { const t = tiles[+s.dataset.show]; const d = new THREE.Vector3(t.x, 0, t.z).sub(controls.target); controls.target.add(d); camera.position.add(d); }
});
$('#q-toggle').addEventListener('click', () => { const open = $('#quests').classList.toggle('open'); $('#q-toggle').setAttribute('aria-expanded', String(open)); });

// toasts
function toast(msg, kind = '') {
  const el = document.createElement('div'); el.className = `toast plate ${kind}`; el.textContent = msg;
  $('#toasts').prepend(el);
  while ($('#toasts').children.length > 4) $('#toasts').lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3800);
}

// speed
function setSpeed(s) { S.speed = s; for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(+b.dataset.speed === s)); }
for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => setSpeed(+b.dataset.speed));

// menu
$('#menu-btn').addEventListener('click', () => { $('#menu').hidden = false; });
$('#menu-close').addEventListener('click', () => { $('#menu').hidden = true; });
$('#new-game').addEventListener('click', () => { $('#menu').hidden = true; genIsland(); boot2(); toast('A fresh island rises from the clouds', 'good'); save(); });

/* ================= layout ================= */
function layout() {
  const top = $('.top').getBoundingClientRect().bottom, tray = $('.tray').getBoundingClientRect().top;
  const q = $('#quests'), ts = $('#toasts'), wide = innerWidth > 900;
  q.style.maxHeight = Math.max(160, tray - top - 20) + 'px';
  if (wide) { q.style.top = top + 8 + 'px'; q.style.bottom = 'auto'; ts.style.top = top + 8 + 'px'; ts.style.bottom = 'auto'; }
  else { q.style.top = 'auto'; q.style.bottom = innerHeight - tray + 8 + 'px'; ts.style.top = 'auto'; ts.style.bottom = innerHeight - tray + 8 + 'px'; }
  const c = $('#s-coins').getBoundingClientRect(), g = $('#gain');
  g.style.left = c.left + 8 + 'px'; g.style.top = c.bottom + 4 + 'px';
}
const layoutObs = new ResizeObserver(layout);
layoutObs.observe($('.top')); layoutObs.observe($('.tray'));
addEventListener('resize', layout);

/* ================= input ================= */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND), hitP = new THREE.Vector3();
let ptr = null, hoverDirty = false, hoverT = null, painting = false, downAt = null, lastPaintK = -1;
const pointers = new Set();
function pickTile(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (tool === 'expand') { if (!ray.ray.intersectPlane(plane, hitP)) return null; return tileAtW(hitP.x, hitP.z); }
  const hit = ray.intersectObjects([...pickables], false)[0];
  if (!hit) { if (ray.ray.intersectPlane(plane, hitP)) { const t = tileAtW(hitP.x, hitP.z); return t && t.land ? t : null; } return null; }
  return tiles[hit.object === capMesh ? hit.instanceId : hit.object.userData.k] || null;
}
function apply(t, isDrag) {
  if (!t) return;
  if (tool === 'road') { if (canRoad(t) === '') doRoad(t); else if (!isDrag) toast(canRoad(t), 'warn'); }
  else if (tool === 'bulldoze') doBulldoze(t);
  else if (tool === 'expand') { if (!isDrag) doExpand(t); }
  else if (DEFS[tool] && !isDrag) doBuild(tool, t);
  hoverDirty = true;
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  pointers.add(e.pointerId);
  if (pointers.size > 1) { painting = false; return; }
  downAt = { x: e.clientX, y: e.clientY };
  if (tool !== 'inspect' && e.button === 0) {
    painting = true; lastPaintK = -1;
    if (tool === 'road' || tool === 'bulldoze') { const t = pickTile(e.clientX, e.clientY); if (t) { lastPaintK = t.k; apply(t, false); } }
  }
});
canvas.addEventListener('pointermove', e => {
  ptr = { x: e.clientX, y: e.clientY }; hoverDirty = true;
  if (painting && (tool === 'road' || tool === 'bulldoze')) { const t = pickTile(e.clientX, e.clientY); if (t && t.k !== lastPaintK) { lastPaintK = t.k; apply(t, true); } }
});
const endPtr = e => {
  pointers.delete(e.pointerId);
  if (painting && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && tool !== 'road' && tool !== 'bulldoze') apply(pickTile(e.clientX, e.clientY), false);
  if (e.pointerType !== 'mouse' && tool === 'inspect' && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) { ptr = { x: e.clientX, y: e.clientY }; hoverDirty = true; }
  painting = false; downAt = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ptr = null; hoverDirty = true; } });
controls.addEventListener('change', () => { hoverDirty = true; });

const tip = $('#tip'), tipName = $('#tip-name'), tipDesc = $('#tip-desc');
function tileInfo(t) {
  if (t.b) {
    const b = t.b, d = DEFS[b.type];
    if (b.type === 'hall') return [`${S.name} Town Hall`, `Every road starts here. ${S.pop} settlers, ${tiles.filter(x => x.road && x.conn).length} connected road tiles.`];
    const lines = [];
    if (!b.ok && !d.free) lines.push('Closed: needs a road connected to the town hall.');
    if (HOUSES.has(b.type) && b.ok) lines.push(`${b.res || 0} of ${b.cap} settlers. Appeal ${b.appeal}.`);
    if (d.jobs && b.ok) lines.push(`${d.jobs} jobs, ${Math.round(ST.jobs ? ST.employed / ST.jobs * 100 : 0)}% staffed.${b.earn ? ` Earns ${b.earn} a day.` : ''}`);
    if (d.appeal) lines.push(`+${d.appeal} appeal within ${d.radius} tiles.`);
    if (S.pet && S.pet.k === t.k) lines.push(`The ${S.pet.family} family has a petition.`);
    return [d.name, lines.join(' ') || d.desc];
  }
  if (t.road) return ['Road', t.conn ? 'Connected to the town hall.' : 'Not connected to the town hall yet.'];
  return ({ grass: ['Meadow', 'Open ground, ready to build on.'], forest: ['Forest', 'Clearing it costs 10 coins. Lumber mills earn from forest beside them.'], rock: ['Boulder', 'Clear for 40 coins.'], water: ['Pond', 'Nothing can be built on water.'], crystal: ['Crystal vein', 'Only a crystal mine can be built here.'] })[t.terr];
}
function updateHover() {
  hoverT = ptr ? pickTile(ptr.x, ptr.y) : null;
  const t = hoverT;
  ghost.visible = false; showRadius(null, 0);
  if (!t || (!t.land && tool !== 'expand')) { cursor.visible = false; tip.hidden = true; return; }
  let name = '', desc = '', ok = true;
  if (tool === 'inspect') { [name, desc] = tileInfo(t); if (t.b && DEFS[t.b.type]?.radius) showRadius(t, DEFS[t.b.type].radius); }
  else if (tool === 'road') { const e = canRoad(t); ok = !e; name = 'Road'; desc = e || `${5 + clearCost(t)} coins`; }
  else if (tool === 'bulldoze') { const i = bulldozeInfo(t); ok = !i.err; name = 'Clear'; desc = i.err || i.label; }
  else if (tool === 'expand') { const e = canExpand(t); ok = !e; name = 'Raise land'; desc = e || `${expandCost()} coins`; }
  else {
    const e = canPlace(tool, t); ok = !e; const d = DEFS[tool];
    name = d.name; desc = e || `${d.cost + clearCost(t)} coins${clearCost(t) ? ' (includes clearing)' : ''}`;
    if (t.land && !t.b && !t.road) {
      ghost.visible = true; ghost.material = ok ? ghostOk : ghostBad;
      const [a, b] = roadDirFor(t, d.edge); ghost.position.set(t.x, GROUND + 0.01, t.z); ghost.rotation.y = Math.atan2(a, b);
      if (ok && !DIRS.some(([x, z]) => { const n = T(t.i + x, t.j + z); return n && n.conn; }) && !d.free) desc += '. No road here yet.';
    }
    if (d.radius) showRadius(t, d.radius);
  }
  cursor.visible = true;
  cursor.position.set(t.x, (t.land ? topOf(t) : GROUND) + 0.02, t.z);
  cursor.material.color.set(tool === 'bulldoze' ? (ok ? '#ff8a6b' : '#ffffff') : ok ? '#ffffff' : '#ff6b6b');
  cursor.material.opacity = tool === 'inspect' ? 0.2 : 0.35;
  tipName.textContent = name; tipDesc.textContent = desc; tip.hidden = false; tip.classList.toggle('err', !ok);
  const r = tip.getBoundingClientRect();
  tip.style.left = clamp(ptr.x + 16, 8, innerWidth - r.width - 8) + 'px';
  tip.style.top = clamp(ptr.y + 18, 8, innerHeight - r.height - 8) + 'px';
}

// keys
const UP = new THREE.Vector3(0, 1, 0);
let pendingTurn = 0;
function rotateCam(step) { const off = camera.position.clone().sub(controls.target).applyAxisAngle(UP, step); camera.position.copy(controls.target).add(off); }
function turn(d) { if (reduce) rotateCam(d * Math.PI / 2); else pendingTurn += d * Math.PI / 2; }
$('#turn-l').addEventListener('click', () => turn(-1));
$('#turn-r').addEventListener('click', () => turn(1));
addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') setTool('inspect');
  else if (k === 'r') setTool('road'); else if (k === 'b' || k === 'c') setTool('bulldoze'); else if (k === 'x') setTool('expand');
  else if (k === 'q') turn(-1); else if (k === 'e') turn(1);
  else if (k === ' ') { e.preventDefault(); setSpeed(S.speed ? 0 : 1); }
  else if (/^[1-9]$/.test(k)) { const t = ORDER[+k - 1]; if (t) setTool(t); }
});

/* ================= time ================= */
const DAY_LEN = 300;            // one in-game day = 5 real minutes at 1x
const IDLE_MS = 120000;         // pause after 2 minutes without input
function immigrate(quiet) {
  const free = ST.housing - S.pop;
  let arrive = 0, leave = 0;
  if (ST.happy >= 45 && free > 0) {
    const cap = 1 + Math.floor(S.pop * 0.05);
    arrive = ST.jobs > S.pop ? Math.min(cap, ST.jobs - S.pop + 1) : (Math.random() < 0.35 ? 1 : 0);
    if (ST.happy >= 70 && Math.random() < 0.5) arrive += 1;
    if (ST.dock) arrive = Math.ceil(arrive * 1.5);
    arrive = Math.min(arrive, free);
  }
  if (ST.happy < 30 && S.pop > 0 && Math.random() < 0.5) leave = Math.max(1, Math.floor(S.pop * 0.02));
  S.pop = Math.max(0, S.pop + arrive - leave);
  if (!quiet) {
    if (arrive) { toast(arrive === 1 ? `A settler moved in. Welcome to ${S.name}!` : `${arrive} settlers moved in`, 'good'); bump('pop'); }
    if (leave) toast(`${leave} settler${leave > 1 ? 's' : ''} left: happiness is too low`, 'warn');
  }
}
function hourTick(h, quiet) {
  recomputeSim();
  S.coins += ST.net / 24;
  if (h % 3 === 0) immigrate(quiet);
}
function dayTick(quiet) {
  S.day++;
  recomputeSim();
  const free = ST.housing - S.pop;
  if (!quiet) {
    if (!ST.foodOK) toast('Settlers are hungry. Build a farm.', 'warn');
    else if (S.pop > 0 && free <= 0 && ST.happy >= 45) toast('Every home is full. Build more cottages.', '');
    else if (ST.happy < 45 && S.pop > 0) toast('Settlers won\u2019t come until happiness is 45%+', 'warn');
  }
  if (S.pet && S.day > S.pet.due) { toast(`The ${S.pet.family} family gave up waiting`, 'warn'); S.pet = null; S.nextPet = S.day + 1; }
  if (!S.pet && S.day >= S.nextPet) {
    const homes = tiles.filter(t => t.b && t.b.type === 'cottage' && t.b.ok);
    if (homes.length >= 2) { const h = pick(homes); const kind = ST.rank >= 1 && Math.random() < 0.4 ? 'market' : 'garden'; S.pet = { k: h.k, family: pick(FAMILIES), kind, due: S.day + 2, reward: kind === 'market' ? 200 : 120 }; toast(`New petition from the ${S.pet.family} family`, ''); }
    S.nextPet = S.day + 1 + Math.floor(Math.random() * 2);
  }
  saveSoon();
}
// move the clock forward, firing an hour tick at every hour boundary
function advance(days, quiet) {
  let left = days;
  while (left > 1e-9) {
    const next = (Math.floor(S.f * 24 + 1e-7) + 1) / 24;
    const step = Math.min(left, next - S.f);
    S.f += step; left -= step;
    if (S.f >= next - 1e-7) {
      S.f = next;
      if (S.f >= 1 - 1e-7) { S.f = 0; dayTick(quiet); }
      hourTick(Math.round(S.f * 24), quiet);
    }
  }
}
function skip(hours) {
  const c0 = Math.floor(S.coins), p0 = S.pop;
  advance(hours / 24, true);
  const dc = Math.floor(S.coins) - c0, dp = S.pop - p0;
  showGain(dc); bump('coins'); if (dp) bump('pop');
  toast(`${hours} hours later: ${dc >= 0 ? '+' : '\u2212'}${fmtN(Math.abs(dc))} coins, ${dp >= 0 ? '+' : '\u2212'}${Math.abs(dp)} settler${Math.abs(dp) === 1 ? '' : 's'}`, 'good');
  $('#skip-pop').hidden = true; $('#skip-btn').setAttribute('aria-expanded', 'false');
  afterChange();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-skip]'); if (b) skip(+b.dataset.skip); });
$('#skip-btn').addEventListener('click', () => { const p = $('#skip-pop'); p.hidden = !p.hidden; $('#skip-btn').setAttribute('aria-expanded', String(!p.hidden)); });

// time only moves while the player is here
const pausedBy = new Set();
let lastInput = performance.now();
function setAway(reason, on) { if (on) pausedBy.add(reason); else pausedBy.delete(reason); $('#away').hidden = !pausedBy.has('idle'); lastClock = ''; }
function markInput() { lastInput = performance.now(); if (pausedBy.has('idle')) setAway('idle', false); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { setAway('hidden', true); save(); } else { setAway('hidden', false); markInput(); } });
addEventListener('blur', () => setAway('blur', true));
addEventListener('focus', () => { setAway('blur', false); markInput(); });
addEventListener('pagehide', () => save());
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, markInput, { passive: true, capture: true });

function checkPetition() {
  if (!S.pet) return;
  const h = tiles[S.pet.k];
  if (!h.b || !HOUSES.has(h.b.type)) { S.pet = null; renderQuests(); return; }
  const met = tiles.some(t => t.b && (S.pet.kind === 'garden' ? (['garden', 'well'].includes(t.b.type) && cheb(t, h) <= 2) : (t.b.type === 'market' && t.b.ok && cheb(t, h) <= 3)));
  if (met) { S.coins += S.pet.reward; bump('coins'); toast(`The ${S.pet.family} family thanks you: +${S.pet.reward} coins`, 'good'); S.pet = null; S.nextPet = S.day + 1; afterChange(); }
}
function showGain(n) { const el = $('#gain'); el.textContent = `${n >= 0 ? '+' : '−'}${fmtN(Math.abs(n))}`; el.className = n >= 0 ? 'show' : 'show bad'; void el.offsetWidth; }
let readySeen = new Set(), lastClock = '';
function checkQuests() {
  for (const q of S.active) if (qDone(q) && !readySeen.has(q)) { readySeen.add(q); toast(`Quest ready to claim: ${quest(q).t}`, 'good'); renderQuests(); }
}

/* ================= loop ================= */
let last = performance.now(), time = 0, questTick = 0;
function clampTarget() {
  const t = controls.target, r = Math.hypot(t.x, t.z), max = islandR + 2;
  if (r > max) { const k = max / r, dx = t.x * k - t.x, dz = t.z * k - t.z; t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
}
function loop() {
  const now = performance.now(), rdt = Math.min(0.05, (now - last) / 1000); last = now; time += rdt;
  if (!pausedBy.has('idle') && now - lastInput > IDLE_MS) setAway('idle', true);
  const spd = pausedBy.size ? 0 : S.speed, gdt = rdt * spd;
  if (spd) advance(gdt / DAY_LEN, false);
  applyTime((S.f * 24 + 6) % 24);
  const c = `Day ${S.day}`, cl = pausedBy.size ? 'Paused' : fmtClock(S.f);
  if (c + cl !== lastClock) { lastClock = c + cl; ui.day.textContent = c; ui.clock.textContent = cl; }
  if (pendingTurn) { const st = Math.abs(pendingTurn) < 0.002 ? pendingTurn : pendingTurn * Math.min(1, rdt * 7); rotateCam(st); pendingTurn -= st; hoverDirty = true; }
  controls.update(); clampTarget();
  // tile rise animations
  let moved = false;
  for (const t of tiles) if (t.anim > 0 && t.anim < 1) { t.anim = Math.min(1, t.anim + rdt * 1.8); writeTile(t); moved = true; if (t.anim >= 1) t.anim = 0; }
  if (moved) flushTiles();
  for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t = Math.min(1, a.t + rdt * 2.4); const s = a.t; const e = 1 + 2.2 * Math.pow(s - 1, 3) + 1.2 * Math.pow(s - 1, 2); a.m.scale.set(1, Math.max(0.01, s >= 1 ? 1 : e), 1); if (a.t >= 1) anims.splice(i, 1); }
  for (const t of tiles) if (t.b && t.b.extra) { if (t.b.type === 'windmill') t.b.extra.rotation.z -= rdt * (0.6 + S.speed * 0.3); else t.b.extra.position.y = 0.95 + Math.sin(time * 1.2 + t.k) * 0.08; }
  for (const [, m] of markers) m.position.y = m.userData.base + Math.sin(time * 3) * 0.08, m.rotation.y += rdt * 2;
  if (S.pet) { const h = tiles[S.pet.k]; petMarker.visible = true; petMarker.position.set(h.x, GROUND + 1.25 + Math.sin(time * 2.5) * 0.08, h.z); } else petMarker.visible = false;
  for (const c of clouds) { c.a += c.sp * rdt; const r = islandR + c.off; c.g.position.set(Math.cos(c.a) * r, c.y, Math.sin(c.a) * r); c.g.rotation.y = -c.a; }
  for (const r of rocks) { r.a += rdt * 0.02; const d = islandR + r.off; r.m.position.set(Math.cos(r.a) * d, r.y + Math.sin(time * 0.6 + r.ph) * 0.3, Math.sin(r.a) * d); r.m.rotation.y += rdt * 0.2; }
  updateWalkers(gdt);
  questTick += rdt; if (questTick > 0.5) { questTick = 0; recomputeSim(); updateHUD(); checkQuests(); checkPetition(); refreshCards(); }
  if (hoverDirty) { hoverDirty = false; updateHover(); }
  renderer.render(scene, camera);
}

/* ================= boot ================= */
function boot2() {
  readySeen = new Set();
  controls.target.set(0, 0, 0); camera.position.copy(HOME); camera.zoom = 1.3; camera.updateProjectionMatrix();
  recomputeSim(); setSpeed(S.speed ?? 1); updateHUD(); renderQuests(); refreshCards(); setTool('inspect');
  $('#isle-name').textContent = S.name;
}
function start(data) {
  makeThumbs(); buildToolbar();
  let loaded = false;
  const tryLoad = d => { try { if (d && d.v === 1 && d.land && d.land.length === N * N) { deserialize(d); loaded = true; } } catch (e) { loaded = false; } };
  if (data && data.v) tryLoad(data);
  if (!loaded) { try { tryLoad(JSON.parse(localStorage.getItem('skyhaven-v1') || 'null')); } catch (e) { /* no storage */ } }
  if (!loaded) genIsland();
  boot2();
  if (!loaded) toast('Welcome! Start with the quest board: lay roads, then cottages.', 'good');
  addEventListener('beforeunload', save);
  setInterval(save, 15000);
  renderer.setAnimationLoop(loop);
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
