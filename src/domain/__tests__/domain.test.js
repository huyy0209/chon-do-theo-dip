// =============================================================
// Test nghiệp vụ: mỗi BR có ít nhất 1 ca đúng + 1 ca vi phạm (bảng truy vết mục 7)
// Chạy: npm test
// =============================================================
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../catalog.js';
import { daysBetween, todayVN } from '../dates.js';
import {
  NghiepVuError, boChot, capNhatConfig, chatLieuCua, chotOutfit, chuyenTrangThaiMon, dongBoQuaNgay, luuOutfit,
  themDip, themMon, validateConfig, validateOutfit, xoaMon, xoaOutfit,
} from '../rules.js';
import { recommend, scoreOutfit } from '../recommend.js';

const TODAY = '2026-11-08';
const T0 = new Date('2026-11-01T00:00:00Z');

const empty = () => ({ config: defaultConfig(), profile: null, mon: [], dip: [], outfit: [] });

// Thêm nhanh 1 món, trả [state, id]
function add(state, kieuId, mauId, extra = {}) {
  const s = themMon(state, { kieuId, mauId, ...extra }, T0);
  return [s, s.mon[s.mon.length - 1].id];
}

// Mã lỗi nghiệp vụ của 1 hàm
const codeOf = (fn) => {
  try { fn(); } catch (e) { if (e instanceof NghiepVuError) return e.code; throw e; }
  return null;
};

function tuDoCoBan() {
  let s = empty();
  const ids = {};
  [s, ids.aoThun] = add(s, 'ao_thun', 'trang');
  [s, ids.soMi] = add(s, 'so_mi', 'trang');
  [s, ids.jean] = add(s, 'quan_skinny', 'denim');
  [s, ids.vayA] = add(s, 'vay_chu_a', 'navy');
  [s, ids.damWrap] = add(s, 'dam_wrap', 'do');
  [s, ids.sneaker] = add(s, 'giay_the_thao', 'trang');
  [s, ids.bupBe] = add(s, 'giay_bup_be', 'be');
  [s, ids.caoGot] = add(s, 'cao_got', 'den');
  return { s, ids };
}

describe('dates', () => {
  it('todayVN đổi ngày lúc 00:00 giờ VN (UTC+7)', () => {
    expect(todayVN(new Date('2026-11-08T16:59:59Z'))).toBe('2026-11-08');
    expect(todayVN(new Date('2026-11-08T17:00:00Z'))).toBe('2026-11-09');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
  });
});

describe('BR02 + RB01 – thêm món đồ', () => {
  it('đúng: tự đặt tên và trang trọng theo kiểu', () => {
    const [s] = add(empty(), 'so_mi', 'trang');
    expect(s.mon[0]).toMatchObject({ ten: 'Sơ mi trắng', trangTrong: 3, trangThai: 'DANG_DUNG' });
  });
  it('vi phạm: thiếu kiểu hoặc màu', () => {
    expect(codeOf(() => themMon(empty(), { mauId: 'trang' }))).toBe('BR02');
    expect(codeOf(() => themMon(empty(), { kieuId: 'so_mi' }))).toBe('BR02');
  });
  it('chất liệu: để trống = theo kiểu; chọn riêng được; sai danh sách bị chặn (RB06)', () => {
    const [s1] = add(empty(), 'so_mi', 'trang');
    expect(s1.mon[0].chatLieu).toBeNull();
    expect(chatLieuCua(s1.mon[0], s1.config.kieuDo.find((k) => k.id === 'so_mi'))).toBe('cotton');
    const [s2] = add(empty(), 'so_mi', 'trang', { chatLieu: 'lua' });
    expect(chatLieuCua(s2.mon[0], s2.config.kieuDo.find((k) => k.id === 'so_mi'))).toBe('lua');
    expect(codeOf(() => themMon(empty(), { kieuId: 'so_mi', mauId: 'trang', chatLieu: 'nhua' }))).toBe('RB06');
  });
  it('vi phạm RB01: trang trọng ngoài 1–5', () => {
    expect(codeOf(() => themMon(empty(), { kieuId: 'so_mi', mauId: 'trang', trangTrong: 6 }))).toBe('RB01');
  });
});

