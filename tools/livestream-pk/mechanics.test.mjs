import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { SQUARES, createBingo, BINGO_DEFAULTS } from './bingo.mjs';
import { createPredict, PREDICT_DEFAULTS } from './predict.mjs';
import { passReward } from './pass.mjs';

const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
function setup(config = {}) {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { hours: false, bossEverySeconds: 0, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6, ...config }, now: () => t, rng: () => 0, readSky: sky, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { t += ms; game.tick(); };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}

test('kéo co: the two biggest teams pull after a warm-up; gifts give a big, named pull; the leaning side wins', () => {
  const s = setup();
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Sư Tử'], ['c', 'Bảo Bình'], ['d', 'Bảo Bình'], ['e', 'Song Ngư']]) s.say(id, sign);
  const g = s.game.startTug();
  assert.deepEqual([g.a, g.b].sort(), ['aquarius', 'leo']);
  s.say('a', 'kéo!'); // still warming up
  assert.equal(s.game.state.tug.pos, 0);
  s.advance(16_000);
  s.game.gift({ userId: 'c', nickname: 'C', diamonds: 10, count: 1, giftName: 'Rose' });
  assert.equal(s.of('tug-yank').length, 1);
  s.say('a', 'kéo!');
  s.advance(80_000);
  const end = s.of('tug-end')[0];
  assert.equal(end.winner, 'aquarius');
  assert.equal(end.mvpB?.nickname ?? end.mvpA?.nickname, end.winner === g.b ? end.mvpB.nickname : end.mvpA.nickname);
});

test('dự đoán: guessing is free ("đoán A"), one guess each, and a right guess pays bụi sao', () => {
  const s = setup();
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình']]) s.say(id, sign);
  s.v('a').bag.dust = 50; s.v('b').bag.dust = 50;
  const g = s.game.startTug();
  const leoIs = g.a === 'leo' ? 'a' : 'b', aquaIs = leoIs === 'a' ? 'b' : 'a';
  s.say('a', `đoán ${leoIs}`);
  s.say('b', `đoán ${aquaIs}`);
  s.say('a', `đoán ${aquaIs}`); // a second guess is ignored
  assert.equal(s.v('a').bag.dust, 50); // nothing staked
  assert.deepEqual(s.game.snapshot().cosmos.predict.options.map(o => o.n), [1, 1]);
  s.advance(16_000);
  for (let i = 0; i < 8; i++) { s.say('a', `kéo ${i}`); s.advance(1600); }
  s.advance(80_000);
  const end = s.of('predict-end')[0];
  assert.equal(end.answer, 'Sư Tử');
  assert.equal(end.right, 1);
  assert.ok(s.v('a').bag.dust > 50);
});

test('bingo: a free centre, squares marked for everyone on stage, a line pays a gem', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.say('a', 'bingo');
  const card = s.of('bingo-card')[0].card;
  assert.equal(card.length, 9);
  assert.equal(card[4].label, 'Có mặt');
  assert.equal(card[4].marked, true);
  // every square listens to an event type the quick filter lets through
  const types = ['boss-defeated', 'pair', 'roast-end', 'quest-done', 'moon-full', 'lucky-start', 'chest-open', 'birth-sky', 'run-won', 'quiz-end', 'wish-blessed', 'level-up', 'tug-end', 'gift', 'wheel-complete', 'heat-up', 'lit', 'star-born', 'predict-end'];
  for (const sq of SQUARES) assert.ok(types.some(type => sq[3]({ type, winners: [1], winner: 'leo', right: 1, level: 3, tier: 'meteor' })), sq[0]);
});

