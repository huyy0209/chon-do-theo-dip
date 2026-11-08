// =============================================================
// fabric.js — Vật liệu vải bán thực tế (PBR) theo chất liệu
// Vân vải sinh bằng code (không cần file ảnh): height map -> normal map lặp lại liền mạch.
// UV của lưới tính theo mét thật, nên "tile" = số mét cho 1 ô vân.
// =============================================================
import * as THREE from 'three';

const S = 256; // kích thước texture

// Nhiễu giá trị lặp liền mạch (tileable value noise)
function makeNoise(seed, cells) {
  const g = new Float32Array(cells * cells);
  let s = seed;
  for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = (s % 10000) / 10000; }
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  return (u, v) => {
    const x = u * cells, y = v * cells;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// Nhiễu tế bào (Worley) cho vân da
function makeCells(seed, count) {
  const pts = [];
  let s = seed;
  const r = () => { s = (s * 48271) % 2147483647; return (s % 100000) / 100000; };
  for (let i = 0; i < count; i++) pts.push([r(), r()]);
  return (u, v) => {
    let d1 = 9, d2 = 9;
    for (const [px, py] of pts) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const d = Math.hypot(u - px - ox, v - py - oy);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
    }
    return d2 - d1;
  };
}

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);

// Hàm độ cao (0..1) cho từng loại vải, u, v trong [0, 1)
const HEIGHT = {
  cotton: () => { const n = makeNoise(7, 32); return (u, v) => 0.5 + 0.25 * Math.sin(TAU * 40 * v) * Math.sin(TAU * 20 * u) + 0.25 * (n(u, v) - 0.5); },
  denim: () => {
    const n = makeNoise(11, 64);
    return (u, v) => 0.5 + 0.4 * Math.sin(TAU * (12 * u + 12 * v)) + 0.25 * (n(u * 4 % 1, v) - 0.5);
  },
  kaki: () => { const n = makeNoise(13, 32); return (u, v) => 0.5 + 0.3 * Math.sin(TAU * (16 * u + 16 * v)) + 0.1 * (n(u, v) - 0.5); },
  lanh: () => {
    const n = makeNoise(17, 16), m = makeNoise(19, 64);
    return (u, v) => 0.5 + 0.22 * Math.sin(TAU * 24 * u) * Math.sin(TAU * 24 * v) + 0.35 * (n(0, v * 1) - 0.5) * (m(u, v) > 0.6 ? 1 : 0.3);
  },
  len: () => {
    // Mũi đan kiểu "V" xếp cột
    const n = makeNoise(23, 16);
    return (u, v) => {
      const col = frac(u * 8), row = v * 10;
      const vshape = Math.abs(col - 0.5) * 2;
      return 0.5 + 0.4 * Math.cos(TAU * (row + vshape * 0.5)) * (1 - 0.6 * vshape) + 0.1 * (n(u, v) - 0.5);
    };
  },
  lua: () => { const n = makeNoise(29, 8); return (u, v) => 0.5 + 0.06 * (n(u, v) - 0.5); },
  voan: () => (u, v) => 0.5 + 0.12 * Math.sin(TAU * 60 * u) * Math.sin(TAU * 60 * v),
  da: () => { const c = makeCells(31, 90); const n = makeNoise(37, 32); return (u, v) => 0.4 + 1.6 * Math.min(0.3, c(u, v)) + 0.1 * n(u, v); },
  kim_loai: () => () => 0.5,
};

// Màu biến thiên (nhân vào màu gốc) để vải bớt "phẳng nhựa"
const ALBEDO = {
  denim: () => { const n = makeNoise(41, 32); return (u, v) => 0.82 + 0.3 * Math.max(0, Math.sin(TAU * (12 * u + 12 * v))) * 0.5 + 0.18 * n(u, v); },
  lanh: () => { const n = makeNoise(43, 16); return (u, v) => 0.9 + 0.12 * n(0, v); },
  len: () => { const n = makeNoise(47, 32); return (u, v) => 0.88 + 0.12 * n(u, v); },
};

