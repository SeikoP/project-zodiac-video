import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from './camera.mjs';
import { gardenConfig } from './config.mjs';
import { plotCenter } from './world.mjs';

const cfg = gardenConfig();
function rig(plots = []) {
  let t = 1_000_000;
  const cam = createCamera({ cfg, now: () => t, getPlots: () => plots });
  return { cam, advance: ms => { t += ms; } };
}
const gift = (tier, plotId = 'cloud-1:3') => ({ type: 'gift', tier, plotId, total: 1, nickname: 'Mai' });
const steal = (plotId = 'cloud-1:1', thiefPlotId = 'cloud-1:8') => ({ type: 'steal', plotId, thiefPlotId });

test('camera starts and stays on one stable overview when nothing happens', () => {
  const r = rig([{ tier: 'cloud-1', slot: 0, owner: 'a' }, { tier: 'cloud-1', slot: 10, owner: 'b' }]);
  const s = r.cam.tick();
  assert.equal(s.kind, 'overview');
  assert.ok(s.zoom >= cfg.camera.zoomWorld && s.zoom <= cfg.camera.zoomTier);
  r.advance(60_000);
  assert.equal(r.cam.tick(), null, 'no garden tour or periodic camera movement');
});

test('a real moment leaves overview immediately, then stays for the full hold before returning home', () => {
  const r = rig([{ tier: 'cloud-1', slot: 3, owner: 'a' }]);
  assert.equal(r.cam.tick().kind, 'overview');
  r.cam.push(gift('tree'));
  const hero = r.cam.tick();
  assert.deepEqual([hero.kind, hero.zoom, hero.holdMs], ['gift', cfg.camera.zoomClose, cfg.camera.giftHoldMs]);
  r.advance(cfg.camera.giftHoldMs - 1);
  assert.equal(r.cam.tick(), null);
  r.advance(2);
  assert.equal(r.cam.tick().kind, 'overview');
});

test('queued moments never replace a shot before its hold expires', () => {
  const r = rig();
  r.cam.push(gift('dew', 'cloud-1:1'));
  assert.equal(r.cam.tick().kind, 'gift');
  r.cam.push(steal('cloud-1:2', 'cloud-1:7'));
  r.cam.push({ type: 'levelup', plotId: 'cloud-1:9' });
  assert.equal(r.cam.state().queue.length, 2);
  r.advance(cfg.camera.lowGiftHoldMs - 1);
  assert.equal(r.cam.tick(), null);
  r.advance(2);
  assert.equal(r.cam.tick().kind, 'steal');
});

test('event start has first priority and uses the active-garden overview', () => {
  const plots = [{ tier: 'cloud-1', slot: 0, owner: 'a' }, { tier: 'cloud-1', slot: 17, owner: 'b' }];
  const r = rig(plots);
  r.cam.push(gift('dew'));
  r.cam.push({ type: 'event-start', kind: 'rain' });
  const s = r.cam.tick();
  assert.deepEqual([s.kind, s.priority, s.eventKind], ['event', 0, 'rain']);
  assert.equal(s.holdMs, cfg.camera.eventHoldMs);
});

test('same-pot gift packets coalesce but different players remain separate queued moments', () => {
  const r = rig();
  r.cam.push(gift('dew', 'cloud-1:1'));
  r.advance(300);
  r.cam.push(gift('star', 'cloud-1:1'));
  r.cam.push(gift('dew', 'cloud-1:2'));
  assert.equal(r.cam.state().queue.length, 2);
  assert.equal(r.cam.state().queue[0].giftKind, 'star');
});

test('arrival bursts cannot fill the whole camera queue', () => {
  const r = rig();
  for (let i = 0; i < 20; i++) r.cam.push({ type: 'joined', plotId: `cloud-1:${i}`, nickname: `U${i}` });
  assert.equal(r.cam.state().queue.filter(q => q.kind === 'welcome').length, 2);
});

test('the queue keeps up to the configured number of meaningful moments', () => {
  const r = rig();
  for (let i = 0; i < 20; i++) r.cam.push(steal(`cloud-${i % 4 + 1}:1`, `cloud-${i % 4 + 1}:2`));
  assert.equal(r.cam.state().queue.length, cfg.camera.queueMax);
});

test('a close shot exposes the slower easing duration to the overlay', () => {
  const r = rig();
  r.cam.push(gift('dew'));
  const s = r.cam.tick();
  assert.equal(s.easeMs, cfg.camera.easeMs);
  assert.ok(s.holdMs > s.easeMs * 2, 'most of the shot is stable enough to read the crop');
});

test('a theft frames both pots without exceeding close zoom', () => {
  const r = rig();
  r.cam.push(steal('cloud-1:1', 'cloud-1:8'));
  const s = r.cam.tick();
  const a = plotCenter('cloud-1', 1, cfg), b = plotCenter('cloud-1', 8, cfg);
  assert.deepEqual([s.x, s.y], [(a.x + b.x) / 2, (a.y + b.y) / 2]);
  assert.ok(s.zoom >= cfg.camera.zoomTier && s.zoom <= cfg.camera.zoomClose);
});

test('locking clears the queue and ignores new events', () => {
  const r = rig();
  r.cam.setLock(true);
  r.cam.push(gift('tree'));
  assert.equal(r.cam.tick(), null);
  assert.equal(r.cam.state().queue.length, 0);
  r.cam.setLock(false);
  r.cam.push(gift('tree'));
  assert.equal(r.cam.tick().kind, 'gift');
});
