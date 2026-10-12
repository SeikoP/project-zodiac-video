# Kế hoạch dọn sạch kho asset và Phase 2

Ngày: 13/10/2026. Trạng thái: đề xuất kiến trúc và lộ trình; chưa sửa hoặc xóa source.

## Mục tiêu

Loại bỏ các đường khiến authoring mới quay về tham chiếu lịch sử. Kho hoạt động chỉ chứa asset, contract và hướng dẫn hiện hành. Thành phần lịch sử còn giá trị phải được xét lại và xuất hiện qua giao diện chọn mới; không tự quay lại qua fallback, alias hay ví dụ cũ.

Phạm vi là plugin Zodiac Video Pipeline, kho asset và giao tiếp Phase 2 → Job@5 → local runner. Không tái cấu trúc toàn repo. “Giao diện khác” trong đề xuất này gồm giao diện chọn/preview asset cho người dùng và giao diện dữ liệu cho authoring/compiler; chưa giả định phải xây một ứng dụng quản trị riêng.

## Bằng chứng và giới hạn

Đã đọc SKILL, router, execution bootstrap, manifest `orchestration/phases/02-visual-production.json`, asset routing, selection guide, scene-set authoring và semantic derivation của plugin được chọn.

Gói đính kèm `zodiac-content-pipeline-v0.1.zip` chỉ chứa README và SKILL của pipeline nội dung; không chứa mã Phase 2, compiler hay kho asset video. Chưa kiểm tra byte source GitHub, chưa chạy compiler và chưa tái hiện lỗi tóc/background trên job thật. Vì vậy tài liệu này xác định các đường nạp đã thấy và kế hoạch xác minh, không tuyên bố audit toàn bộ code đã hoàn tất.

| Quan sát trực tiếp | Ý nghĩa |
|---|---|
| Manifest cấm `memory`, `prior_chat`, `old_package`, `sign_example` | Đã có chính sách chặn theo loại context |
| Semantic Assets vẫn liệt kê `references/asset-library-v4/migration/semantic-derivation.md` trong `load_references` | Tài liệu lịch sử vẫn là một đầu vào được khai báo; cần đo context thực tế để biết loader có đưa vào hay không |
| Router dẫn tới `references/story-object-effects.md`; file này mở đầu bằng hướng dẫn chuyển fresh sang contract mới, nhưng vẫn chứa ví dụ Thiên Bình, quy tắc @1 và phần @2 | Fresh/compatibility bị đặt trong cùng bề mặt đọc; có nguy cơ hiểu nhầm phiên bản và bắt chước ví dụ |
| Selection guide nói “Legacy assets remain resolvable”, đồng thời giữ các lựa chọn tóc compatibility và cơ chế selected-cues | Cần kiểm tra resolver/default/fallback; chưa chứng minh chúng đang tự chọn asset cũ |
| Router vẫn giữ nhiều mục theo các release cũ; SKILL/router/guide cùng mô tả hành vi Phase 2 | Quy tắc hiện hành khó phân biệt với lịch sử thay đổi |
| Scene-set authoring nói nhân vật có thể chồng lên khung ngoài | Không thể dùng “nhân vật phải nằm trong tường” làm quy tắc chung; kiểm tra compiler và validator có đang áp sai phạm vi |

Giả thuyết cần xác minh: chặn loại context chưa đủ nếu nguồn được phép vẫn chứa lịch sử, resolver còn đường tương thích và output đã bake được reuse. Không quy mọi lỗi về V3 chỉ vì một file mang nhãn migration; phải truy đường đọc, lựa chọn và output thật.

## Hướng chọn

1. Thêm deny-list: ít thay đổi nhưng vẫn để tham chiếu lịch sử trong gói; không đáp ứng mục tiêu dọn sạch.
2. **Cắt nguồn lịch sử khỏi gói hoạt động, giữ lõi hiện hành, tái giới thiệu phần hữu ích qua catalog mới:** đề xuất chọn. Giải quyết cả context lẫn dependency mà vẫn giữ khả năng xử lý job đã duyệt.
3. Viết lại toàn bộ asset engine: phạm vi lớn, dễ làm lệch phong cách kênh; chỉ cân nhắc sau khi xác minh lõi hiện tại không thể sửa.

Kho lưu phục hồi nằm ngoài plugin và execution bundle hiện hành. Giữ lịch sử Git hoặc snapshot riêng để phục hồi; không giữ một thư mục `legacy/` bên trong gói đang nạp rồi chỉ dặn agent đừng đọc.

## Phase A — Chốt nguồn hiện hành và danh sách loại bỏ

Đầu ra: bản đồ phụ thuộc và bảng quyết định từng thành phần, đủ để xóa có căn cứ.

