# Studio: luồng episode và agent trong app

Trạng thái: người dùng đã duyệt bằng “triển khai”. Người dùng đã chọn hướng 2: gom tab, nối luồng agent và E2E qua GUI thật. Tài liệu này bổ sung thiết kế Studio hiện có, không thay thế các gate production.

## Vấn đề và mục tiêu

GUI hiện có tám mục ngang cấp, buộc người dùng tự ghép các bước sản xuất. E2E Nhân Mã ngày 20/11 có MP4 kỹ thuật nhưng tạo Visual Intent bằng `.runtime/nhanma-e2e/author.py`; kho agent task của lần chạy trống. Việc xuất và phát MP4 chưa chứng minh luồng authoring bằng agent trong app.

Mục tiêu: người dùng chọn episode một lần, biết bước tiếp theo, yêu cầu agent tạo hoặc sửa hình ảnh ngay tại bước đang làm, xem đề xuất trước khi áp dụng, và xuất/xem video trong app. Không cần script ngoài app để bù phần authoring còn thiếu.

## Các hướng đã cân nhắc

1. Chỉ gom tab: thay đổi nhỏ nhưng giữ nguyên chỗ đứt của agent và không đáp ứng yêu cầu E2E.
2. Gom tab, nối agent và E2E qua GUI thật: người dùng đã chọn. Tái sử dụng Project Core, Voice Lab, VisualEditor, AgentManager và exporter.
3. Viết lại editor hoặc thêm hệ điều phối tự động toàn bộ: phạm vi lớn, chưa cần để hoàn thành luồng trên; không chọn.

## Điều hướng và hành vi

Ba mục chính:

| Mục | Sub-tab |
| --- | --- |
| Kế hoạch | Ý tưởng; Tiến độ |
| Episode | Tổng quan; Giọng đọc; Hình ảnh; Xuất & duyệt |
| Tài nguyên | Kho tài nguyên |

Đây là cách tổ chức do người triển khai đề xuất. Catalog ý tưởng và tiến độ hiện có tiếp tục là nguồn dữ liệu chung. Chọn ý tưởng không tự chọn nhầm episode hoặc đánh dấu hoàn tất. Phase 1 vẫn được tạo/duyệt ở Web và nhập handoff hợp lệ vào app.

Episode đang chọn và trạng thái bước luôn hiện trong vùng tiêu đề. Bước đang mở khác với bước đã hoàn thành. Hiển thị việc tiếp theo và nguyên nhân bị chặn theo trạng thái backend, không tự suy diễn approval. Chuyển sub-tab không mất yêu cầu agent, tác vụ đang chạy hoặc lựa chọn cảnh. Đổi episode phải cô lập mọi trạng thái, phản hồi đến muộn và đề xuất cũ.

Agent và nhật ký là vùng hỗ trợ trong Episode; không còn là hai mục chính riêng. Nhật ký hiển thị hoạt động đúng episode, có trạng thái tác vụ và lỗi. Giữ khung cửa sổ gọn, phân trang nội dung dài theo pattern hiện có; kiểm tra ở kích thước cửa sổ nhỏ đang được hỗ trợ.

Xuất & duyệt chứa xuất MP4, tiến độ, phát video, cover/phụ đề và duyệt cuối; Hình ảnh tập trung vào cảnh/preview. Dùng lại component và backend hiện có, loại bỏ hành động trùng khi chuyển vị trí.

## Agent làm việc thật

Giữ agent phân tích dự án và đề xuất sửa cảnh hiện có. Bổ sung đường tạo bản dựng hình ảnh ban đầu khi episode chưa có Visual Intent: agent nhận nguồn Phase 1 đã duyệt, narrative plan, timing giọng đã chọn và danh mục asset hữu hạn từ backend. Không giao đường dẫn tùy ý hoặc quyền ghi filesystem cho model.

Agent trả đề xuất có cấu trúc; backend kiểm tra schema, giới hạn kích thước, hash nguồn, byte range tiếng Việt, asset hợp lệ, scope và revision trước khi cho áp dụng. Snapshot còn gắn hash WAV đã chọn và timing dùng trong capsule; đổi take hoặc timing làm đề xuất phụ thuộc chúng hết hiệu lực. Với bản dựng đầu dùng canonical `source.replace` sau khi người dùng xác nhận; với cảnh có sẵn dùng command sửa cảnh đang có. Không cho đường tạo ban đầu ghi đè thiết kế đang tồn tại; chỉnh lại nguồn toàn bộ không nằm trong phạm vi này.

