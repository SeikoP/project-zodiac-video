# Vườn Mây

Vườn cộng đồng 1080 × 1920, dùng toàn khung hình. Một **Khu Gieo Hạt** gồm 48 chậu, hai cánh kệ × tám hàng × ba chậu. Người xem bình luận nhận chậu tự động; có thể bắt đầu ngay bằng `trồng`. Canvas, SVG và font Patrick Hand có sẵn; không thêm thư viện.

## Chạy

```bash
npm run garden
# LIVE Studio Link source: mở terminal thứ hai sau khi Garden thật đã chạy
npm run garden:share
# Hoặc chạy giả lập, sau khi đã dừng Garden thường:
npm run garden:sim
```

- Overlay local: `http://127.0.0.1:4858/`; điều khiển: `http://127.0.0.1:4858/control`.
- Garden thật mở thêm cổng **4859 chỉ đọc** cho `npm run garden:share`; lệnh này in URL HTTPS tạm để dán vào Link source của TikTok LIVE Studio. Control và API ghi không được public qua tunnel.
- Garden thường lưu tại `data/garden-state.json`. Simulator không kết nối TikTok, lưu riêng tại `data/garden-simulator` và **không mở cổng share**.
- Overlay và control local dùng chung cổng 4858. Chỉ chạy một chế độ trên cổng đó; mỗi buổi LIVE chỉ chạy một game kết nối TikTok.
- Cấu hình trong `garden/config.mjs`, ghi đè qua mục `garden` của `config.json`. `PK_GARDEN_PORT` đổi cổng, `PK_GARDEN_SIM_DATA_DIR` đổi thư mục mô phỏng.
- Control có bình luận, quà, demo, phòng bot, khóa camera, sự kiện và chốt phiên. Chức năng giả lập/reset chỉ bật trong simulator.
- Kiểm thử: `npm test`; tải mô phỏng: `node garden/sim.mjs --users 40 --url http://127.0.0.1:4858`.

## Phiên và trao giải

Phiên đua mặc định **10 phút**. Hết giờ hoặc bấm **Chốt phiên** sẽ chuyển sang lễ trao giải **8 giây**, vinh danh **Top 5 có avatar**, với bục Top 3, danh hiệu và lần lượt **15 / 10 / 5 XP**. Thưởng có thể làm tăng LV và nâng kiểu chậu. Chốt lại/tải lại không cộng thưởng lần nữa; trạng thái trao giải và quà chờ được lưu cùng save.

Sau lễ, phiên mới **xóa cây, giải phóng toàn bộ chậu, xóa điểm phiên, vàng và hiệu ứng cũ**. Mỗi người bắt đầu lại với **20 vàng**, giữ **LV, XP, huy hiệu và thành tích lâu dài**; bình luận để nhận chậu mới. Cây của phiên trước không được chuyển sang phiên mới.

Trong lễ, lệnh chăm cây bị tạm ngừng và trả lý do cùng thời gian còn lại. Quà được giữ trong hàng chờ rồi áp dụng đúng một lần sau khi mở vườn mới. Tim trong lễ không làm thay đổi vườn. Phiên không có điểm chờ người chơi thay vì tự trao giải rỗng liên tục.

Bảng Top 5 và đồng hồ chỉ hiện điểm phiên hiện tại. Điểm: vào vườn/trồng/tưới 1; giúp bạn/dọn sâu/giữ vườn/bắt trộm 2; hái 3. Mua quà không trực tiếp cộng điểm, vàng hay XP.

## Cây, cấp và thao tác

Rau lớn **3 phút** (LV1), hướng dương **4 phút** (LV2), nấm mây **5 phút** (LV4), trước các hệ số chăm sóc/sự kiện. Cây có biến thể Thường / Sum suê / Ánh kim; cấp cao tăng cơ hội biến thể. Chậu đổi hình ở LV1 / 3 / 5 / 7 / 9: Đất nung → Men lá → Viền đồng → Bệ ngọc → Tinh tú. Mỗi bậc có silhouette và họa tiết riêng: chậu thuôn, bụng tròn, thân vát, quai/bệ ngọc và chén tinh tú; cấp trong mỗi bậc thêm chi tiết. Cây có hạt/mầm/cây non/trưởng thành, ba biến thể với hình lá/hoa/nấm khác nhau. Thành tựu gắn một huy hiệu ưu tiên lên chậu để giữ toàn cảnh dễ đọc.

