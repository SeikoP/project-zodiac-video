import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { createEvents, modifiers, EVENT_TYPES } from './events.mjs';
import { plant, catchPests, harvest } from './care.mjs';

const grow = (plot) => { plot.crop = { type: 'rau', progress: 0.1, ripeAt: null, pest: false, stolen: 0 }; };

test('rain doubles growth for 30s, then the world is neutral again', () => {
  const k = makeCtx();
  const ev = createEvents(k.ctx);
  ev.force('rain');
  assert.equal(modifiers(k.ctx).grow, 2);
  k.advance(30_001); ev.tick();
  assert.equal(modifiers(k.ctx).grow, 1);
  assert.equal(ev.current(), null);
});

test('golden hour doubles gold and a harvest during it pays double', () => {
  const k = makeCtx();
  k.ctx.mods = () => modifiers(k.ctx);
  const a = addUser(k.ctx, 'a', { gold: 9 });
  const ev = createEvents(k.ctx);
  ev.force('golden');
  plant(k.ctx, a.user, 'rau');
  a.plot.crop.progress = 1; a.plot.crop.ripeAt = k.ctx.now();
  assert.equal(harvest(k.ctx, a.user).gold, 20);
});

test('merchant doubles one crop only', () => {
  const k = makeCtx();
  const ev = createEvents(k.ctx);
  ev.force('merchant');
  const b = modifiers(k.ctx).boost;
  assert.equal(b.mult, 2);
  assert.ok(['rau', 'huongduong', 'nammay'].includes(b.crop));
});

test('a pest storm puts pests on half the awake growing plots and rewards the room when 80% are cleared', () => {
  const k = makeCtx();
  const users = Array.from({ length: 10 }, (_, i) => addUser(k.ctx, 'u' + i, { tier: 'cloud-1' }));
  users.forEach(u => grow(u.plot));
  const ev = createEvents(k.ctx);
  k.ctx.onPestCleared = id => ev.notePestCleared(id);
  ev.force('pests');
  const sick = users.filter(u => u.plot.crop.pest);
  assert.equal(sick.length, 5);
  for (const u of sick.slice(0, 4)) catchPests(k.ctx, u.user);
  k.advance(20_001); ev.tick();
  assert.equal(sick[0].user.gold, 5);
  assert.equal(sick[4].user.gold, 0);
  assert.equal(k.events.find(e => e.type === 'event-end').ok, true);
});

test('a storm cleared by only 60% pays nothing', () => {
  const k = makeCtx();
  const users = Array.from({ length: 10 }, (_, i) => addUser(k.ctx, 'u' + i, { tier: 'cloud-1' }));
  users.forEach(u => grow(u.plot));
  const ev = createEvents(k.ctx);
  k.ctx.onPestCleared = id => ev.notePestCleared(id);
  ev.force('pests');
  const sick = users.filter(u => u.plot.crop.pest);
  for (const u of sick.slice(0, 3)) catchPests(k.ctx, u.user);
  k.advance(20_001); ev.tick();
  assert.deepEqual(sick.map(u => u.user.gold), [0, 0, 0, 0, 0]);
  assert.equal(k.events.find(e => e.type === 'event-end').ok, false);
});

test('events start 180-300s after the last one ended and never repeat the previous kind', () => {
  let r = 0;
  const k = makeCtx({ rng: () => r });
  const ev = createEvents(k.ctx);
  const starts = [], kinds = [];
  for (let n = 0; n < 6; n++) {
    r = n % 2 ? 0.99 : 0;
    const before = k.events.length;
    while (!k.events.slice(before).some(x => x.type === 'event-start')) { k.advance(1000); ev.tick(); }
    starts.push(k.ctx.now());
    kinds.push(k.events.slice(before).find(x => x.type === 'event-start').kind);
    while (ev.current()) { k.advance(1000); ev.tick(); }
  }
  const t0 = Date.UTC(2026, 10, 4, 12);
  assert.ok(starts[0] - t0 >= 180_000 && starts[0] - t0 <= 301_000);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 180_000 && starts[i] - starts[i - 1] <= 301_000 + 61_000);
  for (let i = 1; i < kinds.length; i++) assert.notEqual(kinds[i], kinds[i - 1]);
  assert.ok(kinds.every(x => EVENT_TYPES.includes(x)));
});
