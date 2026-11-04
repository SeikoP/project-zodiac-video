# Vườn Mây — game live song song với Đêm Hội Hoàng Đạo

Mỗi người xem có một ô đất trên vườn mây chung (12 đảo = 12 cung): trồng, chăm, hái, **hái trộm**. Quà là hành động nhìn thấy được, camera tự zoom vào từng khoảnh khắc. Thiết kế: [spec](../docs/superpowers/specs/2026-11-04-vuon-may-design.md) · kế hoạch: [plan](../docs/superpowers/plans/2026-11-04-vuon-may.md).

Game này **độc lập** với game cũ: tiến trình riêng, cổng riêng, dữ liệu riêng (`data/garden-state.json`). Chỉ dùng chung `tiktok.mjs` (nguồn sự kiện) và `diagnostics.mjs`.

## Chạy

```bash
npm run garden                      # overlay http://127.0.0.1:4858/  (chia sẻ chỉ xem: 4859)
PK_SHARE_PORT=4859 npm run share    # địa chỉ https cho TikTok LIVE Studio (nguồn Web/Link)
```

- Mỗi buổi live chỉ chạy **một** game kết nối TikTok (game cũ hoặc Vườn Mây).
- Diễn tập không kết nối TikTok: `PK_NO_TIKTOK=1 npm run garden`, rồi `node garden/sim.mjs --users 300 --url http://127.0.0.1:4858`.
- Thư mục dữ liệu đổi bằng `PK_DATA_DIR`; cổng bằng `PK_GARDEN_PORT` / `PK_GARDEN_SHARE_PORT`.
- Điều chỉnh số liệu trong `config.json` mục `"garden"` (mọi giá trị mặc định ở `garden/config.mjs`).

## Người xem gõ gì

| Lệnh | Việc |
|---|---|
| tên cung / số 1–12 / ngày sinh | chọn đảo của mình |
| `trồng rau` · `trồng hướng dương` · `trồng linh thảo` | gieo hạt (mở theo cấp 1 · 2 · 4) |
| `tưới` · `bắt sâu` · `hái` | chăm và thu hoạch |
| `tưới @tên` | giúp tưới ô người khác (cả hai nhận XP) |
| `trộm` · `trộm @tên` | hái trộm 20% cây chín (tối đa 2 lần mỗi vụ) |
| `bắt trộm` | trong 10 giây, bắt kẻ vừa trộm mình |
| `thả chó` | chó giữ vườn 10 phút (miễn phí 1 lần mỗi đêm, sau đó 30 vàng) |
| `vườn` | xem thẻ của mình |

## Quà (cố định theo xu, không ngẫu nhiên, không cho vàng)

| Mức | Hiệu ứng |
|---|---|
| < 5 xu | Giọt sương: tưới và +10% tiến độ cho ô người tặng |
| 5–99 xu | Phân sao: cây người tặng lên một giai đoạn |
| ≥ 100 xu | Mưa phép: cả vườn lên một giai đoạn |
| ≥ 1000 xu | Thần thụ: cây vàng đứng lại trên ô người tặng (kèm mưa phép) |

Không chữ nào trên màn hình xin quà (có test quét: `garden/copy.test.mjs`).

## Camera

Server chọn cảnh (`garden/camera.mjs`), trang chỉ làm mượt. Quà lớn được cận cảnh 4 giây; trộm/bắt, lên cấp, cây chín lần đầu của một người và sự kiện toàn vườn có cảnh riêng. Sau khi một cảnh quà đã chiếu, một khoảnh khắc không-phải-quà đang chờ được chiếu trước cho đến khi đủ 2 cảnh mỗi phút, để người chỉ comment cũng lên hình. Bảng điều khiển: `POST /api/camera-lock {"on":true}` giữ nguyên khung hình, `POST /api/event {"type":"rain"|"pests"|"merchant"|"golden"}` gọi sự kiện.

## Hiệu năng đo được

`node garden/sim.mjs --users 432 --seconds 300` (ngoại tuyến, đồng hồ giả, 432 người, ~6 quà/phút):
`tick` p95 ≈ 0,5 ms · khung dữ liệu p95 ≈ 90–100 KB · 8 cảnh camera/phút (9 cảnh không-phải-quà trong 5 phút).

## Chưa làm (để sau)

Khung phụ (PiP), đảo phụ tự sinh, nhiều ô/người, Chợ mây, mùa/tuần, NPC lấp chỗ vắng, nhổ cỏ, hạt giống mỗi đêm.

## Kiểm thử

```bash
node --test garden/*.test.mjs
```
