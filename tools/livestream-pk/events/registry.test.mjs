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

test('contribute routes to the active def as contribute(u, v, action, n)', () => {
  const reg = createRegistry({});
  const seen = [];
  reg.register(def('a', { contribute: (u, v, action, n) => { seen.push([u, v, action, n]); return 4; } }));
  reg.register(def('b'));
  assert.equal(reg.contribute('gift', { userId: 'x' }, { team: 'red' }, 10), 0, 'nothing running');
  reg.start('a');
  assert.equal(reg.contribute('gift', { userId: 'x' }, { team: 'red' }, 10), 4);
  assert.deepEqual(seen, [[{ userId: 'x' }, { team: 'red' }, 'gift', 10]]);
  reg.end('a');
  reg.start('b');
  assert.equal(reg.contribute('comment', {}, {}), 0, 'a def without contribute counts for nothing');
});

test('a def that throws never escapes or leaves the registry stuck', () => {
  const events = [];
  const reg = createRegistry({ onEvent: e => events.push(e) });
  const boom = () => { throw new Error('boom'); };
  reg.register(def('s', { start: boom }));
  assert.equal(reg.start('s'), false);
  assert.equal(reg.active(), null);
  reg.register(def('n', { needs: boom }));
  assert.equal(reg.start('n'), false);
  reg.register(def('t', { tick: boom }));
  assert.equal(reg.start('t'), true);
  reg.tick(1);
  assert.equal(reg.active(), null, 'an event whose tick throws is ended');
  reg.register(def('c', { chat: boom, contribute: boom, end: boom, view: boom }));
  assert.equal(reg.start('c'), true);
  assert.equal(reg.chat({}, {}, 'x'), false);
  assert.equal(reg.contribute('comment', {}, {}, 1), 0);
  assert.deepEqual(reg.views(0), {});
  reg.end('c');
  assert.equal(reg.active(), null, 'end ran even though def.end threw');
  assert.deepEqual(events.filter(e => e.type === 'event-error').map(e => [e.id, e.where]),
    [['s', 'start'], ['n', 'needs'], ['t', 'tick'], ['c', 'chat'], ['c', 'contribute'], ['c', 'view'], ['c', 'end']]);
  assert.ok(events.some(e => e.type === 'event-end' && e.id === 'c'));
});

test('an event that already finished does not block the next start; adopt resumes a loaded one', () => {
  const reg = createRegistry({});
  let done = false;
  reg.register(def('a', { isDone: () => done }));
  reg.register(def('b'));
  reg.start('a');
  assert.equal(reg.start('b'), false);
  done = true;
  assert.equal(reg.start('b'), true);
  assert.equal(reg.active(), 'b');
  reg.end('b');
  assert.equal(reg.adopt('a'), true);
  assert.equal(reg.adopt('b'), false, 'one at a time');
  assert.equal(reg.active(), 'a');
});
