// =============================================================
// keyboard.js — Ô nhập không bị bàn phím điện thoại che
//  - Theo dõi visualViewport (phần màn hình còn thấy khi bàn phím mở) -> biến CSS --vvh, --vvt
//  - Khi đang gõ trên máy cảm ứng: thêm class 'kb-open' (ẩn thanh tab, thu nhỏ sân khấu 3D)
//  - Ô vừa chạm được cuộn ra giữa vùng còn thấy
// =============================================================
const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches;
const isField = (el) => el && (/^(TEXTAREA|SELECT)$/.test(el.tagName)
  || (el.tagName === 'INPUT' && !/^(range|checkbox|radio|file|color|button|submit)$/.test(el.type)));

export function installViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const update = () => {
    const h = vv ? vv.height : window.innerHeight;
    root.style.setProperty('--vvh', `${Math.round(h)}px`);
    root.style.setProperty('--vvt', `${Math.round(vv ? vv.offsetTop : 0)}px`);
    const kb = window.innerHeight - h > 120; // iOS: bàn phím phủ lên trang
    document.body.classList.toggle('kb-open', isTouch() && (kb || isField(document.activeElement)));
  };
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', () => setTimeout(update, 50));
  document.addEventListener('focusout', () => setTimeout(update, 150));
  update();
}

// Gắn vào onFocus của ô nhập: chờ bàn phím mở xong rồi cuộn ô ra giữa
export function focusIntoView(e) {
  const el = e.currentTarget;
  if (!isTouch()) return;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
}
