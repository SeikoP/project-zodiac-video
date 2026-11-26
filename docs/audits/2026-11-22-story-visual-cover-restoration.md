# Fix: Story Text ≠ bảng tin nhắn; cover giới thiệu chủ đề series (2026-11-22)

## Root cause
- Lần sửa trước chặn toàn bộ text graphic trong `agent_authoring.py` và `agent_bridge.py`, bỏ cả Story Text theo thiết kế. Điều này sai khái niệm: canonical Phase 2 `story_text` đã hợp nhất thành **lettering bên trong cùng một `story_visual`**, không còn thực thể `story_text` độc lập.
- Phase 1 của Nhân Mã/ `love-sincere` yêu cầu SV01 thể hiện **hai người gửi cùng câu hỏi, hai câu trả lời khác nhau**. Việc xoá hết bảng là làm rơi bản thiết kế đã duyệt chứ không phải simplification đúng nghĩa.
- HyperFrames chỉ trích cover từ frame 0, chưa có nội dung chủ đề/series trong frame đầu. Hook thoại quá hẹp với người mới vào giữa feed.

## Fix nền tảng
1. `tools/studio_project/story_visual_art.py`: hai dạng ảnh native bảo mật/giới hạn: **story_text** (một cụm chữ có ý nghĩa và accent, KHÔNG có bảng lớn) và **chat_compare** (hai thẻ hội thoại, tên người gửi, tin hỏi, đáp án nổi bật). Chữ Việt chuyển thành path SVG qua font Patrick Hand cố định (fontTools), không để browser thay font; SVG không có external href/script, SHA-256 content-addressed.
2. `agent_authoring.py`: chấp nhận `assets[id].visual` đúng schema và `phase1_visual_id` tồn tại trong narrative plan đã duyệt; giới hạn một story_visual có chữ/cảnh, initial state ẩn và voice anchor reveal, chỉ ghi art sau xác nhận Agent, ảnh khác bắt buộc trong catalog. Không tái tạo riêng `story_text` entity.
3. `agent_bridge.py`: bỏ lệnh cấm chat/text bừa bãi; chỉ dùng dạng chữ khi có bằng chứng và mục đích của Phase 1, không mặc định bảng chat trang trí; agent phải tạo cover chủ đề thay vì hook.
4. `visual_opening.mjs`: cấu trúc `zodiac-series-opening@1`: `series='12 CUNG HOÀNG ĐẠO'`, `sign`, `topic` bắt đầu bằng “Cách”/“Khi” và có tên cung, thời lượng 0.8–2.5 giây, fade 3–15 frame. Render intro overlay **trên hình nhưng không đè caption lane**, voice bắt đầu frame 0, không tăng độ dài video.
5. Preview scene đầu và HyperFrames MP4 dùng cùng markup/opacity, nguồn opening nằm trong production.json được hash. Export receipt có `cover_contract.mode='series-topic-opening@1'`, không bị gắn mác generic first-frame. Khi cover lấy frame 0, đó là ảnh intro theo đúng series.
6. `EpisodeExport.tsx` hiển thị cover chủ đề và xác minh frame 0 thay vì “chưa xác minh” với mode mới.

## Nhân Mã (rev 4 → 5)
- Giữ approved narration và TTS, không ghi đè MP4 cũ.
- S02: Story Visual chat_compare “Hội bạn → Để xem” đối lập “Người ấy → Bảy giờ, tớ qua đón”, cùng câu rủ thứ Bảy, reveal khi narrator nói “nó nhắn ngay”; actor đưa xuống để tránh chồng graphic.
- S03: Story Text vector “ĐỦ THÔNG TIN, VẪN ĐỂ XEM” chỉ xuất hiện khi lời kể đến “Nó vẫn bảo: để xem”; không thay thế phụ đề.
- S01 cover opening: “12 CUNG HOÀNG ĐẠO”, “Nhân Mã”, “Cách Nhân Mã yêu thật lòng”; 45 frame (1.5 s), fade 9 frame, không có silent preroll.
- Source hash rev 5: `003a912471ab9ec175c034a46f142387b43b83d601fa35ad4cb4c8afb2de0843`; build 8/8 scenes `670ef28bef444e49b81970c40be35d51`.
- `.runtime/story-visual-cover-repair/migration-receipt.json`, `visual-intent-r5-candidate.json`, `build-receipt.json` là bằng chứng và điểm đối chiếu rollback.

