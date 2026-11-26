# Kế hoạch tối ưu Studio từ nhập gói đến duyệt MP4

> **For agentic workers:** triển khai tuần tự bằng superpowers:executing-plans.
> Đây là kế hoạch theo yêu cầu của người dùng, chưa phải lệnh thực thi toàn bộ.

**Goal:** Danh tính tự đi theo gói; mọi bước có đường tiếp tục, trả sửa và giữ
phiên bản; chỉ hoàn tất khi đúng MP4 đã được người dùng duyệt.

**Architecture:** Tái sử dụng Tauri → RPC Python → Project Core, pipeline registry,
store, VisualWorkspace và các player hiện có. Bổ sung quyết định duyệt bản xuất
trong SQLite, gate cuối và vòng phản hồi. Không dựng thêm app/editor hay scheduler.

**Tech Stack:** React/TypeScript, Tauri/Rust, Python/sqlite3, compiler/renderer hiện có.

**Spec:** `docs/superpowers/specs/2026-11-26-studio-workflow-review-lifecycle-design.md`.

## Ràng buộc chung

- Giữ nguồn Phase 1, IDs catalog, take, tiến độ cũ và dirty worktree của người dùng.
- API ghi có `command_id`/kiểm revision và không nằm trong `retry_safe` của Rust.
- Backend tự xác định concept/cung và kiểm đúng export/hash trước khi nhận duyệt.
- Không đánh đồng tải được media, đạt kỹ thuật, agent nhận xét và người dùng duyệt.
- Bỏ bản xuất có thể khôi phục; không nhận đường dẫn tùy ý từ client để xóa/di chuyển.
- Mỗi phase có test phù hợp, cập nhật evidence, commit/push đúng nhánh hiện tại;
  không cộng dồn tất cả vào một commit hoặc trộn thay đổi đang có.

## Điểm cần kiểm tra xuyên suốt

1. Đổi episode hoặc thay MP4 khi player/RPC đang tải: không áp kết quả cũ sang gói mới.
2. Một concept/cung có nhiều episode/export: không mất lịch sử hoặc duyệt nhầm bản.
3. RPC trả lỗi sau khi đã ghi: gửi lại command không tạo hai quyết định/tác vụ.
4. Đổi voice/source giữa phát và xác nhận: từ chối quyết định cũ, giải thích cách mở lại.
5. Dừng/restart/lỗi filesystem trong render/bỏ bản xuất: không mất file hoặc tiến độ.

## Trạng thái khảo sát

- [x] Đọc nguồn hiện tại, đối chiếu ảnh người dùng và DOM native (chỉ đọc).
- [x] Xác nhận metadata đã có nhưng VideoReview chưa nhận; kiểm đường cập nhật Ideas.
- [x] Kiểm danh sách gate, đường export trực tiếp và các API lifecycle còn thiếu.
- [x] Viết spec và kế hoạch từng bước. Không thay logic hay dữ liệu runtime ở lượt này.
- [ ] Thực thi các phase dưới đây sau khi kế hoạch được chọn để triển khai.

## Trải nghiệm từng bước

