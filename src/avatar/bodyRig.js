// =============================================================
// bodyRig.js — Biến số đo cơ thể (cm) thành hình dáng avatar VRM
// -------------------------------------------------------------
// Ý tưởng chính:
//  1. Chiều DÀI (chân, tay, thân trên): dời vị trí khớp con ra xa
//     -> xương dài ra thật, quần áo bám theo.
//  2. Độ RỘNG / VÒNG (eo, hông, đùi, ngực, vai, bắp tay, bắp chân): KHÔNG đổi bone.scale
//     (vì scale bị kế thừa xuống xương con -> tay chân méo), mà chèn
//     ma trận co giãn thẳng vào "skinning matrix" của từng xương.
//     -> chỉ phần thịt bám vào xương đó phình/thon, xương con không bị ảnh hưởng.
//  3. Chiều cao: scale đều toàn bộ nhân vật.
//  4. Đo lại avatar bằng cách CẮT LÁT lưới 3D (giống quấn thước dây):
//     mặt phẳng cắt mesh -> bao lồi (convex hull) -> chu vi.
//     Lặp vài lần để số đo avatar khớp số đo người dùng nhập.
// =============================================================
import * as THREE from 'three';

// Giới hạn hệ số co giãn -> chống dị dạng khi nhập số quá lố
const LIMITS = {
  root: [0.7, 1.4], shoulder: [0.8, 1.4], bust: [0.6, 1.7], underbust: [0.75, 1.4],
  waist: [0.7, 1.5], hip: [0.75, 1.45], thigh: [0.7, 1.5], calf: [0.7, 1.9],
  leg: [0.8, 1.2], torso: [0.85, 1.3], arm: [0.85, 1.2], bicep: [0.7, 2.1],
};

// Cặp (hệ số <-> số đo) được tinh chỉnh tự động
const FIT_PAIRS = [
  ['root', 'heightCm'], ['shoulder', 'shoulderCm'], ['bust', 'bustCm'], ['underbust', 'underbustCm'],
  ['waist', 'waistCm'], ['hip', 'hipCm'], ['thigh', 'thighCm'], ['calf', 'calfCm'],
  ['leg', 'legCm'], ['torso', 'torsoCm'], ['arm', 'armCm'], ['bicep', 'bicepCm'],
];

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

// Ma trận co giãn theo 1 hướng d (trong hệ toạ độ của xương):
// dọc theo d nhân 'along', vuông góc với d nhân 'perp'.  M = perp*I + (along - perp)*d*d^T
function scaleAlong(d, along, perp) {
  const k = along - perp;
  const { x, y, z } = d;
  return new THREE.Matrix4().set(
    perp + k * x * x, k * x * y, k * x * z, 0,
    k * y * x, perp + k * y * y, k * y * z, 0,
    k * z * x, k * z * y, perp + k * z * z, 0,
    0, 0, 0, 1,
  );
}

// Co giãn riêng theo 2 trục vuông góc a, b (ví dụ: ngang hông và dày mông)
function scaleTwoAxes(a, fa, b, fb) {
  const m = new THREE.Matrix4();
  const e = m.elements; // column-major
  const add = (d, k) => {
    const v = [d.x, d.y, d.z];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) e[c * 4 + r] += k * v[r] * v[c];
  };
  add(a, fa - 1);
  add(b, fb - 1);
  return m;
}

// Chu vi bao lồi 2D (monotone chain) = độ dài thước dây quấn quanh
function hullPerimeter(pts) {
  if (pts.length < 3) return 0;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let per = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    per += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return per;
}

