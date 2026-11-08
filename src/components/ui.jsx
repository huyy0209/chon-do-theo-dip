// =============================================================
// ui.jsx — Thành phần giao diện nhỏ dùng chung
// =============================================================
import { kieuOf, mauOf, sortItems, VI_TRI_TEN } from '../lib/view.js';

// Bottom sheet / hộp thoại
export function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{title}</b>
          <button className="icon" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Ảnh món đồ: ảnh thật nếu có, không thì ô màu + chữ cái đầu kiểu
export function MonThumb({ state, mon, size = 56 }) {
  const mau = mauOf(state, mon);
  const kieu = kieuOf(state, mon);
  if (mon?.anh) return <img className="thumb" src={mon.anh} alt={mon.ten} style={{ width: size, height: size }} />;
  return (
    <span className="thumb swatch" style={{ width: size, height: size, background: mau?.hex || '#ddd' }}>
      <span>{kieu?.ten?.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
    </span>
  );
}

// Danh sách món của 1 outfit (gọn)
export function OutfitItems({ state, items }) {
  const monMap = new Map(state.mon.map((m) => [m.id, m]));
  return (
    <div className="outfit-items">
      {sortItems(items).map((x) => {
        const mon = monMap.get(x.monId);
        return (
          <div className="oi" key={x.monId} title={mon?.ten}>
            <MonThumb state={state} mon={mon} size={52} />
            <small>{mon ? mon.ten : '(đã xoá)'}</small>
            <i>{VI_TRI_TEN[x.viTri]}</i>
          </div>
        );
      })}
    </div>
  );
}

// Thanh điểm chi tiết (BR05)
export function ScoreBar({ diem, chiTiet, trongSo }) {
  const parts = [
    ['dip', 'Hợp dịp', '#f27aa8'], ['dang', 'Hợp dáng', '#9c7bd1'], ['mau', 'Hợp màu', '#f2b84b'], ['moi', 'Độ mới', '#5aa469'],
  ];
  return (
    <div className="score">
      <div className="score-top"><b>{diem}</b><small>/100 điểm</small></div>
      <div className="score-bar">
        {parts.map(([k, , c]) => <span key={k} style={{ width: `${chiTiet[k]}%`, background: c }} />)}
      </div>
      <div className="score-legend">
        {parts.map(([k, label, c]) => (
          <span key={k}><i style={{ background: c }} />{label} {chiTiet[k].toFixed(0)}/{trongSo[k]}</span>
        ))}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <b>{title}</b>
      <p>{children}</p>
    </div>
  );
}
