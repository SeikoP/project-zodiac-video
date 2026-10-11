# Zodiac simplification — nghiệm thu 2.4.51

Ngày 2026-10-11. Triển khai native tuần tự theo kế hoạch Superpowers; không subagent, không review độc lập giả. Baseline Git ban đầu 2.4.44 đã được đối chiếu và hòa giải với source plugin đang cài 2.4.50 trước khi sửa. Job@5, renderer@2.0.1, canvas 1080×1920 và V4/Human Stroke v2 giữ nguyên.

## Kết quả triển khai

| Phần | Kết quả | Giới hạn nghiệm thu |
|---|---|---|
| T1/T2 asset và archive | Policy core/extension/compatibility; giữ full SVG, hash, transform; archive_frame bỏ nhánh auto cue | Không xóa kho; provenance nguồn ZIP ngoài fixture cần file nguồn thực để kiểm độc lập |
| T3 authoring | Visual-intent@1 opt-in sinh native projections deterministic; writer giữ transaction; drift bị chặn | Fixture một cảnh đã qua grammar/composition/Job5. Chưa đổi cả tập Kim Ngưu sang intent và duyệt lại |
| T4 preview | Before/after giữ state của mọi entity theo author order; phân biệt visual/motion-only/no-op | Static endpoints chưa chứng minh motion/timing |
| T5 object | required/optional/omitted rõ lý do; conflict flags bị chặn; repeated reveal trả NEEDS_REVISION | Flags phải được cấu hình minh thị trước authoring; compiler không tự approve hoặc thay metaphor |
| T6 pose/contact | Hai pose nghỉ; socket tay viết lấy geometry; clip họa tiết áo pose nằm | Qt SVG đã xem; contact với sofa/bút trong tập và Remotion cần review |
| T7 handoff | Dùng chung density/layout và chạy real Job5 compiler/schema/motion boundary trước Visual Review; voice range giữ UTF8 bytes ở workspace export | Preflight là read-only, không tạo lock/approval. Asset/publish byte validators và runner checks vẫn có gates riêng |
| T8 điều phối | Source-bound approvals, lease không takeover theo thời gian, restore loại lock/tmp, capsule, dependency impact, Phase3 state commit từ receipt validator chạy thật | Receipt được ghi trước atomic publication; recovery CLI dùng lại ZIP và kiểm CRC/root, lock, receipts/CAS. Lỗi ghi receipt chặn publication |
| T9 TTS | Ước lượng duration có nhãn estimated; diagnostic có span; manifest trước Content Review; Narrative 2.1 current, 2.0 legacy | Không sửa narration đã duyệt. Chưa có nghe TTS/prosody thật |
| T10 context | Guide ngắn dùng chung, catalogs đầy đủ theo selection; legacy giữ nguyên full catalogs | Không miễn compiler, validator hoặc user approval |
| T11 parity/release | JS/Python canonical schema hash khớp; actual ZIP import, audited legacy hash và unknown rejection; CI bổ sung | Native producer/import PASS riêng; creative và runner media PENDING |

## Bằng chứng chạy thật

- Native orchestration + reference tests: **555 passed**, 0 failed.
- Character/validation tests bổ sung: **10 passed**, 0 failed.
- Python toàn repo: **634 passed, 11 skipped, 23 subtests passed**; 7 Qt deprecation warnings.
- Fresh Phase1 fixture E2E: single_sign, element_group, ranked_shortlist, comparison và ranked Top5 chạy đến IN_REVIEW qua commit native. Không tạo user approval giả.
- Phase3 E2E fixture: compile → real validators → ZIP → roundtrip → strictly valid state; concurrent export một tên chỉ một writer; resume không overwrite ZIP.
- One-intent integration: native grammar, archive environment, resolved composition, Job5 handoff; không thêm cues.
- Negatives: stale source/approval/narration/scope, edited projection, empty execution receipt bypass, changed frame/transform, invalid ranges, caption/density, live lease, unknown contract và changed ZIP bị chặn.
- Một test Python baseline cũ kỳ vọng caption không có word anchors đã được cập nhật theo anchors thật mà runtime hiện hành trả về; không đổi runtime caption để chiều theo test.

Lệnh kiểm chính:

```sh
node --test plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/*.test.mjs plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/*.test.mjs
node --test plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/*.test.mjs plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/validation/*.test.mjs
QT_QPA_PLATFORM=offscreen python -m pytest -q
```

## Số đo context

Đếm bytes thực của các file guidance cho step visual_compile; đây không phải tổng token model hoặc chi phí toàn phiên. Chi tiết paths/hashes ở zodiac-simplification-context-benchmark.json, tái đo bằng tools/measure_zodiac_context.mjs với baseline skill-root 2.4.50.

