# Cách dùng Kho và Checklist

## Màn hình đã gộp

Chỉ còn ba tab chính: **Công việc / Kho & tiến độ / Media**. Trong Kho & tiến độ, **Tập & concept** là màn hình theo dõi tập: chọn tập ở trái, xem cover, concept và bước hiện tại ở phải. **Gói & video** chứa ZIP, job và công cụ dọn kho. **Ý tưởng nháp** giữ bản ghi ý tưởng trước sản xuất, không thay cho concept nguồn Web. Nút **Quản lý tập / series** chứa thao tác thêm/liên kết tập; **Cách dùng** mở hướng dẫn khi cần.

## Chọn đúng tab

- **Kho & tiến độ → Ý tưởng nháp:** lưu ý tưởng chưa triển khai. Thêm tên, cung và ý tưởng; bấm Lưu dự kiến. Chọn concept để sửa. Sao chép brief rồi dán vào chat có plugin Zodiac để bắt đầu Phase 1; thao tác này chưa tạo tập hoặc duyệt nội dung.
- **Kho & tiến độ → Tập & concept:** theo dõi một tập đã có thư mục `.authoring/`. Tab đọc trạng thái trên đĩa; không phải bảng tick tay và không tự chạy plugin.
- **Công việc / Workspace:** nhập ZIP Job@5 từ `ready/` và chạy giọng, timing, render, âm thanh để có MP4.
- **Media:** xem đầu ra và nội dung đăng.

## Lần đầu dùng Checklist

1. Chọn một tập trong danh sách tìm thấy, rồi bấm **Theo dõi tập đã chọn**. Nếu chưa tìm thấy, bấm **Quản lý tập / series → Thêm tập…**, chọn thư mục chứa `.authoring/`, không chọn chính `.authoring/` và không chọn ZIP.
2. Xem phase, bước và cảnh báo của tập. Các dữ liệu thiếu được báo rõ; app không tự đoán approval.
3. Bấm **Sao chép prompt tiếp tục**. Dán prompt vào Codex có plugin Zodiac tương ứng; plugin đọc lại workspace và xử lý theo phase/gate đang lưu.
4. Sau khi plugin tạo Job@5 trong `ready/`, vào **Công việc**, nhập ZIP đó. Quay lại Checklist, chọn job tương ứng trong ô **Runner Job@5**. Việc liên kết là chọn rõ ràng, app không ghép theo tên gần giống.
5. Bấm **Mở Runner** để chạy job. Dùng **Làm mới trạng thái** khi muốn đọc lại dữ liệu từ plugin. Đã xuất ZIP không đồng nghĩa đã render MP4.

Ví dụ hiện có: `processing/bach-duong-20261112-001/workspace` và `.zodiac-work/episodes/*` có `.authoring/` sẽ hiện trong danh sách tìm thấy. Danh sách này không tự thêm tập vào cấu hình.

## Ý nghĩa các điều khiển

- **Cần chú ý:** nguồn thiếu/lỗi, BLOCKED, IN_REVIEW hoặc job đã liên kết không còn trong Runner. Đây không phải danh sách mọi tập chưa hoàn tất.
- **Bỏ theo dõi:** bỏ khỏi danh sách GUI; không xóa workspace.
- **Tiến độ 12 cung:** tracker JSON tùy chọn, riêng với tiến độ từng tập. Không cần liên kết tracker để chạy một tập. Dữ liệu lịch sử không chứng minh có MP4.
- **Hiển thị thẻ Cover:** xem `out/cover.png` từ Job@5 đã liên kết.
- **Kho & tiến độ → Gói & video → Dọn tất cả bản cũ:** chỉ xét package/job theo bộ phân loại của Kho, không dọn toàn bộ folder dự án; bộ lọc danh sách không thu hẹp phạm vi dọn.

## Nơi lưu

Cấu hình nằm trong `.zodiac-work/studio-production-checklist.json`; concept dự kiến nằm trong `.zodiac-work/planned-concepts.json`. Không chỉnh `pipeline-state.json` bằng tay để ép tiến độ. Nên giữ hai tệp GUI khi sao lưu hoặc dọn dự án.

Kế hoạch dọn toàn dự án: [bản khảo sát 2026-11-12](audits/2026-11-12-project-cleanup-plan.md).

## Concept từ Zodiac Video Web

Luồng source mới: Narrative Plan / Episode Scope đã duyệt → HANDOFF.json (`concept_context`) → local authoring → Job@5 `publish/publish.json` (`source.concept`) → thẻ concept cạnh cover và Media. Handoff cũ đã có `story_spine.premise` vẫn hiển thị premise nguồn mà không cần `concept-candidates.json`. Gói Job@5 cũ thiếu metadata hiển thị thông báo thiếu concept; runner không đoán từ tên tệp/caption. Muốn dùng exporter mới trên Web cần cập nhật bản plugin cài đặt; lượt này mới sửa source, chưa phát hành.

Quét Kho chạy ở thread nền, báo trạng thái đang đọc. Khi dữ liệu không đổi, app giữ các widget/danh sách hiện có; bấm Làm mới khi cần đọc lại trạng thái nguồn. Việc quét Kho không khóa thao tác của các tab khác.

## Kiểm chứng đợt GUI hợp nhất

- 109 test Python (GUI, Kho, Checklist, context, profile/bundle lineage) đạt; 35 test Node cho handoff/import/compiler/release/context đạt. Sau chỉnh vị trí các thẻ, 43 test GUI liên quan được chạy lại và đạt.
- Qt offscreen đã kiểm tra cửa sổ 1260×860 và 1024×680. Một tập mẫu có cover; ảnh là dữ liệu minh họa bố cục, không phải bằng chứng production.
- Trung bình 50 lần refresh không đổi với một job mẫu: khoảng 4,5 ms/lần. Chưa đo render thật hoặc toàn bộ phiên làm việc Windows.
- Dọn 8 ZIP cũ và 4 thư mục runtime legacy bị automatic approval review chặn lệnh trước khi chạy; chưa xóa mục nào. Source plugin mới chưa được phát hành/cài trên Web.

## Điều khiển VieNeu và cache render

Thanh trên có **Bật VieNeu / Tắt**. GUI dùng môi trường `.venv` trong VieNeu-TTS đã cài; chờ trạng thái sẵn sàng trước khi tạo giọng. Khi đang VOICE, nút tắt bị khóa. Server đã chạy bên ngoài được dùng lại; GUI không tắt server đó. Đóng GUI sẽ dừng VieNeu do GUI này mở. Log lưu ở `.zodiac-work/vieneu-service.log`.

Phụ đề mới dùng policy 56 px, ưu tiên câu đầy đủ. Chạy lại từ **Kế hoạch / PLAN** nếu một job đang giữ plan cũ; giọng/timing hợp lệ vẫn có thể tái dùng. MP4 đã render không tự đổi. Browser cache kiểm tra đúng Chrome revision và được dùng chung giữa bước đo layout, preview/cover và render của renderer 2.0.1/2.0.2.

Bằng chứng và đánh giá Remotion mới: [báo cáo 2026-11-12](audits/2026-11-12-caption-cache-vieneu-remotion.md).
