// =============================================================
// AppStore.jsx — Trạng thái dùng chung toàn app
// Mọi thay đổi đi qua run(fn): fn là hàm nghiệp vụ thuần (domain/rules.js).
// Vi phạm luật -> hiện thông báo lỗi, không đổi dữ liệu.
// =============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { chatLieuMacDinh, defaultConfig } from '../domain/catalog.js';
import { todayVN } from '../domain/dates.js';
import { NghiepVuError, dongBoQuaNgay, validateConfig } from '../domain/rules.js';
import { DEFAULT_VALUES } from '../avatar/measurements.js';
import { loadLocal, sanitize } from '../storage.js';
import { deleteKey, loadKey, saveKey } from './db.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const DEFAULT_MODEL = `${import.meta.env.BASE_URL}models/avatar.vrm`; // theo đường dẫn gốc khi deploy

function initialState() {
  const old = loadLocal(); // hồ sơ số đo từ bản avatar trước (localStorage)
  return {
    config: defaultConfig(),
    profile: { name: old?.name || 'Hồ sơ của tôi', measurements: old?.measurements || DEFAULT_VALUES },
    mon: [], dip: [], outfit: [],
  };
}

// Nâng cấp dữ liệu cũ: kiểu đồ chưa có "mẫu 3D" -> gán theo id
function migrate(s) {
  if (s.config.kieuDo.every((k) => k.mau3d && k.chatLieu)) return s;
  return {
    ...s,
    config: {
      ...s.config,
      kieuDo: s.config.kieuDo.map((k) => ({ mau3d: k.id, chatLieu: chatLieuMacDinh(k.id, k.loai), ...k })),
    },
  };
}

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [today, setToday] = useState(todayVN());
  const [toast, setToast] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_MODEL);
  const stateRef = useRef(null);

  // Tải dữ liệu lúc mở app
  useEffect(() => {
    (async () => {
      const saved = await loadKey('state');
      const s = migrate(saved || initialState());
      const synced = dongBoQuaNgay(s, todayVN()); // BR10 khi mở app
      stateRef.current = synced;
      setState(synced);
      const file = await loadKey('avatarFile');
      if (file) setAvatarUrl(URL.createObjectURL(file));
    })();
  }, []);

  // Lưu xuống IndexedDB mỗi khi state đổi (gom lại 300ms)
  useEffect(() => {
    if (!state) return undefined;
    const id = setTimeout(() => saveKey('state', state), 300);
    return () => clearTimeout(id);
  }, [state]);

  // Mỗi phút kiểm tra đổi ngày (giờ VN) -> chạy BR10
  useEffect(() => {
    const id = setInterval(() => setToday(todayVN()), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!stateRef.current) return;
    const next = dongBoQuaNgay(stateRef.current, today);
    if (next !== stateRef.current) { stateRef.current = next; setState(next); }
  }, [today]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), toast.type === 'error' ? 3500 : 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const notify = useCallback((msg, type = 'ok') => setToast({ msg, type }), []);

  /**
   * Chạy 1 thao tác nghiệp vụ. fn(state) trả state mới hoặc { state, ...extra }.
   * Trả về extra (vd outfit vừa tạo) hoặc null nếu bị chặn.
   */
  const run = useCallback((fn, okMsg) => {
    try {
      const res = fn(stateRef.current);
      const next = res && res.config ? res : res.state;
      stateRef.current = next;
      setState(next);
      if (okMsg) notify(okMsg);
      return res.state ? res : { state: next };
    } catch (e) {
      if (e instanceof NghiepVuError) { notify(e.message, 'error'); return null; }
      throw e;
    }
  }, [notify]);

  // Đổi file nhân vật: lưu luôn vào máy để lần sau mở lại vẫn còn
  const setAvatarFile = useCallback(async (file) => {
    await saveKey('avatarFile', file);
    setAvatarUrl((old) => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  }, []);

  // BR12: xuất / nhập toàn bộ dữ liệu 1 file JSON
  const exportAll = useCallback(() => ({
    app: 'chon-do-theo-dip', version: 2, exportedAt: new Date().toISOString(), data: stateRef.current,
  }), []);

  const importAll = useCallback((json) => {
    const d = json?.data;
    if (json?.app !== 'chon-do-theo-dip' || !d?.config || !Array.isArray(d.mon) || !Array.isArray(d.dip) || !Array.isArray(d.outfit)) {
      throw new NghiepVuError('BR12', 'File không phải bản sao lưu của app.');
    }
    validateConfig(d.config);
    const next = dongBoQuaNgay({
      ...d,
      profile: { name: d.profile?.name || 'Hồ sơ của tôi', measurements: sanitize(d.profile?.measurements) },
    }, todayVN());
    stateRef.current = next;
    setState(next);
  }, []);

  const resetAll = useCallback(async () => {
    await deleteKey('avatarFile');
    const s = initialState();
    stateRef.current = s;
    setState(s);
    setAvatarUrl(DEFAULT_MODEL);
  }, []);

  const value = useMemo(() => ({
    state, today, run, notify, toast, avatarUrl, setAvatarFile, exportAll, importAll, resetAll,
  }), [state, today, run, notify, toast, avatarUrl, setAvatarFile, exportAll, importAll, resetAll]);

  if (!state) return <div className="boot">Đang mở tủ đồ…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
