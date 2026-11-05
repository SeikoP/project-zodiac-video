# Garden — audit trải nghiệm và chuẩn bị TikTok LIVE Studio

Ngày: 2026-11-05. Trạng thái: báo cáo và đề xuất để review; chưa triển khai các sửa lỗi bên dưới.

**Bổ sung phạm vi:** Bản này tập trung lỗi kỹ thuật, chưa đủ để nghiệm thu toàn bộ yêu cầu người dùng. Xem [28 yêu cầu và audit bổ sung âm thanh/nguồn phát](2026-11-05-garden-requirements-audit.md), [thiết kế đầy đủ](../specs/2026-11-05-garden-complete-experience-design.md) và [kế hoạch T00–T12](2026-11-05-garden-complete-experience.md). Các tái hiện bên dưới vẫn giữ nguyên giá trị; kế hoạch mới thay phần lộ trình tổng quát ở cuối bản này.

**Garden làm gì:** Người xem bình luận để nhận chậu, chăm/hái cây, lên cấp và đua phiên; quà có thể tưới, quay thưởng hoặc phá cây, tim dùng đánh boss. Server lưu kết quả; overlay dựng hình và phát cảnh, control theo dõi và mô phỏng. Audit giả định 1–48 người có chậu, gồm đợt nhiều lệnh/quà liên tiếp; bản hiện tại có 48 chỗ, chưa dùng làm bằng chứng phục vụ 100–400 người.

**Kết luận:** Chưa nên coi là sẵn sàng LIVE đầy đủ. Cần sửa mục 1–5 trước; sau đó tối ưu nội dung theo ngữ cảnh, khoảng trống và animation. OBS đã bỏ khỏi phạm vi theo yêu cầu; đích phát là TikTok LIVE Studio.

## Bằng chứng và giới hạn

- Đọc luồng command/gift → Garden → lưu trạng thái → camera/coalescer → SSE/poll → overlay/presentation → diagnostics/control, cùng cấu hình và entrypoint liên quan.
- Chạy mới `node --test --test-concurrency=1`: **601 pass, 0 fail**, khoảng 21,2 giây. Các tái hiện bổ sung dưới đây vẫn chứng minh có lỗi mà bộ hiện tại chưa bắt.
- Tái hiện có assert bằng đồng hồ giả: thời tiết kẹt, thời gian cây/buff khi boss, backlog quà, gộp 48 lượt tưới. Kiểm tra Chromium thật với server/data tạm riêng, `tiktok:false`: 1/4/12/24/48 chậu, reload vòng quay, boss bị quà che, desktop/mobile; không có lỗi JavaScript.
- Bằng chứng cục bộ: `logs/garden-audit-prelive-20261105/` gồm `reproductions.json`, `browser-audit.json`, `test-suite.txt`, ảnh `density-*.png`, `gift-before-reload.png`, `gift-after-reload.png`, `boss-behind-gifts.png`, `control-desktop.png`, `control-mobile.png`. Thư mục logs bị Git ignore; muốn chuyển máy phải mang theo bằng chứng riêng.
- Phòng đang chạy 4858 vẫn giữ nguyên: simulator, 12 bot, autoplay bật, diagnostics v1. PID 7056 bắt đầu 11:06; file server sửa 11:20, nên không coi tiến trình này là bằng chứng đã nạp backend mới nhất. Các kiểm tra cách ly nạp mã hiện tại từ đĩa.
- LIVE Studio được cài ở thư mục phiên bản 1.39.2, chưa thấy tiến trình chạy lúc kiểm tra. Chưa xác nhận scene/source/mixer đang dùng. Không sửa DB riêng của Studio, không kết nối TikTok, không reset hoặc dừng simulator.

## Cần sửa trước LIVE

### 1. Thời tiết có thể kẹt vĩnh viễn ở `pending` — P1

