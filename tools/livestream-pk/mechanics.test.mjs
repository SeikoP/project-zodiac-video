import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { createPredict, PREDICT_DEFAULTS } from './predict.mjs';
import { createReward } from './events/reward.mjs';
import { passReward } from './pass.mjs';

function setup(config = {}) {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { t += ms; game.tick(); };
  return { game, events, say, seat: seatIn(game), advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}
// a viewer already on `team` and on stage, whatever the balance would have said (events/roster.mjs redirects a crowded team)
const seatIn = game => (id, team) => {
  game.state.viewers[id] = { nickname: id.toUpperCase(), avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
  game.like({ userId: id, nickname: id.toUpperCase(), count: 0 });
};

test('kéo co: the two biggest teams pull after a warm-up; gifts give a big, named pull; the leaning side wins', () => {
  const s = setup();
  for (const [id, team] of [['a', 'red'], ['b', 'red'], ['c', 'blue'], ['d', 'blue'], ['e', 'green']]) s.seat(id, team);
  const g = s.game.startTug();
  assert.deepEqual([g.a, g.b].sort(), ['blue', 'red']);
  s.say('a', 'kéo!'); // still warming up
  assert.equal(s.game.state.tug.value, 0);
  s.advance(16_000);
  s.game.gift({ userId: 'c', nickname: 'C', diamonds: 10, count: 1, giftName: 'Rose' });
  assert.equal(s.of('tug-yank').length, 1);
  s.say('a', 'kéo!');
  s.advance(80_000);
  const end = s.of('tug-end')[0];
  assert.equal(end.winner, 'blue');
  assert.equal(end.mvpB?.nickname ?? end.mvpA?.nickname, end.winner === g.b ? end.mvpB.nickname : end.mvpA.nickname);
});

test('dự đoán: guessing is free ("đoán A"), one guess each, and a right guess pays bụi sao', () => {
  const s = setup();
  for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương']]) s.say(id, team);
  s.v('a').bag.dust = 50; s.v('b').bag.dust = 50;
  const g = s.game.startTug();
  const redIs = g.a === 'red' ? 'a' : 'b', blueIs = redIs === 'a' ? 'b' : 'a';
  s.say('a', `đoán ${redIs}`);
  s.say('b', `đoán ${blueIs}`);
  s.say('a', `đoán ${blueIs}`); // a second guess is ignored
  assert.equal(s.v('a').bag.dust, 50); // nothing staked
  assert.deepEqual(s.game.snapshot().cosmos.predict.options.map(o => o.n), [1, 1]);
  s.advance(16_000);
  for (let i = 0; i < 8; i++) { s.say('a', `kéo ${i}`); s.advance(1600); }
  s.advance(80_000);
  const end = s.of('predict-end')[0];
  assert.equal(end.answer, 'Đỏ');
  assert.equal(end.right, 1);
  assert.ok(s.v('a').bag.dust > 50);
});

test('sổ sao: starlight is experience; levels pay out and 10 brings a silver frame', () => {
  const s = setup({ passXpPerLevel: 1 });
  s.say('a', 'đỏ');
  for (let i = 0; i < 12; i++) { s.advance(6000); s.say('a', `chào ${i}`); }
  const ups = s.of('pass-up');
  assert.ok(ups.length >= 4);
  assert.ok(s.v('a').bag.dust > 0);
  assert.equal(passReward(10).frame, 'silver');
  assert.equal(passReward(30).frame, 'star');
  s.say('a', 'sổ sao');
  assert.equal(s.of('vault')[0].pass.level, s.v('a').pass.level);
  assert.equal(s.game.snapshot().stage.find(x => x.userId === 'a').frame, s.v('a').pass.level >= 10 ? 'silver' : null);
});

test('chest: each "nhận" pays 15 bụi sao once per chest', () => {
  const s = setup({ chestEveryMinutes: 15 });
  s.say('a', 'đỏ');
  const before = s.v('a').bag.dust;
  s.game.openChest();
  s.say('a', 'nhận');
  s.say('a', 'nhận');
  assert.equal(s.v('a').bag.dust - before >= 15 && s.v('a').bag.dust - before < 30, true);
  assert.equal(s.events.filter(e => e.type === 'card').length, 0);
});

test('a gift leaves a golden aura on the giver and grows a patron star', () => {
  const s = setup();
  s.say('a', 'đỏ');
  s.game.gift({ userId: 'a', nickname: 'A', diamonds: 100, count: 1, giftName: 'Rose' });
  const snap = s.game.snapshot();
  assert.ok(snap.stage.find(x => x.userId === 'a').aura > 0);
  assert.equal(snap.stars.find(x => x.userId === 'a').patron, 2);
});

test('"Xoá toàn bộ" also clears a tug, a prediction and a headliner in play', () => {
  const s = setup();
  for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương'], ['c', 'xanh lá']]) s.say(id, team);
  s.game.startTug();
  s.game.resetAll();
  for (const k of ['tug', 'predict', 'guess', 'starcatch', 'roast', 'head', 'quest']) assert.equal(s.game.state[k], null, k);
});

// predict on its own: a bare state, a fixed clock, events collected
function predictRig(config = {}) {
  let t = 0;
  const events = [];
  const st = { viewers: {}, predict: null };
  const reward = createReward({ sinks: { dust: (u, v, n) => { v.bag.dust += n; } } });
  const p = createPredict({ st, cfg: { ...PREDICT_DEFAULTS, ...config }, now: () => t, onEvent: e => events.push(e), reward });
  const join = (id, dust) => (st.viewers[id] = { nickname: id, bag: { dust, fire: 0, earth: 0, air: 0, water: 0, moon: 0 } });
  p.open({ key: 'k', q: 'Ai thắng?', options: ['A', 'B'], closesAt: 10_000 });
  return { st, p, join, events, guess: (id, c) => p.chat({ userId: id }, st.viewers[id], c), at: ms => { t = ms; }, dust: id => st.viewers[id].bag.dust };
}

test('predict: with a stake and nobody right, everyone gets the stake back', () => {
  const r = predictRig({ predictStake: 5 });
  r.join('a', 20); r.join('b', 20);
  r.guess('a', 'doan a'); r.guess('b', 'doan a');
  assert.deepEqual([r.dust('a'), r.dust('b')], [15, 15]);
  r.p.resolve('k', 1);
  assert.deepEqual([r.dust('a'), r.dust('b')], [20, 20]);
  const end = r.events.find(e => e.type === 'predict-end');
  assert.deepEqual([end.winner, end.answer, end.right], [1, 'B', 0]);
});

test('predict: payouts never exceed the pot plus the bonuses', () => {
  const r = predictRig({ predictStake: 5, predictBonus: 10 });
  r.join('a', 0); r.join('b', 20); r.join('c', 20);
  r.guess('a', 'doan a'); r.guess('b', 'doan b'); r.guess('c', 'doan b');
  const before = 0 + 20 + 20;
  r.p.resolve('k', 0);
  const gained = r.dust('a') + r.dust('b') + r.dust('c') - before;
  assert.ok(gained <= 10, `paid out ${gained} more than the bonus`);
  assert.ok(r.dust('a') >= 10);
});

test('predict: several right guessers each get the bonus; second guesses, late guesses and gone viewers are handled', () => {
  const r = predictRig();
  for (const id of ['a', 'b', 'c', 'd']) r.join(id, 0);
  r.guess('a', 'doan a'); r.guess('b', 'doan 1'); r.guess('c', 'doan b');
  r.guess('a', 'doan b'); // only the first guess counts
  r.at(10_000);
  assert.equal(r.guess('d', 'doan a'), false, 'closed');
  delete r.st.viewers.b; // left before the result
  r.p.resolve('k', 0);
  assert.deepEqual([r.dust('a'), r.dust('c'), r.dust('d')], [10, 0, 0]);
  const end = r.events.find(e => e.type === 'predict-end');
  assert.deepEqual([end.guesses, end.right], [3, 2]);
});