- [ ] Xác minh phiên bản, entry bytes, commit và inventory của plugin cài trên chat, source tương ứng và bundle Phase 2. Không suy ra đồng bộ chỉ từ cùng số version.
- [ ] Quét source có kiểm chứng bằng `rg`: import, đường dẫn đọc file, `load_references`, `guidance_uri`, `selected_guidance_uri`, registry ID, alias, fallback, glob đóng gói, fixture và demo. Chạy trace fresh và continuity để đối chiếu với khai báo.
- [ ] Với mỗi asset/contract, ghi: nơi định nghĩa, ai đọc, chế độ dùng, ID xuất ra, hash, có bị đóng gói không và nguồn preview.
- [ ] Phân loại thành: giữ hiện hành / re-author rồi đưa lại / phục hồi job cũ ngoài gói / xóa. Ghi lý do và consumer cần sửa; không chỉ dựa vào tên V3/V4.
- [ ] Bổ sung ca tái hiện tóc đã loại, mẫu nền cũ, story object thay background, và output bake cũ được reuse. Nếu không có job hiện tại, ghi rõ chưa tái hiện; không dùng artifact lịch sử làm brief cho tập mới.

Nghiệm thu: mọi đường đến lịch sử có owner và quyết định xử lý; biết chính xác nguồn nào tạo lựa chọn sai trong từng ca tái hiện.

## Phase B — Dọn gói hoạt động và hợp nhất quy tắc

Đầu ra: plugin/bundle hiện hành không còn phụ thuộc ngầm vào kho lịch sử.

Các điểm đã xác nhận cần rà sửa: `SKILL.md`, `orchestration/router.md`, `orchestration/phases/02-visual-production.json`, `references/asset-library.md`, `references/asset-library-v4/selection-guide.md`, `references/story-object-effects.md`, `references/asset-library-v4/migration/semantic-derivation.md`. Kiểm tra contract mới `references/story-object-contract.md` trước khi thay đường dẫn; không coi tên file là bằng chứng nội dung đã đúng.

- [ ] Chuyển lịch sử release/migration/ví dụ tập cũ ra khỏi bề mặt authoring và gói phát hành; cập nhật mọi consumer trước khi xóa file.
- [ ] Mỗi chủ đề chỉ có một contract hiện hành: nhân vật, scene-set, shot layout, object, effects và motion. Router chỉ định tuyến; README chỉ mô tả cách dùng; validator thực thi contract.
- [ ] Fresh dùng catalog hiện hành và ID được chọn rõ. Không tự đổi sang legacy khi thiếu ID, thiếu source hoặc compiler lỗi.
- [ ] Đường continuity phục hồi job cũ chỉ dùng snapshot đã xác minh của chính job đó, ngoài gói fresh. Muốn chuyển sang hệ mới phải migration tường minh và mở lại review cho phần thị giác thay đổi.
- [ ] Loại alias/default/fallback dẫn tới mục đã retire; cập nhật registry, compiler, validator, fixture và packaging cùng thay đổi. ID cũ trả lỗi có hướng dẫn xử lý, không ngầm ánh xạ sang mẫu khác.
- [ ] Tách quy tắc accent nằm trong wall khỏi quy tắc staging nhân vật. Khung tạo chiều sâu; diễn viên có thể vượt khung. Không buộc scene-set chiếm toàn chiều cao safe bằng quy tắc ngầm. Từng master xác định geometry; mặt/caption và vùng đọc vẫn được bảo vệ.
- [ ] Khi identity, catalog hoặc compiler đổi, hủy reuse của output phụ thuộc theo hash. Không chỉ thay metadata hoặc đổi tên SVG cũ.

Nghiệm thu: gói fresh không chứa file đã retire; dependency graph không có đường về snapshot lịch sử; không có import hỏng; fresh và continuity có hành vi độc lập, rõ ràng.

## Phase C — Giao diện chọn asset mới và Phase 2 gọn hơn

Đầu ra: một bề mặt chọn hiện hành, hiển thị đúng thứ compiler sẽ dựng.

| Nhóm chọn | Người dùng/authoring thấy | Quy tắc |
|---|---|---|
| Nhân vật | Body, face, tóc, áo, accessory và preview cùng nền | Chốt identity một lần; đổi pose/expression không đổi tóc/áo |
| Scene-set | Master wall/floor/frame, geometry và preview | Độc lập với kích thước nhân vật; không tự thêm đồ phòng |
| Shot layout | Bố cục một người, hai người, object, cận cảnh | Chọn bố cục; không thay scene-set |
| Story object / prop | Ý nghĩa, trạng thái và kiểu trình bày | Phân biệt vật thể thật với biểu tượng suy nghĩ; không thay background |
| Effect / action | Dấu ?, nét nhấn, phản ứng, hành động và endpoint | Có subject/lifecycle rõ; chỉ nạp nhóm đã chọn |

