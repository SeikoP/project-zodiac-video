# Kế hoạch nâng cấp Đêm Hội Sao — phòng nhỏ trước

Ngày cập nhật: 2026-11-04. Đây là đề xuất và tiêu chí triển khai, chưa phải tính năng đã hoàn thành.

## Phạm vi đã thống nhất

- Ưu tiên trải nghiệm thực tế dưới 100 người; mục tiêu hỗ trợ dưới 1.000 người xem. Số người xem đồng thời khác với số tương tác mỗi giây và số hồ sơ đã lưu.
- Chưa kiểm chứng được LIVE qua OBS. Bỏ bước này khỏi điều kiện hoàn thành hiện tại, chuyển sang hướng dẫn xác nhận sau. Không mở hay cấu hình OBS trong đợt này.
- Nghiệm thu trước bằng trình duyệt local và simulator cách ly. Kết quả local không được ghi thành bằng chứng nhận sự kiện TikTok thật.
- Nâng cấp gameplay, giao diện và hiệu ứng cùng nhau. Giữ dữ liệu schema 2 hiện có; không reset kho, điểm hoặc tiến trình. Vườn Mây ngoài phạm vi.
- Benchmark 50.000 hồ sơ ở audit trước không phải yêu cầu tải mục tiêu đợt này. Giữ nguyên test, ghi nhận lỗi nền và đo riêng; không nới ngưỡng để báo đạt.

## Hướng gameplay đề xuất

### Điều chỉnh trọng tâm: một người cũng có một trải nghiệm trọn vẹn

Phản hồi mới nhất của người dùng: hiện chưa có thứ thu hút/giữ chân khi chỉ vài người vào và màn hình chính chưa ổn. Phần này thay thế đề xuất lấy boss/kéo co và giữ nguyên bố cục làm mặc định bên dưới. Chưa triển khai hoặc chứng minh hiệu quả giữ chân.

Hướng đề xuất: **sân khấu tương tác ngắn cho từng người**, sau đó mới mở rộng thành hoạt động cả phòng. Bốn đội giữ làm nhận diện và tiến trình nền; không bắt người mới hiểu cuộc đua trước khi có niềm vui đầu tiên.

Vòng trải nghiệm đầu tiên:

1. Chưa ai tương tác: mascot trung tâm đang chờ, có lời mời cụ thể “Gõ CHÀO để nhân vật chào bạn”. Lệnh này là đề xuất cần nối vào parser; không quảng bá trước khi có logic. Có thể dùng comment bất kỳ nếu giữ được lời hướng dẫn đúng.
2. Bình luận đầu: nhân vật bước ra, tên người xem xuất hiện, một phản ứng dễ nhìn và lời mời tiếp theo. Không yêu cầu chọn phe, mở kho hoặc học tài nguyên.
3. Trong 10 giây đầu sau tương tác: hiện một thử thách chỉ có một hành động, ví dụ “Gõ chữ đang sáng để hứng sao”. Tái dùng starcatch với nội dung dễ hiểu; không chờ lịch màn 2,5 phút.
4. Trong khoảng 20–40 giây: kết quả cá nhân rõ, mascot phản ứng và một dấu mốc hữu hạn. Một người hoàn thành được; không lấy số người đông làm điều kiện thắng.
5. Sau kết quả: cho thấy điều tiếp theo và thời gian ngắn đến nó, ví dụ “Tiếp theo: đoán đồ vật”. Không dùng đếm ngược giả hoặc hứa phần thưởng chưa có.

Thời gian trên là mục tiêu thiết kế để diễn tập, chưa phải số liệu hành vi người xem. Khi nhiều người cùng vào, dùng một thử thách chung và ghi nhận người tham gia theo lượt; không mở hàng loạt modal cá nhân hoặc công bố kho riêng cho cả phòng.

Không hoạt động: không tự phát thưởng hoặc giả người chơi. Sau một chu kỳ ngắn không phản hồi, trở về lời mời đơn giản; không chạy liên tục boss thất bại trên sân trống. Khi từ nhiều người còn một người, hoàn thành hoặc kết thúc vòng đang chạy có giải thích rồi quay về hoạt động chơi một mình.

Giữ chân phải đến từ phản hồi cá nhân, kết quả ngắn và sự tò mò về lượt tiếp, không chỉ tích điểm. Dấu mốc quay lại dùng tiến trình đã có; chưa thêm streak bắt buộc, tiền tệ hoặc cơ chế phạt bỏ live.

### Màn hình chính: đổi thứ tự ưu tiên, không chỉ trang trí lại

Quan sát từ source: top card đang chứa thương hiệu, rương, trăng, màn lớn, hướng dẫn đội, bảng đua, lời gọi, lời ước và nhiệm vụ. Vòng bốn phe vẫn chiếm phần chính. Đây là đánh giá cấu trúc, chưa thay thế quan sát ảnh render.

