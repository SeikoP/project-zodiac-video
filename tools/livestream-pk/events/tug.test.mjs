import test from 'node:test';
import assert from 'node:assert/strict';
import { createTug, TUG_DEFAULTS } from '../tug.mjs';
import { createRoster } from './roster.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';

// fake room: who is on stage and a fake clock
function room(people, config = {}, from = null, at = 1_000_000) {
  let t = at;
  const viewers = {}, stage = new Map();
  for (const [id, team] of people) { viewers[id] = { nickname: id.toUpperCase(), team }; stage.set(id, true); }
  const roster = createRoster({ viewers, stage });
  const events = [], paid = [];
  const reward = createReward({ sinks: { light: (u, v, n, why) => { paid.push([u.userId, n, why]); } } });
  const st = from ?? { tug: null };
  const cfg = { ...TUG_DEFAULTS, ...config };
  const tug = createTug({ st, cfg, now: () => t, onEvent: e => events.push(e), ctx: { roster }, reward, viewerOf: id => viewers[id] });
  const u = id => ({ userId: id });
  return { st, tug, roster, events, paid, viewers, stage, cfg, u, now: () => t, advance: ms => { t += ms; tug.tick(); }, of: type => events.filter(e => e.type === type) };
}
const FOUR = [['r1', 'red'], ['r2', 'red'], ['b1', 'blue'], ['b2', 'blue'], ['g1', 'green']];

test('needs is false (and start does not throw) unless two teams have people on stage', () => {
  for (const people of [[], [['a', 'red']], [['a', 'red'], ['b', 'red'], ['c', 'red']]]) {
    const r = room(people);
    assert.equal(r.tug.needs({ roster: r.roster }), false);
    assert.ok(!r.tug.start());
    assert.equal(r.st.tug, null);
    assert.equal(r.events.length, 0);
  }
  const ok = room(FOUR);
  assert.equal(ok.tug.needs({ roster: ok.roster }), true);
});

test('registry refuses the tug with one team and starts it with two', () => {
  const lone = room([['a', 'red'], ['b', 'red']]);
  const reg = createRegistry({ ctx: { roster: lone.roster } });
  reg.register(lone.tug);
  assert.equal(reg.start('tug'), false);
  lone.viewers.c = { nickname: 'C', team: 'blue' }; lone.stage.set('c', true);
  assert.equal(reg.start('tug'), true);
  assert.equal(reg.active(), 'tug');
});

test('the two biggest teams pull; warm-up first; per-viewer comment cooldown', () => {
  const r = room(FOUR);
  const g = r.tug.start();
  assert.deepEqual([g.a, g.b].sort(), ['blue', 'red']);
  assert.equal(r.of('tug-start')[0].warmup, 15);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment'), 0, 'still warming up');
  r.advance(16_000);
  assert.equal(r.tug.contribute(r.u('g1'), r.viewers.g1, 'comment'), 0, 'a third team does not pull');
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment'), 2);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment'), 0, 'cooldown');
  r.advance(1600);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment'), 2);
  assert.equal(r.st.tug.value, -4, 'the first team (a) pulls the knot negative');
  assert.equal(r.tug.view().pos, -4);
});

test('a small team pulls up to x2 harder, a big one down to x0.5 (sqrt of the opposing/own head count)', () => {
  const r = room([['b1', 'blue'], ['r1', 'red'], ['r2', 'red'], ['r3', 'red'], ['r4', 'red'], ['r5', 'red'], ['r6', 'red'], ['r7', 'red'], ['r8', 'red']]);
  r.tug.start();
  r.advance(16_000);
  assert.equal(r.tug.contribute(r.u('b1'), r.viewers.b1, 'comment'), 4, '8 vs 1 is capped at x2');
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment'), 1, '1 vs 8 is floored at x0.5');
  const e = room([['r1', 'red'], ['r2', 'red'], ['b1', 'blue'], ['b2', 'blue']]);
  e.tug.start(); e.advance(16_000);
  assert.equal(e.tug.contribute(e.u('r1'), e.viewers.r1, 'comment'), 2, 'equal teams: x1');
  const m = room([['r1', 'red'], ['r2', 'red'], ['r3', 'red'], ['r4', 'red'], ['b1', 'blue']]);
  m.tug.start(); m.advance(16_000);
  assert.equal(m.tug.contribute(m.u('b1'), m.viewers.b1, 'comment'), 4, '4 vs 1: sqrt(4) = x2');
  assert.ok(Math.abs(m.tug.contribute(m.u('r1'), m.viewers.r1, 'comment') - 1) < 1e-9, '1 vs 4: x0.5');
});