- [ ] Dùng registry hiện hành làm nguồn cho lựa chọn và preview, không viết danh sách song song trong prompt. Mục có ID, version, token, capability, dependency và hash; phần còn thiếu được bổ sung vào registry hiện có nếu phù hợp.
- [ ] Chốt loại bỏ cho đúng phạm vi: tóc bị bỏ cho một nhân vật không tự biến thành lệnh cấm toàn kho. Asset bị retire toàn kho phải biến mất khỏi catalog fresh, default, bundle và resolver fresh.
- [ ] Mẫu lịch sử được chọn giữ lại phải được re-author, kiểm tra token và đặt ID mới. Người chọn xem hình mới, capability và lý do dùng; lineage lịch sử chỉ nằm trong dữ liệu kiểm toán, không dùng làm hướng dẫn sáng tạo.
- [ ] Tách authoring lựa chọn khỏi compiler dựng hình và validator kiểm tra. Tái dùng các compiler đang có nếu đạt yêu cầu; không tạo thêm hệ asset song song.
- [ ] Luồng Phase 2: intent đã duyệt → chọn identity/scene-set/object/action → preview identity → plan state trước SVG → compile → review scene và endpoint. Payload phái sinh không được sửa độc lập.
- [ ] Giữ khóa narration/scope/review; thay asset không cấp lại Content Review giả. Thay phần thị giác đã duyệt phải mở lại đúng phần review bị ảnh hưởng.
- [ ] Catalog có thể nhiều mẫu nhưng context chỉ mang mục được chọn và dependency cần thiết. Motion nhẹ dùng transform/action khi đủ; không tạo nhiều SVG rồi dedupe sau.

Nghiệm thu: lựa chọn có preview đúng asset native; asset không được chọn không tự xuất hiện; không cần đọc lịch sử để chọn và compile một scene mới.

## Phase D — Kiểm thử, đóng gói và đồng bộ

Đầu ra: release có bằng chứng sạch tham chiếu và tương thích handoff.

- [ ] Fixture fresh: không legacy ID/alias/fallback; một ID đã retire phải bị từ chối trước compile.
- [ ] Fixture continuity: snapshot đúng được phục hồi; thiếu snapshot phải báo thiếu nguồn, không kéo thư viện cũ vào fresh.
- [ ] Fixture identity: tóc/áo đã bỏ không xuất hiện ở bất kỳ state hoặc output reuse nào; cùng ID nhưng byte thay đổi phải làm cache mất hiệu lực.
- [ ] Fixture scene-set: nhân vật vượt khung hợp lệ; accent vượt wall không hợp lệ; object không thay nền; kiểm tra thực tế safe/caption/face.
- [ ] Fixture effect/action: đúng subject, enter/release, contact khi cần, endpoint có ý nghĩa. Review tắt tiếng setup/friction/payoff trên scene thật.
- [ ] Kiểm tra graph và nội dung archive: không đường đọc retire, không lịch sử/demo thừa, đủ compiler dependency và source hash. Chạy tại máy nếu GitHub Actions hết quota; chưa chạy phải ghi chưa chạy.
- [ ] Chạy handoff Job@5 và ZIP roundtrip, rồi import vào local runner tương ứng. Không mở rộng contract runner hoặc nhét catalog authoring vào ZIP nếu không cần.
- [ ] Kiểm tra runner bằng still/preview cho vị trí và motion thực tế; native endpoint không chứng nhận timing hoặc MP4.
- [ ] Đồng bộ source, bundle và plugin chat; xác minh entry bytes sau tải lại. Ghi riêng trạng thái GitHub / archive / plugin cài / runner import, không gộp thành một nhãn “đã cập nhật”.

Nghiệm thu: không P1 về tham chiếu sai, identity, background hay handoff; bằng chứng từng môi trường có thật; khả năng rollback dựa vào snapshot ngoài gói hoạt động.

## Thứ tự và giới hạn triển khai

A → B → C → D. Hoàn tất mỗi phase bằng một thay đổi review được; không chia thành hàng chục đợt vá nhỏ. A quyết định danh sách xóa chính xác; B loại đường quay lại trước khi C bổ sung mẫu. Không mở rộng kho trong lúc nguồn cũ vẫn còn tự nạp.

Kế hoạch chi tiết theo file/hàm/lệnh test sẽ được khóa sau Phase A có source compiler thực tế. Các tên đường dẫn trong mục bằng chứng là đường đã đọc; không giả định mọi đường đó tồn tại trên filesystem hiện tại. Chưa có thay đổi plugin, kho asset, repo hoặc runner trong yêu cầu lập kế hoạch này.
