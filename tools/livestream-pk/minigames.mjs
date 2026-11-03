// Two short headliners, one rule each, played by commenting:
//   Cung bí ẩn    a hidden sign; a clue every mysteryClueSeconds (element, quality, ruler, symbol, dates). A sign
//                 name is a guess (once per clue each, never a team change); the first three right win gems.
//   Hứng sao băng a word rides a falling star each round; the first catchWinners to type it catch it (bụi sao and
//                 starlight); after catchRounds stars, whoever caught most wins a gem.
import { SIGN_DATA, MODES, ELEMENT_LABEL } from './public/signs.js';

export const MINIGAME_DEFAULTS = Object.freeze({
  mysteryClues: 5,
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
const dm = ([d, m]) => `${d}/${m}`;
// what can be said about a sign without naming it, vaguest first
const CLUES = [
  id => `Thuộc nguyên tố ${ELEMENT_LABEL[ELEMENT_OF[id]]}`,
  id => `Tính chất: ${MODES[SIGN_DATA[id].mode]}`,
  id => `Hành tinh chủ quản: ${SIGN_DATA[id].planet}`,
  id => `Biểu tượng: ${SIGN_DATA[id].symbol}`,
  id => `Sinh từ ${dm(SIGN_DATA[id].from)} đến ${dm(SIGN_DATA[id].to)}`,
];
const ELEMENT_OF = { aries: 'fire', leo: 'fire', sagittarius: 'fire', taurus: 'earth', virgo: 'earth', capricorn: 'earth', gemini: 'air', libra: 'air', aquarius: 'air', cancer: 'water', scorpio: 'water', pisces: 'water' };

// parseSign(text) -> sign id | null; gem(u, v, n, why); dust(u, v, n, why); shine(u, v, n, why); quest(stat)
export function createMystery({ st, cfg, now, rng, onEvent, parseSign, gem, quest }) {
  function start() {
    if (st.mystery) return null;
    const ids = Object.keys(SIGN_DATA), sign = ids[Math.floor(rng() * ids.length)];
    const of = Math.min(cfg.mysteryClues, CLUES.length);
    st.mystery = { sign, clue: 1, of, nextAt: now() + cfg.mysteryClueSeconds * 1000, endsAt: of > 1 ? 0 : now() + cfg.mysteryLastSeconds * 1000, guessed: {}, winners: [] };
    onEvent({ type: 'mystery-start', clue: CLUES[0](sign), of });
    return st.mystery;
  }
  function end() {
    const m = st.mystery;
    st.mystery = null;
    onEvent({ type: 'mystery-end', sign: m.sign, winners: m.winners });
  }
  // a guess while the mystery is on; returns true when the comment named a sign (it never joins or switches a team)
  function chat(u, v, text) {
    const m = st.mystery;
    if (!m) return false;
    const guess = parseSign(text);
    if (!guess) return false;
    if (m.guessed[u.userId] === m.clue || m.winners.some(w => w.userId === u.userId)) return true;
    m.guessed[u.userId] = m.clue;
    if (guess !== m.sign) return true;
    const rank = m.winners.length + 1;
    m.winners.push({ userId: u.userId, nickname: v.nickname, rank });
    if (v.sign) gem(u, v, cfg.mysteryGems[rank - 1] ?? 1, 'mystery');
    quest('correct');
    onEvent({ type: 'mystery-win', rank, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, clue: m.clue });
    if (rank >= cfg.mysteryGems.length) end();
    return true;
  }
  function tick(t) {
    const m = st.mystery;
    if (!m) return;
    if (m.endsAt) { if (t >= m.endsAt) end(); return; }
    if (t < m.nextAt) return;
    m.clue++;
    onEvent({ type: 'mystery-clue', no: m.clue, of: m.of, text: CLUES[m.clue - 1](m.sign) });
    if (m.clue >= m.of) m.endsAt = t + cfg.mysteryLastSeconds * 1000; // the last clue: a little longer, then the answer
    else m.nextAt = t + cfg.mysteryClueSeconds * 1000;
  }
  const view = t => st.mystery && { clues: Array.from({ length: st.mystery.clue }, (_, i) => CLUES[i](st.mystery.sign)), of: st.mystery.of, winners: st.mystery.winners.map(({ nickname, rank }) => ({ nickname, rank })),
    nextInMs: st.mystery.endsAt ? 0 : Math.max(0, st.mystery.nextAt - t), remainingMs: st.mystery.endsAt ? Math.max(0, st.mystery.endsAt - t) : null };
  return { start, chat, tick, view };
}

export function createStarcatch({ st, cfg, now, rng, onEvent, dust, shine, gem, quest }) {
  function round(t) {
    const c = st.starcatch;
    c.round++;
    c.word = CATCH_WORDS[Math.floor(rng() * CATCH_WORDS.length + c.round) % CATCH_WORDS.length];
    c.caught = [];
    c.nextAt = t + cfg.catchEverySeconds * 1000;
    onEvent({ type: 'catch-star', round: c.round, of: cfg.catchRounds, word: c.word, seconds: cfg.catchEverySeconds });
  }
  function start() {
    if (st.starcatch) return null;
    st.starcatch = { round: 0, word: null, caught: [], nextAt: 0, score: {} };
    round(now());
    return st.starcatch;
  }
  function end() {
    const c = st.starcatch;
    st.starcatch = null;
    const top = Object.entries(c.score).map(([userId, s]) => ({ userId, ...s })).sort((a, b) => b.catches - a.catches).slice(0, 3);
    const best = top[0] && st.viewers[top[0].userId];
    if (best?.sign) gem({ userId: top[0].userId }, best, 1, 'catch');
    onEvent({ type: 'catch-end', top });
  }
  function chat(u, v, text) {
    const c = st.starcatch;
    if (!c?.word || norm(text) !== norm(c.word)) return false;
    if (c.caught.includes(u.userId) || c.caught.length >= cfg.catchWinners) return true;
    c.caught.push(u.userId);
    const s = (c.score[u.userId] ??= { nickname: v.nickname, catches: 0 });
    s.catches++;
    dust(u, v, cfg.catchDust, 'catch');
    if (v.sign) shine(u, v, cfg.catchLight, 'catch');
    quest('catches');
    onEvent({ type: 'catch', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, rank: c.caught.length, word: c.word, round: c.round });
    return true;
  }
  function tick(t) {
    const c = st.starcatch;
    if (!c || t < c.nextAt) return;
    if (c.round >= cfg.catchRounds) return end();
    round(t);
  }
  const view = t => st.starcatch && { round: st.starcatch.round, of: cfg.catchRounds, word: st.starcatch.word, caught: st.starcatch.caught.length, need: cfg.catchWinners, nextInMs: Math.max(0, st.starcatch.nextAt - t),
    top: Object.values(st.starcatch.score).sort((a, b) => b.catches - a.catches).slice(0, 3) };
  return { start, chat, tick, view };
}
