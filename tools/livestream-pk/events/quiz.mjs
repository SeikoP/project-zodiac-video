// Câu đố — a multiple-choice question for quizSeconds. Everyone answers once (A-D; a wrong answer uses the try); the first
// cfg.quizRewards.length right answers earn that much starlight and a gem. A keyword round decides who is first.
//
// An EventDef on the shared blocks. st.quiz is plain JSON: the bank item plus { endsAt, answered: {userId: letter},
// winners: [{nickname, team, reward}] (what the overlay shows), kr }. st.quizCursor walks the bank.
import { createKeywordRound } from './keyword-round.mjs';

const letterOf = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').trim().toUpperCase();

// onAnswer(u, v, letter, q) runs for every first answer (the quiz chain tallies streaks there); thank(u, v) puts a right
// answerer on the thank-you wall; touch(part) tells the snapshot a part moved.
export function createQuiz({ st, cfg, now, onEvent, reward, quest = () => {}, touch = () => {}, thank = () => {}, bank, onAnswer = () => {} }) {
  const round = q => createKeywordRound({ now, match: (text, answer) => letterOf(text) === answer, winners: cfg.quizRewards.length, windowMs: cfg.quizSeconds * 1000 }, q.kr);

  function start() {
    if (st.quiz) return null;
    if (!bank.length) return false;
    const item = bank[st.quizCursor++ % bank.length];
    const q = st.quiz = { ...item, endsAt: now() + cfg.quizSeconds * 1000, answered: {}, winners: [], kr: {} };
    round(q).open(q.answer);
    touch('hud');
    onEvent({ type: 'quiz-start' });
    return q;
  }

  function chat(u, v, text) {
    const q = st.quiz;
    const letter = letterOf(text);
    if (!q || !/^[A-D]$/.test(letter) || q.answered[u.userId]) return false;
    q.answered[u.userId] = letter;
    touch('hud');
    onAnswer(u, v, letter, q);
    if (letter !== q.answer) return true;
    quest('correct');
    const kr = round(q);
    if (kr.submit(u.userId, text) !== 'win') return true; // a fourth right answer is taken but pays nothing
    const prize = cfg.quizRewards[kr.winnersList().length - 1];
    q.winners.push({ nickname: v.nickname, team: v.team, reward: prize });
    thank(u, v);
    reward.grant(u, v, 'light', prize, 'quiz');
    reward.grant(u, v, 'gem', 1, 'quiz');
    return true;
  }

  function finish() {
    const q = st.quiz;
    if (!q) return;
    st.quiz = null;
    touch('hud');
    onEvent({ type: 'quiz-end', answer: q.answer, answerText: q.options['ABCD'.indexOf(q.answer)], winners: q.winners });
  }

  function tick(t) {
    if (st.quiz && t >= st.quiz.endsAt) finish();
  }

  return { id: 'quiz', start, chat, tick, end: finish, isDone: () => !st.quiz };
}
