import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoalescer } from './fx.mjs';

const rig = () => { let t = 0; return { co: createCoalescer({ windowMs: 250, now: () => t }), advance: ms => { t += ms; } }; };

test('23 waterings on one island in 250ms become one effect with a count and three names', () => {
  const { co, advance } = rig();
  for (let i = 0; i < 23; i++) co.push({ type: 'water', plotId: 'leo:' + i, nickname: 'N' + i });
  assert.deepEqual(co.flush(), [], 'not before the window is over');
  advance(250);
  const out = co.flush();
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].type, out[0].island, out[0].count, out[0].names.length], ['water', 'leo', 23, 3]);
  assert.deepEqual(co.flush(), []);
});

test('different islands and different kinds stay separate', () => {
  const { co, advance } = rig();
  co.push({ type: 'water', plotId: 'leo:1' }); co.push({ type: 'water', plotId: 'aries:1' }); co.push({ type: 'harvest', plotId: 'leo:2' });
  advance(250);
  assert.equal(co.flush().length, 3);
});

test('one-off moments (gift, steal, level up) pass straight through, unmerged', () => {
  const { co } = rig();
  co.push({ type: 'gift', tier: 'tree', plotId: 'leo:1' });
  co.push({ type: 'steal', plotId: 'leo:1' });
  const out = co.flush();
  assert.deepEqual(out.map(o => o.type), ['gift', 'steal']);
});
