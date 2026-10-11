# Zodiac Asset và Phase 2 Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Native, tuần tự, không subagent; không coi tài liệu này là implementation PASS.

**Goal:** Thu nhỏ đường lựa chọn asset và dữ kiện agent phải author, giữ phong cách và sửa backlog điều phối A01–A33.

**Architecture:** Index core/extension/compatibility trỏ assets hiện có. Một authored visual-intent sinh native projections qua compilers deterministic; legacy giữ nhánh hiện hành. State/review/ZIP được bind bằng hash; native gates và Python runner dùng contract đồng bộ.

**Tech Stack:** JavaScript ESM/Node native compilers, SVG V4/Human Stroke v2, Python control_plane, pytest, node:test, runner Remotion hiện hành.

**Spec:** ../specs/2026-10-11-zodiac-simplification-design.md; backlog lịch sử: zodiac-ke-hoach-cai-tien.md.

## Global Constraints

- Giữ `zodiac-job@5`, `zodiac-renderer@2.0.1`, ba phase hiện tại.
- Style `zodiac-paper-doodle-meme-v4`, `human-stroke-v2`, canvas 1080×1920.
- Khung từ ZIP giữ nguyên source SVG, transform và clipping đã chọn; không bóng/gradient/stroke mới mặc định.
- Narration Kim Ngưu SHA256 `a596290328980cab88801ccf612cdcd87b75c7c4ebf7d869a00e20f21310ea6f` bất biến.
- Không quota scene/frame/pose/effect/SVG; không xóa assets legacy hoặc migrate approval tự động.
- Native/library/static/creative/audio QA phải báo riêng; không fake receipt hoặc approval.
- Rerun theo dependency có thay đổi; không gọi lại research khi evidence không đổi.
- Một producer entrypoint, một ZIP mỗi revision; không overwrite ZIP đã phát hành.

## Review Focus

1. Job legacy tham chiếu extension: vẫn resolve đúng asset, không bị policy core làm mất bytes — T1/T2/T11.
2. Callback và simultaneous voice anchors: state trace đúng author order, sai state_before bị chặn — T4.
3. Đổi projection sau approval: drift bị chặn; không giữ review cũ cho revision mới — T3/T8.
4. Khung dưới mép viewBox và sticker halo/contact: không demo crop khác runtime, không đè mặt/caption — T2/T6/T11.
5. Crash sau publish ZIP nhưng trước ghi state, hoặc app chạy schema cũ: recovery không xuất ZIP thứ hai, diagnostic rõ — T8/T11.

## File map và quy ước

P = `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline` trong checkout repo; O = P/orchestration; V = P/references/asset-library-v4. Runtime ở `tools/control_plane`, schema ở `contracts`. Đây là paths tương đối từ root repository, không chỉnh plugin cache cài sẵn. Trước execution đọc AGENTS.md nếu có, xác minh revision hiện tại so baseline 2.4.50; nếu lỗi đã sửa upstream thì chứng minh bằng regression test, không sửa lại.

Ba nhóm: asset/authoring T1–T7; orchestration T8; content/context T9–T10. T11 nối các nhóm thành release. Có thể commit từng task nhưng chỉ sync plugin một đợt khi final acceptance đủ.

---

### T1 — Fixtures, ownership và số đo baseline

**Files:** Create `O/tests/fixtures/simplification/reference-index.json`, `O/tests/simplification-baseline.test.mjs`, `O/benchmark-phase02-simplification.mjs`.

**Interfaces:** `measurePhase02(workspace, contextReceipts) -> {guidance_bytes, authored_bytes, manual_source_files, unique_svg_count, duplicate_state_count, frame_count}`. Fixture manifest giữ ZIP SHA, asset SHA, transform, narration SHA; fixture body lấy có chọn lọc từ nguồn thật, không chứa toàn narration nghiên cứu trong context mặc định.