// Tham số vật liệu + kích thước 1 ô vân (mét)
export const FABRIC = {
  cotton: { tile: 0.02, normal: 0.45, roughness: 0.86, sheen: 0.45, sheenRoughness: 0.65 },
  denim: { tile: 0.025, normal: 0.9, roughness: 0.78, sheen: 0.25, sheenRoughness: 0.7 },
  kaki: { tile: 0.02, normal: 0.35, roughness: 0.72, sheen: 0.2, sheenRoughness: 0.6 },
  lanh: { tile: 0.04, normal: 0.6, roughness: 0.92, sheen: 0.3, sheenRoughness: 0.7 },
  len: { tile: 0.05, normal: 1.1, roughness: 0.96, sheen: 0.9, sheenRoughness: 0.85 },
  lua: { tile: 0.1, normal: 0.08, roughness: 0.38, sheen: 0.6, sheenRoughness: 0.42, anisotropy: 0.15, clearcoat: 0.05 },
  voan: { tile: 0.01, normal: 0.25, roughness: 0.62, sheen: 0.7, sheenRoughness: 0.5, opacity: 0.9 },
  da: { tile: 0.05, normal: 0.45, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.32 },
  kim_loai: { tile: 0.1, normal: 0, roughness: 0.22, metalness: 1 },
  cao_su: { tile: 0.02, normal: 0.2, roughness: 0.9 },
};

const cache = new Map();
function texturesFor(type) {
  if (cache.has(type)) return cache.get(type);
  const h = (HEIGHT[type] || HEIGHT.cotton)();
  const al = ALBEDO[type]?.();
  const hm = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hm[y * S + x] = h(x / S, y / S);
  const at = (x, y) => hm[((y + S) % S) * S + ((x + S) % S)];
  const nc = document.createElement('canvas'); nc.width = nc.height = S;
  const ng = nc.getContext('2d');
  const nd = ng.createImageData(S, S);
  const strength = 6;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      nd.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nd.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      nd.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nd.data[i + 3] = 255;
    }
  }
  ng.putImageData(nd, 0, 0);
  const normalMap = new THREE.CanvasTexture(nc);
  normalMap.colorSpace = THREE.NoColorSpace;
  let map = null;
  if (al) {
    const ac = document.createElement('canvas'); ac.width = ac.height = S;
    const ag = ac.getContext('2d');
    const ad = ag.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = Math.min(255, al(x / S, y / S) * 255 * 0.98);
      const i = (y * S + x) * 4;
      ad.data[i] = ad.data[i + 1] = ad.data[i + 2] = v; ad.data[i + 3] = 255;
    }
    ag.putImageData(ad, 0, 0);
    map = new THREE.CanvasTexture(ac);
    map.colorSpace = THREE.SRGBColorSpace;
  }
  for (const t of [normalMap, map]) {
    if (!t) continue;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  const res = { normalMap, map };
  cache.set(type, res);
  return res;
}

/**
 * Vật liệu vải PBR. k = mét cục bộ / mét thật (UV đang tính theo mét cục bộ).
 */
export function makeFabric(type, hex, { doubleSide = false, k = 1, darken = 1 } = {}) {
  const f = FABRIC[type] || FABRIC.cotton;
  const { normalMap, map } = texturesFor(type);
  const color = new THREE.Color(hex || '#cccccc');
  if (darken !== 1) color.multiplyScalar(darken);
  const rep = 1 / (f.tile * k);
  const nm = normalMap.clone(); nm.repeat.set(rep, rep); nm.needsUpdate = true;
  let mp = null;
  if (map) { mp = map.clone(); mp.repeat.set(rep, rep); mp.needsUpdate = true; }
  const sheenColor = color.clone().lerp(new THREE.Color(1, 1, 1), 0.35);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    map: mp,
    normalMap: f.normal ? nm : null,
    normalScale: new THREE.Vector2(f.normal, f.normal),
    roughness: f.roughness,
    metalness: f.metalness || 0,
    sheen: f.sheen || 0,
    sheenRoughness: f.sheenRoughness || 0.5,
    sheenColor,
    clearcoat: f.clearcoat || 0,
    clearcoatRoughness: f.clearcoatRoughness || 0.3,
    anisotropy: f.anisotropy || 0,
    side: doubleSide || f.opacity ? THREE.DoubleSide : THREE.FrontSide,
    transparent: Boolean(f.opacity),
    opacity: f.opacity || 1,
    envMapIntensity: 1,
  });
  if (f.anisotropy) mat.anisotropyRotation = Math.PI / 2; // vệt sáng chạy dọc thân
  return mat;
}
