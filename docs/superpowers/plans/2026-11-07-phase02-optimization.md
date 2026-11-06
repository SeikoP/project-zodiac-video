# Tối ưu Phase 2: context nhỏ, điều phối có chủ sở hữu, sửa theo cảnh

Ngày khảo sát: 2026-11-07. Trạng thái: đã triển khai bản thử điều phối/XState/CodeGraph trong source; các phần tối ưu còn lại tiếp tục theo kế hoạch.
Phạm vi: source hiện tại trong checkout, bao gồm các thay đổi local của lượt trước; chưa xác minh bản đang cài trên ChatGPT.

Ưu tiên hiện tại theo chỉ đạo mới nhất: điều phối, context, hợp đồng tác vụ, dependency và sửa/resume. Chưa triển khai mở rộng đánh giá ảnh/video hoặc công cụ kiểm thử đầu ra; các mục đó để sau.

## Quyết định kiến trúc đề xuất

Giữ ba phase công khai: Content → Visual Production → Handoff. Bên trong Phase 2, tách rõ ba công đoạn bằng context và checkpoint: thiết kế visual, sản xuất/kiểm tra theo cảnh, publish/duyệt tổng. Tiếp tục dùng các step ID `visual_compile`, `assets`, `publish_prep`; không tạo hệ trạng thái thứ hai.

Các phương án đã cân nhắc:

| Phương án | Lợi ích | Đổi lại | Đề xuất |
| --- | --- | --- | --- |
| Giữ ba phase, tách công việc/context trong Phase 2 | Giảm context và vòng sửa; giữ state/runner contracts | Cần sửa điều phối và giao context thực sự | Làm trước |
| Bốn phase: Content → Visual Direction → Production/Review → Handoff | Hữu ích khi cần hai phiên làm việc hoặc hai vai trò độc lập | Migration phase IDs, gates, approvals, Studio và nguồn thực thi; thêm điểm bàn giao | Chỉ làm nếu cần ranh giới vận hành độc lập |
| Tách riêng Publish Prep thành phase | Tách công việc cover/copy | Không xử lý phần context nặng của visual/assets; thêm state và file | Không ưu tiên |

Thêm tên phase trong cùng hội thoại không xóa lịch sử model. Muốn cách ly context giữa các tác vụ LLM, host phải hỗ trợ phiên/tác vụ mới không kế thừa hội thoại, chỉ nhận payload đã lọc. Nếu host không hỗ trợ, ghi rõ mức bảo đảm là giới hạn đầu vào mới, không phải cách ly tuyệt đối. Không giả lập reviewer độc lập bằng đổi tên role.

## Hiện trạng được xác minh

Đo bằng `loadStepContext` với flags của template mới, `environment_mode=canvas`, không chỉ định asset IDs. Số byte dưới đây là UTF-8 của reference và phase guide, chưa gồm dữ liệu tập, ảnh, system prompt hoặc tool schemas.

| Step | Reference | Reference bytes | Guide bytes | Tổng xấp xỉ |
| --- | ---: | ---: | ---: | ---: |
| visual_compile | 21 | 68,554 | 7,906 | 74.7 KiB |
| assets | 16 | 69,186 | 7,906 | 75.3 KiB |
| publish_prep | 4 | 21,086 | 7,906 | 28.3 KiB |

Các số này là snapshot, không phải token count hay số đo latency. File hướng dẫn thay đổi thì phải đo lại. Cả ba step hiện không có `context_scopes`, nên draft/review nhận cùng danh sách reference.

Điều phối hiện tại:

1. `resume-brief.mjs` đọc state, chọn phase/step chưa hoàn tất, gọi `plan-step-context.mjs`.
2. Planner hợp nhất guidance của entry capabilities, references của step, asset selection và capability registry. Nó liệt kê và hash file; chưa cưỡng chế tổng budget của task model.
3. Sau Content Review, transition gate đòi narration cùng production/asset/grammar/character plans. Activation chỉ mở Phase 2 khi đã AUTHORING_READY. Vì thế authoring visual phải bắt đầu trước khi Phase 2 được kích hoạt.
4. Agent viết Visual Intent; writer/compiler sinh các projection. Đây là cấu trúc cần giữ.
5. Native executor chạy preflight song song rồi danh sách 15 native task; scene-direction có worker/cache theo cảnh. Worker hiện là tiến trình Node, không phải tác vụ LLM được cách ly.
6. Agent vẫn phải ghép đủ capabilities, gates và outputs của manifest, commit từng step, chuẩn bị review, chờ user approval rồi seal. Native core thành công không đồng nghĩa manifest hoàn tất hoặc Visual Review đã được duyệt.
7. Revision có semantic graph, native checkpoints, scene cache và repair plan. Chúng đã tồn tại; cần nối điều phối nhất quán thay vì thêm engine mới.

