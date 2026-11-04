# Vườn Mây — game live song song với Đêm Hội Hoàng Đạo

Trạng thái: **bản nháp chờ duyệt**. Chưa có dòng code nào.

## 1. Mục tiêu

Một game thứ hai, độc lập với "Đêm Hội Hoàng Đạo", cho phòng live TikTok đông người:

- Mỗi người xem có một ô đất trên một vườn mây chung; comment để trồng, chăm, hái, và **hái trộm** (lấy cảm hứng *Khu Vườn Trên Mây* của ZingMe).
- Luật hiểu trong vài giây, nhìn màn hình là biết ai đang làm gì.
- **Quà tặng là hành động nhìn thấy được**, không phải phần thưởng ngẫu nhiên. Camera zoom vào ô người tặng là một phần thưởng.
- Chịu được vài trăm người cùng lúc. Một camera "đạo diễn" tự zoom vào sự kiện.
- Trạng thái (cấp, cây trưng, ô đất) lưu qua các đêm để người xem quay lại.

Thành công khi: một buổi live thử với ~300 người giả lập chạy mượt trên máy host, mọi quà đều có cảnh quay riêng, và người chỉ comment cũng có lúc được lên hình.

### Không làm (ngoài phạm vi)
- Không sửa `game.mjs`, `server.mjs`, `public/overlay.*` hay bất cứ file nào của game cũ.
- Không liên quan OBS (host dùng TikTok LIVE Studio với nguồn Web/Link, xem `CLAUDE.md`).
- Không có tiền thật, không có phần thưởng ngẫu nhiên đổi bằng quà, không có chữ nào xin quà trên màn hình.
- Quà **không cộng hạt vàng** và không mua được hạt giống.

### Bản đầu (MVP) và phần để sau
**Có:** 12 đảo (theo 12 cung), 1 ô/người, 3 loại cây, tưới · bắt sâu · hái · trộm · bắt trộm · thả chó, giúp tưới người khác, 3 sự kiện (mưa, bão sâu, thương lái) + giờ vàng, 3 mức quà + thần thụ, cấp bậc, lưu qua đêm, camera đạo diễn 3 mức zoom, tối ưu cho đông người.
**Để sau:** khung phụ (PiP), đảo phụ tự sinh, nhiều ô/người, Chợ mây, mùa/tuần, NPC lấp chỗ vắng, nhổ cỏ.

## 2. Kiến trúc: một tiến trình riêng

```
tools/livestream-pk/
  garden/
    server.mjs        điểm vào; npm run garden
    world.mjs         đảo, ô đất, tick, trạng thái
    crops.mjs         bảng cây trồng
    commands.mjs      comment -> hành động
    care.mjs          tưới, sâu, hái
    steal.mjs         trộm, bắt trộm, chó, bảo hộ
    events.mjs        lịch sự kiện toàn vườn
    gifts.mjs         quà -> hiệu ứng
    camera.mjs        đạo diễn: hàng đợi cảnh quay
    transport.mjs     SSE + long-poll + bộ gộp hiệu ứng
    store.mjs         lưu/nạp trạng thái
    *.test.mjs
  public/garden/      index.html, garden.js, garden.css
```

- **Dùng lại, không đổi:** `tiktok.mjs` (cầu nối sự kiện TikTok), `diagnostics.mjs` (ghi/phát lại), `public/signs.js` (tên 12 cung và cách nhận ra cung từ comment).
- **Cổng riêng:** chính `PK_GARDEN_PORT` (mặc định 4858, localhost, có bảng host) và cổng chia sẻ chỉ đọc 4859 cho tunnel `npm run share`. Cần xác nhận script share có nhận cổng khác không (xem mục 11).
- **Dữ liệu riêng:** `data/garden-state.json` (ghi nguyên tử mỗi ≤10 giây, giống game cũ). Không đụng `state.json`.
- **Chỉ một game kết nối TikTok mỗi buổi**; chạy game nào thì gắn URL của game đó vào LIVE Studio. Hai tiến trình có thể mở cùng lúc khi diễn tập (mỗi cái có `PK_NO_TIKTOK=1` hoặc tên phòng riêng).
- **Truyền dữ liệu:** server đẩy `frame` (chỉ phần thay đổi, đánh số phiên bản từng ô) + `fx` + `shot` (cảnh camera) mỗi 150ms. Có đường long-poll dự phòng vì tunnel không stream được SSE.

