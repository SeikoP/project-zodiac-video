import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuessObject } from './guess-object.mjs';
import { GUESS_BANK } from './guess-bank.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';
import { MINIGAME_DEFAULTS } from '../minigames.mjs';

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').trim();
const BANK = [
  { answer: 'con mèo', aliases: ['mèo', 'meo'], clues: ['Nuôi trong nhà', 'Thích bắt chuột', 'Có ria mép', 'Kêu meo meo'] },
  { answer: 'cái ô', aliases: ['dù', 'cai du'], clues: ['Mang khi trời mưa', 'Có cán cầm', 'Xòe ra che nắng', 'Bật lên là có mái che'] },
];

function room(people = ['a', 'b', 'c', 'd'], config = {}, from = null) {
  let t = 7_000_000;
  const viewers = Object.fromEntries(people.map((id, i) => [id, { nickname: id.toUpperCase(), team: ['red', 'blue', 'green', 'yellow'][i % 4] }]));
  const events = [], paid = [];
  const pay = kind => (u, v, n, why) => { paid.push([u.userId, kind, n, why]); };
  const reward = createReward({ sinks: { light: pay('light'), dust: pay('dust'), gem: pay('gem') } });
  const st = from ?? { guess: null };
  const quests = [];
  const cfg = { ...MINIGAME_DEFAULTS, ...config };
  const guess = createGuessObject({ st, cfg, now: () => t, rng: () => 0, onEvent: e => events.push(e), reward, viewerOf: id => viewers[id], quest: s => quests.push(s), bank: BANK, isCommand: x => /^(nhận|chào|đổi .*)$/.test(x) });
  const say = (id, text) => guess.chat({ userId: id }, viewers[id], text);
  return { st, guess, viewers, events, paid, quests, say, advance: ms => { t += ms; guess.tick(t); }, of: type => events.filter(e => e.type === type), now: () => t };
}

test('starts with the first clue; the answer comes from the bank (or the named one)', () => {
  const r = room();
  const g = r.guess.start();
  assert.ok(g);
  assert.equal(g.answer, 'con mèo');
  assert.deepEqual([r.of('mystery-start')[0].clue, r.of('mystery-start')[0].of], ['Nuôi trong nhà', 4]);
  assert.equal(r.guess.start(), null, 'one at a time');
  const r2 = room();
  assert.equal(r2.guess.start({ answer: 'dù' }).answer, 'cái ô');
  assert.equal(room().guess.start({ answer: 'khủng long' }), null, 'an unknown answer starts nothing');
});

test('a clue every 10 seconds, four in all, then the answer is revealed', () => {
  const r = room();
  r.guess.start();
  r.advance(9_900);
  assert.equal(r.of('mystery-clue').length, 0);
  r.advance(200);
  assert.deepEqual(r.of('mystery-clue').map(c => [c.no, c.text]), [[2, 'Thích bắt chuột']]);
  r.advance(10_000);
  r.advance(10_000);
  assert.deepEqual(r.of('mystery-clue').map(c => c.no), [2, 3, 4]);
  assert.deepEqual(r.guess.view(r.now()).clues, ['Nuôi trong nhà', 'Thích bắt chuột', 'Có ria mép', 'Kêu meo meo']);
  assert.equal(r.of('mystery-end').length, 0);
  r.advance(12_500);
  const end = r.of('mystery-end')[0];
  assert.deepEqual([end.answer, end.winners.length], ['con mèo', 0]);
  assert.equal(r.st.guess, null);
  assert.equal(r.guess.isDone(), true);
});

test('each person guesses once per clue; a new clue gives a new chance', () => {
  const r = room();
  r.guess.start();
  assert.equal(r.say('a', 'con chó'), false, 'a wrong guess is spent but stays ordinary chat');
  assert.equal(r.say('a', 'mèo'), false, 'the second guess on this clue is not taken');
  assert.equal(r.of('mystery-win').length, 0);
  r.advance(10_000);
  assert.equal(r.say('a', 'mèo'), true);
  assert.deepEqual(r.of('mystery-win').map(w => [w.userId, w.rank, w.clue]), [['a', 1, 2]]);
});

test('accents, case, punctuation and aliases all count', () => {
  const r = room();
  r.guess.start();
  r.say('a', '  CON MÈO! ');
  r.say('b', 'meo');
  r.say('c', 'Mèo');
  assert.deepEqual(r.of('mystery-win').map(w => w.userId), ['a', 'b', 'c']);
  const r2 = room();
  r2.guess.start({ answer: 'cái ô' });
  r2.say('a', 'DÙ');
  assert.equal(r2.of('mystery-win').length, 1);
});

