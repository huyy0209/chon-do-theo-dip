// =============================================================
// ProcAvatar.js — Thay thân + quần áo của VRoid bằng thân/đồ dựng bằng code.
// Giữ lại của VRoid: đầu, mặt, tóc, cổ, bàn tay (phần "anime" đẹp nhất).
// Thân dựng thẳng từ số đo -> vòng nào cũng đúng số, không phụ thuộc đồ gốc của model.
// =============================================================
import * as THREE from 'three';
import {
  MToonMaterial, VRMSpringBoneCollider, VRMSpringBoneColliderShapeCapsule, VRMSpringBoneJoint,
} from '@pixiv/three-vrm';
import { makeFabric } from './fabric.js';
import { buildBodyModel } from './body.js';
import { toGeometry } from './geom.js';
import { buildBodySkin, buildOutfit, makeWeights, needsSkirtRig } from './garments.js';
import { convexHull, lerp, perimeter, rayToPolygon } from './math.js';

const SKIN_FALLBACK = '#fbe2d6';

// Lấy màu da trung bình từ texture da của VRoid
function sampleSkinColor(mat) {
  try {
    const img = mat?.map?.image;
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 48, 48);
    const d = g.getImageData(0, 0, 48, 48).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      if (lum < 0.6 || d[i] < d[i + 2]) continue; // bỏ chỗ tối, chỗ xanh
      r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
    }
    if (n < 20) return null;
    return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch {
    return null;
  }
}

