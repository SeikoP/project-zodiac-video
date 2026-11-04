# Vườn Mây

Vườn cộng đồng gồm bốn tầng mây xếp dọc, mỗi tầng có 108 ô. Khi người xem bình luận lần đầu, họ tự nhận một ô ở tầng ít người nhất; không cần chọn cung, ngày sinh hay dùng lệnh tham gia. Lệnh đầu tiên vẫn được xử lý ngay, nên có thể bắt đầu bằng `trồng rau`.

Giao diện 1080 × 1920 dùng token giấy thủ công của kênh (`zodiac-paper-doodle-meme-v4`) và font Patrick Hand đã có trong dự án. Mây, dây leo, chậu cây và hiệu ứng được vẽ bằng Canvas theo token; không dùng ảnh tạo sinh hay thêm thư viện ảnh.

Garden chạy độc lập, có tiến trình và dữ liệu riêng tại `data/garden-state.json`. Save v1 được chuyển sang bốn tầng mà vẫn giữ người chơi, ô đất, cây, vàng, cấp độ và lịch sử tương tác. Cây cũ `linhthao` được đổi tên thành `nammay` (Nấm mây). Người chỉ ghé một lần sẽ được dọn sau bảy ngày không hoạt động; ô chỉ được thu hồi sớm khi đang trống cây.

## Chạy

```bash
npm run garden
```

- Overlay: `http://127.0.0.1:4858/` (1080 × 1920).
- Bàn điều khiển: `http://127.0.0.1:4858/control` (xem bảng đua, khóa camera và gọi sự kiện).
- Mỗi buổi live chỉ chạy một game kết nối TikTok.
- Simulator: dừng Garden thường trước, rồi chạy `npm run garden:sim`; vẫn dùng đúng cổng `4858` và đúng hai URL trên. Hai chế độ không chạy đồng thời. Simulator không kết nối TikTok, không ghi vào save thật, và lưu riêng ở `data/garden-simulator`.
- Control có bình luận/lệnh nhanh, quà thử, demo vòng chơi, reset simulator, khóa camera, gọi sự kiện và chốt phiên. Bình luận/quà giả lập, demo và reset chỉ bật trong simulator; khóa camera, sự kiện và chốt phiên dùng được ở Garden thường.
- Nếu cổng `4858` đang bận, hãy dừng tiến trình Garden cũ rồi khởi động chế độ cần dùng. Không mở cổng phụ cho simulator hoặc control.
- Trình mô phỏng dòng lệnh vẫn dùng được: `node garden/sim.mjs --users 40 --url http://127.0.0.1:4858`.
- Đổi cổng duy nhất bằng `PK_GARDEN_PORT`; đổi thư mục save simulator bằng `PK_GARDEN_SIM_DATA_DIR`.
- Số liệu mặc định nằm trong `garden/config.mjs`; cấu hình có thể ghi đè ở mục `garden` của `config.json`.

Garden chỉ mở một cổng local cho overlay, control, âm thanh và simulator (dùng luân phiên). Đường OBS/LIVE chưa được xác nhận; thao tác mô phỏng không chứng minh overlay đã lên live thật.

## Người xem có thể làm gì

| Bình luận | Tác dụng |
|---|---|
| Bất kỳ bình luận đầu tiên | Nhận ô đất và xuất hiện trong vườn |
| `trồng rau` · `trồng hướng dương` · `trồng nấm mây` | Gieo hạt (cấp 1 · 2 · 4) |
| `tưới` · `bắt sâu` · `hái` | Chăm cây và thu hoạch |
| `tưới @tên` | Giúp tưới ô của người khác; cả hai nhận XP |
| `trộm` · `trộm @tên` | Hái trộm 20% cây chín, tối đa hai lần mỗi vụ |
| `bắt trộm` | Bắt người vừa trộm mình trong 10 giây |
| `thả chó` | Giữ vườn 10 phút (mỗi đêm miễn phí một lần, sau đó 30 vàng) |
| `vườn` | Xem thẻ người chơi |

## Quà và sự kiện

| Quà theo tổng xu | Hiệu ứng |
|---|---|
| Dưới 5 | Giọt sương tưới cây của người gửi và thêm 10% tiến độ |
| 5–99 | Phân sao giúp cây của người gửi lên một giai đoạn |
| 100–999 | Mưa phép giúp cây đang lớn lên một giai đoạn |
| Từ 1000 | Thần thụ xuất hiện ở ô người gửi và gọi mưa phép |

Sự kiện vườn: Mưa mây, Bão sâu, Thương lái đến và Giờ vàng. Màn hình không hiện lời kêu gọi gửi quà.

Camera dạo qua 12 cụm chậu cây (4 tầng × 3 khung ngang) khi vườn yên để chậu, avatar và tên chủ vẫn đọc được trên màn hình điện thoại. Người mới, quà, cây chín và lên cấp được đưa về đúng chậu; khoảnh khắc quan trọng có vòng sáng lớn và vùng xung quanh tối nhẹ. Sự kiện toàn vườn vẫn dùng khung overview riêng kèm lớp hiệu ứng mưa, sâu, thương lái hoặc giờ vàng. Cách trình diễn thay đổi nhưng tọa độ ô, quyền sở hữu và save hiện tại không đổi. Có thể khóa camera bằng `POST /api/camera-lock {"on":true}` hoặc gọi sự kiện bằng `POST /api/event {"type":"rain"|"pests"|"merchant"|"golden"}`.

## Thi đua và danh hiệu

Phiên đua bắt đầu khi có khách đầu tiên. Điểm chỉ đến từ hành động trong vườn: vào vườn `+1`, trồng `+1`, tự tưới `+1`, giúp người khác `+2`, dọn sâu `+2`, bắt trộm `+2`, thả chó bảo vệ `+2`, thu hoạch `+3`. Quà, trộm cây và bình luận thường không cộng điểm. Bảng top 3 hiện trên overlay; control hiển thị top 5 và nút **Chốt phiên và trao danh hiệu**. Chốt phiên lưu kết quả top 3 và mở phiên tiếp theo.

Danh hiệu cá nhân được giữ qua các phiên: **Người gieo mây** sau vụ thu hoạch đầu tiên, **Bạn tốt** sau 5 lần giúp người khác, **Người giữ vườn** sau 5 lượt dọn sâu; top 3 mỗi phiên nhận danh hiệu bục tương ứng. Lệnh `vườn` hiện điểm phiên, tiến độ mốc tiếp theo và danh hiệu đang có.

## Âm thanh

Garden dùng playlist calm/upbeat, bộ phát cross-fade và hiệu ứng từ dự án. Nhấn **Bật âm thanh** trong overlay để bật/tắt âm thanh. Có thể cấu hình theo query: `?music=0` hoặc `?music=0.3`; `?sfx=0` hoặc `?sfx=0.2`. Mặc định âm lượng thấp; trình duyệt có thể chặn tự phát cho đến khi người vận hành nhấn nút.

## Diễn tập

```bash
node garden/sim.mjs --users 300 --seconds 120
node --test garden/*.test.mjs
```