- [x] Viết test reference tamper: đổi path stroke hoặc transform phải fail reference equality; đổi only metadata source hash cũng bị ghi drift. Thêm legacy asset ngoài core vẫn resolvable.
- [x] Chạy `node --test $O/tests/simplification-baseline.test.mjs`; ghi failure đúng invariant chưa có implementation.
- [x] Implement measurePhase02 và fixture provenance; đo Kim Ngưu hiện tại, ca cafe/học không meme, ca meme và legacy; không tự chấm pixel hoặc creative PASS.
- [x] Chạy lại test; lưu benchmark JSON trước thay đổi, với source/compiler commit hashes.
- [x] Commit `test: capture zodiac simplification baseline`.

### T2 — Bộ mặc định nhỏ và khung archive nguyên bản

**Files:** Create `V/selection-policy.json`, `O/select-asset-guidance.mjs`, `O/tests/asset-selection-policy.test.mjs`; Modify `V/selection-guide.md`, `V/manifest.json`, `V/environments/compile-environment.mjs`, `O/validate-scene-set.mjs`, `O/validate-scene-set-identity.mjs`.

**Interfaces:** `selectAssetGuidance({selected_asset_ids, meme_selected, environment_mode}, policy) -> {core_refs, extension_refs, unresolved_ids}`; environment_mode = `archive_frame | selected_cues | legacy`. Frame reference = `{asset_id, asset_sha256, transform, source_zip_sha256}`; giữ trường authored scene_set.asset hiện hành, reader legacy .asset_id được normalize trong authoring adapter, không đổi IR.

- [x] Test không meme không nạp full meme registry; selected meme có đủ guidance. archive_frame không tự thêm window/board/lamp; asset legacy ngoài core vẫn resolve. Scene-set 8 scene hợp lệ không bị ép 9, selected frame thiếu asset bị chặn.
- [x] Chạy `node --test $O/tests/asset-selection-policy.test.mjs`, xác nhận fail từ những nhánh cũ.
- [x] Implement index policy trỏ assets existing, không move/copy toàn kho. Exact frame giữ asset bytes/transform; nếu muốn bỏ detail trong SVG, tạo derivative riêng và đánh dấu cần visual review. Không silently filter path.
- [ ] Chạy test; so reference fixture và render clip/aspect tại 1080×1920; giữ chiều sâu 2D và semantic furniture riêng.
- [x] Commit `feat: narrow default zodiac asset selection`.

### T3 — Một source ý hình, projections native deterministic

**Files:** Create `P/references/contracts/visual-intent-v1.schema.json`, `O/compile-visual-intent.mjs`, `O/tests/visual-intent-projection.test.mjs`; Modify `O/write-phase02-authoring.mjs`, `O/derive-scene-context.mjs`, `O/phase02-execute.mjs`, `V/compile-visual-grammar.mjs`, `O/phase02-composition.mjs`.

**Interfaces:** `compileVisualIntent(intent, {narration, token, catalog}) -> {production, character_assembly, visual_grammar_plan, asset_plan, director_plan, art_direction, episode_cast_plan, story_object_plan, receipt}`. intent format `zodiac-visual-intent@1`: `narration_sha256`, `cast`, `frames`, `scenes[{id,frame_ref,semantic_goal,entities,events}]`, `story_object_decision`. Entities reference selected native assets/states; events contain exact voice_anchor and before/after. Metaphor meaning/removal test/added meaning are authored, never invented by compiler.

- [x] Test một entity rename cập nhật mọi projection; compile hai lần byte-equivalent canonical outputs. Frame/contacts/spatial bindings không bị grammar overwrite. Stale narration hash và edit projection bị chặn. Legacy inputs không auto migrate.
- [x] Chạy `node --test $O/tests/visual-intent-projection.test.mjs`, xác nhận fail trước code.
- [x] Implement opt-in authoring mode trong writer hiện hành; input mới `.authoring/visual-intent.json`, outputs tương thích native @2.0/@2/@1. Projections readonly có owner/source hash; không thay approved source trực tiếp.
- [ ] Chạy test và native preflight trên fixture; agent chỉ cần sửa một quyết định intent, không sửa director/frame/art-direction bằng tay.
- [x] Commit `refactor: derive native phase2 plans from visual intent`.

### T4 — Preview cumulative và progression thật

