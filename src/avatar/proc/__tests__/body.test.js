// Test mô hình thân dựng bằng code: vòng đo lại phải đúng số nhập (sai số ≤ 0.5 cm)
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBodyModel, ringPolygon } from '../body.js';
import { convexHull, perimeter } from '../math.js';
import { effectiveValues } from '../../measurements.js';

// Khung xương giả lập người ~160cm, tư thế chữ T (đơn vị mét, k = 1)
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const P = {
  hips: V(0, 0.86), spine: V(0, 0.92), chest: V(0, 1.04), upperChest: V(0, 1.14), neck: V(0, 1.33), head: V(0, 1.42),
  lUpperLeg: V(0.08, 0.78), lLowerLeg: V(0.08, 0.43), lFoot: V(0.08, 0.07), lToes: V(0.08, 0.02, 0.12),
  rUpperLeg: V(-0.08, 0.78), rLowerLeg: V(-0.08, 0.43), rFoot: V(-0.08, 0.07), rToes: V(-0.08, 0.02, 0.12),
  lUpperArm: V(0.15, 1.3), lLowerArm: V(0.41, 1.3), lHand: V(0.64, 1.3),
  rUpperArm: V(-0.15, 1.3), rLowerArm: V(-0.41, 1.3), rHand: V(-0.64, 1.3),
};

const base = effectiveValues({
  heightCm: 160, weightKg: 50, bustCm: 84, waistCm: 64, hipCm: 90,
  shoulderCm: null, underbustCm: null, torsoCm: null, armCm: null, bicepCm: null, thighCm: null, calfCm: null, legCm: null, buttPct: null,
});

describe('Thân dựng theo số đo', () => {
  it('vòng ngực, chân ngực, eo, hông, đùi, bắp chân, bắp tay khớp số nhập', () => {
    const B = buildBodyModel(P, base, 1, { floorY: 0 });
    for (const k of ['bustCm', 'underbustCm', 'waistCm', 'hipCm', 'thighCm', 'calfCm', 'bicepCm', 'torsoCm']) {
      expect(Math.abs(B.readout[k] - base[k])).toBeLessThan(0.5);
    }
  });
  it('đổi số đo thì thân đổi theo (ví dụ eo 75, hông 100)', () => {
    const m = { ...base, waistCm: 75, hipCm: 100 };
    const B = buildBodyModel(P, m, 1, { floorY: 0 });
    expect(B.readout.waistCm).toBeCloseTo(75, 0);
    expect(B.readout.hipCm).toBeCloseTo(100, 0);
  });
  it('độ dày mông chỉ đẩy phía sau ra, vòng hông giữ nguyên', () => {
    const a = buildBodyModel(P, { ...base, buttPct: 100 }, 1, { floorY: 0 });
    const b = buildBodyModel(P, { ...base, buttPct: 125 }, 1, { floorY: 0 });
    const ya = a.levels.yH;
    expect(b.torsoAt(ya).dB).toBeGreaterThan(a.torsoAt(ya).dB);
    expect(b.torsoAt(ya).dF).toBeLessThan(a.torsoAt(ya).dF);
    expect(b.readout.hipCm).toBeCloseTo(a.readout.hipCm, 0);
  });
  it('ngực to hơn chân ngực thì có khối ngực, chu vi thước dây = vòng ngực', () => {
    const B = buildBodyModel(P, { ...base, bustCm: 92, underbustCm: 72 }, 1, { floorY: 0 });
    const r = B.torsoAt(B.levels.yB);
    expect(r.A).toBeGreaterThan(0);
    expect(perimeter(convexHull(ringPolygon(r, 96))) * 100).toBeCloseTo(92, 0);
  });
});

// ---------------- BR14: số đo hợp lý + lớp hiển thị chống dị dạng ----------------
import { ALL as ALL_DEFS, toDisplay, validateMeasurements, typicalRange } from '../../measurements.js';
import { minShoulderCm } from '../body.js';

