import test from 'node:test';
import assert from 'node:assert/strict';
import { lodOf, easeCamera, visiblePlots, worldToScreen, plotPos, createAvatarCache } from '../public/garden/view.js';
import { gardenConfig } from './config.mjs';
import { ISLANDS, plotCenter } from './world.mjs';

const cfg = gardenConfig();
const meta = { islands: ISLANDS, cfg };
const VP = { w: 1080, h: 1920 };

test('lodOf: dots when zoomed out, plots in the middle, close-up when zoomed in', () => {
  assert.deepEqual([0.3, 0.49, 0.9, 1.79, 2.5].map(z => lodOf(z)), ['dot', 'dot', 'plot', 'plot', 'close']);
});

test('plotPos agrees with the server layout for every island', () => {
  for (const island of ISLANDS) for (const slot of [0, 7, 35]) assert.deepEqual(plotPos({ island, slot }, meta), plotCenter(island, slot, cfg));
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

const owned = (island, slot, awake = true) => ({ id: `${island}:${slot}`, island, slot, owner: { userId: `${island}${slot}` }, awake });

test('zoomed out every plot is a dot and none is drawn in detail', () => {
  const plots = [owned('leo', 0), owned('aries', 3), owned('virgo', 5)];
  const v = visiblePlots(plots, { x: 1800, y: 2400, zoom: 0.3 }, VP, meta);
  assert.deepEqual([v.detail.length, v.dots.length], [0, 3]);
});

test('at island zoom only plots inside the frame are drawn in detail', () => {
  const near = owned('leo', 0), far = owned('pisces', 0);
  const c = plotPos(near, meta);
  const v = visiblePlots([near, far], { x: c.x, y: c.y, zoom: 0.9 }, VP, meta);
  assert.deepEqual(v.detail.map(p => p.id), ['leo:0']);
  assert.equal(v.dots.length, 0, 'off-screen plots are not drawn at all');
});

test('no more than 150 plots are drawn in detail, awake ones first', () => {
  const plots = [];
  for (let s = 0; s < 36; s++) plots.push(owned('leo', s, s % 2 === 0));
  for (const island of ['aries', 'taurus', 'gemini', 'cancer']) for (let s = 0; s < 36; s++) plots.push(owned(island, s, false));
  const c = { x: 1800, y: 2400, zoom: 0.5 };
  const v = visiblePlots(plots, c, VP, meta, 160, 20);
  assert.equal(v.detail.length, 20);
  assert.ok(v.detail.slice(0, 18).every(p => p.awake), 'the 18 awake leo plots come first');
  assert.ok(v.detail.slice(18).every(p => !p.awake));
  assert.ok(v.dots.length > 0);
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