describe('BR01 – outfit hợp lệ', () => {
  const { s, ids } = tuDoCoBan();
  it('đúng: áo + quần + giày; đầm + giày', () => {
    expect(validateOutfit([ids.soMi, ids.jean, ids.sneaker], s)).toHaveLength(3);
    expect(validateOutfit([ids.damWrap, ids.caoGot], s)).toHaveLength(2);
  });
  it('vi phạm: thiếu giày / đầm kèm áo / 2 giày', () => {
    expect(codeOf(() => validateOutfit([ids.soMi, ids.jean], s))).toBe('BR01');
    expect(codeOf(() => validateOutfit([ids.damWrap, ids.soMi, ids.caoGot], s))).toBe('BR01');
    expect(codeOf(() => validateOutfit([ids.soMi, ids.jean, ids.sneaker, ids.caoGot], s))).toBe('BR01');
  });
  it('vi phạm: quá 2 phụ kiện', () => {
    let st = s; let p1; let p2; let p3;
    [st, p1] = add(st, 'mu', 'den'); [st, p2] = add(st, 'that_lung', 'nau'); [st, p3] = add(st, 'trang_suc', 'vang');
    expect(codeOf(() => validateOutfit([ids.soMi, ids.jean, ids.sneaker, p1, p2, p3], st))).toBe('BR01');
  });
});

describe('BR05 – chấm điểm', () => {
  const base = { range: { min: 3, max: 4 }, dang: 'A', trongSo: { dip: 40, dang: 25, mau: 20, moi: 15 }, ngayMoi: 7 };
  it('ví dụ tính tay trong bản chốt = 91 điểm', () => {
    const items = [
      { trangTrong: 3, hopDang: { A: 1 }, mauId: 'trang', trungTinh: true, soNgayTuLanMac: 3 }, // sơ mi mặc 3 ngày trước
      { trangTrong: 3, hopDang: { A: 1 }, mauId: 'navy', trungTinh: true, soNgayTuLanMac: Infinity },
      { trangTrong: 3, hopDang: { A: 0 }, mauId: 'be', trungTinh: true, soNgayTuLanMac: Infinity },
    ];
    const r = scoreOutfit(items, base);
    expect(r.chiTiet.dip).toBeCloseTo(40);
    expect(r.chiTiet.dang).toBeCloseTo(20.833, 2);
    expect(r.chiTiet.mau).toBeCloseTo(20);
    expect(r.chiTiet.moi).toBeCloseTo(10);
    expect(r.diem).toBe(91);
  });
  it('3 màu nổi chỉ được nửa điểm màu, 4 màu = 0', () => {
    const mk = (mauId) => ({ trangTrong: 3, hopDang: {}, mauId, trungTinh: false, soNgayTuLanMac: Infinity });
    expect(scoreOutfit([mk('do'), mk('vang'), mk('tim')], base).chiTiet.mau).toBeCloseTo(10);
    expect(scoreOutfit([mk('do'), mk('vang'), mk('tim'), mk('cam')], base).chiTiet.mau).toBe(0);
  });
  it('lệch 1 bậc trang trọng được 0.5 điểm dịp', () => {
    const it2 = { trangTrong: 2, hopDang: {}, mauId: 'den', trungTinh: true, soNgayTuLanMac: Infinity };
    expect(scoreOutfit([it2], base).chiTiet.dip).toBeCloseTo(20);
  });
});

describe('BR03/BR04/BR08 – gợi ý', () => {
  const dipCuoi = { id: 'd1', loaiDipId: 'dam_cuoi', ngay: TODAY }; // trang trọng 4–5
  it('BR04 đúng: đám cưới chọn đầm wrap + cao gót, không có áo thun (lệch ≥2)', () => {
    const { s, ids } = tuDoCoBan();
    const r = recommend(s, { dip: dipCuoi, dang: 'A', today: TODAY });
    expect(r.thieu).toEqual([]);
    const all = r.outfits.flatMap((o) => o.mon.map((x) => x.monId));
    expect(all).toContain(ids.damWrap);
    expect(all).not.toContain(ids.aoThun);
    expect(all).not.toContain(ids.sneaker);
  });
  it('BR03 vi phạm: món Tạm cất không được gợi ý', () => {
    const { s, ids } = tuDoCoBan();
    const s2 = chuyenTrangThaiMon(s, ids.caoGot, 'TAM_CAT');
    const r = recommend(s2, { dip: dipCuoi, dang: 'A', today: TODAY });
    expect(r.outfits.flatMap((o) => o.mon.map((x) => x.monId))).not.toContain(ids.caoGot);
  });
  it('BR08: thiếu giày hợp dịp thì báo rõ', () => {
    let s = empty(); [s] = add(s, 'dam_wrap', 'do'); [s] = add(s, 'giay_the_thao', 'trang');
    const r = recommend(s, { dip: dipCuoi, dang: 'A', today: TODAY });
    expect(r.outfits).toEqual([]);
    expect(r.thieu[0]).toMatch(/Chưa có giày hợp dịp Đám cưới/);
  });
  it('BR08: tủ trống báo thiếu cả thân và giày', () => {
    const r = recommend(empty(), { dip: dipCuoi, dang: 'A', today: TODAY });
    expect(r.thieu).toHaveLength(2);
  });
});