**Files:** Create `O/scene-state-trace.mjs`, `O/tests/cumulative-preview.test.mjs`; Modify `O/build-native-preview-pairs.mjs`, `O/validate-native-preview-pairs.mjs`, `O/validate-story-object.mjs`.

**Interfaces:** `traceSceneStates(scene) -> [{event_id,before:{entity_id:state_id},after:{entity_id:state_id}}]`; `classifyEventChange(event, beforeState, afterState) -> 'visual_change' | 'motion_only' | 'no_op'`. before/after là asset/visibility/layer/geometry resolved; motion_only có motion preset hợp lệ và không được counted as metaphor progression tự động.

- [x] Test A reveal → B đổi màu → A callback giữ màu mới của B; event simultaneous anchor vẫn theo author order; state_before sai báo lỗi. State rename cùng hình trả no_op; legitimate motion-only giữ event nhưng chưa temporal PASS.
- [x] Chạy `node --test $O/tests/cumulative-preview.test.mjs`, xác nhận native builder hiện hành fail cumulative case.
- [x] Implement trace dùng chung builder/validators; hash report từ source thực; không sửa semantics bằng bảng HTML bổ sung.
- [ ] Chạy test, build/validate pairs; review callback thật; static endpoint không được mang measured timing.
- [x] Commit `fix: preserve cumulative states in native previews`.

### T5 — Story Object theo hành động và nghĩa, có nhánh omit rõ

**Files:** Modify `P/references/story-object-effects.md`, `P/references/story-object-composition-v2.md`, `O/phase02-precompile-seam.md`, `O/validate-story-object.mjs`, `O/validate-story-object-composition.mjs`, `O/phases/01-content.json`, `O/phases/02-visual-production.json`; Create `O/tests/story-object-policy.test.mjs`.

**Interfaces:** decision = `{mode:'required'|'optional'|'omitted',reason,review_ref}` trong intent; generated flags phải khớp decision. `evaluateObjectProgression(plan, trace) -> {structural_status, review_required, issues}` sử dụng T4, không tự đánh giá thẩm mỹ hay approve.

- [x] Test required thiếu plan bị chặn; optional/omitted có lý do được kết quả OMITTED_EXPLICIT, không PASS giả; legacy required không bị tắt. Repeated off→shown cùng asset/quan hệ không đủ ba semantic deltas. Prop tình huống kiêm object được chấp nhận khi có action/change thật.
- [x] Chạy `node --test $O/tests/story-object-policy.test.mjs`; failure phải cho thấy required/optional docs/gates chưa đồng bộ.
- [x] Implement policy xuyên Phase1→Phase2; compile chỉ decisions đã authored. Update gate để yếu ở structure trả NEEDS_REVISION; human mute-review vẫn bắt meaning yếu dù structural hợp lệ.
- [x] Chạy tests; review memory_menu negative fixture và một object action/callback positive fixture. Không thay narration hoặc tự chốt metaphor Kim Ngưu mới.
- [x] Commit `fix: align story object policy with visible meaning`.

### T6 — Pose thiếu và contact, không mở rộng kho đại trà

**Files:** Modify `V/characters/components/catalog.json`, `V/characters/compile-character-assembly.mjs`; Modify `V/contracts/pose-readability-contract.json`, `V/characters/assembly-contract.md`; Create `O/tests/rest-pose-contact.test.mjs`; rest pose geometry đặt trong compiler hiện hành, không tạo thêm một component format.

**Interfaces:** assembly lựa chọn `rest_sitting`/`rest_lying` chỉ khi beat cần, cùng identity/face/hair/outfit hiện hành; attachment sockets từ body geometry, không giả rotate toàn thân. Receipt tách catalog_integrity và episode_contact_review.

- [ ] Test lean_tall face/hair/outfit không đổi khi nghỉ; sofa đúng intrinsic ratio, sau actor; grip/contact dùng socket có thật; asset vẫn native V4 và caption-safe.
- [x] Chạy `node --test $O/tests/rest-pose-contact.test.mjs`; phải fail missing native rest pose chứ không dùng fallback expression để PASS.
- [x] Author tối thiểu components nghỉ/ngồi và contact tay–bút đủ ca s05/s04; chọn state count trước SVG. Không sinh hàng loạt variant hoặc các SVG tween.
- [ ] Chạy identity/style/budget/contact checks; review pixels tư thế nghỉ đọc được và tay–bút. Runner kiểm motion/contact actual; nếu chưa render, giữ pending.
- [x] Commit `feat: add minimal native rest and writing contacts`.

