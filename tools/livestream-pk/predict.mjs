// Dự đoán: before a big outcome (who wins the tug, does the party pass floor 3, does the elite boss fall) the room
// guesses with "đoán A" / "đoán B". Guessing is free — nothing is staked by default, so it is never a bet — and a
// right guess pays bụi sao (the game's own currency). predictStake > 0 turns on a shared pot of bụi sao instead.

export const PREDICT_DEFAULTS = Object.freeze({
  predictStake: 0, // free guesses (a stake would make it read like betting)
  predictBonus: 10,
  predictStaleMinutes: 20,
});

const BET_RE = /^\s*(doan|du doan)\s*(a|b|1|2)\b/;

export function createPredict({ st, cfg, now, onEvent }) {
  const bagOf = v => (v.bag ??= { dust: 0, fire: 0, earth: 0, air: 0, water: 0, moon: 0 });

  function open({ key, q, options, closesAt }) {
    if (st.predict) resolve(st.predict.key, null); // never two at once
    st.predict = { key, q, options, bets: {}, pool: [0, 0], closesAt, openedAt: now() };
    onEvent({ type: 'predict-open', key, q, options, seconds: Math.round((closesAt - now()) / 1000) });
  }

  function chat(u, v, text) {
    const p = st.predict;
    if (!p || now() >= p.closesAt) return false;
    const m = text.match(BET_RE);
    if (!m) return false;
    const i = 'a1'.includes(m[2]) ? 0 : 1;
    if (p.bets[u.userId]) return true; // one guess each
    const bag = bagOf(v), stake = Math.min(cfg.predictStake, Math.floor(bag.dust));
    bag.dust -= stake;
    p.bets[u.userId] = { i, stake, nickname: v.nickname };
    p.pool[i] += stake;
    return true;
  }

  // winner: 0 or 1, or null to refund everyone
  function resolve(key, winner) {
    const p = st.predict;
    if (!p || p.key !== key) return;
    st.predict = null;
    const all = Object.entries(p.bets), total = p.pool[0] + p.pool[1];
    const right = winner === null ? [] : all.filter(([, b]) => b.i === winner);
    const winPool = right.reduce((s, [, b]) => s + b.stake, 0);
    const payouts = [];
    for (const [id, b] of all) {
      const v = st.viewers?.[id];
      if (!v) continue;
      let pay = 0;
      if (winner === null) pay = b.stake;
      else if (b.i === winner) pay = cfg.predictBonus + (winPool ? Math.round(total * b.stake / winPool) : Math.round(total / right.length));
      if (pay) { bagOf(v).dust += pay; payouts.push([b.nickname, pay]); }
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
    const n = [0, 0];
    for (const b of Object.values(p.bets)) n[b.i]++;
    return { key: p.key, q: p.q, options: p.options.map((label, i) => ({ key: 'AB'[i], label, n: n[i], pool: p.pool[i] })), open: now() < p.closesAt, closesInMs: Math.max(0, p.closesAt - now()) };
  };
  const purge = prefix => { if (st.predict) for (const id of Object.keys(st.predict.bets)) if (id.startsWith(prefix)) { const b = st.predict.bets[id]; st.predict.pool[b.i] -= b.stake; delete st.predict.bets[id]; } };
  return { open, chat, resolve, tick, view, purge, active: () => st.predict?.key ?? null };
}
