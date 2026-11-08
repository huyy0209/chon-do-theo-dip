// =============================================================
// garments.js — Thân người + quần áo dựng bằng code theo "mẫu 3D" của từng kiểu đồ (Q7)
// Mỗi mẫu là vài tham số: độ rộng (ease), dài, cổ áo, tay áo, độ xoè, chi tiết (nẹp, cúc, túi...)
// Mọi đồ đều suy ra từ mô hình thân (body.js) nên tự vừa theo số đo.
// =============================================================
import { buildTube, chainWeights, roundedBox } from './geom.js';
import { clamp, lerp, rayToPolygon, smooth } from './math.js';
import { ringPoint } from './body.js';

const TAU = Math.PI * 2;

// ---------------- Danh sách mẫu 3D ----------------
// layer: top | bottom | dress | outer | shoes | bag | acc.  Độ dài theo "U" = 1 mét của người cao 160cm.
export const TEMPLATES = {
  // Áo
  ao_thun: { layer: 'top', label: 'Áo thun', hem: 'highhip', ease: 0.012, sleeve: { len: 0.32, ease: 0.014 }, neck: { type: 'crew' }, rib: true },
  ao_thun_oversize: { layer: 'top', label: 'Áo thun oversize', hem: 'lowhip', ease: 0.034, sleeve: { len: 0.55, ease: 0.03 }, neck: { type: 'crew' }, rib: true },
  ao_croptop: { layer: 'top', label: 'Croptop', hem: 'crop', ease: 0.006, sleeve: { len: 0.25, ease: 0.008 }, neck: { type: 'scoop', depth: 0.05 } },
  ao_om: { layer: 'top', label: 'Áo ôm body', hem: 'abd', ease: 0.003, sleeve: { len: 0.3, ease: 0.004 }, neck: { type: 'scoop', depth: 0.06 } },
  ao_len: { layer: 'top', label: 'Áo len', hem: 'hip', ease: 0.02, sleeve: { len: 1, ease: 0.018, cuff: true }, neck: { type: 'crew' }, rib: true },
  so_mi: { layer: 'top', label: 'Sơ mi', hem: 'hip', ease: 0.014, sleeve: { len: 1, ease: 0.013, cuff: true }, neck: { type: 'v', depth: 0.06 }, collar: true, placket: 'shirt' },
  ao_co_v: { layer: 'top', label: 'Áo cổ V', hem: 'highhip', ease: 0.008, sleeve: { len: 0.3, ease: 0.01 }, neck: { type: 'v', depth: 0.11 } },
  ao_co_thuyen: { layer: 'top', label: 'Áo cổ thuyền', hem: 'highhip', ease: 0.012, sleeve: { len: 0.45, ease: 0.014 }, neck: { type: 'boat' } },
  ao_tay_phong: { layer: 'top', label: 'Áo tay phồng', hem: 'abd', ease: 0.01, sleeve: { len: 0.38, ease: 0.012, puff: 0.03 }, neck: { type: 'scoop', depth: 0.04 } },
  ao_peplum: { layer: 'top', label: 'Áo peplum', hem: 'hip', ease: 0.005, flareBelowWaist: 0.05, sleeve: null, neck: { type: 'scoop', depth: 0.05 } },
  // Quần
  quan_jogger: { layer: 'bottom', label: 'Quần jogger', kind: 'pants', rise: 0, hem: 'ankle', ease: 0.02, cuff: true, waistband: true },
  quan_short: { layer: 'bottom', label: 'Quần short', kind: 'pants', rise: 0, hem: 'midthigh', ease: 0.016, wide: 0.075, waistband: true, pockets: 'jeans' },
  quan_skinny: { layer: 'bottom', label: 'Quần skinny', kind: 'pants', rise: 0, hem: 'ankle', ease: 0.005, waistband: true, pockets: 'jeans' },
  quan_ong_rong: { layer: 'bottom', label: 'Quần ống rộng', kind: 'pants', rise: 0.01, hem: 'floor', ease: 0.02, wide: 0.1, waistband: true },
  quan_tay: { layer: 'bottom', label: 'Quần tây ống đứng', kind: 'pants', rise: 0.005, hem: 'ankle', ease: 0.016, wide: 0.068, waistband: true, crease: true },
  // Chân váy
  vay_chu_a: { layer: 'bottom', label: 'Chân váy chữ A', kind: 'skirt', hem: 'knee', ease: 0.006, flare: 0.09, waistband: true },
  vay_xoe: { layer: 'bottom', label: 'Chân váy xoè', kind: 'skirt', hem: 'knee', ease: 0.006, flare: 0.14, pleats: 0.012, waistband: true },
  vay_but_chi: { layer: 'bottom', label: 'Chân váy bút chì', kind: 'skirt', hem: 'knee', ease: 0.005, flare: -0.004, waistband: true },
  // Đầm
  dam_suong: { layer: 'dress', label: 'Đầm suông', hem: 'knee', ease: 0.012, looseBelowBust: 0.025, flare: 0.03, sleeve: { len: 0.32, ease: 0.012 }, neck: { type: 'crew' } },
  dam_wrap: { layer: 'dress', label: 'Đầm wrap', hem: 'midi', ease: 0.006, flare: 0.08, sleeve: { len: 0.32, ease: 0.01 }, neck: { type: 'v', depth: 0.13 }, wrapTie: true },
  dam_om: { layer: 'dress', label: 'Đầm ôm', hem: 'aboveknee', ease: 0.004, flare: -0.004, sleeve: null, neck: { type: 'scoop', depth: 0.06 } },
  dam_maxi: { layer: 'dress', label: 'Đầm maxi', hem: 'floor', ease: 0.006, flare: 0.16, sleeve: null, neck: { type: 'v', depth: 0.09 } },
  // Áo khoác
  cardigan: { layer: 'outer', label: 'Cardigan', hem: 'hip', ease: 0.024, open: 0.2, sleeve: { len: 1, ease: 0.022, cuff: true }, neck: { type: 'v', depth: 0.14 }, placket: 'edge', buttons: 5, rib: true },
  khoac_jean: { layer: 'outer', label: 'Áo khoác jean', hem: 'highhip', ease: 0.028, open: 0.22, sleeve: { len: 1, ease: 0.026, cuff: true }, neck: { type: 'v', depth: 0.06 }, collar: true, placket: 'edge', buttons: 4, metalButtons: true, pockets: 'chest' },
  blazer: { layer: 'outer', label: 'Blazer', hem: 'lowhip', ease: 0.028, open: 0.24, sleeve: { len: 1, ease: 0.024 }, neck: { type: 'v', depth: 0.17 }, lapel: true, buttons: 1, pockets: 'flap' },
  // Giày
  dep_sandal: { layer: 'shoes', label: 'Sandal', shoe: 'sandal' },
  giay_the_thao: { layer: 'shoes', label: 'Giày thể thao', shoe: 'sneaker' },
  giay_bup_be: { layer: 'shoes', label: 'Giày búp bê', shoe: 'flat' },
  boots: { layer: 'shoes', label: 'Boots', shoe: 'boots' },
  cao_got: { layer: 'shoes', label: 'Giày cao gót', shoe: 'heels' },
  // Túi
  tui_deo_cheo: { layer: 'bag', label: 'Túi đeo chéo', bag: 'cross' },
  tui_xach: { layer: 'bag', label: 'Túi xách tay', bag: 'hand' },
  clutch: { layer: 'bag', label: 'Clutch', bag: 'clutch' },
  // Phụ kiện
  that_lung: { layer: 'acc', label: 'Thắt lưng', acc: 'belt' },
  trang_suc: { layer: 'acc', label: 'Dây chuyền', acc: 'necklace' },
  mu: { layer: 'acc', label: 'Mũ (chưa hiển thị 3D)', acc: 'none' },
  // Bộ đồ ôm mặc định ở màn đo số đo
  base_top: { layer: 'top', label: 'Áo ba lỗ ôm', hem: 'abd', ease: 0.003, sleeve: null, neck: { type: 'scoop', depth: 0.05 } },
  base_shorts: { layer: 'bottom', label: 'Quần short ôm', kind: 'pants', rise: 0, hem: 'upperthigh', ease: 0.003 },
};

