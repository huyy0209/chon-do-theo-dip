// =============================================================
// rules.js — Luật nghiệp vụ + vòng đời (hàm thuần, không đụng UI/DB)
// Mỗi hàm nhận state cũ, trả state mới; vi phạm luật -> ném NghiepVuError.
// Giai đoạn 2 chuyển nguyên các hàm này sang service layer của Node.js.
// state = { config, profile, mon: [], dip: [], outfit: [] }
// =============================================================
import { daysBetween, isValidDate } from './dates.js';
import { CHAT_LIEU } from './catalog.js';

const CL_IDS = new Set(CHAT_LIEU.map((c) => c.id));

export class NghiepVuError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // mã BR/RB vi phạm, dùng trong test và log
  }
}
const fail = (code, msg) => { throw new NghiepVuError(code, msg); };

let seq = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const byId = (list) => new Map(list.map((x) => [x.id, x]));

// Vị trí trong outfit suy ra từ loại món
export const VI_TRI = {
  AO: 'AO', QUAN: 'DUOI', CHAN_VAY: 'DUOI', DAM: 'DAM',
  AO_KHOAC: 'AO_KHOAC', GIAY: 'GIAY', TUI: 'TUI', PHU_KIEN: 'PHU_KIEN',
};
const BAT_BUOC = ['AO', 'DUOI', 'DAM', 'GIAY'];

// ---------------- Món đồ ----------------

// BR02 + RB01: món bắt buộc loại + kiểu + màu; trang trọng nguyên 1–5;
// chất liệu không bắt buộc (null = theo kiểu), nếu có phải nằm trong danh sách (RB06)
export function validateMon(input, config) {
  const kieu = config.kieuDo.find((k) => k.id === input.kieuId);
  if (!kieu) fail('BR02', 'Chưa chọn kiểu đồ.');
  if (!config.mau.some((m) => m.id === input.mauId)) fail('BR02', 'Chưa chọn màu chính.');
  const tt = input.trangTrong ?? kieu.trangTrong;
  if (!Number.isInteger(tt) || tt < 1 || tt > 5) fail('RB01', 'Độ trang trọng phải từ 1 đến 5.');
  if (input.anh && input.anh.length > 420_000) fail('BR02', 'Ảnh quá lớn (tối đa ~300 KB sau khi nén).');
  const chatLieu = input.chatLieu || null;
  if (chatLieu && !CL_IDS.has(chatLieu)) fail('RB06', 'Chất liệu không hợp lệ.');
  const mau = config.mau.find((m) => m.id === input.mauId);
  return {
    kieuId: kieu.id,
    mauId: input.mauId,
    trangTrong: tt,
    ten: (input.ten || '').trim() || `${kieu.ten} ${mau.ten.toLowerCase()}`,
    anh: input.anh || null,
    chatLieu, // null = dùng chất liệu mặc định của kiểu
  };
}

// Chất liệu hiệu lực của 1 món: món tự chọn > mặc định của kiểu > cotton
export function chatLieuCua(mon, kieu) {
  return mon?.chatLieu || kieu?.chatLieu || 'cotton';
}

export function themMon(state, input, now = new Date()) {
  const data = validateMon(input, state.config);
  const mon = { id: newId('mon'), ...data, trangThai: 'DANG_DUNG', createdAt: now.toISOString(), updatedAt: now.toISOString() };
  return { ...state, mon: [...state.mon, mon] };
}

export function suaMon(state, id, patch, now = new Date()) {
  const cur = state.mon.find((m) => m.id === id) || fail('NOT_FOUND', 'Không tìm thấy món đồ.');
  const data = validateMon({ ...cur, ...patch }, state.config);
  return { ...state, mon: state.mon.map((m) => (m.id === id ? { ...m, ...data, updatedAt: now.toISOString() } : m)) };
}

// Bảng chuyển trạng thái món đồ (mục 3 bản chốt)
const CHUYEN_MON = {
  DANG_DUNG: ['TAM_CAT', 'LUU_TRU'],
  TAM_CAT: ['DANG_DUNG', 'LUU_TRU'],
  LUU_TRU: ['DANG_DUNG'],
};
export function chuyenTrangThaiMon(state, id, to, now = new Date()) {
  const cur = state.mon.find((m) => m.id === id) || fail('NOT_FOUND', 'Không tìm thấy món đồ.');
  if (!CHUYEN_MON[cur.trangThai]?.includes(to)) fail('SM_MON', `Không thể chuyển từ ${cur.trangThai} sang ${to}.`);
  return { ...state, mon: state.mon.map((m) => (m.id === id ? { ...m, trangThai: to, updatedAt: now.toISOString() } : m)) };
}

