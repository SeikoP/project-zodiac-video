# Kế hoạch tiếp theo: tinh giản thành phần và trả lại tóc ngố/meme

Trạng thái: PLANNED, chưa sửa asset hoặc phát hành plugin. Người dùng yêu cầu bổ sung vào kế hoạch ngày 11/10/2026. Thực hiện native tuần tự, không subagent; gom thay đổi đã review vào một lượt cập nhật.

## Mục tiêu và điều chỉnh phạm vi

Tinh giản những thành phần không cần thiết trong đường lựa chọn asset. Các đề xuất contact, viewport và runtime trước đó là sửa kỹ thuật bổ trợ, không thay thế việc giảm thành phần. Tóc phải trở về hướng ngố/meme ban đầu: mảng tóc đơn giản, lệch nhẹ, cọng dựng hoặc mái vụng có chủ đích; khuôn mặt thân thiện, không biến thành nhân vật thời trang chải chuốt. Giữ nét, palette và tỷ lệ đã chọn, không dùng hiệu ứng làm giàu để bù ý hình yếu.

Không áp quota số asset hoặc số kiểu tóc. Không vẽ hàng loạt rồi gộp. Giữ khung ZIP/tường/sàn hiện tại. Không tự thay tóc của episode đã duyệt; thay identity phải đi qua revision và review hình.

## P1 — Kiểm kê thành phần có thể rút khỏi mặc định

| Thành phần | Quyết định dự kiến | Điều kiện nghiệm thu |
|---|---|---|
| Cửa sổ, bảng, cây, đường phố, đèn và góc phòng đi kèm profile | Không tự thêm vào shot có archive frame; đưa lựa chọn ra khỏi đường mặc định | Intent không gọi thì không tạo entity/asset, không xuất vào ZIP |
| Nhiều frame/palette/biến thể depth cho cùng chức năng | Dùng frame đã duyệt; bỏ các nhánh cạnh tranh khỏi chọn mặc định | Không tái triển khai shadow, perspective, pen-pressure hoặc gradient đã hủy |
| Phụ kiện tóc, kính và họa tiết áo không có vai trò nhận diện | Chỉ chọn có chủ đích; không tự thêm để làm phong phú | Không làm mất outfit/identity đã duyệt; bảng màu áo vẫn giữ |
| Prop chỉ lặp lại lời kể, không tương tác hoặc không đổi cách hiểu | Bỏ khỏi scene nếu không có vai trò cụ thể | Kiểm hình khi bỏ prop; không bỏ Story Object có cơ chế cần thiết |
| Pose khác tên nhưng cùng hành động/hình | Chọn một pose trước khi compile; các alias cũ chỉ phục vụ tương thích | Không sinh SVG cho state không dùng; không thay bằng gộp sau tạo |
| Meme/effect/recipe chuyên biệt ít dùng | Tải theo lựa chọn; không nạp hoặc tạo mặc định | Episode chọn extension vẫn đủ asset, lifecycle và validator |
| V3, mẫu cũ và asset không dùng | Rút khỏi lựa chọn mới trước; chỉ xóa bytes sau khi kiểm đủ dependency | Không hỏng composite nguồn, alias, source ZIP hoặc import legacy |

Phân biệt rõ: rút khỏi mặc định, giữ tương thích và có thể xóa vật lý. Đo số thành phần active, số SVG thực sự xuất và context phải nạp; không gọi việc chỉ chuyển folder là giảm kho.

## P2 — Sửa hướng tóc

Catalog hiện có 10 hair IDs nhưng chỉ ánh xạ source_master, chưa mô tả vì sao silhouette phù hợp giọng ngố/meme. Không chọn theo tên ID rồi coi là review hình.

