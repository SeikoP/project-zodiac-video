// "Quẻ may mắn": a light, always-kind daily reading, for entertainment only.
// Deterministic per (person, day): asking again the same day returns the same reading. Nothing in it depends on a
// team, a sign or an element; two people on the same day differ because each line is drawn from the shared pools.
import { occasionOn } from './public/occasions.js';

const LEVELS = [['Thượng Cát', 10], ['Đại Cát', 20], ['Trung Cát', 30], ['Tiểu Cát', 25], ['Bình An', 15]];

const POOLS = {
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
    'Thẳng thắn và nhiệt tình là sức hút hôm nay.',
    'Một bất ngờ nhỏ làm người ấy rung động.',
    'Một bữa ăn ngon cùng nhau gần hơn ngàn lời hứa.',
    'Sự đều đặn của bạn đang được ai đó trân trọng.',
    'Một câu đùa đúng lúc phá băng cả buổi.',
    'Một cử chỉ dịu dàng nói thay cả bài văn.',
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
    'Dẫn đầu một việc nhỏ, cả nhóm sẽ theo.',
    'Đề xuất sớm, đừng đợi người khác nói trước.',
    'Làm chắc từng bước, kết quả sẽ tự nói lên.',
    'Lên kế hoạch cho tuần tới là hợp nhất.',
    'Trao đổi ý tưởng với đồng nghiệp là mỏ vàng.',
    'Dành cho mình 15 phút yên tĩnh trước giờ làm.',
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
    'Đầu tư vào trải nghiệm hơn là vật dụng.',
    'Cất một khoản nhỏ đều đặn, quen tay là xong.',
    'Kiểm tra lại các khoản chi cố định hàng tháng.',
    'Tìm hiểu thêm trước khi mua: thông tin là tiền.',
    'Đừng chi tiêu theo tâm trạng, hãy ngủ một đêm đã.',
    'Biết ơn những gì đang có, bạn thấy dư dả hơn.',
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
    'Vận động một chút, may mắn chạy theo.',
    'Mặc màu bạn thích, tự tin tăng gấp đôi.',
    'Nấu một món quen thuộc, tâm trạng sẽ ổn.',
    'Viết nhanh ba điều bạn biết ơn.',
    'Tắm nước ấm và nghe nhạc nhẹ, bạn sẽ ổn.',
    'Viết nhật ký năm phút trước khi ngủ.',
  ],
};

const NOTES = [
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

const COLORS = ['Đỏ san hô', 'Cam hoàng hôn', 'Vàng nắng', 'Xanh rêu', 'Nâu caramel', 'Be kem', 'Xanh trời', 'Tím lavender', 'Bạc', 'Xanh biển', 'Trắng ngọc trai', 'Tím than'];

export const FORTUNE_TOPICS = ['love', 'work', 'money', 'luck'];
export const FORTUNE_POOLS = POOLS;
export const FORTUNE_NOTES = NOTES;
export const FORTUNE_COLORS = COLORS;

// day: a day key ('2026-11-03') or any timestamp of that day. userId null = the room's own reading.
// topic ('love' | 'work' | 'money' | null): the viewer asked about one thing; that section comes first in `order` and
// `focus` adds two more lines on it.
export function drawFortune({ userId = null, day, topic = null }) {
  const key = typeof day === 'number' ? dayKey(day) : String(day);
  let h = hash(`${userId ?? 'room'}|${key}`);
  const next = n => { const v = h % n; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return v; };
  let roll = next(100), level = LEVELS[0][0];
  for (const [name, weight] of LEVELS) { if (roll < weight) { level = name; break; } roll -= weight; }
  const line = t => POOLS[t][next(POOLS[t].length)];
  const occasion = occasionOn(key);
  const reading = {
    level,
    love: line('love'),
    work: line('work'),
    money: line('money'),
    luck: line('luck'),
    note: occasion && next(100) < 35 ? occasion.tip : NOTES[next(NOTES.length)],
    color: COLORS[next(COLORS.length)],
    number: 1 + next(99),
    hour: HOURS[next(HOURS.length)],
  };
  reading.order = [...FORTUNE_TOPICS];
  if (!topic || !['love', 'work', 'money'].includes(topic)) return reading;
  // two more lines on the asked topic, none repeating the reading's own line on it (drawn last: the rest stays the same)
  const focus = [];
  for (let i = 0; focus.length < 2 && i < 60; i++) { const l = line(topic); if (l !== reading[topic] && !focus.includes(l)) focus.push(l); }
  return { ...reading, order: [topic, ...FORTUNE_TOPICS.filter(t => t !== topic)], topic, focus };
}
