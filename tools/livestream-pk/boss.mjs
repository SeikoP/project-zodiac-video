// Sao Chổi Đen — a boss the whole room fights together for a couple of minutes. Each element plays its own part,
// so knowing your team's element is what makes you good at it:
//   Lửa (fire)  — gifts land as critical hits (x2)
//   Đất (earth) — comments raise the room's shield, which blocks the boss's attacks
//   Khí (air)   — comments in quick succession build a combo (up to +150% damage)
//   Nước (water) — hearts hit three times as hard
// Every so often the boss freezes the team hurting it most: that team deals no damage until its own fans comment
// to break the ice, and if nobody does in time the boss heals. A full shield blocks the attack instead.
// Pure logic: the game owns the state object (so it is saved with everything else) and hands out the rewards.

export const ROLES = Object.freeze({
  fire: 'đòn chí mạng',
  earth: 'chat = khiên',
  air: 'chat liên tục',
  water: 'tim x3',
});

export const BOSS_DEFAULTS = Object.freeze({
  bossEverySeconds: 1200, // a new boss this long after the last one ended (only while the room is active)
  bossSeconds: 150,
  bossHpPerViewer: 120,
  bossHpMin: 400,
  bossCommentDamage: 6,
  bossCommentCooldownMs: 1500,
  bossLikeDamage: 0.4,
  bossDiamondDamage: 6,
  bossSocialDamage: 30,
  bossAttackSeconds: 22,
  bossRageAttackSeconds: 14, // below a third of its health
  bossFreezeSeconds: 12,
  bossHealShare: 0.12,
  bossShieldMax: 30,
  bossShieldCost: 10,
  bossComboMs: 4000,
  bossComboMax: 10,
  bossReward: 30, // starlight for everyone who hit a defeated boss
});

