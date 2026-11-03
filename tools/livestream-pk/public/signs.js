// Reference data for the 12 signs, used by the quiz, the daily reading and the "did you know" cards.
// Dates, elements, modalities and traditional rulers are the ones several Vietnamese sources agree on
// (they differ by a day at the edges, so quizzes only ever ask about dates well inside a range).
// Lucky colours/numbers and compatible signs are entertainment-grade, taken from common lists.
// Shared by the server (Node) and the overlay (browser).

import { PROFILES, PROFILE_LABELS } from './profiles.js';

export const MODES = { cardinal: 'Khởi xướng', fixed: 'Kiên định', mutable: 'Linh hoạt' };
export const ELEMENT_LABEL = { fire: 'Lửa', earth: 'Đất', air: 'Khí', water: 'Nước' };

export const SIGN_DATA = {
  aries: {
    en: 'Aries', from: [21, 3], to: [19, 4], symbol: 'Cừu đực', mode: 'cardinal', planet: 'Sao Hỏa', color: 'Đỏ', numbers: [1, 9],
    match: ['leo', 'sagittarius', 'gemini'], opposite: 'libra',
    lines: ['Lao lên trước, nghĩ sau — mà toàn về nhất.', 'Cung mở màn của cả vòng hoàng đạo, đi đâu cũng nổi.', 'Nóng nhanh, mau nguôi, rủ ăn bánh tráng là xong.', 'Thích bắt đầu mọi thứ, hơi lười đoạn kết.', 'Gặp thử thách là mắt sáng như gặp bạn cũ.'],
  },
  taurus: {
    en: 'Taurus', from: [20, 4], to: [20, 5], symbol: 'Bò đực', mode: 'fixed', planet: 'Sao Kim', color: 'Hồng', numbers: [2, 6],
    match: ['virgo', 'capricorn', 'cancer'], opposite: 'scorpio',
    lines: ['Chậm mà chắc, đã giữ là không buông.', 'Yêu đồ ăn ngon và chiếc giường êm hơn mọi kế hoạch.', 'Đổi ý rất khó, nhưng đã tin là tin tới cùng.', 'Biết hưởng thụ — và hiếm khi tiêu bậy.', 'Bình tĩnh cho tới khi ai đó đụng vào chuyện ăn.'],
  },
  gemini: {
    en: 'Gemini', from: [21, 5], to: [20, 6], symbol: 'Cặp song sinh', mode: 'mutable', planet: 'Sao Thủy', color: 'Vàng', numbers: [3, 5],
    match: ['libra', 'aquarius', 'aries'], opposite: 'sagittarius',
    lines: ['Hai cái đầu, một trăm ý tưởng.', 'Nói chuyện với ai cũng như quen từ kiếp trước.', 'Chán nhanh nhưng học cũng nhanh không kém.', 'Một phút trước còn nghiêm túc, phút sau đã đùa.', 'Tab trình duyệt luôn mở nhiều hơn ví tiền.'],
  },
  cancer: {
    en: 'Cancer', from: [21, 6], to: [22, 7], symbol: 'Con cua', mode: 'cardinal', planet: 'Mặt Trăng', color: 'Xanh lá', numbers: [4, 6],
    match: ['scorpio', 'pisces', 'taurus'], opposite: 'capricorn',
    lines: ['Vỏ cứng bên ngoài, trái tim mềm bên trong.', 'Nhớ sinh nhật của tất cả mọi người, kể cả người cũ.', 'Nấu ăn là cách nói “tớ thương cậu”.', 'Cảm xúc lên xuống theo trăng, nhưng luôn quay về nhà.', 'Đi ngang cho an toàn, nhưng đến đích thì chắc.'],
  },
  leo: {
    en: 'Leo', from: [23, 7], to: [22, 8], symbol: 'Sư tử', mode: 'fixed', planet: 'Mặt Trời', color: 'Vàng', numbers: [1, 4, 6],
    match: ['aries', 'sagittarius', 'libra'], opposite: 'aquarius',
    lines: ['Sân khấu này sinh ra để Sư Tử toả sáng.', 'Hào phóng, ấm áp, và rất cần một tràng pháo tay.', 'Làm thủ lĩnh không cần xin phép.', 'Tóc luôn đẹp kể cả lúc không ai nhìn.', 'Nói “không sao đâu” nhưng nhớ rất lâu.'],
  },
  virgo: {
    en: 'Virgo', from: [23, 8], to: [22, 9], symbol: 'Trinh nữ', mode: 'mutable', planet: 'Sao Thủy', color: 'Xám', numbers: [2, 5, 7],
    match: ['taurus', 'capricorn', 'scorpio'], opposite: 'pisces',
    lines: ['Chi tiết nhỏ nhất cũng không lọt khỏi mắt.', 'Có sẵn danh sách cho mọi thứ, kể cả danh sách danh sách.', 'Hay lo xa, nhưng nhờ vậy mà chuyến đi nào cũng suôn sẻ.', 'Giúp người khác rất tận tâm, tự khen mình thì ngại.', 'Sắp xếp lại bàn của bạn trong đầu ngay khi bước vào phòng.'],
  },
  libra: {
    en: 'Libra', from: [23, 9], to: [22, 10], symbol: 'Cái cân', mode: 'cardinal', planet: 'Sao Kim', color: 'Hồng phấn', numbers: [6, 15],
    match: ['gemini', 'aquarius', 'leo'], opposite: 'aries',
    lines: ['Cân bằng mọi thứ… trừ việc chọn ăn gì.', 'Ghét cãi nhau, nhưng khéo hoà giải nhất vòng tròn.', 'Có mắt thẩm mỹ, mua đồ chọn rất lâu.', 'Luôn thấy hai mặt của vấn đề, đôi khi hơi nhiều mặt.', 'Dễ thương với tất cả, và thật sự có ý đó.'],
  },
  scorpio: {
    en: 'Scorpio', from: [23, 10], to: [21, 11], symbol: 'Bọ cạp', mode: 'fixed', planet: 'Sao Hỏa', color: 'Tím', numbers: [3, 4, 8], aka: ['Thiên Yết', 'Hổ Cáp', 'Thần Nông'],
    match: ['cancer', 'pisces', 'virgo'], opposite: 'taurus',
    lines: ['Im lặng là chiến thuật, không phải đầu hàng.', 'Ít nói nhưng nhìn ra tất cả mọi thứ.', 'Đã tin ai thì trung thành đến cùng.', 'Bí ẩn, và rất thích mọi người đoán sai.', 'Cảm xúc sâu như đáy hồ, ít ai thấy được.'],
  },
  sagittarius: {
    en: 'Sagittarius', from: [22, 11], to: [21, 12], symbol: 'Cung thủ', mode: 'mutable', planet: 'Sao Mộc', color: 'Xanh dương', numbers: [3, 5, 8], aka: ['Cung Thủ', 'Xạ Thủ'],
    match: ['aries', 'leo', 'aquarius'], opposite: 'gemini',
    lines: ['Bắn mũi tên thật xa rồi chạy theo phiêu lưu.', 'Lạc quan đến mức cả nhóm bị lây.', 'Nói thẳng, mau quên, ít khi giận lâu.', 'Vali luôn để sẵn, vé rẻ là đi.', 'Học cái gì cũng bằng cách đi thử.'],
  },
  capricorn: {
    en: 'Capricorn', from: [22, 12], to: [19, 1], symbol: 'Dê biển', mode: 'cardinal', planet: 'Sao Thổ', color: 'Nâu', numbers: [6, 8, 9], aka: ['Nam Dương'],
    match: ['taurus', 'virgo', 'pisces'], opposite: 'cancer',
    lines: ['Leo từng bước, đỉnh nào cũng chinh phục.', 'Làm việc như đang chạy marathon — và thắng.', 'Càng lớn tuổi càng trẻ ra, càng nhiều kế hoạch.', 'Ít nói chuyện phiếm, nhưng hứa là làm.', 'Hài hước kiểu khô, chỉ ai thân mới hiểu.'],
  },
  aquarius: {
    en: 'Aquarius', from: [20, 1], to: [18, 2], symbol: 'Người mang nước', mode: 'fixed', planet: 'Sao Thổ', color: 'Xanh ngọc', numbers: [4, 7],
    match: ['gemini', 'libra', 'sagittarius'], opposite: 'leo',
    lines: ['Khác người chính là siêu năng lực.', 'Bạn bè khắp nơi, nhưng cần đủ không gian riêng.', 'Ý tưởng đến trước thời đại ba bước.', 'Thân thiện với cả thế giới, khó đoán với chính mình.', 'Đã nghĩ khác thì đừng ai mong nghĩ giống.'],
  },
  pisces: {
    en: 'Pisces', from: [19, 2], to: [20, 3], symbol: 'Hai con cá', mode: 'mutable', planet: 'Sao Mộc', color: 'Trắng', numbers: [3, 7],
    match: ['cancer', 'scorpio', 'capricorn'], opposite: 'virgo',
    lines: ['Mơ mộng thôi, chứ trực giác thì không đùa.', 'Thấm cảm xúc của người khác như miếng bọt biển.', 'Sáng tạo đến lúc nửa đêm là lúc hay nhất.', 'Tốt bụng tới mức quên mất mình cũng cần được giúp.', 'Một bài nhạc đúng lúc là đủ làm trọn một ngày.'],
  },
};

