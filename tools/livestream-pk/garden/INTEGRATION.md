# Garden — cẩm nang tích hợp và nghiệm thu

**Nguồn tài liệu hiện hành:** [README Garden](README.md) · [Kế hoạch tích hợp/đối chiếu](../docs/superpowers/plans/2026-11-05-garden-integration-heart-hardening.md) · [Thiết kế trải nghiệm](../docs/superpowers/specs/2026-11-05-garden-complete-experience-design.md) · [Yêu cầu R01–R28](../docs/superpowers/plans/2026-11-05-garden-requirements-audit.md) · [LIVE Studio](../ops/live-studio-garden/README.md). Các kế hoạch khác trong `docs/superpowers` là lịch sử; không sử dụng để ghi đè thông số vận hành mới.

## Bản đồ các phần

| Vùng | File có trách nhiệm | Nguồn kiểm thử | Vai trò |
| --- | --- | --- | --- |
| TikTok hoặc Simulator | `garden/server.mjs`, bridge TikTok | `garden/server.test.mjs` | Nhận chat/tim/quà; giới hạn API Simulator |
| Game/kinh tế | `garden/garden.mjs`, `garden/hearts.mjs`, `garden/gifts.mjs`, `garden/boss.mjs` | `garden/hearts.test.mjs`, `garden/gifts.test.mjs`, `garden/boss.test.mjs` | Áp dụng phần thưởng đúng **một lần** |
| Điều phối camera | `garden/camera.mjs` | `garden/camera.test.mjs` | Chọn shot, ưu tiên, phạm vi, thời lượng, sceneId |
| Hàng trình chiếu | `public/garden/presentation.js` | `garden/presentation.test.mjs` | Modal quà, roulette, profile; chống lặp theo eventId |
| Canvas/UI | `public/garden/garden.js`, `view.js`, `garden.css` | `garden/view.test.mjs`, browser rehearsal | Vẽ chậu, nhãn, event, thông báo, tâm điểm |
| Âm thanh | `public/garden/audio.js`, `public/sfx.js`, `public/garden/audio/manifest.json` | `garden/audio.test.mjs`, `garden/audio-catalog.test.mjs` | Cue theo kết quả; preview mặc định mute |
| Chẩn đoán | `garden/displays.mjs`, `public/garden/control.js` | `garden/display.test.mjs`, `garden/control-heart.test.mjs` | Đối chiếu build, scene, độ mới của nguồn, FPS, hàng đợi |
| Đo hiệu năng | `garden/sim.mjs`, `scripts/garden-performance.mjs` | `garden/load.test.mjs`, benchmark JSON | CPU tick, tải trạng thái, Canvas FPS p95, heap |
| Bàn giao LIVE | `ops/live-studio-garden` | preflight + kiểm tra trực tiếp Studio | Một đường âm thanh, crop 9:16, không OBS |

## Hợp đồng sự kiện và trình chiếu

```text
TikTok/Simulator
    ↓ input
Garden Engine ──► game state, save, XP/vàng/boss (áp dụng đúng một lần)
    ↓ native eventId + receivedAt + sessionNo + plotId
Server ───────┬──► Camera Director: sceneId, eventId, travel/hold/result/done
              ├──► Coalescer → SSE/poll frame (FX + changed plots)
              └──► Gift receipts (64 sự kiện / tối đa 120s)
                                ↓
Overlay Canvas + Presentation Queue + SFX
    ↓ riêng mỗi cửa sổ, báo trạng thái qua /api/display-status
Control: nguồn LIVE/preview, scene hiện phát, thời lượng, source stale, build
```

**Không đồng nhất hai hàng đợi:** camera server quyết định cận/toàn cảnh; browser presentation điều phối roulette, impact, quà, profile. Cùng `eventId` để truy dấu, nhưng *một camera shot có thể gộp nhiều quà* trong khi browser trình bày quà độc lập. Không suy luận rằng tất cả scene có cùng thứ tự/thời lượng. Đối chiếu trường `camera.sceneId` của server với `camera.serverSceneId` mà cửa sổ phát báo về; `scene` trong heartbeat là modal/overlay và có thể khác. Trạng thái `phase` của camera gồm `travel`, `hold`, `result`, `done` (tùy thời điểm). Browser reload dùng `startedAt` tuyệt đối cho camera và checkpoint riêng cho wheel, không tái áp dụng hiệu ứng native.

**Quy tắc nguồn:** LIVE còn mới ưu tiên so với Preview; nguồn stale (>3s) hoặc sai `build` không được bật cảnh phụ. Không có LIVE quan sát được thì không được tuyên bố Studio sẵn sàng. `runtimeSourceChanged` nghĩa là source trên đĩa đã đổi so với tiến trình đang chạy: cần reload/chạy lại đúng process, không reset save.

