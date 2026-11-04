// Kéo co 2 phe: the two teams with the most fans on stage pull a rope of starlight. Comments, hearts, follows and gifts
// pull for your own team; a small team pulls harder per person so it still has a chance. A short warm-up first, while
// the room predicts the winner (predict.mjs). The knot reaching either end wins early; otherwise the side it leans to.
// A big pull gets a "giật mạnh!" moment with the puller's name — the rope is the spectacle, nothing is asked for.
//
// An EventDef on the shared blocks (events/): a versus meter between the two teams, a phase clock, the roster for
// head counts and the reward service for the payout. st.tug is plain JSON and is the state of both blocks:
// { a, b, value (negative = team a ahead), power, names (userId -> team), startedAt, stage, nick, last }.

import { createPhase } from './events/phase.mjs';
import { createMeter } from './events/meter.mjs';
import { ABILITY_DEFAULTS } from './events/abilities.mjs';

export const TUG_DEFAULTS = Object.freeze({
  tugWarmupSeconds: 15,
  tugSeconds: 75,
  tugCommentPower: 2,
  tugCommentCooldownMs: 1500,
  tugLikePower: 0.15,
  tugDiamondPower: 2.5,
  tugSocialPower: 8,
  tugWinLight: 20,
  tugJoinLight: 5,
});

const YANK_POWER = 10; // a gift pull this big is announced by name
const MIN_GIFT_PULL = 3;

