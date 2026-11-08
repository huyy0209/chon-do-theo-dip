// =============================================================
// storage.js — Lưu / tải hồ sơ số đo dạng JSON
// (sau này lên v2 chỉ cần gửi đúng object này vào cột JSONB của PostgreSQL)
// =============================================================
import { ALL, BASIC, DEFAULT_VALUES } from './avatar/measurements.js';

const KEY = 'chon-do.profile.v2';
const OLD_KEY = 'chon-do.profile.v1';
const basicKeys = new Set(BASIC.map((d) => d.key));

// Kiểm tra + kẹp số đo vào khoảng hợp lệ.
// Ô chi tiết bỏ trống/null = tự động; ô cơ bản thiếu -> lấy mặc định.
export function sanitize(input) {
  const out = { ...DEFAULT_VALUES };
  for (const { key, min, max } of ALL) {
    const raw = input?.[key];
    const v = raw === null || raw === '' || raw === undefined ? NaN : Number(raw);
    if (Number.isFinite(v)) out[key] = Math.min(max, Math.max(min, v));
    else if (!basicKeys.has(key)) out[key] = null;
  }
  return out;
}

export function toProfile(name, values) {
  return { version: 2, name: name || 'Hồ sơ của tôi', measurements: values, updatedAt: new Date().toISOString() };
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY); // đọc được cả bản cũ
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { name: p.name, measurements: sanitize(p.measurements) };
  } catch {
    return null;
  }
}

export function saveLocal(profile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); return true; } catch { return false; }
}

export function downloadJson(profile) {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `so-do-${(profile.name || 'avatar').replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function readJsonFile(file) {
  const p = JSON.parse(await file.text());
  if (!p || typeof p !== 'object' || !p.measurements) throw new Error('File không đúng định dạng hồ sơ số đo.');
  return { name: p.name, measurements: sanitize(p.measurements) };
}
