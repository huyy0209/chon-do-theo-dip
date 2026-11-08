// =============================================================
// recommend.js — Gợi ý outfit bằng luật + chấm điểm (Q6, BR03–BR08)
// Hàm thuần: cùng đầu vào -> cùng kết quả, test được, chạy offline.
// =============================================================
import { VI_TRI, byId, lanMacCuoi, soNgayTuLanMac } from './rules.js';

// Độ lệch trang trọng so với khoảng [min, max] của dịp
const lech = (tt, { min, max }) => (tt < min ? min - tt : tt > max ? tt - max : 0);

/**
 * BR05 – Chấm điểm 1 outfit (thang 100). Chỉ làm tròn ở bước cuối.
 * items: [{ trangTrong, hopDang: {X..O}, trungTinh, mauId, soNgayTuLanMac }]
 */
export function scoreOutfit(items, { range, dang, trongSo, ngayMoi }) {
  // Hợp dịp: trong khoảng = 1, lệch 1 = 0.5 (lệch ≥2 đã bị loại trước đó - BR04)
  const hopDip = items.reduce((s, it) => s + (lech(it.trangTrong, range) === 0 ? 1 : 0.5), 0) / items.length;
  // Hợp dáng: trung bình -1..1 quy về 0..1
  const tbDang = items.reduce((s, it) => s + (it.hopDang?.[dang] ?? 0), 0) / items.length;
  const hopDang = (tbDang + 1) / 2;
  // Hợp màu: số màu nổi (không trung tính) khác nhau
  const mauNoi = new Set(items.filter((it) => !it.trungTinh).map((it) => it.mauId)).size;
  const hopMau = mauNoi <= 2 ? 1 : mauNoi === 3 ? 0.5 : 0;
  // Độ mới: mỗi món mặc trong N ngày gần đây trừ 1/3
  const ganDay = items.filter((it) => it.soNgayTuLanMac >= 0 && it.soNgayTuLanMac < ngayMoi).length;
  const moi = Math.max(0, 1 - ganDay / 3);

  const chiTiet = {
    dip: trongSo.dip * hopDip,
    dang: trongSo.dang * hopDang,
    mau: trongSo.mau * hopMau,
    moi: trongSo.moi * moi,
  };
  const tong = chiTiet.dip + chiTiet.dang + chiTiet.mau + chiTiet.moi;
  return { diem: Math.round(tong), diemThuc: tong, chiTiet, mauNoi, ganDay };
}

const keyBatBuoc = (ids) => [...ids].sort().join('|');

/**
 * Gợi ý top N outfit cho 1 dịp.
 * @returns {{ outfits: Array, thieu: string[] }}
 */
