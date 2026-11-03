# Livestream PK — tách simulator khỏi LIVE thật (dự án A)

Ngày: 2026-11-04 · Phạm vi: `tools/livestream-pk/`

## Mục tiêu

Dữ liệu do diễn tập (người xem `sim:`) tạo ra không bao giờ ảnh hưởng tới phiên LIVE thật. Sự kiện TikTok bị gửi trùng khi kết nối lại không được tính hai lần. Mục tiêu trăng/bánh xe không còn quá dễ khi phòng đông lên giữa vòng.

Đây là dự án đầu tiên trong 6 dự án con (A–F). Dự án này không đổi gameplay, giao diện overlay hay nội dung sự kiện.

## Bối cảnh

- `npm run simulator` (`scripts/simulator.mjs`) đã chạy một tiến trình riêng ở cổng 4850, với `PK_SIMULATOR=1`, `PK_NO_TIKTOK=1`, `.simulator-data/` và `.simulator-logs/` riêng. Dữ liệu ở đó không chạm tới `data/state.json`.
- Server LIVE chính (cổng 4848) vẫn mở các API `sim/*` cho khối diễn tập trong `public/control.html` (dòng 233–240). Các sự kiện này đi thẳng vào game thật.
- `game.purgeSim()` (`game.mjs:1441`) chỉ xóa viewer, stage, thanks, quà gần đây, các map đóng góp của boss/run/roast/tug/predict, act.light, chaos.fixers và wishes. Hàm này **không** hoàn nguyên HP boss, vị trí dây kéo, HP kẻ địch của Tầng Trời, tổng quà và kim cương, ánh sáng bánh xe, mùa, trăng, nhiệm vụ giờ, cũng như bụi sao/ngọc mà người thật nhận được từ những sự kiện do sim kích hoạt.
- `tiktok.mjs` không lọc sự kiện trùng.
- Mục tiêu theo đám đông được chốt tại lúc đặt: `wheelCost()` và `moonGoalFor()` (`game.mjs:358-359`) dùng `crowdFactor()` = `stage.size / crowdFull` (thấp nhất `crowdFloor`).

Quyết định của host: chỉ diễn tập bằng `npm run simulator`. Server LIVE chính không cần nút diễn tập.

## Thiết kế

### 1. Server LIVE chính không còn diễn tập

- `server.mjs`: các route `sim/member`, `sim/chat`, `sim/gift`, `sim/like`, `sim/social`, `sim/crowd`, `sim/storm` chỉ được thêm vào `API` khi `process.env.PK_SIMULATOR === '1'`. Ở các trường hợp khác, route không tồn tại nên trả về 404 như mọi đường dẫn không có.
- `meta()` thêm trường `simulator: boolean`. `control.html` ẩn khối nút diễn tập khi `meta.simulator` là false và hiện dòng "Diễn tập: chạy `npm run simulator`" thay vào đó.

### 2. Chốt chặn trong game

- `DEFAULT_CONFIG` thêm `rehearsal: false`. `server.mjs` truyền `rehearsal: process.env.PK_SIMULATOR === '1'`.
- Ở đầu `chat`, `member`, `gift`, `like`, `social` của `createGame`: nếu `!cfg.rehearsal` và `String(u.userId).startsWith('sim:')` thì return ngay, không đổi state, không phát event. Trả về giá trị "không làm gì" mà mỗi hàm vẫn dùng (ví dụ `member` trả falsy).
- Không thêm kiểm tra nào khác. Mọi module con (boss, tug, run, roast, predict, bingo, bag, cards, season, moon, wheel) chỉ nhận dữ liệu thông qua 5 cửa vào này.

### 3. Bỏ purge

- Xóa `purgeSim()` cùng hàm `purge` trong `boss.mjs`, `run.mjs`, `roast.mjs`, `tug.mjs`, `predict.mjs`, và bỏ chúng khỏi object trả về.
- `server.mjs`: bỏ hai lời gọi `game.purgeSim()` (dòng 188 và 316).
- Dọn dữ liệu cũ khi khởi động: trong `createGame`, lúc chuẩn hóa state đã tải, nếu `!cfg.rehearsal` thì xóa mọi `st.viewers` có key bắt đầu bằng `sim:`. Việc này chỉ dọn viewer sót lại từ các phiên bản trước, không hoàn nguyên số liệu tổng.
- Xóa test `purgeSim removes rehearsal viewers…` (`game.test.mjs:324`) và thay bằng các test ở mục 7.

### 4. Chống sự kiện TikTok trùng

- `tiktok.mjs`: thêm `seen(d)` dùng hai `Set` xoay vòng. Khi set hiện tại vượt 5000 phần tử thì set cũ bị bỏ, set hiện tại thành set cũ. Hàm trả true nếu `id` của sự kiện đã có trong một trong hai set.
- `id` lấy theo thứ tự `d?.common?.msgId ?? d?.msgId`, chuyển thành chuỗi. Không có id thì không lọc.
- Áp dụng cho các handler chat, member, gift, like, follow, share. Riêng gift chỉ kiểm tra sau khi `giftOf()` trả non-null, để các sự kiện lặp combo không chiếm chỗ trong bộ nhớ.
- Bộ nhớ dedup được giữ qua các lần `open()` (kết nối lại). Gọi `connect()` mới tới một username khác thì xóa bộ nhớ.
- Trường `msgId` thực tế của `tiktok-live-connector@2.5.0` phải được xác nhận bằng một sự kiện thật hoặc đã ghi lại (`logs/events-*.jsonl` hoặc `probe`) trước khi chốt đường dẫn.

