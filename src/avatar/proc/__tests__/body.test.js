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
