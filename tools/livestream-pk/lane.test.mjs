import test from 'node:test';
import assert from 'node:assert/strict';
import { createLane } from './public/lane.js';

// A lane on a fake clock that records what is visible, so we can assert "never more than one".
function harness(opts) {
  let t = 0;
  const lane = createLane({ now: () => t, ...opts });
  const log = [], dones = [];
  let visible = 0, worst = 0;
  const ev = (key, level, extra = {}) => ({
    key, level, ms: 1000,
    show: () => { visible++; worst = Math.max(worst, visible); log.push(`+${key}`); },
    hide: reason => { visible--; log.push(`-${key}${reason === 'preempt' ? '!' : ''}`); },
    done: reason => dones.push(`${key}:${reason}`),
    ...extra,
  });
  const advance = ms => { for (let i = 0; i < ms / 100; i++) { t += 100; lane.tick(); } };
  return { lane, ev, log, dones, advance, now: () => t, worst: () => worst, visible: () => visible };
}

test('events run one at a time, in order, each for its own duration', () => {
  const h = harness();
  h.lane.submit(h.ev('a', 1));
  h.lane.submit(h.ev('b', 1));
  h.lane.submit(h.ev('c', 1));
  h.advance(3500);
  assert.deepEqual(h.log, ['+a', '-a', '+b', '-b', '+c', '-c']);
  assert.equal(h.worst(), 1);
});

test('a higher level interrupts a lower one; the interrupted announcement is dropped', () => {
  const h = harness();
  h.lane.submit(h.ev('card', 1, { ms: 5000 }));
  h.advance(500);
  h.lane.submit(h.ev('big', 3, { ms: 2000 }));
  h.advance(6000);
  assert.deepEqual(h.log, ['+card', '-card!', '+big', '-big']);
  assert.deepEqual(h.dones, ['card:dropped', 'big:ended']);
  assert.equal(h.worst(), 1);
});

test('equal or lower levels wait instead of interrupting', () => {
  const h = harness();
  h.lane.submit(h.ev('big', 3, { ms: 2000 }));
  h.lane.submit(h.ev('card', 1));
  h.lane.submit(h.ev('big2', 3, { ms: 1000 }));
  h.advance(5000);
  assert.deepEqual(h.log, ['+big', '-big', '+big2', '-big2', '+card', '-card']); // level 3 before level 1 once the lane frees
});

test('a modal is suspended by a celebration and comes back while the game still wants it', () => {
  const h = harness();
  let wanted = true;
  h.lane.submit(h.ev('quiz', 2, { ms: undefined, holdWhile: () => wanted }));
  h.advance(1000);
  h.lane.submit(h.ev('wheel', 3, { ms: 2000 }));
  h.advance(2500);
  assert.deepEqual(h.log, ['+quiz', '-quiz!', '+wheel', '-wheel', '+quiz']);
  wanted = false;
  h.advance(300);
  assert.equal(h.log.at(-1), '-quiz');
  assert.equal(h.visible(), 0);
  assert.equal(h.worst(), 1);
  assert.deepEqual(h.dones, ['wheel:ended', 'quiz:ended']);
});

test('a modal that ended while hidden is not brought back', () => {
  const h = harness();
  let wanted = true;
  h.lane.submit(h.ev('quiz', 2, { ms: undefined, holdWhile: () => wanted }));
  h.lane.submit(h.ev('wheel', 3, { ms: 1000 }));
  wanted = false;
  h.advance(1500);
  assert.deepEqual(h.log, ['+quiz', '-quiz!', '+wheel', '-wheel']); // never shown a second time, never hidden twice
  assert.deepEqual(h.dones, ['wheel:ended', 'quiz:ended']); // but the owner is told it is over
  assert.equal(h.lane.idle(), true);
});

test('the same kind of announcement replaces its waiting copy, and the queue is capped', () => {
  const h = harness({ maxQueue: 3 });
  h.lane.submit(h.ev('first', 1, { ms: 3000 }));
  h.lane.submit(h.ev('follow', 1, { text: 'old' }));
  h.lane.submit(h.ev('follow', 1, { text: 'new' }));
  assert.equal(h.lane.pending(), 1);
  for (const k of ['x1', 'x2', 'x3', 'x4']) h.lane.submit(h.ev(k, 1));
  assert.equal(h.lane.pending(), 3);
  h.lane.submit(h.ev('urgent', 2, { ms: 500 })); // preempts; the dropped one never shows
  assert.equal(h.lane.current().key, 'urgent');
});