test('sổ sao: starlight is experience; levels pay out and 10 brings a silver frame', () => {
  const s = setup({ passXpPerLevel: 1 });
  s.say('a', 'Sư Tử');
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

test('pity: ten chest cards without a rare one make the next one Hoàng Kim', () => {
  const s = setup({ chestEveryMinutes: 15 });
  s.say('a', 'Sư Tử');
  let gold = null;
  for (let i = 0; i < 11 && !gold; i++) {
    s.game.openChest();
    s.say('a', 'nhận');
    gold = s.events.find(e => e.type === 'card' && e.card.edition === 'gold');
    s.advance(30_000);
  }
  assert.ok(gold);
  assert.equal(s.v('a').pity, 0);
});

test('a gift leaves a golden aura on the giver and grows a patron star', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.game.gift({ userId: 'a', nickname: 'A', diamonds: 100, count: 1, giftName: 'Rose' });
  const snap = s.game.snapshot();
  assert.ok(snap.stage.find(x => x.userId === 'a').aura > 0);
  assert.equal(snap.stars.find(x => x.userId === 'a').patron, 2);
});

test('"Xoá toàn bộ" also clears a run, a tug, a prediction and the channel record', () => {
  const s = setup();
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình'], ['c', 'Song Ngư']]) s.say(id, sign);
  s.game.startTug();
  s.game.state.runMeta = { best: 5, runs: 9, clears: 2, ascension: 2, unlocked: ['aries'] };
  s.game.resetAll();
  for (const k of ['tug', 'predict', 'run', 'roast', 'head', 'quest']) assert.equal(s.game.state[k], null, k);
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình']]) s.say(id, sign);
  const r = s.game.startRun();
  assert.equal(r.no, 1); // a fresh record after the reset
  assert.equal(s.game.state.runMeta.runs, 0);
});

// predict and bingo on their own: a bare state, a fixed clock, events collected
function predictRig(config = {}) {
  let t = 0;
  const events = [];
  const st = { viewers: {}, predict: null };
  const p = createPredict({ st, cfg: { ...PREDICT_DEFAULTS, ...config }, now: () => t, onEvent: e => events.push(e) });
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

function bingoRig(ids) {
  const events = [], gems = {};
  const st = { night: { no: 1 }, viewers: Object.fromEntries(ids.map(id => [id, { nickname: id, sign: 'leo' }])) };
  const onStage = new Set(ids);
  const b = createBingo({ st, cfg: BINGO_DEFAULTS, now: () => 0, onEvent: e => events.push(e), stageIds: () => onStage.keys(), gem: u => { gems[u.userId] = (gems[u.userId] ?? 0) + 1; }, moon: () => {} });
  for (const id of ids) b.cardOf(id, st.viewers[id]);
  return { st, b, events, gems, onStage };
}
const ALL = SQUARES.map(s => ({ boss: { type: 'boss-defeated' }, pair: { type: 'pair' }, roast: { type: 'roast-end' }, quest: { type: 'quest-done' }, moon: { type: 'moon-full' }, lucky: { type: 'lucky-start' }, chest: { type: 'chest-open' }, birth: { type: 'birth-sky' }, floor: { type: 'run-won' }, quiz: { type: 'quiz-end', winners: ['x'] }, wish: { type: 'wish-blessed' }, level: { type: 'level-up' }, tug: { type: 'tug-end', winner: 'leo' }, gift: { type: 'gift', tier: 'sparkle' }, fireworks: { type: 'wheel-complete' }, heat: { type: 'heat-up', level: 3 }, lit: { type: 'lit' }, newstar: { type: 'star-born' }, predict: { type: 'predict-end', right: 1 } }[s[0]]));

test('bingo: every event a whole card needs completes it for several viewers at once, one bingo event and gem per line', () => {
  const r = bingoRig(['a', 'b']);
  for (const e of ALL) r.b.note(e);
  for (const id of ['a', 'b']) assert.equal(r.st.viewers[id].bingo.full, true, id);
  for (const id of ['a', 'b']) {
    assert.ok(r.gems[id] >= 1, id); // cards differ per viewer, so each gets its own number of bingo steps
    assert.equal(r.events.filter(e => e.type === 'bingo' && e.userId === id).length, r.gems[id], id);
  }
});

test('bingo: the same event twice adds nothing, and a viewer who left the stage is not marked', () => {
  const r = bingoRig(['a', 'b']);
  const sq = r.st.viewers.a.bingo.squares.find(s => s !== 'free');
  const e = ALL[SQUARES.findIndex(s => s[0] === sq)];
  r.onStage.delete('b');
  const bBefore = structuredClone(r.st.viewers.b.bingo);
  r.b.note(e);
  const once = structuredClone(r.st.viewers.a.bingo);
  r.b.note(e);
  assert.deepEqual(r.st.viewers.a.bingo, once);
  assert.deepEqual(r.st.viewers.b.bingo, bBefore);
});
