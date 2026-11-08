// =============================================================
// AvatarPage.jsx — Avatar + bảng số đo (tự lưu)
// BR14: số vô lý bị chặn (không lưu, báo đỏ), số hiếm báo vàng, avatar hiển thị bản đã cân chỉnh.
// =============================================================
import { memo, useMemo, useRef, useState } from 'react';
import AvatarStage from '../components/AvatarStage.jsx';
import {
  ALL, BASIC, DEFAULT_VALUES, DETAIL, classifyShape, effectiveValues, typicalRange, validateMeasurements,
} from '../avatar/measurements.js';
import { useStore } from '../store/AppStore.jsx';
import { focusIntoView } from '../lib/keyboard.js';

// Ô cơ bản đang bỏ trống (gõ dở) -> tạm dùng mặc định; số ngoài giới hạn tuyệt đối -> kẹp lại
function toSafe(v) {
  const out = { ...v };
  for (const d of ALL) {
    if (out[d.key] == null || !Number.isFinite(out[d.key])) {
      out[d.key] = BASIC.includes(d) ? DEFAULT_VALUES[d.key] : null;
      continue;
    }
    out[d.key] = Math.min(d.max, Math.max(d.min, out[d.key]));
  }
  return out;
}

// 1 dòng số đo: nhãn | thanh trượt (khoảng thường gặp) | ô nhập (khoảng tuyệt đối) | số đo lại trên avatar
const MeasureRow = memo(({ def, value, shown, range, actual, onChange, isDetail, msg }) => {
  const auto = isDetail && value == null;
  const off = actual != null && Math.abs(actual - shown) > 1.5;
  const [lo, hi] = range;
  return (
    <div className={`row-wrap ${msg ? msg.type : ''}`}>
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
        <input type="range" min={lo} max={hi} step={0.5} value={Math.min(hi, Math.max(lo, shown))}
          onChange={(e) => onChange(Number(e.target.value))} aria-label={def.label} />
        <span className="num-wrap">
          <input className={`num ${auto ? 'auto' : ''}`} type="number" inputMode="decimal" enterKeyHint="done"
            min={def.min} max={def.max} step={0.5} value={value ?? ''} placeholder={String(shown)}
            onFocus={focusIntoView}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
          <i>{def.unit}</i>
        </span>
        <span className={`actual ${off ? 'off' : ''}`} title="Số đo đo lại trên avatar">
          {def.fit === false ? '' : actual != null ? actual.toFixed(1) : '–'}
        </span>
      </div>
      {msg && <p className={`row-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
});

export default function AvatarPage() {
  const { state, run, avatarUrl, setAvatarFile } = useStore();
  const { profile } = state;
  const saved = profile.measurements;
  // Bản nháp: số đang nhập bị chặn (BR14) thì giữ ở đây, KHÔNG lưu, avatar giữ bộ số hợp lệ gần nhất
  const [draft, setDraft] = useState(null);
  const m = draft || saved;
  const shownSaved = useMemo(() => effectiveValues(toSafe(saved)), [saved]);
  const shown = useMemo(() => effectiveValues(toSafe(m)), [m]);
  const shape = useMemo(() => classifyShape(shownSaved), [shownSaved]);
  const check = useMemo(() => validateMeasurements(toSafe(m)), [m]);
  const [measured, setMeasured] = useState(null);
  const [info, setInfo] = useState({ notes: [], checks: [] });
  const [fitMs, setFitMs] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const vrmInput = useRef(null);
  // Công cụ kiểm tra mẫu 3D: ?thu=ao_thun:%23ffffff:cotton&canh=di_lam (không hiện trong giao diện)
  const thu = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('thu');
    return q ? q.split(',').map((x) => { const [tpl, color, mat] = x.split(':'); return { tpl, color, mat }; }) : null;
  }, []);
  const canh = useMemo(() => new URLSearchParams(window.location.search).get('canh') || 'studio', []);

  const setProfile = (patch) => run((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const setValue = (key, v) => {
    const next = { ...m, [key]: v };
    const r = validateMeasurements(toSafe(next));
    // Ô cơ bản đang gõ dở (trống) cũng giữ ở nháp
    const typing = BASIC.some((d) => next[d.key] == null);
    if (!r.ok || typing) { setDraft(next); return; }
    setDraft(null);
    setProfile({ measurements: next });
  };

  // Thông báo theo từng dòng: đỏ (chặn) ưu tiên hơn vàng (cảnh báo)
  const msgOf = useMemo(() => {
    const map = {};
    for (const w of check.warn) map[w.key] = { type: 'warn', text: `⚠️ ${w.msg}` };
    for (const b of check.block) map[b.key] = { type: 'block', text: `⛔ ${b.msg} Chưa lưu số này.` };
    return map;
  }, [check]);

  const row = (def, isDetail) => (
    <MeasureRow key={def.key} def={def} value={m[def.key]} shown={shown[def.key]} isDetail={isDetail}
      range={typicalRange(def, shown)} actual={measured?.[def.key]} msg={msgOf[def.key]}
      onChange={(v) => setValue(def.key, v)} />
  );

  return (
    <div className="page page-avatar">
      <AvatarStage url={avatarUrl} measurements={shownSaved} outfit={thu} scene={canh} onPickModel={() => vrmInput.current?.click()}
        caption={{ title: profile.name, lines: [`Dáng ${shape.name}`, `${shownSaved.heightCm} cm · ngực ${shownSaved.bustCm} · eo ${shownSaved.waistCm} · hông ${shownSaved.hipCm}`] }}
        onMeasured={(r, ms, inf) => { setMeasured(r); setFitMs(ms); if (inf) setInfo(inf); }}>
        <header className="topbar">
          <span className="brand">Chọn đồ theo dịp</span>
          <button className="ghost" onClick={() => vrmInput.current?.click()}>Đổi nhân vật</button>
        </header>
      </AvatarStage>

      <aside className={`sheet ${sheetOpen ? 'open' : ''}`}>
        <button className="handle" onClick={() => setSheetOpen((v) => !v)} aria-label="Mở/đóng bảng số đo"><span /></button>
        <div className="sheet-head">
          <input className="profile-name" value={profile.name} onFocus={focusIntoView}
            onChange={(e) => setProfile({ name: e.target.value })} />
          <small>
            {draft ? 'Đang sửa: số chưa hợp lệ chưa được lưu' : measured ? `Avatar khớp số đo (${fitMs} ms) · tự lưu` : 'Số đo cơ thể · tự lưu'}
          </small>
        </div>
        <div className="rows">
          <div className="shape">
            <span>Dáng người: <b>{shape.name}</b></span>
            <small>{shape.tip}</small>
          </div>
          {info.notes.length > 0 && (
            <details className="adjust">
              <summary>ⓘ Avatar đang hiển thị đã cân chỉnh ({info.notes.length})</summary>
              <ul>{info.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              <small>Số thật của bạn vẫn được lưu nguyên, chỉ hình avatar được giữ cân đối.</small>
            </details>
          )}
          <div className="group-title">Cơ bản</div>
          {BASIC.map((def) => row(def, false))}
          <details className="detail" open={DETAIL.some((d) => msgOf[d.key]) || undefined}>
            <summary>
              Chi tiết thêm <small>· {DETAIL.filter((d) => m[d.key] != null).length}/{DETAIL.length} đã nhập, còn lại tự ước tính</small>
            </summary>
            {DETAIL.map((def) => row(def, true))}
          </details>
          <p className="hint">
            Thanh trượt chạy trong khoảng thường gặp theo chiều cao; ô số cho nhập rộng hơn (có cảnh báo).
            Cột phải: số đo đo lại trên avatar.
          </p>
          <div className="actions">
            {draft && <button onClick={() => setDraft(null)}>Huỷ số đang sửa</button>}
            <button onClick={() => { setDraft(null); setProfile({ measurements: DEFAULT_VALUES }); }}>Về số đo mặc định</button>
          </div>
        </div>
      </aside>
      <input ref={vrmInput} type="file" accept=".vrm" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvatarFile(f); e.target.value = ''; }} />
    </div>
  );
}
