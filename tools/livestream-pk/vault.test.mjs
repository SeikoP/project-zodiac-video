import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseAction } from './game.mjs';
import { parseFortuneTopic } from './altar.mjs';

const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ config: { hours: false, skyBoons: false, bossEverySeconds: 0, chaosEverySeconds: 0, chaosEveryRetroSeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, ...config }, now: () => t, rng: () => 0, readSky: sky, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { t += ms; game.tick(); };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}

// --- kho chung: one "kho" for resources, level, cards, Sổ Sao and bingo ---
test('"kho", "khoe thẻ", "bộ thẻ", "sổ sao" all open the one vault, with everything a viewer owns', () => {
  for (const c of ['kho', 'túi đồ', 'khoe thẻ', 'bộ thẻ', 'sổ sao', 'khoe', 'khoe kho']) assert.equal(parseAction(c), 'vault', c);
  const s = setup();
  s.say('a', 'Sư Tử');
  Object.assign(s.v('a').bag, { dust: 120, fire: 2, moon: 1 });
  s.v('a').cards = { 'leo:base': 2, 'leo:gold': 1, 'aries:star': 1 };
  s.say('a', 'khoe thẻ');
  const [e] = s.of('vault');
  assert.equal(e.nickname, 'A');
  assert.equal(e.level, 1);
  assert.equal(e.bag.dust, 120);
  assert.equal(e.cards.unique, 3);
  assert.equal(e.cards.total, 120);
  assert.deepEqual(e.cards.best.map(c => c.edition), ['gold', 'star', 'base'], 'rarest first, at most three');
  assert.ok(e.pass && e.pass.level >= 1);
  assert.ok(e.bingo && e.bingo.marked >= 1);
  assert.ok(e.next, 'what the next level costs');
  s.say('a', 'kho');
  assert.equal(s.of('vault').length, 1, 'once per cooldown');
  assert.equal(s.of('bag').length + s.of('collection').length + s.of('pass-show').length, 0, 'the old separate panels are gone');
});

// --- tài nguyên dùng qua sự kiện ---
test('"tung ngọc" spends one gem for a big hit in a fight; none without a fight or a gem', () => {
  const s = setup({ gemPowerDiamonds: 20 });
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Sư Tử'], ['c', 'Bảo Bình'], ['d', 'Bảo Bình']]) s.say(id, sign);
  s.v('a').bag.fire = 1;
  s.say('a', 'tung ngọc');
  assert.equal(s.v('a').bag.fire, 1, 'no fight: the gem is kept');
  assert.equal(s.of('power-need').at(-1).why, 'no-fight');
  s.game.startBoss();
  const hp = s.game.state.boss.hp;
  s.say('a', 'tung ngọc');
  assert.equal(s.v('a').bag.fire, 0);
  assert.ok(s.game.state.boss.hp < hp - 5, 'a gem hits much harder than a comment');
  const p = s.of('power').at(-1);
  assert.deepEqual([p.kind, p.res, p.target, p.nickname], ['gem', 'fire', 'boss', 'A']);
  s.advance(20_000);
  s.say('a', 'tung ngọc');
  assert.equal(s.of('power-need').at(-1).why, 'no-gem');
});

test('"tung ngọc" uses another element\'s gem when the viewer has none of their own', () => {
  const s = setup();
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình']]) s.say(id, sign);
  s.v('a').bag.water = 2;
  s.game.startBoss();
  s.say('a', 'tung ngọc');
  assert.equal(s.v('a').bag.water, 1);
  assert.equal(s.of('power').at(-1).res, 'water');
});

test('"thắp trăng" spends a moon shard to raise the moon by a fifth of its goal', () => {
  const s = setup({ moonGoal: 600 });
  s.say('a', 'Sư Tử');
  s.v('a').bag.moon = 1;
  const before = s.game.state.moon.light;
  s.say('a', 'thắp trăng');
  assert.equal(s.v('a').bag.moon, 0);
  assert.ok(s.game.state.moon.light - before >= 120);
  assert.equal(s.of('power').at(-1).kind, 'moon');
});

// --- xin quẻ ---
test('parseFortuneTopic reads the topic a viewer asks about', () => {
  assert.equal(parseFortuneTopic('xin quẻ'), null);
  assert.equal(parseFortuneTopic('xin quẻ tình duyên'), 'love');
  assert.equal(parseFortuneTopic('xin quẻ tình yêu nha'), 'love');
  assert.equal(parseFortuneTopic('xin quẻ công việc'), 'work');
  assert.equal(parseFortuneTopic('xin quẻ học hành'), 'work');
  assert.equal(parseFortuneTopic('xin quẻ tiền bạc'), 'money');
  assert.equal(parseFortuneTopic('xin quẻ tài lộc'), 'money');
});

test('a reading on a topic carries a focus with two lines on it', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.say('a', 'xin quẻ tình duyên');
  s.advance(1000);
  const f = s.game.snapshot().hud.fortune;
  assert.equal(f.topic, 'love');
  assert.equal(f.focus.length, 2);
  assert.notEqual(f.focus[0], f.focus[1]);
});

test('during a reading the room can say "chuẩn" (the owner gets bụi sao) and, on a great reading, "xin vía"', () => {
  const s = setup({ fortuneTrueDust: 1, fortuneLuckDust: 2 });
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình'], ['c', 'Song Ngư']]) s.say(id, sign);
  s.say('a', 'xin quẻ');
  s.advance(1000);
  assert.ok(s.game.state.fortune, 'the reading is on');
  const dust = id => s.v(id).bag.dust;
  const a0 = dust('a'), b0 = dust('b');
  s.say('a', 'chuẩn'); // not for your own reading
  s.say('b', 'chuẩn quá');
  s.say('b', 'linh'); // once each
  s.say('c', 'đúng luôn');
  assert.deepEqual(s.of('fortune-agree').map(e => e.count), [1, 2]);
  assert.ok(dust('a') >= a0 + 2);
  s.game.state.fortune.level = 'Đại Cát';
  s.say('b', 'xin vía');
  assert.equal(s.of('fortune-luck').length, 1);
  assert.ok(dust('b') >= b0 + 2);
  s.game.state.fortune.level = 'Bình An';
  s.say('c', 'xin vía');
  assert.equal(s.of('fortune-luck').length, 1, 'only a Thượng/Đại Cát reading shares its luck');
  assert.equal(s.game.snapshot().hud.fortune.agree, 2);
});

// --- bớt loãng ---
test('"nhảy" is no longer a command', () => {
  assert.equal(parseAction('nhảy'), null);
  assert.equal(parseAction('quẩy lên'), null);
});

test('the room\'s "xin vía" count never hides the reading\'s own luck line', () => {
  const s = setup();
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình']]) s.say(id, sign);
  s.say('a', 'xin quẻ');
  s.advance(1000);
  s.game.state.fortune.level = 'Đại Cát';
  s.say('b', 'xin vía');
  const f = s.game.snapshot().hud.fortune;
  assert.equal(typeof f.luck, 'string');
  assert.equal(f.vias, 1);
});
