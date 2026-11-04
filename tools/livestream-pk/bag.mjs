// Kho tài nguyên: what a viewer collects by playing, and what they spend it on.
//   ✦ Điểm sáng (key dust) — a little with every bit of starlight they shed
//   Ngọc phe (Đỏ · Vàng · Xanh · Lam) — from the boss, the chest, quizzes and fixing Thủy Nghịch
//   🌙 Mảnh trăng — for being there when the moon is full, and for a wish the room blessed
// "nâng cấp" spends them to raise the viewer's mascot a level (Lv1–Lv5): a bigger halo on the wheel and a little
// more starlight on everything they do. "kho" shows the bag on stream. Bags last across nights.

export const RESOURCES = Object.freeze({
  dust: { label: 'Điểm sáng', icon: '✦' },
  red: { label: 'Ngọc Đỏ', icon: '🔴' },
  yellow: { label: 'Ngọc Vàng', icon: '🟡' },
  green: { label: 'Ngọc Xanh', icon: '🟢' },
  blue: { label: 'Ngọc Lam', icon: '🔵' },
  moon: { label: 'Mảnh trăng', icon: '🌙' },
});

export const BAG_DEFAULTS = Object.freeze({
  dustPerLight: 0.5,
  // cost of reaching level 2, 3, 4, 5: điểm sáng, ngọc of the viewer's own team colour, mảnh trăng
  levelDust: [60, 160, 320, 560],
  levelGems: [1, 2, 3, 5],
  levelMoon: [0, 0, 1, 2],
  levelBonus: 0.06, // extra starlight per level above 1
  upgradeHintCooldownSeconds: 20,
});

export const LEVEL_MAX = 5;
export const GEMS = Object.freeze(['red', 'yellow', 'green', 'blue']); // one gem per team colour; the key is the team id
export const emptyBag = () => ({ dust: 0, red: 0, yellow: 0, green: 0, blue: 0, moon: 0 });

export function createBag({ cfg, now, onEvent }) {
  const bagOf = v => (v.bag ??= emptyBag());
  const levelOf = v => v.level ?? 1;
  // What the next level costs this viewer (null at the top).
  function nextCost(v) {
    const lv = levelOf(v);
    if (lv >= LEVEL_MAX || !v.team) return null;
    return { dust: cfg.levelDust[lv - 1], gem: v.team, gems: cfg.levelGems[lv - 1], moon: cfg.levelMoon[lv - 1] };
  }

  function add(u, v, res, n, why) {
    if (!n) return;
    const bag = bagOf(v);
    bag[res] = (bag[res] ?? 0) + n;
    if (res !== 'dust') onEvent({ type: 'loot', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, res, n, why });
  }
  const fromLight = (v, amount) => { bagOf(v).dust += Math.ceil(amount * cfg.dustPerLight); };

  // "nâng cấp": pays the next level if the bag holds enough, otherwise says (now and then) what is missing.
  function upgrade(u, v) {
    const cost = nextCost(v);
    if (!cost) return false;
    const bag = bagOf(v);
    const missing = {};
    if (bag.dust < cost.dust) missing.dust = cost.dust - bag.dust;
    if (bag[cost.gem] < cost.gems) missing[cost.gem] = cost.gems - bag[cost.gem];
    if (bag.moon < cost.moon) missing.moon = cost.moon - bag.moon;
    if (Object.keys(missing).length) {
      if (now() - (v.hintAt ?? 0) >= cfg.upgradeHintCooldownSeconds * 1000) {
        v.hintAt = now();
        onEvent({ type: 'upgrade-need', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, level: levelOf(v), missing });
      }
      return false;
    }
    bag.dust -= cost.dust;
    bag[cost.gem] -= cost.gems;
    bag.moon -= cost.moon;
    v.level = levelOf(v) + 1;
    onEvent({ type: 'level-up', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, level: v.level });
    return true;
  }

  const bonus = v => 1 + cfg.levelBonus * (levelOf(v) - 1);
  return { add, fromLight, upgrade, nextCost, bonus, levelOf };
}
