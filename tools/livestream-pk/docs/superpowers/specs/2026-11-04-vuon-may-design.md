# Vườn Mây — thiết kế hiện hành

> Phần thiết kế nền tảng này được mở rộng bởi [thiết kế lưu chân, thi đua, âm thanh và camera 2026-11-05](2026-11-05-garden-retention-audio-camera-design.md), là nguồn chuẩn cho control, nhịp phiên LIVE, âm thanh và khung hình.

## Mục tiêu

Một khu vườn cộng đồng dễ tham gia từ những bình luận đầu tiên, vẫn có hoạt động khi phòng live ít người. Không dùng cung hoàng đạo, ngày sinh, tên cung hoặc biểu tượng cung để xếp người chơi hay trang trí gameplay.

## Thế giới

- Bốn tầng mây nằm dọc, có dây leo nối tầng để nhìn thấy đường đi lên.
- Mỗi tầng có 108 ô; toàn vườn giữ sức chứa 432 người như bản trước.
- Camera có toàn cảnh, cảnh một tầng và cận cảnh một ô.
- Bình luận đầu tiên tạo lời chào và đưa ô mới vào cận cảnh để người ít người xem vẫn có phản hồi tức thì.
- Tên tầng: Chân Mây, Vườn Gió, Nắng Vàng, Đỉnh Mây.

## Tham gia và chơi

- Bình luận đầu tiên tự nhận ô trống ở tầng ít người nhất; không cần chọn tầng.
- Nếu bình luận đầu tiên là một lệnh hợp lệ, lệnh chạy ngay sau khi nhận ô.
- Có bàn điều khiển local để thử bình luận, lệnh, quà, sự kiện và camera; simulator dùng cổng/save riêng, tắt TikTok và có thể reset độc lập.
- Lệnh ngắn trên màn hình: `trồng rau`, `tưới`, `bắt sâu`, `hái`, `trộm`, `bắt trộm`, `thả chó`, `vườn`.
- Người ít hoạt động vẫn để lại vườn cá nhân; người ghé một lần được dọn sau bảy ngày. Ô có cây không bị thu hồi để tránh mất tiến trình.
- Khi chuyển save v1, ánh xạ từng nhóm bốn đảo cũ vào một tầng, giữ ô, cây, vàng, cấp độ và lịch sử; xóa trường cung khỏi hồ sơ.

## Hình ảnh

- Dùng token `zodiac-paper-doodle-meme-v4`: Patrick Hand, giấy ấm, mực xanh xám, teal, coral và vàng đất.
- Nét chính được vẽ bằng path trong Canvas theo nguyên tắc đường viền thủ công có kiểm soát; dùng font và token sẵn có.
- Không dùng ảnh tạo sinh hoặc thêm thư viện ảnh. Hình mây, dây leo, chậu và cây là hình học được vẽ trực tiếp lúc render.
- Chuyển động chậm, ít chi tiết; banner sự kiện và HUD ở vùng riêng, không che tâm khung camera.

## Ngoài phạm vi

Chợ, nhiều ô/người, NPC, vườn phụ, mùa theo tuần và tương tác điều khiển bằng nút bấm.
