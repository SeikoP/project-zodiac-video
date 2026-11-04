import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, SEED_ZONE, plotId, plotCenter, plotLayout, shelfSurface, ensureUser, balancedSlotOrder, seat, touch, isAwake, managePresence, migrateSeedZone, emptyGardenState } from './world.mjs';
import { makeCtx, addUser } from './testkit.mjs';

test('the live garden exposes one Seed Zone with a 96-player active capacity', () => {
  const { ctx } = makeCtx();
  assert.deepEqual(TIERS, [SEED_ZONE]);
  assert.equal(ctx.cfg.activeCapacity, 96);
  assert.deepEqual([ctx.cfg.potsPerShelf, ctx.cfg.shelvesPerModule, ctx.cfg.moduleCapacity], [6, 16, 96]);
});

test('one continuous rack has 16 shelves of six pots with aligned feet', () => {
  const { ctx } = makeCtx();
  const a = plotLayout(0, ctx.cfg), b = plotLayout(5, ctx.cfg), nextShelf = plotLayout(6, ctx.cfg), last = plotLayout(95, ctx.cfg);
  assert.equal(b.x - a.x, ctx.cfg.potSpacingX * 5);
  assert.equal(nextShelf.y - a.y, ctx.cfg.shelfSpacingY);
  assert.equal(last.row, 15);
  assert.equal(last.module, 0);
  assert.equal(shelfSurface(0, ctx.cfg) - plotCenter('cloud-1', 0, ctx.cfg).y, ctx.cfg.potBottomOffset + ctx.cfg.potShelfGap);
  assert.ok(ctx.cfg.shelfSpacingY >= 200);
});
test('new arrivals spread across the rack without ever changing an existing seat', () => {
  const { ctx } = makeCtx();
  const ids = [];
  for (let i = 0; i < 12; i++) ids.push(addUser(ctx, 'u' + i).user.seat.slot);
  const rows = new Set(ids.map(slot => Math.floor(slot / 6)));
  assert.equal(rows.size, 12);
  for (let i = 12; i < 96; i++) addUser(ctx, 'u' + i);
  assert.equal(new Set(balancedSlotOrder(ctx.cfg)).size, 96);
  for (let i = 0; i < 12; i++) assert.equal(ctx.state.users['u' + i].seat.slot, ids[i]);
});

test('seat fills one Seed Zone and never opens legacy cloud tiers', () => {
  const { ctx } = makeCtx();
  for (let i = 0; i < 96; i++) addUser(ctx, 'u' + i);
  assert.equal(Object.values(ctx.state.users).filter(u => u.seat?.tier === 'cloud-1').length, 96);
  const late = ensureUser(ctx, { userId: 'late', nickname: 'Late', avatar: '' });
  for (const p of Object.values(ctx.state.plots)) if (p.owner) p.crop = { type: 'rau', progress: 0, ripeAt: null };
  assert.equal(seat(ctx, late), null);
});

test('an empty inactive pot can still be reclaimed without deleting progression', () => {
  const { ctx, advance } = makeCtx({ cfg: { activeCapacity: 2 } });
  const first = addUser(ctx, 'first', { gold: 77, level: 5 });
  advance(1); addUser(ctx, 'second');
  const late = ensureUser(ctx, { userId: 'late', nickname: 'Late', avatar: '' });
  const p = seat(ctx, late);
  assert.equal(p.tier, 'cloud-1');
  assert.equal(first.user.seat, null);
  assert.deepEqual([first.user.gold, first.user.level], [77, 5]);
});

test('migration compacts legacy occupied tiers into Seed Zone and preserves crops/progression', () => {
  const { ctx } = makeCtx();
  const a = ensureUser(ctx, { userId: 'a', nickname: 'A', avatar: '' });
  const b = ensureUser(ctx, { userId: 'b', nickname: 'B', avatar: '' });
  a.level = 5; a.gold = 88; a.seat = { tier: 'cloud-3', slot: 9 };
  b.seat = { tier: 'cloud-2', slot: 3 };
  ctx.state.v = 3;
  ctx.state.plots['cloud-3:9'] = { id:'cloud-3:9',tier:'cloud-3',slot:9,owner:'a',crop:{type:'rau',progress:.7},water:.4,lastActive:200,sleeping:false,deco:[],ver:1 };
  ctx.state.plots['cloud-2:3'] = { id:'cloud-2:3',tier:'cloud-2',slot:3,owner:'b',crop:null,water:1,lastActive:100,sleeping:false,deco:[],ver:2 };
  const r = migrateSeedZone(ctx);
  assert.deepEqual(r, { migrated: true, seated: 2 });
  assert.deepEqual(a.seat, { tier:'cloud-1', slot:0 });
  assert.deepEqual(b.seat, { tier:'cloud-1', slot:1 });
  assert.equal(ctx.state.plots['cloud-1:0'].crop.progress, .7);
  assert.deepEqual([a.level,a.gold], [5,88]);
});

test('isAwake and presence management still hide then release inactive pots', () => {
  const { ctx, advance } = makeCtx({ cfg: { sleepAfterMs:100, evictAfterMs:300 } });
  const { user, plot } = addUser(ctx, 'a');
  advance(101); assert.equal(isAwake(ctx, plot), false);
  assert.deepEqual(managePresence(ctx), { sleeping:1, evicted:0 });
  touch(ctx, user); assert.equal(isAwake(ctx, plot), true);
  advance(301);
  assert.deepEqual(managePresence(ctx), { sleeping:0, evicted:1 });
  assert.equal(user.seat, null);
});

test('emptyGardenState starts at Seed Zone schema v4', () => {
  const s = emptyGardenState(0);
  assert.deepEqual([s.v,s.ver,s.thefts,s.event,s.session], [4,0,[],null,null]);
});

test('seat still allocates exactly one pot per player', () => {
  const { ctx } = makeCtx();
  const user = ensureUser(ctx, { userId:'solo', nickname:'Solo', avatar:'' });
  const plot = seat(ctx, user);
  assert.equal(plot.id, plotId('cloud-1',0));
  assert.equal(Object.values(ctx.state.plots).filter(p => p.owner === 'solo').length,1);
});
