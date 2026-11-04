// Levels, XP and in-game gold. None of it is ever bought with gifts.
export const LEVEL_XP = Object.freeze([0, 30, 90, 200, 400, 700, 1100, 1600, 2200, 3000]);

export const levelOf = xp => LEVEL_XP.filter(min => xp >= min).length;

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
