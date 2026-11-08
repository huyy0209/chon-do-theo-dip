// =============================================================
// measurements.js — Định nghĩa số đo, ước lượng ô bỏ trống, phân loại dáng người
// -------------------------------------------------------------
// Cơ bản (bắt buộc): chiều cao, cân nặng, 3 vòng
// Chi tiết (không bắt buộc): để trống (null) -> tự ước tính theo tỉ lệ cơ thể trung bình
// 'fit: false' = không dùng để đo lại trên avatar (cân nặng, độ dày mông)
// =============================================================

export const BASIC = [
  { key: 'heightCm', label: 'Chiều cao', unit: 'cm', min: 140, max: 185 },
  { key: 'weightKg', label: 'Cân nặng', unit: 'kg', min: 35, max: 100, fit: false },
  { key: 'bustCm', label: 'Vòng ngực', unit: 'cm', min: 70, max: 115 },
  { key: 'waistCm', label: 'Vòng eo', unit: 'cm', min: 52, max: 100 },
  { key: 'hipCm', label: 'Vòng hông', unit: 'cm', min: 75, max: 120 },
];

export const DETAIL = [
  { key: 'shoulderCm', label: 'Ngang vai', unit: 'cm', min: 32, max: 48 },
  { key: 'underbustCm', label: 'Vòng chân ngực', unit: 'cm', min: 60, max: 100 },
  { key: 'torsoCm', label: 'Dài thân trên', hint: 'đỉnh vai → eo', unit: 'cm', min: 24, max: 42 },
  { key: 'armCm', label: 'Dài tay', hint: 'vai → cổ tay', unit: 'cm', min: 44, max: 64 },
  { key: 'bicepCm', label: 'Vòng bắp tay', unit: 'cm', min: 20, max: 40 },
  { key: 'thighCm', label: 'Vòng đùi', unit: 'cm', min: 40, max: 70 },
  { key: 'calfCm', label: 'Vòng bắp chân', unit: 'cm', min: 26, max: 46 },
  { key: 'legCm', label: 'Dài chân', hint: 'háng → sàn', unit: 'cm', min: 62, max: 95 },
  { key: 'buttPct', label: 'Độ dày mông', hint: 'trước ↔ sau', unit: '%', min: 85, max: 125, fit: false },
];

export const ALL = [...BASIC, ...DETAIL];

export const DEFAULT_VALUES = {
  heightCm: 160, weightKg: 50, bustCm: 84, waistCm: 64, hipCm: 90,
  // Chi tiết để null = tự động
  shoulderCm: null, underbustCm: null, torsoCm: null, armCm: null,
  bicepCm: null, thighCm: null, calfCm: null, legCm: null, buttPct: null,
};

const round = (v) => Math.round(v * 2) / 2; // làm tròn 0.5 cm
const clampTo = (def, v) => Math.min(def.max, Math.max(def.min, v));

// Ước lượng chỉ số chi tiết từ 5 chỉ số cơ bản.
// Hệ số lấy theo tỉ lệ cơ thể nữ trung bình -> chỉ là gợi ý, người dùng sửa được.
export function estimate(v) {
  const h = v.heightCm;
  const bmi = v.weightKg / (h / 100) ** 2;
  const fullness = Math.sqrt(bmi / 20.5); // > 1: đầy đặn hơn trung bình
  const raw = {
    shoulderCm: 0.235 * h + 0.08 * (v.bustCm - 84),
    underbustCm: v.bustCm - 13,
    torsoCm: 0.2 * h, // chiều cao vai ~0.82h, eo ~0.62h
    armCm: 0.325 * h,
    bicepCm: 26 * fullness,
    thighCm: v.hipCm * 0.58,
    calfCm: 33 * fullness,
    legCm: 0.475 * h,
    buttPct: 100,
  };
  const out = {};
  for (const def of DETAIL) out[def.key] = round(clampTo(def, raw[def.key]));
  return out;
}

// Giá trị thực dùng để dựng avatar: số người nhập, ô trống thì lấy số ước tính
export function effectiveValues(v) {
  const est = estimate(v);
  const out = { ...v };
  for (const def of DETAIL) out[def.key] = v[def.key] ?? est[def.key];
  return out;
}

// Phân loại dáng người từ 3 vòng (+ vai). Kèm 1 mẹo phối đồ ngắn.
export function classifyShape({ bustCm: B, waistCm: W, hipCm: H }) {
  const whr = W / H; // tỉ lệ eo/hông
  const wbr = W / B; // tỉ lệ eo/ngực
  if (wbr >= 0.88 && whr >= 0.85) {
    return { id: 'O', name: 'Quả táo (O)', tip: 'Kéo dài thân: cổ V, áo dáng suông/empire, quần ống đứng.' };
  }
  if (H / B >= 1.05) {
    return { id: 'A', name: 'Quả lê (A)', tip: 'Làm nổi thân trên: áo cổ thuyền, tay phồng; quần/váy chữ A màu tối.' };
  }
  if (B / H >= 1.05) {
    return { id: 'V', name: 'Tam giác ngược (V)', tip: 'Cân lại thân dưới: quần ống rộng, váy xoè; áo cổ V, tránh độn vai.' };
  }
  if (whr <= 0.75 && wbr <= 0.75) {
    return { id: 'X', name: 'Đồng hồ cát (X)', tip: 'Nhấn eo: đầm ôm, váy wrap, thắt lưng.' };
  }
  return { id: 'H', name: 'Chữ nhật (H)', tip: 'Tạo đường cong: thắt lưng, áo peplum, croptop + quần cạp cao.' };
}
