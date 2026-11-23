# Audit giao nhận Remotion → HyperFrames (Studio V5, 2026-11-22)

## Phạm vi / trạng thái
- Worktree: `experiment/main-2`, base HEAD `ffbf815c`. Có các thay đổi chưa commit từ nhiều hạng mục trước; lần audit này không reset, không merge/push.
- Đọc và kiểm thử trực tiếp: `runtime/zodiac-renderer/2.0.2/renderer/src/{ZodiacRenderPlan.tsx,caption-layout.mjs,caption-karaoke.mjs,semantic-motion.mjs,spatial-layout.mjs,visual-role.mjs,cover-opening.mjs}`; `tools/studio_project/{visual_compiler,visual_preview,visual_export,visual_presentation,visual_workspace}`; studio React Tauri GUI; fixture Nhân Mã trong isolated `.runtime/workflow-agent-e2e`.
- Mục tiêu audit: ranh giới Visual Intent → V4 compiler → speech timing/scene events → HyperFrames preview → export HTML → CLI render → FFmpeg audio/cover/SRT → receipt / GUI. Không thay lời dẫn, WAV đã duyệt hay status duyệt chất lượng.

## Mismatch đã xác nhận và sửa
| ID | Mức độ | Bằng chứng / nguyên nhân | Sửa và regression |
| --- | --- | --- | --- |
| HF-01 | P0 | `visual_export.mjs` tạo SRT theo 6 từ một cue; `visual_preview.mjs` lại phân trang bằng glyph width ở browser. Timing/text trên MP4 và SRT không đồng nhất | `visual_captions.mjs` dùng Fontkit đọc cùng Patrick Hand TTF và `paginateCaption` của renderer ghim; `renderPreview` và `renderEpisode` dùng cùng trang; SRT xuất đúng cue và ngắt dòng đã hiển thị |
| HF-02 | P0 | Trang caption kết thúc ở từ cuối, trang sau mới bắt đầu khi từ đầu được đọc. Mốc Nhân Mã tại 68.0s trong MP4 trước có frame mất phụ đề dù SRT có cue | Trang trước giữ đến khi trang sau bắt đầu; trang cuối được clamp tại cut của scene. Mẫu thật 8 scenes / 38 cues / không chồng timestamp; 67.7, 68.0, 68.5, 70.2, 72.2s đều có trang |
| HF-03 | P1 | Remotion `useVerifiedCaptionFont` fail-closed; Hyper chỉ `document.fonts.load().then(start)`, thiếu kiểm chứng font status | `visual_presentation.mjs` kiểm tra FontFace đã loaded và `document.fonts.check` trước khi bắt đầu timeline; báo `FONT_LOAD_FAILED` và không tuyên bố ready nếu không có font |
| HF-04 | P1 | Build preview có category/role asset, export dựng lại `assets` chỉ từ SVG/hash, bỏ metadata; legacy entity không khai báo kind có thể phân lớp khác / bị `EXPORT_PREVIEW_DRIFT` | Bảo toàn metadata tại cả compiler và exporter; regression sử dụng legacy prop không có kind/visual_role, build và export hash vẫn khớp |
| HF-05 | P1 | Cover được trích từ giây 1 thay vì frame đầu video; không đúng cover = opening frame | `visual_workspace.py` dùng FFmpeg frame đầu tiên, ghi `cover.source_frame=0`; unit test bảo đảm command không seek |
| HF-06 | P1 | Media QA chỉ so video duration với composition và audio không thiếu so với voice, chưa chặn audio đuôi dài hoặc silent video tail | `_verify_export_probe` kiểm tra dimensions, fps, duration, frame count, audio/video/voice lệch tối đa 250 ms; unit test với drift audio/video và frame count |
| HF-07 | P1 | Build cache/status chỉ khóa presentation contract; đổi JS trang caption nhưng giữ contract cũ sẽ không lập tức đánh dấu rebuild trong GUI | Bump `visual_contract.json` sang @2, thêm caption_sync/font_verification/cover_source/audio_mux_guard; code/helper/fontkit/GSAP tham gia compiler/cache fingerprint; bản cũ phải rebuild |
| HF-08 | P1 | `TECHNICAL_VALID` vẫn có thể là 8s idle, thiếu diễn xuất; Nhân Mã sau bỏ bảng chữ chỉ còn hai nhân vật | `quality` thêm `review_warnings: ACTING_BEATS_SPARSE` nếu scene ≥7s nhưng có <2 actor state changes; hiển thị ở VisualEditor, không tự động hạ hay cấp creative approval |
| HF-09 | P2 | Remotion có `ZodiacCover` overlay và fade ở `cover-opening.mjs`; HyperFrames V5 không có bản đồ từ publish cover opening | `validateIntent` chặn `VISUAL_COVER_OPENING_UNSUPPORTED` nếu yêu cầu cover overlay như cũ; không âm thầm loại bỏ tác phẩm. Đây là feature gap CHƯA được triển khai, không được tuyên bố parity cover composition |

