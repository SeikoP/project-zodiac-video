import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeywordRound } from './keyword-round.mjs';

const eq = (text, ctx) => text.trim().toLowerCase() === String(ctx?.word ?? 'sao');

function make(extra = {}, state = {}) {
  const clock = { t: 0 };
  const r = createKeywordRound({ now: () => clock.t, match: eq, winners: 3, windowMs: 1000, ...extra }, state);
  return { r, clock, state };
}

test('first three correct win, the fourth is late', () => {
  const { r } = make();
  r.open({ word: 'sao' });
  assert.equal(r.submit('a', 'sao'), 'win');
  assert.equal(r.submit('b', 'SAO'), 'win');
  assert.equal(r.isOpen(), true);
  assert.equal(r.submit('c', ' sao '), 'win');
  assert.equal(r.isOpen(), false);
  assert.equal(r.submit('d', 'sao'), 'late');
  assert.deepEqual(r.winnersList(), ['a', 'b', 'c']);
});

test('a winner typing again is dup, a wrong word is miss', () => {
  const { r } = make();
  r.open({ word: 'sao' });
  assert.equal(r.submit('a', 'sao'), 'win');
  assert.equal(r.submit('a', 'sao'), 'dup');
  assert.equal(r.submit('b', 'trang'), 'miss');
  assert.deepEqual(r.winnersList(), ['a']);
});

test('after windowMs submit is late and the round closes', () => {
  const { r, clock } = make();
  r.open({ word: 'sao' });
  clock.t = 999;
  assert.equal(r.submit('a', 'sao'), 'win');
  clock.t = 1000;
  assert.equal(r.submit('b', 'sao'), 'late');
  assert.equal(r.isOpen(), false);
});

test('submit before open is late', () => {
  const { r } = make();
  assert.equal(r.submit('a', 'sao'), 'late');
});

test('match receives the ctx given to open', () => {
  const seen = [];
  const { r } = make({ match: (t, ctx) => { seen.push(ctx); return t === ctx.word; } });
  const ctx = { word: 'mat trang' };
  r.open(ctx);
  assert.equal(r.submit('a', 'mat trang'), 'win');
  assert.equal(seen[0].word, 'mat trang');
  assert.deepEqual(r.ctx(), ctx);
});

test('close returns winners and closes; reopening clears old winners', () => {
  const { r, clock } = make();
  r.open({ word: 'sao' });
  r.submit('a', 'sao');
  assert.deepEqual(r.close(), ['a']);
  assert.equal(r.isOpen(), false);
  clock.t = 5000;
  r.open({ word: 'sao' });
  assert.deepEqual(r.winnersList(), []);
  assert.equal(r.submit('a', 'sao'), 'win');
});

test('state rebuilt from JSON keeps working', () => {
  const { r, clock, state } = make();
  r.open({ word: 'sao' });
  r.submit('a', 'sao');
  clock.t = 400;
  const saved = JSON.parse(JSON.stringify(state));
  const r2 = createKeywordRound({ now: () => clock.t, match: eq, winners: 3, windowMs: 1000 }, saved);
  assert.equal(r2.isOpen(), true);
  assert.deepEqual(r2.winnersList(), ['a']);
  assert.equal(r2.submit('a', 'sao'), 'dup');
  assert.equal(r2.submit('b', 'sao'), 'win');
  clock.t = 1000;
  assert.equal(r2.submit('c', 'sao'), 'late');
});