describe('BR06 – top 3 và đồng điểm', () => {
  it('top 3 khác nhau ở món bắt buộc, sắp theo điểm giảm dần', () => {
    const { s } = tuDoCoBan();
    const r = recommend(s, { dip: { loaiDipId: 'cafe', ngay: TODAY }, dang: 'H', today: TODAY });
    expect(r.outfits.length).toBe(3);
    const keys = r.outfits.map((o) => o.mon.filter((x) => x.viTri !== 'PHU_KIEN').map((x) => x.monId).sort().join());
    expect(new Set(keys).size).toBe(3);
    expect(r.outfits[0].diem).toBeGreaterThanOrEqual(r.outfits[1].diem);
  });
  it('đồng điểm: ưu tiên bộ lâu chưa mặc hơn', () => {
    // 2 áo thun cùng kiểu, cùng màu -> cùng điểm; áo B mặc 10 ngày trước, áo A mặc 30 ngày trước
    let s = empty(); let a; let b; let q; let g;
    [s, a] = add(s, 'ao_thun', 'trang'); [s, b] = add(s, 'ao_thun', 'trang');
    [s, q] = add(s, 'quan_jogger', 'den'); [s, g] = add(s, 'giay_the_thao', 'trang');
    s = { ...s, outfit: [
      { id: 'o1', trangThai: 'DA_MAC', ngayMac: '2026-10-09', mon: [{ viTri: 'AO', monId: a }] },
      { id: 'o2', trangThai: 'DA_MAC', ngayMac: '2026-10-29', mon: [{ viTri: 'AO', monId: b }] },
    ] };
    const r = recommend(s, { dip: { loaiDipId: 'o_nha', ngay: TODAY }, dang: 'H', today: TODAY });
    expect(r.outfits[0].mon.find((x) => x.viTri === 'AO').monId).toBe(a);
    expect(q && g).toBeTruthy();
  });
});

describe('BR07 – chống lặp bộ đã mặc', () => {
  function caseWith(ngayMac) {
    let s = empty(); let a; let q; let g;
    [s, a] = add(s, 'ao_thun', 'trang'); [s, q] = add(s, 'quan_jogger', 'den'); [s, g] = add(s, 'giay_the_thao', 'trang');
    s = { ...s, outfit: [{ id: 'o1', trangThai: 'DA_MAC', ngayMac, mon: [
      { viTri: 'AO', monId: a }, { viTri: 'DUOI', monId: q }, { viTri: 'GIAY', monId: g }] }] };
    return recommend(s, { dip: { loaiDipId: 'o_nha', ngay: TODAY }, dang: 'H', today: TODAY });
  }
  it('vi phạm: bộ trùng hệt mặc 13 ngày trước bị loại', () => {
    const r = caseWith('2026-10-26');
    expect(r.outfits).toEqual([]);
    expect(r.thieu[0]).toMatch(/trùng bộ đã mặc/);
  });
  it('đúng: mặc đã 14 ngày thì được gợi ý lại', () => {
    expect(caseWith('2026-10-25').outfits).toHaveLength(1);
  });
});