export function createTug({ st, cfg, now, onEvent, ctx, reward, viewerOf }) {
  let cache = null;
  // the blocks are built over whatever st.tug currently is (also one loaded from disk)
  function blocks() {
    const g = st.tug;
    if (!g) return null;
    if (cache?.g !== g) {
      const weights = { comment: cfg.tugCommentPower, like: cfg.tugLikePower, gift: cfg.tugDiamondPower, follow: cfg.tugSocialPower, share: cfg.tugSocialPower };
      // the smaller team pulls harder per person (between x0.5 and x2), so a team with two fans can still win
      const balance = team => {
        const c = ctx.roster.counts();
        const mine = c[team] || 1, theirs = c[team === g.a ? g.b : g.a] || 1;
        return Math.min(2, Math.max(0.5, Math.sqrt(theirs / mine)));
      };
      cache = {
        g,
        phase: createPhase({ now, warmupMs: cfg.tugWarmupSeconds * 1000, runMs: cfg.tugSeconds * 1000 }, g),
        meter: createMeter({ kind: 'versus', teams: [g.a, g.b], clamp: 100, weights, balance }, g),
      };
    }
    return cache;
  }

  const num = k => cfg[k] ?? ABILITY_DEFAULTS[k];
  const boosted = (g, team) => Boolean(g.boost && g.boost.team === team && now() < g.boost.until);

  const needs = c => Object.values((c ?? ctx).roster.counts()).filter(n => n > 0).length >= 2;

  function start() {
    if (st.tug) return null;
    const top = Object.entries(ctx.roster.counts()).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
    if (top.length < 2) return null;
    const [a, b] = [top[0][0], top[1][0]];
    st.tug = { a, b, nick: {}, last: {} };
    blocks().phase.start();
    onEvent({ type: 'tug-start', a, b, warmup: cfg.tugWarmupSeconds, seconds: cfg.tugSeconds });
    return st.tug;
  }

  // moves the clock forward; false once the tug has ended
  function clock() {
    const b = blocks();
    if (!b) return false;
    for (let r = b.phase.tick(); r; r = b.phase.tick()) {
      if (r === 'ended') { settle(false); return false; }
    }
    return true;
  }

  // One action for the viewer's side. action: comment | like | gift | follow | share; n: likes, or diamonds for a gift.
  function contribute(u, v, action, n = 0) {
    if (!clock()) return 0;
    const { g, phase, meter } = blocks();
    if (phase.phase() !== 'run' || (v.team !== g.a && v.team !== g.b)) return 0;
    let amount = n;
    if (action === 'comment') {
      if (now() - (g.last[u.userId] ?? 0) < cfg.tugCommentCooldownMs) return 0;
      g.last[u.userId] = now();
      amount = 1;
    } else if (action === 'gift') {
      amount = cfg.tugDiamondPower > 0 ? Math.max(n, MIN_GIFT_PULL / cfg.tugDiamondPower) : 0;
    } else if (action === 'follow' || action === 'share') amount = 1;
    if (!(amount > 0)) return 0;
    // Tăng tốc; the big gift that set the boost is not itself boosted (the boost carries skip: its giver, spent on that gift)
    if (action === 'gift' && g.boost?.skip === u.userId) delete g.boost.skip;
    else if (boosted(g, v.team)) amount *= num('tugBoostFactor');
    const before = g.value;
    const p = meter.add(u.userId, v.team, action, amount);
    if (!p) return 0;
    // one gift never moves the rope more than tugGiftSwingMax; the power stays whole for the MVP tally and the yank
    if (action === 'gift') {
      const max = num('tugGiftSwingMax');
      if (Math.abs(g.value - before) > max) g.value = before + Math.sign(g.value - before) * max;
    }
    g.nick[u.userId] = v.nickname;
    if (action === 'gift' && p >= YANK_POWER) onEvent({ type: 'tug-yank', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, power: Math.round(p) });
    if (meter.reached()) settle(true);
    return p;
  }

  // --- gift abilities (events/abilities.mjs) ---
  // mid: Giật mạnh — the gift's own pull, announced by name (contribute emits the tug-yank); big: Tăng tốc — the giver's team
  // pulls x tugBoostFactor for tugBoostSeconds (st.tug.boost = { team, until }, the latest boost replaces the one before)
  function pulling(g) {
    if (!g.viewer?.team || !clock()) return false;
    const { g: knot, phase } = blocks();
    return phase.phase() === 'run' && (g.viewer.team === knot.a || g.viewer.team === knot.b);
  }
  const gift = {
    mid: g => pulling(g),
    big: g => {
      if (!pulling(g)) return false;
      st.tug.boost = { team: g.viewer.team, until: now() + num('tugBoostSeconds') * 1000, skip: g.user.userId };
    },
  };

  function settle(early) {
    const b = blocks();
    if (!b) return;
    const { g, meter } = b;
    st.tug = null;
    cache = null;
    const winner = g.value < 0 ? g.a : g.value > 0 ? g.b : null;
    const pullers = Object.keys(g.power).sort((x, y) => g.power[y] - g.power[x]);
    for (const id of pullers) {
      const v = viewerOf(id);
      if (v) reward.grant({ userId: id }, v, 'light', g.names[id] === winner ? cfg.tugWinLight : cfg.tugJoinLight, 'tug');
    }
    const mvp = team => { const e = meter.topBy(team); return e ? { nickname: g.nick[e[0]], power: Math.round(e[1]) } : null; };
    onEvent({ type: 'tug-end', a: g.a, b: g.b, winner, pos: Math.round(g.value), pullers: pullers.length, mvpA: mvp(g.a), mvpB: mvp(g.b), early });
  }

  function tick() { clock(); }

  const view = () => {
    const g = st.tug;
    if (!g) return null;
    const t = now(), warmupEnd = g.startedAt + cfg.tugWarmupSeconds * 1000, end = warmupEnd + cfg.tugSeconds * 1000;
    const side = team => Object.keys(g.power).filter(id => g.names[id] === team).length;
    return { a: g.a, b: g.b, pos: Math.round(g.value), warmupMs: Math.max(0, warmupEnd - t), remainingMs: Math.max(0, end - t), pullersA: side(g.a), pullersB: side(g.b), boost: boosted(g, g.boost?.team) ? { team: g.boost.team, remainingMs: g.boost.until - t } : null };
  };

  return { id: 'tug', needs, start, tick, contribute, gift, view, end: () => { if (st.tug) settle(false); }, isDone: () => !st.tug };
}