- Ưu tiên render đối chiếu các mẫu hiện có: `asym-bang`, `lopsided-bob`, `spiky-overthink`, `antenna-short`, `blocky-cut`. Đây là ứng viên để xem hình, chưa phải tất cả đã đạt phong cách.
- Rà lại `soft-wave`, `side-part`, `clean-bun`, `high-ponytail`, `twin-tail`: nếu quá bóng bẩy hoặc trùng silhouette thì rút khỏi mặc định; giữ resolve cho episode cũ. Có thể sửa thành kiểu ngố bằng derivative có ID riêng sau review, không âm thầm thay master đã duyệt.
- Tạo một bảng so sánh trên cùng mặt/body/áo, cùng kích thước và biểu cảm trung tính. Đối chiếu mẫu gốc đã duyệt khi chọn; không dùng tên gọi để giả định mẫu gốc.
- Đánh giá: đọc rõ ở kích thước video, không che mắt, đơn giản, lệch có chủ đích, ngố nhưng thân thiện; khác nhau ở silhouette thật. Không cần nhiều strand hoặc phụ kiện để tạo khác biệt.
- Chốt nhóm tóc ưu tiên từ hình đã duyệt. Kim Ngưu đang dùng `soft-wave`; đổi tóc phải được trình bày như revision identity, không sửa ngay trong bản đã duyệt.

## P3 — Giữ cơ chế Story Object thay vì thêm kho vật thể

Người dùng đã đồng ý thử ý hình ghế quen mọc rễ. Bản thử ba nhịp là probe, chưa đồng nghĩa duyệt cả episode hoặc Phase 3.

Giữ một hình gốc; chỉ biến đổi phần mang cơ chế kể chuyện. Ghế: chỗ dựa → rễ bám quen → rễ giữ chân. Rễ thuộc cơ chế của ghế và có contact với nhân vật; không trở thành background độc lập. Không xây thư viện Story Object riêng cho từng cung theo quota. Một vật thể chỉ đủ điều kiện khi hành động/biến đổi của nó làm rõ mâu thuẫn; lặp reveal, đổi layer hay dịch chuyển đơn thuần không chứng minh ý nghĩa. Mute-review và removal test là review hình thật, không creative PASS tự động.

## P4 — Sửa kỹ thuật sau khi chốt bộ thành phần cần giữ

Đưa vào kế hoạch các đề xuất trước: socket tay/đầu bút/mặt ghế/sofa; viewport theo pose; một master với phần biến đổi; mẫu đối chiếu nét/mặt/tỷ lệ/màu; preview khi sử dụng; phân loại ưu tiên/thử nghiệm/tương thích; runtime xử lý chuyển động nhẹ đã hỗ trợ.

Lỗi thực tế cần giải quyết cùng lượt:

1. `rest_sitting` dùng viewBox cao 760 nhưng bàn chân lean_tall vượt mép. Probe phải mở viewport lên 800 để nhìn đủ; chưa sửa compiler. Cần tính bounds phù hợp và kiểm parity renderer, không dùng crop demo khác để che lỗi.
2. `assessSemanticEvent` trả `actor_state_slide`, nhưng preview validator/counters không nhận loại này. Đồng bộ producer/validator/runtime và regression cho endpoint thật; không biến workaround state_swap thành animation đã được kiểm.
3. Legacy scene voice thiếu separator so với root narration: tiếp tục dùng source UTF-8 ranges nguyên byte.
4. Preflight cấu trúc không bắt bút quá to, nhân vật đè nhau hoặc pose nằm nổi trên sofa. Kiểm silhouette/contact trên ảnh ghép thực tế, giữ structural PASS và visual review riêng.

## Thứ tự triển khai và nghiệm thu

## P6 — Cover mở chậm và phụ đề đè cover

Người dùng báo cover giữ lâu, phụ đề hiện đè trước khi vào cảnh. Source xác nhận renderer đặt cover ở z80, captions z100; mẫu authored duration1.5s. Rút opening mới xuống0.75s, dissolve0.2s; ẩn captions trong thời gian cover còn phủ, hiện lại đúng frame release. Giữ voice/event timeline từframe0, không prepend intro/silence. Standalone cover không đổi. Kiểm frame0, giữa dissolve và frame uncovered đầu tiên; không claim actual MP4 đã sửa khi chỉ có unit/native checks. Gói mới chỉ có hiệu lực khi runner dùng renderer source đã cập nhật.