- **Thành phần:** `garden/events.mjs:23`, `garden/events.mjs:65`, `garden/camera.mjs:60`, `garden/camera.mjs:79`, `garden/server.mjs:162`.
- **Vấn đề:** Thời tiết chỉ bắt đầu khi camera phát đúng shot. Khóa camera rồi ép mưa, chờ 10s, mở khóa và chờ 5s: mưa vẫn pending, queue rỗng. Đẩy mưa ra khỏi queue bằng 8 quà cũng làm nó pending sau 60s, không tự phục hồi.
- **Sửa nhỏ nhất:** Không để kết quả gameplay phụ thuộc vào việc camera có phát được shot. Giữ quyền ưu tiên boss/awards, nhưng pending phải được thực thi hoặc hủy có lý do trong thời hạn hữu hạn; camera chỉ trình bày trạng thái đó. Chọn một vòng đời duy nhất trong `events`, không thêm scheduler song song.
- **Nếu bỏ qua:** Một lượt khóa hoặc burst quà có thể làm mất thời tiết cho phần còn lại của phiên.

### 2. Boss mới dừng tăng trưởng và đồng hồ phiên, chưa dừng mọi hạn chăm cây — P1

- **Thành phần:** `garden/garden.mjs:40`, `garden/garden.mjs:121`, `garden/care.mjs`, `garden/crops.mjs`.
- **Vấn đề:** Cây đã chín 100s, buff tưới/khiên còn 30s; đánh boss 45s trong khi lệnh hái bị chặn. Sau boss cây chuyển chín → quá lứa, hái chỉ được **5 thay vì 10 vàng**; buff tưới và khiên đều hết.
- **Sửa nhỏ nhất:** Quy định rõ các mốc dùng thời gian chăm vườn và dịch chúng đúng một lần khi resume: ripeAt, hạn buff/debuff, khiên/chó, trạng thái chậu hỏng và các cooldown liên quan. Giữ đồng hồ boss chạy thật; quà đến giữa boss chỉ bù phần từ lúc quà được áp dụng. Kiểm tra lưu/tải và restart giữa boss để tránh bù hai lần.
- **Nếu bỏ qua:** Người chơi bị giảm lợi ích dù hệ thống đã chặn việc chăm/hái để họ tập trung đánh boss.

### 3. Quà trong hàng đợi che boss trong lúc thời gian đánh vẫn chạy — P1

- **Thành phần:** `public/garden/garden.js:232`, `public/garden/garden.js:267`, `public/garden/presentation.js:13`.
- **Vấn đề:** Trong Chromium, gửi nhiều quà 50 rồi gọi boss: native báo `active`, vòng quay đang hiện, `#bossArena` không hiện. `blocked` chỉ chặn hồ sơ; quà tiếp tục chiếm cảnh. Thanh HP nhỏ còn hiện nhưng không đáp ứng yêu cầu tập trung đánh boss.
- **Sửa nhỏ nhất:** Boss giữ sân khấu trong suốt trận. Quà lúc boss hiện bằng ghi công/đòn đánh ngay trên sân khấu; cảnh quà cũ rút thành kết quả gọn, không nối tiếp modal che boss. Không trì hoãn trừ HP hoặc tính thưởng để chờ animation.
- **Nếu bỏ qua:** Burst quà có thể che phần lớn hoặc toàn bộ 60s đánh boss, dù mọi phép tính vẫn đúng.

### 4. Hàng đợi cảnh quà không có giới hạn tuổi/kích thước — P1

- **Thành phần:** `public/garden/presentation.js:11`, `public/garden/presentation.js:16`, `garden/camera.mjs:69`.
- **Vấn đề:** 30 vòng quay × 6s tạo khoảng 180s trình chiếu. Sau 24s còn 25 cảnh chờ, cảnh cũ hơn thời hạn trêu cây 20s; gameplay đã xử lý từ lúc nhận quà. Camera và overlay còn có hai cách gộp/xếp hàng khác nhau, nên thời gian chờ phụ có thể lệch.
- **Sửa nhỏ nhất:** Lưu mọi kết quả/ghi công đã nhận; giới hạn phần được kể bằng cảnh dài theo thời gian chờ. Khi quá hạn, chuyển thành kết quả gọn có người gửi và mục tiêu, không quay lại hiệu ứng đã hết. Đồng bộ quy tắc đủ điều kiện zoom/hồ sơ với trạng thái trình chiếu thay vì chỉ cộng ước lượng thời lượng.
- **Nếu bỏ qua:** Người xem thấy kết quả cũ sau khi trạng thái đã đổi, hoặc phiên kết thúc và xóa cảnh chưa từng được thấy.

