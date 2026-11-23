# Nhân Mã: khôi phục ZodiacCover V4 và bổ sung hình ảnh kể chuyện (2026-11-22)

## Vấn đề thật sau khi xem Contact Sheet revision 6
- Cover `series-topic-opening@1` từng được dựng kiểu poster chữ, nền gradient và biểu tượng hình tròn; không giống `ZodiacCover` Remotion 2.0.2 đã dùng trong dự án.
- Nguồn tham khảo đúng: `runtime/zodiac-renderer/2.0.2/renderer/src/ZodiacCover.tsx` với design `zodiac-cover-design@2`, style `zodiac-paper-doodle-meme-v4`, identity yellow paper strip, note frame `crooked-paper-note`, warm shadow, topic/hook trên giấy, cast và physical prop lấy từ scene có thật. 1080×1920, vùng subtitle vẫn độc lập.
- Các cảnh S04–S08 chủ yếu lặp hai nhân vật đứng yên trên giấy trống. V1 storyboard đã chọn tình huống đời thường nhưng visual compiler thiếu đồ vật minh họa các bằng chứng cụ thể.

## Thay đổi nguồn
- `tools/studio_project/visual_opening.mjs`: cover dùng nguyên lý giấy note nghiêng, viền ink, bóng giấy ấm; chú trọng chủ đề `Cách Nhân Mã yêu thật lòng` thay lời hook, nhãn `12 CUNG HOÀNG ĐẠO` và glyph Nhân Mã. Phần dưới tái sử dụng native cast asset và đạo cụ từ scene đầu, không tạo nhân vật mới, không gradient/glow.
- `tools/studio_project/visual_preview.mjs`: mở rộng `openingHtml` nhận first-scene/asset map; cùng biểu diễn ở preview S01 và whole-episode MP4, giữ narration và caption bắt đầu frame 0.
- `visual_contract.json` nâng từ `@4` sang `@5` để build cũ stale sau thay giao diện cover.
- 4 props V4 mới: `route-planner-phone` (ba điểm đến), `saved-folder-phone` (thư mục tên `Dẫn người ấy đi`), `banh-trang-nuong`, `menu-photo`. Mỗi props native SVG nét giấy/doodle, safeSvg PASS, metadata trong catalog `props/index.json`; số master 60→64. Các đạo cụ điện thoại hiển thị những loại nội dung khác nhau, không chỉ một mẫu generic.
- Nhân Mã rev6 → rev7: 13 lượt thêm entity vật thể với reveal/hide theo exact Vietnamese voice anchors. S01 bằng chứng điện thoại, S03 notebook ghi rõ giờ/địa chỉ, S04 món ăn→3 quán→lịch, S05 phản hồi và đồng hồ chờ, S06 món ăn và menu tại quán, S07 ảnh địa điểm→thư mục điện thoại, S08 nhắn tin→chốt lịch. S02 và S03 Story Visual canonical SV01 giữ nguyên. Di chuyển/scale diễn xuất để bớt lặp bố cục.
- Rev7 Contact Sheet review đã phát hiện các điểm yếu còn lại dù render thành công: món ăn S04 chỉ hiện được <1 giây; menu S06 và phone/photo S07 đè vào mặt actor. Rev8 sửa show anchor S04 sớm hơn, đặt đồ vật S06/S07 xuống vùng thân/tay, dịch actor support lên để mắt/mặt luôn nhìn được; calendar S08 đặt gần điện thoại.
- `agent_bridge.py` prompt cập nhật quy tắc cover V4 native scene, lựa chọn concrete prop theo narration, không trùng phone generic, thay đổi vị trí/scale theo beat, tránh dán hình chữ lên toàn bộ scene. Không tạo art tùy tiện; vẫn dùng master catalog và Story Visual Phase1.

## Bằng chứng trước khi xuất MP4 cuối
- Rev7 source SHA `af5b007533c15e8715b4f1c70429d14910d7412a3aa0bfe9168514a387cf4769`.
- Rev7 built `9b9d38d5cbc4436ca0498fc06fd70a49`, exported full 74.4s H.264/AAC `.runtime/story-visual-cover-repair/r7/episode.mp4`. Decode/caption/cover parity PASS. Contact sheet `r7/zodiac-nhan-ma-contact-sheet-r7.jpg` from actual MP4.
- Measured illustration pixels vs rev6 increased ~2.5x at route-phone beat S04 and ~4x on cover, **coverage diagnostic only, not evidence of artistic quality**.
- React/HyperFrames regression suite 19/19 PASS; V4 prop/candidate tests 17/17 PASS; Story Visual Phase2 presence PASS; Git diff whitespace PASS.
- Rev8 source SHA `4bf67ee72f733d1024dc64fd5d905bbaec1832f704b605e923d4abc273633bea`, build `301d881ce04f46c0bf0e9599db94175b`, 8/8 technical valid, zero QA errors and review warnings. Full MP4 export/visual review PENDING until independent decoded artifact inspection.