// Mẫu mặc định theo loại món (cho kiểu do Quản trị tự thêm)
export const DEFAULT_TEMPLATE_BY_LOAI = {
  AO: 'ao_thun', QUAN: 'quan_tay', CHAN_VAY: 'vay_chu_a', DAM: 'dam_suong', AO_KHOAC: 'cardigan',
  GIAY: 'giay_the_thao', TUI: 'tui_deo_cheo', PHU_KIEN: 'trang_suc',
};
const LAYER_BY_LOAI = { AO: 'top', QUAN: 'bottom', CHAN_VAY: 'bottom', DAM: 'dress', AO_KHOAC: 'outer', GIAY: 'shoes', TUI: 'bag', PHU_KIEN: 'acc' };
export const templatesForLoai = (loai) => Object.entries(TEMPLATES)
  .filter(([id, t]) => t.layer === LAYER_BY_LOAI[loai] && !id.startsWith('base_'))
  .map(([id, t]) => ({ id, label: t.label }));

export const BASE_OUTFIT = [
  { tpl: 'base_top', color: '#ece6f2', mat: 'cotton' },
  { tpl: 'base_shorts', color: '#5c5470', mat: 'cotton' },
  { tpl: 'giay_the_thao', color: '#f7f7f5', mat: 'cotton' },
];

const N_TORSO = 48;

// Màu chỉ may: denim chỉ cam, còn lại tối hơn màu vải một chút
const stitchColor = (mat, color) => (mat === 'denim' ? '#d4943f' : color);

// ---------------- Trọng số xương ----------------
export function makeWeights(B, BI, skirtRig = null) {
  const { P, U, levels } = B;
  const tJoints = [-1e9, P.spine.y, P.chest.y, P.upperChest?.y ?? P.chest.y + 0.08 * U, P.neck.y];
  const tBones = [BI.hips, BI.spine, BI.chest, BI.upperChest, BI.neck];
  const torso = (y) => chainWeights(y, tJoints, tBones, 0.035 * U);
  const leg = (side, y) => {
    const L = B.legs[side === 'l' ? 0 : 1];
    const w = chainWeights(-y, [-1e9, -L.knee.y, -L.ankle.y], [BI[`${side}UpperLeg`], BI[`${side}LowerLeg`], BI[`${side}Foot`]], 0.04 * U);
    const s = 0.5 * smooth((y - (levels.legY - 0.07 * U)) / (0.1 * U));
    if (s > 0) { w.forEach((x) => { x[1] *= 1 - s; }); w.push([BI.hips, s]); }
    return w;
  };
  const arm = (side, u) => {
    const A = B.arms[side === 'l' ? 0 : 1];
    return chainWeights(u, [-1e9, A.L1, A.L1 + A.L2], [BI[`${side}UpperArm`], BI[`${side}LowerArm`], BI[`${side}Hand`]], 0.035 * U);
  };
  const hipHalf = B.torsoAt(levels.yH).w;
  // Váy/đầm dưới hông:
  //  - có xương váy (skirtRig): bám theo chuỗi xương vật lý gần nhất -> váy đung đưa, va chạm chân
  //  - không có: trộn hông với 2 đùi theo bên trái/phải
  const skirt = (y, th, x) => {
    if (skirtRig) {
      const w = skirtRig.weightsAt(th, y);
      if (w) return w;
    }
    const li = 0.95 * smooth((levels.yC + 0.02 * U - y) / (0.14 * U));
    const tL = smooth(0.5 + (1.2 * x) / hipHalf);
    return [[BI.hips, 1 - li], [BI.lUpperLeg, li * tL], [BI.rUpperLeg, li * (1 - tL)]].filter((w) => w[1] > 1e-4);
  };
  // Vùng quanh thân: trên đáy chậu theo cột sống, dưới thì theo váy
  const field = (y, th, x, useRig = true) => {
    if (skirtRig && useRig && y < skirtRig.yStart) return skirt(y, th, x);
    if (!useRig && y < levels.yCap) {
      const li = 0.95 * smooth((levels.yC + 0.02 * U - y) / (0.14 * U));
      const tL = smooth(0.5 + (1.2 * x) / hipHalf);
      return [[BI.hips, 1 - li], [BI.lUpperLeg, li * tL], [BI.rUpperLeg, li * (1 - tL)]].filter((w) => w[1] > 1e-4);
    }
    return y >= levels.yCap ? torso(Math.min(y, levels.yN)) : skirt(y, th, x);
  };
  return { torso, leg, arm, skirt, field, hipsIdx: BI.hips };
}

// ---------------- Thân người (da) ----------------
export function buildBodySkin(B, W) {
  const { levels } = B;
  const parts = [];
  const rows = [];
  const nRows = 56;
  for (let i = 0; i <= nRows; i++) {
    const y = lerp(levels.yCap, levels.yN, i / nRows);
    const r = B.torsoAt(y);
    const pts = [];
    for (let j = 0; j < N_TORSO; j++) {
      const [x, z] = ringPoint(r, (j / N_TORSO) * TAU);
      pts.push([x, y, z + r.cz]);
    }
    rows.push({ pts, weights: W.torso(y) });
  }
  parts.push(buildTube(rows, { capStart: true }));
  for (const L of B.legs) {
    const lr = [];
    for (let i = 0; i <= 40; i++) {
      const y = lerp(L.yTop, L.yBottom, i / 40);
      const r = L.at(y);
      const [cx, cz] = L.centerAt(y);
      const pts = [];
      for (let j = 0; j < 28; j++) { const [x, z] = ringPoint(r, (j / 28) * TAU); pts.push([x + cx, y, z + cz]); }
      lr.push({ pts, weights: W.leg(L.side, y) });
    }
    parts.push(buildTube(lr, { capEnd: true }));
  }
  for (const A of B.arms) parts.push(armTube(B, A, W, A.uStart, A.uEnd, 0, 0));
  return parts;
}

