# Vườn Mây — thi đua, âm thanh và khung hình

## Ý định

Giúp người xem có mục tiêu ngay cả khi phòng live chỉ có một vài người. Bổ sung thi đua cá nhân theo phiên, danh hiệu tích lũy, nhạc/hiệu ứng lấy từ bộ PK hiện có, khung hình rộng dễ theo dõi, và một control hoạt động rõ ràng. Garden vẫn dùng bốn tầng mây và token nét vẽ của kênh; không quay lại cơ chế cung hoàng đạo.

## Căn cứ trong dự án

- Garden hiện có chăm cây, thu hoạch, giúp người khác, bắt sâu, sự kiện và camera tự động. Overlay hiện chỉ có header, banner, log và canvas; chưa có HUD xếp hạng hay mục tiêu cá nhân.
- Game PK trong repo đã có nhiệm vụ theo phiên, số MVP/danh hiệu giữ lâu dài, và bảng xếp hạng đội có podium. Garden sẽ mượn cách hiển thị tiến độ cá nhân và vinh danh, không nhập cơ chế chia đội vào vòng lặp chăm cây.
- Bài giới thiệu lịch sử KVTM mô tả tiến tầng, cây phát triển theo thời gian, nhiệm vụ và giúp bạn bè. Các ý này giữ chất nông trại xã hội, không sao chép hình ảnh hay nội dung của game gốc: [VietnamNet — Khu Vườn Trên Mây trên ZingMe](https://vietnamnet.vn/gioi-thieu-game-khu-vuon-tren-may-tren-zingme-i346005.html).
- Nhạc Mixkit dùng chung nằm trong `assets/music`; SFX đã có pack, manifest và giấy phép trong `public/sfx` và `public/sfx/LICENSES.md`/`assets/music/livestream/LICENSES.md`.

## Các hướng đã cân nhắc

1. **Đua theo từng phiên LIVE, danh hiệu giữ lâu dài — chọn.** Người mới có cơ hội lên podium mỗi buổi; thành tích cá nhân tiếp tục tích lũy. Phù hợp phòng ít người và cấu trúc game PK hiện tại.
2. Bảng tuần cùng danh hiệu lâu dài. Tạo lý do quay lại giữa nhiều buổi, nhưng người mới khó bắt kịp người chơi hoạt động thường xuyên.
3. Đua đội/PK. Có cao trào khi đông người, nhưng mất ý nghĩa với một hoặc hai người và buộc phải thêm vai trò đội vào Garden.

## Thiết kế đề xuất

### Thi đua và danh hiệu

- Phiên tự bắt đầu khi có người chơi đầu tiên. Host có thể chốt podium và mở phiên mới từ control. Phiên hiện tại cùng điểm số được lưu qua lần khởi động lại để restart giữa buổi không xóa thứ hạng.
- Điểm phiên thưởng cho hành động trong game: vào vườn lần đầu, gieo, chăm cây, giúp người khác, bắt sâu, thu hoạch và bảo vệ vườn. Quà không cộng điểm xếp hạng; các cooldown hiện có tiếp tục giới hạn spam. Bảng xếp hạng phá hòa theo số lượt thu hoạch rồi thời điểm đạt điểm.
- Top 3 được chốt thành danh hiệu cá nhân vĩnh viễn. Danh hiệu thành tựu khác đến từ mốc chơi như thu hoạch đầu tiên, giúp nhiều người và bắt sâu; danh hiệu chỉ trang trí, không làm lệch kinh tế vàng/XP.
- HUD cho thấy top 3, điểm phiên và mục tiêu gần nhất. Nếu chỉ có một người, hiển thị người đó đang dẫn đầu và bước kế tiếp để nhận danh hiệu, thay vì để bảng trống.

### Một cổng và control

- Garden thường và simulator dùng cùng cổng mặc định `4858`; chỉ chạy một chế độ tại một thời điểm. Simulator vẫn tắt TikTok và dùng save riêng. Bỏ các listener Garden phụ `4859`, `4860`, `4861`; overlay và control cùng ở `http://127.0.0.1:4858/` và `/control`.
- Trên simulator, lệnh, quà, sự kiện, camera và reset phải thao tác được. Trên Garden thường, không cho giả lập viewer/quà; control vẫn dùng để theo dõi và chốt/mở phiên. Giao diện luôn chỉ rõ mode và trạng thái kết nối.
- Không đưa tunnel/OBS vào phần triển khai này; đường OBS/LIVE chưa được xác nhận theo yêu cầu trước đó.

### Âm thanh

- Dùng lại `createMusic` và `createSfx` của game PK cùng các file nhạc/SFX đã có; không chép trùng asset và không tạo âm thanh mới.
- Garden phát nhạc nền ở mức nhỏ, crossfade giữa các track có sẵn; SFX chỉ gắn với các mốc rõ như người mới vào, gieo/thu hoạch, podium và sự kiện. Giữ mute/volume query hiện có để host kiểm soát âm thanh OBS.

### Camera và giao diện

- Idle mặc định đặt tâm ở giữa cả bốn tầng, dùng khung toàn vườn thay vì xoay quanh một tầng. Sự kiện/cá nhân dùng khung tầng hoặc ô ở mức vừa; bỏ cận cảnh tới 2.5x và thay bằng viền sáng/đốm hiệu ứng để đánh dấu tâm điểm.
- Thêm HUD giấy thủ công có thứ hạng phiên, danh hiệu vừa mở, tình trạng sự kiện và lời nhắc lệnh ngắn. Mỗi tầng có điểm nhận diện/đồ trang trí vẽ bằng Canvas (cột mốc mây, đèn lồng, dây leo, bảng gỗ và bụi cây), giữ khoảng trống giữa để camera không che sự kiện.
- Chỉ dùng token `zodiac-paper-doodle-meme-v4`, font, hình học Canvas và asset sẵn trong repo; không tạo ảnh, không thêm thư viện.

## Ngoài phạm vi

Kết nối TikTok LIVE thật, kiểm tra OBS, tunnel công khai, cơ chế chia đội, chợ/vật phẩm mới, và thay đổi cân bằng quà. Không xóa dữ liệu Garden hiện có; thay đổi schema phải giữ vàng, cây, cấp độ, lịch sử và lưu danh hiệu mới an toàn.

## Cần duyệt

Đây là thay đổi nhiều phần, đụng state lâu dài, control/server port, overlay audio và camera. Chưa sửa code theo tài liệu này. Cần duyệt thiết kế trước khi lập kế hoạch và triển khai.