Mốc mới: 10/50 thu hoạch tích lũy, 20 lần giúp bạn, 20 lần dọn sâu. Dữ liệu cũ không có tổng thu hoạch trọn đời bắt đầu ghi từ đợt này; không suy đoán lịch sử đã mất. Thông báo lên cấp/danh hiệu kèm avatar, LV và màu bậc, được giữ đủ thời gian đọc thay vì bị dòng thành công cơ bản ghi đè. Trồng/tưới/lên cấp/phá cây có phản hồi chuyển động ngắn tại chậu; đổi hạng và lễ vinh danh có chuyển động riêng, tắt theo reduced-motion.

| Bình luận | Tác dụng |
|---|---|
| `trồng`, `gieo` | Tự mua cây cao nhất đủ LV và vàng: rau LV1, hướng dương LV2, nấm mây LV4. Có thể ghi tên cây để chọn thủ công; có lượt gieo lại miễn phí thì chọn rau |
| `chăm` | Tự bắt sâu → nhổ cỏ → tưới, không tự tiêu vàng |
| `tưới` | Đầy nước, thêm 1,5% tiến độ và **+25% tốc độ trong 30s**; hồi 15s |
| `bón phân` | Tốn 3 vàng, thêm 3% tiến độ; **+18% tốc độ** và tăng sản lượng đến khi hái |
| `chăm @tên`, `tưới @tên` | Giúp đúng người trên tên chậu; giúp tưới cho XP cả hai và vàng người giúp |
| `bắt sâu`, `nhổ cỏ` | Gỡ chậm lớn/giảm sản lượng; trong bão có thể tự tìm cây hàng xóm bị sâu |
| `hái`, `thu hoạch` | Cây chín đổi thành vàng và XP, chậu trống để gieo tiếp |
| `trộm @tên`, `bắt trộm` | Trêu cây chín và bắt lại trong cửa sổ thời gian; khiên/chó chặn trộm |
| `thả chó` | Canh vườn 10 phút; mỗi đêm miễn phí một lần, sau đó 30 vàng |
| `vườn` | Thông tin gọn ở dòng thông báo trong 2,5s, không mở thẻ che cây; mỗi người hồi 8s, cả phòng tối đa một thông báo/8s. Chỉ giữ yêu cầu mới nhất và bỏ yêu cầu quá 15s; chỉ hiện sau khi hàng đợi chính trống đủ 6s |

Thanh tốc độ dùng **cùng phép tính với tăng trưởng thực tế**: nước, sâu, cỏ, phân, tưới, quà và thời tiết đều góp vào hệ số. Tưới + phân khi cây khỏe cho khoảng **+48%**. Hồ sơ tự hiện cạnh cây trong cảnh zoom, gồm LV, XP, vàng, điểm phiên, danh hiệu và hai thanh riêng: XP lên LV và tiến độ cây; tên chậu toàn cảnh có tiến độ cùng hệ số tăng tốc/chậm lớn.

Thông báo thao tác dùng một dòng dưới “Khu Gieo Hạt”; hướng dẫn xoay tua tận dụng phần phải của thẻ trên cùng. Lệnh bị chặn trả lý do, số vàng/LV thiếu hoặc thời gian hồi còn lại. Vấn đề sâu/cỏ/khô phủ hướng dẫn lên cây 4s rồi nghỉ 20s. Thành công cơ bản không thêm thẻ phủ cây hoặc kéo camera. Hàng đợi trình chiếu ưu tiên quà; kỹ năng lớn đứng trước vòng quay/quà nhỏ đang chờ. Lệnh “vườn” chỉ dùng dòng thông báo, không thay hồ sơ đang zoom và không che sân khấu boss. Mỗi lúc chỉ có một cảnh chính. Camera giữ toàn cảnh với mọi quà và boss; `vườn` không vào hàng đợi camera. Những lần lên cấp/sự kiện đặc biệt vẫn có thể dùng cận cảnh.

Im 90s: chậu ẩn và ngừng lớn. Im 3 phút: thu hồi chậu/cây để nhường chỗ. Trong cùng phiên, người quay lại giữ vàng/cấp/XP; sau đổi phiên áp dụng quy tắc 20 vàng ở trên.

## Quà và vòng quay