// Day-of-month ranges, for quizzes: dates safely inside a sign's range (never on the edge).
export function insideDates(id) {
  const { from, to } = SIGN_DATA[id];
  const pad = d => d;
  const daysIn = m => [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const addDays = ([d, m], n) => { d += n; while (d > daysIn(m)) { d -= daysIn(m); m = m % 12 + 1; } return [d, m]; };
  const subDays = ([d, m], n) => { d -= n; while (d < 1) { m = m === 1 ? 12 : m - 1; d += daysIn(m); } return [d, m]; };
  return [addDays(from, 5), subDays(to, 5)].map(([d, m]) => `${pad(d)}/${m}`);
}

// "Did you know" cards per sign for quiet moments. `lap` rotates which items of each list are shown,
// so the same sign's card reads differently the next time round.
const pick = (list, n, lap) => Array.from({ length: Math.min(n, list.length) }, (_, k) => list[(k + lap * n) % list.length]);
export function factCards(id, labelOf, elementOf, lap = 0) {
  const s = SIGN_DATA[id], p = PROFILES[id];
  const el = ELEMENT_LABEL[elementOf(id)];
  return [
    `${s.symbol} · nguyên tố ${el} · nhóm ${MODES[s.mode]}`,
    `Hợp với ${s.match.slice(0, 2).map(labelOf).join(', ')} · đối cung ${labelOf(s.opposite)}`,
    `Chủ tinh ${s.planet} · màu may mắn ${s.color.toLowerCase()} · số ${s.numbers[0]}`,
    `${PROFILE_LABELS.strengths}: ${pick(p.strengths, 3, lap).join(' · ')}`,
    `${PROFILE_LABELS.quirks}: ${pick(p.quirks, 2, lap).join(' · ')}`,
    `${PROFILE_LABELS.love}: ${pick(p.love, 1, lap)[0].toLowerCase()}`,
    `${PROFILE_LABELS.jobs}: ${pick(p.jobs, 3, 0).join(' · ').toLowerCase()}`,
  ];
}
