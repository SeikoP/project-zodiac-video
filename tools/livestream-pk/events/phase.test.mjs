import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase } from './phase.mjs';

test('warmup then run then ended, each transition once', () => {
  let t = 0; const now = () => t;
  const p = createPhase({ now, warmupMs: 1000, runMs: 5000 }, {});
  assert.equal(p.phase(), 'idle');
  p.start();
  assert.equal(p.phase(), 'warmup');
  assert.equal(p.tick(), null);
  assert.equal(p.warmupLeft(), 1000);
  assert.equal(p.msLeft(), 5000);
  t = 1000;
  assert.equal(p.tick(), 'run');
  assert.equal(p.tick(), null);
  assert.equal(p.phase(), 'run');
  assert.equal(p.warmupLeft(), 0);
  t = 3500;
  assert.equal(p.msLeft(), 2500);
  t = 6000;
  assert.equal(p.tick(), 'ended');
  assert.equal(p.phase(), 'ended');
  assert.equal(p.tick(), null);
  assert.equal(p.msLeft(), 0);
});

test('no warmup starts straight in run', () => {
  let t = 0; const now = () => t;
  const p = createPhase({ now, runMs: 100 }, {});
  p.start();
  assert.equal(p.phase(), 'run');
  t = 100;
  assert.equal(p.tick(), 'ended');
});

test('a late tick that crosses both boundaries reports run, then ended', () => {
  let t = 0; const now = () => t;
  const p = createPhase({ now, warmupMs: 10, runMs: 20 }, {});
  p.start();
  t = 500;
  assert.equal(p.tick(), 'run');
  assert.equal(p.tick(), 'ended');
  assert.equal(p.tick(), null);
});

test('stop returns to idle; msLeft never negative', () => {
  let t = 0; const now = () => t;
  const p = createPhase({ now, runMs: 100 }, {});
  p.start();
  t = 9999;
  assert.equal(p.msLeft(), 0);
  p.stop();
  assert.equal(p.phase(), 'idle');
  assert.equal(p.tick(), null);
});

test('rebuilt from the same state continues in the right phase', () => {
  let t = 0; const now = () => t;
  const state = {};
  const opts = { now, warmupMs: 1000, runMs: 5000 };
  createPhase(opts, state).start();
  const saved = JSON.parse(JSON.stringify(state));
  const savedAgain = JSON.parse(JSON.stringify(state));
  t = 2000;
  const p = createPhase(opts, saved);
  assert.equal(p.phase(), 'warmup');
  assert.equal(p.tick(), 'run');
  assert.equal(p.msLeft(), 4000);
  t = 6000;
  const q = createPhase(opts, savedAgain);
  q.tick();
  assert.equal(q.tick(), 'ended');
});
