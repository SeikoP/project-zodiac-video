// "Quẻ hoàng đạo": a light, always-kind daily reading, for entertainment only.
// Deterministic per (viewer, sign, day): asking again the same day returns the same reading.
// Each line comes from one of three pools — the sign's own lines, its element's lines, or generic
// ones — so two readings of the same sign still differ, and two signs rarely share a line.
import { SIGN_DATA } from './public/signs.js';
import { occasionOn } from './public/occasions.js';

const LEVELS = [['Thượng Cát', 10], ['Đại Cát', 20], ['Trung Cát', 30], ['Tiểu Cát', 25], ['Bình An', 15]];

const GENERIC = {
  love: [
    'Một tin nhắn bất ngờ làm bạn cười cả buổi.', 'Hôm nay hợp hẹn cà phê hơn là nhắn tin.', 'Nói thật lòng một lần, mọi chuyện nhẹ hẳn.',
    'Đừng đoán ý — hỏi thẳng sẽ nhận câu trả lời dễ thương.', 'Quan tâm nhỏ sẽ được đáp lại gấp đôi.', 'Người để ý bạn đang ở gần hơn bạn nghĩ.',
    'Một lời cảm ơn đúng lúc làm ấm cả tuần.', 'Hôm nay hợp gọi điện cho người thương thay vì nhắn.', 'Chuyện cũ khép lại, chuyện mới mở cửa nhẹ nhàng.',
    'Lắng nghe nhiều hơn một chút, bạn sẽ hiểu ra điều bất ngờ.', 'Một cái ôm đúng lúc giải quyết hơn mười lời giải thích.', 'Cô đơn hôm nay chỉ là khoảng lặng trước điều vui.',
    'Một tin nhắn “bạn ăn cơm chưa” hôm nay có sức nặng hơn bạn nghĩ.',
    'Đừng so sánh chuyện tình của mình với những gì thấy trên mạng.',
    'Một lời xin lỗi sớm sẽ cứu cả buổi tối.',
    'Người luôn lắng nghe bạn xứng đáng nhận một lời cảm ơn.',
    'Kỷ niệm cũ trở lại, chỉ để bạn mỉm cười thôi.',
    'Dành một buổi tối không điện thoại cho người quan trọng.',
  ],
  work: [
    'Việc dồn ứ sẽ gỡ được nếu làm cái nhỏ nhất trước.', 'Một ý tưởng thoáng qua đáng để ghi lại ngay.', 'Có người sẵn lòng giúp — chỉ cần bạn mở lời.',
    'Tập trung 25 phút, nghỉ 5 phút: hiệu quả bất ngờ.', 'Đừng ôm hết, chia việc là khôn chứ không phải yếu.', 'Lời khen sắp đến từ chỗ bạn không ngờ.',
    'Hợp học thêm một kỹ năng mới.', 'Hoàn thành một việc dở dang sẽ khiến bạn nhẹ người.', 'Họp ngắn, làm nhiều: hôm nay hợp tốc độ.',
    'Một cuộc trò chuyện ngắn mở ra hướng đi mới.', 'Sắp xếp lại bàn làm việc, đầu óc sẽ sáng theo.', 'Hỏi lại một lần cho chắc, đỡ làm lại hai lần.',
    'Một việc bạn trì hoãn lâu sẽ xong trong hai mươi phút.',
    'Viết ra ba ưu tiên trước khi mở email.',
    'Lời góp ý hôm nay tuy thẳng nhưng có ích.',
    'Đồng nghiệp đang cần một lời động viên từ bạn.',
    'Thử trình bày ý tưởng bằng một hình vẽ nhỏ.',
    'Nghỉ giải lao đúng giờ khiến buổi chiều dài hơn bạn tưởng.',
  ],
  money: [
    'Tiêu ít hơn dự tính một chút, cuối tuần sẽ thấy vui.', 'Món đồ muốn mua — đợi 24 giờ rồi hãy quyết.', 'Hợp dọn dẹp ví và các khoản đăng ký không dùng.',
    'Ghi lại chi tiêu hôm nay, bạn sẽ bất ngờ.', 'Có cơ hội kiếm thêm từ sở thích.', 'Đừng cho vay khi chưa sẵn sàng mất.',
    'Một khoản nhỏ quay về đúng lúc bạn cần.', 'So giá thêm một chỗ nữa, tiết kiệm được kha khá.', 'Hôm nay hợp để dành, không hợp để khoe.',
    'Quà tặng tự tay làm ý nghĩa hơn quà đắt tiền.', 'Kiên nhẫn là khoản đầu tư tốt nhất của bạn hôm nay.', 'Nên trả nốt khoản nhỏ còn nợ cho nhẹ lòng.',
    'Kiểm tra hoá đơn tháng này, có thể tìm ra một khoản dư.',
    'Mua thứ bền cho lâu thay vì thứ rẻ cho vui.',
    'Một bữa ăn tại nhà tiết kiệm hơn bạn nghĩ rất nhiều.',
    'Đừng mua vì sợ bỏ lỡ, hãy mua vì thật sự cần.',
    'Bán lại món đồ không dùng sẽ cho bạn một khoản nhỏ vui vẻ.',
    'Đặt ngân sách cho tuần này, chỉ cần một con số.',
  ],
  luck: [
    'Uống đủ nước và ngủ sớm — năng lượng sẽ trở lại.', 'Một bài nhạc cũ sẽ làm ngày của bạn đẹp hơn.', 'Đi bộ mười phút, đầu óc sáng ra ngay.',
    'Nhắn hỏi thăm một người bạn lâu không gặp.', 'Dọn góc làm việc, may mắn sẽ có chỗ ghé.', 'Hôm nay hợp nói “có” với một lời mời.',
    'Cười nhiều hơn, mọi việc trôi hơn.', 'Tin vào trực giác ở quyết định nhỏ.', 'Mở cửa sổ đón nắng một chút trước khi làm việc.',
    'Chụp lại một khoảnh khắc nhỏ, mai bạn sẽ thích.', 'Ăn một món bạn thích, đừng vội.', 'Gặp người lạ mỉm cười, đáp lại đi nhé.',
    'Một cuộc gọi bất ngờ mang tin vui.',
    'Đi đường quen nhưng thử rẽ vào một quán lạ.',
    'Dọn một ngăn kéo, tìm lại món đồ bạn tưởng đã mất.',
    'Một bài hát vô tình nghe thấy sẽ nhắc bạn điều quan trọng.',
    'Ra ngoài ngắm trời một phút, đầu óc nhẹ ngay.',
    'Nói lời cảm ơn với người phục vụ bạn hôm nay.',
  ],
};

