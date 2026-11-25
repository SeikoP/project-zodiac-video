# Audit 2026-11-25: gói video main1 so với main2/HyperFrames, asset biểu cảm, e2e GUI

Chỉ đọc + chạy thử. Không sửa nguồn, không duyệt hộ người dùng. Human voice/visual/video gate: PENDING.

## 1. Main1 dùng gì (đo từ 24 `production.ir.json` trong `.zodiac-work/v2/jobs`)

| Hạng mục | Số liệu main1 | Main2/HyperFrames hiện tại |
| --- | --- | --- |
| Quy mô | 24 job, 180 scene, 787 entity, 754 event | Dựng được Nhân Mã (8 scene) |
| Motion | `state_swap` 475/754 (+8f/10f/12f), slide 54, pop-in 43, fade-out 41, subtle-tilt 39, fade-in 25, small-bounce 15, focus-shift 7, hold 10 | Đủ: 9 motion trong registry trùng toàn bộ tập này. Chưa có lean/recoil/camera (xem kế hoạch acting) |
| Trigger | `voice_anchor` 751, `scene_start` 3 | Hỗ trợ `voice_anchor`/`scene_start`/`scene_end` |
| Cover | 24/24 có `publish.cover`, 16/24 có `opening`, 18 có `design` | **CHƯA hỗ trợ**: `visual_compiler.mjs:33-34` chặn mọi `cover` khác rỗng (`VISUAL_COVER_*_UNSUPPORTED`); cover = frame đầu của MP4 |
| Nhạc/SFX | `assets/music` có 3+ mp3; v2 trộn `amix` 0.2 | **CHƯA hỗ trợ**: chặn `audio/music/sfx` (`VISUAL_AUDIO_MIX_UNSUPPORTED`); export chỉ `approved-voice-only@1`; chưa có node AUDIO_MIX |
| Publish | `publish.json` 24/24 (title 21, hashtags 24, retention 7), `publish-copy.txt` | Chưa có writer publish trong Studio (node `BLOCKED` theo kế hoạch production graph) |
| Asset nhóm | environment 83, effects 36, overlays 25, story-text 40, lettering 7, narrative-visuals ~26, native-props 14, characters 235 | Còn phải xác nhận từng nhóm: environment/effects/overlays chưa thấy `environment` trong `visual_compiler.mjs`; chưa kiểm story-text/overlay trong HyperFrames |
| Spatial | `spatial_bindings` 133 scene, `occlusion_relations` 57, `performance_context` 97 | `spatial_bindings` có (`visual_workspace.py`, `visual_candidates.mjs`); `occlusion_relations` chỉ thấy trong renderer Remotion 2.0.1; `performance_context` chưa thấy dùng |
| Importer | Job Remotion (`render-plan.json`, `production.ir.json`) | Chỉ nhập handoff Phase 1; **không có importer** cho job Remotion cũ |

Chưa xác minh được trong lượt này (grep bị quá thời gian): nhóm `performance_context`, `occlusion_relations`, `effects/overlay` ở compiler main2. Cần đọc tiếp trước khi kết luận.

Còn thiếu / chưa xử lý (xếp theo ảnh hưởng tới video):
1. Cover opening + thiết kế cover (24/24 job) — chưa có painter, publish manifest, test pixel.
2. Nhạc nền/SFX + ducking — chưa có node AUDIO_MIX, registry bản quyền.
3. Publish copy/hashtags/retention — chưa có writer.
4. Environment/effects/overlay/story-text — cần kiểm tra mapping sang HyperFrames.
5. Diễn xuất: Nhân Mã S03/S04/S06 `ACTING_BEATS_SPARSE`; main1 có chuỗi hành động hơn.
6. Native GUI e2e sau contract @3: chưa chạy lại (xem mục 3).

## 2. Kho asset nhân vật (library v4, `catalog.json` 4.7)

Hiện có: 19 biểu cảm, 34 pose, 18 kiểu tóc, 6 body, 2 outfit, 4 màu áo, **1 face profile**. Toàn bộ cùng một khung mặt/da, chỉ đổi tóc/áo, nên cảnh dễ lặp.

Render bảng 19 biểu cảm: `.runtime/gui-e2e-20261125/expressions.html`.

Sổ biểu cảm quá lố (đề xuất sửa/giảm cường độ, chưa sửa):
| id | Vấn đề |
| --- | --- |
| `meme-sob` | miệng há to + hai dòng nước mắt dài, quá kịch |
| `meme-cringe` | mắt `> <` + răng nghiến, nghiêng về hoạt hình |
| `meme-grimace` | cười nhe răng + mồ hôi, gượng quá đà |
| `meme-panic`, `panic` | mắt/miệng tròn lớn so với phong cách mặt tối giản còn lại |

Nên giữ: `neutral`, `deadpan`, `smug`, `side-eye`, `relieved`, `exasperated`, `embarrassed`, `weary`, `meme-deadpan`, `meme-side-eye`, `meme-confused`, `meme-drained` (kiểm lại độ đậm nét).

Hướng làm mới, giữ nguyên ID để hash/compiler không vỡ: thêm face profile, tông da, tỷ lệ đầu/thân, biểu cảm nhẹ hơn (khóe mắt, lông mày, miệng lệch), bộ tóc/phụ kiện mới; từng lô phải được người dùng duyệt trên ảnh thật.

## 3. e2e Nhân Mã qua GUI

Đã làm: mở app Tauri thứ hai (`.runtime/gui-e2e-20261125`, projects cách ly, CDP port 9227, không đụng cửa sổ đang chạy của người dùng). GUI lên bình thường, "Project Core kết nối".

Phát hiện khó dùng đầu tiên (trạng thái rỗng):
- Vùng trái hiện mãi "Đang tải luồng sản xuất…" dù chưa có episode, không có hướng dẫn.
- Có 2 nút nhập (góc phải và giữa màn hình) cùng chức năng; nhãn khác nhau ("Nhập episode" / "Nhập nội dung đã duyệt").
- "Chạy tự động" mờ không giải thích vì sao; nút "Xác nhận từng đề xuất · bấm để đổi sang Tự động" khó hiểu.
- Panel "Cần bạn" luôn nói "Không cần bạn lúc này" dù bước đầu tiên là nhập ZIP.

Bị chặn: nút nhập mở hộp thoại file gốc của Windows; computer-use không điều khiển được app này (không có trong danh sách Start menu), CDP không đụng được hộp thoại. Gọi thẳng RPC `projects.import` qua CDP bị hệ thống chặn nên không thực hiện. Chưa import, chưa build, chưa export. Cần người dùng chọn cách tiếp tục (xem báo cáo trong chat).
