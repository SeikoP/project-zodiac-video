# Studio: danh tính gói, quyết định duyệt và vòng sửa video

Trạng thái: đề xuất theo yêu cầu lập kế hoạch ngày 2026-11-26; chưa triển khai.
Phạm vi: Studio Preview tại worktree main-2. Không thay nguồn Phase 1 đã duyệt.

## 1. Những gì đã kiểm tra

1. `service.py:StudioProjectService._snapshot` đã lấy `concept_code`, `sign` từ
   nguồn gói. `EpisodeIdentity` hiển thị đúng danh tính này.
2. `EpisodeExport` chỉ truyền `initialConceptId`, `output`, `active` cho
   `VideoReview`; không truyền `project`. `VideoReview` khởi tạo cung bằng chuỗi
   rỗng và lấy concept từ ngữ cảnh điều hướng Ideas. Vì vậy xuất từ episode vẫn
   phải gán lại, và còn có nguy cơ giữ ngữ cảnh concept cũ.
3. `VideoReview.approve` gọi `ideas.update(concept_id, sign, status)`. SQLite
   `idea_progress` có khóa concept/cung, không có project/export/hash.
4. Checkbox có thể bỏ dấu duyệt, nhưng thao tác đó xóa dòng tiến độ và trả về
   `not_started`, dù episode đã được dựng. Nó không phải từ chối chất lượng.
5. Video chỉ cần `loadedmetadata` với kích thước/thời lượng hợp lệ để mở khóa
   checkbox; chưa có bằng chứng phát MP4 gắn với bản xuất.
6. `nodes.json` kết thúc ở `export`. `derive.py` coi xuất xong là DONE và
   `NextAction` có thể báo mọi bước xong trước duyệt MP4.
7. Không có API Studio để từ chối video, bỏ bản xuất, khôi phục bản đã bỏ hoặc
   lưu trữ episode. `visual.cancel` chỉ dừng công việc đang chạy.
8. `pipeline.runner` kiểm tra gate, còn đường `video.export` gọi thẳng
   `VisualWorkspace.export`. `_export_inputs` kiểm nguồn/build/voice nhưng chưa
   kiểm receipt duyệt hình. Cần thống nhất điều kiện ở tầng dịch vụ.
9. Các bước cover/publish/inspect trong `_drafted` là bản nháp kỹ thuật; nhãn
   kết quả phải nói đúng phương pháp kiểm tra thực tế.
10. Đọc DOM native hiện tại xác nhận MP4 đã tải (`readyState=4`, không lỗi media),
    nằm ở cột phải rộng 300px; hai bộ chọn vẫn trống. Không kết luận MP4 thiếu
    hoặc hỏng từ ảnh cắt của người dùng.

## 2. Phương án và lựa chọn đề xuất

- Chỉ điền sẵn hai select: sửa được thao tác lặp, chưa giải quyết dấu duyệt sai
  phiên bản hoặc vòng trả sửa. Chỉ dùng như một phần của bản sửa đầy đủ.
- Gắn duyệt với episode/export hiện tại và thêm vòng phản hồi: **đề xuất chọn**.
  Tái sử dụng pipeline/store/player/canonical commands; có thêm model quyết định.
- Thay toàn bộ workflow hoặc editor: chi phí và rủi ro lớn, không cần cho các lỗi
  đã xác nhận. Không đưa vào kế hoạch này.

## 3. Hành vi người dùng

MP4 của episode mở sẵn: hiển thị concept, cung, tên tập dưới dạng thông tin đã
biết; không có hai select. Backend lấy danh tính từ project, không tin dữ liệu
gán do client gửi. Thiếu hoặc sai metadata thì chỉ rõ trường cần sửa, không suy
đoán qua tên file hoặc tự sửa nguồn đã khóa.

Mở MP4 ngoài là nhánh riêng, nằm trong thao tác phụ. Nếu không có bằng chứng nối
file với gói thì không được duyệt gate của episode hiện tại. Tiến độ thủ công cũ
vẫn được giữ và phân biệt với receipt duyệt một bản xuất xác định.

Màn cuối có preview lớn, danh tính ngắn và hai quyết định:

- **Duyệt video**: sau khi người dùng phát/xem và chủ động xác nhận bản hiện tại.
- **Chưa đạt, cần sửa**: ghi điều chưa ổn, có thể gắn cảnh hoặc mốc thời gian; giữ
  MP4 để so sánh và mở đúng chỗ sửa. Không tự chạy model chỉ vì vừa từ chối.
  Lấy sẵn mốc đang xem và cảnh tương ứng nếu xác định được; người dùng chỉ cần
  ghi góp ý ngắn, không phải điền một biểu mẫu kỹ thuật.

Thao tác phụ:

- **Bỏ bản xuất này**: đưa riêng bản MP4 đang chọn cùng sidecar vào thùng tạm do
  Studio quản lý, có Khôi phục; không xóa lời kể, take, build hay cả episode.
