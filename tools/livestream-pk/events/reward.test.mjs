import test from 'node:test';
import assert from 'node:assert/strict';
import { createReward } from './reward.mjs';

function make(ret) {
  const calls = [];
  const mk = kind => (u, v, n, why) => { calls.push([kind, u, v, n, why]); return ret ?? n; };
  const stats = {};
  const r = createReward({ sinks: { light: mk('light'), dust: mk('dust'), gem: mk('gem'), moon: mk('moon') }, stats });
  return { r, calls, stats };
}
const u = { userId: 'a' };

test('grant calls the sink and records stats', () => {
  const { r, calls, stats } = make();
  assert.equal(r.grant(u, {}, 'gem', 2, 'boss'), 2);
  assert.deepEqual(calls[0].slice(0, 1).concat(calls[0].slice(3)), ['gem', 2, 'boss']);
  assert.deepEqual(r.statsOf('a'), { boss: 2, gem: 2 });
  r.grant(u, {}, 'gem', 1, 'boss');
  assert.equal(stats.a.boss, 3);
  assert.deepEqual(r.statsOf('nobody'), {});
});

test('zero, negative and non-finite are ignored', () => {
  const { r, calls } = make();
  for (const n of [0, -1, NaN, Infinity, undefined]) assert.equal(r.grant(u, {}, 'dust', n, 'x'), 0);
  assert.equal(calls.length, 0);
});

test('returns what the sink returned; undefined falls back to n', () => {
  const a = make(1);
  assert.equal(a.r.grant(u, {}, 'light', 5, 'w'), 1);
  assert.equal(a.stats.a.w, 1);
  const stats = {};
  const r = createReward({ sinks: { light: () => undefined }, stats });
  assert.equal(r.grant(u, {}, 'light', 4, 'w'), 4);
  assert.equal(stats.a.w, 4);
});

test('unknown kind returns 0', () => {
  const { r } = make();
  assert.equal(r.grant(u, {}, 'bogus', 3, 'w'), 0);
});