### T7 — Layout/density parity trước review, voice ranges bảo toàn byte

**Files:** Create `O/handoff-preflight.mjs`, `O/voice-source-ranges.mjs`, `O/tests/handoff-preflight.test.mjs`; Modify `O/compile-job-v5.mjs`, `O/validate-handoff-workspace-v2.mjs`, `O/run-director-v2-review.mjs`, `O/compile-narration-performance.mjs`.

**Interfaces:** `preflightHandoff(source, token) -> {status, issues:[{scene_id,code,path}]}` chạy compile/schema/density tương đương export, gom lỗi trước approval. `partitionNarration(bytes, ranges) -> Buffer[]` và reassemble phải byte-identical; ranges là UTF8 byte offsets liên tục, không cắt giữa codepoint.

- [x] Test partial layout merge defaults nhưng không sửa authored zones; caption overlap và ba actor/hai prop bị bắt ở Phase2. Repartition không thêm newline/normalize NFC; invalid range/codepoint gap bị chặn.
- [x] Chạy `node --test $O/tests/handoff-preflight.test.mjs`, ghi fail cho late export issue.
- [x] Share density/layout rules giữa review và export, giữ schema caps hiện tại. Range metadata chỉ authoring adapter, không thêm runtime-derived fields vào Job5. Không auto gộp prop khác nghĩa để vượt budget; giảm clutter bằng intent.
- [x] Chạy tests + native compile/exact narration hash. Failed preflight không tạo review lock.
- [x] Commit `fix: catch handoff contract issues before visual approval`.

### T8 — Source, approval, lease, resume và Phase3 state

**Files:** Modify `O/execution-bootstrap.md`, `O/router.md`, `O/phase02-execute.mjs`, `O/phase02-transition-gate.mjs`, `O/assess-revision-impact.mjs`, `O/context-capsule.mjs`, `O/run-phase03-production.mjs`, `O/phase03-production-release.mjs`; Create `O/approval-source-hashes.mjs`, `O/authoring-lease.mjs`, `O/commit-phase03-release.mjs`, `O/tests/orchestration-recovery.test.mjs`.

**Interfaces:** `approvalSourceHashes(workspace) -> {narration,plan,scope,brief,visual_intent,production}` hashes exact bytes; `acquireAuthoringLease(path,{run_id,owner_pid,host_id,now}) -> lease` chỉ recovery với stale evidence; `reconcilePhase03Release(workspace, receipt, zipPath) -> {state_status,recovery_action}` kiểm ZIP SHA/bytes và native substages evidence.

- [x] Test local/restored source root; stale source block; narration/scope một byte drift invalid approval; performance-only/evidence/scope invalidation khác nhau; không research lại khi inputs không đổi.
- [ ] Thêm test live lease không bị xóa; expired lease với owner unavailable cần diagnostic; snapshot không lock/tmp; exact restore và capsule phản ánh revision hiện tại. Crash sau ZIP publish reconcile state, không export ZIP thứ hai.
- [x] Chạy `node --test $O/tests/orchestration-recovery.test.mjs` trước sửa, ghi fail cụ thể.
- [x] Implement một source policy; resolve root bằng manifest; source ownership graph; native operations/substage receipts và commit Phase3 có expected-state hash. Review lock hoặc source bytes đổi phải invalid, không carry approval im lặng.
- [x] Chạy tests và strict state validator. Đảm bảo ZIP-ready receipt không tự set runner_media_verified.
- [x] Commit `fix: bind pipeline state and recovery to real evidence`.

### T9 — Duration, TTS readiness và content review

**Files:** Create `P/references/short-form-duration.mjs`, `O/tests/tts-content-readiness.test.mjs`; Modify `P/references/narration-rhythm.md`, `P/references/character-viral-performance.md`, `O/review-creative-and-publish.md`, `O/phases/01-content.json`.

