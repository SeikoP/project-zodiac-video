// Sổ mùa: a monthly season pass every viewer fills just by playing — each bit of starlight they shed is experience.
// 30 levels; every level pays a little Điểm sáng, some pay a gem or a moon shard, and levels 10 / 20 / 30 put a
// silver / gold / starry frame round the viewer's avatar on the wheel for the rest of the season. There is one free
// track: nothing in it is sold. "kho" / "sổ mùa" shows your progress on stream.

import { emptyBag } from './bag.mjs';

export const PASS_DEFAULTS = Object.freeze({ passXpPerLevel: 40, passMaxLevel: 30 });

// what a level pays on top of 5 Điểm sáng
export function passReward(level) {
  if (level === 30) return { frame: 'star', label: 'khung Tinh Tú + 2 mảnh trăng', moon: 2 };
  if (level === 20) return { frame: 'gold', label: 'khung vàng + 1 mảnh trăng', moon: 1 };
  if (level === 10) return { frame: 'silver', label: 'khung bạc + 15 điểm sáng', dust: 15 };
  if (level % 5 === 0) return { label: '15 điểm sáng', dust: 15 };
  if (level % 3 === 0) return { label: '1 viên ngọc', gem: 1 };
  return { label: '5 điểm sáng' };
}
const FRAME_RANK = { silver: 1, gold: 2, star: 3 };

export function createPass({ cfg, now, onEvent, seasonOf, gem, moon }) {
  // XP needed to go from level n to n+1 grows a little each level
  const need = level => cfg.passXpPerLevel * level;
  function passOf(v) {
    const season = seasonOf();
    if (v.pass?.season !== season) v.pass = { season, xp: 0, level: 1, frame: null };
    return v.pass;
  }

  function addXp(u, v, amount) {
    if (!v.team || amount <= 0) return;
    const p = passOf(v);
    if (p.level >= cfg.passMaxLevel) return;
    p.xp += amount;
    while (p.level < cfg.passMaxLevel && p.xp >= need(p.level)) {
      p.xp -= need(p.level);
      p.level++;
      const r = passReward(p.level);
      (v.bag ??= emptyBag()).dust += 5;
      if (r.gem) gem(u, v, r.gem);
      if (r.moon) moon(u, v, r.moon);
      if (r.dust) v.bag.dust += r.dust;
      if (r.frame && (FRAME_RANK[r.frame] ?? 0) > (FRAME_RANK[p.frame] ?? 0)) p.frame = r.frame;
      onEvent({ type: 'pass-up', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, level: p.level, reward: r.label, frame: r.frame ?? null });
    }
  }

  // the viewer's season so far, for the vault ("kho")
  function view(v) {
    const p = passOf(v);
    return { level: p.level, xp: p.xp, need: need(p.level), max: cfg.passMaxLevel, next: p.level < cfg.passMaxLevel ? passReward(p.level + 1).label : null, frame: p.frame };
  }
  const frameOf = v => (v.pass?.season === seasonOf() ? v.pass.frame : null);
  return { addXp, view, frameOf, passOf };
}