### 5. Mở/reload overlay giữa quà làm mất cảnh — P1

- **Thành phần:** `garden/server.mjs:247`, `garden/server.mjs:257`, `public/garden/garden.js:170`, `public/garden/garden.js:onMessage`.
- **Vấn đề:** SSE/poll gửi meta + state + lastShot, nhưng không gửi lại kết quả quà đang trình chiếu. Browser thấy vòng quay trước reload, sau reload 750ms vòng quay không còn; native đã áp dụng kết quả.
- **Sửa nhỏ nhất:** Dùng ID quà hiện có để truyền snapshot kết quả còn hiệu lực hoặc kết quả gọn gần nhất khi subscriber mới vào. Khôi phục phần trình bày theo thời gian đã trôi; tuyệt đối không gọi lại applyGift/spin/strike. Kiểm tra cả SSE và poll.
- **Nếu bỏ qua:** Chuyển source, mất mạng hoặc reload trong Studio có thể làm quà biến mất khỏi trải nghiệm dù người gửi đã trả tiền.

## Nên sửa trong vòng tối ưu trải nghiệm

### 6. Hướng dẫn không đổi theo boss/trao giải — P2

- **Thành phần:** `public/garden/garden.js:36`, `public/garden/garden.js:849`.
- **Vấn đề:** 13 hướng dẫn đổi theo đồng hồ chung mỗi 6s, độc lập với boss/awards. Ảnh boss đang chạy vẫn ghi “Đua phiên · 10 phút”; các bước chăm/hái có thể hiện khi thao tác bị chặn.
- **Sửa nhỏ nhất:** Ưu tiên CTA theo phase: boss → thả tim/đòn quà; awards → vinh danh/đếm ngược; chưa có chậu → trồng; đang chơi → hành động có ích tiếp theo. Chỉ xoay mẹo chung khi không có việc cần làm.
- **Nếu bỏ qua:** Người mới làm theo hướng dẫn và nhận lệnh bị chặn ngay.

### 7. Phòng ít người để trống phần lớn kệ — P2

- **Thành phần:** `public/garden/garden.js:drawTier`, `public/garden/garden.js:drawShelfFronts`, `garden/camera.mjs:15`.
- **Vấn đề:** Khung luôn dựng đủ 8 tầng mỗi cánh. 12 người chỉ lấp hai tầng, còn 36/48 ô trống; hình ảnh giống một khu vườn chưa hoạt động, cây vừa gieo rất nhỏ trên toàn cảnh.
- **Sửa nhỏ nhất:** Giữ slot/chậu ổn định; dùng một vùng kệ chưa có người cho mục tiêu kế tiếp hoặc spotlight ngắn chỉ sau 6s yên. Nếu cần phóng lớn phòng nhỏ, chỉ chọn bố cục tại ranh giới phiên, không xô chậu khi có người vào/rời.
- **Nếu bỏ qua:** Khoảng trống chiếm nội dung nhưng không giúp người mới biết tiếp theo làm gì. Không suy ra tỷ lệ pixel trống từ số ô.

### 8. Animation mới phủ một phần thao tác — P2

