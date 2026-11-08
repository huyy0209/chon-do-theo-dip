# Chọn đồ theo dịp – giai đoạn 1 (PWA)

## Mô tả
App phối đồ từ **tủ đồ của chính bạn** cho từng dịp sắp tới, xem trước trên avatar 3D anime dựng theo số đo.
Chạy hoàn toàn trên máy (chưa có tài khoản), cài được lên màn hình chính điện thoại, dùng được offline.

Nghiệp vụ chốt trong Project: `BAN_CHOT_NGHIEP_VU.md` (luật BR01–BR13) và `LY_DO_QUYET_DINH.md`.

## Công nghệ dùng
- React 19 + Vite 7 + vite-plugin-pwa
- three.js, @react-three/fiber, @react-three/drei, @pixiv/three-vrm (avatar VRM, shader anime MToon)
- IndexedDB (thư viện `idb`) để lưu dữ liệu trên máy
- Vitest để test luật nghiệp vụ

## Các bước thực hiện
1. `npm install`
2. Tạo nhân vật trong VRoid Studio (chỉ cần đẹp phần đầu, mặt, tóc), export VRM 1.0. Chép vào `public/models/avatar.vrm`,
   hoặc chọn file trong tab Avatar (file được lưu lại trên máy).
3. `npm run dev`. Muốn mở trên điện thoại thì dùng chung Wi-Fi và mở địa chỉ `Network:` mà Vite in ra.
4. `npm test` để chạy 35 test (luật nghiệp vụ + thân dựng theo số đo).
5. `npm run build` để ra thư mục `dist/` (PWA). Deploy lên Vercel/Netlify như web tĩnh.

## Luồng dùng
1. **Tủ đồ:** thêm món (loại, kiểu, màu bắt buộc; ảnh tuỳ chọn).
2. **Dịp:** tạo dịp (loại, ngày, nơi), app gợi ý top 3 outfit có điểm. Thử trên avatar, rồi Lưu hoặc Chốt.
3. Qua ngày dịp, outfit đã chốt tự thành **Đã mặc**, dùng để tránh gợi ý lặp.
4. **Cài đặt:**
   - Sao lưu/khôi phục 1 file JSON.
   - Quản trị (`#/admin`, PIN) để sửa danh mục dịp, kiểu đồ, màu, trọng số.

## Cấu trúc
```
src/
  domain/                 # LUẬT NGHIỆP VỤ – hàm thuần, giai đoạn 2 chuyển sang service Node.js
    catalog.js            # danh mục mặc định (loại dịp, 36 kiểu đồ + hợp dáng, màu, trọng số)
    rules.js              # vòng đời + BR01–BR04, BR09–BR13
    recommend.js          # chấm điểm + gợi ý (BR03–BR08)
    dates.js              # ngày giờ VN
    __tests__/domain.test.js
  store/db.js             # IndexedDB (giai đoạn 2 thay bằng API)
  store/AppStore.jsx      # state chung; mọi thay đổi qua run(hàm nghiệp vụ)
  pages/                  # Dịp, Tủ đồ, Avatar, Outfit, Cài đặt, Quản trị
  components/             # AvatarStage (3D), ui (thẻ, điểm, sheet)
  avatar/                 # bodyRig (số đo → xương), measurements, AvatarView (load VRM + đổi màu đồ)
```

## Avatar (thân + đồ dựng bằng code)
- Từ VRoid chỉ giữ **đầu, mặt, tóc, cổ, bàn tay**. Thân, tay, chân được dựng lại bằng code từ số đo
  (`src/avatar/proc/body.js`), nên mọi vòng (ngực, chân ngực, eo, hông, đùi, bắp chân, bắp tay) đúng số nhập,
  không phụ thuộc quần áo gốc của nhân vật. Độ dày mông chỉ đẩy phía sau.
- Quần áo cũng dựng bằng code theo **mẫu 3D** của từng kiểu (`src/avatar/proc/garments.js`):
  - Áo: thun, oversize, croptop, ôm, len, sơ mi, cổ V, cổ thuyền, tay phồng, peplum.
  - Quần: jogger, short, skinny, ống rộng, tây.
  - Chân váy: chữ A, xoè, bút chì.
  - Đầm: suông, wrap, ôm, maxi.
  - Áo khoác: cardigan, khoác jean, blazer.
  - Giày: sandal, thể thao, búp bê, boots, cao gót.
  - Túi: đeo chéo, xách tay, clutch.
  - Phụ kiện: thắt lưng, dây chuyền.
  - Quản trị chọn mẫu 3D cho kiểu tự thêm.
- **Vải bán thực tế (PBR):** mỗi món có chất liệu (cotton, denim, kaki, linen, len, lụa, voan, da, kim loại),
  mặc định theo kiểu, đổi được khi nhập món. Vân vải sinh bằng code (`src/avatar/proc/fabric.js`).
- **Chi tiết:** đường chỉ may (denim chỉ cam), nẹp + cúc sơ mi, ve áo blazer, cổ bẻ, túi quần jean, đỉa quần,
  cạp quần/váy, ly quần tây, bo gấu áo len, nơ đầm wrap, khoá thắt lưng, mặt dây chuyền. Có nếp gấp ở khuỷu, gối, gấu, thân váy.
- **Ánh sáng theo dịp:** 11 cảnh (studio, biển, tiệc tối, đám cưới, hẹn hò hoàng hôn, văn phòng, cafe...),
  bóng đổ mềm thật, môi trường phản chiếu, tone mapping ACES.
- **Váy vật lý:** váy/đầm gắn 12×4 xương lò xo (spring bone của VRM), va chạm với 2 chân, đung đưa khi đổi tư thế.
- **HD:** nút HD bật bóng khuất (N8AO), lấp lánh (bloom), khử răng cưa, tối 4 góc. Ảnh chụp luôn ở HD.
- **Tư thế:** Đứng / Khoe đồ / Tạo dáng; xoay 360°; chụp ảnh outfit (chia sẻ hoặc tải PNG).
- **Kiểm tra nhanh một bộ đồ:** `/?thu=so_mi:%23ffffff:cotton,vay_chu_a:%2324325c:kaki&canh=di_lam#/avatar`
  (mẫu:màu:chất liệu, `canh` = mã loại dịp)

## Giới hạn hiện tại
- Mũ chưa hiển thị 3D. Giày cao gót chưa nhấc gót bàn chân.
- Da thân vẫn dùng shader anime (MToon) để khớp với đầu/cổ/tay của VRoid; vải dùng PBR.
- Điện thoại yếu: chỉ nên bật HD khi chụp ảnh.
- Dữ liệu chỉ nằm trên máy. Đổi máy thì dùng Sao lưu/Khôi phục.