### 5. Mục tiêu theo đám đông: tăng theo, không giảm

- Trong `tick()`: khi `cfg.adaptiveCrowd` bật, cứ ít nhất 30 giây (`crowdRetuneSeconds: 30`) thì tính lại:
  - `target = wheelCost(st.wheel.no)`; nếu `target > st.wheel.cost` thì `st.wheel.cost = Math.min(target, Math.ceil(st.wheel.cost * 1.25))`.
  - Làm tương tự với `st.moon.goal` qua `moonGoalFor(st.moon.full)`.
- Không bao giờ giảm. Nếu có thay đổi thì gọi `touch` cho các phần đang hiển thị mục tiêu (`hud`, `cosmos`).
- Tăng mục tiêu không kích hoạt hoàn thành, vì việc kiểm tra hoàn thành vẫn chỉ diễn ra khi có ánh sáng được thêm vào.
- Cấu hình mới: `crowdRetuneSeconds: 30`, `crowdRetuneStep: 1.25`. `crowdRetuneSeconds: 0` thì tắt tính năng.

### 6. predict và bingo

- `predict.resolve`: khi `winner !== null` mà không có ai đoán đúng thì hoàn `stake` cho mọi người (giống trường hợp `winner === null`). Phần chia quỹ dùng `Math.floor` thay cho `Math.round`, để tổng chi không vượt `total + predictBonus * right.length`.
- bingo: không đổi code, chỉ thêm test.

### 7. Test (`node --test`)

- **Cách ly (game.test.mjs):** tạo game với `rehearsal: false`. Có người thật trên sân khấu, lần lượt khởi động boss, kéo co, Tầng Trời. Chụp `structuredClone(game.state)`, rồi đưa vào loạt sự kiện `sim:` gồm member, ngày sinh/cung, các lệnh hành động (`ước`, `nhận`, `chúc`, `đánh nó`, `đoán A`, `nâng cấp`), quà lớn, tim, follow, share. Kiểm tra `game.state` deep-equal với bản chụp và không có event nào được phát.
- **Chế độ diễn tập:** với `rehearsal: true`, sự kiện `sim:` vẫn được xử lý bình thường.
- **Dọn dữ liệu cũ:** state đã tải có viewer `sim:` thì sau `createGame` (`rehearsal: false`) viewer đó không còn.
- **Server:** khởi động `server.mjs` không có `PK_SIMULATOR` (cùng `PK_NO_TIKTOK`, thư mục tạm) thì `POST /api/sim/chat` trả 404. Có `PK_SIMULATOR=1` thì trả 200. Dùng lại cách khởi động của `scripts/smoke.mjs` hoặc `simulator.test.mjs`.
- **Dedup (tiktok.test.mjs):** cùng `msgId` hai lần thì game chỉ nhận một lần. Khác `msgId` thì nhận cả hai. Không có `msgId` thì nhận cả hai. Kết nối lại vẫn nhớ. Kiểm tra cả trường hợp gift.
- **Đám đông:** stage 2 người thì mục tiêu thấp. Thêm người tới đủ `crowdFull` và chạy `tick` qua từng mốc 30 giây: mục tiêu tăng mỗi lần tối đa x1.25 rồi dừng ở giá trị đầy đủ. Bớt người thì mục tiêu không giảm. Ánh sáng hiện có không gây hoàn thành.
- **predict:** không ai đoán, không ai đúng (có stake thì hoàn tiền), nhiều người đúng, đoán trùng (chỉ tính lần đầu), đoán sau khi đóng, viewer đã bị xóa khi resolve. Tổng chi không vượt quỹ cộng thưởng.
- **bingo:** một sự kiện làm bingo cho nhiều người cùng lúc (mỗi người một event và một ngọc), sự kiện trùng không cộng thêm, người rời sân khấu giữa vòng không được đánh dấu tiếp.

## Ngoài phạm vi

- Không thêm cơ chế snapshot/restore. Không giữ khả năng diễn tập trên server LIVE.
- Không đổi `scripts/simulator.mjs`, `public/simulator/` hay bất kỳ phần nào liên quan tới OBS.
- Dự án B–F (sự kiện trên 2 hành tinh, ngôi sao chào mừng, kho chung, hướng dẫn, hành trình/kịch tính) có spec riêng.

## Rủi ro

- Host quen bấm nút diễn tập ở 4848. Đã xử lý bằng dòng hướng dẫn trong control panel và một ghi chú trong README.
- Đường dẫn `msgId` sai thì dedup không có tác dụng nhưng cũng không gây hại (không lọc). Đã có bước xác nhận ở mục 4.
- README cần sửa các đoạn nói về diễn tập trên control panel và về `purgeSim`.