- **Thành phần:** `public/garden/garden.js:133`, `public/garden/garden.js:280`, `public/garden/garden.js:drawPlot`, `public/garden/identity.js`.
- **Vấn đề:** Trồng/tưới/help/levelup có motion; hái có chữ +vàng và âm thanh nhưng thiếu chuyển cây → thu hoạch → chậu trống. Bón phân/bắt sâu/nhổ cỏ có âm thanh và cập nhật trạng thái, thiếu chuyển động tác động riêng. Quà lớn có card/kết quả và rung chậu, chưa kể rõ đường bay tới đúng cây rồi phá/gieo lại.
- **Sửa nhỏ nhất:** Bổ sung các pha ngắn trực tiếp vào renderer/motion hiện có, dùng ID mục tiêu và dữ liệu trước/sau từ native. Nhóm thao tác đông thành phản hồi tổng; không animate toàn bộ 48 cây đồng thời.
- **Nếu bỏ qua:** Tác vụ đã thành công nhưng khó cảm nhận, đặc biệt khi nhìn qua màn hình điện thoại.

### 9. Control hẹp tách thao tác khỏi preview — P2

- **Thành phần:** `public/garden/control.css`, `public/garden/control.html`, `public/garden/control.js`.
- **Vấn đề:** 390×844 không tràn ngang nhưng preview bắt đầu ở y=2.304px. Host phải cuộn xa giữa bấm quà và nhìn cảnh; desktop có hai cột nhưng quá nhiều khối thống kê/thi đua lặp lại chiếm chiều cao.
- **Sửa nhỏ nhất:** Desktop giữ preview + trạng thái đang phát ở vùng cố định, thao tác và log cuộn riêng. Màn hình hẹp có chế độ “Thử / Xem / Nhật ký” dùng dữ liệu hiện có; đặt trạng thái hành động cạnh nút. Reset và lệnh ít dùng tiếp tục trong mục mở rộng.
- **Nếu bỏ qua:** Khó biết thao tác gây cảnh nào và khó audit nhịp LIVE khi dùng màn hình nhỏ.

### 10. Nguồn phát và vùng an toàn LIVE Studio chưa được nghiệm thu — P2, cổng vận hành

- **Thành phần:** `garden/server.mjs:325`, `package.json`, `public/garden/garden.js:52`, bộ tham chiếu `ops/live-studio-garden/`.
- **Vấn đề:** 4858 hiện là simulator; `npm run live/check/obs` thuộc luồng PK khác, không chứng minh Garden sẵn sàng. Garden chưa có xử lý safe-area riêng qua `?safe=1`; ảnh cuối kệ gần mép dưới. Chưa đo phần bị UI TikTok che trên điện thoại.
- **Sửa nhỏ nhất:** Dùng đúng nguồn 4858, canvas dọc và một đường âm thanh; đo phần bị che bằng preview/điện thoại thực tế rồi dịch nội dung quan trọng. Thực hiện checklist LIVE Studio đính kèm; khi đổi simulator → thật phải backup và dừng đúng tiến trình để dùng cùng một port.
- **Nếu bỏ qua:** Có thể phát nhầm bot/control, mất tiếng/lặp tiếng, hoặc tên/cảnh báo nằm dưới UI TikTok. Chưa kết luận có overlap cụ thể khi chưa xem source Studio và điện thoại thật.

## Zoom hiện tại: cái gì đang chiếm màn hình?

| Cơ chế | Điều kiện hiện tại | Thời lượng cấu hình mặc định |
|---|---|---|
| Lên LV | Có plotId; chỉ khi hết ưu tiên chính và đủ 6s rảnh | 0,8s di chuyển + 2,2s giữ |
| Trộm / bắt trộm | Cận cây mục tiêu; cùng điều kiện rảnh | 0,8s + 2,4s |
| Mưa / bão sâu / thương lái / giờ vàng | Mở toàn cảnh; sau active chọn cây phù hợp, cận khi rảnh | Mở 0,9s + 3,2s; cận 0,8s + 2,2s |
| Cây chín / hái lần đầu / vào vườn / lệnh “vườn” | Không tạo shot cận | Không zoom |
| Quà thường / vòng quay / phá cây | Camera về toàn cảnh; cảnh foreground riêng có thể che vườn | 3,2s / 6s / 5s mỗi cảnh |
| Boss / chốt phiên | Toàn cảnh, sân khấu riêng | Boss tối đa 60s; trao giải 8s |

