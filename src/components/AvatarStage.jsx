// =============================================================
// AvatarStage.jsx — Sân khấu 3D dùng chung: tư thế, xoay 360°, chụp ảnh outfit
// =============================================================
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import AvatarView from '../avatar/AvatarView.jsx';
import { POSE_LIST } from '../avatar/idlePose.js';
import { sceneFor } from './scenes.js';

// Môi trường phản chiếu (studio ảo) + nền gradient + độ phơi sáng theo dịp
function SceneSetup({ preset }) {
  const { gl, scene } = useThree();
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tex;
  }, [gl]);
  useEffect(() => {
    scene.environment = env;
    scene.environmentIntensity = preset.env;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = preset.exposure;
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    preset.bg.forEach((col, i) => grad.addColorStop(i / (preset.bg.length - 1), col));
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(c);
    bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;
    return () => { bg.dispose(); };
  }, [scene, gl, env, preset]);
  return null;
}

// Điện thoại màn nhỏ: bóng 1024px cho nhẹ máy
const SMALL_SCREEN = typeof window !== 'undefined' && window.innerWidth < 700;
const SHADOW_SIZE = SMALL_SCREEN ? [1024, 1024] : [2048, 2048];

// Đèn: chính (đổ bóng mềm), phụ, viền, bầu trời/mặt đất
function Lights({ preset }) {
  const { key, fill, rim, hemi } = preset;
  return (
    <>
      <directionalLight position={key.p} intensity={key.i} color={key.c} castShadow
        shadow-mapSize={SHADOW_SIZE} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={6}
        shadow-camera-left={-1.2} shadow-camera-right={1.2} shadow-camera-top={2.2} shadow-camera-bottom={-0.3}
        shadow-camera-near={0.5} shadow-camera-far={10} />
      <directionalLight position={fill.p} intensity={fill.i} color={fill.c} />
      <directionalLight position={rim.p} intensity={rim.i} color={rim.c} />
      <hemisphereLight args={[hemi.sky, hemi.ground, hemi.i]} />
    </>
  );
}

// Bệ tròn 2 tầng + bóng mềm dưới chân
function Stage() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.006}>
        <circleGeometry args={[0.95, 72]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.005}>
        <ringGeometry args={[0.97, 1.01, 72]} />
        <meshBasicMaterial color="#f7a8c8" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.004}>
        <ringGeometry args={[0.62, 0.635, 72]} />
        <meshBasicMaterial color="#c9b6ec" transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.003} receiveShadow>
        <circleGeometry args={[2.4, 72]} />
        <shadowMaterial transparent opacity={0.25} color="#3a2148" />
      </mesh>
    </group>
  );
}

// Tự lùi/tiến camera để luôn thấy trọn người, kể cả màn hình dọc hẹp
function AutoFrame({ controls }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const bodyH = 1.95, bodyW = 0.9;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height));
    const dist = Math.max(bodyH / 2 / Math.tan(vFov / 2), bodyW / 2 / Math.tan(hFov / 2)) * 1.05;
    camera.position.set(0, 0.95, dist);
    controls.current?.target.set(0, 0.88, 0);
    controls.current?.update();
  }, [camera, size.width, size.height, controls]);
  return null;
}

// Cho phép chụp ảnh khung hình hiện tại
function Capturer({ onReady }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onReady(() => { gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); });
  }, [gl, scene, camera, onReady]);
  return null;
}

