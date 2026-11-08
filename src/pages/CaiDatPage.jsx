// =============================================================
// CaiDatPage.jsx — Sao lưu/khôi phục (BR12), vào Quản trị (Q15)
// =============================================================
import { useRef } from 'react';
import { NghiepVuError } from '../domain/rules.js';
import { useStore } from '../store/AppStore.jsx';

export default function CaiDatPage() {
  const { state, exportAll, importAll, resetAll, notify } = useStore();
  const fileRef = useRef(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chon-do-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!window.confirm('Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại trên máy. Tiếp tục?')) return;
    try {
      importAll(JSON.parse(await f.text()));
      notify('Đã khôi phục dữ liệu');
    } catch (err) {
      notify(err instanceof NghiepVuError ? err.message : 'File không đọc được.', 'error');
    }
  };

  return (
    <div className="page page-scroll">
      <header className="page-head"><h1>Cài đặt</h1></header>
      <section className="card">
        <b>Dữ liệu trên máy này</b>
        <p className="muted">
          {state.mon.length} món đồ · {state.dip.length} dịp · {state.outfit.length} outfit.
          Dữ liệu chỉ lưu trên máy (chưa có tài khoản). Đổi máy hoặc xoá trình duyệt thì cần file sao lưu.
        </p>
        <div className="actions">
          <button className="primary" onClick={download}>Sao lưu (xuất JSON)</button>
          <button onClick={() => fileRef.current?.click()}>Khôi phục</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
      </section>
      <section className="card">
        <b>Quản trị</b>
        <p className="muted">Danh mục dịp, kiểu đồ, màu, trọng số chấm điểm.</p>
        <a className="btn" href="#/admin">Mở màn Quản trị ›</a>
      </section>
      <section className="card">
        <b>Cài lên màn hình chính</b>
        <p className="muted">
          Điện thoại: mở menu trình duyệt rồi chọn "Thêm vào màn hình chính" (Safari: nút Chia sẻ). App sẽ mở như ứng dụng và dùng được khi không có mạng.
        </p>
      </section>
      <section className="card">
        <b>Xoá toàn bộ dữ liệu</b>
        <div className="actions">
          <button className="danger" onClick={() => window.confirm('Xoá hết tủ đồ, dịp, outfit, số đo trên máy này?') && resetAll().then(() => notify('Đã xoá dữ liệu'))}>
            Xoá dữ liệu
          </button>
        </div>
      </section>
    </div>
  );
}
