# Garden — đối chiếu đầy đủ yêu cầu và audit bổ sung

Ngày 2026-11-05. Bổ sung cho [audit lỗi trước](2026-11-05-garden-prelive-audit.md), không rút lại các tái hiện đã có. Đây là audit phạm vi và thiết kế dựa trên source; không phải thông báo mọi mục đã được kiểm thử lại.

## Vì sao bản trước thiếu

Bản trước xếp hạng lỗi gameplay/camera tốt hơn là kiểm đủ yêu cầu. Nó chưa có tiêu chí nghiệm thu riêng cho từng yêu cầu, chưa lập danh mục SFX/khung runtime âm thanh, còn gộp phục hồi đa dạng với bổ sung nội dung, và chưa phân biệt iframe preview với cửa sổ phát thật. Các mục đã có code như trồng tự động/avatar cần được nghiệm thu chứ không biến mất khỏi kế hoạch.

## Bảng truy vết

“Có nền” = source hiện tại đã có một phần, chưa đồng nghĩa đạt trải nghiệm. T là task trong [kế hoạch triển khai](2026-11-05-garden-complete-experience.md).

| ID | Yêu cầu người dùng | Hiện trạng/gap cần chốt | Task | Bằng chứng phải có |
|---|---|---|---|---|
| R01 | Chỉ comment “trồng”, tự lọc cây theo LV | Có chọn theo LV/vàng; thiếu nghiệm thu mọi ranh giới và lời giải thích lựa chọn | T03 | LV1/2/4, đủ/thiếu vàng, gieo miễn phí, lệnh không dấu/sai tên |
| R02 | Biết đang zoom vì sự kiện gì | Camera có reason nhưng thiếu đối chiếu cảnh đang thu thực tế | T02,T09 | Cùng eventId, reason trong control, phân biệt camera và modal |
| R03 | Zoom ngắn hơn | Cận3s+, vòng quay6s, burst dài; chưa có ngân sách đọc/che | T02,T06 | Timeline duration, ảnh đọc tên/kết quả ở 360×640 |
| R04 | Bỏ zoom cây chín/hái đầu hoặc chỉ khi ít người | Đã bỏ; chọn giữ bỏ hoàn toàn cho đợt này, cần test chống tái phát | T02 | ripe/firstHarvest ở1/48 người không sinh shot |
| R05 | “vườn” dùng liên tục không che khuất | Có throttle/TTL/latest; chưa test spam nhiều người xen quà/boss | T02,T03 | 100 lệnh, một yêu cầu mới nhất, không modal và không backlog |
| R06 | Có hồ sơ khi zoom | Có card cạnh cây; cần đủ identity, action, không overlap khi cây lớn | T04,T05 | Tất cả loại shot hợp lệ, đủ avatar/LV/XP/vàng/mốc |
| R07 | Queue trống5–7s mới dùng thao tác che/zoom | Có 6s nhưng server ước lượng và client queue riêng | T02,T09 | Idle6s của nguồn LIVE, quà mới reset, stale chặn phụ |
| R08 | Boss dừng thời gian và tập trung đánh boss | Dừng chưa đủ deadline; quà che arena | T01,T02,T06 | Crop/buff/clock trước-sau, quà giữa trận, arena không mất |
| R09 | Mô phỏng quà >50, vòng quay/phá hủy | Có nút50/100/500/1.000; thiếu fixtures/kịch bản tất cả nhánh | T06,T10 | Khiên/no-target/full-room/awards/boss/tổngxu/reload |
| R10 | Tối ưu bảng điều khiển | Có two-column; mobile preview quá xa; chưa có thư viện âm/checklist | T09,T10,T11 | Desktop và390px, bấm→native→scene trong cùng luồng |
| R11 | Cây/chậu đúng token kênh | Có palette/silhouette; chưa audit toàn bộ asset và crop-stage alignment | T05 | Contact sheet và kiểm anchor/palette/stroke/font |
| R12 | Khôi phục đa dạng chậu/cây đã yếu đi | Có5 silhouette và3×3 cây; chưa có tiêu chí phân biệt trên điện thoại | T05 | Silhouette ở toàn cảnh/cận/reduced-motion; không chỉ đổi màu |
| R13 | Bổ sung thêm đa dạng | Bản trước chỉ phục hồi/hoãn thêm | T05 | 5 họa tiết kiếm qua mốc + chi tiết trưởng thành riêng mỗi cây |
| R14 | Thông báo nổi bật theo LV/cấp bậc/thành tựu | Có avatar/LV/tier và priority; chưa giải quyết nhiều mốc cùng hành động | T04,T08 | Một thẻ/một âm gộp, đọc được; không che cây/đè quà |
| R15 | Bổ sung thành tựu/tiến bộ | Có harvest10/50/help20/pest20; chưa có bộ mốc mở rộng rõ | T04 | Hái100/help50/pest50, lưu/tải, không thưởng/announce lặp |
| R16 | Tối đa trải nghiệm người mới/phòng ít người | Bản trước chủ yếu geometry; chưa nghiệm thu chu kỳ hoàn chỉnh | T03,T10 | 1 người trồng→chăm→hái→trồng, CTA đúng, không cần quà/đám đông |
| R17 | Top5 có avatar | Có nền; cần đủ empty/tie/long name/broken avatar/leaving | T04 |0/1/5/48 người, fallback an toàn, order đúng |
| R18 | Chốt phiên có avatar | Có snapshot5 và XP3; chưa gắn audio/cảnh/kịch bản đầy đủ | T04,T06,T08 |5 identity, ít người thật, reload/mất kết nối không trả hai lần |
| R19 | Simulator có monitor ngoài màn chiếu | Có iframe diagnostics; thiếu nguồn LIVE riêng | T09 | Hai client khác queue, host nhìn đúng nguồn đang thu |
| R20 | Biết queue và cơ chế đang diễn ra | Có camera/presentation; thiếu lifecycle/drop/expiry/phase/audio | T02,T08,T09 | Counts, oldestAge, reason, event phase, build, audio state |
| R21 | Audit tận dụng khoảng trống của thành phần/nội dung | Có tỷ lệ ô trống; chưa kiểm header/profile/rack/CTA đồng bộ | T05 |1/4/12/24/48 + zoom/boss/awards, nội dung nhường đúng |
| R22 | Animation đầy đủ tưới/hái/quà và tác vụ khác | Có motion một phần; thiếu choreography và snapshot trước/sau | T06,T08 | Ma trận tác vụ: chuẩn bị→tác động→kết quả + cue tương ứng |
| R23 | Setup đầy đủ trước LIVE | Có hướng dẫn; chưa có readiness/control/audio test và acceptance package | T09,T11 | Preflight, rehearsal report, lỗi đỏ không bị gọi PASS |
| R24 | Dùng TikTok LIVE Studio, bỏ OBS | Tài liệu mới đã đổi; tài liệu cũ còn nhắc OBS | T11 | Runbook canonical, không lệnh OBS, source/mixer/phone thực |
| R25 | Bổ sung kho âm/SFX | Có35 file31 role chung, không có catalog chăm vườn chuyên biệt | T07 |36 role/50 sample review, metadata nguồn, nghe được theo nhóm |
| R26 | Chất âm hữu cơ vui nhẹ | Người dùng xác nhận nước/đất/lá/chuông mềm | T07,T08 | Nghe duyệt riêng và trong mix, không chói/lấn lời host |
| R27 | Khung triển khai hoàn chỉnh, không bỏ sót | Bản trước thiếu traceability/dependencies/definition of done | T00,T12 | Mỗi R-ID có task và bằng chứng; không dùng test tổng thay từng cổng |
| R28 | Âm/animation tăng trải nghiệm khi đông | Chưa có voice priority/scene sync/no-replay/control audio | T07,T08,T10 | Burst48, cue gộp, voice cap, quà/boss vẫn nghe đúng pha |

