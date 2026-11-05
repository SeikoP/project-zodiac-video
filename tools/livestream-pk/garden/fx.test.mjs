import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoalescer } from './fx.mjs';

const rig = () => { let t = 0; return { co: createCoalescer({ windowMs: 250, now: () => t }), advance: ms => { t += ms; } }; };

test('coalesced harvest keeps bounded local rewards for the renderer',()=>{
 const {co,advance}=rig();
 for(let i=0;i<12;i++)co.push({type:'harvest',plotId:`cloud-1:${i}`,gold:10});
 advance(250);const [fx]=co.flush();
 assert.equal(fx.count,12);assert.equal(fx.plots.length,8);
 assert.deepEqual(fx.plots[0],{plotId:'cloud-1:0',gold:10});
});

test('23 waterings on one terrace in 250ms become one effect with a count and three names', () => {
  const { co, advance } = rig();
  for (let i = 0; i < 23; i++) co.push({ type: 'water', plotId: 'cloud-1:' + i, nickname: 'N' + i });
  assert.deepEqual(co.flush(), [], 'not before the window is over');
  advance(250);
  const out = co.flush();
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].type, out[0].tier, out[0].count, out[0].names.length], ['water', 'cloud-1', 23, 3]);
  assert.deepEqual(co.flush(), []);
});

test('different terraces and different kinds stay separate', () => {
  const { co, advance } = rig();
  co.push({ type: 'water', plotId: 'cloud-1:1' }); co.push({ type: 'water', plotId: 'cloud-2:1' }); co.push({ type: 'harvest', plotId: 'cloud-1:2' });
  advance(250);
  assert.equal(co.flush().length, 3);
});

test('one-off moments (gift, steal, level up) pass straight through, unmerged', () => {
  const { co } = rig();
  co.push({ type: 'gift', tier: 'tree', plotId: 'cloud-1:1' });
  co.push({ type: 'steal', plotId: 'cloud-1:1' });
  const out = co.flush();
  assert.deepEqual(out.map(o => o.type), ['gift', 'steal']);
});

test('grouped joins retain at most three stable pot addresses for discovery', () => {
  const { co, advance } = rig();
  for (let i = 0; i < 5; i++) co.push({ type: 'joined', plotId: 'cloud-1:' + i, nickname: 'Player' + i });
  advance(250);
  const [fx] = co.flush();
  assert.equal(fx.count, 5);
  assert.deepEqual(fx.seats.map(v => v.slot), [0, 1, 2]);
});
