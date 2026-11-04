import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactions } from './reactions.mjs';

const groups = () => ({
  oan: (t) => /\boan\b/i.test(t),
  chuan: (t) => /\bchuẩn\b/i.test(t),
});

test('first matching group wins and onePerUser blocks a second reaction', () => {
  const r = createReactions({ groups: groups() }, {});
  assert.equal(r.react('u', 'oan quá'), 'oan');
  assert.equal(r.react('u', 'chuẩn rồi'), null);
  assert.deepEqual(r.counts(), { oan: 1, chuan: 0 });
  assert.equal(r.has('u'), true);
  assert.equal(r.has('x'), false);
});

test('non matching text returns null and does not mark the user', () => {
  const r = createReactions({ groups: groups() }, {});
  assert.equal(r.react('u', 'xin chào'), null);
  assert.equal(r.has('u'), false);
  assert.deepEqual(r.counts(), { oan: 0, chuan: 0 });
});

test('names returns up to k userIds in reaction order', () => {
  const r = createReactions({ groups: groups() }, {});
  r.react('a', 'oan'); r.react('b', 'chuẩn'); r.react('c', 'oan'); r.react('d', 'oan');
  assert.deepEqual(r.names('oan', 2), ['a', 'c']);
  assert.deepEqual(r.names('oan', 10), ['a', 'c', 'd']);
  assert.deepEqual(r.names('none', 3), []);
});

test('reset clears everything', () => {
  const r = createReactions({ groups: groups() }, {});
  r.react('a', 'oan');
  r.reset();
  assert.deepEqual(r.counts(), { oan: 0, chuan: 0 });
  assert.equal(r.has('a'), false);
  assert.equal(r.react('a', 'chuẩn'), 'chuan');
});

test('onePerUser false lets one user react repeatedly', () => {
  const r = createReactions({ groups: groups(), onePerUser: false }, {});
  assert.equal(r.react('a', 'oan'), 'oan');
  assert.equal(r.react('a', 'oan'), 'oan');
  assert.deepEqual(r.counts(), { oan: 2, chuan: 0 });
  assert.deepEqual(r.names('oan', 5), ['a', 'a']);
});

test('ctx is passed to the matchers (đoán A/B) and state survives JSON', () => {
  const state = {};
  const g = {
    a: (t, ctx) => t.trim().toLowerCase() === `đoán ${ctx.a}`,
    b: (t, ctx) => t.trim().toLowerCase() === `đoán ${ctx.b}`,
  };
  const r = createReactions({ groups: g }, state);
  const ctx = { a: 'a', b: 'b' };
  assert.equal(r.react('u1', 'đoán A', ctx), 'a');
  assert.equal(r.react('u2', 'Đoán B', ctx), 'b');
  const r2 = createReactions({ groups: g }, JSON.parse(JSON.stringify(state)));
  assert.deepEqual(r2.counts(), { a: 1, b: 1 });
  assert.equal(r2.react('u1', 'đoán B', ctx), null);
  assert.deepEqual(r2.names('b', 5), ['u2']);
});