Nguồn đối chiếu dưới `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/`:
- `orchestration/plan-step-context.mjs`, `orchestration/resume-brief.mjs`, `orchestration/phases/02-visual-production.json`.
- `core/state/validate-pipeline-state.mjs`: context validator kiểm tra các category được khai báo trong `context_manifest`; chưa chứng minh lịch sử model/file-read thực tế chỉ chứa các nguồn đó. Manifest rỗng cũng không cung cấp chứng cứ về các nguồn đã đọc.
- `phases/phase02/phase02-transition-gate.mjs`, `activate-phase02.mjs`, `phase02-execute.mjs`, `commit-phase02-step.mjs`.
- `core/performance/compile-step-capsule.mjs`: capsule gom bytes chính xác, không tự rút gọn ngữ nghĩa; delta cần caller-held ID khớp.
- `features/visual-composition/derive-scene-context.mjs`: đã có index theo cảnh nhưng budget hiện là số item; bounded output có cắt chuỗi và không đủ thay thế authoring payload hoàn chỉnh.
- `features/scene-production/native-scene-executor.mjs`, `core/cache/phase02-semantic-cache.mjs`.

## Các điểm gây quá tải hoặc lọt context

- Lịch sử chat cũ vẫn còn nếu host tiếp tục cùng phiên; source code không chứng minh hoặc xóa được phần đó.
- Guidance từ nhiều tầng được cộng lại; deduplicate đường dẫn không loại bỏ nội dung trùng nghĩa giữa các file.
- Catalog và hợp đồng hình học lớn đang được đưa cho agent cả khi compiler có thể đọc trực tiếp.
- Visual Compile cho phép cả Narrative Plan và evidence summary; đây là nguồn hợp lệ theo policy hiện tại nhưng rộng hơn nhu cầu chuyển narration thành visual.
- Đổi role hiện không thu nhỏ Phase 2. Publish Prep cũng nhận guidance quảng cáo dù không cần lựa chọn topology/treatment nữa.
- Kiểm tra category do bên gọi khai báo không tương đương kiểm soát quyền đọc file. Chưa có bằng chứng một tập thật đã bị nhiễm context; đây là khoảng trống bảo đảm và tải đầu vào quan sát được.

## Mục tiêu nghiệm thu

### Yêu cầu nhịp trong cảnh, bổ sung theo chỉ đạo người dùng

Mặc định mỗi cảnh phải được thiết kế **4–5 nhịp kể chuyện bằng hình ngay từ bản authoring đầu tiên**. Không chờ tới self-review mới phát hiện cảnh chỉ có một hành động rồi bổ sung. Ít context chưa được chứng minh là nguyên nhân duy nhất: gate hiện tại cũng chủ yếu kiểm tra có hành động/coverage, chưa yêu cầu đủ một chuỗi diễn biến bên trong cảnh.

- Một nhịp là một thay đổi có ý nghĩa: hành động, phản ứng, quan hệ, thông tin, trạng thái hoặc trọng tâm thị giác làm cách hiểu cảnh tiến thêm. Số nhịp không bằng số event, số entity, số keyframe hay số lần zoom.
- Chớp mắt, rung, đổi pose hoặc reveal lặp lại không được tách thành nhiều nhịp chỉ để đủ số. Nhiều entity cùng phản ứng trong một thời điểm có thể thuộc cùng một nhịp.
- Lập nhịp trong `scenes[].director_beats` của Visual Intent hiện có; đối chiếu với per-beat `visual_coverage` và events khi projection. Không thêm file beat-plan riêng. Mỗi nhịp cần voice anchor/thứ tự rõ, entity liên quan, hành động/trạng thái trước–sau và đóng góp ngữ nghĩa có thể chỉ ra trong preview.
- Context của tác vụ một cảnh phải giữ nguyên toàn bộ 4–5 nhịp, lời thoại, các phụ thuộc asset/cast và đầu–cuối cảnh liền kề cần thiết. Nếu vượt budget thì chia công việc kỹ thuật hoặc điều chỉnh budget; không cắt nhịp để giảm context và không để mỗi task quên diễn biến toàn cảnh.
- Cảnh ngắn hoặc khoảng lắng có chủ ý có thể ít nhịp hơn khi có lý do gắn với lời thoại và vai trò thực tế. `sparse_reason` chung chung không tự miễn kiểm tra. Mốc 4–5 là mặc định authoring, không phải bắt mọi cảnh có đúng năm chuyển động bất kể độ dài; cảnh cần nhiều nhịp hơn được giữ khi có cơ sở.
- Preflight phát hiện thiếu nhịp, nhịp không có hình thể hiện, chỉ lặp lại ý hoặc không liên kết lời thoại trước khi chạy native tốn chi phí. Agent sửa canonical source rồi mới compile; review cuối vẫn phải xem nhịp thực tế qua ảnh/endpoints. Timing theo giây chỉ được xác nhận sau runner TTS.

Task router của bản thử đã quay lại task thiết kế nhịp khi cảnh có dưới bốn Director beats, với ngoại lệ reflection/transition có lý do cụ thể. Kiểm tra đủ 4–5 nhịp có ý nghĩa bằng coverage/grounded review vẫn cần hoàn thiện; chưa được coi đếm beat là chứng minh chất lượng. Tái sử dụng `validate-scene-experience.mjs`, `validate-phase02-authoring-completeness.mjs` và Director/coverage checks; không tạo thêm một vòng phê duyệt hay mặc định bắt người dùng nhắc bổ sung nhịp.

