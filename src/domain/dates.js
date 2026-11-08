// =============================================================
// dates.js — Ngày theo giờ Việt Nam (UTC+7), dạng chuỗi 'YYYY-MM-DD'
// So sánh ngày bằng chuỗi -> không lệch múi giờ của máy người dùng
// =============================================================

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});

// Hôm nay theo giờ VN (mốc đổi ngày 00:00 giờ VN)
export function todayVN(now = new Date()) {
  return fmt.format(now); // en-CA cho ra dạng YYYY-MM-DD
}

const toUTC = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
};

// Số ngày từ a tới b (b - a)
export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function isValidDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}

export function formatVN(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