UI trình bày đề xuất bằng mô tả dễ đọc và các cảnh/thay đổi liên quan; JSON chỉ là chi tiết mở thêm. Áp dụng đề xuất khác với duyệt chất lượng. Người dùng có thể hủy, yêu cầu lại, xem lỗi và hoàn tác chỉnh hình qua history hiện có. Task receipt giữ project, loại tác vụ, thread/turn, revision/hash gốc, trạng thái và command áp dụng; mở lại app đọc được kết quả. Mở rộng giới hạn output hiện tại chỉ khi cần cho đề xuất authoring, có giới hạn rõ và kiểm tra truncated output.

Các nút tạo giọng, căn thời gian, build và export tiếp tục dùng service hiện có. Agent không tự duyệt giọng/hình/video, không sửa lời kể đã duyệt, không chạy vòng lặp retake/build vô hạn. Màn Giọng đọc vẫn cung cấp đầy đủ tạo lại, chọn take và nghe duyệt của người dùng.

## Phạm vi mã và dữ liệu

- Shell `App.tsx`, CSS và component liên quan: điều hướng, context episode, hành động tiếp theo, agent/nhật ký.
- `VisualEditor.tsx`, `VideoReview.tsx`, `VoiceLab.tsx`: nối context, tách xuất/duyệt khỏi editor mà giữ chức năng hiện có.
- `backend.ts`, RPC Python, AgentManager và transport Rust nếu contract cần mở rộng: task tạo hình ban đầu và đề xuất có cấu trúc.
- Dùng nguyên validators/commands/history của VisualWorkspace, nguồn handoff và immutable media stores; không migration phá dữ liệu, không xóa take/export cũ.
- Cập nhật kiểm tra điều hướng, regression agent/RPC/visual và kịch bản native E2E; cập nhật hướng dẫn và evidence report theo hành vi cuối cùng.

## Kiểm chứng bắt buộc

1. Kiểm tra giao diện: chỉ ba mục chính; sub-tab đúng nhóm; giữ episode/cảnh và trạng thái tác vụ khi chuyển tab; không tràn khung ở cửa sổ nhỏ. Mock chỉ dùng kiểm tra layout.
2. Kiểm tra backend: đề xuất hợp lệ; JSON lỗi/truncated, nguồn hoặc revision thay đổi, asset ngoài danh mục, sai episode, áp dụng lặp, hủy và khôi phục sau khởi động lại. Nguồn đã duyệt và approval không bị thay đổi.
3. E2E native trên bản sao cô lập của handoff Nhân Mã: nhập qua GUI, chạy giọng/căn thời gian qua GUI (có thể tái dùng WAV hợp lệ với provenance rõ), gọi agent tạo hình ban đầu, xem và xác nhận đề xuất, build/preview, gọi agent sửa một cảnh, xác nhận và xuất MP4 qua GUI. Automation chỉ điều khiển UI; không tự gọi backend hoặc script tạo cảnh để thay bước còn thiếu.
4. Lưu task/thread/turn, hash/revision trước và sau, command thực áp dụng, thời gian từng bước và toàn luồng, ảnh GUI, export receipt và đường dẫn MP4 bền vững. Mở lại app phải xem lại task và phát đúng MP4; decode/probe video, audio, SRT và cover theo receipt.
5. Nếu agent/runtime hoặc bước nào không chạy được, ghi đúng bước lỗi và tiếp tục sửa trong phạm vi; không thay bằng mock rồi ghi native PASS. Nếu cần đánh giá nghe/diễn xuất của người dùng, giữ PENDING cho tới khi có xác nhận thật.

Automation được bấm áp dụng đề xuất để kiểm chứng command, nhưng không bấm nghe/duyệt chất lượng thay người dùng. Nếu backend cần approval thật để chạy bước tiếp theo, giữ nguyên gate và chờ người dùng duyệt; không giả receipt hoặc bỏ điều kiện để hoàn thành E2E.

## Giới hạn và bàn giao

Chạy và kiểm tra dev app trước; không build release, installer, đóng gói giao hàng hoặc publish khi chưa được yêu cầu. Theo chỉ đạo bổ sung ngày 22/11, mỗi task hoàn tất phải cập nhật bằng chứng, commit và push để remote sửa tiếp; quy tắc này thay giới hạn commit/push trước đó. Không viết lại renderer, không thêm NLE, thư viện nhạc hoặc sửa creative Phase 1. Không hứa production-ready chỉ từ test xanh: kết quả bàn giao gồm luồng GUI đã chứng minh, MP4 xem được và danh sách gate chất lượng còn thiếu.

Giữ toàn bộ dirty work hiện có. Rollback chỉ các hunk thuộc lần thay đổi này; giữ nguyên handoff, take, history và export. Rủi ro chính: độ tin cậy của output agent khi tạo nguồn ban đầu, chuyển ngữ cảnh bất đồng bộ và hồi quy thao tác khi gom các màn hình.
