// =============================================================
// catalog.js — Danh mục mặc định do Quản trị quản lý (Q14: Claude soạn, chờ duyệt)
// Quản trị sửa được trong màn /admin (BR13). Đây chỉ là dữ liệu khởi tạo (seed).
// =============================================================

// Loại món -> chỗ (vị trí) trong outfit
export const LOAI_MON = [
  { id: 'AO', ten: 'Áo' },
  { id: 'QUAN', ten: 'Quần' },
  { id: 'CHAN_VAY', ten: 'Chân váy' },
  { id: 'DAM', ten: 'Đầm liền' },
  { id: 'AO_KHOAC', ten: 'Áo khoác' },
  { id: 'GIAY', ten: 'Giày' },
  { id: 'TUI', ten: 'Túi' },
  { id: 'PHU_KIEN', ten: 'Phụ kiện' },
];

export const TRANG_THAI_MON = {
  DANG_DUNG: 'Đang dùng',
  TAM_CAT: 'Tạm cất',
  LUU_TRU: 'Lưu trữ',
};

export const TRANG_THAI_OUTFIT = {
  DA_LUU: 'Đã lưu',
  DA_CHOT: 'Đã chốt',
  DA_MAC: 'Đã mặc',
};

export const DANG_NGUOI = ['X', 'A', 'V', 'H', 'O'];

// Chất liệu (BR02 sửa 2026-11-08): không bắt buộc, mặc định theo kiểu, người dùng đổi được
export const CHAT_LIEU = [
  { id: 'cotton', ten: 'Cotton/thun' },
  { id: 'denim', ten: 'Denim (jean)' },
  { id: 'kaki', ten: 'Kaki/vải tây' },
  { id: 'lanh', ten: 'Linen (đũi)' },
  { id: 'len', ten: 'Len' },
  { id: 'lua', ten: 'Lụa/satin' },
  { id: 'voan', ten: 'Voan/chiffon' },
  { id: 'da', ten: 'Da' },
  { id: 'kim_loai', ten: 'Kim loại' },
];

// Chất liệu mặc định của từng kiểu
const CL_KIEU = {
  ao_thun: 'cotton', ao_thun_oversize: 'cotton', ao_croptop: 'cotton', ao_om: 'cotton', ao_len: 'len',
  so_mi: 'cotton', ao_co_v: 'cotton', ao_co_thuyen: 'cotton', ao_tay_phong: 'voan', ao_peplum: 'cotton',
  quan_jogger: 'cotton', quan_short: 'denim', quan_skinny: 'denim', quan_ong_rong: 'lanh', quan_tay: 'kaki',
  vay_chu_a: 'kaki', vay_xoe: 'voan', vay_but_chi: 'kaki',
  dam_suong: 'lanh', dam_wrap: 'lua', dam_om: 'cotton', dam_maxi: 'voan',
  cardigan: 'len', khoac_jean: 'denim', blazer: 'kaki',
  dep_sandal: 'da', giay_the_thao: 'cotton', giay_bup_be: 'da', boots: 'da', cao_got: 'da',
  tui_deo_cheo: 'da', tui_xach: 'da', clutch: 'lua', mu: 'cotton', that_lung: 'da', trang_suc: 'kim_loai',
};
export const CHAT_LIEU_THEO_LOAI = {
  AO: 'cotton', QUAN: 'kaki', CHAN_VAY: 'kaki', DAM: 'cotton', AO_KHOAC: 'kaki', GIAY: 'da', TUI: 'da', PHU_KIEN: 'kim_loai',
};
export const chatLieuMacDinh = (id, loai) => CL_KIEU[id] || CHAT_LIEU_THEO_LOAI[loai] || 'cotton';

// Loại dịp: khoảng trang trọng [min, max] trên thang 1–5 (BR04)
const LOAI_DIP = [
  ['o_nha', 'Ở nhà', '🏠', 1, 2],
  ['the_thao', 'Thể thao', '🏃‍♀️', 1, 2],
  ['di_bien', 'Đi biển', '🏖️', 1, 2],
  ['cafe', 'Cafe, đi chơi', '☕', 2, 3],
  ['di_hoc', 'Đi học', '🎒', 2, 3],
  ['du_lich', 'Du lịch', '✈️', 2, 3],
  ['di_lam', 'Đi làm', '💼', 3, 4],
  ['hen_ho', 'Hẹn hò', '💗', 3, 4],
  ['tiec_toi', 'Tiệc tối', '🥂', 4, 5],
  ['dam_cuoi', 'Đám cưới', '💍', 4, 5],
];