Sau cận: về toàn cảnh 0,9s và nghỉ 6s. Nhiều cảnh quà nối nhau trông giống zoom kéo dài nhưng thực tế là lớp trình chiếu che vườn. Cần sửa mục 3–4 trước khi chỉ giảm `zoomClose` hoặc duration.

Đề xuất sau khi sửa ưu tiên: giữ chờ rảnh 6s đúng yêu cầu 5–7s; thử cận 0,45–0,6s vào, 1,5–1,8s đọc, 0,5–0,65s ra; vòng quay 3–4s tổng và impact 2–3s. Đây là giá trị thử nghiệm, phải kiểm tra tên dài/kết quả/avatar ở kích thước điện thoại trước khi chốt. Quà đến hoặc boss bắt đầu phải thu gọn cảnh phụ ngay; không cắt kết quả quan trọng giữa chừng.

## Vòng tận dụng khoảng trống

| Số người | Ô trống / 48 | Tỷ lệ ô trống | Nội dung nên ưu tiên |
|---|---|---|---|
| 1 | 47 | 97,9% | Một chu kỳ trồng → chăm → hái; mục tiêu cá nhân dễ đạt |
| 4 | 44 | 91,7% | Cùng chăm, chỉ rõ ai vừa giúp ai |
| 12 | 36 | 75% | Mục tiêu nhóm và spotlight sau 6s rảnh |
| 24 | 24 | 50% | Trạng thái cây có vấn đề; giảm trang trí |
| 48 | 0 | 0% | Chỉ giữ tên/LV/trạng thái quan trọng; tổng hợp burst |

Nguyên tắc bố trí:

1. Header phải có một hành động đúng ngữ cảnh; không dành diện tích lớn cho mẹo không dùng được.
2. Khi zoom ẩn Top 5, tái dùng vùng header phải cho avatar/LV/thành tựu/trạng thái người được focus. Không thêm hàng header hoặc hồ sơ phủ lên nhiều chậu.
3. Một vùng kệ rỗng có thể hiện “việc tiếp theo”, tiến độ nhóm, cây sắp mở theo LV hoặc người vừa giúp; chỉ dùng một nội dung, tự nhường ngay khi có cảnh chính/người vào.
4. Không lấp mọi khoảng trống bằng chữ. Giữ khoảng thở giữa silhouette cây, tên chậu và trạng thái; không dời vị trí chậu trong một lượt tưới/hái.
5. Preview, hàng đợi và cơ chế đang chạy chỉ ở control. Mở overlay độc lập không được lộ debug.

## Ma trận animation cần hoàn thiện