// BR11: món đã nằm trong outfit Đã mặc chỉ được Lưu trữ, không xoá hẳn.
// Món trong outfit Đã chốt: phải bỏ chốt trước. Outfit Đã lưu chứa món bị xoá thì xoá theo.
export function xoaMon(state, id) {
  const dung = state.outfit.filter((o) => o.mon.some((x) => x.monId === id));
  if (dung.some((o) => o.trangThai === 'DA_MAC')) fail('BR11', 'Món này đã từng mặc, chỉ có thể Lưu trữ để giữ lịch sử.');
  if (dung.some((o) => o.trangThai === 'DA_CHOT')) fail('BR11', 'Món này đang nằm trong outfit đã chốt cho một dịp, hãy bỏ chốt trước.');
  const xoaOutfit = new Set(dung.map((o) => o.id));
  return {
    ...state,
    mon: state.mon.filter((m) => m.id !== id),
    outfit: state.outfit.filter((o) => !xoaOutfit.has(o.id)),
  };
}

// ---------------- Outfit ----------------

// BR01: (Áo + Quần/Chân váy) hoặc Đầm liền; + đúng 1 Giày; Áo khoác ≤1, Túi ≤1, Phụ kiện ≤2
export function validateOutfit(monIds, state) {
  const monMap = byId(state.mon);
  const kieuMap = byId(state.config.kieuDo);
  if (new Set(monIds).size !== monIds.length) fail('BR01', 'Một món không được chọn 2 lần.');
  const items = monIds.map((id) => {
    const m = monMap.get(id) || fail('NOT_FOUND', 'Có món không còn trong tủ đồ.');
    const kieu = kieuMap.get(m.kieuId) || fail('NOT_FOUND', 'Kiểu đồ không còn trong danh mục.');
    return { viTri: VI_TRI[kieu.loai], monId: id };
  });
  const dem = (vt) => items.filter((x) => x.viTri === vt).length;
  const coThan = (dem('AO') === 1 && dem('DUOI') === 1 && dem('DAM') === 0)
    || (dem('DAM') === 1 && dem('AO') === 0 && dem('DUOI') === 0);
  if (!coThan) fail('BR01', 'Outfit cần (1 áo + 1 quần/chân váy) hoặc 1 đầm liền.');
  if (dem('GIAY') !== 1) fail('BR01', 'Outfit cần đúng 1 đôi giày.');
  if (dem('AO_KHOAC') > 1 || dem('TUI') > 1) fail('BR01', 'Tối đa 1 áo khoác và 1 túi.');
  if (dem('PHU_KIEN') > 2) fail('BR01', 'Tối đa 2 phụ kiện.');
  return items;
}

export function luuOutfit(state, monIds, nguon = 'TU_PHOI', now = new Date()) {
  const items = validateOutfit(monIds, state);
  const o = { id: newId('of'), dipId: null, trangThai: 'DA_LUU', nguon, mon: items, ngayMac: null, createdAt: now.toISOString() };
  return { state: { ...state, outfit: [...state.outfit, o] }, outfit: o };
}

export function xoaOutfit(state, id) {
  const o = state.outfit.find((x) => x.id === id) || fail('NOT_FOUND', 'Không tìm thấy outfit.');
  if (o.trangThai === 'DA_MAC') fail('BR10', 'Outfit đã mặc bị khoá để giữ lịch sử.');
  if (o.trangThai === 'DA_CHOT') fail('BR09', 'Outfit đang chốt cho dịp, hãy bỏ chốt trước.');
  return { ...state, outfit: state.outfit.filter((x) => x.id !== id) };
}

// ---------------- Dịp ----------------

export const trangThaiDip = (dip, today) => (dip.ngay < today ? 'DA_QUA' : 'SAP_TOI');