## Kiểm thử thực tế
- Browser cùng Chrome/Thorium: **114 Remotion ↔ HyperFrames screenshots**, max mean channel error = **0**, max changed pixel fraction >8 = **0** (bộ fixture bao gồm nhiều motion families, scene start/cuts, Vietnamese caption). Evidence: `.runtime/audit-hyperframes-20261122/{samples.json,pixels.json}`.
- Bộ synthetic `tests/studio_hyperframes_caption_contract.test.mjs` kiểm tra caption page continuity, SRT = layout/video, và cut không nằm trên integer frame. `tests/studio_hyperframes_export.test.mjs` kiểm tra export/role-metadata, caption, guard cover overlay.
- Nhân Mã thật (không viết nguồn / không xuất lại MP4): `.runtime/audit-real-episode-preview.mjs` kiểm tra 8 scene, 2.232 frames, 38 caption cues, zero overlap và 5 thời điểm trọng yếu. Bản MP4 revision 4 xuất trước audit **không chứa các sửa renderer vừa thực hiện**.
- Backend: **26 Python unittest PASS** (`tests.test_studio_agent_authoring`, `tests.test_studio_p34_visual`); **14 Node tests PASS** (`studio_hyperframes_caption_contract`, `studio_hyperframes_export`, `studio_visual_migration`). UI TypeScript/Vite build PASS. CI có cả visual migration tests; human review vẫn PENDING.
- Đã rebuild trên source thật Nhân Mã revision 4 sau contract @2: 8 scenes TECHNICAL_VALID, build `fb3fcacb3d574e82836c3acb180eb426`, không còn stale preview, human approval NOT_GRANTED. QA báo `ACTING_BEATS_SPARSE` tại S03, S04 và S06. Artifact: `.runtime/audit-hyperframes-real-build.json`.
- Browser preview riêng trên build thật chưa hoàn tất do lượt kiểm tra bổ sung không trả về kết quả và đã được dừng để tránh chiếm tài nguyên. Không thay thế bằng fixture parity 114/114 để tuyên bố native video PASS.
- `renderer_parity: NOT_ASSERTED` ở manifest vẫn đúng cho các build chưa chạy parity bằng fixture/MP4 cụ thể; không tự sửa receipt thành PASS.

## Điều cố ý chưa được tự động hoàn thành
1. **Cover overlay thật của Remotion**: hiện chặn yêu cầu kiểu cũ thay vì im lặng xuất video sai. Để hỗ trợ cần một `cover-opening` composition contract với asset binding, intro timing và thử pixel parity, chứ không chỉ trích thumbnail.
2. **Âm thanh production ngoài narration**: đường export HyperFrames hiện ghép một `voice.wav`; chưa thấy hợp đồng nhất quán cho nhạc nền/SFX/ducking trong Visual Intent của Studio. Không thể tuyên bố đã migrate phần audio creative bằng phép thử AAC hiện tại.
3. **Chất lượng hành động Nhân Mã**: board đã bỏ nhưng cảnh còn đơn điệu. Review warnings không thể thay thế phân tích diễn xuất thật trên MP4 mới. Human audio, visual và video review PENDING.
4. **Vòng phát hành**: mới có build/fixture testing. Chưa chạy lại native Tauri full E2E với artifact được dựng lại sau contract @2; không được dùng MP4 revision 4 cũ để suy ra production PASS.
5. **Bản SDK/CLI HyperFrames**: app vẫn pin SDK/Studio 0.9.45 và CLI 0.9.63. Bộ 114 fixture chứng minh đường tích hợp đang chạy, không chứng minh mọi phiên bản sau tương thích. Giữ pin; nâng cấp phải kèm E2E và parity.

## Biện pháp giữ dữ liệu
- Giữ nguyên canonical Visual Intent, approved narration và WAV; không sửa trong `phase1-done`.
- Không xóa lịch sử build và MP4/receipt cũ; contract version giúp chỉ rõ build cần dựng lại.
- Không commit/merge/push các thay đổi chung của worktree khi đang có dirty files từ các hạng mục trước.
