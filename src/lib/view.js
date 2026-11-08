// =============================================================
// view.js — Hàm hỗ trợ hiển thị (không chứa luật nghiệp vụ)
// =============================================================
import { classifyShape, effectiveValues } from '../avatar/measurements.js';
import { byId, chatLieuCua } from '../domain/rules.js';
import { DEFAULT_TEMPLATE_BY_LOAI, TEMPLATES } from '../avatar/proc/garments.js';

export const kieuOf = (state, mon) => state.config.kieuDo.find((k) => k.id === mon?.kieuId);
export const mauOf = (state, mon) => state.config.mau.find((m) => m.id === mon?.mauId);

// Số đo hiệu lực + dáng người hiện tại
export function shapeOf(profile) {
  const v = effectiveValues(profile.measurements);
  return classifyShape(v);
}

// Mẫu 3D của 1 kiểu đồ: do Quản trị chọn, không có thì theo id kiểu, cuối cùng theo loại món
export function templateOf(kieu) {
  if (!kieu) return null;
  if (kieu.mau3d && TEMPLATES[kieu.mau3d]) return kieu.mau3d;
  if (TEMPLATES[kieu.id]) return kieu.id;
  return DEFAULT_TEMPLATE_BY_LOAI[kieu.loai] || null;
}

// Q7: outfit -> danh sách đồ 3D [{ tpl, color }] cho avatar
export function outfitItems(state, outfit) {
  if (!outfit) return null;
  const monMap = byId(state.mon);
  const mauMap = byId(state.config.mau);
  const kieuMap = byId(state.config.kieuDo);
  return outfit.mon.map((x) => {
    const mon = monMap.get(x.monId);
    const kieu = kieuMap.get(mon?.kieuId);
    const tpl = templateOf(kieu);
    return tpl ? { tpl, color: mauMap.get(mon.mauId)?.hex || '#cccccc', mat: chatLieuCua(mon, kieu) } : null;
  }).filter(Boolean);
}

// Chú thích ảnh chụp outfit
export function outfitCaption(state, outfit, title) {
  const monMap = byId(state.mon);
  return { title, lines: outfit ? sortItems(outfit.mon).map((x) => `• ${monMap.get(x.monId)?.ten || ''}`) : [] };
}

export const VI_TRI_TEN = {
  AO: 'Áo', DUOI: 'Quần/váy', DAM: 'Đầm', GIAY: 'Giày', AO_KHOAC: 'Áo khoác', TUI: 'Túi', PHU_KIEN: 'Phụ kiện',
};
const ORDER = ['AO_KHOAC', 'AO', 'DAM', 'DUOI', 'GIAY', 'TUI', 'PHU_KIEN'];
export const sortItems = (items) => [...items].sort((a, b) => ORDER.indexOf(a.viTri) - ORDER.indexOf(b.viTri));

// Nén ảnh: tối đa 720px, JPEG, ≤ ~300 KB (BR02)
export async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let size = 720;
    let q = 0.82;
    let data = '';
    for (let lan = 0; lan < 10; lan++) {
      const k = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      data = c.toDataURL('image/jpeg', q);
      if (data.length <= 400_000) return data;
      if (q > 0.5) q -= 0.1; else { size = Math.round(size * 0.75); q = 0.8; } // giảm chất lượng, rồi thu nhỏ
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
