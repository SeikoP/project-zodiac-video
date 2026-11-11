# Audit tốc độ Phase 2 — 2026-11-11

Phase 2 nhận narration đã duyệt, tác giả hóa Visual Intent, biên dịch tài nguyên/cảnh, kiểm tra và đưa ra Visual Review. Phạm vi audit: một agent làm một video 1–2 phút trên máy Windows; không thay narration, Job@5 hay quyền phê duyệt.

## Bằng chứng và giới hạn

Checkout: `main`, HEAD `79f58ce3`, có thay đổi chưa commit từ trước. Audit đọc source trong `plugins/zodiac-video-pipeline`; không chạy bootstrap để nhận tập mới và không sửa các workspace cũ.

| Workspace lịch sử | Scene | Director beat | Event | Asset khai báo | Visual Intent trên đĩa | Tổng thời gian step native trong receipt cuối |
|---|---:|---:|---:|---:|---:|---:|
| `2026-10-17-songngu-revision-02` | 8 | 8 | 17 | 4 | 94.930 byte | 21.134 ms |
| `2026-10-21-bocap-control` | 5 | 5 | 14 | 4 | 57.905 byte | 19.383 ms |

Nguồn: `.zodiac-work/episodes/<episode>/.authoring/visual-intent.json` và `phase02-execution-receipt.json`. Đây là số đo cũ, ở receipt cuối, không phải benchmark phiên hiện tại. Tổng step không phải wall time; không gồm authoring, các lần chạy trước, chờ tool, preview/review hay LocalRunner. Workspace Song Ngư có 13 thư mục `projection-backup-*`; đây là dấu vết sửa, không chứng minh 13 lần thất bại hay thời gian từng vòng.

Không có workspace được xác nhận là phiên mất 2–3 tiếng. Vì vậy chưa thể phân bổ số giờ này hoặc công bố mức giảm end-to-end. Không xem video cuối trong audit này; nhận xét đầu ra chưa “wow” là phản hồi của người dùng, chưa phải kết quả đánh giá hình ảnh độc lập.

## Phát hiện theo ưu tiên

### 1. Chi tiết lỗi native bị mất trước khi tới task sửa — đã sửa

`phases/phase02/phase02-execute.mjs`: `nodeRun` chỉ lưu phần đuôi stdout 4.500 ký tự. Khi step thất bại, report chỉ thêm `NATIVE_STEP_FAILED`; `repairContext` lấy `report.issues` và không chuyển full log. `planBatchRepair` vì thế không nhận được mã lỗi/scene/entity thực để gom sửa.

Thay đổi: đọc mảng `issues` từ JSON stdout đầy đủ trước khi cắt log; giữ các issue có `code` hợp lệ và gắn step thực thi vào report. Lỗi chung, exit code, trạng thái BLOCKED và nguồn hash vẫn giữ. Log không phải JSON vẫn dùng đường lỗi chung; không đoán issue từ văn bản tự do. Giới hạn buffer tiến trình 4 MiB vẫn áp dụng.

Regression: một compiler fixture trả 80 lỗi, lớn hơn phần đuôi log; trước sửa report có 0 lỗi chi tiết, sau sửa giữ đủ 80 và gom đúng vào nhóm cast. Đây là sửa độ đầy đủ của đầu vào repair; chưa phải đo thời gian tiết kiệm trong một phiên agent.

### 2. Hướng dẫn buộc refresh context quá thường xuyên — đã sửa hướng dẫn

`skills/zodiac-video-local/SKILL.md` trước đây yêu cầu `resume-brief --context` sau mỗi validator. Cùng một task có nhiều validator nên điều này tạo thêm lần gọi tool và đọc context dù agent đã giữ các hướng dẫn hiện hành.

Hướng dẫn mới chạy nhóm kiểm tra được chỉ định cho cùng task, refresh một lần sau nhóm. Vẫn refresh sau canonical source write, commit, phase transition; dừng nếu đầu vào upstream thất bại; không chạy song song các writer dùng chung production/state. Hash, task ID và required references không được bỏ qua. Thêm phân biệt audit pipeline với production để audit không tự nhận một handoff.

Lợi ích hiện là giảm số thao tác được yêu cầu trong workflow; chưa đo bằng phiên thực tế. Thay đổi source skill chưa cập nhật plugin cache đang cài.

### 3. Chỉ tiêu beat cố định tạo thêm authoring không cần thiết — đã refactor ngày 12/11

Router cũ chọn scene có dưới 4 director beat cho task `DESIGN_SCENE_BEATS`, chỉ miễn cho một số reflection/transition. Router hiện chọn scene chưa có director beat hoặc có event chưa được `event_ids` của các beat bao phủ. Một beat hoàn chỉnh được chuyển tới native checks; năm beat bỏ sót event vẫn phải sửa, kể cả scene sparse.

