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

const DEFAULT_MODEL = `${import.meta.env.BASE_URL}models/${import.meta.env.VITE_MODEL || "avatar.vrm"}`; // theo đường dẫn gốc khi deploy

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

export function ConfirmDialog() {
  const { confirmBox, setConfirmBox } = useStore();
  if (!confirmBox) return null;
  const close = (v) => { confirmBox.resolve(v); setConfirmBox(null); };
  return (
    <div className="modal" onClick={() => close(false)}>
      <div className="modal-box confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body"><p>{confirmBox.message}</p></div>
        <div className="modal-foot actions">
          <button onClick={() => close(false)}>Huỷ</button>
          <button className="primary" onClick={() => close(true)}>{confirmBox.okText}</button>
        </div>
      </div>
    </div>
  );
}

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [today, setToday] = useState(todayVN());
  const [toast, setToast] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_MODEL.endsWith('.json') ? null : DEFAULT_MODEL);
  const [confirmBox, setConfirmBox] = useState(null);

  // Hộp xác nhận trong app (thay window.confirm, vì có nơi chặn hộp thoại của trình duyệt)
  const ask = useCallback((message, okText = 'Đồng ý') => new Promise((resolve) => {
    setConfirmBox({ message, okText, resolve });
  }), []);
  const stateRef = useRef(null);

  // Tải dữ liệu lúc mở app
  useEffect(() => {
    (async () => {
      const parts = await Promise.all(['config', 'profile', 'mon', 'dip', 'outfit'].map((p) => loadKey(`s:${p}`).catch(() => null)));
      const old = parts[0] ? null : await loadKey('state').catch(() => null); // dữ liệu bản cũ (1 khoá)
      const saved = parts[0] ? { config: parts[0], profile: parts[1], mon: parts[2] || [], dip: parts[3] || [], outfit: parts[4] || [] } : old;
      const s = migrate(saved || initialState());
      const synced = dongBoQuaNgay(s, todayVN()); // BR10 khi mở app
      stateRef.current = synced;
      setState(synced);
      const file = await loadKey('avatarFile').catch(() => null);
      if (file) setAvatarUrl(URL.createObjectURL(file));
      else if (DEFAULT_MODEL.endsWith('.json')) {
        // Bản chạy thử: nhân vật mẫu đóng gói dạng base64 trong file JSON (nơi host không phục vụ file .vrm)
        try {
          const { b64 } = await (await fetch(DEFAULT_MODEL)).json();
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          setAvatarUrl(URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' })));
        } catch { /* không có nhân vật mẫu -> app hiện nút chọn file .vrm */ }
      }
    })();
  }, []);

  // Lưu xuống IndexedDB theo TỪNG PHẦN, chỉ phần nào đổi mới ghi (gom 400ms).
  // Kéo số đo không phải ghi lại cả tủ đồ có ảnh -> hết giật.
  const lastSaved = useRef({});
  useEffect(() => {
    if (!state) return undefined;
    const id = setTimeout(() => {
      for (const part of ['config', 'profile', 'mon', 'dip', 'outfit']) {
        if (lastSaved.current[part] !== state[part]) {
          lastSaved.current[part] = state[part];
          saveKey(`s:${part}`, state[part]).catch(() => {});
        }
      }
    }, 400);
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
    await saveKey('avatarFile', file).catch(() => {});
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
    await deleteKey('avatarFile').catch(() => {});
    const s = initialState();
    stateRef.current = s;
    setState(s);
    setAvatarUrl(DEFAULT_MODEL);
  }, []);

  const value = useMemo(() => ({
    state, today, run, notify, toast, avatarUrl, setAvatarFile, exportAll, importAll, resetAll, ask, confirmBox, setConfirmBox,
  }), [state, today, run, notify, toast, avatarUrl, setAvatarFile, exportAll, importAll, resetAll, ask, confirmBox]);

  if (!state) return <div className="boot">Đang mở tủ đồ…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
