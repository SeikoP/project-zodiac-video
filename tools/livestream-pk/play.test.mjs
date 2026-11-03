import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseSwitch } from './game.mjs';
import { userOf } from './tiktok.mjs';

const OFF = { skyBoons: false, bossEverySeconds: 0, chaosEverySeconds: 0, chaosEveryRetroSeconds: 0, chestEveryMinutes: 0 };
const setup = (config = {}) => {
  let t = Date.UTC(2026, 10, 3, 12, 1);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, readSky: null, onEvent: e => events.push(e), config: { autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...OFF, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); } };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);

test('parseSwitch: "đổi …" or a bare sign name switches; cheering for another sign does not', () => {
  assert.equal(parseSwitch('đổi Sư Tử'), 'leo');
  assert.equal(parseSwitch('đổi sang 7'), 'libra');
  assert.equal(parseSwitch('chuyển qua cung bảo bình'), 'aquarius');
  assert.equal(parseSwitch('Song Ngư'), 'pisces');
  assert.equal(parseSwitch('sư tử đỉnh quá'), null);
  assert.equal(parseSwitch('3'), null); // a bare number is too easy to type by accident
});

test('a wrong pick can be corrected at once; after that switches wait for the cooldown', () => {
  const { game, events, advance } = setup({ switchCooldownSeconds: 30 });
  game.chat(u('a', { comment: 'kim ngưu' }));
  game.chat(u('a', { comment: 'sư tử đẹp trai ghê' }));
  assert.equal(game.state.viewers.a.sign, 'taurus');
  game.chat(u('a', { comment: 'đổi sư tử' }));
  assert.equal(game.state.viewers.a.sign, 'leo');
  assert.equal(of(events, 'join').at(-1).from, 'taurus');
  game.chat(u('a', { comment: 'đổi song ngư' }));
  assert.equal(game.state.viewers.a.sign, 'leo');
  assert.equal(of(events, 'switch-wait')[0].seconds, 30);
  advance(31000);
  game.chat(u('a', { comment: 'song ngư' }));
  assert.equal(game.state.viewers.a.sign, 'pisces');
});

test('fan club members are greeted once a night, shed a little more light, and can call the lucky star once', () => {
  const { game, events } = setup({ commentLight: 10, fanBonus: 0.1, fanBonusPerLevel: 0.01, luckySeconds: 20 });
  game.chat(u('f', { comment: 'leo', fanLevel: 10, fanClub: 'Hội Sao' }));
  game.chat(u('f', { comment: 'hi' }));
  assert.equal(of(events, 'fan-arrive').length, 1);
  assert.equal(of(events, 'fan-arrive')[0].club, 'Hội Sao');
  assert.equal(game.state.wheel.given.leo, 12); // 10 × 1.2
  game.chat(u('f', { comment: 'gọi sao' }));
  assert.equal(game.state.lucky.sign, 'leo');
  assert.equal(of(events, 'fan-call').length, 1);
  game.chat(u('x', { comment: 'pisces' }));
  game.chat(u('x', { comment: 'gọi sao' }));
  assert.equal(of(events, 'fan-only').length, 1);
  const c = game.changes({}).cosmos;
  assert.equal(c.fanCount, 1);
  assert.equal(game.changes({}).stage.find(v => v.userId === 'f').fan, 10);
});

test('the TikTok bridge reads fan club level and subscriber flags', () => {
  const d = { user: { userId: '9', nickname: 'Mi', fansClub: { data: { clubName: 'Sao', level: 7 } } }, userIdentity: { isSubscriberOfAnchor: true } };
  assert.deepEqual(userOf(d), { userId: '9', nickname: 'Mi', avatar: '', fanLevel: 7, fanClub: 'Sao', subscriber: true });
});

test('Nhiệt phòng rises with what the whole room does and multiplies starlight; one spammer cannot heat it alone', () => {
  const { game, events, advance } = setup({ heatLevels: [5, 10, 20, 40], heatMultipliers: [1, 2, 3, 4, 5], commentLight: 1, commentCooldownSeconds: 0 });
  for (let i = 0; i < 50; i++) game.chat(u('spam', { comment: 'leo' }));
  advance(100);
  assert.equal(game.changes({}).cosmos.heat.level, 1); // capped at 6 per viewer per 2s
  for (let i = 0; i < 16; i++) game.chat(u(`v${i}`, { comment: 'pisces' }));
  advance(100);
  assert.equal(of(events, 'heat-up').at(-1).level, 3);
  const before = game.state.wheel.given.pisces;
  game.chat(u('v0', { comment: 'hay' }));
  assert.equal(game.state.wheel.given.pisces - before, 4);
  advance(21000);
  assert.equal(game.changes({}).cosmos.heat.level, 0); // it cools down
});

test('a quiet room shows the house mascots demonstrating commands', () => {
  const { events, advance } = setup({ quietSeconds: 45 });
  advance(45000);
  assert.equal(of(events, 'demo').length, 1);
  assert.ok(of(events, 'demo')[0].demo);
});

test('Thủy Nghịch never asks for more fixers than there are viewers', () => {
  const { game, events } = setup({ chaosFixMin: 3 });
  game.chat(u('a', { comment: 'leo' }));
  game.startChaos();
  assert.equal(of(events, 'chaos-start')[0].need, 1);
  game.chat(u('a', { comment: 'thuận' }));
  assert.equal(of(events, 'chaos-fixed').length, 1);
});

test('commands that need a sign say which one, instead of doing nothing', () => {
  const { game, events } = setup();
  game.chat(u('a', { comment: 'nâng cấp' }));
  game.chat(u('a', { comment: 'xin quẻ' }));
  assert.deepEqual(of(events, 'need-sign').map(e => e.for), ['upgrade', 'fortune']);
});

test('review fixes: "leo" alone is not a switch; a frozen sign cannot switch away; heat cools after a long gap; gọi sao waits out a running star', () => {
  assert.equal(parseSwitch('leo'), null);
  const { game, events, advance } = setup({ heatLevels: [2, 100, 200, 300], bossHpMin: 1e6, bossAttackSeconds: 1, luckySeconds: 20 });
  game.chat(u('a', { comment: 'kim ngưu', fanLevel: 2 }));
  game.chat(u('b', { comment: 'kim ngưu' }));
  advance(100);
  assert.equal(game.changes({}).cosmos.heat.level, 1);
  game.startBoss();
  advance(1500);
  assert.equal(game.state.boss.frozen.sign, 'taurus');
  game.chat(u('b', { comment: 'đổi sư tử' }));
  assert.equal(game.state.viewers.b.sign, 'taurus');
  assert.equal(of(events, 'switch-wait')[0].frozen, true);
  game.startLucky('pisces');
  game.chat(u('a', { comment: 'gọi sao' }));
  assert.equal(of(events, 'fan-call-wait').length, 1);
  advance(60000); // one long jump: the whole window is old
  assert.equal(game.changes({}).cosmos.heat.level, 0);
});