## 3. Thế giới và camera

Thế giới 3600×4800 đơn vị: lưới 3×4 gồm **12 đảo 1200×1200**, mỗi đảo = một cung. Mỗi đảo tối đa **36 ô** (lưới 6×6, ô 160×160). Tổng tối đa 432 ô có người.

Ba mức zoom (khung nhìn 1080×1920):

| Mức | Zoom | Thấy gì |
|---|---|---|
| Toàn cảnh | 0.30 | cả 12 đảo; ô chỉ là chấm màu theo giai đoạn cây, đảo có độ rực theo hoạt động |
| Đảo | 0.90 | một đảo, từng ô và cây |
| Cận cảnh | 2.50 | một ô, tên, avatar, chi tiết cây |

**Người mới vào** gõ tên cung/số/ngày sinh (như game cũ) để chọn đảo; không chọn thì được xếp vào đảo vắng nhất. Vị trí ô **cố định** theo người. Đảo đầy: người **lâu không hoạt động nhất và đang không có cây** nhường chỗ (dữ liệu giữ nguyên, ngồi lại chỗ khác khi quay về).

### Camera đạo diễn (`camera.mjs`)
Server quyết định cảnh quay (dễ test), client chỉ làm mượt (ease 600ms).

| Ưu tiên | Sự kiện | Cảnh | Giữ |
|---|---|---|---|
| 1 | Thần thụ / quà ≥100 xu | cận cảnh ô người tặng + tên to | 4s |
| 2 | Quà <100 xu | zoom đảo hoặc cận cảnh | 2.5s |
| 3 | Trộm / bắt trộm | khung rộng chứa cả hai ô | 3s |
| 4 | Lên cấp, cây hiếm chín | cận nhẹ + banner | 2.5s |
| 5 | Mưa, bão sâu, thương lái | toàn cảnh hoặc đảo | theo sự kiện |
| nền | không có gì | lướt qua đảo có hoạt động cao nhất, 8s/đảo; không có thì xoay vòng | — |

Quy tắc: mỗi cảnh ≥2s (quà lớn ≥4s); hàng đợi tối đa 8, mỗi cảnh có hạn dùng (quà 15s, còn lại 6s) rồi bỏ; sự kiện cùng đảo trong 1,5s **gộp thành cảnh đảo**; giữa hai cảnh có khoảng ra toàn cảnh 1s; **hạn ngạch ánh đèn**: mỗi phút dành tối thiểu 2 cảnh cho hành động không phải quà (cây đầu tiên chín, lên cấp, bắt trộm giỏi) nên người không tặng cũng được lên hình. Host có nút **khoá camera** (giữ cảnh hiện tại / tắt zoom).

## 4. Cây trồng và chăm sóc

Một cây có 4 giai đoạn nhìn thấy: hạt → mầm → lớn → **chín**. Chín xong có **ân hạn 120s**; quá hạn thành *cây già*, hái được **50%**. Cây không héo hẳn, người vào muộn không mất trắng.

| Cây | Mở ở | Thời gian | Vàng | XP |
|---|---|---|---|---|
| Rau | cấp 1 | 180s | 10 | 5 |
| Hướng dương | cấp 2 | 300s | 22 | 12 |
| Linh thảo (theo hành của cung) | cấp 4 | 480s | 45 | 25 |

Các con số là mặc định trong `crops.mjs`, chỉnh qua config.

