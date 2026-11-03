import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthDate, birthChart, readChart } from './birth.mjs';
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

test('birthChart knows only the Sun without a year, the whole sky with one', () => {
  const short = birthChart({ day: 12, month: 8, year: null });
  assert.equal(short.full, false);
  assert.deepEqual(short.planets, [{ id: 'sun', sign: 'leo' }]);
  assert.deepEqual(readChart(short), []);
  const full = birthChart({ day: 1, month: 1, year: 2000 });
  assert.equal(full.full, true);
  const at = id => full.planets.find(p => p.id === id).sign;
  // 1 Jan 2000: Sun in Capricorn, Moon in Scorpio, Venus in Sagittarius, Mars in Aquarius (ephemeris)
  assert.equal(at('sun'), 'capricorn');
  assert.equal(at('moon'), 'scorpio');
  assert.equal(at('venus'), 'sagittarius');
  assert.equal(at('mars'), 'aquarius');
  const lines = readChart(full);
  assert.deepEqual(lines.map(l => l.planet), ['moon', 'venus', 'mars']);
  assert.ok(lines.every(l => l.text && l.title));
});

const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });

test('a birthday comment opens the birth sky, without the year, once per cooldown', () => {
  let t = 1_000_000;
  const events = [];
  const g = createGame({ config: { hours: false }, now: () => t, rng: () => 0.5, readSky: sky, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: '12/8/1998' });
  const birth = events.filter(e => e.type === 'birth-sky');
  assert.equal(birth.length, 1);
  assert.equal(birth[0].full, true);
  assert.equal(birth[0].sign, 'leo');
  assert.ok(!JSON.stringify(birth[0]).includes('1998'));
  assert.ok(!JSON.stringify(g.state.viewers.a).includes('1998'));
  g.chat({ userId: 'a', nickname: 'An', comment: '12/8/1998' });
  assert.equal(events.filter(e => e.type === 'birth-sky').length, 1);
  t += 601_000;
  g.chat({ userId: 'a', nickname: 'An', comment: '12/8/1998' });
  assert.equal(events.filter(e => e.type === 'birth-sky').length, 2);
  // a long sentence that happens to hold a date is just chat
  g.chat({ userId: 'b', nickname: 'Bo', comment: 'hôm qua 10.30 tối mình mới đi làm về mệt quá trời luôn á' });
  assert.equal(events.filter(e => e.type === 'birth-sky' && e.userId === 'b').length, 0);
});

test('picking a sign gives the viewer a named star that stays', () => {
  const events = [];
  const g = createGame({ config: { hours: false }, now: () => 1_000_000, rng: () => 0.25, readSky: sky, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: 'Sư Tử' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  g.chat({ userId: 'a', nickname: 'An', comment: 'đổi Bảo Bình' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  const stars = g.snapshot().stars;
  assert.equal(stars.length, 1);
  assert.equal(stars[0].nickname, 'An');
  assert.equal(stars[0].x, 0.25);
});

test('a big moment comes on schedule: star roll call, then a birth sky when someone shared one', () => {
  let t = 1_000_000;
  const events = [];
  const g = createGame({ config: { hours: false, showEverySeconds: 75, bossEverySeconds: 0, chaosEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999 }, now: () => t, rng: () => 0, readSky: sky, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: '12/8/1998' });
  assert.ok(g.snapshot().cosmos.show.inMs > 0);
  t += 76_000; g.chat({ userId: 'a', nickname: 'An', comment: 'hi' }); g.tick();
  const first = events.filter(e => e.type === 'showtime');
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'starcall');
  assert.equal(first[0].people[0].nickname, 'An');
  const before = events.filter(e => e.type === 'birth-sky').length;
  t += 76_000; g.chat({ userId: 'a', nickname: 'An', comment: 'hi' }); g.tick();
  const replay = events.filter(e => e.type === 'birth-sky').slice(before);
  assert.equal(replay.length, 1);
  assert.equal(replay[0].replay, true);
});