Các budget sau là mục tiêu đề xuất cho payload text do plugin cấp, gồm guidance được nạp mới và dữ liệu tập được đưa vào task; không gồm system/tool schemas hoặc bytes ảnh. Không chuyển trực tiếp KiB thành token hoặc hứa tốc độ trước benchmark.

- Task thiết kế toàn tập: tối đa 24 KiB; task làm/sửa một cảnh: tối đa 12 KiB; task publish: tối đa 12 KiB.
- Compiler đọc schema/catalog đầy đủ phía code. Agent chỉ nhận contract thao tác và các lựa chọn thực sự liên quan. Khi cần so sánh, trả candidate index/ảnh native có giới hạn thay vì toàn bộ catalog.
- Vượt budget phải tách tác vụ hoặc trả lỗi rõ ràng; không cắt mất lời thoại, entity, event hay yêu cầu sáng tạo để giả đạt budget. Full contracts vẫn tồn tại cho công cụ/validator.
- Không thay đổi lời narration đã duyệt. Hash nguồn, cast continuity, native previews và user approvals vẫn là yêu cầu bắt buộc.
- Sửa một cảnh không biên dịch lại nhân vật/cảnh không phụ thuộc. Sửa cast dùng chung phải cập nhật mọi cảnh dùng cast đó. Sửa publish không chạy character/scene compile.
- No-change rerun không gọi lại scene compiler nếu input, dependency và output hashes khớp. Tampered output phải mất cache hit.
- Agent chỉ sửa Visual Intent và nguồn publish thuộc bước của nó. Projection không trở thành nguồn authoring thứ hai.
- Không tạo plan/checklist/report theo từng lần thử. Giữ cache/checkpoints/receipts cần thiết, một execution index và một review surface hiện hành; không xóa bằng chứng approval hoặc snapshot được approval tham chiếu.

## Ràng buộc chung

- Giữ ba phase IDs, ba step IDs Phase 2, `zodiac-job@5`, renderer theo effective policy; không dùng số renderer từ hướng dẫn cũ làm authority.
- Giữ công việc local của lượt trước; không bump version, build, đóng gói, phát hành hay sửa bản plugin đang cài trong giai đoạn triển khai dev này.
- Giữ quảng cáo hư cấu trong narration/visual thông thường; không mở lại affiliate thật hoặc tạo commerce artifacts.
- Tái sử dụng planner/capsule, scene-context, native executor, cache, state validator và commit hiện tại; không dựng coordinator cạnh tranh.
- Các trường hợp lịch sử chỉ mở bằng snapshot/version đúng; không tự migration hoặc tạo lại approval.

## Review focus

1. Cùng hội thoại và nguồn cũ còn trong model: chỉ được báo cách ly khi host thực sự tạo phiên không kế thừa; kiểm tra payload không chứng minh xóa lịch sử.
2. Thiếu/xuyên tạc context manifest, path traversal, hash drift: chặn trước khi task được chấp nhận; kiểm tra realpath và nguồn đã phân loại.
3. Cảnh nhiều nhân vật/event vượt budget: chia theo đơn vị công việc nhưng giữ đủ phụ thuộc, continuity và lời thoại; không truncate âm thầm.
4. Asset/cast dùng chung, đổi compiler/token, asset bị sửa ngoài: invalidation đúng closure; không reuse receipt của cảnh hoặc dependency đã đổi.
5. Crash, sửa đồng thời, cache hỏng hoặc receipt sai workspace: không commit dở, không ghi đè narration/approval, không biến REVIEW thành PASS.

## Kế hoạch triển khai

Các đường dẫn bên dưới tính từ skill root ở phần nguồn đối chiếu. Tận dụng các test file hiện có; chỉ thêm file runtime khi không có owner thích hợp.

### 1. Sửa ranh giới vào Phase 2 trước

Files: `phases/phase02/phase02-transition-gate.mjs`, `activate-phase02.mjs`, `phase02-handoff-context.mjs`; các test `phase02-transition-gate`, `phase02-handoff-context` và activation hiện có.

- [ ] Viết test: Content Review hợp lệ + đúng narration/plan/scope/source hash được vào Phase 2 dù chưa có production/asset/grammar/character projections.
- [ ] Tách `entry_ready` khỏi `authoring_ready` trong transition report. Activation dùng `entry_ready`; native compilation và commit Visual Compile vẫn yêu cầu `authoring_ready` cùng gates hiện tại. Không đổi ý nghĩa field cũ để lách check.
- [ ] Handoff chỉ xuất nội dung cần cho visual: narration chính xác, scope/member lenses đã chọn, Story Spine, creative constraints, ad constraints và hash nguồn. Raw evidence, candidate bị loại, full QC không đi vào payload model; validator vẫn có thể đọc nguồn gốc.
- [ ] Test thiếu approval, source drift, state/version sai và kích hoạt lại idempotent. Authoring visual phải thuộc state Phase 2 đã active.

### 2. Giới hạn context theo công việc, không chỉ theo phase