- **Nước:** mỗi ô có thanh nước giảm hết sau 60s. Hết nước, cây lớn **×0.5**. `tưới` đặt nước đầy và cộng 6% tiến độ (mỗi ô 15s/lần).
- **Sâu:** có thể xuất hiện trên ô đang lớn (xác suất nhỏ mỗi tick). Có sâu: cây lớn **×0.6**, hái được **−30%**. `bắt sâu` gỡ sâu.
- **Ô ngủ:** không có hành động nào của chủ trong **5 phút** thì ô "ngủ": ngừng lớn, không sâu, không bị trộm, vẽ mờ. Chủ làm bất kỳ hành động nào thì thức.

### Lệnh (đều là comment, không phân biệt hoa thường/dấu)
`trồng [tên cây]` · `tưới` · `bắt sâu` · `hái` · `tưới @tên` (giúp người khác) · `trộm [@tên]` · `bắt trộm` · `thả chó` · `vườn` (xem thẻ của mình). Mỗi người tối đa 1 hành động chăm mỗi 1,5s.

**Giúp tưới `tưới @tên`:** khớp theo tên hiển thị (bỏ dấu, tiền tố); trùng nhiều người thì bỏ qua. Cả hai nhận +2 XP, người giúp +1 vàng. Mỗi cặp 30s/lần.

## 5. Trộm (nhẹ, có phản đòn)

- Chỉ trộm được cây **chín** (và còn trong ân hạn) của ô **thức**, lấy **20%** sản lượng (≥1 vàng). Mỗi ô bị trộm tối đa **2 lần** mỗi vụ.
- Mỗi người trộm 1 lần/20s, tối đa 3 lần cùng một chủ mỗi 10 phút. `trộm` không kèm tên chọn ngẫu nhiên một ô chín cùng đảo.
- Màn hình hiện "🕵️ Mai trộm cà chua của Lan". Chủ gõ `bắt trộm` trong **10s**: thành công thì kẻ trộm **trả lại** và bị cấm trộm 60s.
- **Chó giữ vườn:** `thả chó` đặt chó 10 phút, chó tự bắt mọi vụ trộm vào ô đó. **Miễn phí 1 lần mỗi đêm**, các lần sau tốn 30 vàng trong game. Quà **không** mua chó.
- **Bảo hộ:** chủ ô cấp ≤2 và chủ bị trộm ≥2 lần trong 3 phút được bảo hộ 3 phút.
- Bảng vui "Đạo chích của đêm" dựa trên số lần trộm/bắt.

## 6. Quà tặng

Hiệu ứng **cố định theo mức xu** (người xem biết trước nhận gì), tính trên `diamonds × count` của một lần tặng. Người chưa có ô sẽ được **cấp ô ngay** để quà luôn hiện lên.

| Mức | Hiệu ứng | Camera |
|---|---|---|
| <5 xu | **Giọt sương:** tưới mọi ô của người tặng + 10% tiến độ | zoom đảo, 2.5s |
| 5–99 xu | **Phân sao:** mọi cây đang lớn của người tặng lên một giai đoạn ngay | cận cảnh, 3s |
| ≥100 xu | **Mưa phép:** cả vườn lên một giai đoạn, tên người tặng hiện giữa trời | toàn cảnh rồi cận, 4s |
| ≥1000 xu | **Thần thụ:** cây vàng đứng cố định trên ô người tặng, giữ qua các đêm (làm đẹp, không thêm lợi thế) | cận cảnh, 4s |

Quà không cho hạt vàng, không mở khoá cấp, không xin quà trên màn hình. Cùng quy tắc "không xin quà" như README game cũ.

## 7. Sự kiện toàn vườn (`events.mjs`)

Mỗi **3–5 phút** một sự kiện, không lặp liên tiếp:

- 🌧️ **Mưa mây** (30s): cả vườn lớn ×2.
- 🐛 **Bão sâu** (20s): sâu xuất hiện trên ~50% ô thức; cả phòng gõ `bắt sâu`; gỡ được ≥80% thì mỗi người tham gia +5 vàng.
- 🧑‍🌾 **Thương lái** (60s): một loại cây được giá ×2 (hiện rõ trên màn).
- 🌈 **Giờ vàng** (30s): hái được ×2 vàng.

