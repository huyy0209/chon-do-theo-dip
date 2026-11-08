// =============================================================
// OutfitPage.jsx — Outfit đã lưu / đã chốt / lịch sử đã mặc
// =============================================================
import { useState } from 'react';
import { Empty, OutfitItems } from '../components/ui.jsx';
import { TRANG_THAI_OUTFIT } from '../domain/catalog.js';
import { formatVN } from '../domain/dates.js';
import { xoaOutfit } from '../domain/rules.js';
import { useStore } from '../store/AppStore.jsx';

export default function OutfitPage() {
  const { state, run } = useStore();
  const [tab, setTab] = useState('DA_LUU');
  const dipMap = new Map(state.dip.map((d) => [d.id, d]));
  const list = state.outfit
    .filter((o) => o.trangThai === tab)
    .sort((a, b) => ((b.ngayMac || b.createdAt) > (a.ngayMac || a.createdAt) ? 1 : -1));

  return (
    <div className="page page-scroll">
      <header className="page-head">
        <h1>Outfit</h1>
        <div className="tabs-mini">
          {Object.entries(TRANG_THAI_OUTFIT).map(([k, v]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {v} {state.outfit.filter((o) => o.trangThai === k).length}
            </button>
          ))}
        </div>
      </header>
      {list.length === 0 && (
        <Empty icon="✨" title="Chưa có outfit">
          {tab === 'DA_MAC' ? 'Outfit đã chốt sẽ tự chuyển vào đây khi qua ngày dịp.' : 'Vào một dịp để xem gợi ý và lưu/chốt outfit.'}
        </Empty>
      )}
      {list.map((o) => {
        const dip = dipMap.get(o.dipId);
        return (
          <section key={o.id} className="card">
            <div className="card-title">
              <b>{dip ? <a href={`#/dip/${dip.id}`}>{dip.ten}</a> : 'Chưa gắn dịp'}</b>
              <small>{o.ngayMac ? `Mặc ngày ${formatVN(o.ngayMac)}` : dip ? formatVN(dip.ngay) : o.nguon === 'GOI_Y' ? 'Từ gợi ý' : 'Tự phối'}</small>
            </div>
            <OutfitItems state={state} items={o.mon} />
            {o.trangThai === 'DA_LUU' && (
              <div className="actions">
                <button className="danger" onClick={() => window.confirm('Xoá outfit này?') && run((s) => xoaOutfit(s, o.id), 'Đã xoá outfit')}>Xoá</button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