// Ống bám theo tay từ u0 tới u1, cộng thêm ease, độ phồng, nếp nhăn ở khuỷu
function armTube(B, A, W, u0, u1, ease, puff, cuffU = 0, folds = 0) {
  const { U } = B;
  const rows = [];
  const n = 28;
  const nr = Math.max(12, Math.ceil((u1 - u0) / (0.008 * U)));
  for (let i = 0; i <= nr; i++) {
    const u = lerp(u0, u1, i / nr);
    const r = A.at(u);
    const p = puff * Math.exp(-(((u - 0.1 * U) / (0.07 * U)) ** 2));
    const cuff = cuffU > 0 && u > u1 - cuffU ? -0.4 * ease : 0;
    const [cx, cy, cz] = A.axisAt(u);
    const pts = [];
    for (let j = 0; j < n; j++) {
      const th = (j / n) * TAU;
      // Nếp nhăn tay áo: gợn ngang quanh khuỷu + dồn vải ở cổ tay
      const elbow = Math.exp(-(((u - A.L1) / (0.06 * U)) ** 2));
      const bunch = cuffU > 0 ? smooth((u - (u1 - 0.07 * U)) / (0.04 * U)) * (1 - smooth((u - (u1 - cuffU)) / (0.01 * U))) : 0;
      const f = folds * U * (elbow * Math.sin(TAU * u / (0.022 * U) + 2 * th) + 0.6 * bunch * Math.sin(TAU * u / (0.014 * U) + th));
      const e = ease + p + cuff + f;
      pts.push([cx, cy + (r.a + e) * Math.cos(th), cz + (r.b + e) * Math.sin(th)]);
    }
    rows.push({ pts, weights: W.arm(A.side, u) });
  }
  return buildTube(rows);
}

// Độ cao viền dưới theo tên mốc
function hemY(B, name) {
  const { levels: L, U, legs } = B;
  const knee = (legs[0].knee.y + legs[1].knee.y) / 2;
  const ankle = (legs[0].ankle.y + legs[1].ankle.y) / 2;
  const thigh = L.legY - knee;
  return ({
    crop: L.yW + 0.045 * U,
    abd: L.yAbd + 0.01 * U,
    highhip: (L.yAbd + L.yH) / 2,
    hip: L.yH - 0.01 * U,
    lowhip: L.yC - 0.01 * U,
    upperthigh: L.yC - 0.05 * U,
    midthigh: L.legY - thigh * 0.45,
    aboveknee: knee + 0.06 * U,
    knee: knee - 0.005 * U,
    midi: knee - 0.12 * U,
    ankle: ankle + 0.005 * U,
    floor: B.floorY + 0.012 * U,
  })[name];
}

// Đường cổ áo: độ cao mép trên theo góc θ (θ = 0 giữa ngực)
function necklineY(B, neck, th) {
  const { levels: L, U } = B;
  const top = L.yN - 0.006 * U;
  let a = Math.abs(th > Math.PI ? th - TAU : th);
  if (!neck) return top;
  if (neck.type === 'v') return top - 0.006 * U - neck.depth * U * Math.max(0, 1 - a / 0.62);
  if (neck.type === 'scoop') return top - 0.004 * U - neck.depth * U * Math.max(0, Math.cos(Math.min(a * 1.5, Math.PI / 2)));
  if (neck.type === 'boat') return top - 0.022 * U - 0.012 * U * Math.abs(Math.cos(a));
  a = Math.max(0, Math.cos(a));
  return top - 0.012 * U * a;
}

/**
 * Lớp phủ quanh thân: "trường bán kính" quanh trục thân. Mỗi cột θ có mép dưới/trên riêng.
 * Trả về { part, surf } — surf(θ, y, thêm) cho điểm trên mặt vải (để gắn cúc, túi, đường may).
 */
function torsoField(B, W, o) {
  const { U, levels } = B;
  const n = o.cols || 96;
  const minBodyY = Math.max(...B.legs.map((L) => L.yBottom)) + 0.005 * U;
  const surf = (th, y, extra = 0) => {
    const cz = B.czAt(Math.max(y, levels.yC));
    const hull = B.sectionHull(Math.max(y, minBodyY));
    const dx = Math.sin(th), dz = Math.cos(th);
    let r = hull.length ? rayToPolygon(hull, 0, cz, dx, dz) : 0.05 * U;
    r += Math.max(0.002 * U, o.easeAt(y, th) + (o.foldAt ? o.foldAt(y, th) : 0)) + 0.0015 * U + extra;
    return [dx * r, y, cz + dz * r];
  };
  const ths = [];
  const th0 = o.thFrom ?? (o.open || 0);
  const th1 = o.thTo ?? (o.open ? TAU - o.open : TAU);
  const closed = !o.open && o.thFrom == null;
  if (closed) for (let j = 0; j < n; j++) ths.push((j / n) * TAU);
  else for (let j = 0; j <= n; j++) ths.push(lerp(th0, th1, j / n));
  const maxTop = Math.max(...ths.map((th) => o.topAt(th)));
  const minBot = Math.min(...ths.map((th) => (o.bottomAt ? o.bottomAt(th) : o.yBottom)));
  const nr = o.rows || Math.max(8, Math.ceil((maxTop - minBot) / (0.007 * U)));
  const rows = [];
  for (let i = 0; i <= nr; i++) {
    const v = i / nr;
    const pts = [], wts = [];
    for (const th of ths) {
      const yb = o.bottomAt ? o.bottomAt(th) : o.yBottom;
      const y = lerp(yb, o.topAt(th), v);
      const p = surf(th, y, o.extra || 0);
      pts.push(p);
      wts.push(W.field(y, th, p[0], !o.noRig));
    }
    rows.push({ pts, weights: (j) => wts[j] });
  }
  return { part: buildTube(rows, { closed }), surf };
}