export function themDip(state, input, today, now = new Date()) {
  const loai = state.config.loaiDip.find((l) => l.id === input.loaiDipId) || fail('DIP', 'Chưa chọn loại dịp.');
  if (!isValidDate(input.ngay)) fail('DIP', 'Ngày không hợp lệ.');
  if (input.ngay < today) fail('DIP', 'Dịp mới phải từ hôm nay trở đi.');
  const dip = {
    id: newId('dip'), loaiDipId: loai.id, ten: (input.ten || '').trim() || loai.ten,
    ngay: input.ngay, noi: (input.noi || '').trim(), ghiChu: (input.ghiChu || '').trim(), createdAt: now.toISOString(),
  };
  return { ...state, dip: [...state.dip, dip] };
}

export function suaDip(state, id, patch, today) {
  const cur = state.dip.find((d) => d.id === id) || fail('NOT_FOUND', 'Không tìm thấy dịp.');
  if (trangThaiDip(cur, today) === 'DA_QUA') {
    // Dịp đã qua: chỉ sửa ghi chú
    return { ...state, dip: state.dip.map((d) => (d.id === id ? { ...d, ghiChu: patch.ghiChu ?? d.ghiChu } : d)) };
  }
  const next = { ...cur, ...patch };
  if (!state.config.loaiDip.some((l) => l.id === next.loaiDipId)) fail('DIP', 'Loại dịp không hợp lệ.');
  if (!isValidDate(next.ngay) || next.ngay < today) fail('DIP', 'Ngày phải từ hôm nay trở đi.');
  return { ...state, dip: state.dip.map((d) => (d.id === id ? next : d)) };
}

export function xoaDip(state, id) {
  if (state.outfit.some((o) => o.dipId === id && o.trangThai === 'DA_MAC')) {
    fail('BR10', 'Dịp đã có outfit đã mặc, không xoá để giữ lịch sử.');
  }
  return {
    ...state,
    dip: state.dip.filter((d) => d.id !== id),
    // Outfit đang chốt cho dịp bị xoá -> về Đã lưu
    outfit: state.outfit.map((o) => (o.dipId === id ? { ...o, dipId: null, trangThai: 'DA_LUU' } : o)),
  };
}

// BR09: mỗi dịp tối đa 1 outfit Đã chốt; chốt bộ mới thì bộ cũ về Đã lưu
export function chotOutfit(state, outfitId, dipId, today) {
  const o = state.outfit.find((x) => x.id === outfitId) || fail('NOT_FOUND', 'Không tìm thấy outfit.');
  const dip = state.dip.find((d) => d.id === dipId) || fail('NOT_FOUND', 'Không tìm thấy dịp.');
  if (o.trangThai === 'DA_MAC') fail('BR10', 'Outfit đã mặc bị khoá.');
  if (trangThaiDip(dip, today) !== 'SAP_TOI') fail('BR09', 'Chỉ chốt outfit cho dịp sắp tới.');
  validateOutfit(o.mon.map((x) => x.monId), state);
  const monMap = byId(state.mon);
  if (o.mon.some((x) => monMap.get(x.monId)?.trangThai === 'LUU_TRU')) fail('BR03', 'Outfit có món đã lưu trữ.');
  return {
    ...state,
    outfit: state.outfit.map((x) => {
      if (x.id === outfitId) return { ...x, dipId, trangThai: 'DA_CHOT' };
      if (x.dipId === dipId && x.trangThai === 'DA_CHOT') return { ...x, dipId: null, trangThai: 'DA_LUU' };
      // Outfit này đang chốt cho dịp khác -> dịp kia mất outfit chốt (đã chuyển ở dòng trên)
      return x;
    }),
  };
}

export function boChot(state, outfitId, today) {
  const o = state.outfit.find((x) => x.id === outfitId) || fail('NOT_FOUND', 'Không tìm thấy outfit.');
  if (o.trangThai !== 'DA_CHOT') fail('SM_OUTFIT', 'Outfit chưa được chốt.');
  const dip = state.dip.find((d) => d.id === o.dipId);
  if (dip && trangThaiDip(dip, today) !== 'SAP_TOI') fail('BR10', 'Dịp đã qua, không bỏ chốt được.');
  return { ...state, outfit: state.outfit.map((x) => (x.id === outfitId ? { ...x, dipId: null, trangThai: 'DA_LUU' } : x)) };
}

