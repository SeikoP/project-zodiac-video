// Kéo co cung: the two signs with the most fans on stage pull a rope of starlight. Comments, hearts, follows and gifts
// pull for your own sign; a small team pulls harder per person so it still has a chance. A short warm-up first, while
// the room predicts the winner (predict.mjs). The knot reaching either end wins early; otherwise the side it leans to.
// A big pull gets a "giật mạnh!" moment with the puller's name — the rope is the spectacle, nothing is asked for.

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

export function createTug({ st, cfg, now, onEvent, present, shine }) {
  function start() {
    if (st.tug) return null;
    const fans = {};
    for (const [, v] of present()) if (v.sign) fans[v.sign] = (fans[v.sign] ?? 0) + 1;
    const top = Object.entries(fans).sort((x, y) => y[1] - x[1]);
    if (top.length < 2) return null;
    const t = now(), [a, b] = [top[0][0], top[1][0]];
    st.tug = { a, b, pos: 0, startsAt: t + cfg.tugWarmupSeconds * 1000, endsAt: t + (cfg.tugWarmupSeconds + cfg.tugSeconds) * 1000, power: {}, names: {}, last: {} };
    onEvent({ type: 'tug-start', a, b, warmup: cfg.tugWarmupSeconds, seconds: cfg.tugSeconds });
    return st.tug;
  }

  // One action for the viewer's side. kind: comment | like | gift | follow | share; n: likes, or diamonds for a gift.
  function pull(u, v, kind, n = 0) {
    const g = st.tug;
    if (!g || now() < g.startsAt || (v.sign !== g.a && v.sign !== g.b)) return 0;
    let p = 0;
    if (kind === 'comment') {
      if (now() - (g.last[u.userId] ?? 0) < cfg.tugCommentCooldownMs) return 0;
      g.last[u.userId] = now();
      p = cfg.tugCommentPower;
    } else if (kind === 'like') p = n * cfg.tugLikePower;
    else if (kind === 'gift') p = Math.max(3, n * cfg.tugDiamondPower);
    else if (kind === 'follow' || kind === 'share') p = cfg.tugSocialPower;
    if (!p) return 0;
    // the smaller team pulls harder per person (between x0.5 and x2), so a sign with two fans can still win
    const here = present(), mine = here.filter(([, x]) => x.sign === v.sign).length || 1, theirs = here.filter(([, x]) => x.sign === (v.sign === g.a ? g.b : g.a)).length || 1;
    p *= Math.min(2, Math.max(0.5, Math.sqrt(theirs / mine)));
    const dir = v.sign === g.a ? -1 : 1;
    g.pos = Math.max(-100, Math.min(100, g.pos + dir * p));
    g.power[u.userId] = (g.power[u.userId] ?? 0) + p;
    g.names[u.userId] = [v.nickname, v.sign];
    if (kind === 'gift' && p >= 10) onEvent({ type: 'tug-yank', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, power: Math.round(p) });
    if (Math.abs(g.pos) >= 100) end();
    return p;
  }

  function end() {
    const g = st.tug;
    if (!g) return;
    st.tug = null;
    const winner = g.pos < 0 ? g.a : g.pos > 0 ? g.b : null;
    const pullers = Object.entries(g.power).sort((x, y) => y[1] - x[1]);
    for (const [id] of pullers) shine(id, g.names[id][1] === winner ? cfg.tugWinLight : cfg.tugJoinLight, 'tug');
    const mvp = side => { const e = pullers.find(([id]) => g.names[id][1] === side); return e ? { nickname: g.names[e[0]][0], power: Math.round(e[1]) } : null; };
    onEvent({ type: 'tug-end', a: g.a, b: g.b, winner, pos: Math.round(g.pos), pullers: pullers.length, mvpA: mvp(g.a), mvpB: mvp(g.b), early: Math.abs(g.pos) >= 100 });
  }

  function tick() { if (st.tug && now() >= st.tug.endsAt) end(); }

  const view = () => {
    const g = st.tug;
    if (!g) return null;
    const t = now(), side = s => Object.entries(g.power).filter(([id]) => g.names[id][1] === s).length;
    return { a: g.a, b: g.b, pos: Math.round(g.pos), warmupMs: Math.max(0, g.startsAt - t), remainingMs: Math.max(0, g.endsAt - t), pullersA: side(g.a), pullersB: side(g.b) };
  };
  return { start, pull, tick, view, end };
}
