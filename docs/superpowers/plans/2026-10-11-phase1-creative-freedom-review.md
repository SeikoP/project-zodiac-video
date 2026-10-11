# Phase 1 — rà điểm làm giảm khả năng sáng tạo

Ngày 11/10/2026. Rà tĩnh hướng dẫn, manifest, compiler và validator trong source 2.4.51. Đây là phát hiện về ràng buộc và nguy cơ dẫn hướng; chưa phải thử nghiệm đo chất lượng nhiều kịch bản hoặc bằng chứng mọi ràng buộc đều gây bài kém. Chỉ bổ sung kế hoạch, chưa sửa plugin. Thực hiện native tuần tự, không subagent.

## Kết luận

Nút thắt nằm ở việc biến một số lựa chọn biên tập thành trường bắt buộc/gate máy, cộng với hướng dẫn lịch sử còn xung đột. Giữ mục tiêu deconstruct bản sắc cung, nhưng mở cách thể hiện: không đồng nhất bản sắc với công thức hiểu lầm → phản biện → mặt trái → callback. Không cần thêm Story Shape hoặc framework mới.

## Phát hiện và hướng xử lý

| ID / ưu tiên | Căn cứ thực tế trong source | Nguy cơ sáng tạo | Thay đổi dự kiến |
|---|---|---|---|
| C01 / cao | `validate-content-contract.mjs` bắt exactly 3 candidates, 2 rejected; `validate-episode-concept.mjs` cũng bắt 3 | Concept người dùng đã chốt vẫn phải sinh hai lựa chọn bổ sung; dễ thành phương án cho đủ hồ sơ | Phân biệt khám phá với concept do người dùng chọn. Số ứng viên theo độ bất định, cần khác biệt thật; ghi lý do chọn, không ép đủ ba hoặc bỏ competition hoàn toàn |
| C02 / cao | Episode lens bắt `archetype_facets.length===3`; `compile-writer-brief.mjs` single-sign bắt THREE_FACETS. `zodiac-identity-first.md` yêu cầu ít nhất ba insight trong lời kể, nhưng phần multi-member lại nói facets là options, không spoken quota | Chủ đề hẹp bị kéo dài; nhóm cung dễ quay lại liệt kê từng người ba ý | Facets là dữ kiện lựa chọn. Review sự tiến triển thực tế theo topic, không ép số facet hoặc số insight phải đọc. Đồng bộ single/member và giữ reader legacy |
| C03 / cao | `misread_vs_reframe`, `turn_or_reframe`, spine payoff là context bắt buộc; identity guide yêu cầu kết bài reframe quan sát trước đó | Agent ưu tiên phản biện hiểu lầm và bẻ nghĩa kết bài ở mọi tập; các tập giống nhau dù đổi cung | Giữ một luận điểm/câu hỏi có giá trị; cho nhận diện, đối chiếu, xếp hạng, tích lũy quan sát và punchline trực tiếp. Callback/reframe là lựa chọn theo premise, không bắt mỗi tập phải có cú đảo |
| C04 / cao | `validate-content-contract.mjs`: viral mechanics nonempty, writer brief 1..3; manifest luôn cần viral-analysis.json, dù external Viral skill conditional | Câu chuyện đã tốt vẫn phải bổ sung “viral mechanism”; dễ checklist hóa hook và kết bài | External Viral tiếp tục conditional. Cho quyết định không áp dụng mechanics có lý do khi phù hợp; chất lượng premise/hook vẫn được review. Không tạo metric retention giả |
| C05 / vừa | `validate-narrative.mjs`: tên cung/topic trong 40 từ đầu là hard failure; `episode-formats.md` có cùng giới hạn mở bài | Cold open từ hành động hoặc một nghịch lý tự nhiên bị ép chèn tên sớm | Review opening có nhận diện đúng tập và không gây hiểu lầm. Giới hạn từ chuyển thành diagnostic; cho ngoại lệ có chủ đích. Giữ cover nối mở video và label trung thực |
| C06 / vừa | Mọi beat cần semantic_delta/evidence refs; conversational opening >3 riff-only beats hard fail; identity guide có ngưỡng ~1/4 cho scene tưởng tượng | Nhịp ngừng, callback nhỏ, đối thoại hài hoặc ví dụ cần thời gian bị coi là không thêm ý | Tách beat mang khẳng định khỏi beat delivery. Không yêu cầu mỗi nhịp đùa là facet mới; đánh giá theo đoạn và toàn bài. Cấm claim vô căn cứ vẫn giữ; minh họa hư cấu không được giả thành evidence thực tế |
| C07 / vừa | `character_deconstruction` và Delivery B Friendly Gossip là default; narrator guide trình bày chuỗi observation → manifestation → contrast → next facet → synthesis | Default dễ thành giọng gossip và cấu trúc mẫu cho mọi premise | Giữ identity-first/content engine đã chọn. Trình bày chuỗi trên là ví dụ, không template. Chọn narrator stance theo nội dung: tỉnh, ngớ ngẩn, nghiêm túc giả, quan sát khô, ngạc nhiên… không quota cảm xúc hoặc banter |
| C08 / cao | Writer draft không đọc raw reference/attachment/plan; compiler chỉ nhận một tập extras hẹp, brief hard cap 10KB | Nén đúng kỹ thuật nhưng có thể làm mất ý người dùng, sắc thái mẫu và cách tiếp cận đã chốt | Trước compile, bảo toàn yêu cầu sáng tạo rõ ràng trong brief: giọng, điều cần tránh, mục tiêu trải nghiệm, mechanics của reference. Không nạp raw pool/QC; giữ budget, nhưng ưu tiên dữ kiện sáng tạo thiết yếu thay vì cắt chúng để giữ trường công thức |
| C09 / vừa | `narration-rhythm.md` yêu cầu scene có direction nhất quán; compiler Phase2 chặn nhiều direction khác nhau trong một scene | Phase1 có thể tự hạn chế giọng trong đoạn hoặc chia đoạn để phục vụ metadata scene | Viết nhịp theo nghĩa trước; xử lý scene mapping ở Phase2. Nếu backend không diễn được thì giữ trạng thái cần nghe/review, không ép bài văn và không bịa điều khiển prosody. Không sửa Job@5 để tránh quyết định khó |
| C10 / cao | Hướng dẫn lịch sử xung đột: `content-craft.md` vừa cấm hybrid/micro story như shape vừa mô tả chúng ở đoạn sau; `narration-rhythm.md` mở đầu yêu cầu Plan2.0 rồi cuối mới nói scoped2.1; `viral-routing-policy.md` dùng origin external_plugin nhưng validator/compiler path mới yêu cầu plugin_guidance | Agent giải quyết xung đột bằng hướng an toàn nhất, tự thêm giấy tờ hoặc sửa bài cho hợp phiên bản | Dọn đoạn superseded; một authority cho version, provenance và creative defaults. Manifest/compiler/docs đồng bộ; không bắt agent tự suy ra precedence từ lịch sử |
| C11 / vừa | Review nhiều tầng: identity review, six story-quality criteria, narrative QC, spine realization; yêu cầu objection và excerpt | Câu chuyện bị viết để dễ trích bằng chứng review; kết quả máy hợp lệ bị nhầm thành bài hay | Gom trải nghiệm review thành một pass biên tập thực chất, sinh các projection/receipt theo owner hiện có. Phân biệt source/structure PASS với quyết định biên tập; không dựng phản biện giả để điền đủ trường |
| C12 / vừa | Sign-swap test đòi khác biệt “irreplaceable”; brief ưu tiên explain the sign, cảnh chỉ illustration | Agent có thể phóng đại tính độc quyền của nét tính cách hoặc lặp câu giải thích sau mỗi ví dụ | Test cơ chế diễn giải, động cơ và đối chiếu, không đòi hành vi chỉ tồn tại ở một cung. Cho hình ảnh/hành động hoặc punchline gánh ý mà không giải thích lại; giữ phân biệt archetype với hành vi tất định |