Files: `orchestration/phases/02-visual-production.json`, `plan-step-context.mjs`, `resume-brief.mjs`, `core/performance/compile-step-capsule.mjs`, `features/visual-composition/derive-scene-context.mjs`, `features/asset-selection/build-current-asset-review.mjs` và capability/selection metadata liên quan.

- [ ] Viết test role/context matrix cho thiết kế, một cảnh, review, publish; assert budget tổng đúng cách tính ở trên.
- [ ] Mở rộng các API planner/capsule/scene-context hiện có để nhận cùng một `work_unit={kind,scene_id?,asset_ids?}` đã kiểm tra. Kind chỉ gồm `design`, `scene`, `review`, `publish`; đây là phân việc trong step, không phải phase/state engine mới.
- [ ] Tạo context scopes rõ ràng. Đưa catalog/schema đầy đủ sang machine inputs; cấp agent selected rows hoặc native candidate cards. Cập nhật guidance capability tương ứng để không tuyên bố đã đọc tài liệu bị defer.
- [ ] Scene payload cho authoring chứa lời thoại thật, đầy đủ entity/event cần sửa, cast/style locks và continuity liên quan; index bounded hiện tại chỉ làm chỉ mục. Không đưa toàn bộ tập vào một task sửa cảnh.
- [ ] Scene payload phải chứa toàn bộ chuỗi 4–5 nhịp có ý nghĩa của cảnh, không chỉ semantic goal hoặc một action tiêu biểu. Kiểm tra budget không được cắt chuỗi nhịp hay thông tin nhân quả.
- [ ] Budget được kiểm tra tại lúc giao payload. Tách task khi vượt; không dùng `slice` hoặc tóm tắt mất dữ liệu để đạt số byte. Stale capsule/selection/hash thay đổi bắt buộc nạp lại.
- [ ] Publish không nhận lại research, brainstorming hoặc hướng dẫn lựa chọn quảng cáo; chỉ dùng phần narration/ảnh/assets phục vụ cover/copy.

### 3. Bàn giao context có chứng cứ, diễn đạt đúng giới hạn host

Files: `core/state/validate-pipeline-state.mjs`, `core/performance/compile-step-capsule.mjs`, `resume-brief.mjs`, `orchestration/chatgpt-host-map.json`, `references/chatgpt-runtime.md`, `orchestration/tests/context-capsule.test.mjs` và context tests hiện có.

- [ ] Delivery record chứa capsule ID, work unit, role, approved-source hashes, selected paths/section hashes và byte count; bind vào step/scene/task thực tế. Tái sử dụng state/receipt owner, không tạo một file mỗi lượt đọc.
- [ ] Chặn nguồn không được phân loại, hash/path sai, thiếu delivery record khi cơ chế mới đã được kích hoạt; kiểm tra nguồn thật của các path thay vì chỉ tin nhãn category từ agent.
- [ ] Host hỗ trợ task/session mới thì dùng context chỉ từ capsule; host không hỗ trợ thì ghi `same_session` và không tuyên bố isolation. Không tự thêm quyền host/tool hoặc khẳng định sandbox tồn tại khi chưa kiểm chứng.
- [ ] Compatibility có chủ đích: receipt cũ không bị tự viết lại thành receipt context mới. Test nguồn forbidden bị gắn nhãn hợp lệ và raw research xuất hiện trong payload đều bị từ chối. Vẫn ghi rõ source-side records không kiểm chứng được mọi byte lịch sử host giữ ngoài plugin.

### 4. Nối điều phối hiện có thành một vòng chạy rõ ràng

Files: `phases/phase02/phase02-execute.mjs`, `commit-phase02-step.mjs`, `core/workflow/deterministic-execution.mjs`, `core/performance/parallel-native-preflight.mjs`, manifest Phase 2 và native commit/preflight tests.

- [ ] Lập một mapping authoritative `gate → capability/receipt + predicate` và `task → owner step + dependencies + reads/writes`; tái sử dụng DAG trong deterministic-execution. Không giữ hai danh sách yêu cầu có thể lệch độc lập.
- [ ] Executor lấy bước cần chạy từ state/receipts, trả một next action cụ thể: cần agent authoring, chạy native, cần sửa nguồn hoặc chờ user review. Chỉ tự chạy/commit phần có output và native evidence xác minh được.
- [ ] Gate kỹ thuật được suy ra từ receipt thật. Gate ngữ nghĩa phải có grounded review artifact tương ứng; không suy ra chất lượng sáng tạo từ exit code hoặc gán toàn bộ gate_results=PASS.
- [ ] Bổ sung kiểm tra nhịp vào các gate scene-experience/completeness/Director hiện có: test 4–5 nhịp liên kết voice/coverage được chấp nhận; một hành động cộng bốn event trang trí không đủ; nhịp không có coverage, lặp ý hoặc không có thứ tự phải REVIEW. Test cảnh ngắn có lý do thực sự, ngoại lệ khai báo rỗng, và cảnh nhiều nhịp vượt context budget để bảo đảm không bị truncate. Đếm cấu trúc chỉ là kiểm tra đầu; grounded visual review phải đánh giá đóng góp kể chuyện.
- [ ] Phần native/commit không nạp full hướng dẫn vào model. Preflight độc lập tiếp tục chạy song song; shared writes giữ một owner/lease. Node workers không được mô tả thành LLM reviewer.
- [ ] Test lỗi giữa chừng, receipt khác workspace, concurrent state/source change và native core thành công nhưng còn thiếu manifest gate: chưa được vào Visual Review/seal.