Đề xuất bố cục mới trong vùng đọc được:

```text
┌─────────────────────────────────┐
│ ĐÊM HỘI SAO      lượt đang chơi │
│ Gõ «SAO» để hứng ngôi sao này    │
├─────────────────────────────────┤
│                                 │
│      MASCOT / THỬ THÁCH CHÍNH    │
│      người vừa tham gia + tên   │
│      phản ứng / kết quả rõ      │
│                                 │
├─────────────────────────────────┤
│ Tiến độ lượt · tiếp theo sau …  │
│ Bốn đội thu gọn khi cần         │
└─────────────────────────────────┘
  Phía dưới: trang trí, chừa chat
```

- Một câu hành động lớn nhất; thương hiệu nhỏ hơn. Câu lệnh và hình minh họa không được kể hai chuyện khác nhau.
- Bỏ vai trò trung tâm cố định của bánh xe: tái dùng mascot và tài sản hình ảnh, cho hoạt động hiện tại chiếm sân khấu. Thu bảng đội thành thông tin phụ; chỉ phóng lớn khi thật sự đua phe.
- Không hiện đồng thời rương, trăng, nhiệm vụ, bảng hạng và đếm ngược khác nhau ở trạng thái đón người mới. Chỉ hiện tiến độ liên quan đến lượt hiện tại.
- Hiệu ứng kể được nguyên nhân: chữ đúng → sao bay tới nhân vật → phản ứng → kết quả. Không lấy nhiều hạt sáng làm nội dung chính.
- Không phụ thuộc âm thanh để hiểu. Chừa vùng chat; kiểm tra bản render ở kích thước điện thoại trước khi chốt font và tọa độ.

### Thứ tự ưu tiên mới

1. Dựng bản local có thể chơi một vòng trọn vẹn với đúng một người và bố cục chính mới; dùng dữ liệu simulator cách ly.
2. Kiểm tra người mới ở các thời điểm: sân trống, giữa thử thách, lúc hiện kết quả. Không cần host giải thích mới biết hành động tiếp theo.
3. Kiểm tra 2–5 rồi 20–99 người: không bỏ quên người mới, không ùn tên/hiệu ứng, không giành sân khấu với mục tiêu chính.
4. Sau đó mới mở boss/kéo co làm cao trào tùy số người thực sự hoạt động; không dùng chúng làm cửa vào bắt buộc.
5. Kiểm tra dự phòng dưới 1.000 và sửa độ ổn định song song. OBS/LIVE vẫn hoãn theo phạm vi đã thống nhất.

Tiêu chí local: một người có phản hồi sau bình luận đầu, thấy hành động kế tiếp, tự hoàn thành một lượt, thấy kết quả và hiểu lượt tiếp. Đo độ trễ thực tế; không gọi tiêu chí này là bằng chứng giữ chân. Hiệu quả giữ chân chỉ xác nhận được khi có người thật tham gia.

### Ghi chú đề xuất trước (đã hạ ưu tiên)

Giữ bốn đội màu và logic phân đội đang có. Một câu hướng dẫn thường trực: “Bình luận để vào đội · Thả tim góp sao”. Khi có sự kiện, thay bằng đúng hành động cần làm.

- 1–5 người: ưu tiên mục tiêu hợp tác và phản hồi cá nhân; không để kéo co thiếu người chặn vòng chơi. Khi không đủ điều kiện, dùng boss hoặc nghỉ giữa vòng.
- 6–20 người: cho phép kéo co khi có hai phe tham gia; mục tiêu dựa trên người thực sự hoạt động, không dựa riêng vào viewer count.
- 21–99 người: giữ cùng luật; gom hiệu ứng lặp để tên và mục tiêu vẫn đọc được.
- 100–999 người: cùng gameplay; giới hạn đối tượng hiển thị và hàng đợi hiệu ứng. Đây là mức kiểm tra dự phòng, không thêm luật hay hạ tầng riêng.

Thử vòng 3 phút, hai sự kiện mặc định là boss và kéo co. Trình tự rõ: mời tham gia → chơi → kết quả → vòng mới. Đây là thông số đề xuất cần chỉnh qua diễn tập, chưa thay lịch màn 5 phút hiện tại.

Quẻ và lời ước là hoạt động phụ. Kho và tiến trình vẫn được giữ nhưng không chen lên hướng dẫn chính. Rút các sự kiện còn lại khỏi lịch tự động trước khi quyết định xóa code; không thêm tiền tệ hoặc cơ chế mới.

## Giao diện và hiệu ứng

Giữ bố cục và mascot bốn đội hiện có, cải tiến tại chỗ:

1. Phần trên: tên vòng, thời gian, một mục tiêu; giảm chữ giới thiệu và các chỉ số cạnh tranh sự chú ý.
2. Trung tâm: một sự kiện chính, một câu lệnh; boss có thanh máu, kéo co có hướng và tiến độ rõ. Không để màn kho/quẻ che hành động quan trọng.
3. Điểm đội: màu đi cùng tên và biểu tượng, không phân biệt chỉ bằng màu. Chênh lệch và đội dẫn đầu đọc được trên điện thoại.
4. Người mới: tên và mascot xuất hiện ngay, có phản hồi “Bạn ở đội …”; thông báo bị chuyển đội phải giải thích ngắn gọn.
5. Phòng ít người: giữ sân khấu có chuyển động nền nhẹ, dùng mascot và phản hồi cá nhân làm điểm nhấn; không bịa người xem hoặc tương tác.
6. Chat/like: gom hạt sáng ngắn theo đội; quà: xướng tên và hiệu ứng theo cấp; thắng vòng: một cao trào rồi trở lại sân khấu. Ưu tiên khả năng đọc hơn số hạt.
7. Dùng director và giới hạn hiệu ứng hiện có. Hạn chế đồng thời, bỏ hiệu ứng hết hạn, không phát lại một hàng đợi cũ sau khi trang chậm.
8. Tôn trọng chế độ giảm chuyển động, tránh chớp sáng nhanh, có nút tắt âm và giữ chế độ lite. Dùng chuyển động transform/opacity khi phù hợp.
9. Panel host: ưu tiên kết nối, bắt đầu/tạm dừng, sự kiện, kết vòng. Đưa cấu hình ít dùng vào phần mở rộng; báo lỗi và trạng thái chờ rõ ràng.

## Thứ tự triển khai và tiêu chí kiểm tra

| Đợt | Phạm vi | Tiêu chí |
|---|---|---|
| 1 | Sửa vòng đời kết nối trong tiktok.mjs và test | Kết nối cũ không ghi trạng thái hay gửi hành động vào phiên mới; ngắt lúc đang kết nối vẫn ở trạng thái off |
| 2 | game.mjs, acts.mjs, events/ và test | Một sự kiện chính; vòng kết thúc được ở phòng 1–5 người; không thưởng lặp; giữ kho/tiến trình khi khởi động lại |
| 3 | public/overlay.*, play.css, director.mjs, panel | Người mới thấy đội và hành động; mục tiêu không bị hiệu ứng che; tên dài không phá khung; âm và giảm chuyển động hoạt động |
| 4 | Simulator, hướng dẫn và kiểm tra hồi quy | Diễn tập 1, 5, 20, 50, 99 người hoạt động; kiểm tra dự phòng 300 và 999, báo riêng tốc độ sự kiện; không trộn dữ liệu simulator với LIVE |

Đo thời gian xử lý, bộ nhớ, độ dài hàng đợi và độ mượt trên máy hiện tại. Đặt ngưỡng sau khi có đường cơ sở; không cam kết FPS khi chưa đo. Kiểm tra cả trang vừa mở, chạy liên tục 30 phút, đổi kích thước, lite và mở lại overlay.

Refactor theo đường đang có: nhận sự kiện → roster → registry → reward → snapshot → director/overlay. Tái dùng các module này; chỉ tách khỏi game.mjs phần có trách nhiệm rõ và đã có kiểm tra. Không viết lại engine hoặc thêm dependency để đổi giao diện.

## Hướng dẫn xác nhận phát sóng khi đã tiếp cận được

Hiện tại: chưa thực hiện, không chặn hoàn thành các đợt local nêu trên.

1. Chạy `npm run simulator`, mở `http://127.0.0.1:4850/simulator` và panel `http://127.0.0.1:4850/control` để kiểm tra local. Dữ liệu diễn tập tách khỏi LIVE; không dùng simulator URL làm nguồn phát công khai.
2. Khi có quyền truy cập công cụ phát, dùng quy trình TikTok LIVE Studio hiện có; chỉ kiểm tra OBS nếu thực sự chọn dùng OBS. Không cần chuyển công cụ chỉ để nghiệm thu.
3. Kiểm tra nguồn overlay 1080×1920, chữ và mục tiêu trong vùng nhìn thấy, mô phỏng vùng chat che phía dưới; sau đó quan sát trên điện thoại thật. Safe zone local chỉ là kiểm tra sơ bộ.
4. Khi tài khoản đã LIVE, dùng tài khoản phụ gửi chat và like; đối chiếu log nhận → đội/điểm → overlay. Kiểm tra quà khi có điều kiện, ghi riêng nếu chưa thử.
5. Kiểm tra ngắt/kết nối lại và đổi tài khoản. Ghi kết quả thực tế, không suy ra từ trạng thái connected hoặc test mô phỏng.