Sự kiện nào cũng có thông báo trên đỉnh và cảnh camera mức 5.

## 8. Cấp bậc và lưu trữ

- XP từ hái (theo bảng) và giúp tưới. Ngưỡng cấp: 0 · 30 · 90 · 200 · 400 · 700 · 1100 · 1600 · 2200 · 3000 (cấp 1–10). Cấp mở cây theo bảng trên; cấp 10 là trần MVP.
- Vàng dùng để mua hạt khi trồng (giá = 40% vàng thu) và chó. Không đổi từ tiền thật hay từ quà.
- **Bản ghi người chơi:** `{ userId, nickname, avatar, sign, level, xp, gold, seat:{island,slot}, deco[], lastSeen, stats:{harvest,steal,caught} }`. Cây đang trồng giữ nguyên tiến độ qua lúc tắt server.
- Mỗi đêm có **hạt ngày**: một loại hạt đặc biệt (làm đẹp) nhận miễn phí khi vào đêm đó.
- Quên người chỉ ghé một lần sau 7 ngày không quay lại (như `pruneViewers`).

## 9. Tối ưu cho đông người

**Phía server**
- Gom sự kiện theo nhịp **250ms**; hành động giống nhau gộp thành một hiệu ứng ("23 người đang tưới" = một cơn mưa nhỏ, không phải 23 popup).
- Giới hạn tốc độ mỗi người (mục 4); hàng đợi hiệu ứng có trần, vượt trần bỏ cái ít quan trọng nhất.
- `tick` chỉ duyệt ô **thức**; ô ngủ bỏ qua. Mục tiêu: `tick` 432 ô < 5ms.
- Dữ liệu `frame` chỉ gồm ô thay đổi.

**Phía client (canvas 2D, không DOM cho ô)**
- Chỉ vẽ ô nằm trong khung camera. Dưới zoom 0.5 vẽ chấm màu, không vẽ avatar/chữ.
- Tối đa ~150 ô vẽ chi tiết cùng lúc; ô không hoạt động thì dạng rút gọn.
- Bộ nhớ đệm avatar có trần; không vẽ avatar khi zoom <0.9.
- Khung 1080×1920 giữ nguyên, tự co theo kích thước cửa sổ như overlay hiện tại.

## 10. Kiểm thử

- **Đơn vị** (`node --test`, như `minigames.test.mjs`: tiêm `now`, `rng`): tăng trưởng và ân hạn, nước/sâu, trộm và phản đòn, chó và bảo hộ, quà → hiệu ứng, bảng ưu tiên camera và gộp cảnh, hạn ngạch ánh đèn, ô ngủ/đảo đầy, lưu và nạp.
- **Tải:** `garden/sim.mjs` tạo N người giả (100/300/432) gửi comment và quà ngẫu nhiên; đo `tick`, kích thước `frame`, và số cảnh camera mỗi phút.
- **Trình duyệt:** mở `http://127.0.0.1:4858/`, kiểm 3 mức zoom và một cảnh quà bằng người giả; chụp ảnh.
- **Nội dung:** một test quét toàn bộ chuỗi hiển thị để chắc không có chữ nào xin quà.

## 11. Cần xác nhận khi lập kế hoạch (không chặn spec)

1. `scripts/share.mjs` có nhận cổng khác 4849 không; nếu không, thêm tham số mà không đổi hành vi hiện tại.
2. Cách tách `parseSign` từ `game.mjs` hay `signs.js` để dùng lại mà không import cả `game.mjs`.
3. Cầu nối `tiktok.mjs` có thể khởi động hai lần (hai tiến trình) khi diễn tập mà không xung đột; nếu có, dùng `PK_NO_TIKTOK=1`.
4. Số liệu thực tế về mức quà trên phòng của host để chỉnh ngưỡng 5/100/1000 xu.