- **Bỏ duyệt**: thu hồi quyết định của bản đó, giữ video và lịch sử; không trả
  concept/cung về Chưa làm khi vẫn còn sản phẩm hoặc bản duyệt khác.
- **Lưu trữ episode**: ẩn khỏi danh sách đang làm, có thể mở lại. Không đồng nghĩa
  bỏ MP4 hoặc xóa project.

Không bổ sung xóa vĩnh viễn vào luồng thường xuyên. Không xóa file MP4 mở ngoài.

## 4. Model và điều kiện đúng

Danh tính truyền xuyên suốt:
`project_id + imported_source_sha256 + concept_code + sign`.
Danh tính duyệt cuối bổ sung:
`export_id + mp4_sha256 + build_id + build_manifest_sha256 + visual_revision + voice_sha256`.

Lưu quyết định bản xuất và lịch sử bằng các bảng mới trong SQLite hiện có; cập
nhật quyết định và event trong cùng transaction. `idea_progress` cũ giữ nguyên
để tương thích, không tự chuyển thành receipt có hash.

Một bản xuất chỉ được duyệt nếu vẫn là bản hiện tại, hợp lệ, không stale/đã bỏ,
hash khớp, có phiên phát do backend cấp và có xác nhận người dùng. Duyệt bản A
không duyệt bản B dù cùng concept/cung. Model/agent/autopilot không tạo approval.

`video_review` là gate sau `export`. Hoàn tất kỹ thuật khác hoàn tất người dùng.
Sau export, autopilot chờ gate. Trả sửa cũng chờ người dùng, không tạo vòng lặp
render tự động. Không thêm trạng thái NodeStatus mới chỉ để biểu diễn phản hồi:
gate chưa duyệt vẫn AWAITING_USER, decision/detail nói rõ cần sửa ở đâu.

Duyệt hình chốt diễn xuất/bố cục trước render; duyệt MP4 kiểm file thực tế sau
encode/mux. Giữ bằng chứng nghe giọng đã có, không ép nghe lại toàn bài hai lần
cho một sửa đổi nhỏ. Mười giây hoặc metadata tải xong không chứng minh đã xem hết;
GUI nói đúng mức đã phát/xem và chỉ người dùng mới xác nhận chất lượng.

Tiến độ Ideas là phép chiếu: có bản duyệt còn hiệu lực thì hiện MP4 đã duyệt;
có episode/bản cần sửa thì Đang làm. Nhiều episode cùng concept/cung phải được
liệt kê, không để project sau ghi đè project trước trong một Map.

## 5. Phạm vi cần dựng lại

| Người dùng đổi gì | Cần làm lại | Giữ lại |
|---|---|---|
| Một take/khoảng nghỉ | Ghép audio, timing có ảnh hưởng, dependency hình, build/export và các gate phụ thuộc | Take và cảnh độc lập đã xác minh |
| Hình/diễn xuất cảnh | Cảnh và biên chuyển cảnh phụ thuộc, build, kiểm hình, duyệt hình, export, duyệt MP4 | Giọng/timing không đổi |
| Chuyển cảnh | Các biên liên quan, build/kiểm/duyệt/export | Cảnh và take không phụ thuộc |
| Tiêu đề/mô tả đăng | Bản copy và gói bàn giao | MP4/voice/timing nếu không nhúng copy vào video |
| Opening/cover nhúng MP4 | Thành phần hình liên quan, build, duyệt/export | Take không đổi |
| Lỗi encode/audio mux | Xuất lại, kiểm file và duyệt MP4 | Nguồn hình/duyệt hình nếu hash đầu vào không đổi |
| Chỉ từ chối hoặc bỏ duyệt | Quyết định và hàng đợi việc cần sửa | Nguồn và media |

Mọi tối ưu phải dựa trên dependency/hash đã có; không giả định sửa một cảnh luôn
không ảnh hưởng cảnh khác. Lỗi upstream Phase 1 phải trả đúng nguồn, không tự
viết lại nội dung đã duyệt.

## 6. Giới hạn và nghiệm thu

Mọi bước phải có đầu vào, kết quả, một hành động chính, lý do chặn và đường quay
lại sửa. Thông tin kỹ thuật ở Chi tiết; preview/timeline/đoạn cần duyệt ở mặt chính.
Kiểm tra 1366x768, 1060x650, 1093x614, 800x580 và 800x960; không scroll toàn trang.

Thử cả đổi project khi đang phát, RPC mất phản hồi sau ghi, hủy trong render,
khởi động lại giữa lúc bỏ bản xuất, nhiều episode cùng concept/cung và gói cũ.
File test/synthetic receipt không xác nhận chất lượng gói thật. Nghiệm thu cuối
cần người dùng xem MP4 thật; merge production/phát hành/đăng video là việc riêng.