## Những ràng buộc cần giữ

- Claim và nguồn phải đúng phạm vi; không biến chiêm tinh thành thống kê hoặc khẳng định mọi người đều như nhau.
- Identity/group/ranking trung thực, thứ hạng là luận giải biên tập, không điểm số giả.
- Cách ly raw research, script cũ và kỹ thuật render khỏi draft; yêu cầu/reference được người dùng cung cấp vẫn phải sống trong brief đã biên dịch.
- Giữ narration đã duyệt nguyên byte, source hashes, user approval thật và revision isolation.
- TTS text readiness, duration chỉ estimated và review giọng nghe thực tế; không quota câu, không tự rút gọn bài để đạt 120 giây.
- Không mở lại research khi chỉ sửa giọng/câu chữ; quay Concept khi luận điểm đổi, Evidence khi claim/scope mới cần nguồn.
- Không bỏ `character_deconstruction` hay làm video truyện đời chung gắn nhãn cung để “tăng sáng tạo”. Nới cách diễn đạt bên trong định hướng đã chọn.

## Kế hoạch cập nhật chung

1. Dọn xung đột C10 trước, lập authority rõ giữa identity, episode format, writing và review.
2. Tách invariant dữ kiện/identity khỏi heuristic biên tập; nới C01–C06 bằng quyết định và lý do có chủ đích. Không thay hard quota này bằng một hard quota khác.
3. Rút brief/review trùng lặp, bảo toàn ý sáng tạo C07–C08/C11–C12. Giữ owner và schema tương thích; không thêm nguồn authoring cạnh tranh.
4. Giải quyết C09 ở ranh giới authoring/scene/TTS, không chỉnh lời đã duyệt hoặc hứa backend có emotion control.
5. Rerun Phase1 tới IN_REVIEW trên tập fixture có ý nghĩa: concept người dùng đã chốt; chủ đề hẹp một ý sâu; cold open có chủ đích; sketch hài có khoảng đệm; bài quan sát không twist; nhóm/Top có thesis chung; bài đòi nguồn ngoài scope phải block. Reviewer đánh giá thực chất, không fake user approval.
6. Kiểm legacy approved2.0/scoped2.1, brief source binding, source independence, immutable narration và negative claim inflation. So sánh độ khác biệt concept, số trường phải author và context bytes; không dùng structural PASS làm điểm sáng tạo.
7. Gom cùng kế hoạch pruning/tóc và lỗi contact/preview đã ghi, review rồi cập nhật plugin một lượt. Hiện tại các mục C01–C12 đều PLANNED, chưa triển khai.

