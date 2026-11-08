// =============================================================
// measurements.js — Định nghĩa số đo, ước lượng ô bỏ trống, phân loại dáng người
// -------------------------------------------------------------
// Cơ bản (bắt buộc): chiều cao, cân nặng, 3 vòng
// Chi tiết (không bắt buộc): để trống (null) -> tự ước tính theo tỉ lệ cơ thể trung bình
// 'fit: false' = không dùng để đo lại trên avatar (cân nặng, độ dày mông)
// =============================================================

// min/max = giới hạn TUYỆT ĐỐI cho ô nhập (rộng, cho cả người ngoại cỡ)
// r = khoảng THƯỜNG GẶP theo tỉ lệ chiều cao [thấp, cao] -> dùng cho thanh trượt và cảnh báo (BR14)
export const BASIC = [
  { key: 'heightCm', label: 'Chiều cao', unit: 'cm', min: 130, max: 200, typ: [140, 190] },
  { key: 'weightKg', label: 'Cân nặng', unit: 'kg', min: 30, max: 150, fit: false, bmi: [16, 35] },
  { key: 'bustCm', label: 'Vòng ngực', unit: 'cm', min: 60, max: 150, r: [0.42, 0.72] },
  { key: 'waistCm', label: 'Vòng eo', unit: 'cm', min: 45, max: 150, r: [0.33, 0.62] },
  { key: 'hipCm', label: 'Vòng hông', unit: 'cm', min: 65, max: 160, r: [0.48, 0.75] },
];

export const DETAIL = [
  { key: 'shoulderCm', label: 'Ngang vai', unit: 'cm', min: 28, max: 55, r: [0.21, 0.27] },
  { key: 'underbustCm', label: 'Vòng chân ngực', unit: 'cm', min: 55, max: 135, r: [0.37, 0.62] },
  { key: 'torsoCm', label: 'Dài thân trên', hint: 'đỉnh vai → eo', unit: 'cm', min: 22, max: 48, r: [0.17, 0.23] },
  { key: 'armCm', label: 'Dài tay', hint: 'vai → cổ tay', unit: 'cm', min: 40, max: 72, r: [0.29, 0.36] },
  { key: 'bicepCm', label: 'Vòng bắp tay', unit: 'cm', min: 18, max: 50, r: [0.13, 0.24] },
  { key: 'thighCm', label: 'Vòng đùi', unit: 'cm', min: 35, max: 90, r: [0.26, 0.42] },
  { key: 'calfCm', label: 'Vòng bắp chân', unit: 'cm', min: 24, max: 55, r: [0.18, 0.28] },
  { key: 'legCm', label: 'Dài chân', hint: 'háng → sàn', unit: 'cm', min: 55, max: 105, r: [0.42, 0.52] },
  { key: 'buttPct', label: 'Độ dày mông', hint: 'trước ↔ sau', unit: '%', min: 80, max: 130, fit: false, typ: [85, 125] },
];

export const ALL = [...BASIC, ...DETAIL];

export const DEFAULT_VALUES = {
  heightCm: 160, weightKg: 50, bustCm: 84, waistCm: 64, hipCm: 90,
  // Chi tiết để null = tự động
  shoulderCm: null, underbustCm: null, torsoCm: null, armCm: null,
  bicepCm: null, thighCm: null, calfCm: null, legCm: null, buttPct: null,
};

const round = (v) => Math.round(v * 2) / 2; // làm tròn 0.5 cm
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const BY_KEY = {};

/** Khoảng thường gặp của 1 số đo với chiều cao/cân nặng hiện tại (P1 – thanh trượt co giãn) */
export function typicalRange(def, v) {
  const h = clamp(v?.heightCm ?? 160, 130, 200);
  let lo, hi;
  if (def.r) [lo, hi] = def.r.map((x) => x * h);
  else if (def.bmi) [lo, hi] = def.bmi.map((b) => b * (h / 100) ** 2);
  else [lo, hi] = def.typ;
  return [Math.max(def.min, Math.round(lo)), Math.min(def.max, Math.round(hi))];
}
const clampTo = (def, x, v) => { const [lo, hi] = typicalRange(def, v); return clamp(x, lo, hi); };

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
  for (const def of DETAIL) out[def.key] = round(clampTo(def, raw[def.key], v));
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

for (const d of [...BASIC, ...DETAIL]) BY_KEY[d.key] = d;
const fmt = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');

