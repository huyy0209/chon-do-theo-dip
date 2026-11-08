// =============================================================
// DipPage.jsx — Danh sách dịp + chi tiết dịp: gợi ý top 3, tự phối, chốt outfit
// =============================================================
import { useMemo, useState } from 'react';
import AvatarStage from '../components/AvatarStage.jsx';
import { Empty, OutfitItems, ScoreBar, Sheet } from '../components/ui.jsx';
import { effectiveValues } from '../avatar/measurements.js';
import { formatVN } from '../domain/dates.js';
import { recommend } from '../domain/recommend.js';
import {
  VI_TRI, boChot, chotOutfit, luuOutfit, suaDip, themDip, trangThaiDip, xoaDip,
} from '../domain/rules.js';
import { kieuOf, outfitCaption, outfitItems, shapeOf } from '../lib/view.js';
import { useStore } from '../store/AppStore.jsx';

const go = (hash) => { window.location.hash = hash; };

// Tìm outfit (chưa mặc) có đúng các món này -> tránh lưu trùng
function findSame(state, ids) {
  const key = [...ids].sort().join('|');
  return state.outfit.find((o) => o.trangThai !== 'DA_MAC' && o.mon.map((x) => x.monId).sort().join('|') === key);
}

function DipForm({ dip, onClose }) {
  const { state, run, today } = useStore();
  const [loaiDipId, setLoai] = useState(dip?.loaiDipId || '');
  const [ten, setTen] = useState(dip?.ten || '');
  const [ngay, setNgay] = useState(dip?.ngay || today);
  const [noi, setNoi] = useState(dip?.noi || '');
  const [ghiChu, setGhiChu] = useState(dip?.ghiChu || '');
  const daQua = dip && trangThaiDip(dip, today) === 'DA_QUA';

  const save = () => {
    const input = { loaiDipId, ten, ngay, noi, ghiChu };
    const res = dip
      ? run((s) => suaDip(s, dip.id, input, today), 'Đã cập nhật dịp')
      : run((s) => themDip(s, input, today), 'Đã thêm dịp');
    if (!res) return;
    onClose();
    if (!dip) go(`#/dip/${res.state.dip[res.state.dip.length - 1].id}`);
  };

  return (
    <Sheet title={dip ? 'Sửa dịp' : 'Dịp mới'} onClose={onClose}
      footer={<button className="primary wide" onClick={save}>{dip ? 'Lưu' : 'Tạo dịp & xem gợi ý'}</button>}>
      {daQua && <p className="note">Dịp đã qua: chỉ sửa được ghi chú.</p>}
      <label className="field-label">Loại dịp *</label>
      <div className="chips">
        {state.config.loaiDip.map((l) => (
          <button key={l.id} disabled={daQua} className={`chip ${loaiDipId === l.id ? 'on' : ''}`} onClick={() => setLoai(l.id)}>
            {l.icon} {l.ten}
          </button>
        ))}
      </div>
      <label className="field-label">Tên <small>(để trống = theo loại dịp)</small></label>
      <input className="text" disabled={daQua} value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Ví dụ: Đám cưới bạn Linh" />
      <label className="field-label">Ngày *</label>
      <input className="text" disabled={daQua} type="date" min={today} value={ngay} onChange={(e) => setNgay(e.target.value)} />
      <label className="field-label">Địa điểm</label>
      <input className="text" disabled={daQua} value={noi} onChange={(e) => setNoi(e.target.value)} placeholder="Ví dụ: Đà Lạt" />
      <label className="field-label">Ghi chú</label>
      <textarea className="text" rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
    </Sheet>
  );
}

