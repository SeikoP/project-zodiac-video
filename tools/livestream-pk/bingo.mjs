// Bingo Hoàng Đạo: every viewer gets a 3×3 card for the night (the centre is free: "có mặt"). Each square is something
// that happens in the room — a boss falls, a pair is matched, a sign is roasted, the moon is full, a gift lands…
// A square is marked for everyone who is on stage when it happens, so staying through the hours fills the card.
// A line pays a gem, the full card a moon shard. "bingo" shows your card on stream.

export const BINGO_DEFAULTS = Object.freeze({ bingoShowCooldownSeconds: 30 });

// [id, label, icon, does this event mark it?]
export const SQUARES = Object.freeze([
  ['boss', 'Hạ boss', '☄️', e => e.type === 'boss-defeated'],
  ['pair', 'Có cặp đôi', '💞', e => e.type === 'pair'],
  ['roast', 'Bóc phốt', '🔥', e => e.type === 'roast-end'],
  ['quest', 'Xong nhiệm vụ giờ', '🏆', e => e.type === 'quest-done'],
  ['moon', 'Trăng rằm', '🌕', e => e.type === 'moon-full'],
  ['lucky', 'Sao may mắn', '⭐', e => e.type === 'lucky-start'],
  ['chest', 'Rương mở', '🎁', e => e.type === 'chest-open'],
  ['birth', 'Bầu trời ngày sinh', '🌌', e => e.type === 'birth-sky'],
  ['floor', 'Đoàn thắng 1 tầng', '🪐', e => e.type === 'run-won'],
  ['quiz', 'Có người đoán đúng câu đố', '🧠', e => e.type === 'quiz-end' && e.winners?.length > 0],
  ['wish', 'Điều ước thành sao', '🏮', e => e.type === 'wish-blessed'],
  ['level', 'Có người lên cấp', '⬆️', e => e.type === 'level-up'],
  ['tug', 'Kéo co ngã ngũ', '🪢', e => e.type === 'tug-end' && e.winner],
  ['gift', 'Một món quà xuất hiện', '🎀', e => e.type === 'gift'],
  ['fireworks', 'Pháo hoa rực trời', '🎆', e => (e.type === 'gift' && e.tier !== 'sparkle') || e.type === 'wheel-complete'],
  ['heat', 'Phòng bùng cháy', '🔥', e => e.type === 'heat-up' && e.level >= 3],
  ['lit', 'Một chòm sao sáng', '✨', e => e.type === 'lit'],
  ['newstar', 'Ngôi sao mới ra đời', '🌟', e => e.type === 'star-born'],
  ['predict', 'Có người đoán trúng', '🔮', e => e.type === 'predict-end' && e.right > 0],
]);
const BY_ID = Object.fromEntries(SQUARES.map(s => [s.at(0), s]));
// the event types any square listens to: everything else (thousands of small 'light' and 'likes' events) is skipped at once
const TYPES = new Set(['boss-defeated', 'pair', 'roast-end', 'quest-done', 'moon-full', 'lucky-start', 'chest-open', 'birth-sky', 'run-won', 'quiz-end', 'wish-blessed', 'level-up', 'tug-end', 'gift', 'wheel-complete', 'heat-up', 'lit', 'star-born', 'predict-end']);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };

export function createBingo({ st, cfg, now, onEvent, stageIds, gem, moon }) {
  // the viewer's card for tonight: 8 squares picked by (viewer, night), the free centre at index 4
  function cardOf(id, v) {
    if (v.bingo?.night === st.night.no) return v.bingo;
    const pool = SQUARES.map(s => s[0]);
    let h = hash(`${id}:${st.night.no}`);
    const picks = [];
    while (picks.length < 8) { h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0; picks.push(pool.splice(h % pool.length, 1)[0]); }
    picks.splice(4, 0, 'free');
    v.bingo = { night: st.night.no, squares: picks, marked: picks.map(s => s === 'free'), lines: 0, full: false };
    return v.bingo;
  }

  // Marks the squares this event matches for everyone on stage who holds one.
  function note(e) {
    if (!TYPES.has(e.type)) return;
    const hits = SQUARES.filter(s => s[3](e)).map(s => s[0]);
    if (!hits.length) return;
    for (const id of stageIds()) {
      const v = st.viewers[id];
      if (!v?.sign) continue;
      const c = cardOf(id, v);
      let changed = false;
      c.squares.forEach((sq, i) => { if (!c.marked[i] && hits.includes(sq)) { c.marked[i] = true; changed = true; } });
      if (!changed) continue;
      const lines = LINES.filter(l => l.every(i => c.marked[i])).length, full = c.marked.every(Boolean);
      if (lines > c.lines) {
        c.lines = lines;
        gem({ userId: id }, v, 1);
        onEvent({ type: 'bingo', userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign, lines, full, card: view(c) });
      }
      if (full && !c.full) { c.full = true; moon({ userId: id }, v); }
    }
  }

  const view = c => c.squares.map((sq, i) => ({ id: sq, label: sq === 'free' ? 'Có mặt' : BY_ID[sq][1], icon: sq === 'free' ? '★' : BY_ID[sq][2], marked: c.marked[i] }));
  function show(u, v) {
    if (!v.sign) return onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'bingo' });
    if (now() - (v.bingoShownAt ?? 0) < cfg.bingoShowCooldownSeconds * 1000) return;
    v.bingoShownAt = now();
    const c = cardOf(u.userId, v);
    onEvent({ type: 'bingo-card', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, lines: c.lines, marked: c.marked.filter(Boolean).length, card: view(c) });
  }
  return { cardOf, note, show };
}