const ELEMENT_LINES = {
  love: {
    fire: ['Thẳng thắn và nhiệt tình là sức hút hôm nay.', 'Đừng nóng — nói chậm lại một nhịp là vừa.', 'Một bất ngờ nhỏ làm người ấy rung động.', 'Rủ đi chơi xa, dù chỉ là quán mới.'],
    earth: ['Một bữa ăn ngon cùng nhau gần hơn ngàn lời hứa.', 'Sự đều đặn của bạn đang được ai đó trân trọng.', 'Hợp hẹn ở nơi quen thuộc, thoải mái.', 'Nhẹ nhàng, từng bước một — đúng nhịp của bạn.'],
    air: ['Trò chuyện hợp ý là bước đầu tiên hôm nay.', 'Một câu đùa đúng lúc phá băng cả buổi.', 'Chia sẻ một bài viết hay, cuộc trò chuyện sẽ nở hoa.', 'Cho nhau khoảng trống, tình cảm sẽ thở dễ hơn.'],
    water: ['Cảm xúc sâu hôm nay — hãy gọi tên nó.', 'Một cử chỉ dịu dàng nói thay cả bài văn.', 'Người hiểu bạn đang ngồi rất gần.', 'Viết ra điều muốn nói, rồi mới nói.'],
  },
  work: {
    fire: ['Dẫn đầu một việc nhỏ, cả nhóm sẽ theo.', 'Năng lượng dồi dào — dành cho việc khó nhất.', 'Đề xuất sớm, đừng đợi người khác nói trước.', 'Chạy nước rút ngắn, rồi nghỉ cho đáng.'],
    earth: ['Làm chắc từng bước, kết quả sẽ tự nói lên.', 'Lên kế hoạch cho tuần tới là hợp nhất.', 'Một quy trình gọn gàng tiết kiệm cả buổi.', 'Sự tỉ mỉ của bạn được ghi nhận.'],
    air: ['Trao đổi ý tưởng với đồng nghiệp là mỏ vàng.', 'Viết gọn lại ý chính, người nghe hiểu ngay.', 'Kết nối hai người chưa quen nhau, bạn là cầu nối.', 'Thử cách làm lạ — hôm nay hợp thí nghiệm.'],
    water: ['Trực giác tốt: tin vào cảm nhận đầu tiên.', 'Việc cần sự đồng cảm hôm nay rất hợp bạn.', 'Dành cho mình 15 phút yên tĩnh trước giờ làm.', 'Sáng tạo nhất lúc ở một mình, đừng ngại tách ra.'],
  },
  money: {
    fire: ['Cưỡng lại món muốn mua vì hứng, 24 giờ nữa xem lại.', 'Đầu tư vào trải nghiệm hơn là vật dụng.', 'Đừng chi theo cảm hứng — hãy chi theo kế hoạch.', 'Hào phóng vừa đủ, nhớ để phần cho mình.'],
    earth: ['Cất một khoản nhỏ đều đặn, quen tay là xong.', 'Kiểm tra lại các khoản chi cố định hàng tháng.', 'Món đồ bền hơn món đồ rẻ — hôm nay chọn bền.', 'Sự cẩn thận giúp bạn tránh một khoản không đáng.'],
    air: ['Tìm hiểu thêm trước khi mua: thông tin là tiền.', 'Chia sẻ mẹo tiết kiệm, bạn sẽ nhận lại mẹo hay.', 'Thử một cách quản lý chi tiêu mới cho vui.', 'Đừng để quảng cáo kéo bạn đi xa.'],
    water: ['Mua quà cho người thân sẽ làm bạn vui hơn mua cho mình.', 'Đừng chi tiêu theo tâm trạng, hãy ngủ một đêm đã.', 'Một bữa ăn tại nhà tiết kiệm và ấm hơn.', 'Biết ơn những gì đang có, bạn thấy dư dả hơn.'],
  },
  luck: {
    fire: ['Vận động một chút, may mắn chạy theo.', 'Đi sớm về sớm, hôm nay năng lượng tốt buổi sáng.', 'Nói “mình thử” trước khi nói “mình không biết”.', 'Mặc màu bạn thích, tự tin tăng gấp đôi.'],
    earth: ['Một góc nhà gọn gàng đem lại cảm giác may mắn.', 'Ra vườn, ngắm cây, hay đi chợ — hợp với bạn hôm nay.', 'Nấu một món quen thuộc, tâm trạng sẽ ổn.', 'Đi chậm lại một chút, bạn sẽ thấy điều đáng yêu.'],
    air: ['Mở một cuốn sách hoặc podcast mới.', 'Đổi đường đi làm, gặp điều bất ngờ.', 'Viết nhanh ba điều bạn biết ơn.', 'Nhắn người bạn lâu rồi chưa nói chuyện.'],
    water: ['Tắm nước ấm và nghe nhạc nhẹ, bạn sẽ ổn.', 'Gần nước (hồ, biển, ly trà) giúp bạn dịu lại.', 'Viết nhật ký năm phút trước khi ngủ.', 'Nghe theo giấc mơ đêm qua một chút.'],
  },
};