## Audit âm thanh và vận hành bổ sung

### A11 — Chưa có ngôn ngữ âm riêng cho chăm cây

`public/garden/garden.js:handleFx` dùng sparkle cho trồng, cleared cho hái/bắt sâu, cardFlip cho nhổ cỏ và boon cho phân; tưới/help chỉ animate mà không có cue riêng. Người nghe khó phân biệt hành động. T07–T08 lập cue Garden hữu cơ và đồng bộ với pha hình ảnh.

### A12 — Thêm manifest role thôi chưa phát được sample mới

`public/sfx.js:138` lấy `SOUNDS[name]` rồi return nếu không có, trước khi nhìn `samples[name]`. Thêm `water` vào manifest mà chưa đổi guard sẽ không phát. Cần cho sample role hợp lệ chạy độc lập synth; có fallback, test giữ API cũ của PK.

### A13 — Giới hạn8 âm/s không bảo vệ âm quan trọng hoặc độ chồng

`public/sfx.js:138–148` chỉ giới hạn số lần bắt đầu, không có priority hay số BufferSource đang phát. Một burst có thể làm milestone/boss cue bị bỏ và sample dài vẫn chồng. T08 thêm cap voices, priority, coalescing và duck leases; không chỉ tăng số8.

### A14 — Loader chưa phù hợp kho lớn và chưa có trạng thái nghe được

