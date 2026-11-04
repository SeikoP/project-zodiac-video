import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from './camera.mjs';
import { gardenConfig } from './config.mjs';
import { plotCenter, tierCenter } from './world.mjs';

const cfg = gardenConfig();
function rig() {
  let t = 1_000_000;
  const cam = createCamera({ cfg, now: () => t });
  return { cam, advance: ms => { t += ms; } };
}
const gift = (tier, plotId = 'cloud-1:3') => ({ type: 'gift', tier, plotId, total: 1 });
const steal = (plotId = 'cloud-1:1', thiefPlotId = 'cloud-1:8') => ({ type: 'steal', plotId, thiefPlotId });

test('a tree gift frames the givers terrace for 4s and beats a theft waiting', () => {
  const r = rig();
  r.cam.push(steal('cloud-2:1', 'cloud-2:2'));
  r.cam.push(gift('tree', 'cloud-1:3'));
  const s = r.cam.tick();
  assert.deepEqual([s.kind, s.priority, s.zoom, s.holdMs], ['gift', 1, cfg.camera.zoomTier, 4000]);
  assert.deepEqual([s.x, s.y], [plotCenter('cloud-1', 3, cfg).x, plotCenter('cloud-1', 3, cfg).y]);
});

test('a small gift gets the cloud terrace view for 2.5s', () => {
  const r = rig();
  r.cam.push(gift('dew'));
  const s = r.cam.tick();
  assert.deepEqual([s.priority, s.zoom, s.holdMs], [2, cfg.camera.zoomTier, 2500]);
  assert.deepEqual([s.x, s.y], [tierCenter('cloud-1', cfg).x, tierCenter('cloud-1', cfg).y]);
});

test('a theft frames both plots', () => {
  const r = rig();
  r.cam.push(steal('cloud-1:1', 'cloud-1:8'));
  const s = r.cam.tick();
  const a = plotCenter('cloud-1', 1, cfg), b = plotCenter('cloud-1', 8, cfg);
  assert.equal(s.priority, 3);
  assert.deepEqual([s.x, s.y], [(a.x + b.x) / 2, (a.y + b.y) / 2]);
  assert.ok(s.zoom >= cfg.camera.zoomTier && s.zoom <= cfg.camera.zoomClose);
});

test('the shot does not change before 2s; then a 1s wide gap, then the next shot', () => {
  const r = rig();
  r.cam.push(gift('dew', 'cloud-1:1'));
  assert.ok(r.cam.tick());
  r.cam.push(gift('tree', 'cloud-2:2'));
  r.advance(1999);
  assert.equal(r.cam.tick(), null);
  r.advance(1000);
  const gap = r.cam.tick();
  assert.deepEqual([gap.kind, gap.zoom, gap.holdMs], ['gap', cfg.camera.zoomWorld, 1000]);
  assert.equal(r.cam.tick(), null);
  r.advance(1000);
  assert.equal(r.cam.tick().kind, 'gift');
});

test('waiting events expire: a theft is dropped after 6s, a gift after 15s', () => {
  const r = rig();
  r.cam.push(gift('tree', 'cloud-1:1'));
  r.cam.push(steal('cloud-2:1', 'cloud-2:2'));
  r.cam.push(gift('dew', 'cloud-3:1'));
  assert.equal(r.cam.tick().kind, 'gift'); // the tree
  r.advance(6500 + 1000);
  const kinds = [];
  for (let i = 0; i < 6; i++) { const s = r.cam.tick(); if (s) kinds.push(s.kind); r.advance(1000); }
  assert.ok(!kinds.includes('steal'), kinds.join());
  assert.ok(kinds.includes('gift'), 'the 15s gift is still worth showing');
});

test('two events on the same terrace within 1.5s merge into one terrace shot', () => {
  const r = rig();
  r.cam.push(gift('dew', 'cloud-1:1'));
  r.advance(500);
  r.cam.push(gift('star', 'cloud-1:20'));
  assert.equal(r.cam.state().queue.length, 1);
  const s = r.cam.tick();
  assert.deepEqual([s.kind, s.zoom], ['tier', cfg.camera.zoomTier]);
});

test('lighting quota: after a gift shot, a waiting non-gift is shown before further gifts', () => {
  const r = rig();
  r.cam.push(gift('tree', 'cloud-1:1'));
  assert.equal(r.cam.tick().kind, 'gift');
  r.cam.push(gift('tree', 'cloud-2:1'));
  r.cam.push({ type: 'levelup', plotId: 'cloud-3:4' });
  r.advance(4000); assert.equal(r.cam.tick().kind, 'gap');
  r.advance(1000);
  assert.equal(r.cam.tick().kind, 'levelup');
});

test('the queue holds 8: the lowest priority is dropped when a ninth arrives', () => {
  const r = rig();
  for (let i = 0; i < 8; i++) r.cam.push(steal(`cloud-${i % 4 + 1}:1`, `cloud-${i % 4 + 1}:2`));
  r.cam.push({ type: 'event-start', kind: 'rain' });
  assert.equal(r.cam.state().queue.length, 8);
  assert.ok(r.cam.state().queue.every(q => q.priority === 3));
});

test('locking holds the view and ignores events', () => {
  const r = rig();
  r.cam.setLock(true);
  r.cam.push(gift('tree'));
  assert.equal(r.cam.tick(), null);
  assert.equal(r.cam.state().queue.length, 0);
  r.cam.setLock(false);
  r.cam.push(gift('tree'));
  assert.equal(r.cam.tick().kind, 'gift');
});

test('with nothing happening it shows the full four-tier garden, then refreshes after 8s', () => {
  const r = rig();
  const s = r.cam.tick();
  assert.deepEqual([s.kind, s.x, s.y, s.zoom], ['idle', cfg.tierWidth / 2, 4 * cfg.tierHeight / 2, cfg.camera.zoomWorld]);
  r.advance(7999);
  assert.equal(r.cam.tick(), null);
  r.advance(2);
  assert.equal(r.cam.tick().kind, 'idle');
});

test('a gift from a player with no plot is shown as a wide shot', () => {
  const r = rig();
  r.cam.push({ type: 'gift', tier: 'rain', plotId: null, total: 100 });
  const s = r.cam.tick();
  assert.deepEqual([s.priority, s.zoom], [1, cfg.camera.zoomWorld]);
});

test('a players first ripe crop is a moment worth a shot; later ordinary ripe crops are not', () => {
  const r = rig();
  r.cam.push({ type: 'ripe', plotId: 'cloud-1:1', crop: 'rau', first: false });
  assert.equal(r.cam.state().queue.length, 0);
  r.cam.push({ type: 'ripe', plotId: 'cloud-1:1', crop: 'rau', first: true });
  const s = r.cam.tick();
  assert.deepEqual([s.kind, s.priority], ['ripe', 4]);
});

test('an idle drift gives way to a real moment after the minimum hold, without a gap shot', () => {
  const r = rig();
  assert.equal(r.cam.tick().kind, 'idle');
  r.cam.push(steal('cloud-1:1', 'cloud-1:8'));
  r.advance(1999);
  assert.equal(r.cam.tick(), null);
  r.advance(2);
  assert.equal(r.cam.tick().kind, 'steal');
});
