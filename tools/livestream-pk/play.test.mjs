import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { userOf } from './tiktok.mjs';

const OFF = { bossEverySeconds: 0, chestEveryMinutes: 0 };
const setup = (config = {}) => {
  let t = Date.UTC(2026, 10, 3, 12, 1);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, onEvent: e => events.push(e), config: { acts: false, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...OFF, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); } };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);
// a viewer already on `team` and on stage, whatever the balance would have said (events/roster.mjs redirects a crowded team)
const seat = (game, id, team, extra = {}) => {
  game.state.viewers[id] = { nickname: id, avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0, ...extra };
  game.like(u(id, { count: 0 }));
};

test('a wrong pick can be corrected at once; after that switches wait for the cooldown', () => {
  const { game, events, advance } = setup({ switchCooldownSeconds: 30 });
  game.chat(u('a', { comment: 'xanh dương' }));
  game.chat(u('a', { comment: 'đỏ đẹp trai ghê' }));
  assert.equal(game.state.viewers.a.team, 'blue', 'cheering for another team is not a switch');
  game.chat(u('a', { comment: 'đổi đỏ' }));
  assert.equal(game.state.viewers.a.team, 'red');
  assert.equal(of(events, 'join').at(-1).from, 'blue');
  game.chat(u('a', { comment: 'đổi xanh lá' }));
  assert.equal(game.state.viewers.a.team, 'red');
  assert.equal(of(events, 'switch-wait')[0].seconds, 30);
  advance(31000);
  game.chat(u('a', { comment: 'xanh lá' }));
  assert.equal(game.state.viewers.a.team, 'green');
});

test('fan club members are greeted once a night, shed a little more light, and can call the lucky star once', () => {
  const { game, events } = setup({ commentLight: 10, fanBonus: 0.1, fanBonusPerLevel: 0.01, luckySeconds: 20 });
  game.chat(u('f', { comment: 'đỏ', fanLevel: 10, fanClub: 'Hội Sao' }));
  game.chat(u('f', { comment: 'hi' }));
  assert.equal(of(events, 'fan-arrive').length, 1);
  assert.equal(of(events, 'fan-arrive')[0].club, 'Hội Sao');
  assert.equal(game.state.wheel.given.red, 12); // 10 × 1.2
  game.chat(u('f', { comment: 'gọi sao' }));
  assert.equal(game.state.lucky.team, 'red');
  assert.equal(of(events, 'fan-call').length, 1);
  game.chat(u('x', { comment: 'xanh dương' }));
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
  const { game, events, advance } = setup({ heatLevels: [5, 10, 20, 40], heatMultipliers: [1, 2, 3, 5, 5], commentLight: 1, commentCooldownSeconds: 0 });
  for (let i = 0; i < 50; i++) game.chat(u('spam', { comment: 'đỏ' }));
  advance(100);
  assert.equal(game.changes({}).cosmos.heat.level, 1); // capped at 6 per viewer per 2s
  for (let i = 0; i < 16; i++) game.chat(u(`v${i}`, { comment: 'xanh dương' }));
  advance(100);
  assert.equal(of(events, 'heat-up').at(-1).level, 3);
  const team = game.state.viewers.v0.team, before = game.state.wheel.given[team];
  game.chat(u('v0', { comment: 'hay' }));
  assert.equal(game.state.wheel.given[team] - before, 3); // heat x5 is cut to the x3 cap on the room's total multiplier
  advance(21000);
  assert.equal(game.changes({}).cosmos.heat.level, 0); // it cools down
});

test('a quiet room shows the house mascots demonstrating commands', () => {
  const { events, advance } = setup({ quietSeconds: 45 });
  advance(45000);
  assert.equal(of(events, 'demo').length, 1);
  assert.ok(of(events, 'demo')[0].demo);
});

test('commands never ask for a team first: a newcomer already has one', () => {
  const { game, events } = setup();
  game.chat(u('a', { comment: 'nâng cấp' }));
  game.chat(u('a', { comment: 'xin quẻ' }));
  assert.equal(of(events, 'need-team').length, 0);
  assert.equal(of(events, 'upgrade-need').length, 1, 'the upgrade says what is missing');
  assert.equal(game.state.fortuneQueue[0]?.userId, 'a', 'and the reading is queued');
});

test('review fixes: a frozen team cannot switch away; heat cools after a long gap; gọi sao waits out a running star', () => {
  const { game, events, advance } = setup({ heatLevels: [2, 100, 200, 300], bossHpMin: 1e6, bossAttackSeconds: 1, luckySeconds: 20 });
  seat(game, 'a', 'yellow', { fanLevel: 2 });
  seat(game, 'b', 'yellow');
  game.chat(u('a', { comment: 'hi' }));
  game.chat(u('b', { comment: 'hi' }));
  advance(100);
  assert.equal(game.changes({}).cosmos.heat.level, 1);
  game.startBoss();
  advance(1500);
  assert.equal(game.state.boss.frozen.team, 'yellow');
  game.chat(u('b', { comment: 'đổi đỏ' }));
  assert.equal(game.state.viewers.b.team, 'yellow');
  assert.equal(of(events, 'switch-wait')[0].frozen, true);
  game.startLucky('blue');
  game.chat(u('a', { comment: 'gọi sao' }));
  assert.equal(of(events, 'fan-call-wait').length, 1);
  advance(60000); // one long jump: the whole window is old
  assert.equal(game.changes({}).cosmos.heat.level, 0);
});
