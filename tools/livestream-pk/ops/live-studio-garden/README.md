# Garden — chuẩn bị phát bằng TikTok LIVE Studio

Đây là bộ tham chiếu thao tác thủ công, không phải preset import của TikTok. Không có thao tác tự go-live, không sửa cơ sở dữ liệu/đăng nhập Studio. Bỏ qua OBS theo yêu cầu.

## Nguồn và bố trí

- Khung đề xuất: **1080×1920, 30 FPS**, dọc; kiểm tra lựa chọn thực tế trong phiên bản Studio/tài khoản đang dùng. Chưa xác nhận encoder/bitrate của máy bằng thử phát nên không ghi đè cấu hình đó.
- Chỉ đưa **http://127.0.0.1:4858/?music=0.16&sfx=0.2** vào khung phát. `overlay.url` mở nhanh địa chỉ này. Cổng 4858 dùng chung cho Garden simulator và Garden thật, chỉ chạy một chế độ tại một thời điểm.
- `control.url` mở **http://127.0.0.1:4858/control** cho host; để ngoài vùng thu. Không capture cả desktop có bảng điều khiển hoặc thông tin tài khoản.
- Nếu Studio có nguồn trang web/link dùng được với localhost, chọn nguồn đó và nhập URL overlay. Nếu không có hoặc không hoạt động, mở overlay trong cửa sổ trình duyệt riêng rồi dùng nguồn thu cửa sổ có sẵn trong Studio, căn/crop phần nội dung 9:16. Tên menu/cách hỗ trợ tùy bản Studio, chưa xác nhận trực tiếp.
- Thử crop/fit bằng chính preview: không mất header Top 5, tên chậu, trạng thái cây cuối kệ. Không kéo méo hình để lấp khung. `?safe=1` chưa có xử lý riêng ở Garden; không dựa vào tham số đó.
- Giữ tên nguồn dễ phân biệt: `Garden overlay`; scene rehearsal ghi rõ `Garden SIM`. Trước phát thật phải xác nhận API `simulator:false`, không chỉ đổi tên scene.

`source-reference.json` chỉ ghi thông số đối chiếu, **không import vào Studio**.

## Âm thanh

1. Chọn một đường lấy âm Garden trong Studio: âm của nguồn web nếu hỗ trợ, hoặc âm của trình duyệt/desktop nếu thu cửa sổ. Tránh đồng thời hai đường cùng một tiếng. Mic host là đường riêng.
2. Control preview đã tắt nhạc/SFX để tránh nhân đôi. Đóng/tắt tiếng các overlay khác; chỉ giữ một nguồn phát có tiếng.
3. Nếu trình duyệt chặn autoplay, tương tác vào trang overlay rồi nghe thử. URL `music=0.16&sfx=0.2` là mức ứng dụng khởi điểm, không chứng minh mixer đã đúng.
4. Ghi thử 30–60s trong Studio nếu bản đang dùng có chức năng đó: lời host, tưới, lên LV, vòng quay, boss. Nghe lại để phát hiện mất tiếng, vọng, clip và nhạc lấn lời.
5. Thu nhỏ/chuyển cửa sổ thử xem capture có đen/đứng hình hay bị hạ FPS. Giữ cửa sổ nguồn hiển thị trong lúc phát nếu bài thử cho thấy cần.

## Kiểm tra ngoại tuyến trước khi đổi sang thật

- [ ] `GET /api/status` trả lời; đối chiếu simulator và số bot với màn control. Không dùng `npm run check` của PK để kết luận Garden đạt.
- [ ] Dùng simulator thử 1 → 12 → 48 người; lệnh `trồng`, `chăm`, `vườn`, `hái`; avatar và Top 5; chốt phiên có năm avatar.
- [ ] Tạo 4 chậu đối thủ, thử quà 50/100/500/1.000 xu và khiên. So native result, mục tiêu và cảnh đang phát bên ngoài iframe.
- [ ] Thử burst quà, boss giữa vòng quay, hết giờ boss, thắng boss, reload giữa cảnh, cây chín/buff sát hết hạn. Báo cáo audit hiện có lỗi ở các trường hợp này, nên chưa đánh dấu đạt.
- [ ] Chờ queue rỗng liên tục 6s rồi thử hồ sơ/zoom; thao tác `vườn` liên tục không che sân khấu.
- [ ] Đối chiếu preview Studio và ảnh điện thoại thật; ghi vùng bị bình luận/nút/quà của TikTok che rồi điều chỉnh nội dung. Chưa có số đo safe-area đã nghiệm thu.
- [ ] Kiểm tra capture + âm thanh trên máy phát trong 15–20 phút; không kết luận FPS từ một tab headless hoặc tab đang ẩn.

## Chuyển simulator → Garden thật đúng một lần

Phần này để thao tác khi chuẩn bị phát thật; bộ hướng dẫn không tự dừng tiến trình hoặc kết nối TikTok.

1. Kết thúc thử và sao lưu `data/garden-simulator/garden-state.json` cùng `data/garden-state.json` nếu có, đặt bản sao có timestamp. Không reset để chuyển chế độ.
2. Dừng đúng server simulator ở terminal của nó bằng Ctrl+C để flush save; xác nhận cổng 4858 đã nhả. Không mở thêm Garden thật khi sim còn giữ cổng.
3. Xác nhận username/key trong cấu hình riêng. Không chụp hoặc in key. `npm run garden` nạp `.env`, dùng data thật và có thể kết nối TikTok ngay khi startup; chỉ chạy khi đúng tài khoản và chuẩn bị kiểm tra LIVE thật. Không chạy lặp các lệnh `--online` để dò kết nối.
4. Chạy `npm run garden`; nạp lại nguồn overlay/control trên cùng địa chỉ 4858. Xác nhận `/api/status` có `simulator:false`, không còn bot mô phỏng. Không dùng `npm run live` vì đó là luồng PK khác.
5. Tài khoản host đang LIVE: dùng tài khoản phụ gửi `trồng`, `chăm`, `vườn`, thả tim, rồi kiểm tra quà được phép thử. So từng sự kiện giữa màn hình người xem, native state và cảnh trình chiếu; không dùng nút giả lập làm bằng chứng LIVE.
6. Nếu signing/rate-limit: dừng kết nối và chẩn đoán đúng tiến trình; tránh restart liên tục vì chính connect cũng có thể tốn quota. Chưa có trạng thái TikTok chi tiết trong `/api/status` Garden để thay thế việc nhìn thông báo kết nối/log riêng.

## Trạng thái lúc chuẩn bị bộ này

Ngày 2026-11-05: Studio đã cài, chưa xác nhận UI nguồn/mixer. Simulator 4858 có 12 bot đang chạy, được giữ nguyên. Kiểm thử mới 601/601 qua; audit vẫn có lỗi về thời tiết, deadline khi boss, ưu tiên cảnh và phục hồi quà. Xem [báo cáo audit](../../docs/superpowers/plans/2026-11-05-garden-prelive-audit.md).

Chưa nghiệm thu: phát từ Studio, âm thanh thật, khung điện thoại, nhận sự kiện/quà LIVE và hiệu năng khi mã hóa. Chưa sẵn sàng tuyên bố setup phát thật hoàn tất.