## P5 — Nới Phase1 có kiểm soát

Người dùng yêu cầu rà lại những điểm giảm khả năng sáng tạo. Xem [Audit Phase1 và kế hoạch xử lý C01–C12](2026-10-11-phase1-creative-freedom-review.md). Ưu tiên dọn hướng dẫn xung đột và quota biên tập; giữ evidence, identity, revision/user review và honest TTS status. Chưa thay compiler/validator hoặc phát hành plugin. Gộp vào lượt cập nhật chung.

P1 kiểm kê và phân loại → P2 bảng tóc đối chiếu → review bộ ưu tiên → rút lựa chọn/biến thể thừa → P3 ghép cơ chế Story Object → P4 sửa những lỗi kỹ thuật trên bộ còn giữ → kiểm fresh/legacy, xuất thử và readback plugin một lượt.

Chưa xóa asset vật lý khi dependency chưa rõ. Không bỏ body variation cần thiết như lean_tall để làm kho nhỏ. Không gọi thêm framework hoặc nhiều mẫu mới là tinh giản. Không suy ra audio/video-ready từ asset hoặc native preflight PASS.

## Cập nhật thực thi — release 2.4.54

Đã triển khai: candidate/facet thích ứng; giữ creative_direction; PASS không cần bịa objection; identity xuất hiện trong lời kể, opening 40 từ là diagnostic. Asset chọn theo hành động thực, mặc định tóc ngố/meme, không tự thêm environment/accessory; không xóa master tương thích. Sửa viewport rest_sitting, socket ghế, actor_state_slide preview và compiler đường dẫn tương đối chạy trong staging để không ghi vào nguồn. Cover .75s/.2s và captions chờ cover release; timeline voice giữ nguyên.

Bổ sung theo phản hồi cuối: Phase01→02 có handoff_context gồm authority, hash, scope/Spine, creative direction, review refs và next action. GitHub SeikoP/project-zodiac-video là transport version-pinned; repository prose không thay plugin đang dùng hoặc quyết định tập. Repo giữ implementation + contract/schema/catalog/assets/tests/provenance; không chỉ mã chạy.

Review bản Leo v2.4.53: unsupported accent_only/optional_callback/attached; Story Object thiếu friction/payoff relation; preview hash cũ; density S02/S05 chưa hợp lệ; state Phase1 READY/Phase2 LOCKED/review receipts rỗng. Giữ nguyên ZIP được gửi. Không suy approval từ tên gói hay version, không thêm beat vô nghĩa để đủ quota. Rà source plugin các file core đã chạm không thấy thay đổi logic chuyển phase ở 2.4.53; kết luận giới hạn trong phạm vi đã đọc.

Kim Ngưu revision03: 8 cảnh/17 events/23 assets/34 endpoints, native projection/assembly/identity/outfit/story/composition/preview/preflight PASS. Giữ nguyên narration và SVG khung ZIP; tóc antenna-short, ghế mọc rễ có contact. Đây là bản review đầy đủ, chưa có user approval cho toàn revision nên chưa seal official Phase03. TTS/prosody/MP4 là runner QA còn mở; Chrome download bị network proxy chặn, không claim motion/frame parity.

### Bằng chứng kiểm tra

Native regression: 612/613 pass; lỗi một test cleanup output Phase03 khi chạy chung, chạy riêng Phase03 5/5 pass. Cover tests 6/6, renderer typecheck pass, Python import/voice/preflight/episode 12/12. Renderer suite 89/90, test pixel font bị chặn tải Chrome bởi proxy. Không ghi all-green hoặc MP4 đã kiểm.
