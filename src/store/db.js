// =============================================================
// db.js — Lưu dữ liệu trên máy bằng IndexedDB (BR12)
// Giai đoạn 2: thay file này bằng lớp gọi API Node.js, phần còn lại giữ nguyên.
// =============================================================
import { openDB } from 'idb';

// Một số môi trường (khung nhúng, chế độ ẩn danh) không cho dùng IndexedDB -> lỗi được bắt ở AppStore,
// app vẫn chạy nhưng không nhớ dữ liệu sau khi tải lại.
const dbPromise = (async () => openDB('chon-do', 1, {
  upgrade(db) { db.createObjectStore('kv'); },
}))();
dbPromise.catch(() => {});

export async function loadKey(key) {
  return (await dbPromise).get('kv', key);
}

export async function saveKey(key, value) {
  return (await dbPromise).put('kv', value, key);
}

export async function deleteKey(key) {
  return (await dbPromise).delete('kv', key);
}