| Tác vụ | Đã có | Bổ sung cần thiết và dấu hiệu hoàn tất |
|---|---|---|
| Trồng | Nảy cây/âm thanh | Hạt xuống đất → mầm lên → tên chủ; không zoom; thấy phản hồi ngay |
| Tưới / giúp | Giọt nước, motion ngắn; coalescer giữ tối đa 8 plot/250ms | Dòng nước → đất ướt → tăng trưởng/XP; burst có tổng “48 lượt”, không làm người còn lại tưởng bị mất lệnh |
| Hái | +vàng, âm thanh, state thành chậu trống | Giữ hình cây vừa hái đủ để kể kết quả → nông sản/vàng → chậu trống; hiển thị XP phù hợp |
| Bón phân | Âm thanh, trạng thái | Rắc phân → tan vào đất → dấu tăng tốc; thể hiện chi phí/kết quả, không tạo modal |
| Bắt sâu / nhổ cỏ | Âm thanh, vấn đề biến mất | Sâu/cỏ rời cây → cây hồi phục → ghi công nếu giúp; mục tiêu không có vấn đề không giả diễn thành công |
| Quà 1 / 5 / 100 | Hero + ring/giọt, native effect | Sương tưới / sao bón / mưa lan vùng khác nhau; mục tiêu đúng; một kết quả gọn sau burst |
| Vòng quay 50 | Quay 2,6s, panel 6s, tên kết quả | Chỉ tới đúng ô → nối tới avatar/cây mục tiêu → thời hạn/gỡ hiệu ứng; phục hồi giữa cảnh, không spin lại native |
| Phá 500 / 1.000 | Card kết quả, rung và chậu hỏng | Báo mục tiêu → thiên thạch/địa chấn → khiên chặn hoặc cây vỡ → thời gian gieo lại; phân biệt 1 và tối đa 3 mục tiêu |
| Boss | HP, damage, hình boss, thưởng | Intro ngắn → đòn tim/quà gộp → phản ứng HP → thắng/trốn; sân khấu không mất khi quà tới |
| LV / danh hiệu | Avatar, LV, bậc chậu, sparkle | Silhouette đổi rõ; một mốc chính mỗi lượt; hiển thị thành tựu có ý nghĩa theo ưu tiên |
| Top 5 / chốt phiên | Avatar, chuyển hạng, stagger | Đọc đủ 5 người ở kích thước phát; nhận giải giữ identity sau reload và người rời |

Mỗi chuyển động phải có kết quả tĩnh tương đương khi reduced-motion. Không để animation quyết định kết quả native; dùng dữ liệu trước/sau cho hình ảnh, giữ anchor chậu trên kệ. Không thêm thư viện animation trước khi renderer hiện tại chứng minh thiếu khả năng.

## Nhận diện cây, chậu và thành tựu

- Giữ font Patrick Hand, màu/nét doodle và bóng phẳng của kênh. Hiện đã có 5 silhouette chậu và 3 cây × 3 biến thể; không thay bộ đó bằng một chậu chỉ đổi màu.
- Chậu: tách bậc bằng miệng/thân/chân/họa tiết, rồi thêm chi tiết nhỏ theo LV trong bậc. Không để trang trí che tên, thanh tiến độ hoặc sâu/cỏ.
- Cây: silhouette khác nhau ở mầm/lớn/chín; golden/lush cần nhận ra bằng hình dáng/chi tiết ngoài màu. Kiểm tra ở ảnh toàn cảnh 540×960 và bản thu nhỏ trên điện thoại.
- Danh hiệu: giữ các mốc hái10/50, giúp20, bắt sâu20 và boss/podium đã có. Chỉ đề xuất thêm chuỗi chăm, cứu vườn và trở lại nhiều phiên sau khi kiểm tra cách lưu/cấp thưởng; tránh dồn nhiều thông báo cho cùng một hành động.

## Lộ trình triển khai đề xuất

Các bước dưới đây là thứ tự sửa để review, không phải xác nhận đã làm. Không commit/release/package tự động; bảo toàn dirty tree hiện tại.

### Đợt A — trạng thái và thời gian, xử lý mục 1–2

- [ ] Thêm test từ `reproductions.json` vào `garden/events.test.mjs`, `garden/camera.test.mjs`, `garden/boss.test.mjs`, `garden/care.test.mjs`.
- [ ] Sửa `events`/server để khóa/drop camera không khóa gameplay; test cả không có overlay.
- [ ] Sửa resume trong `garden/garden.mjs` và các nơi kiểm tra deadline; thêm boss thắng/hết giờ, lưu/tải, quà giữa trận và resume đúng một lần.
- [ ] Chạy `node --test garden/events.test.mjs garden/camera.test.mjs garden/boss.test.mjs garden/care.test.mjs garden/garden.test.mjs garden/server.test.mjs`.
- [ ] Nghiệm thu: cây không mất nửa sản lượng vì boss; buff/debuff giữ đúng thời gian chăm còn lại; event không pending vô hạn.

### Đợt B — trình chiếu và phục hồi, xử lý mục 3–5

