// Two short headliners, one rule each, played by commenting:
//   Đoán vật      (events/guess-object.mjs) a hidden object; a clue every mysteryClueSeconds; the first three right guesses win gems.
//   Hứng sao băng a word rides a falling star each round; the first catchWinners to type it catch it (bụi sao and
//                 starlight); after catchRounds stars, whoever caught most wins a gem.
// Both are EventDefs on the shared blocks; each star is a keyword round (events/keyword-round.mjs).
import { createKeywordRound } from './events/keyword-round.mjs';

export const MINIGAME_DEFAULTS = Object.freeze({
  mysteryClues: 4,
  mysteryClueSeconds: 10,
  mysteryLastSeconds: 12, // after the last clue
  mysteryGems: [2, 1, 1], // 1st, 2nd, 3rd right guess
  catchRounds: 8,
  catchEverySeconds: 7,
  catchWinners: 3,
  catchDust: 3,
  catchLight: 4,
});

export const CATCH_WORDS = Object.freeze(['sao', 'trăng', 'lộc', 'phúc', 'vui', 'may', 'sáng', 'mơ', 'thương', 'an', 'cười', 'mây']);
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').trim();

// reward: events/reward.mjs (dust | light | gem); viewerOf(userId) -> viewer; quest(stat)
// st.starcatch is plain JSON: { round, word, nextAt, score: {userId: {nickname, catches}}, kr } where kr is the current star's keyword round.
export function createStarcatch({ st, cfg, now, rng, onEvent, reward, viewerOf, quest }) {
  const star = c => createKeywordRound({ now, match: (text, word) => norm(text) === norm(word), winners: cfg.catchWinners, windowMs: cfg.catchEverySeconds * 1000 }, c.kr);
  function round(t) {
    const c = st.starcatch;
    c.round++;
    c.word = CATCH_WORDS[Math.floor(rng() * CATCH_WORDS.length + c.round) % CATCH_WORDS.length];
    c.kr = {};
    star(c).open(c.word);
    c.nextAt = t + cfg.catchEverySeconds * 1000;
    onEvent({ type: 'catch-star', round: c.round, of: c.rounds ?? cfg.catchRounds, word: c.word, seconds: cfg.catchEverySeconds });
  }
  function start({ rounds = cfg.catchRounds } = {}) {
    if (st.starcatch) return null;
    st.starcatch = { rounds: Math.max(1, Math.min(cfg.catchRounds, Math.floor(rounds) || cfg.catchRounds)), round: 0, word: null, nextAt: 0, score: {}, kr: {} };
    try { round(now()); } catch (e) { st.starcatch = null; throw e; } // never leave a half-started event
    return st.starcatch;
  }
  function finish() {
    const c = st.starcatch;
    if (!c) return;
    st.starcatch = null;
    const top = Object.entries(c.score).map(([userId, s]) => ({ userId, ...s })).sort((a, b) => b.catches - a.catches).slice(0, 3);
    const best = top[0] && viewerOf(top[0].userId);
    if (best?.team) reward.grant({ userId: top[0].userId }, best, 'gem', 1, 'catch');
    onEvent({ type: 'catch-end', top });
  }
  // true when the line was the star's word (caught, too late, or already caught): the game does not treat it as chat
  function chat(u, v, text) {
    const c = st.starcatch;
    if (!c?.word) return false;
    const kr = star(c);
    const got = kr.submit(u.userId, text);
    if (got === 'miss') return false;
    if (got !== 'win') return norm(text) === norm(c.word);
    const s = (c.score[u.userId] ??= { nickname: v.nickname, catches: 0 });
    s.catches++;
    reward.grant(u, v, 'dust', cfg.catchDust, 'catch');
    if (v.team) reward.grant(u, v, 'light', cfg.catchLight, 'catch');
    quest('catches');
    onEvent({ type: 'catch', userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, rank: kr.winnersList().length, word: c.word, round: c.round });
    return true;
  }
  function tick(t) {
    const c = st.starcatch;
    if (!c || t < c.nextAt) return;
    if (c.round >= (c.rounds ?? cfg.catchRounds)) return finish();
    round(t);
  }
  const view = t => st.starcatch && { round: st.starcatch.round, of: st.starcatch.rounds ?? cfg.catchRounds, word: st.starcatch.word, caught: star(st.starcatch).winnersList().length, need: cfg.catchWinners, nextInMs: Math.max(0, st.starcatch.nextAt - t),
    top: Object.values(st.starcatch.score).sort((a, b) => b.catches - a.catches).slice(0, 3) };
  return { id: 'starcatch', start, chat, tick, view, end: finish, isDone: () => !st.starcatch };
}