// Tự phối: chọn từng vị trí từ món Đang dùng
function Composer({ dip, onClose, onPreview }) {
  const { state, run, today } = useStore();
  const [mode, setMode] = useState('ROI'); // ROI: áo + dưới | DAM
  const [pick, setPick] = useState({});
  const dangDung = state.mon.filter((m) => m.trangThai === 'DANG_DUNG');
  const viTriOf = (m) => VI_TRI[kieuOf(state, m)?.loai];
  const slots = mode === 'ROI'
    ? [['AO', 'Áo *'], ['DUOI', 'Quần/chân váy *']]
    : [['DAM', 'Đầm *']];
  const all = [...slots, ['GIAY', 'Giày *'], ['AO_KHOAC', 'Áo khoác'], ['TUI', 'Túi'], ['PHU_KIEN', 'Phụ kiện 1'], ['PHU_KIEN#2', 'Phụ kiện 2']];
  const ids = all.map(([k]) => pick[k]).filter(Boolean);

  const preview = () => onPreview({ mon: ids.map((id) => ({ monId: id, viTri: viTriOf(state.mon.find((m) => m.id === id)) })) });
  const save = (chot) => {
    const res = run((s) => {
      const same = findSame(s, ids);
      const r = same ? { state: s, outfit: same } : luuOutfit(s, ids, 'TU_PHOI');
      return chot ? { state: chotOutfit(r.state, r.outfit.id, dip.id, today) } : r;
    }, chot ? 'Đã chốt outfit cho dịp' : 'Đã lưu outfit');
    if (res) onClose();
  };

  return (
    <Sheet title="Tự phối outfit" onClose={onClose}
      footer={(
        <div className="actions">
          <button onClick={preview}>Thử trên avatar</button>
          <button onClick={() => save(false)}>Lưu</button>
          <button className="primary" onClick={() => save(true)}>Chốt cho dịp</button>
        </div>
      )}>
      <div className="seg">
        <button className={mode === 'ROI' ? 'on' : ''} onClick={() => { setMode('ROI'); setPick((p) => ({ ...p, DAM: '' })); }}>Áo + quần/váy</button>
        <button className={mode === 'DAM' ? 'on' : ''} onClick={() => { setMode('DAM'); setPick((p) => ({ ...p, AO: '', DUOI: '' })); }}>Đầm liền</button>
      </div>
      {all.map(([k, label]) => {
        const vt = k.split('#')[0];
        const opts = dangDung.filter((m) => viTriOf(m) === vt);
        return (
          <label key={k} className="slot">
            <span>{label}</span>
            <select value={pick[k] || ''} onChange={(e) => setPick((p) => ({ ...p, [k]: e.target.value }))}>
              <option value="">— {opts.length ? 'chọn' : 'chưa có món'} —</option>
              {opts.map((m) => <option key={m.id} value={m.id}>{m.ten} (TT {m.trangTrong})</option>)}
            </select>
          </label>
        );
      })}
    </Sheet>
  );
}

function DipDetail({ id }) {
  const { state, run, today, avatarUrl } = useStore();
  const dip = state.dip.find((d) => d.id === id);
  const [edit, setEdit] = useState(false);
  const [compose, setCompose] = useState(false);
  const [preview, setPreview] = useState(null);

  const shape = shapeOf(state.profile);
  const measurements = useMemo(() => effectiveValues(state.profile.measurements), [state.profile.measurements]);
  const status = dip ? trangThaiDip(dip, today) : null;
  const goiY = useMemo(
    () => (dip && status === 'SAP_TOI' ? recommend(state, { dip, dang: shape.id, today }) : null),
    [state, dip, status, shape.id, today],
  );
  if (!dip) return <Empty icon="🔍" title="Không tìm thấy dịp"><a href="#/dip">Về danh sách</a></Empty>;

  const loai = state.config.loaiDip.find((l) => l.id === dip.loaiDipId);
  const chot = state.outfit.find((o) => o.dipId === dip.id && ['DA_CHOT', 'DA_MAC'].includes(o.trangThai));
  const daLuu = state.outfit.filter((o) => o.trangThai === 'DA_LUU');
  const shown = preview || chot || goiY?.outfits[0] || null;

  const saveGoiY = (o, chotLuon) => run((s) => {
    const ids = o.mon.map((x) => x.monId);
    const same = findSame(s, ids);
    const r = same ? { state: s, outfit: same } : luuOutfit(s, ids, 'GOI_Y');
    return chotLuon ? { state: chotOutfit(r.state, r.outfit.id, dip.id, today) } : r;
  }, chotLuon ? 'Đã chốt outfit cho dịp' : 'Đã lưu outfit');

  const remove = () => {
    if (window.confirm('Xoá dịp này?') && run((s) => xoaDip(s, dip.id), 'Đã xoá dịp')) go('#/dip');
  };

  return (
    <div className="page page-scroll">
      <div className="mini-stage">
        <AvatarStage url={avatarUrl} measurements={measurements} outfit={outfitItems(state, shown)} compact scene={dip.loaiDipId}
          caption={outfitCaption(state, shown, `${dip.ten} · ${formatVN(dip.ngay)}`)}>
          <header className="topbar">
            <button className="ghost" onClick={() => go('#/dip')}>‹ Dịp</button>
            <span className="badge">{shape.name}</span>
          </header>
        </AvatarStage>
      </div>

      <section className="dip-head">
        <div className="dip-icon">{loai?.icon}</div>
        <div>
          <h2>{dip.ten}</h2>
          <small>{formatVN(dip.ngay)}{dip.noi ? ` · ${dip.noi}` : ''} · {loai?.ten} (TT {loai?.min}–{loai?.max})</small>
          {dip.ghiChu && <p className="muted">{dip.ghiChu}</p>}
        </div>
        <span className={`pill ${status === 'DA_QUA' ? 'grey' : ''}`}>{status === 'DA_QUA' ? 'Đã qua' : 'Sắp tới'}</span>
      </section>
      <div className="actions pad">
        <button onClick={() => setEdit(true)}>Sửa</button>
        <button className="danger" onClick={remove}>Xoá</button>
      </div>

      {chot && (
        <section className="card chot">
          <div className="card-title">
            <b>{chot.trangThai === 'DA_MAC' ? '✅ Đã mặc' : '📌 Outfit đã chốt'}</b>
            {chot.trangThai === 'DA_CHOT' && (
              <button className="link" onClick={() => run((s) => boChot(s, chot.id, today), 'Đã bỏ chốt')}>Bỏ chốt</button>
            )}
          </div>
          <OutfitItems state={state} items={chot.mon} />
          <button className="link" onClick={() => setPreview(chot)}>Xem trên avatar</button>
        </section>
      )}

      {status === 'SAP_TOI' && (
        <>
          <div className="section-title">
            <b>Gợi ý cho bạn</b>
            <button onClick={() => setCompose(true)}>✋ Tự phối</button>
          </div>
          {goiY?.thieu.length > 0 && (
            <div className="card warn">
              {goiY.thieu.map((t) => <p key={t}>⚠️ {t}</p>)}
              <a href="#/tu-do">Thêm đồ vào tủ ›</a>
            </div>
          )}
          {goiY?.outfits.map((o, i) => (
            <section key={o.mon.map((x) => x.monId).join()} className={`card ${shown === o ? 'selected' : ''}`}>
              <div className="card-title"><b>Gợi ý #{i + 1}</b></div>
              <ScoreBar diem={o.diem} chiTiet={o.chiTiet} trongSo={state.config.trongSo} />
              <OutfitItems state={state} items={o.mon} />
              <div className="actions">
                <button onClick={() => setPreview(o)}>Thử trên avatar</button>
                <button onClick={() => saveGoiY(o, false)}>Lưu</button>
                <button className="primary" onClick={() => saveGoiY(o, true)}>Chốt</button>
              </div>
            </section>
          ))}
          {daLuu.length > 0 && (
            <details className="card">
              <summary><b>Chọn từ outfit đã lưu ({daLuu.length})</b></summary>
              {daLuu.map((o) => (
                <div key={o.id} className="saved-row">
                  <OutfitItems state={state} items={o.mon} />
                  <div className="actions">
                    <button onClick={() => setPreview(o)}>Thử</button>
                    <button className="primary" onClick={() => run((s) => chotOutfit(s, o.id, dip.id, today), 'Đã chốt outfit cho dịp')}>Chốt</button>
                  </div>
                </div>
              ))}
            </details>
          )}
        </>
      )}

      {edit && <DipForm dip={dip} onClose={() => setEdit(false)} />}
      {compose && <Composer dip={dip} onClose={() => setCompose(false)} onPreview={(o) => { setPreview(o); setCompose(false); }} />}
    </div>
  );
}