describe('BR09/BR10 – chốt outfit và qua ngày', () => {
  function setup() {
    const { s, ids } = tuDoCoBan();
    let st = themDip(s, { loaiDipId: 'di_lam', ngay: '2026-11-10' }, TODAY);
    const dipId = st.dip[0].id;
    const r1 = luuOutfit(st, [ids.soMi, ids.vayA, ids.bupBe]); st = r1.state;
    const r2 = luuOutfit(st, [ids.soMi, ids.jean, ids.bupBe]); st = r2.state;
    return { st, dipId, o1: r1.outfit.id, o2: r2.outfit.id, ids };
  }
  it('BR09 đúng: chốt bộ 2 thì bộ 1 về Đã lưu, mỗi dịp tối đa 1 bộ chốt', () => {
    const { st, dipId, o1, o2 } = setup();
    let s = chotOutfit(st, o1, dipId, TODAY);
    s = chotOutfit(s, o2, dipId, TODAY);
    expect(s.outfit.filter((o) => o.dipId === dipId && o.trangThai === 'DA_CHOT').map((o) => o.id)).toEqual([o2]);
    expect(s.outfit.find((o) => o.id === o1).trangThai).toBe('DA_LUU');
  });
  it('BR09 vi phạm: không chốt cho dịp đã qua', () => {
    const { st, dipId, o1 } = setup();
    expect(codeOf(() => chotOutfit(st, o1, dipId, '2026-11-11'))).toBe('BR09');
  });
  it('BR10 đúng: đúng ngày dịp vẫn Đã chốt, sang hôm sau thành Đã mặc (idempotent)', () => {
    const { st, dipId, o1 } = setup();
    let s = chotOutfit(st, o1, dipId, TODAY);
    expect(dongBoQuaNgay(s, '2026-11-10').outfit.find((o) => o.id === o1).trangThai).toBe('DA_CHOT');
    s = dongBoQuaNgay(s, '2026-11-11');
    expect(s.outfit.find((o) => o.id === o1)).toMatchObject({ trangThai: 'DA_MAC', ngayMac: '2026-11-10' });
    expect(dongBoQuaNgay(s, '2026-11-12')).toBe(s);
  });
  it('BR10 vi phạm: outfit Đã mặc bị khoá, không xoá, không bỏ chốt', () => {
    const { st, dipId, o1 } = setup();
    const s = dongBoQuaNgay(chotOutfit(st, o1, dipId, TODAY), '2026-11-11');
    expect(codeOf(() => xoaOutfit(s, o1))).toBe('BR10');
    expect(codeOf(() => boChot(s, o1, '2026-11-11'))).toBe('SM_OUTFIT');
  });
  it('dịp mới không được ở quá khứ', () => {
    expect(codeOf(() => themDip(empty(), { loaiDipId: 'di_lam', ngay: '2026-11-07' }, TODAY))).toBe('DIP');
  });
});

describe('BR11 – xoá món đồ', () => {
  it('đúng: món chưa dùng xoá được; outfit Đã lưu chứa món bị xoá theo', () => {
    const { s, ids } = tuDoCoBan();
    const { state } = luuOutfit(s, [ids.soMi, ids.jean, ids.sneaker]);
    const s2 = xoaMon(state, ids.jean);
    expect(s2.mon.some((m) => m.id === ids.jean)).toBe(false);
    expect(s2.outfit).toHaveLength(0);
  });
  it('vi phạm: món đã mặc chỉ được Lưu trữ', () => {
    const { s, ids } = tuDoCoBan();
    let st = themDip(s, { loaiDipId: 'cafe', ngay: TODAY }, TODAY);
    const r = luuOutfit(st, [ids.soMi, ids.jean, ids.sneaker]);
    st = dongBoQuaNgay(chotOutfit(r.state, r.outfit.id, st.dip[0].id, TODAY), '2026-11-09');
    expect(codeOf(() => xoaMon(st, ids.jean))).toBe('BR11');
    expect(chuyenTrangThaiMon(st, ids.jean, 'LUU_TRU').mon.find((m) => m.id === ids.jean).trangThai).toBe('LUU_TRU');
  });
  it('vòng đời món: Lưu trữ không chuyển sang Tạm cất', () => {
    const { s, ids } = tuDoCoBan();
    const st = chuyenTrangThaiMon(s, ids.jean, 'LUU_TRU');
    expect(codeOf(() => chuyenTrangThaiMon(st, ids.jean, 'TAM_CAT'))).toBe('SM_MON');
  });
});

describe('BR13 – cấu hình Quản trị', () => {
  it('đúng: cấu hình mặc định hợp lệ', () => {
    expect(() => validateConfig(defaultConfig())).not.toThrow();
  });
  it('vi phạm: tổng trọng số ≠ 100, min > max (RB02)', () => {
    const c = defaultConfig();
    expect(codeOf(() => validateConfig({ ...c, trongSo: { dip: 50, dang: 25, mau: 20, moi: 15 } }))).toBe('BR13');
    const c2 = defaultConfig(); c2.loaiDip[0].min = 4; c2.loaiDip[0].max = 2;
    expect(codeOf(() => validateConfig(c2))).toBe('RB02');
  });
  it('vi phạm: xoá kiểu đồ đang có món dùng', () => {
    const { s } = tuDoCoBan();
    const c = { ...s.config, kieuDo: s.config.kieuDo.filter((k) => k.id !== 'so_mi') };
    expect(codeOf(() => capNhatConfig(s, c))).toBe('BR13');
    const c2 = { ...s.config, kieuDo: s.config.kieuDo.filter((k) => k.id !== 'blazer') };
    expect(capNhatConfig(s, c2).config.kieuDo).toHaveLength(s.config.kieuDo.length - 1);
  });
});