// Two lines per sign per topic: this is what keeps neighbouring signs from sounding alike.
const SIGN_LINES = {
  love: {
    aries: ['Tỏ tình trực tiếp hôm nay có kết quả dễ thương.', 'Đừng thử lòng nhau, hãy rủ nhau đi ăn.'],
    taurus: ['Sự chung thuỷ của bạn đang làm ai đó tin tưởng.', 'Món ăn ngon là ngôn ngữ tình yêu của bạn.'],
    gemini: ['Một cuộc trò chuyện dài tới khuya làm gần nhau hơn.', 'Hai cái đầu cùng nghĩ, ra ngay buổi hẹn hay.'],
    cancer: ['Người ấy thích cách bạn nhớ những chuyện nhỏ.', 'Nấu cho ai đó một bữa, tình cảm lên hẳn.'],
    leo: ['Hào phóng khen đối phương, bạn sẽ được khen lại.', 'Hôm nay bạn là tâm điểm — dùng nó dịu dàng.'],
    virgo: ['Quan tâm tỉ mỉ của bạn làm người ấy cảm động.', 'Đừng đòi hoàn hảo, hãy chọn thật lòng.'],
    libra: ['Cân bằng giữa cho và nhận, tình cảm sẽ êm.', 'Quyết định đi ăn gì giúp bạn ghi điểm lớn.'],
    scorpio: ['Một ánh nhìn của bạn nói hơn cả lời nói.', 'Mở lòng một chút, người ấy sẽ ở lại.'],
    sagittarius: ['Hẹn một chuyến đi ngắn cuối tuần, hợp lắm.', 'Thẳng thắn của bạn được xem là dễ thương.'],
    capricorn: ['Một kế hoạch nhỏ cho hai người làm tim ấm lên.', 'Nói “mình quý bạn” — ngắn gọn thôi là đủ.'],
    aquarius: ['Người hiểu sự khác biệt của bạn đang ở gần.', 'Làm bạn trước, tình yêu sẽ tự tìm đường.'],
    pisces: ['Một bài hát chung làm cả hai nhớ lâu.', 'Trực giác chuyện tình cảm hôm nay rất chuẩn.'],
  },
  work: {
    aries: ['Khởi động một dự án mới, đà đang rất tốt.', 'Làm trước, rồi tinh chỉnh sau — hợp bạn hôm nay.'],
    taurus: ['Làm đều tay, cuối ngày bạn sẽ ngạc nhiên về kết quả.', 'Đừng để ai thúc ép, bạn đang đi đúng nhịp.'],
    gemini: ['Trình bày ý tưởng bằng ví dụ vui, ai cũng nhớ.', 'Làm hai việc cùng lúc, nhưng chọn việc quan trọng trước.'],
    cancer: ['Sự quan tâm của bạn làm không khí cả nhóm êm hơn.', 'Một nơi làm việc ấm cúng giúp bạn hiệu quả hơn.'],
    leo: ['Đứng ra dẫn dắt, cả nhóm đang chờ bạn.', 'Ghi nhận công của người khác, bạn càng toả sáng.'],
    virgo: ['Soát lại lần cuối — bạn tránh được lỗi nhỏ.', 'Một danh sách gọn gàng cứu cả buổi chiều.'],
    libra: ['Hoà giải một bất đồng nhỏ, bạn thành người hùng.', 'Chọn nhanh đi, sự cân nhắc đã đủ rồi.'],
    scorpio: ['Tập trung sâu vào một việc, hiệu quả khác hẳn.', 'Nhìn ra điều người khác bỏ sót, nói đúng lúc nhé.'],
    sagittarius: ['Một ý tưởng táo bạo được hoan nghênh.', 'Học điều mới trong công việc, bạn thấy hứng thú ngay.'],
    capricorn: ['Từng bước nhỏ đang đưa bạn lên cao.', 'Cho phép mình nghỉ một lúc, năng suất sẽ tốt hơn.'],
    aquarius: ['Cách làm khác lạ của bạn đáng được thử.', 'Gửi ý tưởng cho nhóm, ai đó sẽ cùng làm.'],
    pisces: ['Sáng tạo nhất lúc yên tĩnh, tìm góc cho mình.', 'Tin vào cảm nhận, nhưng viết ra cho rõ.'],
  },
  money: {
    aries: ['Đừng mua vì hứng, chờ đến cuối ngày.', 'Một khoản nhỏ tiết kiệm được làm bạn vui hẳn.'],
    taurus: ['Mua ít đồ nhưng tốt: đúng gu của bạn.', 'Sổ chi tiêu gọn gàng giúp bạn ngủ ngon.'],
    gemini: ['So sánh vài nơi trước khi mua, bạn sẽ khá.', 'Tìm thêm nguồn thu từ ý tưởng bạn có sẵn.'],
    cancer: ['Dành một ít cho quỹ “an tâm” của mình.', 'Quà nhỏ cho người thân làm bạn thấy dư dả.'],
    leo: ['Hào phóng vừa đủ — nhớ giữ lại phần mình.', 'Đầu tư vào bản thân là lựa chọn đúng.'],
    virgo: ['Bảng tính chi tiêu hôm nay đem lại điều bất ngờ.', 'Tìm ra một khoản chi thừa để cắt giảm.'],
    libra: ['Cân đối giữa muốn và cần, bạn đã làm tốt.', 'Chọn món đẹp mà bền, không chọn món rẻ mà nhanh hỏng.'],
    scorpio: ['Một khoản đầu tư nhỏ bạn nghiên cứu kỹ sẽ có lãi.', 'Giữ kín kế hoạch tài chính, chỉ chia sẻ khi cần.'],
    sagittarius: ['Hạn chế chi cho chuyến đi bốc đồng.', 'Tiền dành cho kinh nghiệm là tiền đáng tiêu.'],
    capricorn: ['Kế hoạch dài hạn của bạn đang đi đúng hướng.', 'Thưởng cho mình một món nhỏ — bạn xứng đáng.'],
    aquarius: ['Thử một cách tiết kiệm mới lạ, bạn sẽ thích.', 'Chia sẻ chi phí chung với bạn bè, vui hơn.'],
    pisces: ['Đừng chi vì thương hại, hãy chi vì kế hoạch.', 'Dành một khoản nhỏ cho sở thích sáng tạo.'],
  },
  luck: {
    aries: ['Ra ngoài sớm, năng lượng buổi sáng thuộc về bạn.', 'Nói “để mình thử” — cánh cửa sẽ mở.'],
    taurus: ['Một bữa ăn ngon sẽ sửa cả tâm trạng.', 'Ngủ đủ giấc là bùa may mắn của bạn.'],
    gemini: ['Gặp bất ngờ qua một cuộc trò chuyện ngẫu nhiên.', 'Ghi lại ý tưởng ngay, đừng để nó bay mất.'],
    cancer: ['Về nhà sớm, ăn cơm cùng người thân.', 'Ngắm trăng tối nay, bạn sẽ dịu lại.'],
    leo: ['Mặc bộ bạn thích nhất, thế giới sáng lên.', 'Mỉm cười với người lạ, bạn nhận lại gấp đôi.'],
    virgo: ['Dọn lại một ngăn kéo, bạn thấy nhẹ cả người.', 'Đi bộ buổi chiều giúp đầu óc thoáng.'],
    libra: ['Chọn màu hợp tâm trạng, ngày sẽ đẹp.', 'Chụp lại cảnh đẹp bạn gặp hôm nay.'],
    scorpio: ['Tin trực giác đầu tiên, nó đang đúng.', 'Dành thời gian một mình: bạn sẽ sáng ra.'],
    sagittarius: ['Đổi đường về nhà — có điều thú vị chờ bạn.', 'Đặt vé một chuyến đi, dù chỉ trong tưởng tượng.'],
    capricorn: ['Làm xong một việc lâu ngày, may mắn đến liền.', 'Đi ngủ sớm: kế hoạch ngày mai sẽ rõ hơn.'],
    aquarius: ['Nói với một người bạn bất ngờ, họ sẽ vui.', 'Thử một điều chưa từng làm — chỉ một chút thôi.'],
    pisces: ['Nghe một bản nhạc yêu thích bằng tai nghe.', 'Viết ra ba điều bạn mơ, một trong số đó sắp thành.'],
  },
};

