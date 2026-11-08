// =============================================================
// App.jsx — Khung app: điều hướng bằng hash (#/tu-do, #/dip/<id>...) + thanh tab dưới
// =============================================================
import { useEffect, useState } from 'react';
import { AppStoreProvider, ConfirmDialog, useStore } from './store/AppStore.jsx';
import AvatarPage from './pages/AvatarPage.jsx';
import TuDoPage from './pages/TuDoPage.jsx';
import DipPage from './pages/DipPage.jsx';
import OutfitPage from './pages/OutfitPage.jsx';
import CaiDatPage from './pages/CaiDatPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

const TABS = [
  ['dip', '📅', 'Dịp'],
  ['tu-do', '👗', 'Tủ đồ'],
  ['avatar', '🧍‍♀️', 'Avatar'],
  ['outfit', '✨', 'Outfit'],
  ['cai-dat', '⚙️', 'Cài đặt'],
];

function useHashRoute() {
  // Hash dạng '#tu-do', '#dip-<mã>' (chỉ chữ, số, gạch nối) -> chạy được cả khi nhúng làm artifact
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, '') || 'dip';
    if (h.startsWith('dip-')) return ['dip', `dip_${h.slice(4)}`];
    return h.split('/');
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Shell() {
  const [page, param] = useHashRoute();
  const { toast } = useStore();
  let view;
  if (page === 'avatar') view = <AvatarPage />;
  else if (page === 'tu-do') view = <TuDoPage />;
  else if (page === 'outfit') view = <OutfitPage />;
  else if (page === 'cai-dat') view = <CaiDatPage />;
  else if (page === 'admin') view = <AdminPage />;
  else view = <DipPage id={param} key={param || 'list'} />;
  const active = page === 'admin' ? 'cai-dat' : page;

  return (
    <div className="app">
      <main className="main">{view}</main>
      <nav className="tabbar">
        {TABS.map(([id, icon, label]) => (
          <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}>
            <span>{icon}</span><small>{label}</small>
          </a>
        ))}
      </nav>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <ConfirmDialog />
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <Shell />
    </AppStoreProvider>
  );
}
