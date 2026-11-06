import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, SEED_ZONE, plotId, plotCenter, plotLayout, shelfSurface, ensureUser, balancedSlotOrder, seat, touch, isAwake, managePresence, migrateSeedZone, emptyGardenState } from './world.mjs';
import { makeCtx, addUser } from './testkit.mjs';

test('the live garden exposes one Seed Zone with a 42-player two-wing rack', () => {
  const { ctx } = makeCtx();
  assert.deepEqual(TIERS, [SEED_ZONE]);
  assert.equal(ctx.cfg.activeCapacity, 42);
  assert.deepEqual(
    [ctx.cfg.potsPerShelf, ctx.cfg.rackWings, ctx.cfg.shelvesPerWing, ctx.cfg.moduleCapacity],
    [3, 2, 7, 42],
  );
});

test('physical layout wraps logical row 7 into the right wing without changing slots', () => {
  const { ctx } = makeCtx();
  const left0 = plotLayout(0, ctx.cfg), leftLast = plotLayout(20, ctx.cfg);
  const right0 = plotLayout(21, ctx.cfg), rightLast = plotLayout(41, ctx.cfg);
  assert.deepEqual([left0.wing, left0.row, left0.col], [0, 0, 0]);
  assert.deepEqual([leftLast.wing, leftLast.row, leftLast.col], [0, 6, 2]);
  assert.deepEqual([right0.wing, right0.row, right0.col], [1, 0, 0]);
  assert.deepEqual([rightLast.wing, rightLast.row, rightLast.col], [1, 6, 2]);
  assert.equal(leftLast.x - plotLayout(18, ctx.cfg).x, ctx.cfg.potSpacingX * 2);
  assert.equal(right0.x - left0.x, (ctx.cfg.potsPerShelf - 1) * ctx.cfg.potSpacingX + ctx.cfg.rackWingGapX);
  assert.equal(right0.y, left0.y);
  assert.equal(shelfSurface(21, ctx.cfg) - plotCenter('cloud-1', 21, ctx.cfg).y, ctx.cfg.potBottomOffset + ctx.cfg.potShelfGap);
  assert.ok(ctx.cfg.shelfSpacingY >= 220);
});
test('new arrivals spread across the rack without ever changing an existing seat', () => {
  const { ctx } = makeCtx();
  const ids = [];
  for (let i = 0; i < 12; i++) ids.push(addUser(ctx, 'u' + i).user.seat.slot);
  const rows = new Set(ids.map(slot => Math.floor(slot / ctx.cfg.potsPerShelf)));
  assert.equal(rows.size, 4);
  for (let i = 12; i < 42; i++) addUser(ctx, 'u' + i);
  assert.equal(new Set(balancedSlotOrder(ctx.cfg)).size, 42);
  for (let i = 0; i < 12; i++) assert.equal(ctx.state.users['u' + i].seat.slot, ids[i]);
});

test('seat fills one Seed Zone and never opens legacy cloud tiers', () => {
  const { ctx } = makeCtx();
  for (let i = 0; i < 42; i++) addUser(ctx, 'u' + i);
  assert.equal(Object.values(ctx.state.users).filter(u => u.seat?.tier === 'cloud-1').length, 42);
  const late = ensureUser(ctx, { userId: 'late', nickname: 'Late', avatar: '' });
  for (const p of Object.values(ctx.state.plots)) if (p.owner) p.crop = { type: 'rau', progress: 0, ripeAt: null };
  assert.equal(seat(ctx, late), null);
});

test('an empty inactive pot can still be reclaimed without deleting progression', () => {
  const { ctx, advance } = makeCtx({ cfg: { activeCapacity: 2 } });
  const first = addUser(ctx, 'first', { gold: 77, level: 5 });
  advance(1); addUser(ctx, 'second');
  advance(180000);
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

test('shrinking a legacy 48-seat save to 42 keeps user progression and the 42 most recent pots', () => {
  const { ctx } = makeCtx();
  for (let i = 0; i < 48; i++) {
    const id='legacy-'+i,u=ensureUser(ctx,{userId:id,nickname:id,avatar:''});
    u.level=1+(i%10);u.gold=100+i;u.seat={tier:'cloud-1',slot:i};
    ctx.state.plots['cloud-1:'+i]={id:'cloud-1:'+i,tier:'cloud-1',slot:i,owner:id,crop:{type:'rau',progress:i/100},water:1,lastActive:1000+i,sleeping:false,deco:[],ver:i+1};
  }
  const r=migrateSeedZone(ctx);
  assert.deepEqual(r,{migrated:true,seated:42});
  assert.equal(Object.values(ctx.state.users).filter(u=>u.seat).length,42);
  assert.equal(ctx.state.users['legacy-0'].seat,null);
  assert.equal(ctx.state.users['legacy-0'].gold,100,'overflow player progression survives migration');
  assert.equal(ctx.state.users['legacy-47'].gold,147);
  assert.ok(Object.values(ctx.state.plots).some(p=>p.owner==='legacy-47'&&p.crop?.progress===.47),'most recent planted pot is preserved');
});

test('presence management retains inactive pots and restores legacy sleeping pots', () => {
  const { ctx, advance } = makeCtx({ cfg: { sleepAfterMs:100, evictAfterMs:300 } });
  const { user, plot } = addUser(ctx, 'a');
  advance(301); assert.equal(isAwake(ctx, plot), true);
  assert.deepEqual(managePresence(ctx), { sleeping:0, evicted:0 });
  assert.ok(user.seat);plot.sleeping=true;
  managePresence(ctx);assert.equal(isAwake(ctx, plot),true);
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
