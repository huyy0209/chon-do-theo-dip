// =============================================================
// AdminPage.jsx — Quản trị (Q15): khoá PIN chống bấm nhầm, sửa danh mục + trọng số (BR13)
// PIN chỉ để tránh bấm nhầm, KHÔNG phải bảo mật thật (giai đoạn 2 thay bằng đăng nhập).
// =============================================================
import { useState } from 'react';
import { CHAT_LIEU, DANG_NGUOI, LOAI_MON, defaultConfig } from '../domain/catalog.js';
import { capNhatConfig, newId } from '../domain/rules.js';
import { templatesForLoai } from '../avatar/proc/garments.js';
import { templateOf } from '../lib/view.js';
import { useStore } from '../store/AppStore.jsx';

function PinGate({ onOk }) {
  const { state, run, notify } = useStore();
  const [pin, setPin] = useState('');
  const chuaCo = !state.config.adminPin;
  const submit = () => {
    if (!/^\d{4,6}$/.test(pin)) { notify('PIN gồm 4–6 chữ số.', 'error'); return; }
    if (chuaCo) {
      run((s) => ({ ...s, config: { ...s.config, adminPin: pin } }), 'Đã đặt PIN quản trị');
      onOk();
    } else if (pin === state.config.adminPin) onOk();
    else notify('Sai PIN.', 'error');
  };
  return (
    <div className="page page-scroll">
      <header className="page-head"><h1>Quản trị</h1></header>
      <section className="card">
        <b>{chuaCo ? 'Đặt PIN quản trị' : 'Nhập PIN'}</b>
        <p className="muted">PIN chỉ để tránh bấm nhầm vào phần cấu hình.</p>
        <input className="text" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="4–6 chữ số" />
        <div className="actions"><button className="primary" onClick={submit}>{chuaCo ? 'Đặt PIN' : 'Mở'}</button></div>
      </section>
    </div>
  );
}

const num = (v) => (v === '' ? '' : Number(v));

