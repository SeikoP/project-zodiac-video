# Garden: một lệnh chăm

Đã được người dùng duyệt triển khai trong hội thoại: rút thao tác xuống `chăm`, liên kết toàn bộ trải nghiệm và giữ chậu khi phòng thưa.

- `chăm` trên chậu của mình: trống → mua giống cao nhất đủ LV/vàng; chín → hái; còn lại → bắt sâu, nhổ cỏ, tưới. Một comment làm một việc. Không tự bón phân. Gieo lại miễn phí vẫn chọn rau.
- `chăm @tên` chỉ giúp chăm, không mua hạt hoặc hái của người khác. Lệnh cũ còn tương thích.
- Đợt sâu cộng đồng: khi cây mình không cần dọn sâu/cỏ, `chăm` giúp dọn cây hàng xóm bị sâu. Không bỏ qua trồng/hái của mình.
- Phòng thưa giữ chậu hiển thị và tiếp tục lớn đến hết phiên. Không ngủ/thu hồi theo đồng hồ. Khi có người mới và đã dùng ít nhất ceil(capacity × 6/7), mặc định 36/42, nhường đúng một chậu vắng ít nhất evictAfterMs (mặc định 3 phút), ưu tiên chậu trống rồi người vắng lâu nhất. Không có ứng viên thì dùng ô trống; kín và không ai quá hạn thì báo đầy.
- Giữ LV/XP/vàng/thành tích khi nhường chỗ. Đổi phiên vẫn dọn theo luật hiện hành. Không đổi kinh tế, quà, boss, thời gian cây hoặc hình học.
- Mọi CTA chính, lỗi, phục hồi cây, event, simulator và demo dùng `chăm`; boss dùng tim, awards dùng chờ phiên.

## Approaches

Đã chọn một lệnh theo trạng thái thay cho ba lệnh trồng/chăm/hái. Tái dùng các hàm native để giữ điểm, mốc, quà, âm và motion đồng nhất. Thu hồi theo nhu cầu thay vì quét xóa toàn bộ chậu hết hạn để phòng thưa không mất cây.
