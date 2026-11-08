// =============================================================
// AvatarPage.jsx — Avatar + bảng số đo (tự lưu)
// =============================================================
import { useMemo, useRef, useState } from 'react';
import AvatarStage from '../components/AvatarStage.jsx';
import { ALL, BASIC, DEFAULT_VALUES, DETAIL, classifyShape, effectiveValues } from '../avatar/measurements.js';
import { useStore } from '../store/AppStore.jsx';

// Ô cơ bản đang bỏ trống (gõ dở) -> tạm dùng mặc định; số ngoài khoảng -> kẹp lại
function toSafe(v) {
  const out = { ...v };
  for (const d of ALL) {
    if (out[d.key] == null) {
      if (BASIC.includes(d)) out[d.key] = DEFAULT_VALUES[d.key];
      continue;
    }
    out[d.key] = Math.min(d.max, Math.max(d.min, out[d.key]));
  }
  return out;
}

// 1 dòng số đo: nhãn | thanh trượt | ô nhập | số đo lại trên avatar
function MeasureRow({ def, value, shown, actual, onChange, isDetail }) {
  const auto = isDetail && value == null;
  const off = actual != null && Math.abs(actual - shown) > 1.5;
  return (
    <div className="row">
      <span className="row-label">
        {def.label}
        <small>
          {def.hint && <>{def.hint} · </>}
          {auto ? <em>tự động</em> : isDetail && (
            <button className="link" onClick={() => onChange(null)} title="Về tự động">↺ tự động</button>
          )}
        </small>
      </span>
      <input type="range" min={def.min} max={def.max} step={0.5} value={shown}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={def.label} />
      <span className="num-wrap">
        <input className={`num ${auto ? 'auto' : ''}`} type="number" inputMode="decimal" min={def.min} max={def.max}
          step={0.5} value={value ?? ''} placeholder={String(shown)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        <i>{def.unit}</i>
      </span>
      <span className={`actual ${off ? 'off' : ''}`} title="Số đo đo lại trên avatar">
        {def.fit === false ? '' : actual != null ? actual.toFixed(1) : '–'}
      </span>
    </div>
  );
}

export default function AvatarPage() {
  const { state, run, avatarUrl, setAvatarFile } = useStore();
  const { profile } = state;
  const m = profile.measurements;
  const shown = useMemo(() => effectiveValues(toSafe(m)), [m]);
  const shape = useMemo(() => classifyShape(shown), [shown]);
  const [measured, setMeasured] = useState(null);
  const [fitMs, setFitMs] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const vrmInput = useRef(null);
  // Công cụ kiểm tra mẫu 3D: ?thu=ao_thun:%23ffffff,vay_chu_a:%23223355 (không hiện trong giao diện)
  const thu = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('thu');
    return q ? q.split(',').map((x) => { const [tpl, color, mat] = x.split(':'); return { tpl, color, mat }; }) : null;
  }, []);
  const canh = useMemo(() => new URLSearchParams(window.location.search).get('canh') || 'studio', []);

  const setProfile = (patch) => run((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const setValue = (key, v) => setProfile({ measurements: { ...m, [key]: v } });

  return (
    <div className="page page-avatar">
      <AvatarStage url={avatarUrl} measurements={shown} outfit={thu} scene={canh} onPickModel={() => vrmInput.current?.click()}
        caption={{ title: profile.name, lines: [`Dáng ${shape.name}`, `${shown.heightCm} cm · ngực ${shown.bustCm} · eo ${shown.waistCm} · hông ${shown.hipCm}`] }}
        onMeasured={(r, ms) => { setMeasured(r); setFitMs(ms); }}>
        <header className="topbar">
          <span className="brand">Chọn đồ theo dịp</span>
          <button className="ghost" onClick={() => vrmInput.current?.click()}>Đổi nhân vật</button>
        </header>
      </AvatarStage>

      <aside className={`sheet ${sheetOpen ? 'open' : ''}`}>
        <button className="handle" onClick={() => setSheetOpen((v) => !v)} aria-label="Mở/đóng bảng số đo"><span /></button>
        <div className="sheet-head">
          <input className="profile-name" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
          <small>{measured ? `Avatar khớp số đo (${fitMs} ms) · tự lưu` : 'Số đo cơ thể · tự lưu'}</small>
        </div>
        <div className="shape">
          <span>Dáng người: <b>{shape.name}</b></span>
          <small>{shape.tip}</small>
        </div>
        <div className="rows">
          <div className="group-title">Cơ bản</div>
          {BASIC.map((def) => (
            <MeasureRow key={def.key} def={def} value={m[def.key]} shown={shown[def.key]}
              actual={measured?.[def.key]} onChange={(v) => setValue(def.key, v)} />
          ))}
          <details className="detail">
            <summary>
              Chi tiết thêm <small>· {DETAIL.filter((d) => m[d.key] != null).length}/{DETAIL.length} đã nhập, còn lại tự ước tính</small>
            </summary>
            {DETAIL.map((def) => (
              <MeasureRow key={def.key} def={def} value={m[def.key]} shown={shown[def.key]} isDetail
                actual={measured?.[def.key]} onChange={(v) => setValue(def.key, v)} />
            ))}
          </details>
          <p className="hint">
            Cột phải: số đo đo lại trên avatar. Các vòng dựng đúng theo số bạn nhập; chiều cao, vai,
            dài tay, dài chân co giãn theo khung xương nhân vật. Màu cam: đã chạm giới hạn an toàn.
          </p>
          <div className="actions">
            <button onClick={() => setProfile({ measurements: DEFAULT_VALUES })}>Về số đo mặc định</button>
          </div>
        </div>
      </aside>
      <input ref={vrmInput} type="file" accept=".vrm" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvatarFile(f); e.target.value = ''; }} />
    </div>
  );
}
