import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, plotId, plotCenter, tierCenter, ensureUser, seat, touch, isAwake, emptyGardenState } from './world.mjs';
import { makeCtx, addUser } from './testkit.mjs';

test('four cloud terraces stack vertically with room for 432 viewers', () => {
  assert.equal(TIERS.length, 4);
  assert.equal(TIERS.reduce((n, t) => n + 108, 0), 432);
  const { ctx } = makeCtx();
  assert.deepEqual(tierCenter('cloud-3', ctx.cfg), { x: 1350, y: 3000 });
});

test('plot centers follow the 18-column layout inside a terrace', () => {
  const { ctx } = makeCtx();
  assert.deepEqual(plotCenter('cloud-1', 0, ctx.cfg), { x: 330, y: 300 });
  assert.deepEqual(plotCenter('cloud-1', 19, ctx.cfg), { x: 450, y: 420 });
  assert.equal(plotId('cloud-1', 19), 'cloud-1:19');
});

test('seat returns the same plot and honors a requested cloud terrace', () => {
  const { ctx } = makeCtx();
  const u = ensureUser(ctx, { userId: 'a', nickname: 'A', avatar: '' });
  const p = seat(ctx, u, 'cloud-3');
  assert.equal(p.tier, 'cloud-3');
  assert.equal(u.seat.tier, 'cloud-3');
  assert.equal(seat(ctx, u, 'cloud-1'), p);
});

test('a full terrace reclaims its least recently active empty plot', () => {
  const { ctx, advance } = makeCtx({ cfg: { plotsPerTier: 2 } });
  const first = addUser(ctx, 'first');
  advance(1);
  addUser(ctx, 'second');
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  const p = seat(ctx, u, 'cloud-1');
  assert.equal(p.tier, 'cloud-1');
  assert.equal(first.user.seat, null, 'the evicted player is parked, not deleted');
  assert.ok(ctx.state.users.first);
});

test('a terrace full of growing crops sends newcomers to another terrace', () => {
  const { ctx } = makeCtx({ cfg: { plotsPerTier: 1 } });
  addUser(ctx, 'u', { tier: 'cloud-1' }).plot.crop = { type: 'rau', progress: 0, ripeAt: null, pest: false, stolen: 0 };
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  assert.equal(seat(ctx, u, 'cloud-1').tier, 'cloud-2');
});

test('nobody is evicted while every plot has a crop', () => {
  const { ctx } = makeCtx({ cfg: { plotsPerTier: 1 } });
  for (const tier of TIERS) addUser(ctx, tier.id, { tier: tier.id }).plot.crop = { type: 'rau', progress: 0, ripeAt: null, pest: false, stolen: 0 };
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  assert.equal(seat(ctx, u), null);
});

test('isAwake flips at 300000ms without activity and touch wakes the plot', () => {
  const { ctx, advance } = makeCtx();
  const { user, plot } = addUser(ctx, 'a');
  advance(299_999);
  assert.equal(isAwake(ctx, plot), true);
  advance(2);
  assert.equal(isAwake(ctx, plot), false);
  touch(ctx, user);
  assert.equal(isAwake(ctx, plot), true);
});

test('emptyGardenState starts empty and versioned for the terrace layout', () => {
  const s = emptyGardenState(0);
  assert.deepEqual([s.v, s.ver, s.thefts, s.event, s.session], [3, 0, [], null, null]);
});