const TIPS = [
  'Chậm lại một nhịp, hôm nay không có gì phải vội.', 'Làm một việc nhỏ cho chính mình trước khi làm cho người khác.', 'Hít thở sâu ba lần trước khi trả lời tin nhắn khó.',
  'Nói lời cảm ơn sớm hơn mọi khi.', 'Đừng so sánh, mỗi người một nhịp riêng.', 'Cái bạn đang tìm có thể ở ngay chỗ quen thuộc.',
  'Mỗi ngày một việc nhỏ, cuối tuần thành điều lớn.', 'Hãy tử tế với bản thân như với bạn thân.', 'Ngủ đủ giấc là siêu năng lực.',
  'Điều bạn lo hôm nay có thể không xảy ra.', 'Một nụ cười là cách tiết kiệm nhất để cả phòng vui hơn.', 'Hôm nay hợp hỏi thêm một câu “vì sao”.',
  'Làm điều làm bạn thấy nhẹ lòng, dù nhỏ thôi.', 'Biết dừng đúng lúc cũng là một dạng giỏi.', 'Đừng quên uống nước nhé!',
  'Điều tốt đẹp đến với người biết chờ và biết làm.', 'Cho phép bản thân vui trước khi mọi việc xong.', 'Một cái ôm là liều thuốc không cần toa.',
  'Mở cửa sổ, cho ngày mới vào nhà.', 'Một bước nhỏ vẫn là một bước.', 'Nghe nhạc bạn thích, ngày sẽ nhẹ hơn.',
  'Hãy khen ai đó một câu thật lòng.', 'Hôm nay hợp bắt đầu lại một thói quen tốt.', 'Giữ lịch sự với cả những người không cần thiết.',
  'Một việc nhỏ làm xong hôm nay đáng giá hơn kế hoạch lớn để mai.',
  'Cho mình quyền nghỉ khi cần, không cần lý do.',
  'Hỏi “mình có thật sự muốn không?” trước khi nhận lời.',
  'Lời nói tử tế không tốn gì mà đáng giá rất nhiều.',
  'Hôm nay hợp dọn dẹp một thứ cũ để mở chỗ cho điều mới.',
  'Hít thở chậm, bạn đang làm tốt hơn bạn nghĩ.',
  'Đừng đợi hoàn hảo mới bắt đầu.',
  'Ngày mai là một trang trắng, tối nay chỉ cần nghỉ ngơi.',
  'Một cuốc đi bộ ngắn là liều thuốc rẻ nhất.',
  'Bạn không cần phải trả lời ngay lập tức.',
  'Đặt điện thoại xuống mười phút, thế giới vẫn ổn.',
  'Nhớ lại ba điều bạn làm tốt trong tuần.',
  'Hôm nay hợp kết thúc một việc cũ bằng một cái gật đầu nhẹ.',
  'Ai đó đang âm thầm tự hào về bạn.',
  'Ăn một bữa thật chậm, thật ngon.',
  'Mỗi người một nhịp, nhịp của bạn đang ổn.',
];