**Interfaces:** `estimateDuration(text,{tokens_per_minute,pause_seconds,tail_seconds}) -> {token_count,rate,estimated_seconds,measurement:'estimated'}`; `ttsTextIssues(text) -> [{span,kind,suggestion}]` là diagnostic, không tự normalize narration sau approval.

- [x] Test fixed input/rate/pause/tail deterministic; estimate không thành measured; acronym/số/ellipsis/từ ngoại ngữ được nêu vấn đề có vị trí; clean text không có performance tags. Fresh scoped 2.1, legacy2.0 reader vẫn hợp lệ.
- [x] Chạy `node --test $O/tests/tts-content-readiness.test.mjs`; bắt missing duration helper và docs-version conflict.
- [x] Implement helper và nối manifest trước Content Review; review phản biện evidence/identity/motif toàn bài. >120s chỉ warning/review hoặc exception rõ, không sửa theo quota số câu.
- [x] Chạy tests và ca editorial lỗi thật: trả NEEDS_REVISION, không có user approval giả; audio prosody vẫn runner-owned pending.
- [x] Commit `fix: prepare spoken content before approval`.

### T10 — Context theo lựa chọn và interface Phase2 ba phần

**Files:** Modify `O/plan-step-context.mjs`, `O/context-budget-policy.md`, `O/phases/02-visual-production.json`, `P/SKILL.md`, `P/references/asset-use-playbook.md`, `O/scene-art-direction.md`; Create `O/tests/conditional-context.test.mjs`.

**Interfaces:** context selection consumes T2 selection policy và active flags. Output `context_manifest` trỏ exact loaded guidance/hash; integrity validators không bị condition hóa khỏi required gates. Skill trình bày ba thao tác người dùng, native manifest vẫn giữ step ownership.

- [x] Test cafe/no-meme không nạp full meme/bedroom guidance; selected meme/bedroom có đủ reference; thiếu required guidance block. Context nhỏ không miễn style/contact/lifecycle/approval checks.
- [x] Chạy `node --test $O/tests/conditional-context.test.mjs` trước sửa.
- [x] Implement bounded indexes và scene refs; remove duplicate instructions/contradictions, không tạo thêm framework/router. Depth optional route chỉ dùng khi authored selected, không auto thêm geometry lên khung archive.
- [ ] Chạy test và T1 benchmark cùng fixtures: guidance bytes và manual source files giảm cho no-extension; selected-extension vẫn đủ receipts. Báo số thực, không cam kết % trước đo.
- [x] Commit `refactor: bound zodiac phase2 context by selection`.

### T11 — Producer/runner parity và một release đã kiểm

**Files:** Modify `tools/control_plane/package_validation.py`, `tools/control_plane/contracts.py`, `tools/control_plane/errors.py`, `tests/test_spatial_contract_hash.py`, `.github/workflows/tests.yml`; Create `tests/test_simplification_package_import.py`, `O/tests/simplification-release.test.mjs`, `docs/zodiac-simplification-acceptance.md`.

**Interfaces:** error detail giữ `{expected,actual,accepted_legacy,contract_path}`; message ngắn chỉ rõ update runner khi hash không supported. Release record `{plugin_commit,runner_commit,contract_sha256,zip_sha256,producer_static,runner_import,creative_review,runner_media}`; unknown hash không được allowlist đại trà.

- [x] Test real ZIP import không mock; current canonical và audited legacy accept; unknown reject. Diagnostic có actual/expected/path. Cùng source/contracts canonical hashes khớp giữa JS và Python.
- [x] Chạy `python -m pytest tests/test_simplification_package_import.py tests/test_spatial_contract_hash.py -q` và `node --test $O/tests/simplification-release.test.mjs`; xác nhận missing parity evidence chưa thành PASS.
- [x] Implement regression matrix: fresh single_sign/element_group/ranked/comparison và approved legacy2.0; positive + stale approval/source/projection/contract/frame/lease negatives. Chỉ parity-required edits, không đổi Job/renderer version.
- [ ] Replay Kim Ngưu revised workspace riêng: giữ narration, giảm phụ nền theo intent, Story Object review thật, pose/contact pixels, native state/compilers/pairs. Sau Visual Review thật mới seal/export một ZIP; không overwrite release hiện tại.
- [ ] Runner import + actual TTS/word timing + ba frame quanh transition/contact/reveal, cover/caption/watermark, SFX/end-tail và MP4 khi môi trường runner có. Thiếu runner thì đánh PENDING, release chỉ PRODUCTION_READY_ZIP; không bịa video-ready.
- [ ] Self-review diff/spec/backlog; chạy relevant test suites một lần sau các fixes; commit `test: verify simplified zodiac producer runner parity`. Sync plugin theo plugin update workflow và ghi installed version/source identity thật; GitHub commit không tự coi đã cập nhật ChatGPT plugin.

