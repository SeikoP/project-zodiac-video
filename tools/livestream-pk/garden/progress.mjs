// Levels, XP and in-game gold. None of it is ever bought with gifts.
export const LEVEL_XP = Object.freeze([0, 30, 90, 200, 400, 700, 1100, 1600, 2200, 3000]);

export const POT_TIERS = Object.freeze([
  { id: 'clay', label: 'Đất nung', minLevel: 1 },
  { id: 'glazed', label: 'Men lá', minLevel: 3 },
  { id: 'banded', label: 'Viền đồng', minLevel: 5 },
  { id: 'royal', label: 'Bệ ngọc', minLevel: 7 },
  { id: 'astral', label: 'Tinh tú', minLevel: 9 },
]);

export const levelOf = xp => LEVEL_XP.filter(min => xp >= min).length;
export const potTierOf = level => [...POT_TIERS].reverse().find(t => Number(level) >= t.minLevel) ?? POT_TIERS[0];

export function addXp(user, n) {
  const before = user.level;
  user.xp += n;
  user.level = levelOf(user.xp);
  return { level: user.level, leveledUp: user.level > before };
}

export const addGold = (user, n) => { user.gold += n; };

export function spendGold(user, n) {
  if (user.gold < n) return false;
  user.gold -= n;
  return true;
}
