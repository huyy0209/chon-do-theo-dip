// =============================================================
// body.js — Mô hình thân người tham số: dựng trực tiếp từ số đo (không phụ thuộc
// quần áo gốc của VRoid). Thân, chân, tay = các "vòng" (ring) đặt theo khung xương.
//
// Toạ độ: hệ cục bộ của vrm.scene, tư thế chữ T. x = sang trái nhân vật, y = lên, z = phía trước.
// Đơn vị: mét cục bộ. k = (mét cục bộ / mét thật) vì cả nhân vật đã bị scale theo chiều cao.
// =============================================================
import { clamp, convexHull, ellipseK, lerp, pchip, perimeter } from './math.js';

const LOBE_T0 = 0.42; // vị trí 2 bên ngực (rad, tính từ chính giữa phía trước)
const LOBE_S = 0.22;  // độ rộng khối ngực

const lobes = (th) => Math.exp(-((th - LOBE_T0) ** 2) / (2 * LOBE_S ** 2)) + Math.exp(-((th + LOBE_T0) ** 2) / (2 * LOBE_S ** 2));

// 1 điểm trên vòng thân: θ = 0 phía trước, θ = +π/2 bên trái nhân vật
export function ringPoint(r, th) {
  const c = Math.cos(th);
  const x = r.w * Math.sin(th);
  let th2 = th; if (th2 > Math.PI) th2 -= 2 * Math.PI;
  const z = (c >= 0 ? r.dF : r.dB) * c + (c > 0 ? r.A * lobes(th2) : 0);
  return [x, z];
}
export function ringPolygon(r, n = 64) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(ringPoint(r, (i / n) * Math.PI * 2));
  return pts;
}

// Giải 1 vòng elip (bất đối xứng trước/sau) có chu vi C:  w = k*t, dF = fF*t, dB = fB*t
function solveRing(C, k, fF = 1, fB = 1) {
  const unit = perimeter(ringPolygon({ w: k, dF: fF, dB: fB, A: 0 }, 96));
  const t = C / unit;
  return { w: k * t, dF: fF * t, dB: fB * t, A: 0 };
}

// Vòng ngực: nền elip + 2 khối ngực, tìm biên độ khối sao cho chu vi thước dây (bao lồi) = vòng ngực
function solveBust(Cbust, Cbase, maxA) {
  const base = solveRing(Math.min(Cbase, Cbust), 1.32, 1, 0.95);
  const tape = (A) => perimeter(convexHull(ringPolygon({ ...base, A }, 96)));
  if (tape(0) >= Cbust) return solveRing(Cbust, 1.32, 1, 0.95);
  let lo = 0, hi = maxA;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (tape(mid) < Cbust) lo = mid; else hi = mid; }
  return { ...base, A: (lo + hi) / 2 };
}

/**
 * Dựng mô hình thân người.
 * @param P   vị trí khớp (cục bộ): hips, spine, chest, upperChest, neck, lUpperLeg, lLowerLeg, lFoot, (r...), lUpperArm, lLowerArm, lHand
 * @param m   số đo hiệu lực (cm, %), từ measurements.effectiveValues
 * @param k   mét cục bộ trên 1 mét thật
 * @param extra { neckC, wristC, floorY } (mét cục bộ)
 */