## Thứ tự và điều kiện dừng

T1 → T2 → T3 → T4 → T5 → T7 → T8 → T10 → T6 → T9 → T11. T6/T9 độc lập một phần nhưng vẫn thực thi native tuần tự. Sửa projection/preview/gate trước pose để review mới không dựa vào hình sai. Contract/approval blockers phải xử lý trước release, dù không làm hình đẹp hơn.

Nếu một nhiệm vụ đã PASS regression trên upstream mới, giữ chứng cứ và skip implementation tương ứng. Nếu visual-intent đang làm thêm source cạnh tranh thay vì bớt authoring, dừng ở T3 và sửa interface, không nạp thêm plan để bù. Nếu Story Object vẫn cần prose dài để giải nghĩa hình, trả NEEDS_REVISION, không tăng effect count.

## Ánh xạ toàn backlog

| ID | Task / quyết định |
|---|---|
| A01 | T8 source policy |
| A02 | T9 duration helper |
| A03 | T8 approval hashes |
| A04 | T8 dependency invalidation |
| A05 | T9 Narrative version policy |
| A06 | T2/T10 conditional guidance |
| A07 | T9 TTS text readiness |
| A08 | T9 editorial review; T11 positive/negative matrix |
| A09 | T5 Story Object policy |
| A10 | T8 lease/checkpoint recovery |
| A11 | T8 capsule from current state |
| A12 | T8 verified source root |
| A13 | T3 preserve authored environment frame |
| A14 | T4 cumulative endpoint |
| A15 | T4 no-op versus motion-only |
| A16 | T6 rest pose/grip |
| A17 | T2/T6 actual ratios, layers, lean_tall; bỏ mở thêm architecture palette |
| A18 | T2 scene-set contracts; không bắt mọi shot có depth preset |
| A19 | T2 flat 2D, không perspective |
| A20 | T1/T2 reference archive provenance |
| A21 | T10 native manifest; T11 real parity evidence |
| A22 | T7 early handoff preflight/ranges |
| A23 | T8 Phase3 receipt/state reconciliation |
| A24 | T11 runner contract diagnostics/parity |
| A25 | SUPERSEDED bởi A28/A33; không bỏ tường/sàn |
| A26 | T3/T10 compact authoring và 3 thao tác |
| A27 | T5 meaning through object action |
| A28 | T2 giữ tường/sàn; không lọc SVG rồi gọi original |
| A29 | CANCELLED shadow experiment |
| A30 | CANCELLED pen-pressure experiment |
| A31 | CANCELLED gradient/fade experiment |
| A32 | SUPERSEDED bởi A33: không coi two-path filter là nguyên ZIP |
| A33 | T1/T2/T11 exact asset/viewport fidelity |

## Tự review kế hoạch

Phủ đủ A01–A33; không bỏ nguyên nhân hoặc thực hiện lại hướng đã hủy. Interfaces T3→T4→T5 và T2→T10 nhất quán. Ownership rõ giữa intent/projections/receipts. Tests nhằm regression và contract, không chỉ mirror body implementation. Giữ asset/authoring, orchestration, content là ba nhóm có thể nghiệm thu riêng nhưng một release cuối. Trạng thái thực thi 2026-10-11 xem docs/zodiac-simplification-acceptance.md. Checklist giữ mở các dòng có phần nghiệm thu chưa hoàn tất; không lấy producer/static PASS thay creative/audio PASS.
