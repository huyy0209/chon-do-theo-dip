// =============================================================
// geom.js — Dựng lưới dạng ống (tube) có skin weights để bám theo khung xương VRM
// =============================================================
import * as THREE from 'three';

/**
 * Trọng số theo chuỗi xương: t là vị trí dọc chuỗi, joints[i] là vị trí khớp đầu của bones[i].
 * Gần khớp thì trộn 2 xương liền nhau (vùng trộn rộng 'blend') cho chỗ gập mềm.
 */
export function chainWeights(t, joints, bones, blend) {
  let i = 0;
  while (i < joints.length - 1 && t >= joints[i + 1]) i++;
  const w = [[bones[i], 1]];
  const d = t - joints[i];
  if (i > 0 && d < blend) {
    const s = 0.5 * (1 - d / blend);
    w[0][1] = 1 - s; w.push([bones[i - 1], s]);
  }
  if (i < joints.length - 1) {
    const d2 = joints[i + 1] - t;
    if (d2 < blend) {
      const s = 0.5 * (1 - d2 / blend);
      w[0][1] -= s; w.push([bones[i + 1], s]);
    }
  }
  return w;
}

/**
 * rows: [{ pts: [[x,y,z]...n điểm], weights: [[boneIdx, w]...] hoặc (j) => [[boneIdx, w]...] }]
 * Các hàng nối thành ống; capStart/capEnd đóng nắp bằng quạt tam giác.
 */
export function buildTube(rows, { capStart = false, capEnd = false, closed = true } = {}) {
  const n0 = rows[0].pts.length;
  // Ống kín: thêm 1 cột trùng cột đầu để UV không bị kéo giãn ở đường nối
  const n = closed ? n0 + 1 : n0;
  const pos = [], si = [], sw = [], idx = [], uv = [], seams = [];
  const pushV = (p, wts, u, v) => {
    pos.push(p[0], p[1], p[2]);
    uv.push(u, v);
    const list = [...wts].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = list.reduce((s2, x) => s2 + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si.push(list[k]?.[0] ?? 0); sw.push((list[k]?.[1] ?? 0) / sum); }
  };
  // UV theo mét thật: u = độ dài cung quanh hàng, v = quãng đường dọc ống
  let v = 0;
  let prevC = null;
  rows.forEach((r, i) => {
    const c = [0, 0, 0];
    r.pts.forEach((p) => { c[0] += p[0] / n0; c[1] += p[1] / n0; c[2] += p[2] / n0; });
    if (prevC) v += Math.hypot(c[0] - prevC[0], c[1] - prevC[1], c[2] - prevC[2]);
    prevC = c;
    let u = 0;
    for (let j = 0; j < n; j++) {
      const p = r.pts[j % n0];
      if (j > 0) { const q = r.pts[(j - 1) % n0]; u += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
      pushV(p, typeof r.weights === 'function' ? r.weights(j % n0) : r.weights, u, v);
    }
    if (closed) seams.push([i * n, i * n + n0]);
  });
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = i * n + j + 1, c = (i + 1) * n + j, d = (i + 1) * n + j + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (ri, flip) => {
    const r = rows[ri];
    const cen = [0, 0, 0];
    r.pts.forEach((p) => { cen[0] += p[0] / n0; cen[1] += p[1] / n0; cen[2] += p[2] / n0; });
    const ci = pos.length / 3;
    pushV(cen, typeof r.weights === 'function' ? r.weights(0) : r.weights, 0, uv[ri * n * 2 + 1]);
    for (let j = 0; j < n - 1; j++) {
      const a = ri * n + j, b = ri * n + j + 1;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capStart) cap(0, false);
  if (capEnd) cap(rows.length - 1, true);

  // Kiểm tra chiều mặt: pháp tuyến phải hướng ra ngoài trục ống, sai thì lật toàn bộ
  const mid = Math.floor(rows.length / 2) * n;
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const a = P(mid), b = P(mid + 1), c = P(Math.min(mid + n, rows.length * n - 1));
  const nrm = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(b, a));
  const cen = new THREE.Vector3();
  for (let j = 0; j < n0; j++) cen.add(P(mid + j));
  cen.divideScalar(n0);
  if (nrm.dot(new THREE.Vector3().subVectors(a, cen)) < 0) {
    for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  }
  return { pos, si, sw, idx, uv, seams };
}

// Gộp nhiều mảnh cùng chất liệu thành 1 BufferGeometry
export function toGeometry(parts) {
  const pos = [], si = [], sw = [], idx = [], uv = [], seams = [];
  for (const p of parts) {
    const base = pos.length / 3;
    pos.push(...p.pos); si.push(...p.si); sw.push(...p.sw); uv.push(...(p.uv || new Array((p.pos.length / 3) * 2).fill(0)));
    for (const i of p.idx) idx.push(i + base);
    for (const [a, b] of p.seams || []) seams.push([a + base, b + base]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Làm mượt pháp tuyến ở đường nối UV (2 đỉnh trùng vị trí)
  const nrm = g.attributes.normal;
  for (const [a, b] of seams) {
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// Hộp bo góc đơn giản (túi xách): tâm, nửa kích thước, trọng số cố định
export function roundedBox(center, half, weights, n = 20) {
  const rows = [];
  const ys = [-1, -0.92, 0.92, 1];
  for (const fy of ys) {
    const shrink = Math.abs(fy) === 1 ? 0.85 : 1;
    const pts = [];
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2;
      // siêu elip -> hình chữ nhật bo góc
      const c = Math.cos(th), s = Math.sin(th);
      const x = Math.sign(s) * Math.abs(s) ** 0.35 * half[0] * shrink;
      const z = Math.sign(c) * Math.abs(c) ** 0.35 * half[2] * shrink;
      pts.push([center[0] + x, center[1] + fy * half[1], center[2] + z]);
    }
    rows.push({ pts, weights });
  }
  return buildTube(rows, { capStart: true, capEnd: true });
}
