# Vườn Mây

Vườn cộng đồng gồm bốn tầng mây xếp dọc, mỗi tầng có 108 ô. Khi người xem bình luận lần đầu, họ tự nhận một ô ở tầng ít người nhất; không cần chọn cung, ngày sinh hay dùng lệnh tham gia. Lệnh đầu tiên vẫn được xử lý ngay, nên có thể bắt đầu bằng `trồng rau`.

Giao diện 1080 × 1920 dùng token giấy thủ công của kênh (`zodiac-paper-doodle-meme-v4`) và font Patrick Hand đã có trong dự án. Mỗi tầng nay được trình bày như một ban công nhà kính nổi: khung chung, sáu kệ liên tục, giàn treo, dây leo và biển tầng cùng palette. Chậu có đĩa, đất, màu tầng và cọc avatar/tên gắn trực tiếp vào chậu để toàn cảnh đọc như một khu vườn thống nhất thay vì các asset rời. Toàn bộ vẫn được vẽ bằng Canvas, không thêm thư viện ảnh.

Garden chạy độc lập, có tiến trình và dữ liệu riêng tại `data/garden-state.json`. Save v1 được chuyển sang bốn tầng mà vẫn giữ người chơi, ô đất, cây, vàng, cấp độ và lịch sử tương tác. Cây cũ `linhthao` được đổi tên thành `nammay` (Nấm mây). Người chỉ ghé một lần sẽ được dọn sau bảy ngày không hoạt động; ô chỉ được thu hồi sớm khi đang trống cây.

## Chạy

```bash
npm run garden
```

- Overlay: `http://127.0.0.1:4858/` (1080 × 1920).
- Bàn điều khiển: `http://127.0.0.1:4858/control` (xem bảng đua, khóa camera và gọi sự kiện).
- Mỗi buổi live chỉ chạy một game kết nối TikTok.
- Simulator: dừng Garden thường trước, rồi chạy `npm run garden:sim`; vẫn dùng đúng cổng `4858` và đúng hai URL trên. Hai chế độ không chạy đồng thời. Simulator không kết nối TikTok, không ghi vào save thật, và lưu riêng ở `data/garden-simulator`.
- Control có bình luận/lệnh nhanh, quà thử, demo vòng chơi, **phòng tự chơi nhiều người**, reset simulator, khóa camera, gọi sự kiện và chốt phiên. Trong simulator có thể thêm 12/24/48/96 bot, bật hoặc dừng tự chơi; bot tự trồng, tưới, bắt sâu, hái, trộm và gửi quà test theo nhịp review. Một nhóm bot nổi bật được đẩy qua stage bằng đúng luật quà để tester thấy nhanh vòng trồng → lớn → chín → hái thay vì chờ nhiều phút. Bình luận/quà giả lập, autoplay, demo và reset chỉ bật trong simulator; khóa camera, sự kiện và chốt phiên dùng được ở Garden thường.
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

Camera không còn tự “dạo vườn”. Khi yên, nó giữ một **toàn cảnh ổn định của vùng đang có người chơi**. Các khoảnh khắc quan trọng đi vào hàng chờ, chuyển cảnh 1.8–2.2 giây và giữ shot 5–9 giây để người xem đọc rõ tên, loại chậu, loại cây, giai đoạn, biến thể và tình trạng sâu/cỏ/phân. Sự kiện toàn vườn dùng chính overview này, đồng bộ event card, hiệu ứng nền, camera, nhạc và SFX. Có thể khóa camera bằng `POST /api/camera-lock {"on":true}` hoặc gọi sự kiện bằng `POST /api/event {"type":"rain"|"pests"|"merchant"|"golden"}`.

## Thi đua và danh hiệu

Phiên đua bắt đầu khi có khách đầu tiên. Điểm chỉ đến từ hành động trong vườn: vào vườn `+1`, trồng `+1`, tự tưới `+1`, giúp người khác `+2`, dọn sâu `+2`, bắt trộm `+2`, thả chó bảo vệ `+2`, thu hoạch `+3`. Quà, trộm cây và bình luận thường không cộng điểm. Bảng top 3 hiện trên overlay; control hiển thị top 5 và nút **Chốt phiên và trao danh hiệu**. Chốt phiên lưu kết quả top 3 và mở phiên tiếp theo.