/**
 * BR14 – Kiểm tra bộ số đo (trên giá trị hiệu lực: số nhập + số ước tính).
 * block: không thể có ở người thật -> chặn lưu.  warn: hiếm nhưng có thật -> vẫn lưu, báo vàng.
 */
export function validateMeasurements(v) {
  const e = effectiveValues(v);
  const block = [], warn = [];
  for (const d of ALL) {
    const x = v[d.key];
    if (x == null || !Number.isFinite(x)) continue;
    if (x < d.min || x > d.max) block.push({ key: d.key, code: 'BR14', msg: `${d.label} phải trong khoảng ${d.min}–${d.max} ${d.unit}.` });
  }
  if (e.underbustCm > e.bustCm - 2) block.push({ key: 'underbustCm', code: 'BR14', msg: 'Vòng chân ngực phải nhỏ hơn vòng ngực ít nhất 2 cm.' });
  if (e.calfCm >= e.thighCm) block.push({ key: 'calfCm', code: 'BR14', msg: 'Vòng bắp chân không thể lớn hơn hoặc bằng vòng đùi.' });
  if (e.bicepCm >= e.thighCm) block.push({ key: 'bicepCm', code: 'BR14', msg: 'Vòng bắp tay không thể lớn hơn hoặc bằng vòng đùi.' });
  if (e.legCm > e.heightCm * 0.6) block.push({ key: 'legCm', code: 'BR14', msg: 'Dài chân không thể quá 60% chiều cao.' });
  if (e.torsoCm + e.legCm > e.heightCm * 0.82) block.push({ key: 'torsoCm', code: 'BR14', msg: 'Dài thân trên + dài chân vượt quá chiều cao cơ thể.' });

  for (const d of ALL) {
    const x = v[d.key];
    if (x == null) continue;
    const [lo, hi] = typicalRange(d, e);
    if (x < lo || x > hi) warn.push({ key: d.key, msg: `${d.label} ${fmt(x)} ngoài khoảng thường gặp (${lo}–${hi}) với chiều cao ${e.heightCm} cm.` });
  }
  if (e.waistCm > e.hipCm * 1.05) warn.push({ key: 'waistCm', msg: 'Eo lớn hơn hông (dáng quả táo): avatar vẫn hiển thị được.' });
  if (e.thighCm > e.hipCm * 0.6) warn.push({ key: 'thighCm', msg: 'Đùi lớn so với hông: avatar sẽ thu đùi lại khi hiển thị.' });
  return { block, warn, ok: block.length === 0 };
}

// Kẹp mềm: vượt ngưỡng thì bị "hãm" dần, tối đa thêm ~6%, không cắt cụt đột ngột
function soft(x, lo, hi) {
  if (x > hi) { const s = 0.06 * hi; return hi + s * Math.tanh((x - hi) / s); }
  if (x < lo) { const s = 0.06 * lo; return lo - s * Math.tanh((lo - x) / s); }
  return x;
}

/**
 * P3 – Số đo dùng để HIỂN THỊ avatar (số thật vẫn lưu nguyên).
 * Kẹp mềm vào khoảng thường gặp + sửa các cặp số làm hình bị đâm xuyên.
 * @returns {{ values, notes: string[] }}
 */
export function toDisplay(v, minShoulderFn = null) {
  const e = effectiveValues(v);
  const d = { ...e };
  for (const def of ALL) {
    if (def.key === 'weightKg') continue;
    const [lo, hi] = typicalRange(def, e);
    d[def.key] = soft(e[def.key], lo, hi);
  }
  d.underbustCm = Math.min(d.underbustCm, d.bustCm - 3);
  d.thighCm = Math.min(d.thighCm, d.hipCm * 0.6); // 2 đùi không rộng hơn chậu
  d.calfCm = Math.min(d.calfCm, d.thighCm * 0.82);
  d.bicepCm = Math.min(d.bicepCm, d.thighCm * 0.62);
  d.waistCm = Math.min(d.waistCm, Math.max(d.bustCm, d.hipCm) * 1.08);
  if (minShoulderFn) d.shoulderCm = Math.max(d.shoulderCm, minShoulderFn(d));
  const notes = [];
  for (const def of ALL) {
    const a = e[def.key], b = d[def.key];
    if (Math.abs(a - b) >= 0.5) notes.push(`${def.label} hiển thị ${fmt(b)} (số thật ${fmt(a)}) để giữ dáng cân đối.`);
  }
  return { values: d, notes };
}