export default function DipPage({ id }) {
  const { state, today } = useStore();
  const [form, setForm] = useState(false);
  if (id) return <DipDetail id={id} />;

  const list = [...state.dip].sort((a, b) => (a.ngay < b.ngay ? -1 : 1));
  const sapToi = list.filter((d) => trangThaiDip(d, today) === 'SAP_TOI');
  const daQua = list.filter((d) => trangThaiDip(d, today) === 'DA_QUA').reverse();
  const loaiMap = new Map(state.config.loaiDip.map((l) => [l.id, l]));
  const chotOf = (d) => state.outfit.find((o) => o.dipId === d.id && ['DA_CHOT', 'DA_MAC'].includes(o.trangThai));

  const Row = ({ d }) => {
    const c = chotOf(d);
    return (
      <button className="dip-row" onClick={() => go(`#/dip/${d.id}`)}>
        <span className="dip-icon">{loaiMap.get(d.loaiDipId)?.icon}</span>
        <span className="dip-text">
          <b>{d.ten}</b>
          <small>{formatVN(d.ngay)}{d.noi ? ` · ${d.noi}` : ''}</small>
        </span>
        <span className={`pill ${c ? '' : 'grey'}`}>{c ? (c.trangThai === 'DA_MAC' ? 'Đã mặc' : 'Đã chốt') : 'Chưa chọn đồ'}</span>
      </button>
    );
  };

  return (
    <div className="page page-scroll">
      <header className="page-head"><h1>Dịp sắp tới</h1></header>
      {sapToi.length === 0 ? (
        <Empty icon="📅" title="Chưa có dịp nào">Thêm dịp (đi làm, hẹn hò, đám cưới…) để app gợi ý outfit từ tủ đồ của bạn.</Empty>
      ) : sapToi.map((d) => <Row key={d.id} d={d} />)}
      {daQua.length > 0 && (
        <details className="past">
          <summary>Đã qua ({daQua.length})</summary>
          {daQua.map((d) => <Row key={d.id} d={d} />)}
        </details>
      )}
      <button className="fab" onClick={() => setForm(true)} aria-label="Thêm dịp">＋</button>
      {form && <DipForm onClose={() => setForm(false)} />}
    </div>
  );
}