## Automated evidence
- Node tests: 18/18 PASS với `tests/studio_hyperframes_export.test.mjs`, `studio_hyperframes_caption_contract.test.mjs`, `studio_visual_migration.test.mjs` (bao gồm intro frame 0, fade, giữ phụ đề, reject hook giả).
- Python unittest: 27/27 PASS (bao gồm synthetic Story Visual generated SVG, safe font outlines, scope restrictions, no writes trước khi agent được xác nhận).
- `prepareExport` trên build thật: PASS hash, 8 scenes, 2232 frames, 38 caption cues; s01 có intro, s02 chat entity, s03 Story Text entity, `human_review=PENDING`.
- TypeScript/Vite GUI build PASS.
- Human creative approval vẫn PENDING. **Pixel review frame 0, S02, S03 và MP4 rev 5** cần kiểm tra sau lần xuất mới, không kế thừa PASS nghệ thuật.

## Risks / non-goals
- Vẫn không hỗ trợ full Remotion designed cover payload cũ; ảnh mở đầu mới là template series-topic nội sinh và không lén thay 100% layout riêng của Remotion.
- Không tự tạo nhạc nền/SFX, không cấp quyền âm thanh, không thay voice hay làm tăng thời lượng.
- Không commit/merge/push trong dirty worktree `experiment/main-2`.

## Post-render QA on actual MP4 (completed)
- **Native HyperFrames E2E export COMPLETED**, review candidate `.runtime/story-visual-cover-repair/episode.mp4` (4,720,491 bytes, 74.4 seconds, 1080x1920, H.264/AAC), export ID `cb92253fd7d846068d411fd32a09679f`, SHA-256 `de474edaead1cbd5ba1694d794fdf7772b18e006c800a57b9b730d77ee960db2`. Old rev4 videos unchanged.
- Fully decoded MP4 PASS; cover.png is pixel-identical to first encoded frame, 38 captions cues preserved, original voice SHA-256 `e5f35bb23d0897bdf8a23fce95d03a7fdb203772eed82cbe2740f03806689394`. Evidence `.runtime/story-visual-cover-repair/{export-r5-receipt.json,qa-r5.json,receipt.json}`.
- Visually inspected decoded frames `frame-0.2.png`, `frame-11.1.png`, `frame-20.3.png`: intro shows **12 CUNG HOÀNG ĐẠO / NHÂN MÃ / Cách Nhân Mã yêu thật lòng**, with opening narration caption still visible; S02 shows two separated short chat panels with sender + message + reply, not generic board; S03 shows a standalone typographic emphasis in the story_visual state, not the subtitle lane. The acting is still basic; no artistic approval.
- Node 18/18 tests PASS, Python 27/27 tests PASS, TypeScript/Vite build PASS. Additional targeted Python regression verified deterministic native SVG and Phase1-directed authoring.
- Repair to new initial-authoring proposals also supplies default `narrative_brief` and `visual_coverage` metadata with the approved phase1_visual_id, so future Story Visual lettering does not lose its origin. **The existing migrated rev5 episode did not add these full metadata objects**, since the in-progress video/receipt had to remain immutable: a future Phase2 legacy handoff seal must revalidate this separately. Do not declare it SEALED.
- Cover visual still has an initial-letter monogram in the yellow badge. That is a stylistic candidate, not a verified zodiac glyph and not a design approval.
- Git changes remain uncommitted in the existing dirty `experiment/main-2` worktree; human visual/audio/video review PENDING.
