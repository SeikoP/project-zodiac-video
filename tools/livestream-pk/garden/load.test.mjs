import test from 'node:test';
import assert from 'node:assert/strict';
import { runLoad } from './sim.mjs';

test('432 players for ten minutes: ticks stay cheap, frames stay small, the camera keeps working', () => {
  const r = runLoad({ users: 432, seconds: 600, giftsPerMin: 6, seed: 1 });
  console.log(`[load] tick p95 ${r.tickMsP95.toFixed(2)}ms · frame p95 ${r.frameBytesP95}B · shots/min ${r.shotsPerMin} (non-gift ${r.nonGiftShots})`);
  assert.ok(r.tickMsP95 < 20, `tick p95 ${r.tickMsP95}ms (target 5ms, bound 20ms so slow machines do not flake)`);
  assert.ok(r.frameBytesP95 < 200_000, `frame p95 ${r.frameBytesP95}B`);
  assert.ok(r.shotsPerMin >= 4, `shots/min ${r.shotsPerMin}`);
  assert.ok(r.nonGiftShots >= 2, 'players who never give still get on screen');
  assert.equal(r.seated, 432);
});

test('the same seed gives the same run', () => {
  const a = runLoad({ users: 60, seconds: 20, seed: 7 }), b = runLoad({ users: 60, seconds: 20, seed: 7 });
  assert.deepEqual([a.shotsPerMin, a.nonGiftShots, a.harvests], [b.shotsPerMin, b.nonGiftShots, b.harvests]);
});