Tổng xu = giá trị mỗi quà × số lượng, dùng cùng đường xử lý cho LIVE và simulator. Quà tăng trưởng gặp chậu trống tự kèm hạt rau mới, không tiêu vàng; vì thế quà đến lúc trao giải vẫn giúp cây mới sau khi chuyển phiên. Vòng quay trên chậu trống có thể trao khiên.

| Tổng xu | Hiệu ứng |
|---|---|
| Dưới 5 | Giọt sương tưới chậu người gửi, thêm 10% tiến độ |
| 5–49 | Phân sao nâng một giai đoạn, bón phân cho cây người gửi |
| **50–99** | **Vòng quay tinh nghịch** với kết quả chọn một lần ở máy chủ |
| 100–499 | Mưa phép nâng một giai đoạn cây đang lớn, tưới và dọn cỏ ở chậu hoạt động |
| **500–999** | **Thiên thạch** phá 1 cây đối thủ, làm chín cây người gửi và bảo vệ 60s |
| **Từ 1000** | **Đại địa chấn** phá tối đa 3 cây đối thủ, làm chín cây người gửi và bảo vệ 60s |

Sáu ô vòng quay: tăng tốc mình **+30% / 45s**, bón phân cho mình, khiên mình **60s**, hoặc chọn ngẫu nhiên người khác để chậm **25% / 20s**, khô đất **20s**, cỏ **20s**. Khiên và lớp bảo vệ chặn việc bị chọn. Tưới/nhổ cỏ gỡ sớm hiệu ứng tương ứng; hết giờ trả lại trạng thái trước khi trêu. Riêng vòng quay không xóa cây, lấy vàng hoặc trừ XP. Không có đối thủ hợp lệ sẽ chọn lợi ích cho mình; chậu trống có thể nhận khiên. Nếu không có chậu cho người tặng và không có đối thủ hợp lệ, dùng khiên cả vườn. Giao diện quay đúng ô đã được máy chủ áp dụng, không tự quay lại kết quả.

Kỹ năng quà cao không dùng vòng quay: kết quả áp dụng ngay trên máy chủ rồi trình chiếu cảnh thiên thạch, số cây bị phá và tên nạn nhân. Chỉ chọn cây đang có, người khác đang hoạt động và không có khiên/lớp bảo vệ. Cây bị phá mất toàn bộ tiến độ, chậu nứt **8s**, sau đó gõ `trồng` để gieo lại miễn phí một lần. Không mất LV, XP, vàng hay huy hiệu. Lệnh trong thời gian nứt trả đúng thời gian còn lại; lịch trộm cũ của cây bị phá được dọn. Bản thân người gửi luôn nhận chín cây/khiên nếu có chậu, kể cả khi không có mục tiêu đối thủ.

Khi boss đang sống, quà 500–999 đánh **25% HP tối đa**, từ 1000 đánh **60% HP tối đa**; không phá cây đối thủ trong trận boss. Khiên của người gửi bảo vệ 60s, chống trộm/phá cây và sâu/cỏ mới; sâu đã có vẫn cần dọn.

## Boss cộng đồng

Mỗi phiên chỉ bốc thăm một lần, mặc định **35% có Sâu Chúa**, xuất hiện sau **2 phút** và có **60s** để đánh. HP theo số chậu hoạt động khi xuất hiện: **40 HP/người**, tối thiểu 300 và tối đa 2.000. Cấu hình: `bossChance`, `bossDelayMs`, `bossDurationMs`, `bossRewardXp`, `bossRewardGold`.

**1 tim = 1 sát thương**, giới hạn gói hợp lệ 10.000 tim; số tim vượt HP còn lại không bị tính thêm sát thương. Tim dùng đánh boss không đồng thời làm đầy thanh tim chăm vườn. Thả tim đánh boss duy trì hoạt động của người đã có chậu nhưng không tự cấp chậu cho người chỉ thả tim. HP, người đóng góp và pha trận được lưu; tải lại không bốc thăm lại hay nhận thưởng lần hai.

Thắng: mỗi người có đóng góp nhận **8 XP + 5 vàng + huy hiệu Khắc tinh Sâu Chúa**. Hết giờ: boss trốn, không phát thưởng thắng. Đổi phiên dọn trận cũ. Sân khấu boss hiện HP, đếm ngược, hướng dẫn thả tim và Top 3 sát thương; quà ưu tiên màn hình, HP vẫn được tính khi đang trình chiếu quà. Khi boss vào sân, bỏ các cú máy sự kiện cũ, giữ quà đang chờ và về toàn cảnh.

