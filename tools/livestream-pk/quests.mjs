// Nhiệm vụ cá nhân: every viewer gets three each night, drawn from this bank. They only ask for taking part (hits on the boss,
// pulls, blessings, right answers, catches, time in the room, hearts, comments) - never for a gift. Done once per night, paid
// through the reward service in Điểm sáng (kind 'dust'), now and then a gem of the viewer's colour or a moon shard.

// The counters the game writes per viewer and night (profile.track); a quest's `stat` is one of these.
export const STAT_KEYS = Object.freeze([
  'hits', 'pulls', 'thaws', 'shields', 'blessings', 'wishes', 'correct', 'catches', 'guesses', 'predictions',
  'minutes', 'likes', 'comments', 'shares', 'follows',
]);

const q = (id, stat, goal, label, kind, n) => Object.freeze({ id, stat, goal, label, reward: Object.freeze({ kind, n }) });

export const QUESTS = Object.freeze([
  q('hits5', 'hits', 5, 'Đánh 5 đòn lên Boss', 'dust', 15),
  q('hits12', 'hits', 12, 'Đánh 12 đòn lên Boss', 'gem', 1),
  q('pulls8', 'pulls', 8, 'Kéo co 8 lần', 'dust', 15),
  q('pulls20', 'pulls', 20, 'Kéo co 20 lần', 'gem', 1),
  q('thaw1', 'thaws', 1, 'Giúp phá băng cho phe mình', 'dust', 20),
  q('shield3', 'shields', 3, 'Góp 3 lần vào khiên của cả phòng', 'dust', 15),
  q('bless2', 'blessings', 2, 'Chúc 2 điều ước', 'dust', 15),
  q('bless5', 'blessings', 5, 'Chúc 5 điều ước', 'moon', 1),
  q('wish1', 'wishes', 1, 'Thả 1 điều ước', 'dust', 10),
  q('correct1', 'correct', 1, 'Trả lời đúng 1 câu', 'dust', 15),
  q('correct3', 'correct', 3, 'Trả lời đúng 3 câu', 'gem', 1),
  q('catch2', 'catches', 2, 'Hứng 2 sao băng', 'dust', 15),
  q('guess1', 'guesses', 1, 'Đoán trúng 1 vật bí ẩn', 'gem', 1),
  q('predict1', 'predictions', 1, 'Dự đoán đúng 1 lần', 'dust', 20),
  q('stay10', 'minutes', 10, 'Có mặt 10 phút', 'dust', 10),
  q('stay20', 'minutes', 20, 'Có mặt 20 phút', 'moon', 1),
  q('like30', 'likes', 30, 'Thả 30 tim', 'dust', 10),
  q('like100', 'likes', 100, 'Thả 100 tim', 'dust', 20),
  q('chat10', 'comments', 10, 'Bình luận 10 lần', 'dust', 10),
  q('chat25', 'comments', 25, 'Bình luận 25 lần', 'dust', 20),
  q('share1', 'shares', 1, 'Chia sẻ buổi live 1 lần', 'dust', 15),
  q('follow1', 'follows', 1, 'Theo dõi kênh', 'dust', 15),
]);

// 32-bit FNV-1a, then a small mixer: the same text always gives the same numbers, with no rng and no clock.
function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const mix = h => {
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

// Three distinct quests (three different kinds of play where the bank allows) for this viewer on this night.
export function drawQuests(userId, night, bank = QUESTS, count = 3) {
  let h = hashOf(`${userId}#${night}`);
  const pool = [...bank], out = [], stats = new Set();
  while (out.length < count && pool.length) {
    h = mix(h + 0x9e3779b9);
    const fresh = pool.filter(x => !stats.has(x.stat));
    const from = fresh.length ? fresh : pool;
    const pick = from[h % from.length];
    pool.splice(pool.indexOf(pick), 1);
    stats.add(pick.stat);
    out.push(pick);
  }
  return out;
}
