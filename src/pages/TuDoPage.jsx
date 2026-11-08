// =============================================================
// TuDoPage.jsx — Tủ đồ: thêm/sửa món, lọc, chuyển trạng thái (BR02, BR11)
// =============================================================
import { useMemo, useRef, useState } from 'react';
import { CHAT_LIEU, LOAI_MON, TRANG_THAI_MON } from '../domain/catalog.js';
import { chatLieuCua, chuyenTrangThaiMon, suaMon, themMon, xoaMon } from '../domain/rules.js';
import { compressImage, kieuOf, mauOf } from '../lib/view.js';
import { useStore } from '../store/AppStore.jsx';
import { Empty, MonThumb, Sheet } from '../components/ui.jsx';

const TT_LABEL = ['', 'Rất thoải mái', 'Thường ngày', 'Lịch sự', 'Trang trọng', 'Dạ tiệc'];

function MonForm({ mon, onClose }) {
  const { state, run, notify } = useStore();
  const { config } = state;
  const editing = Boolean(mon);
  const kieu0 = editing ? kieuOf(state, mon) : null;
  const [loai, setLoai] = useState(kieu0?.loai || 'AO');
  const [kieuId, setKieuId] = useState(mon?.kieuId || '');
  const [mauId, setMauId] = useState(mon?.mauId || '');
  const [tt, setTt] = useState(mon?.trangTrong ?? null);
  const [ten, setTen] = useState(mon?.ten || '');
  const [anh, setAnh] = useState(mon?.anh || null);
  const [chatLieu, setChatLieu] = useState(mon?.chatLieu || null); // null = theo kiểu
  const fileRef = useRef(null);

  const kieuList = config.kieuDo.filter((k) => k.loai === loai);
  const kieu = config.kieuDo.find((k) => k.id === kieuId);
  const ttShown = tt ?? kieu?.trangTrong ?? 3;

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setAnh(await compressImage(f)); } catch { notify('Không đọc được ảnh.', 'error'); }
  };

  const save = () => {
    const input = { kieuId, mauId, trangTrong: tt ?? undefined, ten, anh, chatLieu };
    const ok = editing
      ? run((s) => suaMon(s, mon.id, input), 'Đã cập nhật món đồ')
      : run((s) => themMon(s, input), 'Đã thêm vào tủ đồ');
    if (ok) onClose();
  };

  const move = (to) => { if (run((s) => chuyenTrangThaiMon(s, mon.id, to), `Đã chuyển sang ${TRANG_THAI_MON[to]}`)) onClose(); };
  const remove = () => {
    const dung = state.outfit.filter((o) => o.mon.some((x) => x.monId === mon.id) && o.trangThai === 'DA_LUU').length;
    const msg = dung ? `Xoá hẳn món này? ${dung} outfit đã lưu có món này cũng bị xoá theo.` : 'Xoá hẳn món này?';
    if (window.confirm(msg) && run((s) => xoaMon(s, mon.id), 'Đã xoá')) onClose();
  };

  return (
    <Sheet title={editing ? 'Sửa món đồ' : 'Thêm món đồ'} onClose={onClose}
      footer={<button className="primary wide" onClick={save}>{editing ? 'Lưu thay đổi' : 'Thêm vào tủ'}</button>}>
      <div className="photo-pick" onClick={() => fileRef.current?.click()}>
        {anh ? <img src={anh} alt="" /> : <span>📷 Thêm ảnh (không bắt buộc)</span>}
      </div>
      {anh && <button className="link" onClick={() => setAnh(null)}>Bỏ ảnh</button>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />

      <label className="field-label">Loại *</label>
      <div className="chips">
        {LOAI_MON.map((l) => (
          <button key={l.id} className={`chip ${loai === l.id ? 'on' : ''}`}
            onClick={() => { setLoai(l.id); setKieuId(''); setTt(null); }}>{l.ten}</button>
        ))}
      </div>

      <label className="field-label">Kiểu *</label>
      <div className="chips">
        {kieuList.map((k) => (
          <button key={k.id} className={`chip ${kieuId === k.id ? 'on' : ''}`}
            onClick={() => { setKieuId(k.id); setTt(null); }}>{k.ten}</button>
        ))}
      </div>

      <label className="field-label">Màu chính *</label>
      <div className="swatches">
        {config.mau.map((m) => (
          <button key={m.id} className={`sw ${mauId === m.id ? 'on' : ''}`} style={{ background: m.hex }}
            title={m.ten} aria-label={m.ten} onClick={() => setMauId(m.id)} />
        ))}
      </div>
      {mauId && <small className="muted">{config.mau.find((m) => m.id === mauId)?.ten}</small>}

      <label className="field-label">Chất liệu <small>(tự theo kiểu, đổi được)</small></label>
      <div className="chips">
        {CHAT_LIEU.map((c) => {
          const on = (chatLieu || kieu?.chatLieu) === c.id;
          return (
            <button key={c.id} className={`chip ${on ? 'on' : ''} ${on && !chatLieu ? 'auto' : ''}`}
              onClick={() => setChatLieu(c.id === kieu?.chatLieu ? null : c.id)}>{c.ten}</button>
          );
        })}
      </div>

      <label className="field-label">Độ trang trọng <small>(tự điền theo kiểu, sửa được)</small></label>
      <div className="seg">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} className={ttShown === v ? 'on' : ''} onClick={() => setTt(v)}>{v}</button>
        ))}
      </div>
      <small className="muted">{TT_LABEL[ttShown]}</small>

      <label className="field-label">Tên <small>(để trống = tự đặt)</small></label>
      <input className="text" value={ten} placeholder={kieu && mauId ? `${kieu.ten} ${config.mau.find((m) => m.id === mauId)?.ten.toLowerCase()}` : 'Ví dụ: Sơ mi trắng Uniqlo'}
        onChange={(e) => setTen(e.target.value)} />

      {editing && (
        <div className="danger-zone">
          <span className="muted">Trạng thái: <b>{TRANG_THAI_MON[mon.trangThai]}</b></span>
          <div className="actions">
            {mon.trangThai !== 'DANG_DUNG' && <button onClick={() => move('DANG_DUNG')}>Dùng lại</button>}
            {mon.trangThai === 'DANG_DUNG' && <button onClick={() => move('TAM_CAT')}>Tạm cất</button>}
            {mon.trangThai !== 'LUU_TRU' && <button onClick={() => move('LUU_TRU')}>Lưu trữ</button>}
            <button className="danger" onClick={remove}>Xoá hẳn</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function TuDoPage() {
  const { state } = useStore();
  const [loai, setLoai] = useState('ALL');
  const [tt, setTt] = useState('DANG_DUNG');
  const [form, setForm] = useState(null); // null | 'new' | mon

  const list = useMemo(() => state.mon
    .filter((m) => m.trangThai === tt)
    .filter((m) => loai === 'ALL' || kieuOf(state, m)?.loai === loai)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)), [state, loai, tt]);

  const counts = Object.fromEntries(Object.keys(TRANG_THAI_MON).map((k) => [k, state.mon.filter((m) => m.trangThai === k).length]));

  return (
    <div className="page page-scroll">
      <header className="page-head">
        <h1>Tủ đồ</h1>
        <div className="tabs-mini">
          {Object.entries(TRANG_THAI_MON).map(([k, v]) => (
            <button key={k} className={tt === k ? 'on' : ''} onClick={() => setTt(k)}>{v} {counts[k]}</button>
          ))}
        </div>
        <div className="chips scroll-x">
          <button className={`chip ${loai === 'ALL' ? 'on' : ''}`} onClick={() => setLoai('ALL')}>Tất cả</button>
          {LOAI_MON.map((l) => (
            <button key={l.id} className={`chip ${loai === l.id ? 'on' : ''}`} onClick={() => setLoai(l.id)}>{l.ten}</button>
          ))}
        </div>
      </header>

      {list.length === 0 ? (
        <Empty icon="👗" title={state.mon.length ? 'Không có món nào ở đây' : 'Tủ đồ đang trống'}>
          {state.mon.length ? 'Thử đổi bộ lọc.' : 'Thêm vài món: tối thiểu 1 áo, 1 quần/váy, 1 đôi giày để app bắt đầu gợi ý.'}
        </Empty>
      ) : (
        <div className="grid">
          {list.map((m) => (
            <button key={m.id} className="card-mon" onClick={() => setForm(m)}>
              <MonThumb state={state} mon={m} size={88} />
              <b>{m.ten}</b>
              <small>{kieuOf(state, m)?.ten} · {mauOf(state, m)?.ten} · {CHAT_LIEU.find((c) => c.id === chatLieuCua(m, kieuOf(state, m)))?.ten} · TT {m.trangTrong}</small>
            </button>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setForm('new')} aria-label="Thêm món đồ">＋</button>
      {form && <MonForm mon={form === 'new' ? null : form} onClose={() => setForm(null)} />}
    </div>
  );
}
