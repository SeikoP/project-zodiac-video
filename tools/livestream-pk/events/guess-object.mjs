// Đoán vật — the room guesses a hidden object or animal from clues. A clue lands every mysteryClueSeconds (the first at the
// start); each person may guess once per clue; the first three right guesses win gems (cfg.mysteryGems, 2·1·1). When three
// have guessed it, or the clues run out, the answer is revealed. A guess never changes anyone's team.
//
// An EventDef on the shared blocks: a keyword round decides who guessed right (first N, nobody twice) and the reward service
// pays. st.guess is plain JSON: { answer, aliases, clues, clue, of, nextAt, endsAt, guessed: {userId: clueNo}, nick, kr }.
// Event names stay mystery-start | mystery-clue | mystery-win | mystery-end (the overlay already listens to them);
// mystery-end now carries `answer` (the old `team` is gone with the signs).
import { createKeywordRound } from './keyword-round.mjs';
import { GUESS_BANK } from './guess-bank.mjs';

export const normGuess = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const MAX_GUESS_LENGTH = 40;

// rng() -> [0, 1); isCommand(text) -> true for lines the game handles itself ("nhận", "chào", "đổi …"), which are never guesses
export function createGuessObject({ st, cfg, now, rng = Math.random, onEvent, reward, viewerOf, quest = () => {}, isCommand = () => false, bank = GUESS_BANK }) {
  const gems = () => cfg.mysteryGems;
  const round = g => createKeywordRound({ now, match: (text, accepted) => accepted.includes(normGuess(text)), winners: gems().length, windowMs: Number.MAX_SAFE_INTEGER }, g.kr);

  function start(opts = {}) {
    if (st.guess || !bank.length) return null;
    const wanted = opts.answer && normGuess(opts.answer);
    const entry = wanted ? bank.find(e => [e.answer, ...e.aliases].some(a => normGuess(a) === wanted)) : bank[Math.floor(rng() * bank.length) % bank.length];
    if (!entry) return null;
    const of = Math.min(cfg.mysteryClues, entry.clues.length);
    const g = st.guess = { answer: entry.answer, aliases: [...entry.aliases], clues: entry.clues.slice(0, of), clue: 1, of, nextAt: now() + cfg.mysteryClueSeconds * 1000, endsAt: of > 1 ? 0 : now() + cfg.mysteryLastSeconds * 1000, guessed: {}, nick: {}, kr: {} };
    round(g).open([g.answer, ...g.aliases].map(normGuess));
    onEvent({ type: 'mystery-start', clue: g.clues[0], of });
    return g;
  }

  function winners(g) {
    return round(g).winnersList().map((userId, i) => ({ userId, nickname: g.nick[userId], rank: i + 1 }));
  }

  function finish() {
    const g = st.guess;
    if (!g) return;
    st.guess = null;
    onEvent({ type: 'mystery-end', answer: g.answer, winners: winners(g) });
  }

  // A guess while the event is on. Returns true when the line was taken as a guess (so the game does not also treat it as chat).
  function chat(u, v, text) {
    const g = st.guess;
    if (!g || isCommand(text)) return false;
    const guess = normGuess(text);
    if (!guess || String(text).length > MAX_GUESS_LENGTH) return false;
    const kr = round(g);
    if (g.guessed[u.userId] === g.clue || kr.winnersList().includes(u.userId)) return false;
    g.guessed[u.userId] = g.clue;
    if (kr.submit(u.userId, text) !== 'win') return true;
    const rank = kr.winnersList().length;
    g.nick[u.userId] = v.nickname;
    reward.grant(u, v, 'gem', gems()[rank - 1] ?? 1, 'mystery');
    quest('correct');
    onEvent({ type: 'mystery-win', rank, userId: u.userId, nickname: v.nickname, avatar: v.avatar, team: v.team, clue: g.clue });
    if (rank >= gems().length) finish();
    return true;
  }

  function tick(t) {
    const g = st.guess;
    if (!g) return;
    if (g.endsAt) { if (t >= g.endsAt) finish(); return; }
    if (t < g.nextAt) return;
    g.clue++;
    onEvent({ type: 'mystery-clue', no: g.clue, of: g.of, text: g.clues[g.clue - 1] });
    if (g.clue >= g.of) g.endsAt = t + cfg.mysteryLastSeconds * 1000; // the last clue: a little longer, then the answer
    else g.nextAt = t + cfg.mysteryClueSeconds * 1000;
  }

  const view = t => {
    const g = st.guess;
    return g && { clues: g.clues.slice(0, g.clue), of: g.of, winners: winners(g).map(({ nickname, rank }) => ({ nickname, rank })),
      nextInMs: g.endsAt ? 0 : Math.max(0, g.nextAt - t), remainingMs: g.endsAt ? Math.max(0, g.endsAt - t) : null };
  };

  return { id: 'guessobject', start, chat, tick, view, end: finish, isDone: () => !st.guess };
}
