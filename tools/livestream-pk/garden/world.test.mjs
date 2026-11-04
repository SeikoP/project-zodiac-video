import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS, plotId, plotCenter, islandCenter, ensureUser, seat, touch, isAwake, emptyGardenState } from './world.mjs';
import { makeCtx, addUser } from './testkit.mjs';

test('twelve islands, one per sign, laid out 3 wide by 4 tall', () => {
  assert.equal(ISLANDS.length, 12);
  const { ctx } = makeCtx();
  const i = ISLANDS.indexOf('leo');
  assert.deepEqual(islandCenter('leo', ctx.cfg), { x: (i % 3) * 1200 + 600, y: Math.floor(i / 3) * 1200 + 600 });
});

test('plotCenter follows the 6x6 grid of 160 cells with a 120 margin', () => {
  const { ctx } = makeCtx();
  const i = ISLANDS.indexOf('aries');
  assert.deepEqual(plotCenter('aries', 0, ctx.cfg), { x: (i % 3) * 1200 + 120 + 80, y: Math.floor(i / 3) * 1200 + 120 + 80 });
  assert.deepEqual(plotCenter('aries', 7, ctx.cfg), { x: (i % 3) * 1200 + 120 + 160 + 80, y: Math.floor(i / 3) * 1200 + 120 + 160 + 80 });
  assert.equal(plotId('aries', 7), 'aries:7');
});

test('seat gives the same plot back, prefers the asked island, and records the sign', () => {
  const { ctx } = makeCtx();
  const u = ensureUser(ctx, { userId: 'a', nickname: 'A', avatar: '' });
  const p = seat(ctx, u, 'virgo');
  assert.equal(p.island, 'virgo');
  assert.equal(u.sign, 'virgo');
  assert.equal(seat(ctx, u, 'aries'), p);
});

test('a full island makes the least recently active crop-less player give up a plot', () => {
  const { ctx, advance } = makeCtx();
  const first = addUser(ctx, 'first', { island: 'leo' });
  for (let n = 1; n < 36; n++) { advance(1); addUser(ctx, 'u' + n, { island: 'leo' }); }
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  const p = seat(ctx, u, 'leo');
  assert.equal(p.island, 'leo');
  assert.equal(first.user.seat, null, 'the evicted player is parked, not deleted');
  assert.ok(ctx.state.users.first);
});

test('when the asked island is full of growing crops the player goes to another island', () => {
  const { ctx } = makeCtx();
  for (let n = 0; n < 36; n++) addUser(ctx, 'u' + n, { island: 'leo' }).plot.crop = { type: 'rau', progress: 0, ripeAt: null, pest: false, stolen: 0 };
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  const p = seat(ctx, u, 'leo');
  assert.ok(p);
  assert.notEqual(p.island, 'leo');
});

test('nobody can be evicted while every plot has a crop: seat returns null', () => {
  const { ctx } = makeCtx();
  for (const isl of ISLANDS) for (let n = 0; n < 36; n++) addUser(ctx, `${isl}-${n}`, { island: isl }).plot.crop = { type: 'rau', progress: 0, ripeAt: null, pest: false, stolen: 0 };
  const u = ensureUser(ctx, { userId: 'late', nickname: 'L', avatar: '' });
  assert.equal(seat(ctx, u, 'leo'), null);
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

test('emptyGardenState starts empty and versioned', () => {
  const s = emptyGardenState(0);
  assert.deepEqual([s.v, s.ver, s.thefts, s.event], [1, 0, [], null]);
});
