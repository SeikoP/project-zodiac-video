// Sổ Sao: a monthly season pass every viewer fills just by playing — each bit of starlight they shed is experience.
// 30 levels; every level pays a little bụi sao, some pay a gem, a card or a moon shard, and levels 10 / 20 / 30 put a
// silver / gold / starry frame round the viewer's avatar on the wheel for the rest of the season. There is one free
// track: nothing in it is sold. "sổ sao" shows your progress on stream.

export const PASS_DEFAULTS = Object.freeze({ passXpPerLevel: 40, passMaxLevel: 30, passShowCooldownSeconds: 30 });

// what a level pays on top of 5 bụi sao
export function passReward(level) {
  if (level === 30) return { frame: 'star', label: 'khung Tinh Tú + 2 mảnh trăng', moon: 2 };
  if (level === 20) return { frame: 'gold', label: 'khung vàng + 1 mảnh trăng', moon: 1 };
  if (level === 10) return { frame: 'silver', label: 'khung bạc + 1 thẻ', card: true };
  if (level % 5 === 0) return { label: '1 thẻ ngẫu nhiên', card: true };
  if (level % 3 === 0) return { label: '1 viên ngọc', gem: 1 };
  return { label: '5 bụi sao' };
}
const FRAME_RANK = { silver: 1, gold: 2, star: 3 };

export function createPass({ cfg, now, onEvent, seasonOf, gem, moon, card }) {
  // XP needed to go from level n to n+1 grows a little each level
  const need = level => cfg.passXpPerLevel * level;
  function passOf(v) {
    const season = seasonOf();
    if (v.pass?.season !== season) v.pass = { season, xp: 0, level: 1, frame: null };
    return v.pass;
  }

  function addXp(u, v, amount) {
    if (!v.sign || amount <= 0) return;
    const p = passOf(v);
    if (p.level >= cfg.passMaxLevel) return;
    p.xp += amount;
    while (p.level < cfg.passMaxLevel && p.xp >= need(p.level)) {
      p.xp -= need(p.level);
      p.level++;
      const r = passReward(p.level);
      (v.bag ??= { dust: 0, fire: 0, earth: 0, air: 0, water: 0, moon: 0 }).dust += 5;
      if (r.gem) gem(u, v, r.gem);
      if (r.moon) moon(u, v, r.moon);
      if (r.card) card(u, v);
      if (r.frame && (FRAME_RANK[r.frame] ?? 0) > (FRAME_RANK[p.frame] ?? 0)) p.frame = r.frame;
      onEvent({ type: 'pass-up', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, level: p.level, reward: r.label, frame: r.frame ?? null });
    }
  }

  function show(u, v) {
    if (!v.sign || now() - (v.passShownAt ?? 0) < cfg.passShowCooldownSeconds * 1000) return;
    v.passShownAt = now();
    const p = passOf(v);
    onEvent({ type: 'pass-show', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, level: p.level, xp: p.xp, need: need(p.level), max: cfg.passMaxLevel, next: p.level < cfg.passMaxLevel ? passReward(p.level + 1).label : null, frame: p.frame });
  }
  const frameOf = v => (v.pass?.season === seasonOf() ? v.pass.frame : null);
  return { addXp, show, frameOf, passOf };
}