Danh hiệu cá nhân được giữ qua các phiên: **Người gieo mây** sau vụ thu hoạch đầu tiên, **Bạn tốt** sau 5 lần giúp người khác, **Người giữ vườn** sau 5 lượt dọn sâu; top 3 mỗi phiên nhận danh hiệu bục tương ứng. Lệnh `vườn` hiện điểm phiên, tiến độ mốc tiếp theo và danh hiệu đang có.

## Âm thanh

Garden tự dùng playlist calm/upbeat và sample pack trong `/sfx/manifest.json`; không còn nút âm thanh trên overlay ở cả LIVE lẫn simulator. Event start/end, quà, thu hoạch, bón phân, dọn sâu/cỏ và lên cấp dùng các role âm thanh tương ứng, đồng thời duck/cross-fade nhạc nền theo nhịp hình. Có thể tắt hoặc chỉnh bằng URL: `?music=0` / `?music=0.3`, `?sfx=0` / `?sfx=0.2`. OBS Browser Source thường tự phát được; trình duyệt thường sẽ tự unlock khi có tương tác đầu tiên trên trang.

## Diễn tập

```bash
node garden/sim.mjs --users 300 --seconds 120
node --test garden/*.test.mjs
```


### Garden visual architecture v3

The 432 persistent IDs remain as a hard ceiling, but the product is tuned for a normal **<100-viewer LIVE**. Each district is back to a compact **18 × 6** arrangement and new players fill the first district before another opens. Empty districts are not rendered, so a 20–90 person room no longer looks like a 400-seat venue.

The former cloud-island foundation is no longer the primary structure. Each district is a connected elevated conservatory deck with four readable bays, repeated signage, structural rails, and a dedicated decorative SVG. Ripe crops and the four field events also use a reusable SVG asset library under `public/garden/assets/`.

Field events are hero moments rather than only ambient filters: the overlay gets a dedicated event card, illustrated art, countdown/progress meter, edge effects, and a readable camera shot on one greenhouse district. The ordinary notification banner occupies a separate safe zone so it cannot cover the event card.


### Active-density, pot progression and care loop

The active scene is now presence-driven rather than seat-driven. A seated player becomes visually dormant after **90 seconds** without chat/care/gift activity, and their pot stops rendering and growing. After **8 minutes** of continued inactivity the seat and crop are reclaimed, while the user's level, gold, titles and lifetime stats remain in the save; returning viewers simply receive a new seat.

Player level is visible through five pot families: **Đất nung → Men lá → Viền đồng → Bệ ngọc → Tinh tú** at levels 1 / 3 / 5 / 7 / 9.

Planting can produce **Thường / Sum suê / Ánh kim** crop variants. Higher-level players have better variant odds; variants have intentionally different silhouettes and harvest multipliers. The care loop also adds **bón phân** (one-time paid growth/yield boost) and **nhổ cỏ** (weeds slow growth and reduce yield until cleared), alongside watering, pests, harvesting, stealing and protection.


### Seed Zone v5

The live-facing garden is now one **Khu Gieo Hạt** with four 24-seat rack modules (A–D), arranged 2×2. Each module has four shelves with six pots per shelf. Horizontal pot spacing and vertical shelf spacing are independent; pots anchor to an explicit shelf surface, and a thin shelf front lip is rendered after the pots so the rack no longer cuts through plants.

Legacy cloud-2..4 saves migrate into the 96-seat Seed Zone while preserving user progression and crop state for the most recent seated players.

Camera joins no longer move the camera. Join is an overview pulse at the new pot. Presentation beats are capped at seven and each close shot has separate travel and stable-reading time; the stable window is never consumed by camera motion.

Simulator room controls now **set** 12/24/48/72/96 players instead of accumulating bots. Normal/Busy/Stress profiles separate realistic LIVE review from load testing.
