import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeter } from './meter.mjs';

const weights = { comment: 2, like: 1 };

test('coop accumulates to goal', () => {
  const m = createMeter({ kind: 'coop', goal: 100, weights }, {});
  assert.equal(m.add('u', 'red', 'comment'), 2);
  assert.equal(m.value(), 2);
  assert.equal(m.ratio(), 0.02);
  assert.equal(m.reached(), false);
  m.add('u', 'red', 'comment', 49);
  assert.equal(m.ratio(), 1);
  assert.equal(m.reached(), true);
  m.add('u', 'red', 'comment', 10);
  assert.equal(m.ratio(), 1);
});

test('coop without goal has ratio 0', () => {
  const m = createMeter({ kind: 'coop', weights }, {});
  m.add('u', 'red', 'like');
  assert.equal(m.ratio(), 0);
  assert.equal(m.reached(), false);
});

test('unknown action adds nothing', () => {
  const m = createMeter({ kind: 'coop', goal: 10, weights }, {});
  assert.equal(m.add('u', 'red', 'gift'), 0);
  assert.equal(m.value(), 0);
});

test('versus: first team pulls negative, balance scales', () => {
  const m = createMeter({ kind: 'versus', teams: ['a', 'b'], weights: { x: 1 }, balance: t => (t === 'b' ? 2 : 1) }, {});
  assert.equal(m.add('u1', 'a', 'x', 10), 10);
  assert.equal(m.value(), -10);
  assert.equal(m.add('u2', 'b', 'x', 4), 8);
  assert.equal(m.value(), -2);
});

test('versus clamps and reports reached', () => {
  const m = createMeter({ kind: 'versus', teams: ['a', 'b'], weights: { x: 1 }, clamp: 50 }, {});
  m.add('u', 'a', 'x', 80);
  assert.equal(m.value(), -50);
  assert.equal(m.reached(), true);
  assert.equal(m.ratio(), 1);
  m.add('v', 'b', 'x', 200);
  assert.equal(m.value(), 50);
});

test('versus ignores a team outside teams', () => {
  const m = createMeter({ kind: 'versus', teams: ['a', 'b'], weights: { x: 1 } }, {});
  assert.equal(m.add('u', 'c', 'x', 5), 0);
  assert.equal(m.value(), 0);
  assert.equal(m.powerOf('u'), 0);
});

test('top and topBy use per-user power', () => {
  const m = createMeter({ kind: 'coop', goal: 1000, weights }, {});
  m.add('p', 'red', 'like', 3);
  m.add('q', 'blue', 'comment', 5);
  m.add('r', 'red', 'comment', 2);
  assert.deepEqual(m.top(2), [['q', 10], ['r', 4]]);
  assert.deepEqual(m.topBy('red'), ['r', 4]);
  assert.equal(m.topBy('green'), null);
  assert.equal(m.powerOf('p'), 3);
  assert.equal(m.powerOf('nobody'), 0);
});

test('state is plain JSON and survives a rebuild; reset zeroes', () => {
  const state = {};
  const m = createMeter({ kind: 'coop', goal: 10, weights }, state);
  m.add('u', 'red', 'comment', 2);
  const copy = JSON.parse(JSON.stringify(state));
  const m2 = createMeter({ kind: 'coop', goal: 10, weights }, copy);
  assert.equal(m2.value(), 4);
  assert.deepEqual(m2.topBy('red'), ['u', 4]);
  m2.reset();
  assert.equal(m2.value(), 0);
  assert.deepEqual(m2.top(3), []);
  assert.equal(m2.powerOf('u'), 0);
});

test('versus with an empty side and zero balance does not divide by zero', () => {
  const m = createMeter({ kind: 'versus', teams: ['a', 'b'], weights: { x: 1 }, balance: () => 0 }, {});
  assert.equal(m.add('u', 'a', 'x'), 0);
  assert.equal(m.ratio(), 0);
  assert.ok(Number.isFinite(m.value()));
});