export function recommend(state, { dip, dang, today, limit = 3 }) {
  const { config } = state;
  const loaiDip = config.loaiDip.find((l) => l.id === dip.loaiDipId);
  const range = { min: loaiDip.min, max: loaiDip.max };
  const kieuMap = byId(config.kieuDo);
  const mauMap = byId(config.mau);
  const macCuoi = lanMacCuoi(state);

  // BR03: chỉ món Đang dùng. BR04: loại món lệch trang trọng ≥ 2
  const ungVien = state.mon
    .filter((m) => m.trangThai === 'DANG_DUNG' && kieuMap.has(m.kieuId))
    .filter((m) => lech(m.trangTrong, range) < 2)
    .map((m) => {
      const kieu = kieuMap.get(m.kieuId);
      return {
        mon: m,
        viTri: VI_TRI[kieu.loai],
        trangTrong: m.trangTrong,
        hopDang: kieu.hopDang,
        mauId: m.mauId,
        trungTinh: mauMap.get(m.mauId)?.trungTinh ?? true,
        soNgayTuLanMac: soNgayTuLanMac(macCuoi.get(m.id), today),
        createdAt: m.createdAt,
      };
    });
  const nhom = (vt) => ungVien.filter((u) => u.viTri === vt);
  const ao = nhom('AO'), duoi = nhom('DUOI'), dam = nhom('DAM'), giay = nhom('GIAY');
  const tuyChon = { AO_KHOAC: nhom('AO_KHOAC'), TUI: nhom('TUI'), PHU_KIEN: nhom('PHU_KIEN') };

  // BR08: báo thiếu đồ
  const thieu = [];
  const tenDip = `${loaiDip.ten} (trang trọng ${range.min}–${range.max})`;
  if (!giay.length) thieu.push(`Chưa có giày hợp dịp ${tenDip}.`);
  if (!dam.length && !(ao.length && duoi.length)) {
    if (!ao.length && !duoi.length) thieu.push(`Chưa có áo + quần/chân váy hoặc đầm hợp dịp ${tenDip}.`);
    else if (!ao.length) thieu.push(`Chưa có áo hợp dịp ${tenDip} (hoặc thêm 1 đầm liền).`);
    else thieu.push(`Chưa có quần/chân váy hợp dịp ${tenDip} (hoặc thêm 1 đầm liền).`);
  }
  if (thieu.length) return { outfits: [], thieu };

  // BR07: bộ trùng hệt (các món bắt buộc) với bộ Đã mặc trong N ngày -> loại
  const trungGanDay = new Set(
    state.outfit
      .filter((o) => o.trangThai === 'DA_MAC' && soNgayTuLanMac(o.ngayMac, today) < config.nguong.ngayTrung)
      .map((o) => keyBatBuoc(o.mon.filter((x) => ['AO', 'DUOI', 'DAM', 'GIAY'].includes(x.viTri)).map((x) => x.monId))),
  );

  const ctx = { range, dang, trongSo: config.trongSo, ngayMoi: config.nguong.ngayMoi };

  // Bộ khung bắt buộc: (áo + dưới | đầm) + giày
  const khung = [];
  for (const g of giay) {
    for (const d of dam) khung.push([d, g]);
    for (const a of ao) for (const d of duoi) khung.push([a, d, g]);
  }

  let biLoaiVITrung = 0;
  const ketQua = [];
  for (const base of khung) {
    if (trungGanDay.has(keyBatBuoc(base.map((u) => u.mon.id)))) { biLoaiVITrung++; continue; }
    // Thêm món tuỳ chọn kiểu tham lam: chỉ thêm nếu làm điểm tăng (BR01: khoác ≤1, túi ≤1, phụ kiện ≤2)
    let items = base;
    let best = scoreOutfit(items, ctx);
    for (const [vt, max] of [['AO_KHOAC', 1], ['TUI', 1], ['PHU_KIEN', 2]]) {
      for (let lan = 0; lan < max; lan++) {
        let chon = null;
        for (const u of tuyChon[vt]) {
          if (items.includes(u)) continue;
          const s = scoreOutfit([...items, u], ctx);
          if (s.diemThuc > best.diemThuc + 1e-9 && (!chon || s.diemThuc > chon.s.diemThuc)) chon = { u, s };
        }
        if (!chon) break;
        items = [...items, chon.u];
        best = chon.s;
      }
    }
    // BR06: tiêu chí phụ khi đồng điểm
    const tongNgay = items.reduce((s, u) => s + Math.min(u.soNgayTuLanMac, 3650), 0);
    const tongTao = items.reduce((s, u) => s + Date.parse(u.createdAt || 0), 0);
    ketQua.push({ items, ...best, tongNgay, tongTao });
  }

  if (!ketQua.length) {
    return { outfits: [], thieu: [`Các bộ hợp lệ đều trùng bộ đã mặc trong ${config.nguong.ngayTrung} ngày gần đây (${biLoaiVITrung} bộ). Thêm đồ mới hoặc chờ thêm vài ngày.`] };
  }

  // BR06: điểm cao trước -> lâu chưa mặc hơn -> món thêm vào tủ sớm hơn
  ketQua.sort((a, b) => b.diemThuc - a.diemThuc || b.tongNgay - a.tongNgay || a.tongTao - b.tongTao);

  return {
    thieu: [],
    outfits: ketQua.slice(0, limit).map((r) => ({
      diem: r.diem,
      chiTiet: r.chiTiet,
      mauNoi: r.mauNoi,
      ganDay: r.ganDay,
      mon: r.items.map((u) => ({ viTri: u.viTri, monId: u.mon.id })),
    })),
  };
}