Không tự cắt beat/event cũ và không bỏ native narration coverage, director semantics, continuity, completeness hay Visual Review. Task sửa vẫn giới hạn đúng scene và bị vô hiệu khi source thay đổi. Số beat giờ theo nội dung; không tự coi số lượng là chất lượng. Cần đối chứng video thực để đánh giá tác động tới chất lượng và tổng giờ authoring.

### 4. Native profile làm mất cảnh báo thiếu thời gian authoring — đã sửa

`core/performance/diagnose-phase02.mjs` trước đây chỉ phát `END_TO_END_AUTHORING_TIME_UNMEASURED` khi thiếu `profile.wall_clock_ms`. Nhưng profile đó chỉ đo executor. Có profile native không đồng nghĩa có số đo agent/review.

Cảnh báo giờ luôn đi cùng diagnosis native; regression kiểm tra cả khi có wall time. `episode-profiler.mjs` đã có phân loại agent/native/tool/review và khoảng thời gian; nên dùng lại cơ chế này thay vì thêm hệ thống đo mới. Summary toàn plugin yêu cầu đủ ba phase; không dùng nó làm baseline đầy đủ cho phiên Local chỉ chạy Phase 2–3.

## Thứ tự tối ưu tiếp theo

1. Đo một tập 1–2 phút thực: thời điểm nhận handoff, lần ghi intent đầu, số lần sửa canonical source, thời gian native mỗi lần, preview sẵn sàng, chờ review. Không ghi thời gian thiếu thành zero. Tách lần làm đầu với lần sửa một scene.
2. Dùng thông tin lỗi đầy đủ để sửa theo nhóm source owner; không dò từng lỗi rồi chạy lại cả pipeline. Giữ cache hiện có và chỉ thay các phạm vi cache khi có benchmark cold/warm/single-edit và kiểm tra sửa asset/receipt bị tamper.
3. Thử chất lượng ở scene hook và scene payoff trước khi tác giả hóa toàn tập. Đây là đề xuất thay workflow, chưa có checkpoint pilot được triển khai. Không giả PASS, không thay thế Visual Review và không xuất Job@5 từ tập chưa hoàn chỉnh.
4. Sau đó mới quyết định thay quota beat và giảm dữ liệu lặp mà agent phải tự viết. Hiện writer đã sinh các projection từ một Visual Intent; không quay lại viết tay nhiều plan và không xóa projection mà native compiler vẫn đọc.

Mục tiêu kiểm chứng: cùng narration và tiêu chuẩn review, giảm thời gian agent thực làm và số vòng sửa; chất lượng hook/payoff ít nhất giữ nguyên. Chưa có cơ sở đặt cam kết 20/30/60 phút hay hệ số tăng tốc.

## Phạm vi thay đổi và rủi ro

Sửa executor, diagnosis, skill Local và hai file test; không thêm dependency, đổi schema Job@5, bỏ validator, đổi quota hay ghi vào workspace sản xuất. Issue chi tiết sẽ làm repair context lớn hơn khi có nhiều lỗi; đây là dữ liệu cần để sửa theo nhóm. JSON stdout lẫn log hoặc bị cắt do vượt buffer vẫn chỉ có lỗi chung và log đuôi.

Không build/release, cập nhật cache plugin, render MP4 hay thay các sửa đổi có sẵn của người dùng. Việc đo giảm từ 2–3 tiếng và đánh giá đầu ra cần phiên sản xuất đại diện.

## Kiểm chứng thay đổi

Hai regression mới đều thất bại trước sửa và PASS sau sửa. Bộ kiểm tra liên quan chạy sau thay đổi: **38/38 PASS**, gồm `phase02-execute.test.mjs`, `phase02-fastpath-v2613.test.mjs`, `context-delivery.test.mjs`, `core/workflow/tests/deterministic-execution.test.mjs`, `core/performance/tests/episode-profiler-regression.test.mjs`. Có kiểm tra reuse, asset bị sửa/xóa, thay đầu vào QC, thiếu state, thiếu source và precompile gate. `git diff --check` PASS. Chạy diagnosis đọc-only trên workspace Bọ Cạp trả tổng step 19.383 ms, wall time chưa có và cảnh báo thiếu số đo authoring.

Không chạy toàn bộ test repository hoặc một tập production mới; kết quả trên không chứng minh cải thiện tốc độ end-to-end hay chất lượng hình ảnh.

## Hoàn thiện ngày 12/11: meme và vòng authoring

### Lỗi adapter làm meme không đi hết pipeline — đã sửa

`compile-visual-grammar.mjs` vẫn tự sinh effect từ metadata lịch sử của cả 11 template; `compile-meme-props.mjs` hiện từ chối effect với `EFFECTS_REMOVED`. Hai module riêng lẻ có test nhưng thiếu test nối trực tiếp. Đã bỏ phần sinh effect cũ, giữ topology/bố cục/đạo cụ và thông tin tham chiếu lịch sử. Cả **11 adapter** giờ được kiểm tra qua compiler đạo cụ; explicit effect vẫn bị chặn theo hợp đồng hiện tại.