- [ ] Bổ sung test `garden/presentation.test.mjs` cho burst 30 quà, boss đến giữa vòng quay, tuổi hiệu ứng và session-end.
- [ ] Sửa `public/garden/presentation.js` + `garden.js` cho boss giữ sân khấu, quà quá trễ thành kết quả gọn. Tận dụng ID quà hiện có; không tạo engine hàng đợi thứ ba.
- [ ] Sửa `garden/server.mjs`, test `garden/server.test.mjs`: snapshot SSE/poll khôi phục đúng kết quả, không nhân thưởng/thiệt hại. Đồng bộ camera idle với trình chiếu trong `garden/camera.mjs` khi cần.
- [ ] Nghiệm thu bằng browser: reload vòng quay/impact/boss; burst rồi gọi boss; mất kết nối/đổi subscriber; kết quả quà được ghi nhận, boss luôn nhìn thấy, không phát cảnh hết hạn như cảnh mới.

### Đợt C — không gian, hướng dẫn và control, xử lý mục 6–7/9–10

- [ ] Chỉnh `public/garden/garden.js`, `garden.css`, `index.html`: CTA theo phase, tái dùng header khi focus, nội dung vùng trống chỉ sau idle6s. Giữ slot ID/vị trí người chơi.
- [ ] Chỉnh `public/garden/control.html`, `control.css`, `control.js`: nút thử + kết quả + preview dễ đối chiếu; chế độ hẹp không buộc cuộn hơn hai màn hình để xem phản hồi.
- [ ] Chụp lại 1/4/12/24/48 người, tên tiếng Việt dài/avatar lỗi; boss/awards/focus phải đúng CTA; kiểm tra font/contrast/kích thước thực.
- [ ] Đo nguồn LIVE Studio/điện thoại trước khi chốt vùng an toàn; chỉ chỉnh khoảng đệm sau khi có hình thực tế, không giả định `?safe=1` đã hỗ trợ Garden.

### Đợt D — animation và nhận diện, xử lý mục 8

- [ ] Bổ sung hái/bón/sâu/cỏ và khác biệt từng quà theo ma trận; mở rộng motion hiện có, không làm lại toàn bộ asset.
- [ ] Thêm snapshot trước/sau cần thiết vào `garden/fx.mjs`, care/gift event nếu renderer thiếu; test đồng bộ với `garden/fx.test.mjs`, `garden/interaction.test.mjs`, `garden/gifts.test.mjs`.
- [ ] Chụp/ghi chuỗi chuẩn bị → tác động → kết quả; kiểm tra reduced-motion và 48 hành động đồng thời với phản hồi tổng.
- [ ] So sánh nhịp zoom/card đề xuất ở kích thước điện thoại; không chốt thời lượng chỉ theo cảm giác trên desktop.

### Đợt E — diễn tập trên TikTok LIVE Studio

- [ ] Chạy đầy đủ suite một lần sau thay đổi cuối, rồi diễn tập 15–20 phút với 1/12/48 người giả lập trên máy phát thật.
- [ ] Làm checklist `ops/live-studio-garden/README.md`; lưu ảnh source/khung dọc/mixer/điện thoại và kết quả từng tình huống.
- [ ] Chuyển một cổng từ sim sang thật theo hướng dẫn; tài khoản đang LIVE mới kiểm tra chat/tim/quà bằng tài khoản phụ. Ghi rõ chưa kiểm tra gì thay vì gọi PASS từ dữ liệu mô phỏng.
- [ ] Chỉ xác nhận sẵn sàng khi nguồn đúng, không debug/control/bot trên nguồn thật, tiếng không lặp, vùng quan trọng không bị UI che, reconnect không mất kết quả, boss/time/awards đúng.

**Không kiểm tra:** Thu hình/mixer trong LIVE Studio, mạng tới khán giả, nhận quà LIVE thật, chất lượng trên điện thoại thật và hiệu năng GPU khi Studio mã hóa. Bộ 601 test và Chromium cách ly không thay thế các cổng này.