// Ống quần / ống boots bám theo chân, có nếp nhăn ở gối và gấu
function legField(B, W, L, yTop, yBottom, easeAt, wide = 0, folds = 0) {
  const rows = [];
  const U = B.U;
  const nr = Math.max(10, Math.ceil(Math.abs(yTop - yBottom) / (0.009 * U)));
  for (let i = 0; i <= nr; i++) {
    const y = lerp(yTop, yBottom, i / nr);
    const r = L.at(Math.max(y, L.yBottom));
    const e = easeAt(y);
    const knee = Math.exp(-(((y - L.knee.y) / (0.06 * U)) ** 2));
    const stack = smooth((yBottom + 0.08 * U - y) / (0.08 * U));
    const rr = { w: Math.max(r.w + e, wide), dF: Math.max(r.dF + e, wide * 0.95), dB: Math.max(r.dB + e, wide * 0.95), A: 0 };
    const [cx, cz] = L.centerAt(Math.max(y, L.yBottom));
    const pts = [];
    for (let j = 0; j < 32; j++) {
      const th = (j / 32) * TAU;
      const f = folds * U * (knee * Math.sin(TAU * y / (0.026 * U) + 2 * th) + 0.8 * stack * Math.sin(TAU * y / (0.018 * U) + 3 * th));
      const r2 = { w: rr.w + f, dF: rr.dF + f, dB: rr.dB + f, A: 0 };
      const [x, z] = ringPoint(r2, th);
      pts.push([x + cx, y, z + cz]);
    }
    rows.push({ pts, weights: W.leg(L.side, Math.max(y, L.yBottom)) });
  }
  return buildTube(rows);
}

// ---------------- Chi tiết nhỏ: đường may, cúc, túi ----------------

// Ống nhỏ chạy theo đường đi (dây túi, dây chuyền, đường chỉ)
function pathTube(path, radius, weightFn, closed = false, n = 6) {
  const rows = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)];
    let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let ax = [0, 0, 1];
    if (Math.abs(tz) > 0.9) ax = [1, 0, 0];
    let ux = ty * ax[2] - tz * ax[1], uy = tz * ax[0] - tx * ax[2], uz = tx * ax[1] - ty * ax[0];
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
    const pts = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU, c = Math.cos(a) * radius, s = Math.sin(a) * radius;
      pts.push([p[0] + ux * c + vx * s, p[1] + uy * c + vy * s, p[2] + uz * c + vz * s]);
    }
    rows.push({ pts, weights: weightFn(p) });
  }
  if (closed) rows.push(rows[0]);
  return buildTube(rows);
}

// Đường chỉ may nét đứt dọc theo 1 đường trên mặt vải
function stitchLine(points, U, weightFn) {
  const parts = [];
  const dash = 0.006 * U, gap = 0.004 * U;
  let acc = 0, on = true, cur = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let t = 0;
    while (t < d) {
      const need = (on ? dash : gap) - acc;
      const step = Math.min(need, d - t);
      t += step; acc += step;
      const p = [lerp(a[0], b[0], t / d), lerp(a[1], b[1], t / d), lerp(a[2], b[2], t / d)];
      if (on) cur.push(p);
      if (acc >= (on ? dash : gap) - 1e-9) {
        if (on && cur.length >= 2) parts.push(pathTube(cur, 0.0011 * U, weightFn, false, 4));
        on = !on; acc = 0; cur = [p];
      }
    }
  }
  return parts;
}

// Cúc áo: đĩa dẹt nằm áp mặt vải
function button(p, nrm, r, thick, weights) {
  const rows = [];
  const n = 14;
  let ax = [0, 1, 0];
  if (Math.abs(nrm[1]) > 0.9) ax = [1, 0, 0];
  let ux = nrm[1] * ax[2] - nrm[2] * ax[1], uy = nrm[2] * ax[0] - nrm[0] * ax[2], uz = nrm[0] * ax[1] - nrm[1] * ax[0];
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const vx = nrm[1] * uz - nrm[2] * uy, vy = nrm[2] * ux - nrm[0] * uz, vz = nrm[0] * uy - nrm[1] * ux;
  for (const [h, rr] of [[0, r], [thick * 0.7, r], [thick, r * 0.8]]) {
    const pts = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU, c = Math.cos(a) * rr, s = Math.sin(a) * rr;
      pts.push([p[0] + nrm[0] * h + ux * c + vx * s, p[1] + nrm[1] * h + uy * c + vy * s, p[2] + nrm[2] * h + uz * c + vz * s]);
    }
    rows.push({ pts, weights });
  }
  return buildTube(rows, { capEnd: true });
}

const radialNormal = (p, B) => {
  const cz = B.czAt(Math.max(p[1], B.levels.yC));
  const l = Math.hypot(p[0], p[2] - cz) || 1;
  return [p[0] / l, 0, (p[2] - cz) / l];
};

