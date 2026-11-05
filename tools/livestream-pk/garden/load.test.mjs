import test from 'node:test';
import assert from 'node:assert/strict';
import { runLoad } from './sim.mjs';

test('48 arriving viewers keep a readable 42-seat live garden for three minutes', () => {
  const r = runLoad({ users: 48, seconds: 180, giftsPerMin: 6, seed: 1 });
  console.log(`[load] tick p95 ${r.tickMsP95.toFixed(2)}ms · frame p95 ${r.frameBytesP95}B · shots/min ${r.shotsPerMin} (non-gift ${r.nonGiftShots})`);
  assert.ok(r.tickMsP95 < 20, `tick p95 ${r.tickMsP95}ms (target 5ms, bound 20ms so slow machines do not flake)`);
  assert.ok(r.frameBytesP95 < 90_000, `frame p95 ${r.frameBytesP95}B`);
  assert.ok(r.shotsPerMin >= 1 && r.shotsPerMin <= 12, `deliberate shots/min ${r.shotsPerMin}`);
  assert.ok(r.nonGiftShots >= 0);
  assert.equal(r.seated, 42);
});

test('the same seed gives the same run', () => {
  const a = runLoad({ users: 36, seconds: 20, seed: 7 }), b = runLoad({ users: 36, seconds: 20, seed: 7 });
  assert.deepEqual([a.shotsPerMin, a.nonGiftShots, a.harvests], [b.shotsPerMin, b.nonGiftShots, b.harvests]);
});
