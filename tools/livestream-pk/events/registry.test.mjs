import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from './registry.mjs';

function def(id, extra = {}) {
  const log = [];
  return { log, id, start: o => { log.push(['start', o]); return true; }, ...extra };
}

test('needs blocks start; unknown id false', () => {
  const reg = createRegistry({ ctx: { teams: 1 } });
  reg.register(def('tug', { needs: c => c.teams >= 2 }));
  assert.equal(reg.start('tug'), false);
  assert.equal(reg.start('zzz'), false);
  assert.equal(reg.active(), null);
  reg.ctx.teams = 2;
  assert.equal(reg.start('tug'), true);
  assert.equal(reg.active(), 'tug');
});

test('one event at a time; falsy start leaves inactive', () => {
  const reg = createRegistry({});
  reg.register(def('a'));
  reg.register(def('b'));
  reg.register(def('c', { start: () => false }));
  assert.equal(reg.start('c'), false);
  assert.equal(reg.active(), null);
  assert.equal(reg.start('a', { x: 1 }), true);
  assert.equal(reg.start('b'), false);
  reg.end('a');
  assert.equal(reg.active(), null);
  assert.equal(reg.start('b'), true);
});

test('chat, tick and end route to the active def', () => {
  const events = [];
  const reg = createRegistry({ onEvent: e => events.push(e) });
  let ended = 0, ticks = [];
  reg.register(def('a', { chat: (u, v, t) => t === 'hi', tick: t => ticks.push(t), end: () => ended++ }));
  assert.equal(reg.chat({}, {}, 'hi'), false);
  reg.tick(1);
  reg.start('a');
  assert.equal(reg.chat({}, {}, 'hi'), true);
  assert.equal(reg.chat({}, {}, 'no'), false);
  reg.tick(5);
  assert.deepEqual(ticks, [5]);
  reg.end('a'); reg.end('a');
  assert.equal(ended, 1);
  assert.equal(reg.active(), null);
  assert.deepEqual(events, [{ type: 'event-start', id: 'a' }, { type: 'event-end', id: 'a' }]);
});

test('tick ends an event that isDone', () => {
  const reg = createRegistry({});
  let done = false;
  reg.register(def('a', { isDone: () => done }));
  reg.start('a');
  reg.tick(1);
  assert.equal(reg.active(), 'a');
  done = true;
  reg.tick(2);
  assert.equal(reg.active(), null);
});

test('gift routes by active event', () => {
  const reg = createRegistry({ cfg: { giftMid: 10, giftBig: 100 } });
  const got = [];
  reg.register(def('a', { gift: { big: g => got.push(g.tier) } }));
  assert.deepEqual(reg.gift({ user: {}, viewer: {}, team: 'red', diamonds: 500 }), { tier: 'big', handled: false });
  reg.start('a');
  assert.deepEqual(reg.gift({ user: {}, viewer: {}, team: 'red', diamonds: 500 }), { tier: 'big', handled: true });
  assert.deepEqual(got, ['big']);
});

test('views collects non-null view results', () => {
  const reg = createRegistry({});
  reg.register(def('a', { view: t => ({ t }) }));
  reg.register(def('b', { view: () => null }));
  reg.register(def('c'));
  assert.deepEqual(reg.views(7), { a: { t: 7 } });
});
