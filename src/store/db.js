// =============================================================
// db.js — Lưu dữ liệu trên máy bằng IndexedDB (BR12)
// Giai đoạn 2: thay file này bằng lớp gọi API Node.js, phần còn lại giữ nguyên.
// =============================================================
import { openDB } from 'idb';

const dbPromise = openDB('chon-do', 1, {
  upgrade(db) { db.createObjectStore('kv'); },
});

export async function loadKey(key) {
  return (await dbPromise).get('kv', key);
}

export async function saveKey(key, value) {
  return (await dbPromise).put('kv', value, key);
}

export async function deleteKey(key) {
  return (await dbPromise).delete('kv', key);
}
