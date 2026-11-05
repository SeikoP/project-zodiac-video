# Garden: trải nghiệm, nhận diện và animation

## Mục tiêu

Người mới biết gõ “trồng”, thấy chậu của mình, hiểu việc tiếp theo. Người quay lại nhìn ra cấp bậc và thành tựu của mình. Host thấy chính xác việc gì đang phát, đang chờ hoặc bị chặn mà không đưa thông tin debug lên LIVE.

## Phương án thực hiện

Giữ Canvas/SVG, font Patrick Hand và palette kênh. Phục hồi đa dạng bằng silhouette, họa tiết, biến thể cây và huy hiệu; không đổi kinh tế cây hoặc thêm thư viện animation. Cách chỉ đổi màu không đủ khác biệt; bộ ảnh raster mới sẽ tăng chi phí tải và khó đồng bộ nét vẽ nên chưa dùng.

## Triển khai trong đợt này

1. **Nhận diện:** năm hình dáng chậu ở LV1/3/5/7/9, chi tiết thêm theo cấp trong mỗi bậc; ba cây × ba biến thể, phân biệt cây non và trưởng thành; huy hiệu thành tựu có ưu tiên để không chất đầy chậu.
2. **Ghi nhận:** thông báo có tên/avatar/LV và bậc chậu khi lên cấp; thông báo danh hiệu có ngữ cảnh; thêm mốc thu hoạch và hỗ trợ tích lũy. Thông báo dùng vùng sẵn có, không tạo modal mới.
3. **Chuyển động có nghĩa:** nảy nhẹ khi trồng, giọt nước khi tưới, rung ngắn khi bị tác động, nhấn mạnh chậu mới khi lên cấp. Chỉ animate cây để giữ chậu bám kệ. Đổi hạng có chuyển động vị trí, vinh danh xuất hiện lần lượt. Tất cả có bản giảm chuyển động.
4. **Top 5 + avatar:** leaderboard và control có avatar thật hoặc hình đại diện dự phòng. Lễ chốt vinh danh Top 5, thưởng XP Top 3 giữ 15/10/5; snapshot giữ avatar dù người chơi rời phòng. Save cũ thiếu avatar vẫn đọc được.
5. **Quan sát simulator:** ngoài iframe có cảnh đang phát, hàng đợi chính/phụ, thứ tự/độ tuổi yêu cầu, lý do chặn và thời gian chờ rảnh, camera server, thời tiết/boss/phiên và FPS preview. Phân biệt dữ liệu server với hàng đợi thực tế của preview. Preview mất kết nối phải báo rõ, không suy ra hàng đợi trống.

## Giữ các quy tắc đã thống nhất

- Hồ sơ và zoom phụ chờ hàng đợi chính trống 6 giây. Không khôi phục zoom khi cây chín/hái lần đầu.
- Boss dừng đồng hồ phiên và tăng trưởng; tim/quà vẫn xử lý. Quà luôn có ưu tiên.
- Dữ liệu simulator tách khỏi Garden thật. Không tự reset hoặc tăng LV/vàng người chơi để làm đẹp demo.
- Không đổi thưởng hoặc thêm loại hạt mới trong đợt phục hồi hình ảnh.

## Tiêu chí kiểm tra

- Nhìn ảnh toàn cảnh vẫn phân biệt được năm bậc chậu và ba biến thể cây; zoom cho thấy nét doodle và huy hiệu.
- Top 5 và lễ chốt có avatar; ảnh hỏng/thiếu dùng chữ viết tắt, không vỡ bố cục.
- Nhiều lệnh/quà không làm lặp animation vô hạn hoặc chồng thẻ. Kiểm tra 48 chậu và reduced-motion.
- Host nhìn bảng bên ngoài và phân biệt được đang phát/quà đang chờ/hồ sơ chờ rảnh/camera chờ; so trực tiếp với iframe khi thử 50/500/1.000 xu và boss.
- Chạy kiểm thử logic, API, tải; kiểm tra Chromium ở desktop/mobile và lưu ảnh. LIVE/OBS thật là kiểm tra riêng.

## Kế hoạch tiếp theo sau khi host quan sát

1. **Luồng người mới:** đo thời gian từ bình luận đầu đến có cây và đến nhận phản hồi; kiểm tra người mới có phân biệt “chăm”, “hái”, “vườn” mà không cần host giải thích.
2. **Độ rõ khi đông:** xem 12/24/48 người, các tên dài và avatar lỗi; ưu tiên tên/cấp/cảnh báo hơn đồ trang trí, giảm hạt hiệu ứng theo tải.
3. **Animation sự kiện:** thiết kế ba pha chuẩn bị → tác động → kết quả cho vòng quay, phá cây và boss; kết quả native phải hiển thị đúng cả khi người xem mở preview giữa cảnh. Chỉ thêm chuyển cảnh sau khi kiểm tra không che thông tin cần thao tác.
4. **Cảm giác tiến bộ:** dùng telemetry xác định danh hiệu ít xuất hiện hoặc cảnh quá ngắn; cân nhắc thêm cây/chậu mới sau khi xác định được mốc mở khóa và nhịp kinh tế phù hợp.
5. **Độ mượt thực tế:** đo FPS/độ trễ trên máy chạy OBS và mạng LIVE; chỉ tối ưu cache/LOD hoặc giảm particle khi có dấu hiệu nghẽn. Không thay bằng số đo mô phỏng.

## Kết quả kiểm tra đợt triển khai

- 601/601 kiểm thử qua với `node --test --test-concurrency=1`.
- Chromium: 48 chậu với nhiều LV/biến thể, thông báo LV/thành tựu giữ được ưu tiên, Top 5/avatar, lễ chốt có năm avatar, hàng đợi vòng quay + hai quà lớn, reduced-motion và màn hình 390px không tràn ngang; không có lỗi JavaScript.
- Ảnh kiểm tra lưu tại `logs/garden-experience-review-20261105/`: `pots-48.png`, `achievement.png`, `awards-five.png`, `queues-live.png`.
- Kiểm tra browser dùng fixture riêng; không thay LV/vàng hoặc reset phòng simulator người dùng đang chạy. LIVE/OBS thật và độ mượt trên máy phát thực tế chưa được xác nhận.