test('likes, follows, shares and gifts pull; a gift of power >= 10 is a named tug-yank', () => {
  const r = room(FOUR);
  r.tug.start(); r.advance(16_000);
  assert.ok(Math.abs(r.tug.contribute(r.u('r1'), r.viewers.r1, 'like', 20) - 3) < 1e-9);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'follow'), 8);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'share'), 8);
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'gift', 1), 3, 'a tiny gift still pulls at least 3');
  assert.equal(r.of('tug-yank').length, 0);
  assert.equal(r.tug.contribute(r.u('b1'), r.viewers.b1, 'gift', 4), 10);
  assert.deepEqual(r.of('tug-yank').map(e => [e.userId, e.nickname, e.team, e.power]), [['b1', 'B1', 'blue', 10]]);
  assert.equal(r.tug.contribute(r.u('b2'), r.viewers.b2, 'gift', 2), 5);
  assert.equal(r.of('tug-yank').length, 1, 'power 5 is not a yank');
});

test('the knot reaching an end wins early; winners get tugWinLight, the rest tugJoinLight; an MVP per team', () => {
  const r = room(FOUR, { tugWinLight: 20, tugJoinLight: 5 });
  const { a, b } = r.tug.start();
  r.advance(16_000);
  const side = team => ['r1', 'r2', 'b1', 'b2'].filter(id => r.viewers[id].team === team);
  const [aFan, aFan2] = side(a), [bFan] = side(b);
  r.tug.contribute(r.u(bFan), r.viewers[bFan], 'comment');
  r.tug.contribute(r.u(aFan2), r.viewers[aFan2], 'follow');
  assert.equal(r.of('tug-end').length, 0);
  for (let i = 0; i < 20 && r.st.tug; i++) r.tug.contribute(r.u(aFan), r.viewers[aFan], 'gift', 10);
  assert.equal(r.st.tug, null, 'finished the moment the knot hit the end');
  const end = r.of('tug-end')[0];
  assert.deepEqual([end.winner, end.a, end.b, end.early, end.pos], [a, a, b, true, -100]);
  assert.equal(end.pullers, 3);
  assert.equal(end.mvpA.nickname, aFan.toUpperCase());
  assert.equal(end.mvpB.nickname, bFan.toUpperCase());
  assert.equal(r.tug.isDone(), true);
  assert.deepEqual(r.paid.map(([id, n]) => [id, n]).sort(), [[aFan, 20], [aFan2, 20], [bFan, 5]].sort());
  assert.ok(r.paid.every(p => p[2] === 'tug'));
  assert.equal(r.tug.contribute(r.u(aFan), r.viewers[aFan], 'comment'), 0, 'nothing after the end');
});

test('with nobody ahead at the end there is no winner; the clock ends it after warm-up + run', () => {
  const r = room(FOUR);
  r.tug.start();
  r.advance(80_000);
  assert.equal(r.of('tug-end').length, 0);
  r.advance(11_000);
  const end = r.of('tug-end')[0];
  assert.deepEqual([end.winner, end.early, end.pos, end.pullers, end.mvpA, end.mvpB], [null, false, 0, 0, null, null]);
  assert.equal(r.st.tug, null);
});

test('view reports sides, warm-up and time left; null when idle', () => {
  const r = room(FOUR);
  assert.equal(r.tug.view(), null);
  r.tug.start();
  assert.deepEqual([r.tug.view().warmupMs, r.tug.view().remainingMs], [15_000, 90_000]);
  r.advance(16_000);
  r.tug.contribute(r.u('r1'), r.viewers.r1, 'comment');
  const v = r.tug.view();
  assert.deepEqual([v.warmupMs, v.remainingMs, v.pullersA + v.pullersB], [0, 74_000, 1]);
});

// --- gift abilities ---
const giftOf = (r, tier, id, diamonds) => r.tug.gift[tier]({ user: r.u(id), viewer: r.viewers[id], team: r.viewers[id].team, diamonds, tier });

test('gift.mid / gift.big answer false before the pull starts, after the tug, or for a team that is not pulling', () => {
  const r = room(FOUR);
  assert.equal(giftOf(r, 'big', 'r1', 100), false, 'no tug yet');
  r.tug.start();
  assert.equal(giftOf(r, 'big', 'r1', 100), false, 'warm-up');
  r.advance(16_000);
  assert.notEqual(giftOf(r, 'mid', 'r1', 20), false);
  r.viewers.g1.team = 'green';
  assert.equal(giftOf(r, 'big', 'g1', 100), false, 'green is not on the rope');
});

