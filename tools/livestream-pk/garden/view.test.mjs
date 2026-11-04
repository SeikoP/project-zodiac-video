import test from 'node:test';
import assert from 'node:assert/strict';
import * as view from '../public/garden/view.js';
import fs from 'node:fs';
const { lodOf, easeCamera, visiblePlots, worldToScreen, plotPos, createAvatarCache } = view;
import { gardenConfig } from './config.mjs';
import { TIERS, plotCenter } from './world.mjs';

const cfg = gardenConfig();
const meta = { tiers: TIERS, cfg };
const VP = { w: 1080, h: 1920 };

test('lodOf: dots when zoomed out, plots in the middle, close-up when zoomed in', () => {
  assert.deepEqual([0.2, 0.26, 0.27, 0.4, 1.24, 1.25, 2.5].map(z => lodOf(z)), ['dot', 'dot', 'plot', 'plot', 'plot', 'close', 'close']);
});

test('plotPos agrees with the Seed Zone module layout', () => {
  for (const slot of [0, 5, 6, 23, 24, 47, 48, 95]) assert.deepEqual(plotPos({ tier:'cloud-1', slot }, meta), plotCenter('cloud-1', slot, cfg));
});

test('easeCamera starts at from, ends exactly at to, and passes between', () => {
  const from = { x: 0, y: 0, zoom: 0.3 }, to = { x: 1000, y: 2000, zoom: 2.5 };
  assert.deepEqual(easeCamera(from, to, 0, 600), from);
  assert.deepEqual(easeCamera(from, to, 600, 600), to);
  assert.deepEqual(easeCamera(from, to, 9999, 600), to);
  const mid = easeCamera(from, to, 300, 600);
  assert.ok(mid.x > 0 && mid.x < 1000 && mid.zoom > 0.3 && mid.zoom < 2.5);
  assert.ok(Math.abs(mid.zoom - Math.sqrt(0.3 * 2.5)) < 1e-9, 'zoom eases in log space, so the midpoint is the geometric mean');
});

test('worldToScreen puts the camera centre in the middle of the frame', () => {
  assert.deepEqual(worldToScreen({ x: 500, y: 700 }, { x: 500, y: 700, zoom: 2 }, VP), { x: 540, y: 960 });
  assert.deepEqual(worldToScreen({ x: 510, y: 700 }, { x: 500, y: 700, zoom: 2 }, VP), { x: 560, y: 960 });
});

const owned = (tier, slot, awake = true) => ({ id: `${tier}:${slot}`, tier, slot, owner: { userId: `${tier}${slot}` }, awake });

test('far overview uses dots; normal overview keeps crops readable', () => {
  const plots = [owned('cloud-1', 0), owned('cloud-1', 24), owned('cloud-1', 48)];
  const far = visiblePlots(plots, { x: 1800, y: 2400, zoom: 0.26 }, VP, meta);
  assert.deepEqual([far.detail.length, far.dots.length], [0, 3]);
  const readable = visiblePlots([plots[0]], { x: plotPos(plots[0], meta).x, y: plotPos(plots[0], meta).y, zoom: 0.38 }, VP, meta);
  assert.equal(readable.detail.length, 1);
});

test('at close rack zoom only plots inside the frame are drawn in detail', () => {
  const near = owned('cloud-1', 0), far = owned('cloud-1', 95);
  const c = plotPos(near, meta);
  const v = visiblePlots([near, far], { x: c.x, y: c.y, zoom: cfg.camera.zoomTier }, VP, meta);
  assert.deepEqual(v.detail.map(p => p.id), ['cloud-1:0']);
  assert.equal(v.dots.length, 0, 'off-screen plots are not drawn at all');
});

test('detail rendering is capped for the intended sub-100 room', () => {
  const plots = [];
  for (let s = 0; s < 96; s++) plots.push(owned('cloud-1', s, true));
  const c = { x: cfg.tierWidth / 2, y: cfg.tierHeight / 2, zoom: 0.38 };
  const v = visiblePlots(plots, c, VP, meta, 3000, 20);
  assert.equal(v.detail.length, 20);
  assert.equal(v.dots.length, 76);
  assert.ok(v.detail.every(p => p.awake));
});

test('the avatar cache starts loading on first ask, hands the image back once loaded, and forgets the oldest', () => {
  const made = [];
  const cache = createAvatarCache(2, url => { const img = { url, complete: false, naturalWidth: 0 }; made.push(img); return img; });
  assert.equal(cache.get('a'), null);
  made[0].complete = true; made[0].naturalWidth = 10;
  assert.equal(cache.get('a'), made[0]);
  cache.get('b'); cache.get('c');
  cache.get('a');
  assert.equal(made.length, 4, 'a was evicted when c arrived and had to be created again');
  assert.equal(cache.get(''), null);
});


test('sleeping plots are excluded entirely from rendering', () => {
  const awake = owned('cloud-1', 0, true), sleeping = owned('cloud-1', 1, false);
  const c = plotPos(awake, meta);
  const v = visiblePlots([awake, sleeping], { x: c.x, y: c.y, zoom: .5 }, VP, meta);
  assert.deepEqual(v.detail.map(p => p.id), [awake.id]);
  assert.equal(v.dots.length, 0);
});

test('logical row eight wraps to a right visual wing at the same vertical shelf', () => {
  const left = plotPos(owned('cloud-1', 0), meta);
  const right = plotPos(owned('cloud-1', 48), meta);
  assert.ok(right.x - left.x > cfg.potSpacingX * 5);
  assert.equal(right.y, left.y);
});

test('overview identity is an adaptive nickname and never a public slot code', () => {
  assert.equal(typeof view.displayNickname, 'function');
  assert.equal(view.displayNickname('Nguyễn Minh Anh', .5), 'Nguyễn…');
  assert.equal(view.displayNickname('Nguyễn Minh Anh', .82), 'Nguyễn Min…');
  assert.equal(view.displayNickname('Mai', .5), 'Mai');
  assert.equal(view.displayNickname('🌱Vườn Mây', .5).startsWith('🌱'), true);
  assert.equal(view.displayNickname('', .5), 'Người xem');
});

test('Garden join notices do not expose slot-number identity', () => {
  const source = fs.readFileSync(new URL('../public/garden/garden.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /chậu #|padStart\(3, '0'\)/);
});
