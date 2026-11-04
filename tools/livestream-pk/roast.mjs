// Vòng quay may mắn: the wheel lands on ONE person who is on stage and the show reads a gentle, friendly tease about them
// (teases.mjs). They and their teammates have a short window to protest ("oan!"); everyone else can agree ("chuẩn!").
// Enough protests clear the person (the protesters get starlight); otherwise the tease stands, the agreers get a little
// starlight and the person's team gets the lucky star as consolation — so being picked is never a loss.
//
// An EventDef on the shared blocks: a reactions block counts "oan" / "chuẩn" (one reaction per person) and the reward
// service pays. st.roast is plain JSON: { userId, nickname, avatar, team, line, startedAt, endsAt, need, nick, rx, respun?, pick? }.
// Gift abilities: tickets (st.roastTickets[userId], weight 1 + tickets in the next pick, spent when picked), the giver's pick of the
// team (r.pick = { userId, team, until }) and a re-roll of the whole wheel (once per wheel, r.respun).
import { createReactions } from './events/reactions.mjs';
import { TEASES } from './teases.mjs';
import { parseTeam } from './events/teams.mjs';
import { ABILITY_DEFAULTS } from './events/abilities.mjs';

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

  st.roastTickets ??= {};
  const tickets = id => Math.max(0, st.roastTickets[id] | 0);
  // one person from `pool`, each weighted 1 + their tickets (with no tickets this is the plain uniform pick)
  function choose(pool) {
    const total = pool.reduce((n, [id]) => n + 1 + tickets(id), 0);
    let r = rng() * total;
    for (const e of pool) {
      r -= 1 + tickets(e[0]);
      if (r < 0) return e;
    }
    return pool[pool.length - 1];
  }

  // Puts the wheel on `pick` ([userId, viewer]) among `here`; extra marks a re-roll. Returns the new roast.
  function spin(here, pick, extra = {}) {
    const [userId, v] = pick;
    st.roastNo = (st.roastNo ?? 0) + 1;
    const line = teases[(st.roastNo + Math.floor(rng() * teases.length)) % teases.length];
    const sameTeam = here.filter(([, p]) => p.team === v.team).length;
    const t = now();
    const r = { userId, nickname: v.nickname, avatar: v.avatar ?? '', team: v.team, line, startedAt: t, endsAt: t + cfg.roastSeconds * 1000, need: Math.max(1, Math.min(4, Math.ceil(sameTeam / 2))), nick: {}, rx: {} };
    reactions(r); // shapes r.rx
    if (extra.respun) r.respun = true;
    delete st.roastTickets[userId]; // the tickets are spent when the wheel lands on them
    st.roast = r; // assigned last: a start that throws leaves nothing behind
    onEvent({ type: 'roast-start', userId, nickname: r.nickname, avatar: r.avatar, team: r.team, line, need: r.need, spinMs: cfg.roastSpinMs, seconds: cfg.roastSeconds, ...(extra.respun && { again: true }) });
    return r;
  }

  // opts.userId: a particular person on stage; otherwise one at random (more likely with tickets)
  function start(opts = {}) {
    if (st.roast) return null;
    const here = people();
    const pick = opts.userId != null ? here.find(([id]) => id === opts.userId) : here.length ? choose(here) : null;
    if (!pick || !teases.length) return null;
    return spin(here, pick);
  }

  // The whole wheel again (once per wheel): a team narrows the pick to its people on stage, the person it just landed on is spared.
  function respin(team = null) {
    const r = st.roast;
    if (!r || r.respun) return false;
    const here = people();
    const pool = [here.filter(([id, v]) => (!team || v.team === team) && id !== r.userId), here.filter(([id]) => id !== r.userId), here].find(p => p.length);
    if (!pool || !teases.length) return false;
    spin(here, choose(pool), { respun: true });
    return true;
  }

  // "oan" / "chuẩn" once the wheel has stopped. True only when the line was taken as a reaction; anything else is ordinary chat.
  function chat(u, v, text) {
    const r = st.roast;
    // the giver of the "pick" ability names the team: a colour name is taken for the pick and never as a team switch
    if (r?.pick && r.pick.userId === u.userId && now() < r.pick.until) {
      const team = /^\s*[1-4]\s*$/.test(text) ? null : parseTeam(text); // a bare digit is a vote or a team pick for the newcomer, not this
      if (team && respin(people().some(([, p]) => p.team === team) ? team : r.pick.team)) return true;
    }
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
    onEvent({ type: 'roast-end', userId: r.userId, nickname: r.nickname, team: r.team, line: r.line, cleared, protests: counts.oan, need: r.need, agree: counts.chuan, names: winners.slice(0, 4).map(id => r.nick[id]), consoled: Boolean(consoled), mvpId: winners[0] ?? null });
  }

  function tick(t = now()) {
    const r = st.roast;
    if (r?.pick && t >= r.pick.until) { const team = r.pick.team; r.pick = null; respin(team); } // no colour named: the giver's own team
    if (st.roast && t >= st.roast.endsAt) finish();
  }

  // --- gift abilities (events/abilities.mjs) ---
  // small: +1 ticket; mid: the giver picks the team the wheel lands on; big: the wheel rolls again. The re-roll happens once per wheel.
  const num = k => cfg[k] ?? ABILITY_DEFAULTS[k];
  const gift = {
    small: g => {
      if (!g.user?.userId || !g.viewer?.team) return false;
      st.roastTickets[g.user.userId] = tickets(g.user.userId) + 1;
    },
    mid: g => {
      const r = st.roast;
      if (!r || r.respun || r.pick || !g.viewer?.team) return false;
      const until = now() + num('roastPickSeconds') * 1000;
      r.pick = { userId: g.user.userId, team: g.viewer.team, until };
      r.endsAt = Math.max(r.endsAt, until + 1000); // the wheel waits for the pick
    },
    big: () => respin(null) || false,
  };

  const view = () => {
    const r = st.roast;
    if (!r) return null;
    const counts = reactions(r).counts();
    return { userId: r.userId, nickname: r.nickname, avatar: r.avatar, team: r.team, protests: counts.oan, need: r.need, agree: counts.chuan, remainingMs: Math.max(0, r.endsAt - now()), spinning: now() < r.startedAt + cfg.roastSpinMs };
  };

  return { id: 'roast', needs, start, chat, tick, gift, view, end: finish, isDone: () => !st.roast };
}
