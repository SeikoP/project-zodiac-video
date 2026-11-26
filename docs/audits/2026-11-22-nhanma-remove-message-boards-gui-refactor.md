# Nhân Mã: bỏ bảng tin nhắn và refactor điều hướng Studio (2026-11-22)

## Ý định
- Bảng tin nhắn/chat/plan chữ **không phải thành phần hình ảnh của tập**. Giữ nguyên narration, các beat và measured TTS; hình ảnh thể hiện ý qua biểu cảm/hành vi/đạo cụ vật lý có lý do.
- Refactor GUI theo cấu trúc hiện có (Tauri/React), không thay framework hoặc làm lại theme/UI.

## Sửa nguyên nhân ở agent
- `tools/studio_project/agent_bridge.py`: ngừng yêu cầu “native text boards”, bỏ layout bắt buộc board trên và actor dưới; thay hướng dẫn actor-first, dùng đạo cụ phone có thật và voice anchors.
- `tools/studio_project/agent_authoring.py`: xóa generator `board_svg` và danh mục ký tự dùng để đổ chữ; canonical proposal chỉ chấp nhận existing library prop, từ chối board asset. Các receipt/preview cũ không bị xóa.
- `tests/test_studio_agent_authoring.py`: regression ngăn board proposal, không ghi art/source nếu bị từ chối.

## Migration hiện trạng tập Nhân Mã (isolated E2E store, không sửa bản production main)
- Source: `.runtime/workflow-agent-e2e/projects/episodes/studio-2b0c3a549a069efd273809f2`.
- Lệnh canonical `visual.command(..., "source.replace", ...)`, revision 3 → **4**.
- Loại bỏ 25 asset bảng / 7 thực thể bảng trong s02–s08 / 18 event điều khiển bảng; giữ 8 cảnh; thêm 3 event biểu cảm vào s02/s08 theo các lời thoại “bảy giờ…” và “để xem”.
- Nhân vật được đưa lên vùng trung tâm; không chạm caption safe zone. Visual Intent mới giữ approved narration hash `435084ff710c06969edcc2d0c81206859844ae79dc27a9b033c4f049da841bf0` và voice hash `e5f35bb23d0897bdf8a23fce95d03a7cdb203772eed82cbe2740f03806689394` (check manifest).
- Native validate PASS; compile đủ 8 scene `COMPLETED`, build `6c877c434203449b93defaf1270ebaf5`; source hash `9c6e98ce7a85d78c2eea0198fefa132a57f7d4c0cf483788e1f0040b065940cf`.
- Bản export cũ revision 2 giữ immutable để có thể đối chiếu; không coi MP4 đó là bản mới hoặc creative PASS.
- Proposal review draft/receipt: `.runtime/no-message-boards/nhanma-no-board-draft.json`, `migration-receipt.json`.

## GUI
- Tách điều hướng (sidebar, sub-tabs, episode selector) cùng helper chọn bước tiếp theo sang `apps/zodiac-studio/src/studio-navigation.tsx`.
- `App.tsx` vẫn giữ ownership selection và backend, không thêm state/registry thứ hai.
- Ưu tiên 3 menu: Kế hoạch, Episode, Tài nguyên. Voice human approval vẫn là gate, không được thay bằng TECHNICAL_VALID.
- `pnpm.cmd -C apps/zodiac-studio build` PASS.
- `node tests/studio_ideas_browser.mjs` và `node tests/studio_compact_layout.mjs` PASS với fixture backend ở 3 kích thước viewport.

## MP4 mới và kiểm tra thực tế
- Native HyperFrames export COMPLETED, revision 4, receipt ID `1ea331aa601c417f96167d4b014b657f`. Bản riêng: `.runtime/no-message-boards/episode.mp4`, 74,4 giây, 1080×1920 H.264/AAC, 4.355.619 bytes. SHA-256 `55951bef83c06dad478c342c905845dc2d5ab8e5ec05069ee20018667788205e`.
- Full FFmpeg decode PASS, MP4/SRT/cover SHA-256 đều khớp immutable receipt. File gốc/review cũ không bị ghi đè.
- Kiểm tra frame xuất thật ở 13, 28, 67,7, 68,5, 70,2 và 72,2 giây cho thấy không còn bảng chat/bảng kế hoạch. Phụ đề hiện tại giữ được tiếng Việt và highlight ở các khung có cue; frame 68,0 thiếu caption trong khi SRT có cue 67,42–68,78, cần kiểm tra khoảng trống/đồng bộ theo frame.
- **Vấn đề sáng tạo còn rõ:** các nhân vật vẫn nhỏ, đứng ít thay đổi trên nền rộng và có nhiều khoảng trống; đây là bản thử nghiệm loại bỏ bảng, chưa phải diễn xuất production. Giữ human visual/audio/video review PENDING.
- CLI lint 0 error, 13 warning; build có technical pass nhưng không chứng minh production-safe về nghệ thuật.

## Gate chưa hoàn thành
- Chưa có human listening/visual/artistic approval, chưa chạy native-Tauri GUI smoke sau refactor, chưa chứng minh acting liên tục và phụ đề không có frame gap.
- Không commit/merge/push; giữ nguyên các thay đổi ngoài phạm vi của worktree.