| Selection | 2.4.50 | 2.4.51 | Thay đổi |
|---|---:|---:|---:|
| Khung ZIP, không extension | 123.497 | 68.916 | giảm 44,2% |
| Cafe, không meme | 123.497 | 88.754 | giảm 28,1% |
| Meme được chọn | 123.497 | 85.765 | giảm 30,6% |
| Legacy chưa bind selection | 123.497 | 126.274 | tăng 2,2%; giữ full catalogs |

Baseline Kim Ngưu có **9 source plans, 195.004 bytes, 30 SVG unique, 7 state trùng, 8 frame references**. Đã sửa định nghĩa benchmark để không đếm 50 file receipt/evidence/generated như 50 source thủ công. Mode mới có một intent làm owner và các projections được sinh; chưa báo giảm file/SVG cho cả tập khi chưa chuyển và duyệt lại tập đó.

## Kim Ngưu và hình mẫu

Narration bảo toàn SHA256 `a596290328980cab88801ccf612cdcd87b75c7c4ebf7d869a00e20f21310ea6f`.

ZIP đã phát hành bảo toàn SHA256 `fb3f145e078b9e5f46b8e4a82d0490c9e251dda7c06da99f8a9c42cb0a036693`. Không overwrite hoặc phát hành ZIP revision mới.

Replay riêng đã build/validate **24 pairs / 48 frame files**, archive hash/transform PASS. Đây là replay source hiện hành bằng cumulative preview mới; không phải tập mới đã được duyệt. Review receipt visual đã bỏ khỏi bản replay. Story Object `memory_menu` trả **NEEDS_REVISION / STORY_OBJECT_REPEATED_REVEAL**; giữ nguyên narration, chưa tự chốt metaphor mới.

Khung nguồn cũ cafe giữ SVG SHA256 `081abe8b09e865c5f137100291f7ad28a94d8b39a604d5912e3fbb6d41d8edc4`, transform 0,0,1080,900. Khung nguồn đã chọn trong release hiện hành giữ SHA256 `dc7e7ef67fd7f0d2409dd7a5557a2a2b32438045975d36f2a603499a0a94f3b8`, transform 0,0,1080,950. Tường/sàn và toàn source SVG được giữ; không lọc hai path rồi gọi là original. Các thử shadow, pen-pressure và gradient/fade đã hủy.

Preview pose nằm trong zodiac-simplification-preview/. Họa tiết áo nổi ra ngoài torso và bóng đứng lạc chỗ của pose nằm đã được sửa sau khi render Qt SVG. Đây là kiểm pixel của asset, chưa chứng minh contact của shot hay animation.

## Kế hoạch còn mở

1. Chuyển tập Kim Ngưu sang intent trong revision workspace riêng; chọn required/optional/omitted object bằng review thật. Sửa progression có nghĩa hoặc bỏ rõ lý do, rồi render đúng frame và duyệt hình.
2. Kiểm lean_tall, pose nghỉ và socket tay–bút trong layout thật: intrinsic ratio, layer, caption/face clearance và seat contact. Chỉ seal/export revision sau Visual Review thật.
3. Runner thực: TTS/voice-performance và nghe prosody; measured word timing; ba frame quanh transition/contact/reveal; cover/caption/watermark; SFX/end-tail; MP4. Các mục này **PENDING**, không VIDEO_READY.

## Backlog A01–A33

| IDs | Xử lý |
|---|---|
| A01, A03, A04, A10–A12, A23 | Source policy, exact hashes, dependency impact, lease/capsule/restore và Phase3 receipts/state; write-ahead receipt trước publish |
| A02, A05, A07, A08 | Duration/TTS readiness và Narrative policy; semantic negatives/Phase1 E2E; audio/human review pending |
| A06, A13–A15, A18–A20, A26, A28, A33 | Bounded guidance, single intent, cumulative preview, archive frame và flat depth |
| A09, A27 | Object policy đã sửa; Kim Ngưu vẫn NEEDS_REVISION, chưa creative PASS |
| A16, A17 | Native poses/sockets và lean_tall; episode contact/render pending |
| A21, A24 | Native/import parity và diagnostic runner; media pending |
| A22 | Compiler/schema/motion/layout/density/range preflight parity đã sửa |
| A25, A32 | SUPERSEDED bởi quyết định giữ tường/sàn và exact ZIP |
| A29–A31 | CANCELLED; không triển khai lại |

## Source và phát hành

Source triển khai ở branch codex/zodiac-simplification. Git HTTP CLI thiếu credential; đã đồng bộ branch qua GitHub connector, kiểm tree hash bằng đúng local tree đã test, không merge main. Giữ toàn baseline đã kiểm vì local base 5de4473 chưa có trên remote. Bản plugin update là overlay so với source cài 2.4.50; không xóa file hoặc đổi audience. Manifest version 2.4.51 đồng bộ template; defaultPrompt lịch sử được giữ và bổ sung clarification có precedence. Xác nhận backend release được ghi ở zodiac-simplification-release-receipt.json sau publish.