// ---------------- Áo / đầm / áo khoác ----------------
function buildTopLike(B, W, t, kind, color, mat) {
  const { U, levels } = B;
  const out = { main: [], detail: [], stitch: [], buttons: [] };
  const isDress = kind === 'dress';
  const yBottom = hemY(B, t.hem);
  const ease0 = t.ease * U;
  const flareAt = (y) => {
    if (isDress) {
      if (y >= levels.yH) return 0;
      return (t.flare || 0) * U * smooth((levels.yH - y) / Math.max(levels.yH - yBottom, 0.01));
    }
    if (t.flareBelowWaist && y < levels.yW) return t.flareBelowWaist * U * smooth((levels.yW - y) / (levels.yW - yBottom));
    return 0;
  };
  const looseAt = (y) => (t.looseBelowBust && y < levels.yB ? t.looseBelowBust * U * smooth((levels.yB - y) / (0.12 * U)) : 0);
  // Nếp vải: váy xoè rủ thành múi; áo rộng có gợn gần gấu
  const foldAt = (y, th) => {
    let f = 0;
    const fl = flareAt(y);
    if (fl > 0) f += 0.35 * fl * (0.6 * Math.sin(th * 7 + 1.3) + 0.4 * Math.sin(th * 12 + 0.4));
    if (t.ease >= 0.012) f += 0.0022 * U * Math.sin(TAU * y / (0.03 * U) + 3 * th) * smooth((yBottom + 0.12 * U - y) / (0.1 * U));
    return f;
  };
  const topAt = (th) => necklineY(B, t.neck, th);
  const easeAt = (y) => ease0 + flareAt(y) + looseAt(y);
  const body = torsoField(B, W, { yBottom, topAt, easeAt, foldAt, open: t.open || 0 });
  out.main.push(body.part);
  const surf = body.surf;

  if (t.sleeve) {
    for (const A of B.arms) {
      const uEnd = t.sleeve.len >= 1 ? A.L1 + A.L2 - 0.01 * U : (A.L1 + A.L2) * t.sleeve.len;
      out.main.push(armTube(B, A, W, -0.03 * U, uEnd, t.sleeve.ease * U, (t.sleeve.puff || 0) * U,
        t.sleeve.cuff ? 0.03 * U : 0, t.sleeve.len >= 1 ? 0.003 : 0));
      // Đường chỉ gấu tay áo
      const u = uEnd - 0.012 * U;
      const r = A.at(u), e = t.sleeve.ease * U + (t.sleeve.cuff ? -0.4 * t.sleeve.ease * U : 0) + 0.0015 * U;
      const [cx, cy, cz] = A.axisAt(u);
      const ring = [];
      for (let j = 0; j <= 40; j++) { const th = (j / 40) * TAU; ring.push([cx, cy + (r.a + e) * Math.cos(th), cz + (r.b + e) * Math.sin(th)]); }
      out.stitch.push(...stitchLine(ring, U, () => W.arm(A.side, u)));
    }
  }

  // Đường chỉ gấu áo/đầm
  const hemRing = [];
  const thA = t.open || 0, thB = t.open ? TAU - t.open : TAU;
  for (let j = 0; j <= 80; j++) hemRing.push(surf(lerp(thA, thB, j / 80), yBottom + 0.012 * U, 0.0008 * U));
  out.stitch.push(...stitchLine(hemRing, U, (p) => W.field(p[1], Math.atan2(p[0], p[2] - B.czAt(levels.yC)), p[0])));
  // Bo gấu dệt (áo thun, len, cardigan): dải mỏng hơi bó
  if (t.rib) {
    out.detail.push(torsoField(B, W, {
      yBottom, topAt: () => yBottom + 0.022 * U, easeAt: () => ease0 * 0.75, open: t.open || 0, rows: 3, extra: 0.0012 * U,
    }).part);
  }

  // Cổ áo bẻ
  if (t.collar) {
    out.detail.push(torsoField(B, W, {
      yBottom: levels.yN - 0.03 * U,
      topAt: () => levels.yN + 0.004 * U,
      easeAt: (y) => ease0 + 0.008 * U + 0.012 * U * smooth((levels.yN - y) / (0.03 * U)),
      open: 0.35,
      rows: 6,
    }).part);
    // 2 vạt cổ áo nằm trên ngực
    for (const sgn of [1, -1]) {
      out.detail.push(torsoField(B, W, {
        thFrom: sgn > 0 ? 0.1 : TAU - 0.62, thTo: sgn > 0 ? 0.62 : TAU - 0.1,
        bottomAt: (th) => { const a = Math.abs(th > Math.PI ? th - TAU : th); return levels.yN - 0.05 * U + (a - 0.1) * 0.05 * U; },
        topAt: () => levels.yN - 0.004 * U,
        easeAt: () => ease0, extra: 0.004 * U, rows: 5, cols: 10,
      }).part);
    }
  }

  // Nẹp áo sơ mi + hàng cúc
  if (t.placket === 'shirt') {
    const yTop = topAt(0) - 0.004 * U;
    out.detail.push(torsoField(B, W, {
      thFrom: -0.05, thTo: 0.05, yBottom, topAt: () => yTop, easeAt, foldAt, extra: 0.0022 * U, rows: 30, cols: 3,
    }).part);
    for (const sgn of [-1, 1]) {
      const line = [];
      for (let i = 0; i <= 30; i++) line.push(surf(sgn * 0.042, lerp(yBottom + 0.01 * U, yTop, i / 30), 0.0032 * U));
      out.stitch.push(...stitchLine(line, U, (p) => W.field(p[1], 0, p[0])));
    }
    const nb = Math.max(4, Math.floor((yTop - yBottom) / (0.075 * U)));
    for (let i = 0; i < nb; i++) {
      const y = lerp(yTop - 0.03 * U, yBottom + 0.04 * U, i / (nb - 1));
      const p = surf(0, y, 0.0035 * U);
      out.buttons.push(button(p, radialNormal(p, B), 0.0052 * U, 0.0022 * U, W.field(y, 0, p[0])));
    }
  }
  // Áo khoác mở: cúc dọc mép
  if (t.placket === 'edge' && t.buttons) {
    const yTop = topAt(t.open) - 0.02 * U;
    for (let i = 0; i < t.buttons; i++) {
      const y = t.buttons === 1 ? levels.yW : lerp(yTop, yBottom + 0.04 * U, i / (t.buttons - 1));
      const th = t.open + 0.035;
      const p = surf(th, y, 0.003 * U);
      out.buttons.push(button(p, radialNormal(p, B), (t.metalButtons ? 0.0065 : 0.006) * U, 0.0025 * U, W.field(y, th, p[0])));
    }
  }
  // Ve áo blazer: 2 vạt tam giác lật ra, rộng dần lên vai
  if (t.lapel) {
    const y0 = levels.yW + 0.02 * U, y1 = levels.yN - 0.012 * U;
    for (const sgn of [1, -1]) {
      const wAt = (y) => 0.05 + 0.4 * smooth((y - y0) / (y1 - y0));
      out.detail.push(torsoField(B, W, {
        thFrom: sgn > 0 ? t.open : TAU - t.open - 0.45, thTo: sgn > 0 ? t.open + 0.45 : TAU - t.open,
        bottomAt: (th) => {
          const d = sgn > 0 ? th - t.open : TAU - t.open - th;
          let y = y0; // tìm y nhỏ nhất mà ve còn phủ tới góc này
          for (let k = 0; k <= 20; k++) { const yy = lerp(y0, y1, k / 20); if (wAt(yy) >= d) { y = yy; break; } y = y1; }
          return y;
        },
        topAt: () => y1,
        easeAt, extra: 0.0035 * U, rows: 14, cols: 12,
      }).part);
    }
    const btn = surf(t.open + 0.035, levels.yW - 0.01 * U, 0.003 * U);
    out.buttons.push(button(btn, radialNormal(btn, B), 0.007 * U, 0.0025 * U, W.field(btn[1], t.open, btn[0])));
  }
  // Túi: nắp túi blazer ở hông, túi ngực áo khoác jean
  if (t.pockets === 'flap' || t.pockets === 'chest') {
    const yP = t.pockets === 'flap' ? levels.yAbd - 0.01 * U : levels.yB + 0.03 * U;
    for (const c of [0.75, TAU - 0.75]) {
      out.detail.push(torsoField(B, W, {
        thFrom: c - 0.16, thTo: c + 0.16, yBottom: yP - 0.02 * U, topAt: () => yP + 0.006 * U,
        easeAt, extra: 0.003 * U, rows: 3, cols: 8,
      }).part);
      const line = [];
      for (let j = 0; j <= 12; j++) line.push(surf(c - 0.15 + (0.3 * j) / 12, yP - 0.016 * U, 0.0042 * U));
      out.stitch.push(...stitchLine(line, U, (p) => W.field(p[1], c, p[0])));
    }
  }
  // Đầm wrap: dải thắt nơ ở eo bên hông
  if (t.wrapTie) {
    out.detail.push(torsoField(B, W, {
      yBottom: levels.yW - 0.012 * U, topAt: () => levels.yW + 0.012 * U, easeAt, extra: 0.003 * U, rows: 3,
    }).part);
    const p = surf(1.15, levels.yW, 0.004 * U);
    out.detail.push(pathTube([p, [p[0] + 0.01 * U, p[1] - 0.09 * U, p[2] + 0.01 * U]], 0.006 * U, () => W.field(levels.yW, 1.15, p[0]), false, 8));
    out.detail.push(pathTube([p, [p[0] + 0.02 * U, p[1] - 0.07 * U, p[2] - 0.005 * U]], 0.006 * U, () => W.field(levels.yW, 1.15, p[0]), false, 8));
  }
  void color; void mat;
  return out;
}

