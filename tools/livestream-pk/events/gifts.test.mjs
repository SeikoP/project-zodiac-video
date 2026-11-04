import test from 'node:test';
import assert from 'node:assert/strict';
import { giftTier, createGiftDispatcher, GIFT_DEFAULTS } from './gifts.mjs';

const cfg = { giftMid: 10, giftBig: 100 };
const base = { user: { userId: 'u' }, viewer: {}, team: 'red' };

test('giftTier thresholds', () => {
  assert.equal(giftTier(9, cfg), 'small');
  assert.equal(giftTier(10, cfg), 'mid');
  assert.equal(giftTier(99, cfg), 'mid');
  assert.equal(giftTier(100, cfg), 'big');
  assert.equal(giftTier(10, {}), 'mid');
  assert.deepEqual(GIFT_DEFAULTS, { giftMid: 10, giftBig: 100 });
});

test('dispatch with no event is unhandled and does not throw', () => {
  const d = createGiftDispatcher({ cfg });
  assert.deepEqual(d.dispatch({ ...base, eventId: null, diamonds: 50 }), { tier: 'mid', handled: false });
});

test('dispatch calls the tier fn once with tier info', () => {
  const d = createGiftDispatcher({ cfg });
  const calls = [];
  d.register('boss', { mid: g => calls.push(g), big: () => calls.push('big') });
  const r = d.dispatch({ ...base, eventId: 'boss', diamonds: 20 });
  assert.deepEqual(r, { tier: 'mid', handled: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tier, 'mid');
  assert.equal(calls[0].diamonds, 20);
  assert.equal(calls[0].team, 'red');
});

test('unregistered event or missing tier is unhandled', () => {
  const d = createGiftDispatcher({ cfg });
  d.register('boss', { big: () => {} });
  assert.equal(d.dispatch({ ...base, eventId: 'nope', diamonds: 1 }).handled, false);
  assert.equal(d.dispatch({ ...base, eventId: 'boss', diamonds: 1 }).handled, false);
});

test('throwing fn is caught', () => {
  const d = createGiftDispatcher({ cfg });
  let n = 0;
  d.register('boss', { small: () => { n++; throw new Error('x'); } });
  assert.deepEqual(d.dispatch({ ...base, eventId: 'boss', diamonds: 1 }), { tier: 'small', handled: false });
  assert.equal(n, 1);
});

test('malformed diamonds are always small', () => {
  for (const d of [NaN, undefined, -5, Infinity, -Infinity]) assert.equal(giftTier(d, cfg), 'small');
});

test('dispatch with NaN diamonds runs the small ability, not big', () => {
  const d = createGiftDispatcher({ cfg });
  const hit = [];
  d.register('boss', { small: () => hit.push('small'), big: () => hit.push('big') });
  assert.deepEqual(d.dispatch({ ...base, eventId: 'boss', diamonds: NaN }), { tier: 'small', handled: true });
  assert.deepEqual(hit, ['small']);
});

test('a fn that answers false found nothing to act on: unhandled, so the ordinary path runs', () => {
  const d = createGiftDispatcher({ cfg });
  d.register('wish', { small: () => false, mid: () => {}, big: () => true });
  assert.deepEqual(d.dispatch({ ...base, eventId: 'wish', diamonds: 1 }), { tier: 'small', handled: false });
  assert.equal(d.dispatch({ ...base, eventId: 'wish', diamonds: 20 }).handled, true);
  assert.equal(d.dispatch({ ...base, eventId: 'wish', diamonds: 200 }).handled, true);
});