### 5. Sửa theo dependency, kiểm tra theo cảnh

Files: `core/cache/phase02-semantic-cache.mjs`, `phases/phase02/phase02-selected-dependencies.mjs`, `features/scene-production/native-scene-executor.mjs`, `features/visual-composition/write-phase02-authoring.mjs`, `core/audit/assess-revision-impact.mjs`, preview/review owners và semantic/native cache tests.

- [ ] Dùng semantic dirty closure để chọn task và scene inputs thực tế. Signature của một task không đọc cả tập nếu task chỉ phụ thuộc một cảnh/asset.
- [ ] Giữ cache theo nội dung, compiler/dependency hashes, output hashes và receipt lineage. Global style/cast/token được truyền vào đúng mọi cảnh sử dụng; không chỉ dựa vào scene ID.
- [ ] Repair trả canonical source path, scene/entity ID, mã lỗi và gate cần chạy lại. Sửa Visual Intent một lần; writer tái sinh projections; không sửa file dẫn xuất để làm gate im lặng.
- [ ] Test no-change, một prop trong một cảnh, shared cast, đổi palette/token, đổi compiler liên quan/không liên quan, output tamper và publish-only. Assert số scene compiler calls và tập cảnh reuse; không chỉ assert chữ PASS.
- [ ] Tổng review vẫn kiểm tra continuity và cover/narration identity sau sửa cục bộ. Approval chỉ được giữ khi binding chính xác chứng minh không đổi nguồn thuộc approval đó.

### 6. Giảm file sinh và benchmark trước khi ship

Files: `phases/phase02/finalize-phase02-workspace.mjs`, `features/visual-composition/prepare-phase02-review.mjs`, `core/performance/episode-profiler.mjs`, `core/audit/benchmark-phase02-simplification.mjs`, các guide/router và profiler/review tests hiện có.

- [ ] Giữ một Visual Intent do agent viết; tám projection vẫn machine-owned cho đến khi đã kiểm tra/migrate mọi reader. Không gộp vật lý rồi làm hỏng renderer/validator chỉ để giảm số tên file.
- [ ] Reuse một execution index/review surface hiện hành; diagnostics mặc định ngắn trên stdout. Chỉ lưu log đầy đủ khi debug; không nhân bản prose plans và báo cáo từng attempt.
- [ ] Kiểm tra việc giữ `.authoring/superseded/`: chỉ giữ phiên bản cần cho approval/source lineage; cache/temp không được biến thành kho snapshot không giới hạn. Không tự xóa evidence/review được tham chiếu.
- [ ] Benchmark cùng fixtures/tập đại diện với 1, 5 và 12 cảnh; tách cold run, no-change warm run, one-scene edit, shared-cast edit và publish-only. Ghi context bytes/tokens nếu host cung cấp, tool turns, native time, scene rebuild/reuse, file count/bytes và review wait riêng.
- [ ] Chạy unit/integration hiện có cùng test payload poisoning, budget overflow, receipt tamper và rollback. Kiểm tra review images thật; test native không thay thế mute-review hoặc runner media QA.
- [ ] Cập nhật guide theo flow mới, rồi mới cân nhắc release theo yêu cầu riêng. Không ship dựa trên số unit tests hoặc dự báo tăng tốc.

## Thứ tự và điều kiện xem xét phase thứ tư

Triển khai 1 → 2 → 3 → 4 → 5 → 6; mỗi bước phải có regression test trước khi sửa và một commit riêng khi người dùng yêu cầu lưu commit. Không chạy migration phase IDs trong kế hoạch này.

Chỉ xét phase thứ tư sau khi budget và incremental execution đã hoạt động mà vẫn cần bàn giao Visual Direction cho phiên/người/công cụ độc lập, hoặc cần user duyệt storyboard riêng trước sản xuất. Khi đó viết migration riêng cho state/phase-index, review receipts/seal, nguồn thực thi, Studio/runner integration và resume phiên cũ. Không thêm bước user approval mới chỉ để tạo cảm giác kiểm soát.

Kết quả kỳ vọng: agent tập trung vào thiết kế và quyết định sáng tạo; code chịu trách nhiệm điều phối kỹ thuật, giữ trạng thái, chạy validator, cache và compile; người dùng chỉ duyệt bề mặt review đủ bằng chứng.

## Công nghệ/repo cho điều phối — cập nhật ưu tiên 2026-11-07

Đã thêm dependency pin XState 5.33.3 và CodeGraph 1.6.2 vào plugin root cùng lockfile, cài và chạy thử trên Windows/Node 26.5.1. Tạm hoãn Promptfoo, Playwright và các đề xuất đánh giá ảnh/video. Giữ pipeline-state là authority; XState chỉ suy ra task, không lưu một workflow state cạnh tranh.

