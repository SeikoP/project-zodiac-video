// Sao Chổi Đen — a boss the whole room fights together for a couple of minutes. Each colour team plays its own part,
// so knowing your team is what makes you good at it:
//   Đỏ (red)       — gifts land as critical hits (x2)
//   Vàng (yellow)  — comments raise the room's shield, which blocks the boss's attacks
//   Xanh lá (green) — comments in quick succession build a combo (up to +150% damage)
//   Xanh dương (blue) — hearts hit three times as hard
// Every so often the boss freezes the team hurting it most: that team deals no damage until its own fans comment
// to break the ice, and if nobody does in time the boss heals. A full shield blocks the attack instead.
//
// An EventDef on the shared blocks (events/): a phase clock for the timer, a coop meter for each fighter's damage, the
// roster for who is on stage and the reward service for the payout. st.boss is plain JSON and is the state of both
// blocks plus the boss's own fields (hp stays here so the game and its tests can read and set it).

import { createPhase } from './events/phase.mjs';
import { createMeter } from './events/meter.mjs';
import { TEAM_IDS } from './events/teams.mjs';
import { ABILITY_DEFAULTS } from './events/abilities.mjs';

export const ROLES = Object.freeze({
  red: 'Quà chí mạng x2',
  yellow: 'Khiên mỗi comment +1',
  green: 'Combo comment tới +150%',
  blue: 'Thả tim sát thương x3',
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

export function createBoss({ st, cfg, now, onEvent, ctx, reward, viewerOf }) {
  let cache = null;
  function blocks() {
    const b = st.boss;
    if (!b) return null;
    if (cache?.b !== b) {
      cache = {
        b,
        phase: createPhase({ now, runMs: cfg.bossSeconds * 1000 }, b),
        meter: createMeter({ kind: 'coop', goal: b.max, weights: { hit: 1 } }, b),
      };
    }
    return cache;
  }

  function start(crowd = 1) {
    if (st.boss) return null;
    const max = Math.max(cfg.bossHpMin, Math.round(cfg.bossHpPerViewer * crowd));
    const t = now();
    st.boss = { hp: max, max, nextAttackAt: t + cfg.bossAttackSeconds * 1000, shield: 0, combo: 0, comboAt: 0, frozen: null, byTeam: {}, nick: {}, lastComment: {} };
    blocks().phase.start();
    onEvent({ type: 'boss-start', hp: max, seconds: cfg.bossSeconds });
    return st.boss;
  }

  // One viewer action against the boss. action: comment | like | gift | follow | share; n: likes, or diamonds for a gift.
  function contribute(u, v, action, n = 0) {
    const b = st.boss;
    if (!b || !v.team || b.hp <= 0) return 0;
    const t = now(), team = v.team;
    if (b.frozen?.team === team) {
      // a frozen team can't hurt the boss; its fans' comments chip at the ice instead
      if (action === 'comment' && !b.frozen.rescuers[u.userId]) {
        b.frozen.rescuers[u.userId] = v.nickname;
        if (Object.keys(b.frozen.rescuers).length >= b.frozen.need) {
          onEvent({ type: 'boss-rescue', team, nickname: v.nickname, userId: u.userId });
          b.frozen = null;
        }
      }
      return 0;
    }
    let base = 0, mult = 1, crit = false;
    if (action === 'comment') {
      if (t - (b.lastComment[u.userId] ?? 0) < cfg.bossCommentCooldownMs) return 0;
      b.lastComment[u.userId] = t;
      base = cfg.bossCommentDamage;
      if (team === 'yellow') b.shield = Math.min(cfg.bossShieldMax, b.shield + 1);
      if (team === 'green') {
        b.combo = t - b.comboAt < cfg.bossComboMs ? Math.min(cfg.bossComboMax, b.combo + 1) : 1;
        b.comboAt = t;
        mult = 1 + 0.15 * b.combo;
      }
    } else if (action === 'like') {
      base = n * cfg.bossLikeDamage;
      if (team === 'blue') mult = 3;
    } else if (action === 'gift') {
      base = n * cfg.bossDiamondDamage;
      if (team === 'red') { mult = 2; crit = true; }
    } else if (action === 'follow' || action === 'share') base = cfg.bossSocialDamage;
    const dmg = Math.round(base * mult);
    if (dmg <= 0) return 0;
    strike(u, v, dmg, { crit, combo: team === 'green' && action === 'comment' ? b.combo : 0, kind: action });
    return dmg;
  }

  // Lands dmg on the boss for this viewer: the hit, the team's tally and, when it kills, the finisher.
  function strike(u, v, dmg, { crit = false, combo = 0, kind, ultimate = null }) {
    const b = st.boss, team = v.team;
    b.hp = Math.max(0, b.hp - dmg);
    blocks().meter.add(u.userId, team, 'hit', dmg);
    b.nick[u.userId] = v.nickname;
    b.byTeam[team] = (b.byTeam[team] ?? 0) + dmg;
    onEvent({ type: 'boss-hit', userId: u.userId, nickname: v.nickname, team, dmg, crit, combo, ...(ultimate && { ultimate: true }) });
    if (b.hp <= 0) defeat({ nickname: v.nickname, team, kind, ...(ultimate && { ability: ultimate }) });
  }

  // --- gift abilities (events/abilities.mjs) ---------------------------------------------------------------------
  // mid: Đòn tuyệt kỹ — an extra hit of coins x bossUltFactor and bossUltShield shield for the room (the shield is the room's);
  // big: Phá băng — the giver's team is thawed if it is frozen, then the same extra hit; whoever kills the boss is the finisher.
  const num = k => cfg[k] ?? ABILITY_DEFAULTS[k];
  const alive = g => Boolean(st.boss && st.boss.hp > 0 && g.viewer?.team);
  function ultimateHit(g, id) {
    const dmg = Math.round(g.diamonds * num('bossUltFactor'));
    // a frozen team deals no damage, an ultimate included; the shield above still counts
    if (dmg > 0 && st.boss.frozen?.team !== g.team) strike(g.user, g.viewer, dmg, { kind: 'gift', ultimate: id });
  }
  const gift = {
    mid: g => {
      if (!alive(g)) return false;
      st.boss.shield = Math.min(cfg.bossShieldMax, st.boss.shield + num('bossUltShield'));
      ultimateHit(g, 'ultimate');
    },
    big: g => {
      if (!alive(g)) return false;
      const b = st.boss;
      if (b.frozen?.team === g.team) {
        b.frozen = null;
        onEvent({ type: 'boss-rescue', team: g.team, nickname: g.viewer.nickname, userId: g.user.userId, gift: true });
      }
      ultimateHit(g, 'thaw');
    },
  };

  // finisher: who landed the last blow (the overlay calls it "cú kết liễu")
  function defeat(finisher = null) {
    const { b, meter } = blocks();
    st.boss = null;
    cache = null;
    const hitters = Object.keys(b.power).sort((x, y) => b.power[y] - b.power[x]).map(userId => ({ userId, nickname: b.nick[userId], team: b.names[userId], dmg: b.power[userId] }));
    const mvps = {};
    for (const team of TEAM_IDS) {
      const e = meter.topBy(team);
      if (e) mvps[team] = { userId: e[0], nickname: b.nick[e[0]], team, dmg: e[1] };
    }
    hitters.forEach((h, i) => {
      const v = viewerOf(h.userId);
      if (!v?.team) return;
      const who = { userId: h.userId };
      reward.grant(who, v, 'light', cfg.bossReward, 'boss');
      reward.grant(who, v, 'dust', i === 0 ? 15 : 5, 'boss');
      reward.grant(who, v, 'gem', i === 0 ? 4 : 2, 'boss');
    });
    onEvent({ type: 'boss-defeated', seconds: Math.round((now() - b.startedAt) / 1000), fighters: hitters.length, mvp: hitters[0] ? { nickname: hitters[0].nickname, team: hitters[0].team, dmg: hitters[0].dmg } : null, mvps, reward: cfg.bossReward, finisher });
  }

  function attack(t) {
    const b = st.boss;
    const counts = ctx.roster.counts();
    // the boss goes after whoever hurts it most among the teams still here
    const target = TEAM_IDS.filter(id => counts[id] > 0).sort((x, y) => (b.byTeam[y] ?? 0) - (b.byTeam[x] ?? 0))[0] ?? null;
    b.nextAttackAt = t + (b.hp < b.max / 3 ? cfg.bossRageAttackSeconds : cfg.bossAttackSeconds) * 1000;
    if (!target) return;
    if (b.shield >= cfg.bossShieldCost) {
      b.shield -= cfg.bossShieldCost;
      onEvent({ type: 'boss-blocked', team: target, shield: b.shield });
      return;
    }
    const need = Math.max(1, Math.min(3, counts[target]));
    b.frozen = { team: target, until: t + cfg.bossFreezeSeconds * 1000, need, rescuers: {} };
    onEvent({ type: 'boss-freeze', team: target, seconds: cfg.bossFreezeSeconds, need });
  }

  function tick() {
    const blk = blocks();
    if (!blk) return;
    const b = blk.b, t = now();
    if (blk.phase.tick() === 'ended') {
      st.boss = null;
      cache = null;
      onEvent({ type: 'boss-escaped', hpShare: b.hp / b.max, fighters: Object.keys(b.power).length });
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

  // What the overlay shows: health, time, shield, the green combo while it's alive, the frozen team, top hitters and team totals.
  function view() {
    const b = st.boss;
    if (!b) return null;
    const t = now();
    return {
      hp: b.hp, max: b.max, remainingMs: Math.max(0, b.startedAt + cfg.bossSeconds * 1000 - t), shield: b.shield, shieldCost: cfg.bossShieldCost, shieldMax: cfg.bossShieldMax,
      combo: t - b.comboAt < cfg.bossComboMs ? b.combo : 0,
      frozen: b.frozen && { team: b.frozen.team, remainingMs: Math.max(0, b.frozen.until - t), got: Object.keys(b.frozen.rescuers).length, need: b.frozen.need },
      attackInMs: b.frozen ? null : Math.max(0, b.nextAttackAt - t),
      top: Object.keys(b.power).sort((x, y) => b.power[y] - b.power[x]).slice(0, 3).map(id => ({ nickname: b.nick[id], team: b.names[id], dmg: b.power[id] })),
      byTeam: Object.fromEntries(TEAM_IDS.map(id => [id, b.byTeam[id] ?? 0])),
      rage: b.hp < b.max / 3,
    };
  }

  return { id: 'boss', start, tick, contribute, gift, view, end: () => { st.boss = null; cache = null; }, isDone: () => !st.boss, active: () => Boolean(st.boss) };
}