// ---------------- Quần / chân váy ----------------
function buildBottom(B, W, t, mat) {
  const { U, levels, legs } = B;
  const out = { main: [], detail: [], stitch: [], buttons: [] };
  const yWaist = levels.yW + (t.rise || 0) * U;
  let surf;
  if (t.kind === 'skirt') {
    const yBottom = hemY(B, t.hem);
    const below = (y) => smooth((levels.yH - y) / Math.max(levels.yH - yBottom, 0.01));
    const easeAt = (y, th) => {
      const b = below(y);
      // Xếp ly: răng cưa sắc thay vì sóng tròn
      const saw = t.pleats ? (Math.abs(((th * 24) / TAU) % 1 - 0.5) * 2 - 0.5) : 0;
      return t.ease * U + (y < levels.yH ? t.flare * U * b : 0) + (t.pleats || 0) * U * b * saw * 2;
    };
    const foldAt = (y, th) => (t.flare > 0 && !t.pleats ? 0.35 * t.flare * U * below(y) * (0.6 * Math.sin(th * 7 + 1.3) + 0.4 * Math.sin(th * 12 + 0.4)) : 0);
    const f = torsoField(B, W, { yBottom, topAt: () => yWaist + 0.006 * U, easeAt, foldAt, cols: t.pleats ? 144 : 96 });
    out.main.push(f.part);
    surf = f.surf;
    const hem = [];
    for (let j = 0; j <= 96; j++) hem.push(surf((j / 96) * TAU, yBottom + 0.012 * U, 0.0008 * U));
    out.stitch.push(...stitchLine(hem, U, (p) => W.field(p[1], Math.atan2(p[0], p[2]), p[0])));
  } else {
    // Quần: phần trên (eo -> đáy) + 2 ống
    const f = torsoField(B, W, {
      yBottom: levels.yC - 0.012 * U, topAt: () => yWaist, easeAt: () => t.ease * U * 0.6 + 0.003 * U, rows: 16, noRig: true,
    });
    out.main.push(f.part);
    surf = f.surf;
    const yBottom = hemY(B, t.hem);
    const folds = t.ease >= 0.012 ? 0.003 : 0.0012;
    for (const L of legs) {
      out.main.push(legField(B, W, L, levels.yC + 0.03 * U, yBottom,
        (y) => t.ease * U - (t.cuff && y < yBottom + 0.04 * U ? t.ease * U * 0.7 : 0),
        (t.wide || 0) * U * 0.5, folds));
      // Chỉ gấu ống + đường may sườn ngoài
      const r = L.at(Math.max(yBottom + 0.012 * U, L.yBottom));
      const [cx, cz] = L.centerAt(Math.max(yBottom, L.yBottom));
      const e = Math.max(t.ease * U, 0) + 0.0016 * U;
      const w = Math.max(r.w + e, (t.wide || 0) * U * 0.5), d = Math.max(r.dF + e, (t.wide || 0) * U * 0.47);
      const ring = [];
      for (let j = 0; j <= 40; j++) { const th = (j / 40) * TAU; ring.push([cx + w * Math.sin(th), yBottom + 0.012 * U, cz + d * Math.cos(th)]); }
      out.stitch.push(...stitchLine(ring, U, () => W.leg(L.side, yBottom)));
      if (t.crease) {
        const line = [];
        for (let i = 0; i <= 30; i++) {
          const y = lerp(levels.yC - 0.02 * U, yBottom + 0.02 * U, i / 30);
          const rr = L.at(Math.max(y, L.yBottom)); const [x0, z0] = L.centerAt(Math.max(y, L.yBottom));
          line.push([x0, y, z0 + Math.max(rr.dF + t.ease * U, (t.wide || 0) * U * 0.47) + 0.002 * U]);
        }
        out.detail.push(pathTube(line, 0.0012 * U, (p) => W.leg(L.side, p[1]), false, 4));
      }
    }
  }
  // Cạp quần/váy + đỉa quần
  if (t.waistband) {
    const easeW = (t.kind === 'skirt' ? t.ease : t.ease * 0.6 + 0.003) * U;
    out.detail.push(torsoField(B, W, {
      yBottom: yWaist - 0.034 * U, topAt: () => yWaist + 0.004 * U, easeAt: () => easeW, extra: 0.0022 * U, rows: 4,
    }).part);
    const line = [];
    for (let j = 0; j <= 96; j++) line.push(surf((j / 96) * TAU, yWaist - 0.03 * U, 0.003 * U));
    out.stitch.push(...stitchLine(line, U, (p) => W.torso(p[1])));
    if (t.kind === 'pants' && mat === 'denim') {
      for (const th of [0.9, 2.2, Math.PI, TAU - 2.2, TAU - 0.9]) {
        const p = surf(th, yWaist - 0.016 * U, 0.0042 * U);
        out.detail.push(pathTube([[p[0], p[1] - 0.018 * U, p[2]], [p[0], p[1] + 0.02 * U, p[2]]], 0.0035 * U, () => W.torso(p[1]), false, 6));
      }
      const btn = surf(0, yWaist - 0.016 * U, 0.004 * U);
      out.buttons.push(button(btn, radialNormal(btn, B), 0.0065 * U, 0.0025 * U, W.torso(btn[1])));
    }
  }
  // Túi quần jean: túi sau + đường chỉ túi trước + đường may đáy trước
  if (t.pockets === 'jeans') {
    for (const c of [Math.PI - 0.42, Math.PI + 0.42]) {
      out.detail.push(torsoField(B, W, {
        thFrom: c - 0.2, thTo: c + 0.2,
        bottomAt: (th) => levels.yH - 0.055 * U - 0.012 * U * (1 - Math.abs(th - c) / 0.2),
        topAt: () => levels.yH + 0.035 * U,
        easeAt: () => t.ease * U * 0.6 + 0.003 * U, extra: 0.0026 * U, rows: 6, cols: 8, noRig: true,
      }).part);
    }
    for (const sgn of [1, -1]) {
      const line = [];
      for (let i = 0; i <= 16; i++) {
        const s = i / 16;
        line.push(surf(sgn * lerp(0.55, 1.25, s), lerp(yWaist - 0.035 * U, levels.yH, Math.sin((s * Math.PI) / 2)), 0.0012 * U));
      }
      out.stitch.push(...stitchLine(line, U, (p) => W.torso(p[1])));
    }
  }
  return out;
}

