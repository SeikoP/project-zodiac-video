# Garden — chuẩn bị phát bằng TikTok LIVE Studio

Đây là bộ tham chiếu thao tác thủ công, không phải preset import của TikTok. Không có thao tác tự go-live, không sửa cơ sở dữ liệu/đăng nhập Studio. Bỏ qua OBS theo yêu cầu.

## Nguồn và bố trí

- Khung đề xuất: **1080×1920, 30 FPS**, dọc; kiểm tra lựa chọn thực tế trong phiên bản Studio/tài khoản đang dùng. Chưa xác nhận encoder/bitrate của máy bằng thử phát nên không ghi đè cấu hình đó.
- `overlay.url` chỉ mở **preview local** tại `http://127.0.0.1:4858/?music=0.16&sfx=0.2`; không dùng URL localhost này làm Link source nếu LIVE Studio từ chối localhost.
- Với Garden thật: chạy `npm run garden`, rồi terminal thứ hai chạy **`npm run garden:share`**. Lệnh share dùng cổng local **4859 chỉ đọc** và in URL HTTPS `trycloudflare.com`; dán URL HTTPS đó vào Link source của TikTok LIVE Studio. Giữ terminal tunnel mở trong suốt buổi phát.
- `control.url` mở **http://127.0.0.1:4858/control** cho host; để ngoài vùng thu. Cổng tunnel không phục vụ control, diagnostics host hoặc API ghi.
- Simulator chỉ dùng 4858 và không mở share port. Không dùng simulator URL/tunnel làm nguồn phát thật.
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

- [x] `GET /api/status` trả lời; simulator cô lập báo đúng số người/bot và không nối TikTok.
- [x] Rehearsal tự động phủ 1 / 4 / 12 / 24 / 42 người; browser fixture đã chụp 1 và 42 người, avatar/Top 5/CTA không lỗi console.
- [ ] Tạo 4 chậu đối thủ và quan sát trực tiếp toàn bộ cảnh quà 50/100/500/1.000 xu trong **một source LIVE giữ mở**. Native result/target của mọi tier đã có test; browser đã xác nhận hậu quả 500 xu và CTA gieo lại miễn phí.
- [x] Burst quà, boss interrupt, shield/no-target/destruction và reload khi trao giải đều qua rehearsal cô lập; queue/gift/boss có regression test riêng.
- [x] Queue phụ chỉ chạy sau 6s rảnh liên tục; spam `vườn` chỉ giữ request profile mới nhất và không preempt scene chính.
- [ ] Đối chiếu preview Studio và ảnh điện thoại thật; ghi vùng bị bình luận/nút/quà của TikTok che rồi điều chỉnh nội dung. Chưa có số đo safe-area đã nghiệm thu.
- [ ] Kiểm tra capture + âm thanh trên máy phát trong 15–20 phút; không kết luận FPS từ một tab headless hoặc tab đang ẩn.

## Chuyển simulator → Garden thật đúng một lần

Phần này để thao tác khi chuẩn bị phát thật; bộ hướng dẫn không tự dừng tiến trình hoặc kết nối TikTok.

1. Kết thúc thử và sao lưu `data/garden-simulator/garden-state.json` cùng `data/garden-state.json` nếu có, đặt bản sao có timestamp. Không reset để chuyển chế độ.
2. Dừng đúng server simulator ở terminal của nó bằng Ctrl+C để flush save; xác nhận cổng 4858 đã nhả. Không mở thêm Garden thật khi sim còn giữ cổng.
3. Xác nhận username/key trong cấu hình riêng. Không chụp hoặc in key. `npm run garden` nạp `.env`, dùng data thật và tự kết nối nếu có `tiktokUsername`. Nếu chưa đặt username hoặc cần đổi phòng, dùng khối **TikTok LIVE → Kết nối / Ngắt** ngay trong control; trạng thái `connecting/live/retrying/ended` dùng chung cơ chế PK cũ. Không chạy lặp các lệnh `--online` để dò kết nối.
4. Chạy `npm run garden`; xác nhận control local 4858 có `simulator:false`, không còn bot mô phỏng. Sau đó chạy `npm run garden:share` và thay Link source trong LIVE Studio bằng URL HTTPS mới được in ra. Không dùng `npm run live`/`npm run share` vì đó là luồng PK khác.
5. Tài khoản host đang LIVE: dùng tài khoản phụ gửi `trồng`, `chăm`, `vườn`, thả tim, rồi kiểm tra quà được phép thử. So từng sự kiện giữa màn hình người xem, native state và cảnh trình chiếu; không dùng nút giả lập làm bằng chứng LIVE.
6. Nếu signing/rate-limit: xem trạng thái TikTok ngay trong control (`connecting/live/retrying/ended`) và `/api/status`; dừng kết nối trước khi chẩn đoán, tránh restart liên tục vì chính connect cũng có thể tốn quota.

## Trạng thái lúc chuẩn bị bộ này

Ngày 2026-11-05: TikTok LIVE Studio **1.39.2** và cloudflared **2026.10.7** đã có trên máy. Garden hiện dùng **42 chậu hoạt động (2 cánh × 7 hàng × 3)** để tăng kích thước chậu/cây và nhãn trên LIVE; full suite đạt **622/622** test local, catalog audio đạt **36 role / 50 sample**, rehearsal cô lập đạt **15/15** kịch bản. Browser fixture 1080×1920 đã kiểm phòng 1 người, phòng đủ 42 người và hậu quả quà 500 xu, không ghi nhận lỗi JS console. Load test còn thử 48 người đến cùng lúc và xác nhận chỉ 42 seat hoạt động. Đường `garden:share` đã được thử qua tunnel HTTPS thật: overlay trả 200, control trả 404, POST API trả 405 và status public không lộ danh sách người chơi/diagnostics host.

Chưa nghiệm thu: nguồn Link/mixer bên trong UI TikTok LIVE Studio, nghe duyệt 50 sample, khung safe-area trên điện thoại thật, nhận chat/like/quà từ TikTok LIVE thật và hiệu năng khi Studio mã hóa. Các mục này phải được kiểm tra trong buổi rehearsal/LIVE thực tế; không suy ra PASS từ test hoặc tunnel smoke.