export class ProcAvatar {
  constructor(vrm, rig) {
    this.vrm = vrm;
    this.rig = rig;
    this.root = vrm.scene;
    this.group = new THREE.Group();
    this.group.name = 'ProcAvatar';
    this.root.add(this.group);
    this.meshes = [];
    this.saved = [];

    const h = vrm.humanoid;
    const raw = (n) => h.getRawBoneNode(n);
    this.boneMap = {
      hips: raw('hips'), spine: raw('spine'), chest: raw('chest'), upperChest: raw('upperChest') || raw('chest'),
      neck: raw('neck'), head: raw('head'),
      lUpperLeg: raw('leftUpperLeg'), lLowerLeg: raw('leftLowerLeg'), lFoot: raw('leftFoot'), lToes: raw('leftToes') || raw('leftFoot'),
      rUpperLeg: raw('rightUpperLeg'), rLowerLeg: raw('rightLowerLeg'), rFoot: raw('rightFoot'), rToes: raw('rightToes') || raw('rightFoot'),
      lShoulder: raw('leftShoulder') || raw('upperChest') || raw('chest'), rShoulder: raw('rightShoulder') || raw('upperChest') || raw('chest'),
      lUpperArm: raw('leftUpperArm'), lLowerArm: raw('leftLowerArm'), lHand: raw('leftHand'),
      rUpperArm: raw('rightUpperArm'), rLowerArm: raw('rightLowerArm'), rHand: raw('rightHand'),
    };
    this.hasToes = { l: Boolean(raw('leftToes')), r: Boolean(raw('rightToes')) };

    // Phân loại mesh của VRoid
    this.skinMeshes = [];
    this.clothMeshes = [];
    this.root.traverse((o) => {
      if (!o.isSkinnedMesh || o.parent === this.group) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const name = mats.map((m) => m?.name || '').join(' ');
      if (/hair|face|eye|brow|mouth/i.test(name)) return;
      if (/skin/i.test(name)) this.skinMeshes.push(o);
      else this.clothMeshes.push(o);
    });

    // Vật liệu mẫu: nhân bản từ vật liệu da VRoid -> cùng kiểu cel-shading + viền
    const sm = this.skinMeshes[0];
    const mats = sm ? (Array.isArray(sm.material) ? sm.material : [sm.material]) : [];
    this.tplMain = mats.find((m) => m?.isMToonMaterial && !m.isOutline) || null;
    this.tplOutline = mats.find((m) => m?.isMToonMaterial && m.isOutline) || null;
    this.skinColor = sampleSkinColor(this.tplMain) || new THREE.Color(SKIN_FALLBACK);
    if (this.tplMain?.color) this.skinColor.multiply(this.tplMain.color);

    this._cullAndHide();
    // Đầu/tóc/tay VRoid cũng đổ bóng (tóc đổ lên vai...)
    this.root.traverse((o) => {
      if (!o.isMesh || o.parent === this.group) return;
      o.castShadow = true;
      const n = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name || '').join(' ');
      o.receiveShadow = !/face|eye|brow|mouth/i.test(n); // mặt anime không nhận bóng cho sạch
    });
    this.skirt = null;
  }

  // Ẩn đồ gốc; chỉ giữ da ở đầu/cổ/bàn tay (đỉnh có trọng số ≥ 50% vào các xương này)
  _cullAndHide() {
    const keep = new Set();
    const addTree = (b) => b?.traverse((o) => { if (o.isBone) keep.add(o); });
    addTree(this.boneMap.neck);
    addTree(this.boneMap.lHand);
    addTree(this.boneMap.rHand);
    for (const m of this.clothMeshes) { this.saved.push({ mesh: m, visible: m.visible }); m.visible = false; }
    for (const m of this.skinMeshes) {
      const g = m.geometry;
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const keepV = new Uint8Array(si.count);
      for (let i = 0; i < si.count; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (keep.has(m.skeleton.bones[si.getComponent(i, k)])) w += sw.getComponent(i, k);
        keepV[i] = w >= 0.5 ? 1 : 0;
      }
      const old = g.index;
      const src = old ? old.array : Uint32Array.from({ length: si.count }, (_, i) => i);
      const idx = [];
      for (let t = 0; t < src.length; t += 3) {
        if (keepV[src[t]] && keepV[src[t + 1]] && keepV[src[t + 2]]) idx.push(src[t], src[t + 1], src[t + 2]);
      }
      const groups = g.groups.map((x) => ({ ...x }));
      this.saved.push({ geom: g, index: old, groups });
      g.setIndex(idx);
      g.clearGroups();
      groups.forEach((x) => g.addGroup(0, idx.length, x.materialIndex));
    }
  }

  // Vật liệu cel-shading cho 1 màu
  // Vật liệu được dùng lại giữa các lần dựng (cùng chất liệu + màu) -> không phải biên dịch lại shader
  _material(hex, opts = {}) {
    const key = JSON.stringify([hex, opts.role, opts.doubleSide, opts.darken, opts.mat, Math.round((this.k || 1) * 1000)]);
    this.matCache ||= new Map();
    if (!this.matCache.has(key)) this.matCache.set(key, this._makeMaterial(hex, opts));
    return this.matCache.get(key);
  }

  _makeMaterial(hex, { role = 'cloth', doubleSide = false, darken = 1, mat = 'cotton' } = {}) {
    if (role !== 'skin') return [makeFabric(mat, hex, { doubleSide, k: this.k, darken })];
    const base = role === 'skin' || !hex ? this.skinColor.clone() : new THREE.Color(hex);
    if (darken !== 1) base.multiplyScalar(darken);
    const shade = role === 'skin'
      ? base.clone().multiply(new THREE.Color(0.95, 0.78, 0.78))
      : base.clone().multiplyScalar(0.7).add(new THREE.Color(0.012, 0.006, 0.03));
    let main;
    if (this.tplMain) {
      main = this.tplMain.clone();
      main.map = null;
      main.shadeMultiplyTexture = null;
      main.normalMap = null;
      main.color.copy(base);
      main.shadeColorFactor.copy(shade);
      // Bỏ hiệu ứng riêng của da (matcap, viền sáng, phát sáng) để vải không bị ửng hồng
      if (role !== 'skin') {
        main.matcapTexture = null;
        main.matcapFactor?.set(0, 0, 0);
        main.parametricRimColorFactor?.set(0, 0, 0);
        main.rimMultiplyTexture = null;
        main.emissive?.set(0, 0, 0);
        main.emissiveMap = null;
      }
    } else {
      main = new MToonMaterial({ color: base, shadeColorFactor: shade, shadingToonyFactor: 0.9, shadingShiftFactor: -0.05 });
    }
    if (role === 'metal') { main.shadeColorFactor.copy(base.clone().multiplyScalar(0.55)); }
    main.side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
    let outline = null;
    if (this.tplOutline) {
      outline = this.tplOutline.clone();
      outline.map = null;
      outline.outlineColorFactor.copy(role === 'skin' ? new THREE.Color(0.55, 0.32, 0.3) : base.clone().multiplyScalar(0.3));
      outline.side = THREE.BackSide;
    }
    return outline ? [main, outline] : [main];
  }

  // ---- Xương vật lý cho váy/đầm: 12 cột x 4 đoạn, gắn vào hông, va chạm với 2 chân ----
  _removeSkirt() {
    const sk = this.skirt;
    if (!sk) return;
    const mgr = this.vrm.springBoneManager;
    sk.joints.forEach((j) => mgr?.deleteJoint(j));
    sk.roots.forEach((b) => b.parent?.remove(b));
    sk.colliders.forEach((c) => c.parent?.remove(c));
    this.skirt = null;
  }

  _buildSkirt(B, yEnd) {
    const mgr = this.vrm.springBoneManager;
    if (!mgr) return null;
    const K = 12, M = 4;
    const { U, levels } = B;
    const yStart = levels.yH;
    if (yEnd > yStart - 0.05 * U) return null;
    const root = this.root;
    const s = root.scale.x;
    const minBodyY = Math.max(...B.legs.map((L) => L.yBottom)) + 0.005 * U;
    const cols = [], roots = [], joints = [], colliders = [];
    // Va chạm: ống trụ quanh đùi và cẳng chân
    const group = { colliders: [], name: 'skirt-legs' };
    for (const sd of ['l', 'r']) {
      const L = B.legs[sd === 'l' ? 0 : 1];
      for (const [bn, tn, y] of [[`${sd}UpperLeg`, `${sd}LowerLeg`, levels.yC - 0.02 * U], [`${sd}LowerLeg`, `${sd}Foot`, L.knee.y - 0.1 * U]]) {
        const bone = this.boneMap[bn], tail = this.boneMap[tn];
        const r = L.at(y).w * s * 1.05;
        const tailLocal = bone.worldToLocal(tail.getWorldPosition(new THREE.Vector3()));
        const c = new VRMSpringBoneCollider(new VRMSpringBoneColliderShapeCapsule({ offset: new THREE.Vector3(), tail: tailLocal, radius: r }));
        bone.add(c);
        c.updateMatrixWorld(true);
        colliders.push(c);
        group.colliders.push(c);
      }
    }
    const groups = [group, ...(mgr.colliderGroups || [])];
    const hips = this.boneMap.hips;
    for (let c = 0; c < K; c++) {
      const th = (c / K) * Math.PI * 2;
      const chain = [];
      let parent = hips;
      for (let m = 0; m <= M; m++) {
        const y = lerp(yStart, yEnd, m / M);
        const cz = B.czAt(Math.max(y, levels.yC));
        const hull = B.sectionHull(Math.max(y, minBodyY), true);
        const r = (hull.length ? rayToPolygon(hull, 0, cz, Math.sin(th), Math.cos(th)) : 0.1 * U) + 0.01 * U;
        const world = root.localToWorld(new THREE.Vector3(Math.sin(th) * r, y, cz + Math.cos(th) * r));
        const bone = new THREE.Bone();
        bone.name = `skirt_${c}_${m}`;
        parent.add(bone);
        parent.updateMatrixWorld(true);
        bone.position.copy(parent.worldToLocal(world));
        bone.updateMatrixWorld(true);
        chain.push(bone);
        parent = bone;
      }
      roots.push(chain[0]);
      for (let m = 0; m < M; m++) {
        const j = new VRMSpringBoneJoint(chain[m], chain[m + 1], {
          hitRadius: 0.02 * s, stiffness: 1.6, gravityPower: 0.3, gravityDir: new THREE.Vector3(0, -1, 0), dragForce: 0.35,
        }, groups);
        mgr.addJoint(j);
        joints.push(j);
      }
      cols.push(chain);
    }
    mgr.setInitState();
    return { K, M, yStart, yEnd, cols, roots, joints, colliders };
  }

  _clear() {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.geometry.dispose(); // vật liệu giữ lại trong cache
    }
    this.meshes = [];
  }

  // Đo vòng cổ / cổ tay của phần da VRoid còn giữ -> thân/tay dựng bằng code phủ khít lên
  _measureJoins(P, toLocal) {
    const verts = this.rig._worldVerts(this.skinMeshes);
    const neckPts = [], wristPts = [];
    const yN = P.neck.y + 0.02 * this.U;
    const xW = P.lHand.x - 0.005 * this.U;
    for (const { arr } of verts) {
      for (let i = 0; i < arr.length; i += 3) {
        const v = toLocal(arr[i], arr[i + 1], arr[i + 2]);
        if (Math.abs(v.y - yN) < 0.006 * this.U && Math.abs(v.x) < 0.09 * this.U) neckPts.push([v.x, v.z]);
        if (Math.abs(v.x - xW) < 0.006 * this.U && Math.abs(v.y - P.lHand.y) < 0.06 * this.U) wristPts.push([v.y, v.z]);
      }
    }
    const per = (pts) => (pts.length >= 6 ? perimeter(convexHull(pts)) : 0);
    return { neckC: per(neckPts), wristC: per(wristPts) };
  }

  /**
   * Dựng lại thân + outfit. Gọi ngay sau rig.fit() (đang ở tư thế chữ T).
   * @param m      số đo hiệu lực (cm)
   * @param items  [{ tpl, color }]
   */
  rebuild(m, items) {
    const root = this.root;
    this.vrm.humanoid.resetNormalizedPose();
    this.vrm.humanoid.update();
    root.updateMatrixWorld(true);

    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const tmp = new THREE.Vector3();
    const toLocal = (x, y, z) => tmp.set(x, y, z).applyMatrix4(inv).clone();
    const P = {};
    for (const [k, b] of Object.entries(this.boneMap)) if (b) P[k] = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    if (!this.hasToes.l) P.lToes = null;
    if (!this.hasToes.r) P.rToes = null;
    const k = 1 / root.scale.x;
    this.U = k * (m.heightCm / 160);
    const floorY = toLocal(0, 0, 0).y;
    const joins = this._measureJoins(P, toLocal);

    const B = buildBodyModel(P, m, k, { ...joins, floorY });
    this.k = k;

    // Xương vật lý cho váy (nếu outfit có váy/đầm)
    this._removeSkirt();
    const yHem = needsSkirtRig(B, items);
    if (yHem != null) this.skirt = this._buildSkirt(B, yHem);

    // Khung xương riêng cho lưới dựng bằng code (dùng chung các xương của VRM + xương váy)
    const names = Object.keys(this.boneMap).filter((n) => this.boneMap[n]);
    const bones = [...new Set(names.map((n) => this.boneMap[n]))];
    const BI = {};
    for (const n of names) BI[n] = bones.indexOf(this.boneMap[n]);
    let rigInfo = null;
    if (this.skirt) {
      const sk = this.skirt;
      const idx = sk.cols.map((chain) => chain.map((b) => { bones.push(b); return bones.length - 1; }));
      rigInfo = {
        yStart: sk.yStart,
        // Trọng số cho điểm vải ở góc θ, độ cao y: trộn 2 cột gần nhất, đoạn theo độ cao
        weightsAt: (th, y) => {
          if (y >= sk.yStart) return null;
          const c = ((th / (Math.PI * 2)) * sk.K + sk.K) % sk.K;
          const c0 = Math.floor(c) % sk.K, c1 = (c0 + 1) % sk.K, a = c - Math.floor(c);
          const t = ((sk.yStart - y) / (sk.yStart - sk.yEnd)) * sk.M;
          const mm = Math.min(sk.M - 1, Math.max(0, Math.floor(t)));
          const hw = t < 0.35 ? 1 - t / 0.35 : 0;
          return [[idx[c0][mm], (1 - a) * (1 - hw)], [idx[c1][mm], a * (1 - hw)], [BI.hips, hw]].filter((w) => w[1] > 1e-4);
        },
      };
    }
    const skeleton = new THREE.Skeleton(bones);
    skeleton.calculateInverses();

    const W = makeWeights(B, BI, rigInfo);
    const groups = [{ parts: buildBodySkin(B, W), color: null, role: 'skin' }, ...buildOutfit(B, W, BI, B.P, items)];

    this._clear();
    this.group.updateMatrixWorld(true);
    for (const g of groups) {
      if (!g.parts.length) continue;
      const geom = toGeometry(g.parts);
      const count = geom.index.count;
      const mats = this._material(g.color, g);
      mats.forEach((_, i) => geom.addGroup(0, count, i));
      const mesh = new THREE.SkinnedMesh(geom, mats);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      mesh.updateMatrixWorld(true);
      mesh.bind(skeleton, mesh.matrixWorld);
      this.meshes.push(mesh);
    }
    return { readout: B.readout, levels: B.levels, checks: B.checks };
  }

  dispose() {
    this._clear();
    this._removeSkirt();
    this.matCache?.forEach((ms) => ms.forEach((x) => x.dispose()));
    this.matCache = null;
    this.root.remove(this.group);
    for (const s of this.saved) {
      if (s.mesh) s.mesh.visible = s.visible;
      if (s.geom) {
        s.geom.setIndex(s.index);
        s.geom.clearGroups();
        s.groups.forEach((x) => s.geom.addGroup(x.start, x.count, x.materialIndex));
      }
    }
    this.saved = [];
  }
}
