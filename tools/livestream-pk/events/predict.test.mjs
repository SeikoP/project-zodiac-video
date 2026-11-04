import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredict, PREDICT_DEFAULTS } from '../predict.mjs';
import { createReward } from './reward.mjs';
import { createGame } from '../game.mjs';

function rig(config = {}, from = null) {
  let t = 1_000_000;
  const events = [], paid = [];
  const st = from ?? { viewers: {}, predict: null };
  const reward = createReward({ sinks: { dust: (u, v, n, why) => { paid.push([u.userId, n, why]); v.bag.dust += n; } } });
  const p = createPredict({ st, cfg: { ...PREDICT_DEFAULTS, ...config }, now: () => t, onEvent: e => events.push(e), reward });
  for (const id of ['a', 'b', 'c', 'd']) st.viewers[id] ??= { nickname: id.toUpperCase(), bag: { dust: 0 } };
  return { st, p, events, paid, say: (id, text) => p.chat({ userId: id }, st.viewers[id], text), at: ms => { t = ms; }, now: () => t, of: type => events.filter(e => e.type === type) };
}
const open = r => r.p.open({ key: 'k', q: 'Ai thắng?', options: ['Đỏ', 'Xanh'], closesAt: r.now() + 10_000 });

test('one guess per person: "đoán A" / "đoán B" (also 1 / 2), a second line is taken and ignored', () => {
  const r = rig();
  open(r);
  assert.equal(r.say('a', 'doan a'), true);
  assert.equal(r.say('a', 'doan b'), true, 'taken as a guess line but not counted');
  assert.equal(r.say('b', 'du doan 2'), true);
  assert.equal(r.say('c', 'xin chao'), false, 'not a guess: ordinary chat');
  assert.deepEqual(r.p.view().options.map(o => o.n), [1, 1]);
  assert.deepEqual(Object.fromEntries(Object.entries(r.st.predict.bets).map(([id, b]) => [id, b.i])), { a: 0, b: 1 });
});

test('the guesses live in a reactions block (a / b), not in hand-made lists', () => {
  const r = rig();
  open(r);
  r.say('a', 'doan a'); r.say('b', 'doan b'); r.say('c', 'doan a');
  assert.deepEqual(r.st.predict.rx.byGroup, { a: ['a', 'c'], b: ['b'] });
  assert.deepEqual(r.st.predict.rx.users, ['a', 'b', 'c']);
});

test('closed windows take nothing', () => {
  const r = rig();
  open(r);
  r.at(r.now() + 10_000);
  assert.equal(r.say('a', 'doan a'), false);
});

test('correct predictors get predictBonus dust through the reward service; the wrong ones nothing', () => {
  const r = rig({ predictBonus: 12 });
  open(r);
  r.say('a', 'doan a'); r.say('b', 'doan b'); r.say('c', 'doan a');
  r.p.resolve('k', 0);
  assert.deepEqual(r.paid, [['a', 12, 'predict'], ['c', 12, 'predict']]);
  const end = r.of('predict-end')[0];
  assert.deepEqual([end.winner, end.answer, end.guesses, end.right], [0, 'Đỏ', 3, 2]);
  assert.equal(r.st.predict, null);
});

test('JSON round trip mid-prediction keeps who guessed what', () => {
  const r = rig();
  open(r);
  r.say('a', 'doan a'); r.say('b', 'doan b');
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = rig({}, saved);
  assert.equal(r2.say('a', 'doan b'), true);
  assert.equal(r2.say('c', 'doan b'), true);
  assert.deepEqual(r2.p.view().options.map(o => o.n), [1, 2]);
  r2.p.resolve('k', 1);
  assert.deepEqual(r2.paid.map(p => p[0]), ['b', 'c']);
});

test('in the game: a prediction opened before the tug takes "đoán A" and pays the right guess', () => {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6 }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương']]) game.chat({ userId: id, nickname: id, comment: team });
  game.state.viewers.a.bag.dust = 50;
  const g = game.startTug();
  assert.ok(g);
  const mine = g.a === 'red' ? 'đoán A' : 'đoán B';
  game.chat({ userId: 'a', nickname: 'a', comment: mine });
  game.chat({ userId: 'a', nickname: 'a', comment: 'đoán B' });
  assert.equal(game.state.predict.bets.a.i, mine === 'đoán A' ? 0 : 1);
  assert.deepEqual(game.state.predict.rx.users, ['a']);
  const saved = JSON.parse(JSON.stringify(game.state));
  const again = createGame({ state: saved, config: { acts: false }, now: () => t, rng: () => 0, onEvent: () => {} });
  assert.equal(again.snapshot().cosmos.predict.options.reduce((s, o) => s + o.n, 0), 1);
});