## Cơ chế thả tim

- Trong boss: 1 tim = 1 sát thương; không đi vào thanh mốc tim của vườn.
- Ngoài boss: vòng mốc 100 tim → tăng tối đa 5% cho một cây đang lớn, 500 tim (cộng dồn) → +2,5% cho các cây đủ điều kiện, 1.000 tim → một người chơi đủ điều kiện nhận +2 vàng; lặp vòng. Trần tiền thưởng tiến độ từ tim tối đa 10%/cây.
- Tim không tạo tài khoản/chậu mới, không chiếm camera. Nếu không đủ mục tiêu, thông báo phải ghi rõ, không giả định đã nhận thưởng.
- Thử ngay tại Control bằng ba nút +100/+400/+500 tim, xem nguồn LIVE/Preview và số liệu vàng/tiến độ thực.

## Runbook simulator an toàn

1. Xác nhận cổng 4858 chưa có LIVE. **Không** vừa chạy `npm run garden` vừa chạy `npm run garden:sim`.
2. Mở `npm run garden:sim`, sau đó `http://127.0.0.1:4858/control`.
3. Trồng bằng bình luận; thử tim 100/400/500, quà 1/5/50/100/500/1000, boss, sự kiện và tải lại overlay cùng tab.
4. Xem **Camera ở server**, **Nguồn LIVE** (hoặc Preview được chọn), `sceneId`, heartbeat/stale, FPS và build. Nếu source khác build hoặc lỗi thời, làm mới nguồn phát trước khi kết luận.
5. Chạy test: `node --test garden/*.test.mjs`, `node scripts/garden-rehearsal.mjs --browser-module <module> --browser-exe <chrome>`, `node scripts/garden-performance.mjs --browser-module <module> --browser-exe <chrome> --case-seconds 6 --soak-seconds 900` (soak tốn 15 phút thời gian thật). Playwright/Chrome do máy vận hành cung cấp; không được cài phụ thuộc runtime mới.
6. Ghi `report.json`, `benchmark.json`, ảnh screenshot; so sánh thời gian khung và heap trong **cùng chế độ hiển thị**, không dùng tab ẩn làm mẫu chính.

## Phân biệt kết quả kiểm thử

- **Node pass:** gameplay, vòng đời sự kiện, serialization không lỗi ở dữ liệu thử.
- **Browser pass:** trang và Canvas render, camera, nguồn heartbeat, tên dài, responsive, không lỗi console.
- **Studio pass:** kiểm tra **thực sự** TikTok LIVE Studio có phát source đúng 9:16, safe-area hợp lý, encoder không khựng, chỉ một đường âm thanh, nghe cue và host 15–20 phút.
- **LIVE thật pass:** sự kiện chat/tim/quà từ tài khoản TikTok trên phòng thật, kết nối/khôi phục, xác thực không thưởng lặp. Không thể thay bằng mô phỏng.

Nhật ký và kế hoạch kiểm tra theo [Garden integration plan](../docs/superpowers/plans/2026-11-05-garden-integration-heart-hardening.md). **Chưa kiểm tra ở Studio/LIVE thật thì không ghi là đã hoàn tất nghiệm thu LIVE.**

## Một lệnh chăm và giữ chậu

`TikTok comment / Control / bot → garden.chat → care resolver → plant / harvest / pest / weed / water → competition + action-feedback + native event → camera/coalescer → presentation/audio`. Giữ `resolvedAction` là hành động thực tế để điểm/mốc/thông báo đúng; không tạo loại FX hay hàng đợi riêng cho `chăm`. Lệnh cũ vẫn dùng được. Chăm có mention chỉ giúp, không trồng/hái thay chủ.

Status, camera và growth dùng chung `isAwake`; không lọc tuổi tương tác 90s riêng. Chậu có chủ giữ hiển thị và lớn hết phiên. Save cũ có `sleeping` được đánh thức khi khởi tạo mà không đặt lại lastActive. Khi có người mới ở ngưỡng ceil(capacity × 6/7), chỉ thay một chậu vắng đủ evictAfterMs, ưu tiên trống rồi lâu nhất. Không có ứng viên dùng ô trống; không quét thu hồi tự động. Đổi phiên vẫn dọn theo luật session.

Kiểm cục bộ: `node --test garden/one-command.test.mjs garden/server.test.mjs garden/view.test.mjs`. Kiểm LIVE còn cần tài khoản phụ comment `chăm` trên nguồn phát thật: nhận chậu/trồng, chăm, hái, gieo lại; xác nhận phản hồi tên/chi phí, cây không biến mất khi phòng thưa, boss chuyển CTA sang tim và awards sang chờ. Không dùng simulator làm bằng chứng LIVE.