## Boundaries
- Không sửa nội dung lời dẫn, không đổi voice/TTS, không thêm SFX/nhạc. Không ghi đè rev6 hoặc rev7. Chưa có human creative approval, không tự publish.
- Chất lượng hình ảnh không thể kết luận chỉ qua asset count hoặc `TECHNICAL_VALID`; Contact Sheet và video phải được xem.
- Các quy tắc visual mới giữ quyền sở hữu của Phase1 Story Visual; không tái tạo Story Text entity hoặc hệ thống bảng chat ép mặc định.
- Không commit/merge/push trên dirty `experiment/main-2`, giữ các thay đổi từ phiên trước.

## Final decoded-media evidence (revision 8)
- Source revision 8 SHA `4bf67ee72f733d1024dc64fd5d905bbaec1832f704b605e923d4abc273633bea`; HyperFrames build `301d881ce04f46c0bf0e9599db94175b`, 8/8 scenes TECHNICAL_VALID, zero layout QA issues/warnings.
- Full MP4 `.runtime/story-visual-cover-repair/r8/episode.mp4`, export ID `e805197badd64c45b9d433f0c6bdfb4d`, 74.4s, 5,148,844 bytes, SHA256 `c6eead6cb2e32234fbe7c9fe421826d27e13899ccb9ae0e65335128cc4bd1fe6`. Approved voice SHA unchanged `e5f35bb23d0897bdf8a23fce95d03a7fdb203772eed82cbe2740f03806689394`.
- Independent `audit-r8-render.py` confirms FFmpeg full decode PASS, PNG cover pixel-identical to first frame, 38 SRT cues, audio_contract voice-only, visual source/receipt coherent.
- Human frame review: cover now yellow paper identity strip, crooked handwritten note, original native cast + phone. S04 shows literal grilled snack and separate phone route planner; S06 menu moved from eye-level to hand-height, face visible; S07 phone-folder and photo moved below faces, folder label still readable when zoomed. No claim of 100% Remotion pixel parity across these new custom edits.
- Coverage diagnostic in illustrative stage (not an artistic score): sampled S04-food nonpaper area from 24,211→53,484 pixels (2.21×), S04-route 23,623→59,173 (2.50×), S06-menu 57,532→72,316, S07-folder 57,530→72,784.
- Downloadable mobile contact sheet `r8/zodiac-nhan-ma-contact-mobile-r8.jpg` (1168x6742, two columns, 12 real MP4 frames); standard 4-column contact `r8/zodiac-nhan-ma-contact-sheet-r8.jpg` (1817x2773), cover comparison `r8/cover-comparison-r6-vs-r8.jpg`; review ZIP `r8/zodiac-nhan-ma-visual-review-r8.zip` (7,041,622 bytes).
- External Android download links verified by actual GET with HTTP 200 and matching original SHA256:
  - JPG `https://tmpfiles.org/dl/1795360330.a401b56e826ac840/w4AfbX8DdXc1/zodiac-nhan-ma-contact-mobile-r8.jpg`
  - MP4 `https://tmpfiles.org/dl/1795360334.238a8992b1a7766c/wsAIbg8admT2/episode.mp4`
  - ZIP `https://tmpfiles.org/dl/1795360337.ae773e398bc4b6d5/wtANbF8EdTWI/zodiac-nhan-ma-visual-review-r8.zip`
  These are temporary unlisted external links, not ChatGPT-native attachments.
- Regression: Node renderer/caption/cover 19 PASS; V4 asset/gallery 17 PASS; Agent Authoring 10 PASS; live Phase2 Story Visual validator PASS; Git diff check PASS. Visual human review remains PENDING; no auto approval/publish.
- Worktree `experiment/main-2` remains dirty; no commit, push or merge. Older revision 6/7 exports not overwritten.