// Kiểu đồ: [id, loại, tên, trang trọng mặc định, hợp dáng X, A, V, H, O]
// +1 = tôn dáng, 0 = bình thường, -1 = nên tránh
const KIEU_DO = [
  ['ao_thun', 'AO', 'Áo thun', 1, 0, 0, 0, 0, 0],
  ['ao_thun_oversize', 'AO', 'Áo thun oversize', 1, -1, 0, -1, 0, 0],
  ['ao_croptop', 'AO', 'Áo croptop', 2, 1, 0, 0, 1, -1],
  ['ao_om', 'AO', 'Áo ôm body', 2, 1, 0, 0, -1, -1],
  ['ao_len', 'AO', 'Áo len', 2, 0, 0, 0, 0, 0],
  ['so_mi', 'AO', 'Sơ mi', 3, 0, 0, 0, 0, 0],
  ['ao_co_v', 'AO', 'Áo cổ V', 3, 1, 0, 1, 0, 1],
  ['ao_co_thuyen', 'AO', 'Áo cổ thuyền', 3, 0, 1, -1, 0, 0],
  ['ao_tay_phong', 'AO', 'Áo kiểu tay phồng', 3, 0, 1, -1, 1, -1],
  ['ao_peplum', 'AO', 'Áo peplum', 3, 0, 0, 0, 1, 0],
  ['quan_jogger', 'QUAN', 'Quần jogger', 1, 0, 0, 0, 0, 0],
  ['quan_short', 'QUAN', 'Quần short', 1, 0, -1, 1, 0, -1],
  ['quan_skinny', 'QUAN', 'Quần jean skinny', 2, 1, -1, 0, 0, -1],
  ['quan_ong_rong', 'QUAN', 'Quần ống rộng', 3, 0, 1, 1, 0, 0],
  ['quan_tay', 'QUAN', 'Quần tây ống đứng', 4, 0, 1, 0, 0, 1],
  ['vay_chu_a', 'CHAN_VAY', 'Chân váy chữ A', 3, 1, 1, 1, 1, 0],
  ['vay_xoe', 'CHAN_VAY', 'Chân váy xoè/xếp ly', 3, 0, 0, 1, 1, 0],
  ['vay_but_chi', 'CHAN_VAY', 'Chân váy bút chì', 4, 1, -1, 0, -1, -1],
  ['dam_suong', 'DAM', 'Đầm suông', 3, -1, 0, 0, 0, 1],
  ['dam_wrap', 'DAM', 'Đầm wrap (đắp chéo)', 4, 1, 1, 0, 1, 1],
  ['dam_om', 'DAM', 'Đầm ôm body', 4, 1, -1, 0, -1, -1],
  ['dam_maxi', 'DAM', 'Đầm maxi/dạ hội', 5, 1, 1, 0, 0, 0],
  ['cardigan', 'AO_KHOAC', 'Cardigan', 2, 0, 0, 0, 0, 1],
  ['khoac_jean', 'AO_KHOAC', 'Áo khoác jean', 2, 0, 1, -1, 0, 0],
  ['blazer', 'AO_KHOAC', 'Blazer', 4, 0, 0, -1, 1, 0],
  ['dep_sandal', 'GIAY', 'Sandal/dép', 1, 0, 0, 0, 0, 0],
  ['giay_the_thao', 'GIAY', 'Giày thể thao', 1, 0, 0, 0, 0, 0],
  ['giay_bup_be', 'GIAY', 'Giày búp bê', 3, 0, 0, 0, 0, 0],
  ['boots', 'GIAY', 'Boots', 3, 0, -1, 1, 0, 0],
  ['cao_got', 'GIAY', 'Giày cao gót', 4, 0, 1, 0, 0, 1],
  ['tui_deo_cheo', 'TUI', 'Túi đeo chéo', 2, 0, 0, 0, 0, 0],
  ['tui_xach', 'TUI', 'Túi xách tay', 4, 0, 0, 0, 0, 0],
  ['clutch', 'TUI', 'Clutch dự tiệc', 5, 0, 0, 0, 0, 0],
  ['mu', 'PHU_KIEN', 'Mũ', 1, 0, 0, 0, 0, 0],
  ['that_lung', 'PHU_KIEN', 'Thắt lưng', 3, 1, 0, 0, 1, -1],
  ['trang_suc', 'PHU_KIEN', 'Trang sức', 4, 0, 0, 0, 0, 0],
];

// Màu: trung tính không tính vào "số màu nổi" (BR05)
const MAU = [
  ['den', 'Đen', '#1f1f24', true],
  ['trang', 'Trắng', '#f7f7f5', true],
  ['kem', 'Kem', '#f1e6cf', true],
  ['xam', 'Xám', '#9a9aa2', true],
  ['be', 'Be', '#d9c3a0', true],
  ['nau', 'Nâu', '#7a5236', true],
  ['navy', 'Navy', '#24325c', true],
  ['denim', 'Denim', '#4f6f9a', true],
  ['do', 'Đỏ', '#c8323c', false],
  ['hong', 'Hồng', '#f08cb0', false],
  ['cam', 'Cam', '#f08a3c', false],
  ['vang', 'Vàng', '#f2c84b', false],
  ['xanh_la', 'Xanh lá', '#5aa469', false],
  ['xanh_duong', 'Xanh dương', '#4a90d9', false],
  ['tim', 'Tím', '#9a6ad0', false],
];

export function defaultConfig() {
  return {
    version: 1,
    loaiDip: LOAI_DIP.map(([id, ten, icon, min, max]) => ({ id, ten, icon, min, max })),
    kieuDo: KIEU_DO.map(([id, loai, ten, trangTrong, X, A, V, H, O]) => ({
      id, loai, ten, trangTrong, hopDang: { X, A, V, H, O }, mau3d: id, // mẫu 3D trên avatar (Q7)
      chatLieu: chatLieuMacDinh(id, loai), // chất liệu mặc định (BR02)
    })),
    mau: MAU.map(([id, ten, hex, trungTinh]) => ({ id, ten, hex, trungTinh })),
    trongSo: { dip: 40, dang: 25, mau: 20, moi: 15 }, // Q13
    nguong: { ngayMoi: 7, ngayTrung: 14 },            // Q13
    adminPin: null, // Q15: đặt lần đầu khi vào /admin
  };
}
