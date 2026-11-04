import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthDate } from './birth.mjs';
import { createGame } from './game.mjs';

test('parseBirthDate reads day/month with or without a year', () => {
  assert.deepEqual(parseBirthDate('12/8', 2026), { day: 12, month: 8, year: null });
  assert.deepEqual(parseBirthDate('12/8/1998', 2026), { day: 12, month: 8, year: 1998 });
  assert.deepEqual(parseBirthDate('12-8-98', 2026), { day: 12, month: 8, year: 1998 });
  assert.deepEqual(parseBirthDate('3.4.05', 2026), { day: 3, month: 4, year: 2005 });
  assert.deepEqual(parseBirthDate('sinh 12 tháng 8 năm 2001 nè', 2026), { day: 12, month: 8, year: 2001 });
  assert.deepEqual(parseBirthDate('8/20', 2026), { day: 20, month: 8, year: null }); // month/day tolerated
  assert.equal(parseBirthDate('31/2', 2026), null);
  assert.equal(parseBirthDate('29/2/2001', 2026), null);
  assert.equal(parseBirthDate('hello', 2026), null);
  assert.deepEqual(parseBirthDate('12/8/2099', 2026), { day: 12, month: 8, year: null }); // a future year is ignored
});

test('picking a sign gives the viewer a named star that stays', () => {
  const events = [];
  const g = createGame({ config: { hours: false }, now: () => 1_000_000, rng: () => 0.25, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: 'Sư Tử' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  g.chat({ userId: 'a', nickname: 'An', comment: 'đổi Bảo Bình' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  const stars = g.snapshot().stars;
  assert.equal(stars.length, 1);
  assert.equal(stars[0].nickname, 'An');
  assert.equal(stars[0].x, 0.25);
});

test('a big moment comes on schedule: star roll call, then a meteor shower', () => {
  let t = 1_000_000;
  const events = [];
  const g = createGame({ config: { hours: false, showEverySeconds: 75, bossEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999 }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: '12/8/1998' });
  assert.ok(g.snapshot().cosmos.show.inMs > 0);
  t += 76_000; g.chat({ userId: 'a', nickname: 'An', comment: 'hi' }); g.tick();
  const first = events.filter(e => e.type === 'showtime');
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'starcall');
  assert.equal(first[0].people[0].nickname, 'An');
});