// Ghép ảnh avatar + nền + chú thích -> PNG để lưu/chia sẻ
async function composePhoto(dataUrl, caption) {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fdeef6'); bg.addColorStop(0.6, '#ebe4ff'); bg.addColorStop(1, '#d9ecff');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const boxH = caption ? 330 : 120;
  // Ảnh render đã có nền: phủ kín khung (cắt bớt 2 bên nếu cần)
  const scale = (H - boxH + 50) / img.height; // vừa chiều cao: thấy trọn người tới giày
  const w = img.width * scale, h = img.height * scale;
  g.drawImage(img, (W - w) / 2, 0, w, h);
  if (caption) {
    g.fillStyle = 'rgba(255,255,255,.88)';
    const y0 = H - boxH + 10;
    g.beginPath(); g.roundRect(40, y0, W - 80, boxH - 60, 36); g.fill();
    g.fillStyle = '#3d2b4f';
    g.font = '800 46px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillText(caption.title, 80, y0 + 74);
    g.font = '400 30px "Be Vietnam Pro", system-ui, sans-serif';
    g.fillStyle = '#6f5e80';
    (caption.lines || []).slice(0, 4).forEach((t, i) => g.fillText(t, 80, y0 + 124 + i * 40));
  }
  g.fillStyle = '#b39bc6';
  g.font = '600 26px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText('Chọn đồ theo dịp', W - 300, H - 28);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export default function AvatarStage({ url, measurements, outfit, onMeasured, onPickModel, caption, children, compact, scene = 'studio' }) {
  const preset = sceneFor(scene);
  const [hd, setHd] = useState(false);
  const controls = useRef(null);
  const capture = useRef(null);
  const [status, setStatus] = useState({ state: 'loading', progress: 0 });
  const [pose, setPose] = useState('dung');
  const [spin, setSpin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const closePhoto = () => { if (photo) URL.revokeObjectURL(photo.url); setPhoto(null); };
  const sharePhoto = async () => {
    const file = new File([photo.blob], 'outfit.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: caption?.title || 'Outfit của tôi' }); return; }
    } catch { /* bị chặn hoặc người dùng huỷ */ }
    const a = document.createElement('a');
    a.href = photo.url; a.download = `outfit-${Date.now()}.png`; a.click();
  };

  const takePhoto = async () => {
    if (!capture.current) return;
    setBusy(true);
    const wasHd = hd;
    try {
      // Chụp ở chế độ HD: bật hiệu ứng, chờ vài khung hình cho ổn định rồi lấy ảnh
      if (!wasHd) { setHd(true); await new Promise((r) => setTimeout(r, 900)); }
      const blob = await composePhoto(capture.current(), caption);
      if (!wasHd) setHd(false);
      // Luôn hiện ảnh xem trước: nơi chặn tải file/chia sẻ thì vẫn nhấn giữ ảnh để lưu được
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stage">
      <Canvas shadows="soft" dpr={hd ? [1.5, 2.5] : SMALL_SCREEN ? [1, 1.5] : [1, 2]} camera={{ position: [0, 1.05, 3.6], fov: 30 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        <SceneSetup preset={preset} />
        <Lights preset={preset} />
        <Suspense fallback={null}>
          <AvatarView url={url} measurements={measurements} outfit={outfit} pose={pose}
            onStatus={setStatus} onMeasured={onMeasured} />
        </Suspense>
        <Stage />
        <AutoFrame controls={controls} />
        <Capturer onReady={(fn) => { capture.current = fn; }} />
        <OrbitControls ref={controls} target={[0, 0.88, 0]} enablePan={false} minDistance={1.2} maxDistance={6}
          minPolarAngle={0.3} maxPolarAngle={Math.PI / 2 - 0.02} autoRotate={spin} autoRotateSpeed={2.2} />
        {/* Chế độ HD: bóng khuất (AO), lấp lánh (bloom), khử răng cưa, tối 4 góc */}
        {hd && (
          <EffectComposer multisampling={0}>
            <N8AO aoRadius={0.18} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes />
            <Bloom intensity={0.35} luminanceThreshold={0.86} luminanceSmoothing={0.2} mipmapBlur />
            <SMAA />
            <Vignette offset={0.32} darkness={0.38} />
          </EffectComposer>
        )}
      </Canvas>
      {status.state === 'loading' && (
        <div className="overlay">Đang tải nhân vật… {Math.round((status.progress || 0) * 100)}%</div>
      )}
      {status.state === 'missing' && (
        <div className="overlay card">
          <b>Chưa có nhân vật</b>
          <p>Tạo nhân vật trong <b>VRoid Studio</b>, export <code>.vrm</code>, rồi chọn file.</p>
          {onPickModel && <button className="primary" onClick={onPickModel}>Chọn file .vrm</button>}
        </div>
      )}
      {status.state === 'error' && <div className="overlay card">{status.message}</div>}
      {status.state === 'ready' && (
        <div className={`stage-tools ${compact ? 'compact' : ''}`}>
          <div className="pose-chips">
            {POSE_LIST.map(([id, label]) => (
              <button key={id} className={pose === id ? 'on' : ''} onClick={() => setPose(id)}>{label}</button>
            ))}
          </div>
          <div className="tool-btns">
            <button className={hd ? 'on' : ''} onClick={() => setHd((v) => !v)} title="Chất lượng cao (HD)">HD</button>
            <button className={spin ? 'on' : ''} onClick={() => setSpin((v) => !v)} title="Xoay 360°">⟳</button>
            <button onClick={takePhoto} disabled={busy} title="Chụp ảnh outfit">{busy ? '…' : '📸'}</button>
          </div>
        </div>
      )}
      {children}
      {photo && (
        <div className="modal" onClick={closePhoto}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><b>Ảnh outfit</b><button className="icon" onClick={closePhoto} aria-label="Đóng">✕</button></div>
            <div className="modal-body photo-preview">
              <img src={photo.url} alt="Ảnh outfit" />
              <small className="muted">Nhấn giữ ảnh để lưu vào máy, hoặc bấm nút bên dưới.</small>
            </div>
            <div className="modal-foot actions">
              <button onClick={closePhoto}>Đóng</button>
              <button className="primary" onClick={sharePhoto}>Chia sẻ / Tải về</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
