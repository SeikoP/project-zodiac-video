import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { giftTier, applyGift } from './gifts.mjs';
import { ensureUser } from './world.mjs';
import { stageOf } from './crops.mjs';

const grow = (plot, progress = 0.1) => { plot.crop = { type: 'rau', progress, ripeAt: null, pest: false, stolen: 0 }; };

test('gift reports actual before/after growth and ignores ripe crops in the affected count',()=>{
 const k=makeCtx(),a=addUser(k.ctx,'a'),b=addUser(k.ctx,'b'),c=addUser(k.ctx,'c');
 grow(a.plot,.1);grow(b.plot,.3);grow(c.plot,1);
 applyGift(k.ctx,a.user,{diamonds:100,count:1});const gift=k.events.at(-1);
 assert.equal(gift.affected,2);
 assert.deepEqual(gift.effects,[{plotId:a.plot.id,from:.1,to:.2},{plotId:b.plot.id,from:.3,to:.55}]);
});

test('dew on a ripe crop still reports watering without inventing growth',()=>{
 const k=makeCtx(),a=addUser(k.ctx,'a');grow(a.plot,1);a.plot.water=0;
 applyGift(k.ctx,a.user,{diamonds:1,count:1});const gift=k.events.at(-1);
 assert.equal(gift.affected,1);assert.deepEqual(gift.effects,[{plotId:a.plot.id,from:1,to:1}]);
});

test('giftTier cuts at 5, 50, 100, 500 and 1000 xu', () => {
  assert.deepEqual([1, 4, 5, 49, 50, 99, 100, 499, 500, 999, 1000].map(t => giftTier(t)), ['dew', 'dew', 'star', 'star', 'roulette', 'roulette', 'rain', 'rain', 'meteor', 'meteor', 'cataclysm']);
});

test('dew waters the givers plot and adds 10% progress, without changing the stage jump rules', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a');
  grow(a.plot, 0.1); a.plot.water = 0;
  applyGift(k.ctx, a.user, { diamonds: 1, count: 1 });
  assert.equal(a.plot.water, 1);
  assert.ok(Math.abs(a.plot.crop.progress - 0.2) < 1e-9);
});

test('star lifts the givers growing crop exactly one stage', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a');
  grow(a.plot, 0.1);
  applyGift(k.ctx, a.user, { diamonds: 10, count: 1 });
  assert.equal(stageOf(a.plot.crop, k.ctx.now(), k.ctx.cfg), 1);
  assert.equal(a.plot.crop.progress, 0.2);
});

test('rain lifts every growing crop in the garden, not only the givers', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a'), b = addUser(k.ctx, 'b');
  grow(a.plot); grow(b.plot, 0.3);
  applyGift(k.ctx, a.user, { diamonds: 100, count: 1 });
  assert.equal(b.plot.crop.progress, 0.55);
  assert.equal(a.plot.crop.progress, 0.2);
});

test('high gifts destroy a rival crop and ripen and shield the giver', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a'), b = addUser(k.ctx, 'b');
  grow(b.plot, 0.3);
  applyGift(k.ctx, a.user, { diamonds: 1000, count: 1 });
  applyGift(k.ctx, a.user, { diamonds: 1500, count: 1 });
  assert.equal(a.plot.crop.progress,1);assert.ok(a.plot.shieldUntil>k.ctx.now());
  assert.equal(b.plot.crop,null);assert.equal(b.plot.replantCredit,true);
  assert.equal(k.events.at(-1).impact.destroyed.length,0,'a second strike does not destroy an already empty crop');
});

test('a big combo is one cataclysm event, not thousands', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a');
  applyGift(k.ctx, a.user, { diamonds: 1, count: 5000 });
  assert.equal(k.events.filter(e => e.type === 'gift').length, 1);
  assert.equal(k.events.at(-1).tier, 'cataclysm');
});

test('gifts never change gold, xp or level', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a', { gold: 7 });
  grow(a.plot);
  for (const d of [1, 10, 100, 1000]) applyGift(k.ctx, a.user, { diamonds: d, count: 1 });
  assert.deepEqual([a.user.gold, a.user.xp, a.user.level], [7, 0, 1]);
});

test('a giver with no plot is seated first so the gift shows', () => {
  const k = makeCtx();
  const u = ensureUser(k.ctx, { userId: 'new', nickname: 'N', avatar: '' });
  const r = applyGift(k.ctx, u, { diamonds: 10, count: 1 });
  assert.ok(r.plotId);
  assert.ok(u.seat);
  assert.equal(k.ctx.state.plots[r.plotId].crop.type,'rau');
  assert.equal(k.ctx.state.plots[r.plotId].crop.progress,.2);
  assert.equal(k.events.at(-1).benefits.seeded,1);
  assert.equal(u.gold,20);
});

test('when all 96 Seed Zone pots have growing crops the gift still shows with no plot', () => {
  const k=makeCtx();
  for(let n=0;n<k.ctx.cfg.activeCapacity;n++)grow(addUser(k.ctx,`u-${n}`).plot);
  const u=ensureUser(k.ctx,{userId:'late',nickname:'L',avatar:''});
  const r=applyGift(k.ctx,u,{diamonds:100,count:1});
  assert.equal(r.plotId,null);assert.equal(k.events.at(-1).tier,'rain');assert.equal(k.events.at(-1).plotId,null);
});
