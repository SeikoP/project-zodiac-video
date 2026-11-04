// Vòng quay may mắn: the wheel lands on ONE person who is on stage and the show reads a gentle, friendly tease about them
// (teases.mjs). They and their teammates have a short window to protest ("oan!"); everyone else can agree ("chuẩn!").
// Enough protests clear the person (the protesters get starlight); otherwise the tease stands, the agreers get a little
// starlight and the person's team gets the lucky star as consolation — so being picked is never a loss.
//
// An EventDef on the shared blocks: a reactions block counts "oan" / "chuẩn" (one reaction per person) and the reward
// service pays. st.roast is plain JSON: { userId, nickname, avatar, team, line, startedAt, endsAt, need, nick, rx }.
import { createReactions } from './events/reactions.mjs';
import { TEASES } from './teases.mjs';

export const ROAST_DEFAULTS = Object.freeze({
  roastSpinMs: 5000, // how long the wheel spins on screen before the tease shows
  roastSeconds: 25, // the protest window, counted from the start
  roastClearLight: 15, // each protester when the person is cleared
  roastAgreeLight: 3,
});

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
const PROTEST_RE = /^\s*(oan|oan qua|oan uc|phot gia|khong dung|sai roi|vu khong)\b/;
const AGREE_RE = /^\s*(chuan|dung roi|dung qua|qua dung|chuan luon|haha+|kk+|hihi)\b/;

// ctx.roster.present() lists the people on stage; lucky(team) starts the lucky star (null when one is already on)
export function createRoast({ st, cfg, now, rng = Math.random, onEvent, ctx, reward, viewerOf, lucky = () => null, teases = TEASES }) {
  const people = () => ctx.roster.present().filter(([, v]) => v.team);
  // "oan" is for the chosen person and their team, "chuẩn" for everybody else
  const own = (r, userId, v) => userId === r.userId || v?.team === r.team;
  const reactions = r => createReactions({
    groups: {
      oan: (text, c) => c.own && PROTEST_RE.test(text),
      chuan: (text, c) => !c.own && AGREE_RE.test(text),
    },
  }, r.rx);

  const needs = () => people().length > 0;

  // opts.userId: a particular person on stage; otherwise one at random
  function start(opts = {}) {
    if (st.roast) return null;
    const here = people();
    const pick = opts.userId != null ? here.find(([id]) => id === opts.userId) : here[Math.floor(rng() * here.length) % here.length];
    if (!pick || !teases.length) return null;
    const [userId, v] = pick;
    st.roastNo = (st.roastNo ?? 0) + 1;
    const line = teases[(st.roastNo + Math.floor(rng() * teases.length)) % teases.length];
    const sameTeam = here.filter(([, p]) => p.team === v.team).length;
    const t = now();
    const r = { userId, nickname: v.nickname, avatar: v.avatar ?? '', team: v.team, line, startedAt: t, endsAt: t + cfg.roastSeconds * 1000, need: Math.max(1, Math.min(4, Math.ceil(sameTeam / 2))), nick: {}, rx: {} };
    reactions(r); // shapes r.rx
    st.roast = r; // assigned last: a start that throws leaves nothing behind
    onEvent({ type: 'roast-start', userId, nickname: r.nickname, avatar: r.avatar, team: r.team, line, need: r.need, spinMs: cfg.roastSpinMs, seconds: cfg.roastSeconds });
    return r;
  }

  // "oan" / "chuẩn" once the wheel has stopped. True only when the line was taken as a reaction; anything else is ordinary chat.
  function chat(u, v, text) {
    const r = st.roast;
    if (!r || now() < r.startedAt + cfg.roastSpinMs || now() >= r.endsAt) return false;
    const group = reactions(r).react(u.userId, norm(text), { own: own(r, u.userId, v) });
    if (!group) return false;
    r.nick[u.userId] = v?.nickname ?? '';
    return true;
  }

  function finish() {
    const r = st.roast;
    if (!r) return;
    st.roast = null;
    const rx = reactions(r), counts = rx.counts();
    const cleared = counts.oan >= r.need;
    const winners = rx.names(cleared ? 'oan' : 'chuan', Infinity);
    const give = cleared ? cfg.roastClearLight : cfg.roastAgreeLight;
    for (const id of winners) { const v = viewerOf(id); if (v) reward.grant({ userId: id }, v, 'light', give, 'roast'); }
    const consoled = !cleared && lucky(r.team);
    onEvent({ type: 'roast-end', userId: r.userId, nickname: r.nickname, team: r.team, line: r.line, cleared, protests: counts.oan, need: r.need, agree: counts.chuan, names: winners.slice(0, 4).map(id => r.nick[id]), consoled: Boolean(consoled) });
  }

  function tick(t = now()) {
    if (st.roast && t >= st.roast.endsAt) finish();
  }

  const view = () => {
    const r = st.roast;
    if (!r) return null;
    const counts = reactions(r).counts();
    return { userId: r.userId, nickname: r.nickname, avatar: r.avatar, team: r.team, protests: counts.oan, need: r.need, agree: counts.chuan, remainingMs: Math.max(0, r.endsAt - now()), spinning: now() < r.startedAt + cfg.roastSpinMs };
  };

  return { id: 'roast', needs, start, chat, tick, view, end: finish, isDone: () => !st.roast };
}
