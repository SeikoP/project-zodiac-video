import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuiz } from './quiz.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';

const BANK = [
  { q: 'Mặt trời mọc hướng nào?', options: ['Tây', 'Đông', 'Nam', 'Bắc'], answer: 'B' },
  { q: '2 + 2 = ?', options: ['3', '4', '5', '6'], answer: 'B' },
];

function room(config = {}, from = null, bank = BANK) {
  let t = 9_000_000;
  const viewers = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { nickname: id.toUpperCase(), team: ['red', 'blue', 'green', 'yellow', 'red'][i] }]));
  const events = [], paid = [], quests = [], thanked = [], seen = [], touched = [];
  const pay = kind => (u, v, n, why) => { paid.push([u.userId, kind, n, why]); };
  const reward = createReward({ sinks: { light: pay('light'), dust: pay('dust'), gem: pay('gem') } });
  const st = from ?? { quiz: null, quizCursor: 0 };
  const cfg = { quizSeconds: 12, quizRewards: [40, 25, 15], ...config };
  const quiz = createQuiz({ st, cfg, now: () => t, onEvent: e => events.push(e), reward, quest: s => quests.push(s), touch: p => touched.push(p), thank: (u, v) => thanked.push(u.userId), bank, onAnswer: (u, v, letter) => seen.push([u.userId, letter]) });
  const say = (id, text) => quiz.chat({ userId: id }, viewers[id], text);
  return { st, quiz, viewers, events, paid, quests, thanked, seen, touched, say, now: () => t, advance: ms => { t += ms; quiz.tick(t); }, of: type => events.filter(e => e.type === type) };
}

test('an empty bank starts nothing', () => {
  assert.equal(room({}, null, []).quiz.start(), false);
});

test('the first three right answers get +40/+25/+15 light and a gem; one answer each, wrong ones count as the try', () => {
  const r = room();
  assert.ok(r.quiz.start());
  assert.equal(r.of('quiz-start').length, 1);
  assert.equal(r.say('a', 'a'), true, 'wrong answer');
  assert.equal(r.say('a', 'B'), false, 'a already used the one answer');
  assert.equal(r.say('b', ' b '), true);
  assert.equal(r.say('c', 'B'), true);
  assert.equal(r.say('b', 'B'), false, 'only one answer each');
  assert.equal(r.say('d', 'B'), true);
  assert.equal(r.say('e', 'B'), true, 'a fourth right answer is taken but pays nothing');
  assert.equal(r.say('e', 'xin chào'), false, 'not an answer');
  assert.deepEqual(r.paid, [['b', 'light', 40, 'quiz'], ['b', 'gem', 1, 'quiz'], ['c', 'light', 25, 'quiz'], ['c', 'gem', 1, 'quiz'], ['d', 'light', 15, 'quiz'], ['d', 'gem', 1, 'quiz']]);
  assert.deepEqual(r.st.quiz.winners.map(w => [w.nickname, w.reward]), [['B', 40], ['C', 25], ['D', 15]]);
  assert.deepEqual(r.thanked, ['b', 'c', 'd']);
  assert.equal(r.quests.length, 4, 'every right answer fills the room goal');
  assert.deepEqual(r.seen.map(s => s[1]), ['A', 'B', 'B', 'B', 'B']);
});

test('ends after 12 seconds with the answer and the winners; the next question follows the cursor', () => {
  const r = room();
  r.quiz.start();
  r.say('c', 'B');
  r.advance(11_900);
  assert.equal(r.of('quiz-end').length, 0);
  r.advance(200);
  const end = r.of('quiz-end')[0];
  assert.deepEqual([end.answer, end.answerText, end.winners.length], ['B', 'Đông', 1]);
  assert.equal(r.st.quiz, null);
  assert.equal(r.quiz.isDone(), true);
  assert.ok(r.touched.includes('hud'));
  r.quiz.start();
  assert.equal(r.st.quiz.q, '2 + 2 = ?');
  assert.equal(r.st.quizCursor, 2);
});

test('registered in the registry; JSON round trip mid-quiz keeps answers and winners', () => {
  const r = room();
  const reg = createRegistry({ now: r.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg.register(r.quiz);
  assert.equal(reg.start('quiz'), true);
  r.say('a', 'A');
  r.say('b', 'B');
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = room({}, saved);
  const reg2 = createRegistry({ now: r2.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg2.register(r2.quiz);
  assert.equal(reg2.adopt('quiz'), true);
  assert.equal(r2.say('a', 'B'), false, 'a had answered');
  assert.equal(r2.say('b', 'B'), false, 'b had answered');
  assert.equal(r2.say('c', 'B'), true);
  assert.deepEqual(r2.paid.filter(p => p[1] === 'light'), [['c', 'light', 25, 'quiz']], 'c is second');
  r2.advance(13_000);
  assert.equal(r2.of('quiz-end')[0].winners.length, 2);
});