export function buildBodyModel(P, m, k, extra) {
  const cm = (v) => (v / 100) * k;           // cm thật -> mét cục bộ
  const U = k * (m.heightCm / 160);          // "1 mét" của người cao 160cm, quy về cục bộ
  const bf = clamp((m.buttPct ?? 100) / 100, 0.8, 1.3);

  // ---- Các mốc chiều cao ----
  const legY = (P.lUpperLeg.y + P.rUpperLeg.y) / 2;
  const yJ = (P.lUpperArm.y + P.rUpperArm.y) / 2; // khớp vai
  const yS = yJ + 0.015 * U;                      // đỉnh vai
  const yN = Math.max(P.neck.y + 0.012 * U, yS + 0.02 * U);
  const yC = legY - 0.065 * U;                    // đáy chậu
  const yH = legY - 0.015 * U;                    // chỗ nở nhất của hông/mông
  const yA = yJ - 0.07 * U;                       // nách
  // Eo đặt theo "dài thân trên" = đỉnh vai (khớp vai + 3cm) -> eo
  const yW = clamp(yJ + 0.03 * U - cm(m.torsoCm), yH + 0.08 * U, yA - 0.16 * U);
  const yB = yW + 0.5 * (yS - yW);
  const yUB = yB - 0.065 * U;
  const yUp = (yB + yA) / 2;
  const yAbd = (yW + yH) / 2;
  const yCap = yC - 0.006 * U;

  // Tâm thân theo z (dáng đứng hơi cong của model)
  const czKeys = [[legY, P.hips.z], [P.spine.y, P.spine.z], [P.chest.y, P.chest.z], [P.neck.y, P.neck.z]].sort((a, b) => a[0] - b[0]);
  const czAt = (y) => {
    if (y <= czKeys[0][0]) return czKeys[0][1];
    for (let i = 0; i < czKeys.length - 1; i++) {
      const [y0, z0] = czKeys[i], [y1, z1] = czKeys[i + 1];
      if (y <= y1) return lerp(z0, z1, (y - y0) / (y1 - y0));
    }
    return czKeys[czKeys.length - 1][1];
  };

  // ---- Vòng khoá của thân ----
  const C = (key) => cm(m[key]);
  const bust = solveBust(C('bustCm'), C('underbustCm') * 1.02, 0.12 * U);
  const neckR = (extra.neckC || cm(0.19 * m.heightCm)) / (2 * Math.PI) * 1.1;
  const torsoKeys = [
    [yCap, { ...solveRing(C('hipCm') * 0.86, 1.6, 0.92, 1.08 * bf) }],
    [yC, solveRing(C('hipCm') * 0.92, 1.55, 0.92, 1.08 * bf)],
    [yH, solveRing(C('hipCm'), 1.38, 0.9, 1.1 * bf)],
    [yAbd, solveRing(C('waistCm') * 0.55 + C('hipCm') * 0.45, 1.36, 0.97, 1.03 + 0.3 * (bf - 1))],
    [yW, solveRing(C('waistCm'), 1.32)],
    [yUB, solveRing(C('underbustCm'), 1.3)],
    [yB, bust],
    [yUp, { ...solveRing(C('underbustCm') * 1.06, 1.4, 1, 0.95), A: bust.A * 0.35 }],
    [yA, solveRing(Math.max(C('underbustCm') * 1.08, C('bustCm') * 0.9), 1.55, 0.95, 1)],
    [yS, { w: C('shoulderCm') / 2, dF: 0.05 * U, dB: 0.056 * U, A: 0 }],
    [yN, { w: neckR, dF: neckR, dB: neckR, A: 0 }],
  ];
  const tys = torsoKeys.map(([y]) => y);
  const tInterp = ['w', 'dF', 'dB', 'A'].map((p) => pchip(tys, torsoKeys.map(([, r]) => r[p])));
  const torsoAt = (y) => ({ w: tInterp[0](y), dF: tInterp[1](y), dB: tInterp[2](y), A: Math.max(0, tInterp[3](y)), cz: czAt(y) });

  // ---- Chân ----
  const legs = ['l', 'r'].map((s) => {
    const top = P[`${s}UpperLeg`], knee = P[`${s}LowerLeg`], ankle = P[`${s}Foot`];
    const thighLen = top.y - knee.y, shin = knee.y - ankle.y;
    const ankleC = cm(0.13 * m.heightCm);
    const keys = [
      [ankle.y - 0.03 * U, solveRing(ankleC * 1.02, 0.95)],
      [ankle.y + 0.025 * U, solveRing(ankleC, 0.95)],
      [knee.y - shin * 0.65, solveRing(C('calfCm') * 0.75, 0.95, 0.95, 1.05)],
      [knee.y - shin * 0.3, solveRing(C('calfCm'), 0.95, 0.88, 1.12)],
      [knee.y, solveRing(C('thighCm') * 0.66, 1.0)],
      [top.y - thighLen * 0.82, solveRing(C('thighCm') * 0.7, 1.0)],
      [top.y - thighLen * 0.5, solveRing(C('thighCm') * 0.86, 0.98)],
      [yC - 0.015 * U, solveRing(C('thighCm'), 1.0, 1.0, 1.04)],
      [top.y + 0.02 * U, solveRing(C('thighCm') * 1.05, 1.0)],
    ];
    const ys = keys.map(([y]) => y);
    const I = ['w', 'dF', 'dB'].map((p) => pchip(ys, keys.map(([, r]) => r[p])));
    // Tâm chân: nội suy tuyến tính theo xương hông -> gối -> cổ chân
    const centerAt = (y) => {
      const a = y >= knee.y ? [knee, top] : [ankle, knee];
      const t = clamp((y - a[0].y) / (a[1].y - a[0].y || 1), -0.3, 1.3);
      return [lerp(a[0].x, a[1].x, t), lerp(a[0].z, a[1].z, t)];
    };
    return {
      side: s, top, knee, ankle, yTop: top.y + 0.02 * U, yBottom: ankle.y - 0.03 * U,
      at: (y) => ({ w: I[0](y), dF: I[1](y), dB: I[2](y), A: 0 }),
      centerAt,
    };
  });

  // ---- Tay (tư thế chữ T: trục tay nằm ngang) ----
  const arms = ['l', 'r'].map((s) => {
    const sh = P[`${s}UpperArm`], el = P[`${s}LowerArm`], wr = P[`${s}Hand`];
    const L1 = sh.distanceTo(el), L2 = el.distanceTo(wr);
    const wristC = Math.max(extra.wristC || 0, cm(0.095 * m.heightCm)) * 1.08;
    const b = C('bicepCm');
    const keys = [
      [-0.035 * U, b * 1.22], [0.02 * U, b * 1.2], [L1 * 0.45, b], [L1, b * 0.84],
      [L1 + L2 * 0.28, b * 0.9], [L1 + L2 - 0.02 * U, wristC], [L1 + L2 + 0.012 * U, wristC],
    ];
    const I = pchip(keys.map(([u]) => u), keys.map(([, c]) => c));
    // điểm trên trục tay theo u (mét cục bộ tính từ khớp vai)
    const axisAt = (u) => {
      if (u <= L1) { const t = u / L1; return [lerp(sh.x, el.x, t), lerp(sh.y, el.y, t), lerp(sh.z, el.z, t)]; }
      const t = (u - L1) / L2;
      return [lerp(el.x, wr.x, t), lerp(el.y, wr.y, t), lerp(el.z, wr.z, t)];
    };
    const at = (u) => { const r = I(u) / (2 * Math.PI); return { a: r * 1.04, b: r * 0.96 }; }; // a: theo chiều đứng, b: trước-sau
    return { side: s, sh, el, wr, L1, L2, uStart: keys[0][0], uEnd: keys[keys.length - 1][0], at, axisAt };
  });

  // ---- Lát cắt ngang cơ thể (dùng cho quần áo phủ ngoài: váy, áo...) ----
  const sectionCache = new Map();
  const sectionHull = (y) => {
    const key = Math.round(y / (0.002 * U));
    if (sectionCache.has(key)) return sectionCache.get(key);
    const pts = [];
    if (y >= yCap && y <= yN) {
      const r = torsoAt(y);
      for (const [x, z] of ringPolygon(r, 48)) pts.push([x, z + r.cz]);
    }
    for (const L of legs) {
      if (y > L.yTop || y < L.yBottom) continue;
      const r = L.at(y);
      const [cx, cz] = L.centerAt(y);
      for (const [x, z] of ringPolygon(r, 32)) pts.push([x + cx, z + cz]);
    }
    const hull = pts.length >= 3 ? convexHull(pts) : [];
    sectionCache.set(key, hull);
    return hull;
  };

  // Số đo đọc lại từ chính mô hình (để kiểm chứng)
  const tape = (r) => perimeter(convexHull(ringPolygon(r, 96))) / k * 100;
  const readout = {
    bustCm: tape(torsoAt(yB)), underbustCm: tape(torsoAt(yUB)), waistCm: tape(torsoAt(yW)),
    hipCm: tape(torsoAt(yH)), thighCm: tape(legs[0].at(yC - 0.015 * U)),
    calfCm: tape(legs[0].at(legs[0].knee.y - (legs[0].knee.y - legs[0].ankle.y) * 0.3)),
    bicepCm: (() => { const r = arms[0].at(arms[0].L1 * 0.45); return perimeter(ringPolygon({ w: r.a, dF: r.b, dB: r.b, A: 0 }, 96)) / k * 100; })(),
    torsoCm: (yJ + 0.03 * U - yW) / k * 100,
  };

  return {
    U, k, P, floorY: extra.floorY,
    levels: { legY, yJ, yS, yN, yC, yH, yA, yW, yB, yUB, yUp, yAbd, yCap },
    torsoAt, czAt, legs, arms, sectionHull, readout,
  };
}