| Bước | Máy làm | Người dùng thấy/làm | Khi không đạt | Điều kiện đi tiếp |
|---|---|---|---|---|
| 1. Kế hoạch | Đọc catalog, nối các episode đúng concept/cung | Chọn ý tưởng/cung một lần; mở tập đang làm | Chọn lại trước tạo gói; gói nhập sai được báo rõ | Danh tính đủ và không mâu thuẫn |
| 2. Nhập nguồn | Kiểm ZIP, manifest, hash, receipt; chống nhập trùng | Tóm tắt tên tập/cung/concept + nút Tiếp tục | Hiện đúng thiếu sót và cách sửa nguồn | Nội dung có approval hợp lệ |
| 3. Tạo giọng | Tạo phần thiếu; ghép audio khi đủ; giữ take tốt | Một nút Chuẩn bị giọng; tiến độ theo đoạn | Thử lại đúng đoạn lỗi | Các đoạn/take và bản ghép hợp lệ |
| 4. Nghe giọng | Gom theo cảnh/đoạn, giữ bằng chứng nghe | Phát, nghe lại, đổi take, Duyệt giọng | Ghi đoạn chưa ổn, tạo lại có phạm vi | Người dùng duyệt đúng take/khoảng nghỉ |
| 5. Căn thời gian | Chạy ASR cho audio hiện tại, kiểm ranh giới | Tóm tắt khớp/chỗ cần kiểm; waveform khi cần | Retry align hoặc quay lại đoạn giọng lỗi | Timing khớp hash audio |
| 6. Soạn hình | Agent đề xuất cảnh/diễn xuất theo nguồn và timing | Preview + timeline; danh sách thay đổi trước áp dụng | Góp ý cảnh cụ thể, giữ bản trước, Undo | Nguồn hình hợp lệ; áp dụng được kiểm revision |
| 7. Dựng và kiểm | Resolve tài nguyên, dựng phần đổi, kiểm cấu trúc/ảnh | Kết quả ngắn, cảnh có vấn đề; kỹ thuật thu gọn | Phân lỗi cần sửa và góp ý thẩm mỹ | Hợp lệ kỹ thuật, thông tin kiểm đúng phương pháp |
| 8. Duyệt hình | Phát đúng build, ghi phiên xem | Duyệt hình hoặc Cần sửa ở cảnh/mốc cụ thể | Mở cảnh tương ứng, giữ voice/timing | Người dùng duyệt đúng build |
| 9. Xuất MP4 | Kiểm gate đầu vào, render/mux, probe/hash | Tiến độ render, Dừng; xong thì mở MP4 | Xuất lại nếu lỗi encode; sửa hình/voice nếu nội dung lỗi | File hiện tại hợp lệ, chưa đồng nghĩa hoàn tất |
| 10. Duyệt MP4 | Gắn player với export và project | Danh tính tự nhận; Duyệt video / Chưa đạt / Bỏ bản xuất | Ghi feedback, trả đúng bước; có thể khôi phục bản bỏ | Receipt người dùng khớp MP4 hiện tại |
| 11. Hoàn tất | Chiếu receipt sang Ideas, gom đường dẫn/sidecar | Hoàn tất, mở file, copy nội dung đăng | Bỏ duyệt hoặc mở vòng sửa có lịch sử | Không tự đăng, không giả định đã phát hành |

Các bước 3–5 và 6–8 vẫn nằm trong nhóm Giọng/Hình, không thêm hàng loạt tab mới.

## Phase 1 — Sửa trọn bước cuối và định nghĩa đúng “hoàn tất” (ưu tiên cao nhất)

### Task 1.1: Mang danh tính gói vào màn cuối

**Modify:** `EpisodeExport.tsx`, `VideoReview.tsx`, `backend.ts` trong
`apps/zodiac-studio/src/`; `tools/studio_project/service.py` nếu cần chuẩn hóa projection.
**Tests:** cập nhật `tests/studio_ideas_browser.mjs`,
`tests/studio_hyperframes_export_browser.mjs`; thêm `tests/studio_final_review_browser.mjs`.

- [ ] Viết test đỏ: từ episode Nhân Mã/love-sincere mở MP4 có sẵn, không chọn lại;
  chuyển gói bỏ toàn bộ file ngoài/URL/player/assignment cũ.
- [ ] Truyền `project` cho VideoReview; danh tính của output nội bộ chỉ đọc. Không
  dùng `initialConceptId` của điều hướng làm danh tính xuất.
- [ ] Đưa Mở MP4 ngoài thành thao tác phụ, có trạng thái nguồn riêng; không áp
  ngoại file vào gate của episode. Thiếu catalog/metadata thì báo rõ, không tự đoán.
- [ ] Tái dùng bố cục player cạnh quyết định, ưu tiên video, ẩn path/hash/audio
  contract dưới Chi tiết; kiểm đủ năm kích thước trong spec.
- [ ] Kiểm file thường, audio-only MP4, file hỏng, URL lỗi, output stale, đổi gói
  trong khi đang phát và file ngoài đang chọn.

### Task 1.2: Quyết định duyệt gắn với đúng bản xuất

**Create:** `tools/studio_project/video_review.py`,
`tests/test_studio_video_review.py`.
**Modify:** `registry.py`, `status.py`, `rpc_stdio.py`, `service.py`,
`apps/zodiac-studio/src-tauri/src/lib.rs`, `backend.ts`, `VideoReview.tsx`,
`ideas.py`, `Ideas.tsx`, `idea-board.ts`.

**Proposed interfaces:**