// ---------------- Giày ----------------
function buildShoes(B, W, BI, t, P) {
  const { U } = B;
  const out = { main: [], sole: [], skin: [] };
  const kind = t.shoe;
  for (const s of ['l', 'r']) {
    const ankle = P[`${s}Foot`];
    const toes = P[`${s}Toes`];
    const fx = toes ? toes.x - ankle.x : 0, fz = toes ? toes.z - ankle.z : 1;
    const fl = Math.hypot(fx, fz) || 1;
    const f = [fx / fl, fz / fl];
    const lat = [f[1], -f[0]];
    const Ls = 0.243 * U * (kind === 'heels' ? 1.06 : 1);
    const halfW = 0.045 * U;
    const floor = B.floorY;
    const prof = {
      sneaker: { h: [0.07, 0.08, 0.062, 0.042, 0.03], sole: 0.02 },
      flat: { h: [0.045, 0.038, 0.036, 0.028, 0.022], sole: 0.008 },
      boots: { h: [0.075, 0.08, 0.06, 0.04, 0.03], sole: 0.014 },
      heels: { h: [0.04, 0.034, 0.034, 0.025, 0.016], sole: 0.006 },
      sandal: { h: [0.04, 0.042, 0.035, 0.026, 0.02], sole: 0.012 },
    }[kind];
    const hAt = (tt) => {
      const i = Math.min(3, Math.floor(tt * 4)), fr = tt * 4 - i;
      return lerp(prof.h[i], prof.h[i + 1], fr) * U;
    };
    const wAt = (tt) => {
      const ks = [0.62, 0.86, 1, 0.8, kind === 'heels' ? 0.22 : 0.4];
      const i = Math.min(3, Math.floor(tt * 4)), fr = tt * 4 - i;
      return lerp(ks[i], ks[i + 1], fr) * halfW;
    };
    const weightsAt = (tt) => (toes && tt > 0.62 ? [[BI[`${s}Foot`], 0.5], [BI[`${s}Toes`], 0.5]] : [[BI[`${s}Foot`], 1]]);
    const loft = (scaleW, hFn, y0, n = 22) => {
      const rows = [];
      for (let i = 0; i <= 26; i++) {
        const tt = i / 26;
        const sAlong = lerp(-0.25 * Ls, 0.75 * Ls, tt);
        const cx = ankle.x + f[0] * sAlong, cz = ankle.z + f[1] * sAlong;
        const w = wAt(tt) * scaleW;
        const h = hFn(tt);
        const pts = [];
        for (let j = 0; j < n; j++) {
          const th = (j / n) * TAU;
          const c = Math.cos(th), sn = Math.sin(th);
          const a = Math.sign(c) * Math.abs(c) ** 0.6, b = Math.sign(sn) * Math.abs(sn) ** 0.6;
          const l = a * w, up = y0 + h / 2 + (b * h) / 2;
          pts.push([cx + lat[0] * l, up, cz + lat[1] * l]);
        }
        rows.push({ pts, weights: weightsAt(tt) });
      }
      return buildTube(rows, { capStart: true, capEnd: true });
    };
    const soleH = prof.sole * U;
    if (kind === 'sandal') {
      out.skin.push(loft(0.96, (tt) => hAt(tt) * 0.85, floor + soleH));
      out.sole.push(loft(1.05, () => soleH, floor));
      for (const tt0 of [0.38, 0.72]) {
        out.main.push(loft(1.0, (tt) => (Math.abs(tt - tt0) < 0.05 ? hAt(tt) * 0.9 + 0.004 * U : 0.001 * U), floor + soleH - 0.002 * U));
      }
    } else {
      out.main.push(loft(1, hAt, floor + soleH * 0.6));
      out.sole.push(loft(1.05, () => soleH, floor));
    }
    if (kind === 'heels') {
      const c = [ankle.x - f[0] * 0.2 * Ls, floor + 0.022 * U, ankle.z - f[1] * 0.2 * Ls];
      out.sole.push(roundedBox(c, [0.012 * U, 0.022 * U, 0.012 * U], [[BI[`${s}Foot`], 1]], 12));
    }
    if (kind === 'boots') {
      const L = B.legs[s === 'l' ? 0 : 1];
      const top = L.knee.y - (L.knee.y - L.ankle.y) * 0.25;
      out.main.push(legField(B, W, L, top, floor + 0.04 * U, () => 0.01 * U, 0, 0.0015));
    }
  }
  return out;
}

// ---------------- Túi + phụ kiện ----------------
function buildBag(B, W, BI, t) {
  const { U, levels } = B;
  const out = { main: [], strap: [] };
  const hip = B.torsoAt(levels.yH);
  const cz = B.czAt(levels.yH);
  if (t.bag === 'cross') {
    const c = [hip.w + 0.045 * U, levels.yH + 0.03 * U, cz + 0.02 * U];
    out.main.push(roundedBox(c, [0.03 * U, 0.06 * U, 0.075 * U], [[BI.hips, 1]]));
    const a = [c[0] - 0.01 * U, c[1] + 0.06 * U], b = [-B.torsoAt(levels.yS).w * 0.55, levels.yS + 0.004 * U];
    const path = [];
    for (let i = 0; i <= 30; i++) {
      const s = i / 30;
      const x = lerp(a[0], b[0], s), y = lerp(a[1], b[1], s);
      const r = B.torsoAt(clamp(y, levels.yCap, levels.yN));
      const zc = B.czAt(y);
      const fr = clamp(1 - (x / (r.w + 0.03 * U)) ** 2, 0, 1);
      path.push([x, y, zc + Math.sqrt(fr) * (r.dF + 0.03 * U) + 0.006 * U]);
    }
    out.strap.push(pathTube(path, 0.005 * U, (p) => W.torso(clamp(p[1], levels.yCap, levels.yN)), false, 8));
  } else {
    const big = t.bag === 'hand';
    const c = [-(hip.w + (big ? 0.06 : 0.035) * U), levels.yH + (big ? 0.0 : 0.02) * U, cz + 0.03 * U];
    const half = big ? [0.035 * U, 0.075 * U, 0.1 * U] : [0.018 * U, 0.045 * U, 0.09 * U];
    out.main.push(roundedBox(c, half, [[BI.hips, 1]]));
    if (big) {
      const path = [];
      for (let i = 0; i <= 16; i++) {
        const a2 = (i / 16) * Math.PI;
        path.push([c[0], c[1] + half[1] + Math.sin(a2) * 0.05 * U, c[2] + Math.cos(a2) * half[2] * 0.6]);
      }
      out.strap.push(pathTube(path, 0.005 * U, () => [[BI.hips, 1]], false, 8));
    }
  }
  return out;
}

