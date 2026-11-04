// What each hour of the show does. Two themed hours take turns by default (Hỏa ↔ Kim, 5 minutes each), and between
// them they carry all ten headliners, five each, in turn act by act, so every big event comes round within ~50 minutes.
// Thủy and Thổ keep their own entries for "real" mode or config `hourPlanets`; Hỏa and Kim took over their events. More planets can be
// added later; in "real" planetary-hour mode the other three planets borrow a theme (THEME_OF).
// Only the AUTOMATIC events are limited here; whatever a viewer types (xin quẻ, ước, nâng cấp, nhận, khoe thẻ…),
// gifts, likes and follows work in every hour.
//   allow   automatic events that may start in this hour
//   shows   the kinds of the ~75 s big moment, in turn (birth/pair/roast fall back when they can't run)
//   rules   starlight multipliers by kind ("all" = every viewer action), sharing the x3 cap with the real-sky boons
//   heads   the headliners, one per 10-minute act in turn, from headAt() minutes in until the act closes (minute 8.5)
//   quest   nhiệm vụ giờ: a goal the whole room reaches by taking part, base + per viewer on stage (HEAD_QUEST overrides it
//           while a headliner with its own goal plays)
//   cards   the card editions that drop in this hour (default: its own)
export const HOURS = Object.freeze({
  mars: {
    label: 'Sao Hỏa', glyph: '♂', color: '#E97A66', theme: 'đấu trường & thử thách', mood: 'upbeat',
    allow: { boss: true, lucky: true, quiz: true, poll: true, reading: true }, shows: ['starcall', 'meteor', 'meteor'],
    rules: { gift: 1.5, comment: 1.2, quiz: 2 }, ruleText: 'quà · bình luận · câu đố mạnh hơn',
    heads: ['elite', 'tug', 'starcatch', 'quizchain'], cards: ['h-mars', 'h-saturn'],
    quest: { stat: 'comments', base: 40, per: 6, unit: 'bình luận', reward: 'gem', rewardText: 'mưa lửa · mỗi người +1 ngọc' },
  },
  venus: {
    label: 'Sao Kim', glyph: '♀', color: '#F2A7C3', theme: 'hội ngộ & huyền bí', mood: 'upbeat',
    allow: { lucky: true, poll: true, quiz: true, reading: true }, shows: ['pair', 'roast', 'starcall', 'meteor'],
    rules: { follow: 2, share: 2, pair: 2, checkin: 2 }, ruleText: 'theo dõi · chia sẻ · chuỗi đêm x2',
    heads: ['matchmaking', 'roast', 'mystery', 'chestrain', 'moonnight', 'final'], cards: ['h-venus', 'h-mercury'],
    quest: { stat: 'blessings', base: 5, per: 1, unit: 'lời chúc phúc', reward: 'dust', rewardText: 'mưa hoa · mỗi người +10 bụi sao' },
  },
  mercury: {
    label: 'Sao Thủy', glyph: '☿', color: '#B48CF2', theme: 'trí tuệ & huyền bí', mood: 'upbeat',
    allow: { quiz: true, poll: true, reading: true, lucky: true }, shows: ['meteor', 'roast', 'starcall'],
    rules: { comment: 2, quiz: 2 }, ruleText: 'bình luận · câu đố x2',
    heads: ['quizchain', 'moonnight'],
    quest: { stat: 'correct', base: 5, per: 0.6, unit: 'câu trả lời đúng', reward: 'gem', rewardText: 'mưa sách · mỗi người +1 ngọc' },
  },
  saturn: {
    label: 'Sao Thổ', glyph: '♄', color: '#8EC0B9', theme: 'thử thách', mood: 'calm',
    allow: { reading: true, lucky: true, poll: true, quiz: true }, shows: ['starcall', 'meteor'],
    rules: { checkin: 2 }, ruleText: 'thưởng chuỗi đêm x2',
    heads: ['starcatch', 'final'],
    quest: { stat: 'catches', base: 6, per: 0.5, unit: 'sao băng hứng được', reward: 'moon', rewardText: 'vành đai sáng · mỗi người +1 mảnh trăng' },
  },
});
// The planets that take turns for now; the others stay defined above and join by being added here (or via config `hourPlanets`).
export const HOUR_PLANETS = Object.freeze(['mars', 'venus']);
export const ALL_HOUR_PLANETS = Object.freeze(Object.keys(HOURS));
// real planetary-hour mode: the planets without a theme yet borrow one
export const THEME_OF = Object.freeze({ sun: 'mars', jupiter: 'venus', moon: 'mercury' });

export const HEADS = Object.freeze({
  elite: { label: 'Boss tinh anh', icon: '☄️' },
  tug: { label: 'Kéo co cung', icon: '🪢' },
  matchmaking: { label: 'Đêm se duyên', icon: '💞' },
  roast: { label: 'Vòng quay bóc phốt', icon: '🔥' },
  chestrain: { label: 'Mưa rương', icon: '🎁' },
  quizchain: { label: 'Đố nhanh liên hoàn', icon: '🧠' },
  moonnight: { label: 'Đêm trăng', icon: '🌕' },
  mystery: { label: 'Cung bí ẩn', icon: '🕵️' },
  starcatch: { label: 'Hứng sao băng', icon: '🌠' },
  final: { label: 'Chung kết đua sao', icon: '👑' },
});
// A headliner with a goal of its own sets the act's quest while it is the act's headliner.
export const HEAD_QUEST = Object.freeze({
  starcatch: HOURS.saturn.quest,
  mystery: HOURS.mercury.quest,
  quizchain: HOURS.mercury.quest,
});

// The card edition an hour drops: one of its theme's editions, picked by r in [0, 1); null outside the hours.
export function hourEdition(planet, r) {
  if (!planet) return null;
  const h = HOURS[planet] ?? HOURS[THEME_OF[planet]];
  const eds = h?.cards ?? [`h-${HOURS[planet] ? planet : THEME_OF[planet] ?? planet}`];
  return eds[Math.min(eds.length - 1, Math.floor(r * eds.length))];
}

// minute of the act a headliner starts; `act` = the act's length in minutes
export const headAt = (id, act = 10) => act * 0.5;

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