export function createBoss({ st, cfg, now, onEvent, elementOf, teamsOnStage, fansOf, reward }) {
  const ELEMENTS = ['fire', 'earth', 'air', 'water'];

  function start(crowd = 1) {
    if (st.boss) return null;
    const max = Math.max(cfg.bossHpMin, Math.round(cfg.bossHpPerViewer * crowd));
    const t = now();
    st.boss = { hp: max, max, startedAt: t, endsAt: t + cfg.bossSeconds * 1000, nextAttackAt: t + cfg.bossAttackSeconds * 1000,
      shield: 0, combo: 0, comboAt: 0, frozen: null, hitters: {}, byTeam: {}, byElement: Object.fromEntries(ELEMENTS.map(e => [e, 0])), lastComment: {} };
    onEvent({ type: 'boss-start', hp: max, seconds: cfg.bossSeconds });
    return st.boss;
  }

  // One viewer action against the boss. kind: comment | like | gift | follow | share; n: likes, or diamonds for a gift.
  function hit(u, v, kind, n = 0) {
    const b = st.boss;
    if (!b || !v.team || b.hp <= 0) return 0;
    const t = now(), el = elementOf(v.team);
    if (b.frozen?.team === v.team) {
      // a frozen team can't hurt the boss; its fans' comments chip at the ice instead
      if (kind === 'comment' && !b.frozen.rescuers[u.userId]) {
        b.frozen.rescuers[u.userId] = v.nickname;
        if (Object.keys(b.frozen.rescuers).length >= b.frozen.need) {
          onEvent({ type: 'boss-rescue', team: v.team, nickname: v.nickname, userId: u.userId });
          b.frozen = null;
        }
      }
      return 0;
    }
    let base = 0, mult = 1, crit = false;
    if (kind === 'comment') {
      if (t - (b.lastComment[u.userId] ?? 0) < cfg.bossCommentCooldownMs) return 0;
      b.lastComment[u.userId] = t;
      base = cfg.bossCommentDamage;
      if (el === 'earth') b.shield = Math.min(cfg.bossShieldMax, b.shield + 1);
      if (el === 'air') {
        b.combo = t - b.comboAt < cfg.bossComboMs ? Math.min(cfg.bossComboMax, b.combo + 1) : 1;
        b.comboAt = t;
        mult = 1 + 0.15 * b.combo;
      }
    } else if (kind === 'like') {
      base = n * cfg.bossLikeDamage;
      if (el === 'water') mult = 3;
    } else if (kind === 'gift') {
      base = n * cfg.bossDiamondDamage;
      if (el === 'fire') { mult = 2; crit = true; }
    } else if (kind === 'follow' || kind === 'share') base = cfg.bossSocialDamage;
    const dmg = Math.round(base * mult);
    if (dmg <= 0) return 0;
    b.hp = Math.max(0, b.hp - dmg);
    const h = (b.hitters[u.userId] ??= { nickname: v.nickname, team: v.team, dmg: 0 });
    h.nickname = v.nickname;
    h.team = v.team;
    h.dmg += dmg;
    b.byTeam[v.team] = (b.byTeam[v.team] ?? 0) + dmg;
    b.byElement[el] += dmg;
    onEvent({ type: 'boss-hit', userId: u.userId, nickname: v.nickname, team: v.team, dmg, crit, combo: el === 'air' && kind === 'comment' ? b.combo : 0 });
    if (b.hp <= 0) defeat({ nickname: v.nickname, team: v.team, kind });
    return dmg;
  }

  // finisher: who landed the last blow (the overlay calls it "cú kết liễu")
  function defeat(finisher = null) {
    const b = st.boss;
    st.boss = null;
    const hitters = Object.entries(b.hitters).map(([userId, h]) => ({ userId, ...h })).sort((a, z) => z.dmg - a.dmg);
    const mvps = {};
    for (const h of hitters) { const el = elementOf(h.team); if (!mvps[el]) mvps[el] = { nickname: h.nickname, team: h.team, dmg: h.dmg }; }
    hitters.forEach((h, i) => reward(h.userId, i === 0));
    onEvent({ type: 'boss-defeated', seconds: Math.round((now() - b.startedAt) / 1000), fighters: hitters.length, mvp: hitters[0] ? { nickname: hitters[0].nickname, team: hitters[0].team, dmg: hitters[0].dmg } : null, mvps, reward: cfg.bossReward, finisher });
  }

  function attack(t) {
    const b = st.boss;
    const present = teamsOnStage();
    // the boss goes after whoever hurts it most among the teams still here
    const target = present.sort((x, y) => (b.byTeam[y] ?? 0) - (b.byTeam[x] ?? 0))[0] ?? null;
    b.nextAttackAt = t + (b.hp < b.max / 3 ? cfg.bossRageAttackSeconds : cfg.bossAttackSeconds) * 1000;
    if (!target) return;
    if (b.shield >= cfg.bossShieldCost) {
      b.shield -= cfg.bossShieldCost;
      onEvent({ type: 'boss-blocked', team: target, shield: b.shield });
      return;
    }
    const need = Math.max(1, Math.min(3, fansOf(target)));
    b.frozen = { team: target, until: t + cfg.bossFreezeSeconds * 1000, need, rescuers: {} };
    onEvent({ type: 'boss-freeze', team: target, seconds: cfg.bossFreezeSeconds, need });
  }

  function tick() {
    const b = st.boss;
    if (!b) return;
    const t = now();
    if (t >= b.endsAt) {
      st.boss = null;
      onEvent({ type: 'boss-escaped', hpShare: b.hp / b.max, fighters: Object.keys(b.hitters).length });
      return;
    }
    if (b.frozen && t >= b.frozen.until) {
      const heal = Math.round(b.max * cfg.bossHealShare);
      b.hp = Math.min(b.max, b.hp + heal);
      onEvent({ type: 'boss-heal', team: b.frozen.team, heal });
      b.frozen = null;
    }
    if (!b.frozen && t >= b.nextAttackAt) attack(t);
  }

  // What the overlay shows: health, time, shield, the air combo while it's alive, the frozen team, top hitters and element totals.
  function view() {
    const b = st.boss;
    if (!b) return null;
    const t = now();
    return {
      hp: b.hp, max: b.max, remainingMs: Math.max(0, b.endsAt - t), shield: b.shield, shieldCost: cfg.bossShieldCost, shieldMax: cfg.bossShieldMax,
      combo: t - b.comboAt < cfg.bossComboMs ? b.combo : 0,
      frozen: b.frozen && { team: b.frozen.team, remainingMs: Math.max(0, b.frozen.until - t), got: Object.keys(b.frozen.rescuers).length, need: b.frozen.need },
      attackInMs: b.frozen ? null : Math.max(0, b.nextAttackAt - t),
      top: Object.values(b.hitters).sort((a, z) => z.dmg - a.dmg).slice(0, 3).map(({ nickname, team, dmg }) => ({ nickname, team, dmg })),
      byElement: { ...b.byElement },
      rage: b.hp < b.max / 3,
    };
  }

  return { start, hit, tick, view, active: () => Boolean(st.boss) };
}