// BR10: qua ngày dịp -> outfit chốt thành Đã mặc, ngày mặc = ngày dịp. Chạy lại nhiều lần vẫn đúng (idempotent).
export function dongBoQuaNgay(state, today) {
  const dipMap = byId(state.dip);
  let changed = false;
  const outfit = state.outfit.map((o) => {
    if (o.trangThai !== 'DA_CHOT') return o;
    const dip = dipMap.get(o.dipId);
    if (!dip || trangThaiDip(dip, today) !== 'DA_QUA') return o;
    changed = true;
    return { ...o, trangThai: 'DA_MAC', ngayMac: dip.ngay };
  });
  return changed ? { ...state, outfit } : state;
}

// Ngày mặc gần nhất của từng món (suy ra từ outfit Đã mặc)
export function lanMacCuoi(state) {
  const map = new Map();
  for (const o of state.outfit) {
    if (o.trangThai !== 'DA_MAC') continue;
    for (const x of o.mon) if (!map.has(x.monId) || map.get(x.monId) < o.ngayMac) map.set(x.monId, o.ngayMac);
  }
  return map;
}

export const soNgayTuLanMac = (ngayMac, today) => (ngayMac ? daysBetween(ngayMac, today) : Infinity);

// ---------------- Cấu hình (BR13) ----------------
export function validateConfig(c) {
  for (const l of c.loaiDip) {
    if (![l.min, l.max].every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) fail('RB01', `Loại dịp "${l.ten}": trang trọng phải 1–5.`);
    if (l.min > l.max) fail('RB02', `Loại dịp "${l.ten}": min phải ≤ max.`);
    if (!l.ten?.trim()) fail('BR13', 'Loại dịp phải có tên.');
  }
  for (const k of c.kieuDo) {
    if (!Number.isInteger(k.trangTrong) || k.trangTrong < 1 || k.trangTrong > 5) fail('RB01', `Kiểu "${k.ten}": trang trọng phải 1–5.`);
    if (!Object.values(k.hopDang).every((v) => [-1, 0, 1].includes(v))) fail('BR13', `Kiểu "${k.ten}": hợp dáng chỉ nhận -1, 0, 1.`);
    if (!VI_TRI[k.loai]) fail('BR13', `Kiểu "${k.ten}": loại không hợp lệ.`);
    if (k.chatLieu && !CL_IDS.has(k.chatLieu)) fail('RB06', `Kiểu "${k.ten}": chất liệu không hợp lệ.`);
  }
  const w = c.trongSo;
  const vals = [w.dip, w.dang, w.mau, w.moi];
  if (!vals.every((v) => Number.isFinite(v) && v >= 0)) fail('BR13', 'Trọng số không được âm.');
  if (vals.reduce((a, b) => a + b, 0) !== 100) fail('BR13', 'Tổng trọng số phải bằng 100.');
  if (!(Number.isInteger(c.nguong.ngayMoi) && c.nguong.ngayMoi >= 1)) fail('BR13', 'Ngưỡng "mới" phải ≥ 1 ngày.');
  if (!(Number.isInteger(c.nguong.ngayTrung) && c.nguong.ngayTrung >= 1)) fail('BR13', 'Ngưỡng "trùng bộ" phải ≥ 1 ngày.');
  return c;
}

// BR13: Quản trị không được xoá danh mục đang có dữ liệu dùng tới (giống khoá ngoại RESTRICT)
export function capNhatConfig(state, config) {
  validateConfig(config);
  const kieu = new Set(config.kieuDo.map((k) => k.id));
  const mau = new Set(config.mau.map((m) => m.id));
  const loai = new Set(config.loaiDip.map((l) => l.id));
  const m1 = state.mon.find((m) => !kieu.has(m.kieuId));
  if (m1) fail('BR13', `Không xoá được kiểu đồ đang dùng (món "${m1.ten}").`);
  const m2 = state.mon.find((m) => !mau.has(m.mauId));
  if (m2) fail('BR13', `Không xoá được màu đang dùng (món "${m2.ten}").`);
  const d1 = state.dip.find((d) => !loai.has(d.loaiDipId));
  if (d1) fail('BR13', `Không xoá được loại dịp đang dùng (dịp "${d1.ten}").`);
  for (const k of config.kieuDo) if (!k.id || !k.ten?.trim()) fail('BR13', 'Kiểu đồ phải có tên.');
  for (const m of config.mau) if (!/^#[0-9a-f]{6}$/i.test(m.hex) || !m.ten?.trim()) fail('BR13', `Màu "${m.ten}" không hợp lệ.`);
  return { ...state, config };
}

export { BAT_BUOC };