## Source đã rà

Trong `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/`: `orchestration/phases/01-content.json`, `orchestration/compile-writer-brief.mjs`, `orchestration/validate-episode-concept.mjs`; `references/phase01-briefing.md`, `episode-formats.md`, `content-quality-engine.md`, `zodiac-identity-first.md`, `narrative-modes.md`, `content-craft.md`, `narration-writer-brief.md`, `narrator-performance.md`, `narration-rhythm.md`, `viral-routing-policy.md`, `validate-content-contract.mjs`, `validate-narrative.mjs`. Audit dựa trên source đọc thực tế; không có lần fresh run hoặc sửa narration mới trong lượt này.

## Cập nhật thực thi — release 2.4.54

Đã triển khai: candidate/facet thích ứng; giữ creative_direction; PASS không cần bịa objection; identity xuất hiện trong lời kể, opening 40 từ là diagnostic. Asset chọn theo hành động thực, mặc định tóc ngố/meme, không tự thêm environment/accessory; không xóa master tương thích. Sửa viewport rest_sitting, socket ghế, actor_state_slide preview và compiler đường dẫn tương đối chạy trong staging để không ghi vào nguồn. Cover .75s/.2s và captions chờ cover release; timeline voice giữ nguyên.

Bổ sung theo phản hồi cuối: Phase01→02 có handoff_context gồm authority, hash, scope/Spine, creative direction, review refs và next action. GitHub SeikoP/project-zodiac-video là transport version-pinned; repository prose không thay plugin đang dùng hoặc quyết định tập. Repo giữ implementation + contract/schema/catalog/assets/tests/provenance; không chỉ mã chạy.

Review bản Leo v2.4.53: unsupported accent_only/optional_callback/attached; Story Object thiếu friction/payoff relation; preview hash cũ; density S02/S05 chưa hợp lệ; state Phase1 READY/Phase2 LOCKED/review receipts rỗng. Giữ nguyên ZIP được gửi. Không suy approval từ tên gói hay version, không thêm beat vô nghĩa để đủ quota. Rà source plugin các file core đã chạm không thấy thay đổi logic chuyển phase ở 2.4.53; kết luận giới hạn trong phạm vi đã đọc.

Kim Ngưu revision03: 8 cảnh/17 events/23 assets/34 endpoints, native projection/assembly/identity/outfit/story/composition/preview/preflight PASS. Giữ nguyên narration và SVG khung ZIP; tóc antenna-short, ghế mọc rễ có contact. Đây là bản review đầy đủ, chưa có user approval cho toàn revision nên chưa seal official Phase03. TTS/prosody/MP4 là runner QA còn mở; Chrome download bị network proxy chặn, không claim motion/frame parity.


## Closure — 2026-10-12, plugin 2.4.57

Native E2E Phase 2 completed for both approved episode directions; official Phase 3 exports and Python package-import checks PASS. Kim Ngưu geometry/frame/narration unchanged; Leo narration unchanged, small accent readability and native metadata repaired. See docs/zodiac-simplification-release-receipt.json for the two ZIP hashes and exact counts.

Added authored-frame idempotence, continuity diagnostics without relaxing frame/contact validation, cycle-free composition CLI, post-compiler Director resolution, forced final native hash binding, schema/semantic preflight parity, and registered-only asset staging. 527 orchestration tests and 45 Phase03/release tests PASS; mixed-aspect regression 2/2 PASS. The installed plugin release is pluginrel_6acbddbbaaa88191ab40b367141dcddf.

Pending: measured runner TTS/prosody/timing and video pixel/audio/MP4 QA; actual GitHub Actions source-artifact upload observation. Historical discarded frame/shadow demos are superseded by the exact approved archive. Repo prose is development documentation, not authority over the plugin or the approved episode contract.