test('the first three right guessers win gems 2, 1, 1; then the round ends and the answer shows', () => {
  const r = room();
  r.guess.start();
  r.say('d', 'chó');
  r.advance(10_000);
  for (const id of ['b', 'c', 'a', 'd']) r.say(id, 'mèo');
  assert.deepEqual(r.of('mystery-win').map(w => [w.rank, w.userId]), [[1, 'b'], [2, 'c'], [3, 'a']]);
  assert.deepEqual(r.paid, [['b', 'gem', 2, 'mystery'], ['c', 'gem', 1, 'mystery'], ['a', 'gem', 1, 'mystery']]);
  assert.deepEqual(r.quests, ['correct', 'correct', 'correct']);
  const end = r.of('mystery-end')[0];
  assert.equal(end.answer, 'con mèo');
  assert.deepEqual(end.winners.map(w => w.userId), ['b', 'c', 'a']);
  assert.equal(r.st.guess, null);
  assert.equal(r.say('d', 'mèo'), false, 'nothing is taken after the end');
});

test('a wrong guess changes nobody\'s team; commands and chatter are not guesses', () => {
  const r = room();
  r.guess.start();
  const teams = Object.fromEntries(Object.entries(r.viewers).map(([id, v]) => [id, v.team]));
  assert.equal(r.say('a', 'xanh dương'), false, 'a colour word is just a wrong guess here');
  assert.equal(r.say('b', 'đổi vàng'), false, 'a command goes on to the game');
  assert.equal(r.say('c', 'nhận'), false);
  assert.equal(r.say('d', 'một câu rất dài '.repeat(10)), false, 'chatter is not a guess');
  assert.deepEqual(Object.fromEntries(Object.entries(r.viewers).map(([id, v]) => [id, v.team])), teams);
});

test('works through the registry: chat goes to it, it ends itself', () => {
  const r = room();
  const reg = createRegistry({ now: r.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg.register(r.guess);
  assert.equal(reg.start('guessobject'), true);
  assert.equal(reg.chat({ userId: 'a' }, r.viewers.a, 'mèo'), true);
  for (let i = 0; i < 6; i++) { r.advance(10_000); reg.tick(r.now()); }
  assert.equal(reg.active(), null);
});

test('the placeholder bank is well formed: four clues, the first three do not give the answer away', () => {
  assert.ok(GUESS_BANK.length >= 8);
  for (const e of GUESS_BANK) {
    assert.equal(e.clues.length, 4, e.answer);
    for (const name of [e.answer, ...e.aliases]) {
      for (const c of e.clues.slice(0, 3)) assert.equal(` ${norm(c).replace(/[^a-z0-9 ]/g, ' ')} `.includes(` ${norm(name)} `), false, `${e.answer}: "${c}" contains "${name}"`);
    }
  }
});

test('JSON round trip mid-event: a rebuilt event carries on with the same clue, guesses and winners', () => {
  const r = room();
  r.guess.start();
  r.say('a', 'chó');
  r.advance(10_000);
  r.say('b', 'mèo');
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = room(['a', 'b', 'c', 'd'], {}, saved);
  assert.equal(r2.guess.isDone(), false);
  const reg = createRegistry({ now: r2.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg.register(r2.guess);
  assert.equal(reg.adopt('guessobject'), true);
  assert.equal(r2.say('b', 'mèo'), false, 'b already won');
  assert.equal(r2.say('a', 'mèo'), true, 'a spent clue 1, clue 2 is a fresh chance');
  assert.deepEqual(r2.of('mystery-win').map(w => [w.userId, w.rank]), [['a', 2]]);
  r2.say('c', 'mèo');
  const end = r2.of('mystery-end')[0];
  assert.deepEqual(end.winners.map(w => [w.nickname, w.rank]), [['B', 1], ['A', 2], ['C', 3]]);
});

test('an onEvent that throws during start leaves no half-started round, through the registry', () => {
  const r = room();
  const reg = createRegistry({ now: r.now, onEvent: () => {}, cfg: {}, ctx: {} });
  const st = { guess: null };
  const g = createGuessObject({ st, cfg: { ...MINIGAME_DEFAULTS }, now: r.now, rng: () => 0, onEvent: () => { throw new Error('listener'); }, reward: createReward({}), viewerOf: () => null, bank: BANK });
  reg.register(g);
  assert.equal(reg.start('guessobject'), false);
  assert.equal(reg.active(), null);
  assert.equal(st.guess, null);
});