test('gift.big sets st.tug.boost = { team, until } and the team pulls x tugBoostFactor until it ends; the latest boost replaces', () => {
  const r = room(FOUR, { tugBoostSeconds: 60, tugBoostFactor: 2 });
  r.tug.start(); r.advance(16_000);
  giftOf(r, 'big', 'r1', 100);
  assert.deepEqual(r.st.tug.boost, { team: 'red', until: r.st.tug.boost.until, skip: 'r1' });
  assert.equal(r.tug.view().boost.team, 'red');
  assert.equal(r.tug.contribute(r.u('r1'), r.viewers.r1, 'follow'), 16, 'x2');
  assert.equal(r.tug.contribute(r.u('b1'), r.viewers.b1, 'follow'), 8, 'blue is not boosted');
  giftOf(r, 'big', 'b2', 100);
  assert.equal(r.st.tug.boost.team, 'blue');
  assert.equal(r.tug.contribute(r.u('r2'), r.viewers.r2, 'follow'), 8);
  r.advance(61_000);
  assert.equal(r.tug.view().boost, null);
});

const swing = (r, id, n) => { const v = r.st.tug.value; r.tug.contribute(r.u(id), r.viewers[id], 'gift', n); return Math.abs(r.st.tug.value - v); };
const UNBALANCED = [['r1', 'red'], ['b1', 'blue'], ['b2', 'blue'], ['b3', 'blue'], ['b4', 'blue'], ['b5', 'blue']];

test('a gift moves the rope in proportion to its coins until tugGiftSwingMax, even in a 1-vs-5 room', () => {
  const r = room(UNBALANCED);
  r.tug.start(); r.advance(16_000);
  const sizes = [3, 12, 40].map(n => { const x = room(UNBALANCED); x.tug.start(); x.advance(16_000); return swing(x, 'r1', n); });
  assert.ok(sizes[0] < sizes[1] && sizes[1] <= 35, sizes.join());
  assert.equal(sizes[2], 35, 'a 40-coin gift reaches the swing max');
  assert.equal(swing(r, 'r1', 500), 35);
  assert.ok(r.st.tug, 'a 100-coin gift from the small team does not end a fresh tug');
});

test('a boosted pull is at most x2 and still never beyond tugGiftSwingMax; the gift that sets the boost is not boosted', () => {
  const plain = room(FOUR); plain.tug.start(); plain.advance(16_000);
  const base = swing(plain, 'r1', 4);
  const r = room(FOUR); r.tug.start(); r.advance(16_000);
  const setter = swing(r, 'r1', 100);
  r.tug.gift.big({ user: r.u('r1'), viewer: r.viewers.r1, team: 'red', diamonds: 100 });
  assert.equal(swing(r, 'r1', 100), 35, 'the setter pulled its normal (capped) amount, then later pulls are boosted');
  assert.equal(setter, 35);
  const r2 = room(FOUR); r2.tug.start(); r2.advance(16_000);
  r2.tug.gift.big({ user: r2.u('r1'), viewer: r2.viewers.r1, team: 'red', diamonds: 100 });
  assert.equal(r2.tug.contribute(r2.u('r1'), r2.viewers.r1, 'gift', 4), 10, 'the gift that set the boost is not boosted');
  assert.equal(r2.tug.contribute(r2.u('r2'), r2.viewers.r2, 'gift', 4), 20, 'the next one is');
  assert.equal(base, 10);
});

test('the yank still fires at power >= 10 even when the rope swing is clamped', () => {
  const r = room(FOUR); r.tug.start(); r.advance(16_000);
  r.tug.contribute(r.u('b1'), r.viewers.b1, 'gift', 100);
  assert.equal(r.of('tug-yank').length, 1);
  assert.equal(r.of('tug-yank')[0].power, 250, 'the uncapped power');
  assert.equal(r.tug.view().pos, 35);
});

test('tug.boost survives a JSON round trip mid-tug', () => {
  const r = room(FOUR);
  r.tug.start(); r.advance(16_000);
  giftOf(r, 'big', 'r1', 100);
  const saved = JSON.parse(JSON.stringify(r.st));
  assert.deepEqual(saved.tug.boost, r.st.tug.boost);
  const again = room(FOUR, {}, saved, r.now());
  assert.equal(again.tug.contribute(again.u('r1'), again.viewers.r1, 'follow'), 16);
});