- `video.review.get(project_id, export_id)` trả quyết định, fingerprint, feedback.
- `video.review.playback(project_id, export_id)` cấp phiên cho file hiện tại;
  GUI gọi sau sự kiện phát hợp lệ, không gọi trên loadedmetadata.
- `video.review.decide(project_id, export_id, base_revision, expected_sha256,
  command_id, decision, playback_id, feedback)`;
  decision thuộc `approve | request_changes | revoke`.
- `request_changes` nhận nhóm `visual | voice | export | publish | other`, ghi
  chú, scene_id/time_ms tùy chọn. Revoke/request_changes không cần buộc xem lại.

- [ ] Test đỏ: duyệt A không duyệt B; sai project/hash/revision/stale/file mất
  bị từ chối; agent không thể cấp approval; command lặp không ghi hai lần.
- [ ] Tạo bảng quyết định hiện tại và event history trong SQLite sẵn có; transaction
  chung, không vừa ghi JSON vừa cập nhật Ideas như hai nguồn chân lý độc lập.
- [ ] Tái dùng xác minh export/manifest/voice hiện có trước quyết định; validate
  decision, phạm vi cảnh/mốc, giới hạn độ dài feedback ở backend.
- [ ] Quyết định chỉ đổi trạng thái sau phản hồi thành công. Lỗi ghi giữ nguyên
  nút, nội dung feedback và quyết định trước; stale giải thích mở lại bản hiện tại.
- [ ] Ideas chiếu các approval còn hiệu lực; bỏ duyệt một export không xóa thành
  quả của bản khác. Sửa `byKey` để không làm mất nhiều episode cùng concept/cung.
- [ ] Giữ tiến độ legacy, đánh dấu là checklist cũ nếu không có liên kết export;
  không suy diễn receipt từ dòng `mp4_approved` hay tự xóa tiến độ cũ.

### Task 1.3: Gate cuối và điều kiện export dùng chung

**Modify:** `pipeline/nodes.json`, `derive.py`, `evidence.py`, `autopilot.py`,
`visual_workspace.py`, `status.py`; frontend `pipeline/types.ts`, `status.ts`,
`NextAction.tsx`, `EpisodeShell.tsx`, `inspector-registry.tsx`,
`studio-navigation.tsx`; reuse ExportInspector/EpisodeExport cho gate cuối.
**Tests:** `test_studio_pipeline_derive.py`, `test_studio_pipeline_autopilot.py`,
`test_studio_pipeline_rpc.py`, `test_studio_hyperframes_export.py`,
`studio_pipeline_layout.test.mjs`, `studio_pipeline_browser.mjs`.

- [ ] Test đỏ: export DONE vẫn chờ video_review; không hiện Hoàn tất trước duyệt;
  autopilot dừng trước gate người dùng, resume/restart không tự duyệt.
- [ ] Thêm `video_review` gate inputs `[export]`; evidence đọc receipt đúng bản.
  Giữ nhóm hiển thị Xuất & duyệt, không tạo màn mồ côi.
- [ ] Mọi đường export phải dùng cùng guard: visual approval đúng build và
  upstream còn hợp lệ. Đường `video.export` trực tiếp không vượt gate.
  Guard đặt tại export entrypoint; không chặn `_export_inputs` dùng chung cho
  preview/review_frames, tránh vòng lặp phải duyệt trước khi có hình để duyệt.
- [ ] Sửa banner/Đi tới bước tiếp theo/tiến độ/Ideas thống nhất; gói đã xuất cũ
  vào Chờ duyệt MP4, không mất file hoặc bị buộc render lại không cần thiết.
- [ ] Nghiệm thu native đúng episode đang mở: tự nhận danh tính, phát đúng file,
  xác nhận bằng người dùng thật. Automation chỉ tạo approval ở fixture/temp store.

**Xong Phase 1 khi:** không còn chọn lặp; mọi dấu duyệt truy được tới file;
export 100% chưa làm toàn bộ quy trình báo hoàn tất.

## Phase 2 — Từ chối và quay lại đúng chỗ sửa

**Modify:** `video_review.py`, `pipeline/review.py`, `api.py`, `cards.py`,
`autopilot.py`, `rpc_stdio.py`; frontend `ReviewInspector.tsx`, `VideoReview.tsx`,
`EpisodeShell.tsx`, `workbench-state.ts`, các panel voice/scene liên quan.
**Create tests:** `tests/test_studio_review_feedback.py`,
`tests/studio_review_repair_browser.mjs`.

