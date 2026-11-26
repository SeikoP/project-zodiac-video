# Studio V5: đối chiếu gói Main 1 và luồng GUI (2026-11-22)

## Phạm vi và bằng chứng
- Đọc trực tiếp `production.ir.json` trong các ZIP ở main: `ready/zodiac-bocap-im-lang-khong-co-nghia-la-khong-biet.zip`, `ready/zodiac-cugiai-nguoi-bien-su-quan-tam-thanh-cam-giac-o-nha.zip`, `ready/zodiac-maket-nguoi-thua.zip`, `ready/zodiac-songtu-gemini-too-many-tabs.zip`.
- Xem ảnh `processing/zodiac-capricorn-nguoi-thua-20261116/workspace/.authoring/S02-after.png` và `main-2/.runtime/visual-migration/nhanma-s02.png`.
- Đối chiếu `main-2/.runtime/workflow-agent-e2e/gui-evidence.json` và `reopen.json`. Đó là receipt E2E trước lần sửa GUI này, không phải phê duyệt nghệ thuật.

## Điều Main 1 làm đúng về cấu trúc
| Gói | Dẫn chứng | Điều cần giữ |
| --- | --- | --- |
| Bọ Cạp | S01 hai nhân vật đối diện, Story Object ẩn trước mốc “một chi tiết nhỏ vừa được khoanh tròn”; S02 ly bạc xỉu và hành động nhớ/phản ứng; S03 close-up một nhân vật | Sử dụng góc nhìn và vật thể như bằng chứng; reveal đồng bộ voice anchor |
| Cự Giải | S01 chiếc cốc và điện thoại thay trạng thái khi lời kể nhắc đến; S03 vật ký ức chỉ xuất hiện theo mốc | Có đồ vật đời thường và hành vi quan sát được, không áp logo/biểu tượng trừu tượng |
| Ma Kết | S01 người yêu đưa tay xách túi, Ma Kết cản và kéo túi lại; S02 Story Visual “phần của bạn: 0” | Mô tả chuỗi hành động rồi mới đến phản ứng; liên kết đạo cụ với người giữ |
| Song Tử | 15 cảnh, S02 có nhiều trạng thái, Story Text và chuyển đổi theo câu kể | Cắt/cử động theo tình huống, tránh một composition lặp xuyên cả đoạn |

Bố cục cũ thường đặt diễn xuất ở vùng giữa khung, nội dung bổ trợ ở vùng trên, phụ đề có khu vực riêng. Tuy nhiên đây **không phải** baseline chất lượng tuyệt đối: ảnh Ma Kết S02 vẫn để khoảng trống dưới lớn; cấu hình cũ có giới hạn vật lý và thiếu proof xem video liên tục.

## Chênh lệch trong Nhân Mã
- S02 sau sửa bố cục: watermark và phụ đề đã trở về; bảng chat ở phía trên, hai nhân vật phía dưới.
- Điểm yếu sáng tạo: toàn bộ đối lập “Hội bạn: Để xem” / “Người ấy: Bảy giờ, tớ qua đón” đã viết sẵn trên bảng, trong khi diễn xuất của hai người còn rất thụ động. Video dễ trở thành slide có lời đọc.
- Không áp bản gốc Main 1 bằng copy tọa độ. Dùng cấu trúc: setup trực quan → hành động/tiếp xúc → đổi trạng thái → hold phản ứng; một cảnh một trọng tâm; Story Visual/Story Text chỉ khi làm rõ beat.
- Đo bằng frame/time đã xuất ở kích thước điện thoại; clip preview kỹ thuật không thay thế nghe/xem nghệ thuật.

## GUI và agent
- Trước lần này, thanh điều hướng đã gom thành Kế hoạch / Episode / Tài nguyên, với các sub-tab của Episode. Nhưng Tiến độ vẫn render Tổng quan; stage row không mở được bước; “Tiếp theo” có thể coi TECHNICAL_VALID là đã duyệt nghe.
- Sửa lần này: Tiến độ thực sự hiển thị trạng thái concept × 12 cung; các hàng trạng thái mở bước tương ứng; điều hướng bắt buộc đi Voice Lab đến USER_LISTENED_APPROVED trước khi gợi ý làm hình.
- Receipt `.runtime/workflow-agent-e2e/gui-evidence.json` chứng minh agent proposal, scene agent edit, native export và playback thật qua GUI (tổng 833.897 giây ở phiên E2E). Human review vẫn PENDING và playback tự động bị mute.
- Không sửa nguồn Phase 1 hay đánh dấu duyệt tự động, không merge/push hay thay MP4 cũ trong lần này.

## Kiểm thử và phần còn thiếu
- `pnpm.cmd -C apps/zodiac-studio build`: PASS (TypeScript + Vite). Có cảnh báo chunk HyperFrames lớn từ Vite; không phải lỗi build.
- `node tests/studio_ideas_browser.mjs`: PASS, bao gồm sub-tab Tiến độ và 12 ô trạng thái.
- `node tests/studio_compact_layout.mjs`: PASS ở 1366×768, 1060×650 và 1093×614. Cả hai kiểm thử browser sử dụng backend fixture, không phải native-E2E mới.
- Còn thiếu: audition/điều chỉnh diễn xuất Nhân Mã theo voice anchors, kiểm tra MP4 mới sau sửa biểu cảm, real native GUI smoke sau thay đổi điều hướng, human voice/visual/video approval và xác nhận hoàn thành production.