export default function AdminPage() {
  const { state, run, ask } = useStore();
  const [ok, setOk] = useState(false);
  const [c, setC] = useState(() => structuredClone(state.config));
  const [tab, setTab] = useState('diem');
  if (!ok) return <PinGate onOk={() => setOk(true)} />;

  const set = (fn) => setC((prev) => { const n = structuredClone(prev); fn(n); return n; });
  const tong = ['dip', 'dang', 'mau', 'moi'].reduce((s, k) => s + (Number(c.trongSo[k]) || 0), 0);
  const save = () => run((s) => capNhatConfig(s, c), 'Đã lưu cấu hình');
  const reset = async () => {
    if (!(await ask('Đưa danh mục và trọng số về mặc định? (PIN giữ nguyên)'))) return;
    setC({ ...defaultConfig(), adminPin: state.config.adminPin });
  };

  return (
    <div className="page page-scroll admin">
      <header className="page-head">
        <h1>Quản trị</h1>
        <div className="tabs-mini">
          {[['diem', 'Chấm điểm'], ['dip', 'Loại dịp'], ['kieu', 'Kiểu đồ'], ['mau', 'Màu']].map(([k, v]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>
      </header>

      {tab === 'diem' && (
        <section className="card">
          <b>Trọng số điểm (tổng phải = 100)</b>
          {[['dip', 'Hợp dịp'], ['dang', 'Hợp dáng'], ['mau', 'Hợp màu'], ['moi', 'Độ mới']].map(([k, label]) => (
            <label key={k} className="slot"><span>{label}</span>
              <input className="text small" type="number" value={c.trongSo[k]} onChange={(e) => set((n) => { n.trongSo[k] = num(e.target.value); })} />
            </label>
          ))}
          <p className={tong === 100 ? 'muted' : 'err'}>Tổng: {tong}</p>
          <b>Ngưỡng</b>
          <label className="slot"><span>Trừ điểm món mặc trong (ngày)</span>
            <input className="text small" type="number" value={c.nguong.ngayMoi} onChange={(e) => set((n) => { n.nguong.ngayMoi = num(e.target.value); })} />
          </label>
          <label className="slot"><span>Loại bộ trùng đã mặc trong (ngày)</span>
            <input className="text small" type="number" value={c.nguong.ngayTrung} onChange={(e) => set((n) => { n.nguong.ngayTrung = num(e.target.value); })} />
          </label>
        </section>
      )}

      {tab === 'dip' && (
        <section className="card">
          <b>Loại dịp: khoảng trang trọng (1–5)</b>
          <table className="tbl">
            <thead><tr><th>Icon</th><th>Tên</th><th>Min</th><th>Max</th><th /></tr></thead>
            <tbody>
              {c.loaiDip.map((l, i) => (
                <tr key={l.id}>
                  <td><input className="text tiny" value={l.icon} onChange={(e) => set((n) => { n.loaiDip[i].icon = e.target.value; })} /></td>
                  <td><input className="text" value={l.ten} onChange={(e) => set((n) => { n.loaiDip[i].ten = e.target.value; })} /></td>
                  <td><input className="text tiny" type="number" value={l.min} onChange={(e) => set((n) => { n.loaiDip[i].min = num(e.target.value); })} /></td>
                  <td><input className="text tiny" type="number" value={l.max} onChange={(e) => set((n) => { n.loaiDip[i].max = num(e.target.value); })} /></td>
                  <td><button className="icon" onClick={() => set((n) => { n.loaiDip.splice(i, 1); })}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => set((n) => { n.loaiDip.push({ id: newId('ld'), ten: 'Dịp mới', icon: '⭐', min: 2, max: 3 }); })}>+ Thêm loại dịp</button>
        </section>
      )}

      {tab === 'kieu' && LOAI_MON.map((lm) => (
        <section className="card" key={lm.id}>
          <b>{lm.ten}</b>
          <table className="tbl">
            <thead><tr><th>Tên kiểu</th><th>TT</th>{DANG_NGUOI.map((d) => <th key={d}>{d}</th>)}<th>Mẫu 3D</th><th>Chất liệu</th><th /></tr></thead>
            <tbody>
              {c.kieuDo.map((k, i) => (k.loai !== lm.id ? null : (
                <tr key={k.id}>
                  <td><input className="text" value={k.ten} onChange={(e) => set((n) => { n.kieuDo[i].ten = e.target.value; })} /></td>
                  <td><input className="text tiny" type="number" value={k.trangTrong} onChange={(e) => set((n) => { n.kieuDo[i].trangTrong = num(e.target.value); })} /></td>
                  {DANG_NGUOI.map((d) => (
                    <td key={d}>
                      <select className={`hd v${k.hopDang[d]}`} value={k.hopDang[d]} onChange={(e) => set((n) => { n.kieuDo[i].hopDang[d] = Number(e.target.value); })}>
                        <option value={1}>+1</option><option value={0}>0</option><option value={-1}>−1</option>
                      </select>
                    </td>
                  ))}
                  <td>
                    <select className="hd" value={templateOf(k) || ''} onChange={(e) => set((n) => { n.kieuDo[i].mau3d = e.target.value; })}>
                      {templatesForLoai(lm.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="hd" value={k.chatLieu || 'cotton'} onChange={(e) => set((n) => { n.kieuDo[i].chatLieu = e.target.value; })}>
                      {CHAT_LIEU.map((c) => <option key={c.id} value={c.id}>{c.ten}</option>)}
                    </select>
                  </td>
                  <td><button className="icon" onClick={() => set((n) => { n.kieuDo.splice(i, 1); })}>🗑</button></td>
                </tr>
              )))}
            </tbody>
          </table>
          <button onClick={() => set((n) => { n.kieuDo.push({ id: newId('kd'), loai: lm.id, ten: 'Kiểu mới', trangTrong: 2, hopDang: { X: 0, A: 0, V: 0, H: 0, O: 0 }, mau3d: templatesForLoai(lm.id)[0]?.id, chatLieu: 'cotton' }); })}>+ Thêm kiểu {lm.ten.toLowerCase()}</button>
        </section>
      ))}

      {tab === 'mau' && (
        <section className="card">
          <b>Bảng màu (trung tính không tính là "màu nổi")</b>
          <table className="tbl">
            <thead><tr><th>Màu</th><th>Tên</th><th>Trung tính</th><th /></tr></thead>
            <tbody>
              {c.mau.map((m, i) => (
                <tr key={m.id}>
                  <td><input type="color" value={m.hex} onChange={(e) => set((n) => { n.mau[i].hex = e.target.value; })} /></td>
                  <td><input className="text" value={m.ten} onChange={(e) => set((n) => { n.mau[i].ten = e.target.value; })} /></td>
                  <td><input type="checkbox" checked={m.trungTinh} onChange={(e) => set((n) => { n.mau[i].trungTinh = e.target.checked; })} /></td>
                  <td><button className="icon" onClick={() => set((n) => { n.mau.splice(i, 1); })}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => set((n) => { n.mau.push({ id: newId('mau'), ten: 'Màu mới', hex: '#cccccc', trungTinh: false }); })}>+ Thêm màu</button>
        </section>
      )}

      <div className="sticky-actions">
        <button onClick={reset}>Mặc định</button>
        <button className="primary" onClick={save}>Lưu cấu hình</button>
      </div>
    </div>
  );
}