function buildAcc(B, W, t, easeAt) {
  const { U, levels } = B;
  if (t.acc === 'belt') {
    const f = torsoField(B, W, {
      yBottom: levels.yW - 0.014 * U, topAt: () => levels.yW + 0.014 * U, easeAt: (y) => easeAt(y) + 0.005 * U, rows: 3,
    });
    // Khoá thắt lưng
    const p = f.surf(0, levels.yW, 0.0035 * U);
    return { main: [f.part], metal: [roundedBox([p[0], p[1], p[2]], [0.02 * U, 0.016 * U, 0.003 * U], W.torso(levels.yW), 12)] };
  }
  if (t.acc === 'necklace') {
    const y0 = levels.yN - 0.012 * U;
    const path = [];
    for (let i = 0; i <= 48; i++) {
      const th = (i / 48) * TAU;
      const front = Math.max(0, Math.cos(th));
      const y = y0 - 0.05 * U * front ** 2;
      const rr = B.torsoAt(y);
      const [x, z] = ringPoint({ ...rr, A: 0 }, th);
      const push = 0.006 * U + easeAt(y) * front;
      path.push([x + Math.sin(th) * push, y, z + B.czAt(y) + Math.cos(th) * push]);
    }
    // mặt dây chuyền
    const pend = path[0];
    return {
      main: [],
      metal: [pathTube(path, 0.0022 * U, (p) => W.torso(p[1]), false, 6),
        roundedBox([pend[0], pend[1] - 0.008 * U, pend[2] + 0.003 * U], [0.006 * U, 0.008 * U, 0.002 * U], W.torso(pend[1]), 12)],
    };
  }
  return { main: [], metal: [] };
}

/**
 * Dựng toàn bộ outfit. items: [{ tpl, color, mat }]
 * Trả về các nhóm lưới theo vật liệu: [{ parts, color, role, mat }]
 */
export function buildOutfit(B, W, BI, P, items) {
  const groups = [];
  const byLayer = (layer) => items.filter((it) => TEMPLATES[it.tpl]?.layer === layer);
  const layerEase = [];
  const push = (out, it, opts = {}) => {
    const mat = it.mat || 'cotton';
    if (out.main?.length) groups.push({ parts: out.main, color: it.color, role: 'cloth', mat, ...opts });
    if (out.detail?.length) groups.push({ parts: out.detail, color: it.color, role: 'cloth', mat, darken: 0.97, ...opts });
    if (out.stitch?.length) groups.push({ parts: out.stitch, color: stitchColor(mat, it.color), role: 'cloth', mat: 'cotton', darken: mat === 'denim' ? 1 : 0.72 });
    if (out.buttons?.length) {
      const bc = TEMPLATES[it.tpl].metalButtons || mat === 'denim' ? '#b9874b' : '#f3efe8';
      groups.push({ parts: out.buttons, color: bc, role: 'cloth', mat: TEMPLATES[it.tpl].metalButtons || mat === 'denim' ? 'kim_loai' : 'lua' });
    }
  };

  for (const it of byLayer('bottom')) {
    const t = TEMPLATES[it.tpl];
    push(buildBottom(B, W, t, it.mat), it);
    layerEase.push((y) => (y <= B.levels.yW + 0.01 * B.U ? (t.ease + (t.kind === 'skirt' ? 0.004 : 0.006)) * B.U : 0));
  }
  for (const it of byLayer('dress')) {
    const t = TEMPLATES[it.tpl];
    push(buildTopLike(B, W, t, 'dress', it.color, it.mat), it);
    layerEase.push(() => t.ease * B.U + 0.004 * B.U);
  }
  for (const it of byLayer('top')) {
    const t = { ...TEMPLATES[it.tpl] };
    const under = Math.max(0, ...layerEase.map((f) => f(B.levels.yW)));
    if (under > 0 && t.ease * B.U < under + 0.003 * B.U) t.ease = (under + 0.004 * B.U) / B.U;
    push(buildTopLike(B, W, t, 'top', it.color, it.mat), it);
    layerEase.push(() => t.ease * B.U + 0.003 * B.U);
  }
  for (const it of byLayer('outer')) {
    const t = { ...TEMPLATES[it.tpl] };
    const under = Math.max(0, ...layerEase.map((f) => f(B.levels.yB)), ...layerEase.map((f) => f(B.levels.yW)));
    t.ease = Math.max(t.ease, under / B.U + 0.012);
    push(buildTopLike(B, W, t, 'outer', it.color, it.mat), it, { doubleSide: true });
  }
  const easeAt = (y) => Math.max(0, ...layerEase.map((f) => f(y)));
  for (const it of byLayer('acc')) {
    const r = buildAcc(B, W, TEMPLATES[it.tpl], easeAt);
    if (r.main.length) groups.push({ parts: r.main, color: it.color, role: 'cloth', mat: it.mat || 'da' });
    if (r.metal.length) groups.push({ parts: r.metal, color: TEMPLATES[it.tpl].acc === 'belt' ? '#c9a45c' : it.color, role: 'cloth', mat: 'kim_loai' });
  }
  for (const it of byLayer('bag')) {
    const b = buildBag(B, W, BI, TEMPLATES[it.tpl]);
    groups.push({ parts: b.main, color: it.color, role: 'cloth', mat: it.mat || 'da' });
    if (b.strap.length) groups.push({ parts: b.strap, color: it.color, role: 'cloth', mat: it.mat || 'da', darken: 0.8 });
  }
  for (const it of byLayer('shoes')) {
    const t = TEMPLATES[it.tpl];
    const s = buildShoes(B, W, BI, t, P);
    groups.push({ parts: s.main, color: it.color, role: 'cloth', mat: it.mat || 'da' });
    const sneaker = t.shoe === 'sneaker';
    groups.push({ parts: s.sole, color: sneaker ? '#f4f2ee' : '#2b2530', role: 'cloth', mat: sneaker ? 'cao_su' : 'da' });
    if (s.skin.length) groups.push({ parts: s.skin, color: null, role: 'skin' });
  }
  return groups;
}

// Có món nào có phần vải dưới hông cần xương vật lý (váy, đầm, áo dài)?
export function needsSkirtRig(B, items) {
  let low = Infinity;
  for (const it of items) {
    const t = TEMPLATES[it.tpl];
    if (!t) continue;
    if (t.layer === 'dress' || (t.layer === 'bottom' && t.kind === 'skirt') || ((t.layer === 'top' || t.layer === 'outer') && ['lowhip'].includes(t.hem))) {
      low = Math.min(low, hemY(B, t.hem));
    }
  }
  return Number.isFinite(low) ? low : null;
}