export class BodyRig {
  constructor(vrm) {
    this.vrm = vrm;
    this.root = vrm.scene;
    this.factors = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, 1]));
    this.butt = 1;
    this.skinScale = new Map(); // Bone -> Matrix4 chèn vào skinning
    this.restPos = new Map();   // Bone -> vị trí gốc (để dời khớp)
    this._axisCache = new Map();

    vrm.humanoid.resetNormalizedPose();
    vrm.humanoid.update();
    this.root.updateMatrixWorld(true);

    const b = (n) => vrm.humanoid.getRawBoneNode(n);
    this.bones = {
      hips: b('hips'), spine: b('spine'), chest: b('chest'), upperChest: b('upperChest'), neck: b('neck'),
      lShoulder: b('leftShoulder'), rShoulder: b('rightShoulder'),
      lUpperArm: b('leftUpperArm'), rUpperArm: b('rightUpperArm'),
      lLowerArm: b('leftLowerArm'), rLowerArm: b('rightLowerArm'),
      lHand: b('leftHand'), rHand: b('rightHand'),
      lUpperLeg: b('leftUpperLeg'), rUpperLeg: b('rightUpperLeg'),
      lLowerLeg: b('leftLowerLeg'), rLowerLeg: b('rightLowerLeg'),
      lFoot: b('leftFoot'), rFoot: b('rightFoot'),
    };
    const B = this.bones;
    // Xương ngực phụ của VRoid (J_Sec_L_Bust1 / J_Sec_R_Bust1)
    this.bustBones = [];
    this.root.traverse((o) => { if (o.isBone && /Bust1$/i.test(o.name)) this.bustBones.push(o); });

    // Mọi xương sẽ bị dời vị trí -> ghi nhớ vị trí gốc
    const movable = [B.chest, B.upperChest, B.neck, B.lShoulder, B.rShoulder,
      B.lLowerArm, B.rLowerArm, B.lHand, B.rHand,
      B.lUpperLeg, B.rUpperLeg, B.lLowerLeg, B.rLowerLeg, B.lFoot, B.rFoot];
    for (const bone of movable) if (bone) this.restPos.set(bone, bone.position.clone());

    // Cache trục cục bộ ngay khi còn ở tư thế gốc (sau đó xương xoay theo animation)
    if (B.hips) for (const ax of [UP, RIGHT, FORWARD]) this._localAxis(B.hips, ax);
    const host = B.upperChest || B.chest;
    if (host) { this._localAxis(host, RIGHT); this._localAxis(host, UP); }

    this._collectMeshes();
    this._patchSkeletons();
  }

  // Hướng 1 trục của "không gian model" nhìn từ hệ toạ độ cục bộ của xương (tư thế gốc)
  _localAxis(bone, worldAxis) {
    const key = `${bone.uuid}:${worldAxis.x},${worldAxis.y},${worldAxis.z}`;
    if (this._axisCache.has(key)) return this._axisCache.get(key);
    const qBone = bone.getWorldQuaternion(new THREE.Quaternion());
    const qRoot = this.root.getWorldQuaternion(new THREE.Quaternion());
    const qRel = qRoot.invert().multiply(qBone);
    const axis = worldAxis.clone().applyQuaternion(qRel.invert()).normalize();
    this._axisCache.set(key, axis);
    return axis;
  }

  // Hướng từ xương tới xương con (trục dọc của đoạn xương)
  _dirTo(child) {
    return (this.restPos.get(child) || child.position).clone().normalize();
  }

  _collectMeshes() {
    // VRoid tự xoá phần da bị quần áo che khi export -> đo vòng phải tính cả quần áo
    // (giống quấn thước dây bên ngoài đồ). Mẹo: cho nhân vật mặc đồ ôm để số đo chuẩn nhất.
    this.bodyMeshes = []; // thân + quần áo (không tóc, không mặt) -> đo vòng
    this.solidMeshes = []; // mọi thứ trừ tóc -> đo chiều cao + chạm đất
    this.root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const names = mats.map((m) => m?.name || '').join(' ') + ' ' + o.name;
      if (/hair/i.test(names)) return;
      this.solidMeshes.push(o);
      if (!/face|eye|brow|mouth/i.test(names)) this.bodyMeshes.push(o);
    });
  }

  // Ghi đè Skeleton.update(): sau khi three.js tính skinning matrix, chèn thêm co giãn.
  // Với xương có S:  T = World * S * World^-1  (co giãn quanh khớp, trong không gian thế giới)
  // Mỗi xương nhận T của chính nó + T của các xương cha "có S" cho tới xương humanoid gần nhất.
  // -> xương phụ (twist bone ở tay/chân, xương ngực, xương váy) co giãn theo đoạn chứa nó.
  _patchSkeletons() {
    const humanSet = new Set(Object.values(this.vrm.humanoid.humanBones).map((hb) => hb.node));
    const ownersOf = (bone) => {
      const list = [];
      for (let o = bone; o && o.isBone; o = o.parent) {
        list.push(o);
        if (humanSet.has(o)) break; // dừng ở xương humanoid đầu tiên
      }
      return list; // từ trong ra ngoài
    };

    const skeletons = new Set();
    this.root.traverse((o) => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
    const rig = this;
    const tCache = new Map();
    const inv = new THREE.Matrix4();
    const acc = new THREE.Matrix4();
    let frameId = 0;
    const T = (bone) => { // T của 1 xương, cache theo lượt update
      const hit = tCache.get(bone);
      if (hit && hit.id === frameId) return hit.m;
      const m = (hit?.m || new THREE.Matrix4()).multiplyMatrices(bone.matrixWorld, rig.skinScale.get(bone));
      m.multiply(inv.copy(bone.matrixWorld).invert());
      tCache.set(bone, { id: frameId, m });
      return m;
    };

    this._unpatch = [];
    for (const sk of skeletons) {
      const owners = sk.bones.map((b) => (b ? ownersOf(b) : []));
      const original = sk.update;
      sk.update = function patchedUpdate() {
        original.call(this);
        if (rig.skinScale.size === 0) return;
        frameId++;
        for (let i = 0; i < this.bones.length; i++) {
          let any = false;
          acc.identity();
          for (const o of owners[i]) { // ngoài cùng nhân trước
            if (!rig.skinScale.has(o)) continue;
            acc.premultiply(T(o));
            any = true;
          }
          if (!any) continue;
          acc.multiply(this.bones[i].matrixWorld).multiply(this.boneInverses[i]);
          acc.toArray(this.boneMatrices, i * 16);
        }
      };
      this._unpatch.push(() => { sk.update = original; });
    }
  }

  dispose() { this._unpatch?.forEach((fn) => fn()); }

  // Dời khớp con dọc theo hướng gốc: vị trí = gốc * k
  _stretch(bone, k) { if (bone) bone.position.copy(this.restPos.get(bone)).multiplyScalar(k); }

  // Áp các hệ số co giãn lên khung xương
  _apply(f) {
    const B = this.bones;
    const S = this.skinScale;
    S.clear();
    const springs = this.vrm.springBoneManager;
    springs?.reset(); // đưa xương vật lý (tóc, váy) về gốc trước khi dời khớp

    const put = (bone, m) => {
      if (!bone) return;
      S.set(bone, S.has(bone) ? S.get(bone).clone().multiply(m) : m);
    };

    // Chiều cao: scale đều toàn thân
    this.root.scale.setScalar(f.root);

    // Hông: ngang theo hệ số hông, dày trước-sau thêm theo "độ dày mông"
    if (B.hips) {
      const right = this._localAxis(B.hips, RIGHT);
      const fwd = this._localAxis(B.hips, FORWARD);
      put(B.hips, scaleTwoAxes(right, f.hip, fwd, f.hip * this.butt));
      const spread = 1 + (f.hip - 1) * 0.7; // chân dạt ra theo hông
      for (const leg of [B.lUpperLeg, B.rUpperLeg]) {
        const p = this.restPos.get(leg).clone();
        p.addScaledVector(right, p.dot(right) * (spread - 1));
        leg.position.copy(p);
      }
    }

    // Thân trên: eo (spine) + lồng ngực/chân ngực (chest), dài/ngắn theo hệ số thân
    const above = B.upperChest || B.neck;
    if (B.spine && B.chest) {
      put(B.spine, scaleAlong(this._dirTo(B.chest), f.torso, f.waist));
      this._stretch(B.chest, f.torso);
    }
    if (B.chest && above) {
      put(B.chest, scaleAlong(this._dirTo(above), f.torso, f.underbust));
      this._stretch(above, f.torso);
    }

    // Vai: kéo rộng ngực trên theo chiều ngang + dời khớp vai ra
    const host = B.upperChest || B.chest;
    if (host) {
      const right = this._localAxis(host, RIGHT);
      put(host, scaleAlong(right, f.shoulder, 1));
      for (const sh of [B.lShoulder, B.rShoulder]) {
        if (!sh) continue;
        const p = this.restPos.get(sh).clone();
        p.addScaledVector(right, p.dot(right) * (f.shoulder - 1));
        sh.position.copy(p);
      }
    }

    // Ngực: dùng xương ngực VRoid nếu có, không thì phình ngực trên
    if (this.bustBones.length) {
      for (const bb of this.bustBones) put(bb, new THREE.Matrix4().makeScale(f.bust, f.bust, f.bust));
    } else if (host) {
      put(host, scaleAlong(this._localAxis(host, UP), 1, f.bust));
    }

    // Tay: dài/ngắn (dời khuỷu + cổ tay), bắp tay to/nhỏ, cẳng tay theo 1 nửa
    for (const [ua, la, hand] of [[B.lUpperArm, B.lLowerArm, B.lHand], [B.rUpperArm, B.rLowerArm, B.rHand]]) {
      if (!ua || !la || !hand) continue;
      put(ua, scaleAlong(this._dirTo(la), f.arm, f.bicep));
      put(la, scaleAlong(this._dirTo(hand), f.arm, 1 + (f.bicep - 1) * 0.5));
      this._stretch(la, f.arm);
      this._stretch(hand, f.arm);
    }

    // Chân: đùi + bắp chân to/nhỏ, dài/ngắn (dời đầu gối & cổ chân)
    for (const [up, low, foot] of [[B.lUpperLeg, B.lLowerLeg, B.lFoot], [B.rUpperLeg, B.rLowerLeg, B.rFoot]]) {
      if (!up || !low || !foot) continue;
      put(up, scaleAlong(this._dirTo(low), f.leg, f.thigh));
      put(low, scaleAlong(this._dirTo(foot), f.leg, f.calf));
      this._stretch(low, f.leg);
      this._stretch(foot, f.leg);
    }

    this.root.updateMatrixWorld(true);
    springs?.setInitState(); // ghi nhớ trạng thái gốc mới cho tóc/váy
  }

  // Toạ độ thế giới của mọi đỉnh (đã skinning) + danh sách tam giác.
  // Tự skinning bằng skeleton.boneMatrices (đã gồm co giãn), vì mesh.getVertexPosition()
  // của three.js tính lại từ bone.matrixWorld -> bỏ qua phần co giãn ta chèn vào.
  _worldVerts(meshes) {
    const out = [];
    const base = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const acc = new THREE.Vector3();
    for (const mesh of meshes) {
      const sk = mesh.skeleton;
      sk.update();
      const mats = sk.bones.map((_, i) => new THREE.Matrix4().fromArray(sk.boneMatrices, i * 16));
      const g = mesh.geometry;
      const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        base.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
        acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w === 0) continue;
          acc.addScaledVector(tmp.copy(base).applyMatrix4(mats[si.getComponent(i, k)]), w);
        }
        acc.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
        arr[i * 3] = acc.x; arr[i * 3 + 1] = acc.y; arr[i * 3 + 2] = acc.z;
      }
      const idx = g.index;
      const tris = idx ? Uint32Array.from(idx.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
      out.push({ arr, tris });
    }
    return out;
  }

  // Quét nhiều lát cắt vuông góc trục 'axis' (0 = x, 1 = y) từ a tới b.
  // Trả về lát lớn nhất ('max') hoặc nhỏ nhất ('min') + vị trí lát đó.
  // filter(x, y, z) loại bỏ phần không muốn đo (tay, chân kia...)
  _scan(verts, a, b, filter, mode, axis = 1) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    // B1: lọc trước các tam giác nằm trong khoảng quét -> nhanh hơn nhiều
    const cands = [];
    for (const { arr, tris } of verts) {
      const pick = [];
      for (let t = 0; t < tris.length; t += 3) {
        const c0 = arr[tris[t] * 3 + axis], c1 = arr[tris[t + 1] * 3 + axis], c2 = arr[tris[t + 2] * 3 + axis];
        if (Math.max(c0, c1, c2) >= lo && Math.min(c0, c1, c2) <= hi) pick.push(t);
      }
      cands.push({ arr, tris, pick });
    }
    // B2: cắt từng lát
    const u = axis === 1 ? 0 : 1; // 2 trục còn lại để chiếu xuống mặt phẳng
    let best = { value: mode === 'max' ? 0 : Infinity, level: lo };
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const level = lo + ((hi - lo) * s) / steps;
      const pts = [];
      for (const { arr, tris, pick } of cands) {
        for (const t of pick) {
          for (let e = 0; e < 3; e++) {
            const ia = tris[t + e] * 3, ib = tris[t + ((e + 1) % 3)] * 3;
            const ca = arr[ia + axis], cb = arr[ib + axis];
            if ((ca - level) * (cb - level) > 0 || ca === cb) continue;
            const k = (level - ca) / (cb - ca);
            const x = arr[ia] + (arr[ib] - arr[ia]) * k;
            const y = arr[ia + 1] + (arr[ib + 1] - arr[ia + 1]) * k;
            const z = arr[ia + 2] + (arr[ib + 2] - arr[ia + 2]) * k;
            if (filter(x, y, z)) pts.push([u === 0 ? x : y, z]);
          }
        }
      }
      const c = hullPerimeter(pts);
      if (c > 0 && (mode === 'max' ? c > best.value : c < best.value)) best = { value: c, level };
    }
    if (!Number.isFinite(best.value)) best.value = 0;
    return best;
  }

  // Đo avatar ở tư thế chữ T (tay dang ngang để không lẫn vào lát cắt thân)
  _measure(girths = true) {
    this.vrm.humanoid.resetNormalizedPose();
    this.vrm.humanoid.update();
    this.root.updateMatrixWorld(true);

    const B = this.bones;
    const wp = (bone) => bone.getWorldPosition(new THREE.Vector3());
    const solid = this._worldVerts(this.solidMeshes);
    const body = girths ? this._worldVerts(this.bodyMeshes) : null;

    let floor = Infinity, top = -Infinity;
    for (const { arr } of solid) {
      for (let i = 1; i < arr.length; i += 3) { floor = Math.min(floor, arr[i]); top = Math.max(top, arr[i]); }
    }

    const hips = wp(B.hips), spine = wp(B.spine), chest = wp(B.chest);
    const upperChest = B.upperChest ? wp(B.upperChest) : chest;
    const lArm = wp(B.lUpperArm), rArm = wp(B.rUpperArm), lElbow = wp(B.lLowerArm), lWrist = wp(B.lHand);
    const lLeg = wp(B.lUpperLeg), rLeg = wp(B.rUpperLeg), lKnee = wp(B.lLowerLeg), lAnkle = wp(B.lFoot);
    const s = this.root.scale.x;
    const cx = hips.x;
    const halfShoulder = Math.abs(lArm.x - rArm.x) / 2;
    const torso = (x) => Math.abs(x - cx) < halfShoulder * 0.9;
    const legY = (lLeg.y + rLeg.y) / 2;
    const thighLen = lLeg.y - lKnee.y;
    const shinLen = lKnee.y - lAnkle.y;
    const side = Math.sign(lLeg.x - cx);
    const armDir = Math.sign(lElbow.x - lArm.x);
    const upperArmLen = lArm.distanceTo(lElbow);

    if (!girths) {
      // Chế độ thân dựng bằng code: chỉ cần số đo độ dài (vòng do ProcAvatar dựng đúng số)
      return {
        heightCm: (top - floor) * 100,
        shoulderCm: (lArm.distanceTo(rArm) + 0.06 * s) * 100,
        legCm: (legY - floor) * 100,
        armCm: (upperArmLen + lElbow.distanceTo(lWrist) + 0.03 * s) * 100,
        floorY: floor,
      };
    }
    const bust = this._scan(body, chest.y, Math.min(upperChest.y + (lArm.y - upperChest.y) * 0.5, lArm.y - 0.06 * s), torso, 'max');
    // Eo tự nhiên = chỗ thon nhất giữa xương spine và đáy lồng ngực
    const waist = this._scan(body, spine.y, chest.y + 0.02 * s, torso, 'min');
    const underbust = this._scan(body, bust.level - 0.075 * s, bust.level - 0.055 * s, torso, 'min');
    const hip = this._scan(body, legY - thighLen * 0.2, hips.y + thighLen * 0.1, (x) => Math.abs(x - cx) < halfShoulder * 1.4, 'max');
    const thigh = this._scan(body, legY - thighLen * 0.45, legY - thighLen * 0.25, (x) => (x - cx) * side > 0, 'max');
    const calf = this._scan(body, lKnee.y - shinLen * 0.45, lKnee.y - shinLen * 0.15,
      (x) => (x - cx) * side > 0 && Math.abs(x - lKnee.x) < 0.12 * s, 'max');
    // Bắp tay: cắt lát dọc (vuông góc trục x) vì tay đang dang ngang
    const bicep = this._scan(body, lArm.x + armDir * upperArmLen * 0.35, lArm.x + armDir * upperArmLen * 0.65,
      (x, y, z) => Math.abs(y - lArm.y) < 0.09 * s && Math.abs(z - lArm.z) < 0.09 * s, 'max', 0);

    return {
      heightCm: (top - floor) * 100,
      shoulderCm: (lArm.distanceTo(rArm) + 0.06 * s) * 100,
      bustCm: bust.value * 100,
      underbustCm: underbust.value * 100,
      waistCm: waist.value * 100,
      hipCm: hip.value * 100,
      thighCm: thigh.value * 100,
      calfCm: calf.value * 100,
      bicepCm: bicep.value * 100,
      legCm: (legY - floor) * 100,
      // Dài thân trên: đo thẳng đứng từ đỉnh vai (khớp vai + 3cm) xuống eo
      torsoCm: (lArm.y + 0.03 * s - waist.level) * 100,
      // Dài tay: đỉnh vai -> khuỷu -> cổ tay
      armCm: (upperArmLen + lElbow.distanceTo(lWrist) + 0.03 * s) * 100,
      floorY: floor,
    };
  }

  // Lặp: áp hệ số -> đo -> chỉnh hệ số theo tỉ lệ (mục tiêu / thực đo)
  fit(target, { lengthsOnly = false } = {}) {
    const f = this.factors;
    const pairs = lengthsOnly
      ? FIT_PAIRS.filter(([fk]) => ['root', 'shoulder', 'leg', 'arm'].includes(fk))
      : FIT_PAIRS;
    if (lengthsOnly) for (const k of ['bust', 'underbust', 'waist', 'hip', 'thigh', 'calf', 'torso', 'bicep']) f[k] = 1;
    this.butt = (target.buttPct ?? 100) / 100;
    let m;
    for (let it = 0; it < (lengthsOnly ? 4 : 6); it++) {
      this._apply(f);
      m = this._measure(!lengthsOnly);
      for (const [fk, mk] of pairs) {
        if (m[mk] > 0 && target[mk] > 0) f[fk] = clamp(f[fk] * (target[mk] / m[mk]), LIMITS[fk]);
      }
    }
    this._apply(f);
    m = this._measure(!lengthsOnly);
    // Chân chạm đất: dời cả nhân vật để điểm thấp nhất nằm ở y = 0
    this.root.position.y -= m.floorY;
    this.root.updateMatrixWorld(true);

    const result = {};
    for (const [, mk] of pairs) result[mk] = Math.round(m[mk] * 10) / 10;
    return { measured: result, factors: { ...f } };
  }
}
