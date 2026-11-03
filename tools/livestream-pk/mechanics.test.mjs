import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { SQUARES } from './bingo.mjs';
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
  assert.equal(s.of('pass-show')[0].level, s.v('a').pass.level);
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
