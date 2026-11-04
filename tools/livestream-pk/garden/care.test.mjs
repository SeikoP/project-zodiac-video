import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { plant, water, catchPests, harvest, tickPlots } from './care.mjs';
import { CROPS, cropByName, seedCost, stageOf, advanceStage } from './crops.mjs';

// move the clock in 1s steps, ticking the garden each step (the server ticks every 150ms; 1s is enough here)
const run = (k, ms) => { for (let left = ms; left > 0; left -= 1000) { k.advance(Math.min(1000, left)); tickPlots(k.ctx); } };
const ready = (gold = 100, tier = 'cloud-1', level = 1) => { const k = makeCtx(); const p = addUser(k.ctx, 'a', { gold, level, tier }); return { ...k, ...p }; };

test('cropByName understands accents and spacing', () => {
  assert.equal(cropByName('Rau'), 'rau');
  assert.equal(cropByName('hướng dương'), 'huongduong');
  assert.equal(cropByName('nấm mây'), 'nammay');
  assert.equal(cropByName('xyz'), null);
  assert.equal(seedCost('rau', { seedCostRate: 0.4 }), 4);
});

test('plant takes the plot, refuses a second crop, a locked crop and an empty purse', () => {
  const k = ready(100);
  assert.equal(plant(k.ctx, k.user, 'rau').ok, true);
  assert.equal(k.user.gold, 96);
  assert.equal(plant(k.ctx, k.user, 'rau').reason, 'busy');
  const poor = addUser(k.ctx, 'b', { gold: 0, tier: 'cloud-1' });
  assert.equal(plant(k.ctx, poor.user, 'rau').reason, 'gold');
  assert.equal(poor.plot.crop, null);
  const low = addUser(k.ctx, 'c', { gold: 100, tier: 'cloud-1' });
  assert.equal(plant(k.ctx, low.user, 'huongduong').reason, 'level');
});

test('rau is ripe a little after 180s when kept watered, and old 120s later', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  for (let i = 0; i < 182; i++) { k.plot.water = 1; run(k, 1000); k.plot.lastActive = k.ctx.now(); }
  assert.equal(stageOf(k.plot.crop, k.ctx.now(), k.ctx.cfg), 3);
  for (let i = 0; i < 122; i++) { k.plot.lastActive = k.ctx.now(); run(k, 1000); }
  assert.equal(stageOf(k.plot.crop, k.ctx.now(), k.ctx.cfg), 4);
});

test('an old crop pays half; a ripe one pays full gold and xp and frees the plot', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  k.plot.crop.progress = 1; k.plot.crop.ripeAt = k.ctx.now();
  const full = harvest(k.ctx, k.user);
  assert.deepEqual([full.gold, full.xp, k.plot.crop], [10, 5, null]);
  plant(k.ctx, k.user, 'rau');
  k.plot.crop.progress = 1; k.plot.crop.ripeAt = k.ctx.now() - 130_000;
  assert.equal(harvest(k.ctx, k.user).gold, 5);
  assert.equal(harvest(k.ctx, k.user).reason, 'no-crop');
});

test('a dry plot grows at half speed', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a', { gold: 9, tier: 'cloud-1' }), b = addUser(k.ctx, 'b', { gold: 9, tier: 'cloud-1' });
  plant(k.ctx, a.user, 'rau'); plant(k.ctx, b.user, 'rau');
  a.plot.water = 0;
  k.advance(4000); tickPlots(k.ctx);
  assert.ok(Math.abs(a.plot.crop.progress / b.plot.crop.progress - 0.5) < 1e-9);
});

test('pests slow growth to 0.6, cost 30% of the harvest, and bắt sâu removes them', () => {
  const k = makeCtx({ rng: () => 0 });
  const a = addUser(k.ctx, 'a', { gold: 9, tier: 'cloud-1' });
  plant(k.ctx, a.user, 'rau');
  k.advance(1000); tickPlots(k.ctx);
  assert.equal(a.plot.crop.pest, true);
  assert.ok(Math.abs(a.plot.crop.progress - 1000 / 180000 * 0.6) < 1e-9);
  a.plot.crop.progress = 1; a.plot.crop.ripeAt = k.ctx.now();
  assert.equal(harvest(k.ctx, a.user).gold, 7);
  plant(k.ctx, a.user, 'rau');
  a.plot.crop.pest = true;
  assert.equal(catchPests(k.ctx, a.user).cleared, true);
  assert.equal(a.plot.crop.pest, false);
  assert.equal(catchPests(k.ctx, a.user).reason, 'no-pest');
});

test('helping a neighbour water pays both in xp and the helper one gold, once per 30s', () => {
  const k = makeCtx();
  const a = addUser(k.ctx, 'a', { gold: 9, tier: 'cloud-1' }), b = addUser(k.ctx, 'b', { gold: 9, tier: 'cloud-1' });
  plant(k.ctx, b.user, 'rau');
  assert.equal(water(k.ctx, a.user, b.user).ok, true);
  assert.deepEqual([a.user.xp, b.user.xp, a.user.gold], [2, 2, 10]);
  k.advance(16_000);
  assert.equal(water(k.ctx, a.user, b.user).reason, 'cooldown');
  k.advance(15_000);
  assert.equal(water(k.ctx, a.user, b.user).ok, true);
});

test('watering the same plot twice within 15s is refused', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  assert.equal(water(k.ctx, k.user).ok, true);
  assert.equal(water(k.ctx, k.user).reason, 'cooldown');
});

test('a huge pause (laptop asleep) advances a crop by at most 5s', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  k.advance(3_600_000); k.plot.lastActive = k.ctx.now();
  tickPlots(k.ctx);
  assert.ok(k.plot.crop.progress <= 5000 / 180000 + 1e-9);
});

test('a sleeping plot (no action for 5 minutes) does not grow', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  k.advance(301_000); tickPlots(k.ctx); // first tick after the pause is clamped but the plot is asleep anyway
  const before = k.plot.crop.progress;
  run(k, 20_000);
  assert.equal(k.plot.crop.progress, before);
});

test('advanceStage jumps to the next stage threshold and stops at ripe', () => {
  const crop = { type: 'rau', progress: 0, ripeAt: null, pest: false, stolen: 0 };
  advanceStage(crop, 5); assert.equal(crop.progress, 0.2);
  advanceStage(crop, 5); assert.equal(crop.progress, 0.55);
  advanceStage(crop, 5); assert.deepEqual([crop.progress, crop.ripeAt], [1, 5]);
  advanceStage(crop, 9); assert.equal(crop.ripeAt, 5);
  assert.equal(CROPS.nammay.minLevel, 4);
});

test('the ripe event says whether it is the owners first crop', () => {
  const k = ready();
  plant(k.ctx, k.user, 'rau');
  for (let i = 0; i < 182; i++) { k.plot.water = 1; run(k, 1000); k.plot.lastActive = k.ctx.now(); }
  assert.equal(k.events.find(e => e.type === 'ripe').first, true);
  harvest(k.ctx, k.user);
  k.events.length = 0;
  plant(k.ctx, k.user, 'rau');
  for (let i = 0; i < 182; i++) { k.plot.water = 1; run(k, 1000); k.plot.lastActive = k.ctx.now(); }
  assert.equal(k.events.find(e => e.type === 'ripe').first, false);
});
