// Dự đoán: before a big outcome (who wins the tug, does the party pass floor 3, does the elite boss fall) the room
// guesses with "đoán A" / "đoán B". Guessing is free — nothing is staked by default, so it is never a bet — and a
// right guess pays bụi sao (the game's own currency) through the reward service. predictStake > 0 turns on a shared
// pot of bụi sao instead.
//
// A reactions block (groups a / b, one guess per person) keeps who guessed what; st.predict is plain JSON:
// { key, q, options, bets: {userId: {i, stake, nickname}}, pool: [a, b], closesAt, openedAt, rx }.
import { createReactions } from './events/reactions.mjs';

export const PREDICT_DEFAULTS = Object.freeze({
  predictStake: 0, // free guesses (a stake would make it read like betting)
  predictBonus: 10,
  predictStaleMinutes: 20,
});

const GUESS = letter => new RegExp(`^\\s*(doan|du doan)\\s*(${letter})\\b`);
const GROUPS = { a: text => GUESS('a|1').test(text), b: text => GUESS('b|2').test(text) };

export function createPredict({ st, cfg, now, onEvent, reward }) {
  const bagOf = v => (v.bag ??= { dust: 0, fire: 0, earth: 0, air: 0, water: 0, moon: 0 });
  const reactions = p => createReactions({ groups: GROUPS }, (p.rx ??= {}));

  function open({ key, q, options, closesAt }) {
    if (st.predict) resolve(st.predict.key, null); // never two at once
    st.predict = { key, q, options, bets: {}, pool: [0, 0], closesAt, openedAt: now(), rx: {} };
    onEvent({ type: 'predict-open', key, q, options, seconds: Math.round((closesAt - now()) / 1000) });
  }

  function chat(u, v, text) {
    const p = st.predict;
    if (!p || now() >= p.closesAt) return false;
    if (!Object.values(GROUPS).some(f => f(text))) return false;
    if (p.bets[u.userId]) return true; // one guess each: a second one is taken and ignored
    const group = reactions(p).react(u.userId, text);
    if (!group) return true;
    const bag = bagOf(v), stake = Math.min(cfg.predictStake, Math.floor(bag.dust));
    bag.dust -= stake;
    const i = group === 'a' ? 0 : 1;
    p.bets[u.userId] = { i, stake, nickname: v.nickname };
    p.pool[i] += stake;
    return true;
  }

  // winner: 0 or 1, or null to refund everyone (also refunded when nobody guessed right: a stake is never lost to the house)
  function resolve(key, winner) {
    const p = st.predict;
    if (!p || p.key !== key) return;
    st.predict = null;
    const all = Object.entries(p.bets), total = p.pool[0] + p.pool[1];
    const right = winner === null ? [] : all.filter(([, b]) => b.i === winner);
    const winPool = right.reduce((s, [, b]) => s + b.stake, 0);
    const refund = winner === null || !right.length;
    const payouts = [];
    for (const [id, b] of all) {
      const v = st.viewers?.[id];
      if (!v) continue;
      let pay = 0;
      if (refund) pay = b.stake;
      else if (b.i === winner) pay = cfg.predictBonus + (winPool ? Math.floor(total * b.stake / winPool) : Math.floor(total / right.length));
      if (pay && reward.grant({ userId: id }, v, 'dust', pay, 'predict')) payouts.push([b.nickname, pay]);
    }
    payouts.sort((x, y) => y[1] - x[1]);
    onEvent({ type: 'predict-end', key, q: p.q, winner, answer: winner === null ? null : p.options[winner], guesses: all.length, right: right.length, pot: total, top: payouts.slice(0, 3) });
  }

  function tick() {
    const p = st.predict;
    if (p && now() > p.closesAt + cfg.predictStaleMinutes * 60000) resolve(p.key, null);
  }

  const view = () => {
    const p = st.predict;
    if (!p) return null;
    const n = reactions(p).counts();
    return { key: p.key, q: p.q, options: p.options.map((label, i) => ({ key: 'AB'[i], label, n: n['ab'[i]], pool: p.pool[i] })), open: now() < p.closesAt, closesInMs: Math.max(0, p.closesAt - now()) };
  };
  return { open, chat, resolve, tick, view, active: () => st.predict?.key ?? null };
}
