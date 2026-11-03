// What each hour of the show does. Four themed hours rotate (Hỏa → Kim → Thủy → Thổ, one per clock hour by default),
// each with 2–3 headliners that take turns act by act, so an hour never repeats the same big event. More planets can be
// added later; in "real" planetary-hour mode the other three planets borrow a theme (THEME_OF).
// Only the AUTOMATIC events are limited here; whatever a viewer types (xin quẻ, ước, nâng cấp, nhận, khoe thẻ…),
// gifts, likes and follows work in every hour.
//   allow   automatic events that may start in this hour
//   shows   the kinds of the ~75 s big moment, in turn (birth/pair/roast fall back when they can't run)
//   rules   starlight multipliers by kind ("all" = every viewer action), sharing the x3 cap with the real-sky boons
//   heads   the headliners, one per 15-minute act in turn, from headAt() minutes in until minute 13
//   quest   nhiệm vụ giờ: a goal the whole room reaches by taking part, base + per viewer on stage
export const HOURS = Object.freeze({
  mars: {
    label: 'Sao Hỏa', glyph: '♂', color: '#E97A66', theme: 'đấu trường', mood: 'upbeat',
    allow: { boss: true, lucky: true }, shows: ['starcall', 'meteor'],
    rules: { gift: 1.5, comment: 1.2 }, ruleText: 'mọi đòn mạnh hơn',
    heads: ['elite', 'tug'],
    quest: { stat: 'comments', base: 40, per: 6, unit: 'bình luận', reward: 'gem', rewardText: 'mưa lửa · mỗi người +1 ngọc' },
  },
  venus: {
    label: 'Sao Kim', glyph: '♀', color: '#F2A7C3', theme: 'hội ngộ', mood: 'upbeat',
    allow: { lucky: true, poll: true }, shows: ['pair', 'roast', 'starcall'],
    rules: { follow: 2, share: 2, pair: 2 }, ruleText: 'theo dõi · chia sẻ x2',
    heads: ['matchmaking', 'roast', 'chestrain'],
    quest: { stat: 'blessings', base: 5, per: 1, unit: 'lời chúc phúc', reward: 'dust', rewardText: 'mưa hoa · mỗi người +10 bụi sao' },
  },
  mercury: {
    label: 'Sao Thủy', glyph: '☿', color: '#B48CF2', theme: 'trí tuệ & huyền bí', mood: 'upbeat',
    allow: { quiz: true, poll: true, reading: true }, shows: ['birth', 'roast', 'starcall'],
    rules: { comment: 2, quiz: 2 }, ruleText: 'bình luận · câu đố x2',
    heads: ['quizchain', 'chaos', 'moonnight'],
    quest: { stat: 'correct', base: 5, per: 0.6, unit: 'câu trả lời đúng', reward: 'gem', rewardText: 'mưa sách · mỗi người +1 ngọc' },
  },
  saturn: {
    label: 'Sao Thổ', glyph: '♄', color: '#8EC0B9', theme: 'thử thách', mood: 'calm',
    allow: { reading: true, lucky: true }, shows: ['starcall', 'birth'],
    rules: { checkin: 2, run: 1.5 }, ruleText: 'thưởng chuỗi đêm x2',
    heads: ['run', 'final'],
    quest: { stat: 'floors', base: 4, per: 0, unit: 'tầng trời vượt qua', reward: 'moon', rewardText: 'vành đai sáng · mỗi người +1 mảnh trăng' },
  },
});
export const HOUR_PLANETS = Object.freeze(Object.keys(HOURS));
// real planetary-hour mode: the planets without a theme yet borrow one
export const THEME_OF = Object.freeze({ sun: 'mars', jupiter: 'venus', moon: 'mercury' });

export const HEADS = Object.freeze({
  elite: { label: 'Boss tinh anh', icon: '☄️' },
  tug: { label: 'Kéo co cung', icon: '🪢' },
  matchmaking: { label: 'Đêm se duyên', icon: '💞' },
  roast: { label: 'Vòng quay bóc phốt', icon: '🔥' },
  chestrain: { label: 'Mưa rương', icon: '🎁' },
  quizchain: { label: 'Đố nhanh liên hoàn', icon: '🧠' },
  chaos: { label: 'Thủy Nghịch', icon: '🌀' },
  moonnight: { label: 'Đêm trăng', icon: '🌕' },
  run: { label: 'Hành trình Tầng Trời', icon: '🪐' },
  final: { label: 'Chung kết đua sao', icon: '👑' },
});
// minute of the act a headliner starts (a run needs longer than the others)
export const headAt = id => (id === 'run' ? 5 : 10);

// Ghép đôi: how two elements get along (entertainment only, every pairing gets a kind line).
const PAIRS = {
  'fire|fire': [86, 'hai ngọn lửa: cháy hết mình, cãi nhau cũng hết mình'],
  'earth|earth': [84, 'hai người chậm mà chắc: xây nhà từ móng'],
  'air|air': [83, 'nói chuyện không bao giờ hết đề tài'],
  'water|water': [88, 'hiểu nhau không cần nói'],
  'air|fire': [93, 'gió thổi lửa bùng: cùng nhau là quẩy'],
  'earth|water': [94, 'nước nuôi đất: êm đềm và bền lâu'],
  'earth|fire': [68, 'lửa vội, đất từ tốn: học nhau từng chút'],
  'air|water': [66, 'một người nghĩ, một người cảm: bù trừ cho nhau'],
  'fire|water': [61, 'nước và lửa: khác nhau nên càng tò mò'],
  'air|earth': [64, 'gió muốn bay, đất muốn ở: hẹn nhau giữa đường'],
};
export function pairing(elA, elB, salt = 0) {
  const [score, line] = PAIRS[[elA, elB].sort().join('|')];
  return { score: Math.max(50, Math.min(99, score + (salt % 11) - 5)), line };
}
