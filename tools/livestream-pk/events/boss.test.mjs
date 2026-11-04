import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoss, BOSS_DEFAULTS, ROLES } from '../boss.mjs';
import { createRoster } from './roster.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';

function room(people, config = {}) {
  let t = 5_000_000;
  const viewers = {}, stage = new Map();
  for (const [id, team] of people) { viewers[id] = { nickname: id.toUpperCase(), team }; stage.set(id, true); }
  const roster = createRoster({ viewers, stage });
  const events = [], paid = [];
  const pay = kind => (u, v, n, why) => { paid.push([u.userId, kind, n, why]); };
  const reward = createReward({ sinks: { light: pay('light'), dust: pay('dust'), gem: pay('gem') } });
  const st = { boss: null };
  const cfg = { ...BOSS_DEFAULTS, bossHpMin: 10_000, ...config };
  const boss = createBoss({ st, cfg, now: () => t, onEvent: e => events.push(e), ctx: { roster }, reward, viewerOf: id => viewers[id] });
  const u = id => ({ userId: id });
  const hit = (id, action, n) => boss.contribute(u(id), viewers[id], action, n);
  return { st, boss, view: () => boss.view(), roster, events, paid, viewers, stage, cfg, hit, advance: ms => { t += ms; boss.tick(); }, of: type => events.filter(e => e.type === type) };
}
const ALL = [['r1', 'red'], ['r2', 'red'], ['y1', 'yellow'], ['g1', 'green'], ['g2', 'green'], ['b1', 'blue'], ['b2', 'blue'], ['b3', 'blue']];

test('the roles are keyed by team', () => {
  assert.deepEqual(Object.keys(ROLES), ['red', 'yellow', 'green', 'blue']);
  assert.equal(ROLES.red, 'Quà chí mạng x2');
  assert.equal(ROLES.blue, 'Thả tim sát thương x3');
});

test('health scales with the crowd, never below the minimum', () => {
  const small = room(ALL, { bossHpMin: 400, bossHpPerViewer: 120 });
  assert.equal(small.boss.start(1).max, 400);
  const big = room(ALL, { bossHpMin: 400, bossHpPerViewer: 120 });
  const b = big.boss.start(10);
  assert.deepEqual([b.max, b.hp], [1200, 1200]);
  assert.equal(big.of('boss-start')[0].seconds, 150);
  assert.equal(big.boss.start(10), null, 'one boss at a time');
});

test('each team plays its part: red gifts x2, yellow comments build the shield, green combos, blue hearts x3', () => {
  const r = room(ALL, { bossCommentDamage: 6, bossLikeDamage: 0.5, bossDiamondDamage: 5, bossCommentCooldownMs: 1500, bossComboMs: 4000 });
  r.boss.start(3);
  assert.equal(r.hit('r1', 'gift', 10), 100);
  assert.deepEqual(r.of('boss-hit').at(-1), { type: 'boss-hit', userId: 'r1', nickname: 'R1', team: 'red', dmg: 100, crit: true, combo: 0 });
  assert.equal(r.hit('b1', 'like', 10), 15);
  assert.equal(r.hit('y1', 'like', 10), 5, 'only blue gets x3');
  assert.equal(r.hit('y1', 'gift', 10), 50, 'only red crits');
  r.hit('y1', 'comment');
  assert.equal(r.st.boss.shield, 1);
  r.hit('g1', 'comment');
  r.hit('g2', 'comment');
  assert.deepEqual(r.of('boss-hit').slice(-2).map(h => [h.combo, h.dmg]), [[1, 7], [2, 8]]);
  r.advance(5000);
  r.hit('g1', 'comment');
  assert.equal(r.of('boss-hit').at(-1).combo, 1, 'the combo broke');
  assert.equal(r.hit('g1', 'comment'), 0, 'comment cooldown per viewer');
  assert.equal(r.hit('r1', 'follow'), 30);
});

test('the boss freezes the team hitting hardest after 22s; 1-3 of its fans break the ice; a frozen team does nothing', () => {
  const r = room(ALL, { bossAttackSeconds: 22, bossFreezeSeconds: 12, bossDiamondDamage: 5 });
  r.boss.start(3);
  r.hit('r1', 'gift', 20);
  r.hit('b1', 'gift', 5);
  r.advance(21_000);
  assert.equal(r.of('boss-freeze').length, 0);
  r.advance(1000);
  const f = r.of('boss-freeze')[0];
  assert.deepEqual([f.team, f.need, f.seconds], ['red', 2, 12]);
  assert.equal(r.st.boss.frozen.team, 'red');
  const hp = r.st.boss.hp;
  assert.equal(r.hit('r1', 'gift', 50), 0);
  assert.equal(r.st.boss.hp, hp, 'a frozen team deals no damage');
  assert.equal(r.hit('b1', 'like', 10) > 0, true, 'other teams still hit');
  r.hit('r1', 'comment');
  assert.equal(r.of('boss-rescue').length, 0);
  r.hit('r1', 'comment');
  assert.equal(r.st.boss.frozen === null, false, 'the same person counts once');
  r.hit('r2', 'comment');
  assert.equal(r.of('boss-rescue')[0].nickname, 'R2');
  assert.equal(r.st.boss.frozen, null);
});

test('the number of rescuers is the team size clamped to 1-3', () => {
  const lone = room([['b1', 'blue'], ['r1', 'red']]);
  lone.boss.start(3);
  lone.hit('b1', 'gift', 5);
  lone.advance(22_000);
  assert.equal(lone.of('boss-freeze')[0].need, 1);
  const crowd = room([['b1', 'blue'], ['b2', 'blue'], ['b3', 'blue'], ['b4', 'blue'], ['b5', 'blue'], ['r1', 'red']]);
  crowd.boss.start(3);
  crowd.hit('b1', 'gift', 5);
  crowd.advance(22_000);
  assert.equal(crowd.of('boss-freeze')[0].need, 3);
});