test('when the queue overflows the lowest level is dropped first', () => {
  const h = harness({ maxQueue: 2 });
  h.lane.submit(h.ev('busy', 3, { ms: 5000 }));
  h.lane.submit(h.ev('tick', 0));
  h.lane.submit(h.ev('card', 1));
  h.lane.submit(h.ev('card2', 1));
  h.advance(7000);
  assert.ok(!h.log.includes('+tick'), 'the level-0 tick was the one dropped');
  assert.deepEqual(h.log.filter(x => x.startsWith('+')), ['+busy', '+card', '+card2']);
});

test('stale announcements are skipped instead of showing late', () => {
  const h = harness();
  h.lane.submit(h.ev('long', 3, { ms: 8000 }));
  h.lane.submit(h.ev('joined', 0)); // level 0 goes stale after 2.5s
  h.lane.submit(h.ev('lit', 1)); // level 1 after 6s
  h.advance(9500);
  assert.deepEqual(h.log.filter(x => x.startsWith('+')), ['+long']);
  assert.equal(h.lane.idle(), true);
});

test('a flood never shows more than one event at once', () => {
  const h = harness();
  const levels = [0, 1, 2, 3, 1, 0, 3, 1];
  for (let i = 0; i < 200; i++) {
    const until = h.now() + 1500; // a modal the game wants for 1.5s
    h.lane.submit(h.ev(`e${i % 9}`, levels[i % levels.length], i % 7 === 2 ? { ms: undefined, holdWhile: () => h.now() < until } : { ms: 300 + (i % 4) * 200 }));
    if (i % 3 === 0) h.advance(100);
  }
  h.advance(60000);
  assert.equal(h.worst(), 1);
  assert.equal(h.visible(), 0);
});

test('clear() hides the current event and forgets everything waiting', () => {
  const h = harness();
  h.lane.submit(h.ev('a', 1));
  h.lane.submit(h.ev('b', 1));
  h.lane.clear();
  assert.equal(h.lane.idle(), true);
  assert.equal(h.lane.pending(), 0);
  assert.equal(h.visible(), 0);
});

test('breath: after a celebration the next one waits, so waiting cards get their turn', () => {
  const h = harness({ breath: 1500 });
  h.lane.submit(h.ev('big1', 3, { ms: 1000 }));
  h.lane.submit(h.ev('big2', 3, { ms: 1000 }));
  h.lane.submit(h.ev('card', 1, { ms: 1000 }));
  h.advance(6000);
  assert.deepEqual(h.log.filter(x => x.startsWith('+')), ['+big1', '+card', '+big2']);
});

test('breath: a celebration submitted during the breath waits instead of starting', () => {
  const h = harness({ breath: 1500 });
  h.lane.submit(h.ev('big1', 3, { ms: 1000 }));
  h.advance(1100);
  h.lane.submit(h.ev('big2', 3, { ms: 1000 }));
  assert.equal(h.lane.idle(), true);
  h.advance(1500);
  assert.equal(h.lane.current()?.key, 'big2');
});

test('minShow: a modal stays up long enough to read before a celebration may interrupt it', () => {
  const h = harness();
  let wanted = true;
  h.lane.submit(h.ev('quiz', 2, { ms: undefined, holdWhile: () => wanted, minShow: 3000 }));
  h.advance(500);
  h.lane.submit(h.ev('wheel', 3, { ms: 1000 }));
  assert.equal(h.lane.current().key, 'quiz'); // too early
  h.advance(2000);
  assert.equal(h.lane.current().key, 'quiz');
  h.advance(700);
  assert.equal(h.lane.current().key, 'wheel'); // 3s have passed: the waiting celebration goes ahead
  h.advance(1200);
  assert.equal(h.lane.current().key, 'quiz'); // and the quiz is back
  assert.equal(h.worst(), 1);
});

test('celebrations never pile up: at most two wait', () => {
  const h = harness({ breath: 1000 });
  h.lane.submit(h.ev('b0', 3, { ms: 2000 }));
  for (const k of ['b1', 'b2', 'b3', 'b4']) h.lane.submit(h.ev(k, 3, { ms: 500 }));
  assert.equal(h.lane.pending(), 2);
});
