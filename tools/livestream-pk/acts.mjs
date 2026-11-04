// Màn: the show runs in acts of 5 minutes that take turns, Đấu trường then Hội ngộ. Minute 0 opens the act,
// the act's headliner plays from the middle of it (headAt) until the close (minute 4.25), and the last stretch
// crowns the act's MVP. Pure data and arithmetic: the game decides what each headliner does.
//   label   the act's name on screen
//   heads   its headliners, one per act in turn (each visit of the act moves on to the next)
//   quest   nhiệm vụ Màn: a goal the whole room reaches by taking part, base + per viewer on stage
//           (HEAD_QUEST overrides it while a headliner with its own goal plays)
export const ACTS = Object.freeze([
  {
    id: 'arena', label: 'Đấu trường', color: '#E97A66',
    heads: ['elite', 'tug', 'starcatch', 'quizchain'],
    quest: { stat: 'comments', base: 40, per: 6, unit: 'bình luận', reward: 'gem', rewardText: 'mưa lửa · mỗi người +1 ngọc' },
  },
  {
    id: 'reunion', label: 'Hội ngộ', color: '#F2A7C3',
    heads: ['roast', 'guessobject', 'chestrain', 'moonnight', 'final'],
    quest: { stat: 'blessings', base: 5, per: 1, unit: 'lời chúc phúc', reward: 'dust', rewardText: 'mưa hoa · mỗi người +10 bụi sao' },
  },
]);

export const HEADS = Object.freeze({
  elite: { label: 'Boss tinh anh', icon: '☄️' },
  tug: { label: 'Kéo co 2 phe', icon: '🪢' },
  roast: { label: 'Vòng quay may mắn', icon: '🎡' },
  guessobject: { label: 'Đoán vật', icon: '🕵️' },
  chestrain: { label: 'Mưa rương', icon: '🎁' },
  quizchain: { label: 'Đố nhanh liên hoàn', icon: '🧠' },
  moonnight: { label: 'Đêm trăng', icon: '🌕' },
  starcatch: { label: 'Hứng sao băng', icon: '🌠' },
  final: { label: 'Chung kết đua phe', icon: '👑' },
});

// A headliner with a goal of its own sets the act's quest while it is the act's headliner.
export const HEAD_QUEST = Object.freeze({
  starcatch: { stat: 'catches', base: 6, per: 0.5, unit: 'sao băng hứng được', reward: 'moon', rewardText: 'vành đai sáng · mỗi người +1 mảnh trăng' },
  guessobject: { stat: 'correct', base: 5, per: 0.6, unit: 'câu trả lời đúng', reward: 'gem', rewardText: 'mưa sách · mỗi người +1 ngọc' },
  quizchain: { stat: 'correct', base: 5, per: 0.6, unit: 'câu trả lời đúng', reward: 'gem', rewardText: 'mưa sách · mỗi người +1 ngọc' },
});

// minute of the act a headliner starts: half of the act (`act` = the act's length in minutes)
export const headAt = (id, act = 5) => act * 0.5;

// The act at time t (ms): a plain rotation, one act per `minutes`, in the order of `acts`.
export function createActs({ minutes = 5, acts = ACTS } = {}) {
  const slot = minutes * 60000, k = acts.length;
  return {
    at(t) {
      const n = Math.floor(t / slot), i = ((n % k) + k) % k;
      return { act: acts[i], startsAt: n * slot, endsAt: (n + 1) * slot, next: acts[(i + 1) % k], index: n };
    },
    headAt: () => minutes * 0.5,
  };
}