- [ ] Test đỏ: phản hồi hình tại s03/mốc 25s mở đúng cảnh; feedback voice mở đúng
  đoạn; lỗi encode giữ duyệt hình; publish-copy không kích hoạt TTS/render.
- [ ] Cần sửa ghi vào quyết định backend và hiện bền sau restart. Phản hồi hình
  cũng có ở Duyệt hình, cùng cấu trúc scene/time/reason.
- [ ] Giữ “bản đang xem” để so sánh. Request changes không tự xóa hoặc thay nguồn,
  không chạy model. Người dùng chọn Sửa cảnh/Tạo lại đoạn/Xuất lại.
- [ ] Agent nhận feedback, phạm vi được sửa, revision và voice fingerprint; dùng
  canonical commands hiện có. Xem danh sách thay đổi trước áp dụng.
- [ ] Khi nguồn thực sự đổi, invalidate đúng dependency/gate theo bảng spec;
  lỗi upstream trả về nguồn. Undo không giả tạo một lượt duyệt mới.
- [ ] Phân biệt thẻ gợi ý agent (advisory) và yêu cầu sửa của người dùng (chưa thể
  chốt); bấm trả sửa không được bị autopilot tự “giữ như vậy” rồi hoàn tất.

**Xong khi:** từ MP4 chưa ổn có thể sửa một cảnh/đoạn, dựng lại phần cần thiết,
xuất bản mới, quay lại duyệt mà không phải đi lại toàn bộ quy trình.

## Phase 3 — Bỏ bản xuất, khôi phục và lưu trữ

**Create:** `tools/studio_project/export_lifecycle.py`,
`tests/test_studio_export_lifecycle.py`.
**Modify:** registry/review projection, visual_workspace serving/selection,
Python/Rust RPC whitelist, frontend export menu/project list.

**Proposed interfaces:** `video.discard(project_id, export_id, command_id,
expected_sha256)`, `video.restore(project_id, export_id, command_id)`,
`projects.archive(project_id, command_id)`, `projects.restore(project_id, command_id)`.

- [ ] Test đỏ: chỉ tác động export được chọn; không chạm narration/take/build;
  chống path traversal/symlink, file ngoài, job đang dùng file, lặp command.
- [ ] Dialog Bỏ bản xuất nêu đúng tên/bản và phạm vi; mặc định đưa vào thùng tạm
  nội bộ cùng volume, có Khôi phục. Trước move phải resolve path nằm trong
  workspace/export được backend xác định.
- [ ] Dừng/detach player trước bỏ file; cập nhật URL, current selection, gate và
  Ideas. Không tự đổi sang bản cũ rồi giữ dấu “đã duyệt bản hiện tại”.
- [ ] Dùng journal trạng thái thao tác + rename nguyên thư mục. Test crash giữa
  journal/move/commit; khi mở lại reconcile hoàn tất hoặc phục hồi, không mất media.
- [ ] Khôi phục đưa bản về danh sách; không tự cấp lại approval đã thu hồi.
- [ ] Lưu trữ episode chỉ lọc danh sách đang làm; có danh sách lưu trữ và mở lại.
  Test lưu trữ rồi nhập lại cùng ZIP không tạo project trùng/mất tham chiếu.

**Xong khi:** người dùng bỏ được một video chưa ổn và khôi phục được, không cần
đi xóa thủ công AppData và không mất nguyên liệu làm lại.

## Phase 4 — Rút ngắn giọng đọc và soạn/dựng hình

**Modify:** `pipeline/runner.py`, `autopilot.py`, `agent_runs.py`, `voice_lab.py`,
`voice_worker.py`, `visual_workspace.py`; các panel VoiceLab/VisualEditor hiện có.
**Tests:** tái dùng `test_studio_p2_voice_lab.py`, `test_studio_voice_segments.py`,
`test_studio_voice_worker.py`, `test_studio_pipeline_recovery.py`,
`test_studio_pipeline_autopilot.py`, `studio_workbench_browser.mjs`.

- [ ] Đo baseline số lần bấm, RPC, số TTS/ASR/compile thực tế, thời gian theo bước
  trên cùng gói. Không đặt con số tăng tốc khi chưa có số đo.