const HOURS = ['06:00–08:00', '07:00–09:00', '09:00–11:00', '10:00–12:00', '12:00–14:00', '13:00–15:00', '14:00–16:00', '15:00–17:00', '17:00–19:00', '19:00–21:00', '20:00–22:00', '21:00–23:00'];

const ELEMENT_COLORS = {
  fire: ['Đỏ san hô', 'Cam hoàng hôn', 'Vàng nắng'],
  earth: ['Xanh rêu', 'Nâu caramel', 'Be kem'],
  air: ['Xanh trời', 'Tím lavender', 'Bạc'],
  water: ['Xanh biển', 'Trắng ngọc trai', 'Tím than'],
};

// FNV-1a; good enough to spread readings around.
function hash(text) {
  let h = 2166136261;
  for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function dayKey(ms) {
  const d = new Date(ms + 7 * 3600 * 1000); // Vietnam time
  return d.toISOString().slice(0, 10);
}

export const FORTUNE_TOPICS = ['love', 'work', 'money', 'luck'];
// Number of distinct lines a topic can draw from for one sign (used by tests and the setup check).
export const poolSize = (topic, sign, element) => new Set([...GENERIC[topic], ...ELEMENT_LINES[topic][element], ...SIGN_LINES[topic][sign]]).size;

export function drawFortune({ seed, sign, element, now }) {
  let h = hash(`${seed}|${sign}|${dayKey(now)}`);
  const next = n => { const v = h % n; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return v; };
  let roll = next(100), level = LEVELS[0][0];
  for (const [name, weight] of LEVELS) { if (roll < weight) { level = name; break; } roll -= weight; }
  const line = topic => {
    const r = next(10);
    const pool = r < 4 ? SIGN_LINES[topic][sign] : r < 7 ? ELEMENT_LINES[topic][element] : GENERIC[topic];
    return pool[next(pool.length)];
  };
  const data = SIGN_DATA[sign];
  const occasion = occasionOn(dayKey(now));
  const colors = [data.color, ...ELEMENT_COLORS[element]];
  return {
    level,
    love: line('love'),
    work: line('work'),
    money: line('money'),
    luck: line('luck'),
    tip: occasion && next(100) < 35 ? occasion.tip : TIPS[next(TIPS.length)],
    color: colors[next(colors.length)],
    number: next(3) === 0 ? 1 + next(99) : data.numbers[next(data.numbers.length)],
    hour: HOURS[next(HOURS.length)],
  };
}