`loadSamples` fetch/decode theo từng role/file, cùng file có thể decode lặp; ready chỉ là AudioContext chưa closed, không chứng minh sample đã tải hoặc context đã chạy. Có fallback yên lặng về mặt chẩn đoán. T07 thêm cache/warmup/status; T09 hiện blocked/missing/fallback trên đúng nguồn phát.

### A15 — Có kho nhạc nhưng chưa chứng minh hợp Garden và mix LIVE

Inventory thực:35 MP3/~3,43MB/31role, manifest không thiếu file; playlist calm2/upbeat18/skipped1. Chưa nghe mức âm/thời lượng/nội dung; folder hợp lệ không chứng minh cue phù hợp. T07 chọn asset theo brief, T08 mix, T11 nghe bản thu Studio; chưa tải thêm hay tuyên bố license mới đạt.

### A16 — Queue iframe không đại diện tất cả màn hình

Mỗi overlay giữ presentation queue local; reconnect nhận frame/lastShot khác thời điểm. `postMessage` hiện báo đúng iframe, nhưng cửa sổ được Studio thu có thể khác queue/phase. T09 phải có clientId/role/stale và monitor nguồn LIVE độc lập.

### A17 — Tài liệu nhận diện/bố cục có nhiều đời khác nhau

DESIGN cũ mô tả bốn khu và safe-area, full-frame plan sau đó ghi48 slot không safe-zone; README/plan cũ còn các số Top3/6 và OBS. Chỉ dùng token của DESIGN cũ, hợp nhất tài liệu mới có thứ tự ưu tiên; không coi mục đã tick trong plan lịch sử là nghiệm thu hiện tại. T05/T11 xử lý phần này.

## Phần chưa được gọi là đã audit xong

- Không nghe 35 sample bằng tai, chưa đo độ chói/độ lớn thực và chưa kiểm quyền từng asset mới (chưa chọn/download).
- Chưa đo pixel overlap/contact sheet toàn bộ cây/chậu, phản hồi người xem thật, camera readability theo thời lượng mới.
- Chưa nghiệm thu caption/âm/encode/source trong LIVE Studio, điện thoại và sự kiện thật. Các việc này đã có task, không bị loại khỏi scope.
- 601 test pass là kết quả lượt audit trước, không phải lượt chạy mới ở yêu cầu lập kế hoạch này. Không sửa product code hoặc thêm asset runtime trong lượt này.