| Thành phần | Công nghệ/repo | Vai trò và lựa chọn đề xuất |
| --- | --- | --- |
| Chuyển trạng thái, quyền đi bước tiếp theo | [XState](https://github.com/statelyai/xstate), [guards](https://stately.ai/docs/guards) | Ưu tiên khảo sát cho kiến trúc hiện tại: code quyết định transition từ state và evidence. Nếu thay bộ transition hiện có thì phải có adapter/migration, không chạy hai state machines song song. Tận dụng deterministic-execution trước; chỉ nhận dependency khi nó giảm logic phân tán thực tế. |
| Điều phối tác vụ LLM và context riêng | [LangGraphJS](https://github.com/langchain-ai/langgraphjs), [subgraphs](https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs) | Chọn khi có backend/runner chủ động gọi model. Task nhận state schema riêng, input mapping rõ và checkpoint; không tự gửi toàn bộ history. Đây là phương án runtime khác, không mặc định thêm bên cạnh XState. |
| Hợp đồng task/context | JSON Schema hiện có; cân nhắc [Ajv](https://ajv.js.org/guide/getting-started.html) | Kiểm tra task type, source revision, read/write scope, scene IDs, đủ trường nhịp và expected evidence trước khi giao task/nhận patch. Không suy ra ý nghĩa kể chuyện từ schema hợp lệ. Không thêm Zod/schema thứ hai chỉ để khai báo lại cùng contract. |
| Ghi checkpoint, task ledger, idempotency | JSON/atomic writes hiện có; [SQLite](https://sqlite.org/lang_transaction.html) nếu cần transaction nhiều bản ghi | Chưa chuyển storage chỉ vì thêm công nghệ. Khi task song song cần persistence mạnh hơn, chuyển có migration và một authority; JSON cũ chỉ còn projection tương thích. SQLite vẫn chỉ có một writer đồng thời. |
| Chẩn đoán đường chạy | Trace index hiện có; [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/) khi cần trace xuyên dịch vụ | Theo dõi task nào gọi gì, retry vì sao, revision nào bị đổi và context bytes. Không đưa trace/log đầy đủ vào model và không mở thêm server quan sát trước khi có nhu cầu. |

Những phần cốt lõi cần hoàn thiện, độc lập với chọn framework:

1. **Next-task resolver:** từ state + dependency graph + receipts, xuất đúng một next action có owner, phạm vi đọc/ghi và điều kiện hoàn tất. Agent không tự chọn bỏ qua bước dựa trên trí nhớ.
2. **Context compiler:** tạo payload theo task/scene, giữ chỉ đạo sáng tạo và đủ 4–5 nhịp; nguồn đã duyệt được bind hash; raw research/history không mặc định truyền sang. Không hứa xóa lịch sử host ChatGPT nếu host chưa hỗ trợ phiên mới.
3. **Task contracts:** record chứa task ID, type, scene/asset scope, expected source revision, allowed writes, required fields và required evidence. Không cho task viết ngoài phạm vi hay tự cấp approval.
4. **Dependency và repair routing:** lỗi quay đúng owner; thay đổi cast/style chung mở mọi cảnh liên quan; thay đổi một cảnh chỉ mở closure tương ứng. Giữ source hash và output hash khi tái sử dụng kết quả.
5. **Resume/retry:** phân biệt lỗi hạ tầng tạm thời với lỗi authoring; retry có giới hạn, side effects idempotent, commit theo expected revision, rollback hoặc giữ trạng thái cũ khi lỗi.
6. **Lập nhịp trước authoring chi tiết:** task thiết kế phải giao đủ chuỗi 4–5 nhịp có ý nghĩa trước khi task chi tiết hóa cảnh bắt đầu. Review không phải nơi mặc định phải nghĩ lại toàn bộ nhịp còn thiếu.

Mô hình hiện tại nên hướng tới: ChatGPT nhận và xử lý task sáng tạo; coordinator chọn task/kiểm quyền; compiler/validator xử lý hợp đồng kỹ thuật; state/evidence quyết định tiến bước. Có thể expose các thao tác hẹp qua MCP, nhưng MCP là giao diện gọi công cụ, không tự tạo scheduler hay context isolation.

Nếu chuyển sang LangGraphJS: phải có runtime và đường gọi model ngoài hội thoại host. Checkpointer/thread ID hỗ trợ interrupt/resume; node có thể chạy lại từ đầu sau resume, nên xử lý side effects idempotent. Xem [interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts). Không coi checkpoint hoặc model result là genuine user approval.

Thứ tự thử nhỏ: hợp nhất next-task/transition contract hiện có → context compiler + task contracts → repair/dependency routing → retry/resume; sau đó mới quyết định XState có giúp giảm mã hơn không. Chỉ mở nhánh LangGraphJS khi thật sự cần backend điều phối LLM. Không thêm framework để che các hợp đồng chưa rõ.

## Bản thử đã có trong plugin

- `core/workflow/task-coordinator.mjs`: XState chọn một next task từ persisted state và manifest; scope tác vụ khai báo ngay trong manifest. ID task bind state, nguồn tập, contract và reference hashes. Scene context giữ nguyên scene/beat/entity/event, cast/asset liên quan, chỉ đạo sáng tạo và liên kết cảnh.
- `orchestration/resume-brief.mjs`: dùng coordinator, kiểm tra state bằng validator thật, trả `next_task`; thêm `--query` để tra quan hệ phase/step/capability/source mà không đọc toàn bộ code.
- `write-phase02-authoring.mjs --task-id`: kiểm tra task còn hiện hành và giới hạn sửa cảnh. API cũ không truyền task ID vẫn tương thích; đây chưa phải sandbox filesystem cho mọi đường ghi.
- Entry gate có `--entry-only`; activation không còn yêu cầu projection tương lai. Full authoring gate và native checks vẫn bắt buộc sau khi phase đã mở.
- `core/workflow/runtime-codegraph.mjs`: adapter gọi SDK CodeGraph cài bên trong plugin, xác minh cả package/platform bundle đúng version và ở local node_modules. Không dùng global/session MCP để thay thế. Index chỉ mirror current executable source vào cache `.runtime`; không index nguồn tập hoặc creative examples.
- `core/audit/benchmark-plugin-orchestration.mjs`: benchmark thật cho SDK/source, cộng fixture 12 cảnh được ghi nhãn synthetic. Báo cáo tại plugin `.runtime/orchestration-benchmark.json`; không có LLM/API/render calls.
- Builder policy đã bao gồm package manifest/lockfile và loại installed binaries/cache. Chưa build, release hoặc cập nhật plugin ChatGPT đang cài; cần provisioning đúng OS/Node theo `references/chatgpt-runtime.md`.

Các phần chưa hoàn tất: giao dịch task cho mọi compiler/committer, điều phối retry tự động xuyên toàn pipeline, thu gọn toàn bộ reference context Phase 2, và xác minh host ChatGPT. Không dùng kết quả thử này để tuyên bố các phần đó đã hoàn thành.

Kết quả kiểm tra local ngày 2026-11-07, Windows x64 / Node 26.5.1:

- Node: 836/836 pass; Python kiểm tra builder/source delivery: 14/14 pass.
- XState guard dispatch median 0.0895 ms; toàn bộ resolve task 0.0908 ms. Resume có I/O, kiểm tra state và hash nguồn: median 30.2129 ms trong 10 lần chạy warm API.
- Fixture synthetic 12 cảnh: payload scene từ 12.212 xuống 2.859 bytes (giảm 76,59%), giữ toàn bộ trường của cảnh được chọn. Đây không phải mức giảm toàn bộ context Phase 2 hoặc lịch sử ChatGPT.
- CodeGraph index 143 module: 1.991 nodes, 5.255 edges, tạo index khoảng 3,90 giây. Median query 87,63–93,49 ms; quét file đối chứng 71,84–76,42 ms, không phải truy vấn tương đương về ngữ nghĩa/quan hệ.
- Dependency cài thực tế khoảng 256,18 MiB; giữ CodeGraph on-demand. Chưa đo tốc độ LLM hoặc chạy thực tế trong host ChatGPT.

## Khảo sát nén context và tăng tốc ba phase — 2026-11-07

Đo `loadStepContext` với state template, fresh/draft/canvas: reference Phase 1 evidence/concept/narration lần lượt 12.144 / 23.286 / 7.345 bytes; Phase 2 visual_compile/assets/publish_prep 68.554 / 69.186 / 21.086 bytes; Phase 3 assemble/validate/export 15.281 / 3.140 / 1.491 bytes. Đây là tổng byte reference được chọn, chưa gồm phase guide, task payload, tool output và lịch sử hội thoại; không phải token hoặc thời gian hoàn thành.

Khoảng trống hiện tại: capsule chỉ cho explicit delta cùng phase/step/policy/selection; Phase 2 handoff đã có source hashes và quyết định sáng tạo nhưng chưa phải cơ chế context tối thiểu xuyên ba phase. Executor có cache input/output chính xác, song nhiều bước vẫn dùng core input rộng và vòng chạy tuần tự. Semantic dirty graph hiện có nên được nối vào phạm vi chạy thật trước khi thêm framework build/cache khác.

Thiết kế ưu tiên: mở rộng capsule/handoff hiện có thành input riêng cho phase/task. Giữ nguyên quyết định user, narration của cảnh, story spine, cast liên quan, toàn bộ 4–5 nhịp của cảnh, source hashes và refs tới receipts thật. Research thô, history và log cũ ở ngoài payload mặc định; có locator để lấy lại khi cần. Summary chỉ là dữ liệu dẫn đường, không cấp approval/PASS. Bắt buộc có nguồn khi thiếu dữ kiện. Không cắt ngang text/JSON để đạt budget. Cache dùng content hash; chỉ delta khi bên nhận xác nhận đã giữ đúng block; phiên mới nhận full capsule đã chọn lọc. Ưu tiên trả payload trực tiếp hoặc dùng cache hiện có để tránh thêm artifact mỗi bước. Không tuyên bố xóa history trong host ChatGPT.

| Repo | Tích hợp đề xuất | Giới hạn / thứ tự |
| --- | --- | --- |
| [niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) | Đo token theo encoding được khai báo; budget riêng task, reference và lỗi sửa | Ưu tiên thử trước; nếu host không lộ tokenizer thì đây là proxy được ghi nhãn, không phải toàn bộ token của host |
| [toon-format/toon](https://github.com/toon-format/toon) | Thử lossless encode bảng scene/asset/task, so với compact JSON; giữ JSON làm nguồn và hash | Chỉ chọn khi token thấp hơn và decode round-trip bằng nhau; dữ liệu lồng sâu/không đồng dạng có thể lớn hơn; chưa chứng minh model hiểu tốt hơn trên tập tiếng Việt của plugin |
| [sindresorhus/p-queue](https://github.com/sindresorhus/p-queue) | Giới hạn concurrency/rate/timeout cho fetch độc lập và validator chỉ đọc | Chỉ thêm khi Promise.all hiện có thiếu khả năng này; queue không tự tạo DAG, khóa ghi, persistence hoặc song song LLM trong host |
| [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) | Thử riêng phần research/log dài nếu lọc theo task vẫn chưa đủ | Python + model weights + inference; có compression theo section và model multilingual nhưng chưa test tiếng Việt/task này. Không đưa narration, beats, user direction, contracts hoặc receipts qua nén mất mát |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | Checkpoint/resume cho runner tự gọi model, khi thật sự cần context riêng từng node | Hoãn ở plugin host hiện tại; cần persistence, model runtime và adapter giữ một authority với XState/pipeline state |

Thứ tự thử: (1) capsule xuyên phase + token accounting; (2) compact JSON/TOON A/B; (3) dùng semantic dirty closure để chỉ chạy lại phần ảnh hưởng; (4) bounded concurrency sau khi kiểm tra đọc/ghi và dependency; (5) LLMLingua hoặc runner LangGraph chỉ khi số đo chứng minh cần. Phase 1 ưu tiên lọc evidence và fetch độc lập; Phase 2 ưu tiên scene payload, giữ nhịp và incremental execution; Phase 3 ưu tiên bàn giao manifest/hash/receipts và compiler deterministic, không đọc lại research/design prose không liên quan.

Tiêu chí đo: input tokens theo encoding, số tool calls, số lần đọc lại, số bước thực thi/reuse, số vòng sửa và tổng thời gian cold/warm cho cùng tập ba phase; kiểm tra invariant nguồn/approval/nhịp không bị mất. Chưa cài các repo khảo sát này và chưa có benchmark end-to-end để hứa phần trăm tăng tốc.

### Đã triển khai sau khảo sát

- Pin/cài gpt-tokenizer 4.1.0 và TOON 4.4.0 trong plugin. Mở rộng capsule hiện có qua `resume-brief.mjs <workspace> --context`, cập nhật SKILL/router/bootstrap/runtime guide; không tạo runtime LLM mới hoặc thêm artifact bắt buộc mỗi bước.
- Payload có task revision, policy, quyết định/nguồn đã chốt, review refs và reference nguyên văn. Initial visual design giữ nguyên approved narration/Narrative Plan; scene task giữ nguyên mọi beat/entity/event; Phase 3 chỉ lấy identity/receipt refs. Budget có pending references và fetch theo path; block được yêu cầu, task và policy không bị cắt. Chỉ reuse block thực sự đã giao khi caller xác nhận cùng workspace/policy/hash. Context host không được xóa bởi plugin.
- TOON chỉ thắng khi token thấp hơn compact JSON và decode round-trip đúng; không nén mất mát research/narration bằng model. Encoding đo là o200k_base được ghi nhãn proxy. Token transport trước accounting không phải toàn bộ context ChatGPT.
- Existing Phase 2 receipt thêm canonical/projection hashes; repair context loại lỗi cũ và không đưa toàn bộ stdout/stderr vào task. Native hash chuyển sang bounded parallel I/O, giữ exact digest/revalidation. Sửa nhận diện dependency SVG trên Windows. Giữ cache input/compiler/output chính xác và concurrency preflight hiện có; chưa cho semantic dirty metadata tự bỏ qua validator hoặc commit. Không thêm p-queue khi standard library đã xử lý nhu cầu hiện tại.
- Benchmark local mới: reference của 9 bước trong manifest order từ 78.699 xuống 57.777 proxy tokens (26,58%) với explicit immediate-prior acknowledgement và diagnostic budget đủ toàn bộ reference. Fixture scene lossless 713 → 601 tokens. Warm context API median 115,58 ms. Hash 64 source files median sequential 71,98 ms → bounded parallel 19,63 ms, digest giống nhau. Đây là microbenchmark, chưa phải thời gian hoàn tất ba phase bằng LLM.
- Chưa build/release/cập nhật plugin host; không thêm LangGraph hoặc LLMLingua. Bootstrap/native runtime đã có, phục vụ verified source, orchestration, compilers, validators và cache; chưa có model runner tự quản lý context/session trên host ChatGPT.