### Phản ứng xuất hiện từ đầu làm mất nhịp meme — đã sửa

Meme acting trước đây chỉ được kiểm tra ở `initial_state`. Request hiện hỗ trợ `grammar.meme_composition.state_bindings`, ánh xạ vai nhân vật tới state phản ứng. Compiler kiểm tra role/state hợp lệ, state nhìn thấy được và event voice-anchor có thật trong lời kể; dùng lại state trace để kiểm tra chuỗi chuyển trạng thái. Character Assembly và validator độc lập cùng kiểm tra pose/expression/crop ở state được chọn. Request cũ không khai báo binding vẫn giữ hành vi initial-state.

Ví dụ: nhân vật bình thản ở setup, đến câu “vẫn nhớ từng chữ” mới chuyển sang facepalm. Tóc, silhouette, màu áo và glyph cung giữ cùng identity. Không thêm narration, nhân vật mẫu từ meme hay effect trang trí. Hướng dẫn chọn meme theo tình huống và tương phản setup/phản ứng đã vào `references/visual-direction.md` và Local skill.

### Hình thể facepalm và preview thực — đã sửa, đã xem trong trình duyệt

Ảnh native cho thấy bàn tay cũ là đầu ngón rất nhỏ cạnh mắt. Đã vẽ lòng bàn tay lớn che vùng trán/mặt, đồng bộ cả nét sticker nền và bàn tay phía trước. Regression kiểm tra kích thước lòng bàn tay; các test pose qua mọi body profile và validator Human Stroke/identity vẫn PASS.

Preview có hai tình huống facepalm/cry, sử dụng SVG và transform từ compiler thật. Đã chụp/xem bằng Thorium headless với profile tách biệt. Công cụ demo từ chối workspace có pipeline state và thư mục đã có dữ liệu nếu không có receipt sở hữu demo; test xác nhận không ghi đè source episode.

- Preview: `.runtime/phase02-meme-review/index.html`
- Ảnh đã xem: `.runtime/phase02-meme-review/overview.png`
- Receipt: `.runtime/phase02-meme-review/meme-demo-receipt.json`, `DEMO_ONLY`, `timed_render:false`.
- Tái tạo: `node plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/audit/preview-meme-acting.mjs`.

Đây là demo endpoint native để xem diễn xuất, không phải episode hoàn chỉnh, preview audio, MP4 hay phê duyệt chất lượng của người dùng.

### Context và đo lường — đã hoàn thiện đường native

Planner hiện khai báo rõ tài liệu exit được trì hoãn và nạp lại khi validate/review. Default draft chỉ trì hoãn hướng dẫn review visual-quality/retention; **catalog bắt buộc ở entry vẫn được nạp**. Các scoped work unit vẫn theo manifest. Sửa fixture capsule dùng API flags/options được hỗ trợ, và fixture completeness cũ để có context cue/state chain đúng hợp đồng hiện hành; không giảm yêu cầu background.

Profiler bổ sung số đo riêng từng phase: khoảng quan sát, hợp các interval, gap trong khoảng đã quan sát, review-wait và danh sách category chưa đo. Phase 2 Local không còn phải có span Phase 1 mới xem được số đo cục bộ. Dữ liệu thiếu/mixed identity vẫn trả null; native-only observations vẫn thiếu thời gian agent. `episode-utilization-report.mjs` đưa các số đo này vào `optimization.phase_observations`.

Benchmark `benchmark-plugin-orchestration.mjs` đã chạy PASS trên Windows sau khi sửa lỗi chuẩn hóa tiền tố `./` trước/sau dấu phân cách. Kết quả hiện tại lưu ở `.runtime/phase02-orchestration-benchmark.json`: design visual_compile **11.319 token**, assets **10.190 token**, publish **6.587 token**, không có required reference bị pending ở ngân sách 16k trong các case này. Đây là số đo transport fixture với reference thật, không phải token toàn phiên hoặc mức tăng tốc end-to-end.

### Kiểm chứng cuối

Full plugin Node suite theo các nhóm test trong CI: **1.126/1.126 PASS**, không skip; log `.runtime/phase02-meme-tests.log`. Đã chạy lại sau khi sửa các lỗi context/fixture. Hai test guard demo đều được quan sát RED trước fix và GREEN sau fix. Rà soát độc lập cuối xác nhận guard và việc giữ mandatory entry catalogs; `git diff --check` PASS. Benchmark CLI chạy PASS riêng sau sửa đường dẫn Windows.

Chưa build/release, cập nhật cache plugin đang cài, hoặc chạy một episode mới thành MP4 có audio. Nguồn thay đổi nằm trong checkout; hiệu quả 2–3 giờ và chất lượng timing thực tế vẫn cần đo ở episode đại diện. Các sửa đổi có sẵn của người dùng được giữ nguyên.
