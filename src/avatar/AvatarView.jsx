// =============================================================
// AvatarView.jsx — Load file .vrm (VRoid), gắn BodyRig, mặc màu outfit
// Model được cache theo URL: chuyển tab không phải load lại 10MB.
// =============================================================
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { BodyRig } from './bodyRig.js';
import { createIdle } from './idlePose.js';
import { ProcAvatar } from './proc/ProcAvatar.js';
import { BASE_OUTFIT } from './proc/garments.js';
import { minShoulderCm } from './proc/body.js';
import { toDisplay } from './measurements.js';

// Cache 1 model đang dùng
let cache = null; // { url, promise, vrm, rig, proc }

function loadVrm(url, onProgress) {
  if (cache?.url === url) return cache.promise;
  if (cache?.vrm) { cache.proc?.dispose(); cache.rig?.dispose(); VRMUtils.deepDispose(cache.vrm.scene); }
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const entry = { url };
  entry.promise = new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const v = gltf.userData.vrm;
      if (!v) { reject(new Error('File không phải VRM.')); return; }
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(v); // model VRM 0.x quay mặt ngược -> xoay lại
      v.scene.traverse((o) => { o.frustumCulled = false; });
      entry.vrm = v;
      entry.rig = new BodyRig(v);
      entry.proc = new ProcAvatar(v, entry.rig); // thân + đồ dựng bằng code
      resolve(entry);
    }, onProgress, () => reject(new Error('missing')));
  });
  entry.promise.catch(() => { if (cache === entry) cache = null; });
  cache = entry;
  return entry.promise;
}

export default function AvatarView({ url, measurements, outfit, pose, onMeasured, onStatus, onReady }) {
  const [entry, setEntry] = useState(null);
  const idle = useRef(createIdle());
  useEffect(() => { idle.current.setPose?.(pose || 'dung'); }, [pose]);

  // 1) Load model (hoặc lấy từ cache)
  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    if (!(cache?.url === url && cache.vrm)) onStatus?.({ state: 'loading', progress: 0 });
    loadVrm(url, (e) => e.total && alive && onStatus?.({ state: 'loading', progress: e.loaded / e.total }))
      .then((en) => {
        if (!alive) return;
        setEntry(en);
        onStatus?.({ state: 'ready', name: en.vrm.meta?.name || 'Avatar' });
      })
      .catch((err) => alive && onStatus?.(err.message === 'missing' ? { state: 'missing' } : { state: 'error', message: err.message }));
    return () => { alive = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Số đo hoặc outfit đổi -> chờ 120ms (đang kéo slider) rồi dựng lại thân + đồ
  const key = JSON.stringify([measurements, outfit || null]);
  useEffect(() => {
    if (!entry) return undefined;
    const id = setTimeout(() => {
      const t0 = performance.now();
      // BR14/P3: dựng theo số đo HIỂN THỊ (đã kẹp mềm + sửa cặp số xung đột), số thật giữ nguyên
      const { values: disp, notes } = toDisplay(measurements, minShoulderCm);
      // Chỉ chạy lại phần khớp xương khi số đo ĐỘ DÀI đổi (vòng/outfit đổi thì chỉ dựng lại lưới) -> đỡ giật
      const lenKey = ['heightCm', 'shoulderCm', 'legCm', 'armCm'].map((k2) => Math.round(disp[k2] * 10)).join('|');
      if (entry.lenKey !== lenKey || !entry.measured) {
        entry.measured = entry.rig.fit(disp, { lengthsOnly: true }).measured;
        entry.lenKey = lenKey;
      }
      const measured = entry.measured;
      const { readout, checks } = entry.proc.rebuild(disp, outfit?.length ? outfit : BASE_OUTFIT);
      const all = { ...measured };
      for (const [k2, v] of Object.entries(readout)) all[k2] = Math.round(v * 10) / 10;
      onMeasured?.(all, Math.round(performance.now() - t0), { notes, checks });
      onReady?.();
    }, 200); // đợi người dùng ngừng kéo thanh trượt rồi mới dựng
    return () => clearTimeout(id);
  }, [entry, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4) Mỗi frame: tư thế đứng + thở + chớp mắt + vật lý tóc/váy
  useFrame((state, dt) => {
    if (!entry) return;
    const d = Math.min(dt, 1 / 30);
    idle.current(entry.vrm, state.clock.elapsedTime, d);
    entry.vrm.update(d);
  });

  return entry ? <primitive object={entry.vrm.scene} /> : null;
}