- [ ] Một nút Chuẩn bị giọng chạy tiếp từ tạo phần thiếu sang ghép khi đủ;
  không yêu cầu người dùng đoán phải bấm Chạy lần hai. Dừng ở nghe/duyệt thật.
- [ ] Sau đổi take/gap, nói đúng đoạn cần nghe lại; giữ take khác. ASR chỉ chạy
  lại khi fingerprint yêu cầu. Giữ trạng thái nghe theo cảnh/đoạn đang có.
- [ ] Gộp resolve/check/compile thành tiến trình máy dưới nhóm Hình ảnh; không
  tạo thêm bước người dùng phải chạy thủ công khi đầu vào đã đủ.
- [ ] Build lại theo dependency có sẵn, gồm biên chuyển cảnh; so hash/timing
  phần không sửa trước/sau. Chỉ tăng song song khi đo cho thấy an toàn với RAM,
  renderer và provider; không đổi quota/retry vì giả định nhanh hơn.
- [ ] Preview có bản trước để so sánh, thay đổi mới chỉ hiện sau Apply; không
  mất lựa chọn cảnh/playhead khi chuyển tab hoặc có poll chậm.
- [ ] Dừng/restart chỉ retry phần thiếu/lỗi, không gọi lại model/TTS đã thành công
  hoặc replay lệnh ghi không rõ kết quả.

## Phase 5 — Chất lượng, thông tin đăng và nghiệm thu toàn luồng

**Modify:** `pipeline/drafts.py`, `validators.py`, `vision.py`, `cards.py`,
`proposals.py`, `evidence.py`, các inspector và style theo lỗi đo được.
**Tests:** `test_studio_pipeline_validators.py`, `test_studio_pipeline_cards.py`,
`test_studio_pipeline_proposals.py`, `studio_compact_layout.mjs`,
`studio_workflow_native.mjs`/`studio_workflow_native_reopen.mjs` cập nhật selector.

- [ ] Ghi rõ kiểm cấu trúc/kiểm ảnh/model/thẩm mỹ chưa duyệt; không báo “đã nhìn
  ảnh” từ receipt structural hoặc giấu owner card còn mở sau nhãn PASS.
- [ ] Gom phát hiện theo cảnh, có timestamp/ảnh đại diện và Mở cảnh; nội dung kỹ
  thuật ở Chi tiết. Kiểm phone-size lettering/acting/continuity bằng frame thực.
- [ ] Ảnh bìa là opening/frame đầu theo hợp đồng hiện có; không thêm một nguồn
  cover mâu thuẫn. Copy đăng được sửa/duyệt riêng, không gọi là đã xuất bản.
- [ ] Bàn giao đúng MP4, cover, SRT, caption/copy và quyết định duyệt cùng fingerprint.
- [ ] Chạy native từ import → giọng → ASR → hình → sửa một cảnh → duyệt hình →
  export → từ chối → sửa → export mới → người dùng duyệt → restart kiểm phục hồi.
- [ ] Thử thêm hủy render, lỗi media, stale build, disconnect RPC, archive/restore,
  external MP4 và nhiều episode cùng concept/cung; không sửa dữ liệu thật để test.
- [ ] So baseline Phase 4: số thao tác và công việc lặp giảm; file/gate/phản hồi
  còn đúng. Ghi số đo thật, hash, ảnh GUI và các phần chưa nghiệm thu.

## Thứ tự bàn giao và kiểm tra

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5`.
Không tối ưu tốc độ trước khi danh tính/duyệt/trả sửa đúng. Mỗi phase là một mốc
review độc lập; scope task nhỏ hơn có commit riêng và test đỏ/xanh phù hợp.

Kiểm toàn bộ Python/Node/browser khi schema gate/API thay đổi; kiểm tập trung
với sửa layout. Native dùng file thật nhưng chỉ người dùng quyết định approval.
Publication, installer và merge main không nằm trong kế hoạch triển khai này.

## Kết quả cần đạt

Người dùng biết đang làm tập nào, máy đang làm gì và mình cần quyết định gì.
Không gán lại dữ liệu đã biết. Không đồng ý với video thì có thể trả sửa hoặc
bỏ bản xuất mà giữ được nguyên liệu. Dấu Hoàn tất truy được tới đúng MP4 đã xem.
