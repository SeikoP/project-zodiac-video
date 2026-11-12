# Phụ đề, browser cache, VieNeu và Remotion — 2026-11-12

## Những thay đổi đã kiểm tra

- Local subtitle policy giới hạn cỡ chữ 56 px trên khung 1080×1920; vẫn dùng Patrick Hand, measured word timing và tối đa 2 dòng. Source design mới đặt mặc định 56 px, khoảng ưu tiên 52–60 px, tối thiểu 48 px.
- Producer không còn ngắt tự động sau 8 từ / 43 ký tự. Runner ghép các mảnh cũ thành câu; trình đo dùng font thật để chia trang tại dấu câu hoặc giới hạn đo được khi một câu không thể vừa. Không bỏ từ hoặc bịa timing khi thiếu word alignment. Cache key PLAN đổi để không tái dùng layout cũ.
- Renderer 2.0.1/2.0.2 dùng chung browser cache tương thích revision. Kiểm tra cả VERSION và executable trước khi truyền browser-executable vào CLI / browser measurement. Nếu không có cache phù hợp, Remotion vẫn tải đúng browser cho phiên bản đang ghim.
- Log thật có Getting Headless Shell 113.3 MB. Đã tìm thấy Chrome revision 149.0.7790.0 tại nhiều cache; lệnh render mẫu dùng cache gốc node_modules/.remotion và không tải browser.
- GUI chính có Bật VieNeu / Tắt, kiểm tra /config bất đồng bộ, log tại workspace/vieneu-service.log; khóa tắt khi đang VOICE. Chỉ quản lý tiến trình do GUI mở; timer dừng cưỡng bức gắn với PID để không giết lần khởi động tiếp theo. Đóng GUI tắt tiến trình được sở hữu.
- Profile Web tái dùng bộ chọn source Phase 1 cùng dependency closure hiện có. Trước: 510 tệp, 2.011.763 byte; sau: 357 tệp, 1.446.594 byte (số đo nguồn, không phải token context hoặc dung lượng ZIP). Local giữ payload cần cho Phase 2/3. Test vẫn kiểm tra import và byte/package lineage. Không xóa approval, source episode hoặc sửa bản plugin đã cài.

## Bằng chứng runtime

Clip mẫu: `tmp/caption-review-56px/caption-demo-56px.mp4`, 6 giây, 1080×1920, H.264 + AAC. Dùng IR, design và measured timing của job `bachduong-nut-start-qua-nhay`; tái dùng voice.wav hiện có. Đây là đoạn kiểm tra phụ đề, không phải bản xuất cuối toàn tập. Ảnh frame: `tmp/caption-review-56px/caption-frame.png`.

VieNeu thực tại E:/projects/VieNeu-TTS đã được bật qua chính VieNeuControl, endpoint 7860 sẵn sàng, và tiến trình PID 7616 đã dừng sau thử nghiệm. Lượt này không tổng hợp giọng mới. Log thử: `tmp/vieneu-service-smoke.log`.

108 test Python, 99 test renderer Node và 31 test producer Node đạt trong lượt hồi quy cuối. Có cảnh báo Qt invalidateFilter deprecated trong mã Media có trước.

## Remotion hiện tại và phương án sử dụng

Dự án đang ghim Remotion 4.0.530. npm registry và GitHub release cùng xác nhận latest 4.0.543, phát hành 2026-11-11. Không nâng dependency trong lượt này.

Bản mới thêm audio level meters, import OpenTimeline / canvas capture vào CLI, Chromium flags tùy chọn, chẩn đoán playback, điều khiển ProRes, cùng sửa lỗi renderer/player/media và SVG trong web-renderer. Với Zodiac, audio metering và các bản vá browser/renderer đáng cân nhắc. Web renderer là tùy chọn có thể nghiên cứu riêng; pipeline hiện tại phụ thuộc DOM/SVG, font thật và QC nên không thay engine chỉ để thêm tính năng chưa dùng. Caption editor / Elements của Studio không thay nguồn narration và measured alignment hiện có.

Khuyến nghị: nâng patch như một thay đổi có hồi quy riêng cho renderer, font/caption, SVG, preview/cover và frame parser. Các sửa phụ đề/cache hiện tại hoạt động trên bản đang ghim. Tính năng mới không tự giải quyết độ mượt của Qt.

Nguồn chính thức:
- https://github.com/remotion-dev/remotion/releases/tag/v4.0.543
- https://www.remotion.dev/elements/captions/
- https://www.remotion.dev/docs/client-side-rendering
- https://www.remotion.dev/docs/renderer/ensure-browser

Chưa kiểm tra: render toàn tập sau sửa, nghe duyệt giọng/mix mới, engine web-renderer, và bản plugin mới trong host Web. Chưa phát hành hoặc cài lại plugin.