describe('BR14 – kiểm tra số đo', () => {
  const v0 = { heightCm: 160, weightKg: 50, bustCm: 84, waistCm: 64, hipCm: 90, shoulderCm: null, underbustCm: null, torsoCm: null, armCm: null, bicepCm: null, thighCm: null, calfCm: null, legCm: null, buttPct: null };
  it('đúng: bộ số mặc định không chặn, không cảnh báo', () => {
    const r = validateMeasurements(v0);
    expect(r.block).toEqual([]);
    expect(r.warn).toEqual([]);
  });
  it('chặn: chân ngực ≥ ngực − 2, bắp chân ≥ đùi, bắp tay ≥ đùi, chân > 60% chiều cao, vượt giới hạn tuyệt đối', () => {
    expect(validateMeasurements({ ...v0, underbustCm: 83 }).block[0].key).toBe('underbustCm');
    expect(validateMeasurements({ ...v0, thighCm: 45, calfCm: 46 }).block.some((b) => b.key === 'calfCm')).toBe(true);
    expect(validateMeasurements({ ...v0, thighCm: 40, bicepCm: 41 }).block.some((b) => b.key === 'bicepCm')).toBe(true);
    expect(validateMeasurements({ ...v0, legCm: 100 }).block.some((b) => b.key === 'legCm')).toBe(true);
    expect(validateMeasurements({ ...v0, bustCm: 200 }).block.some((b) => b.key === 'bustCm')).toBe(true);
  });
  it('cảnh báo nhưng không chặn: eo > hông (dáng táo), số ngoài khoảng thường gặp', () => {
    const r = validateMeasurements({ ...v0, waistCm: 98, hipCm: 90 });
    expect(r.ok).toBe(true);
    expect(r.warn.some((w) => w.key === 'waistCm')).toBe(true);
  });
  it('khoảng thanh trượt co giãn theo chiều cao', () => {
    const leg = ALL_DEFS.find((d) => d.key === 'legCm');
    expect(typicalRange(leg, { heightCm: 140 })[1]).toBeLessThan(typicalRange(leg, { heightCm: 180 })[1]);
  });
  it('hiển thị: đùi 70/hông 75 được thu lại, có ghi chú; số thật không đổi', () => {
    const v = { ...v0, hipCm: 75, thighCm: 70 };
    const { values, notes } = toDisplay(v, minShoulderCm);
    expect(values.thighCm).toBeLessThanOrEqual(values.hipCm * 0.6 + 1e-9);
    expect(values.thighCm).toBeLessThan(50);
    expect(notes.length).toBeGreaterThan(0);
    expect(v.thighCm).toBe(70);
  });
});

describe('Fuzz – 500 bộ số ngẫu nhiên không làm avatar dị dạng', () => {
  it('mọi bộ số không bị chặn đều qua 5 kiểm tra hình học', () => {
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let tested = 0;
    const fails = [];
    for (let i = 0; i < 1500 && tested < 500; i++) {
      const v = {};
      for (const d of ALL_DEFS) v[d.key] = rnd() < 0.3 && !['heightCm', 'weightKg', 'bustCm', 'waistCm', 'hipCm'].includes(d.key)
        ? null : Math.round(d.min + rnd() * (d.max - d.min));
      if (!validateMeasurements(v).ok) continue;
      tested++;
      const { values } = toDisplay(v, minShoulderCm);
      const k = 160 / values.heightCm; // khung xương mẫu 160cm, cả người scale theo chiều cao
      const B = buildBodyModel(P, values, k, { floorY: 0 });
      if (B.checks.length) fails.push({ v, checks: B.checks });
    }
    expect(tested).toBeGreaterThan(200);
    const summary = {}; fails.forEach((f) => f.checks.forEach((c) => { summary[c] = (summary[c] || 0) + 1; }));
    expect({ tested, summary, sample: fails.slice(0, 2).map((f) => f.v) }).toEqual({ tested, summary: {}, sample: [] });
  });
});