Khi boss bắt đầu, **đồng hồ phiên và tăng trưởng cây tạm dừng**. Không tự chốt phiên giữa trận; lệnh chăm vườn được nhắc chuyển sang thả tim. Thắng hoặc hết giờ sẽ tiếp tục đúng thời gian phiên còn lại, giữ thời gian hiện diện của chậu. Trạng thái tạm dừng được lưu và phục hồi khi tải lại. Đồng hồ 60s riêng của boss vẫn chạy; tim và quà vẫn được xử lý.

Control simulator gom thao tác thường dùng ở phía trên:
- **Tạo 4 chậu đối thủ** → **50 xu** để quay, **500 / 1.000 xu** để thử phá cây; kết quả chỉ rõ ai bị tác động. Khiên vẫn chặn phá, chậu nứt phải đợi 8s trước khi gieo lại.
- **Gọi boss thử**, **Thả 50 / 200 tim**, thanh HP và đồng hồ phiên ghi rõ đang tạm dừng. Quà 500 / 1.000 xu đánh boss thay vì phá chậu. Không gọi thời tiết hoặc chốt phiên khi boss còn sống.
- Phòng tự chơi luân phiên quà **50 → 500 → 1.000 → 100 → 5 → 1 xu** theo nhịp profile, thay vì chỉ quà nhỏ.
- Tên người chơi đang có trong phòng được gợi ý để thử đúng tài khoản. Quà tùy chỉnh, lệnh nâng cao và sự kiện nằm trong mục mở rộng; preview tắt tiếng để không phát nhạc hai lần.

Nút mô phỏng và API ép boss không bật ở Garden thường.

Sự kiện: Mưa mây, Bão sâu, Thương lái và Giờ vàng. Thẻ hiện tác dụng, đếm ngược và tiến độ hợp tác. Camera mở toàn cảnh rồi mới đến cây liên quan. Chỉ dùng zoom phụ sau khi hàng đợi quà/trình chiếu chính trống liên tục 6s; quà mới đặt lại khoảng chờ, boss chặn zoom phụ. Cận cảnh chỉ áp dụng khi trộm/bắt trộm, lên cấp hoặc sự kiện có cây phù hợp; cây chín/hái lần đầu không zoom; thẻ cạnh cây và control ghi rõ lý do. Cảnh cận gồm 0,8s di chuyển + 2,2–2,4s giữ; sau đó về toàn cảnh 0,9s và nghỉ 6s trước lần zoom tiếp. Quà/boss/trao giải vẫn được ưu tiên. Hết phiên xóa thời tiết cũ và lên lịch sự kiện mới.

Kiểm thử mô phỏng/trình duyệt không xác nhận việc nhận quà từ TikTok LIVE thật hoặc hiển thị trong OBS.

## Theo dõi simulator ngoài khung LIVE

Control đặt preview cạnh bảng **Đang phát & hàng đợi** trên desktop. Bảng nhận trạng thái từ chính iframe bằng kênh cùng origin, kiểm tra đúng cửa sổ gửi; thông tin này không xuất hiện trên overlay LIVE. Hiển thị cảnh đang phát, kết quả vòng quay/kỹ năng, số yêu cầu chính/phụ, tám yêu cầu đầu theo ưu tiên và độ tuổi, lý do chặn, thời gian chờ rảnh, boss/thời tiết/phiên và FPS preview. Tổng hàng đợi vẫn đầy đủ khi chỉ hiển thị tám mục đầu. Tab bị ẩn được đánh dấu vì trình duyệt có thể giảm FPS.

Mục **Camera ở server** là hàng đợi camera riêng, không đồng nhất với hàng đợi trình chiếu trong preview. Mất dữ liệu preview sẽ báo rõ sau 2,5s; server cũ chưa hỗ trợ diagnostics sẽ yêu cầu nạp lại, không hiện hàng đợi trống giả. Avatar thiếu/hỏng dùng chữ viết tắt. Snapshot chốt phiên giữ avatar Top 5, cả khi mở lại sau đổi phiên; thưởng Top 3 không đổi.

Kế hoạch UX/animation tiếp theo: `docs/superpowers/plans/2026-11-05-garden-experience-animation.md`.