test('unrescued for 12s the boss heals 12%; below a third of its health it strikes every 14s', () => {
  const r = room(ALL, { bossHpMin: 1000, bossAttackSeconds: 22, bossFreezeSeconds: 12, bossHealShare: 0.12, bossRageAttackSeconds: 14, bossDiamondDamage: 5 });
  r.boss.start(3);
  r.hit('r1', 'gift', 20);
  r.advance(22_000);
  assert.ok(r.st.boss.frozen);
  r.advance(11_000);
  assert.equal(r.of('boss-heal').length, 0);
  r.advance(1000);
  assert.deepEqual([r.of('boss-heal')[0].heal, r.st.boss.hp], [120, 800 + 120]);
  assert.equal(r.st.boss.frozen, null);
  r.hit('b1', 'gift', 150); // 750 damage: 170 left, under a third
  assert.equal(r.view().rage, true);
  r.advance(22_000);
  assert.equal(r.of('boss-freeze').length, 2);
  r.hit('b1', 'comment'); r.hit('b2', 'comment'); r.hit('b3', 'comment');
  const before = r.of('boss-freeze').length;
  r.advance(14_000);
  assert.equal(r.of('boss-freeze').length, before + 1, 'raging: the next strike comes 14s later');
});

test('a shield of 10 blocks the freeze instead', () => {
  const r = room([['y1', 'yellow'], ['y2', 'yellow'], ['r1', 'red']], { bossCommentCooldownMs: 0, bossShieldCost: 10, bossAttackSeconds: 22 });
  r.boss.start(3);
  for (let i = 0; i < 10; i++) r.hit('y1', 'comment');
  assert.equal(r.st.boss.shield, 10);
  r.advance(22_000);
  assert.deepEqual([r.of('boss-blocked')[0].team, r.of('boss-blocked')[0].shield], ['yellow', 0]);
  assert.equal(r.of('boss-freeze').length, 0);
  assert.equal(r.st.boss.frozen, null);
});

test('winning pays 30 light and an item to everyone who hit, a bigger share to the top hitter, and reports an MVP per team', () => {
  const r = room([['big', 'red'], ['small', 'blue'], ['bystander', 'green']], { bossHpMin: 100, bossReward: 30, bossDiamondDamage: 5 });
  r.boss.start(1);
  r.hit('small', 'gift', 2);
  r.hit('big', 'gift', 30);
  const won = r.of('boss-defeated')[0];
  assert.equal(r.st.boss, null);
  assert.equal(won.fighters, 2);
  assert.equal(won.reward, 30);
  assert.deepEqual([won.mvp.nickname, won.mvp.team], ['BIG', 'red']);
  assert.deepEqual(Object.keys(won.mvps).sort(), ['blue', 'red']);
  assert.equal(won.mvps.blue.nickname, 'SMALL');
  assert.deepEqual([won.finisher.nickname, won.finisher.team, won.finisher.kind], ['BIG', 'red', 'gift']);
  const got = (id, kind) => r.paid.filter(p => p[0] === id && p[1] === kind).map(p => p[2]);
  assert.deepEqual([got('big', 'light'), got('small', 'light'), got('bystander', 'light')], [[30], [30], []]);
  assert.deepEqual([got('big', 'dust'), got('small', 'dust')], [[15], [5]]);
  assert.deepEqual([got('big', 'gem'), got('small', 'gem')], [[4], [2]]);
  assert.ok(r.paid.every(p => p[3] === 'boss'));
  assert.equal(r.boss.isDone(), true);
  assert.equal(r.hit('big', 'gift', 10), 0, 'nothing after the end');
});

test('a boss nobody beats escapes after bossSeconds', () => {
  const r = room(ALL, { bossSeconds: 60 });
  r.boss.start(3);
  r.hit('r1', 'gift', 1);
  r.advance(59_000);
  assert.equal(r.of('boss-escaped').length, 0);
  r.advance(2000);
  const e = r.of('boss-escaped')[0];
  assert.deepEqual([e.fighters, e.hpShare < 1], [1, true]);
  assert.equal(r.st.boss, null);
  assert.equal(r.view(), null);
});

test('view reports hp, time, shield, frozen team and team totals', () => {
  const r = room(ALL, { bossDiamondDamage: 5 });
  r.boss.start(3);
  r.hit('r1', 'gift', 10);
  const v = r.view();
  assert.deepEqual([v.hp, v.max, v.remainingMs, v.shield, v.frozen, v.byTeam.red, v.byTeam.blue, v.rage], [10_000 - 100, 10_000, 150_000, 0, null, 100, 0, false]);
  assert.equal(v.byElement, undefined);
  assert.deepEqual(v.top, [{ nickname: 'R1', team: 'red', dmg: 100 }]);
});

test('the registry routes contributions to the boss', () => {
  const r = room(ALL, { bossDiamondDamage: 5 });
  const reg = createRegistry({ ctx: { roster: r.roster } });
  reg.register(r.boss);
  assert.equal(reg.start('boss', 3), true);
  assert.equal(reg.contribute('gift', { userId: 'r1' }, r.viewers.r1, 10), 100);
  r.st.boss = null;
  reg.tick(0);
  assert.equal(reg.active(), null, 'a boss gone from the state ends the event');
});
