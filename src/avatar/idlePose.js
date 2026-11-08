// =============================================================
// idlePose.js — Tư thế (đứng / khoe đồ / tạo dáng) + thở + chớp mắt
// Dùng normalized bones của VRM: mọi model đều có trục giống nhau.
// Đổi tư thế thì chuyển mượt (nội suy dần tới tư thế mới).
// =============================================================

// Góc Euler [x, y, z] (radian) cho từng xương, so với tư thế chữ T
const POSES = {
  dung: {
    leftUpperArm: [0, 0, -1.25], rightUpperArm: [0, 0, 1.25],
    leftLowerArm: [0, 0, -0.12], rightLowerArm: [0, 0, 0.12],
    leftHand: [0, 0, -0.1], rightHand: [0, 0, 0.1],
  },
  // Chống 1 tay lên hông, dồn trọng tâm 1 chân
  khoe: {
    leftUpperArm: [0, 0, -1.2], rightUpperArm: [0, 0.25, 0.92],
    leftLowerArm: [0, 0, -0.15], rightLowerArm: [0, 0.35, 1.3],
    leftHand: [0, 0, -0.1], rightHand: [0, 0, 0.35],
    hips: [0, 0, 0.045], spine: [0, 0, -0.05], chest: [0, 0, -0.02], head: [0, 0, 0.07],
    leftUpperLeg: [-0.12, 0, 0.02], leftLowerLeg: [0.24, 0, 0], leftFoot: [-0.11, 0, 0],
    rightUpperLeg: [0, 0, -0.045],
  },
  // Tay trái chống hông, xoay người nhẹ, nghiêng đầu
  tao_dang: {
    leftUpperArm: [0, -0.25, -0.92], rightUpperArm: [0.05, 0, 1.15],
    leftLowerArm: [0, -0.35, -1.3], rightLowerArm: [0, 0.5, 0.2],
    leftHand: [0, 0, -0.35], rightHand: [0, 0, 0.15],
    hips: [0, 0.12, -0.04], spine: [0, -0.06, 0.04], chest: [0, -0.05, 0.02], head: [0.05, -0.1, -0.09],
    rightUpperLeg: [-0.14, 0, -0.03], rightLowerLeg: [0.26, 0, 0], rightFoot: [-0.11, 0, 0],
    leftUpperLeg: [0, 0, 0.04],
  },
};
export const POSE_LIST = [['dung', 'Đứng'], ['khoe', 'Khoe đồ'], ['tao_dang', 'Tạo dáng']];

const BONES = ['hips', 'spine', 'chest', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm',
  'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];

export function createIdle() {
  let nextBlink = 2;
  let blinkT = -1;
  let target = POSES.dung;
  const cur = Object.fromEntries(BONES.map((b) => [b, [...(POSES.dung[b] || [0, 0, 0])]]));

  function update(vrm, t, dt) {
    const h = vrm.humanoid;
    const n = (name) => h.getNormalizedBoneNode(name);
    const k = 1 - Math.exp(-dt * 5); // tốc độ chuyển tư thế
    for (const b of BONES) {
      const tg = target[b] || [0, 0, 0];
      for (let i = 0; i < 3; i++) cur[b][i] += (tg[i] - cur[b][i]) * k;
    }
    const breath = Math.sin(t * 1.7);
    const sway = Math.sin(t * 0.5);
    const set = (b, dx = 0, dy = 0, dz = 0) => {
      const node = n(b);
      if (node) node.rotation.set(cur[b][0] + dx, cur[b][1] + dy, cur[b][2] + dz);
    };
    for (const b of BONES) set(b);
    // Thở + đung đưa rất nhẹ cộng lên trên tư thế
    set('chest', breath * 0.02);
    set('spine', -breath * 0.008, sway * 0.02);
    set('head', Math.sin(t * 0.6) * 0.02, Math.sin(t * 0.4) * 0.05);
    set('leftUpperArm', 0, 0, breath * 0.01);
    set('rightUpperArm', 0, 0, -breath * 0.01);

    // Chớp mắt mỗi 2-5 giây
    const em = vrm.expressionManager;
    if (em) {
      nextBlink -= dt;
      if (nextBlink <= 0 && blinkT < 0) { blinkT = 0; nextBlink = 2 + Math.random() * 3; }
      if (blinkT >= 0) {
        blinkT += dt;
        const v = blinkT < 0.08 ? blinkT / 0.08 : Math.max(0, 1 - (blinkT - 0.08) / 0.1);
        em.setValue('blink', v);
        if (blinkT > 0.2) { blinkT = -1; em.setValue('blink', 0); }
      }
    }
  }
  update.setPose = (name) => { target = POSES[name] || POSES.dung; };
  return update;
}
