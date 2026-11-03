import test from 'node:test';
import assert from 'node:assert/strict';
import { createHours } from './hours.mjs';

const local = s => Date.parse(`${s}+07:00`); // Vietnam time
const hours = createHours(); // TP.HCM

test('the first hour after sunrise belongs to the weekday ruler', () => {
  // Tuesday 3 Nov 2026 → Sao Hỏa; Friday 6 Nov → Sao Kim; Sunday 8 Nov → Mặt Trời
  assert.equal(hours.real(local('2026-11-03T06:00:00')).planet, 'mars');
  assert.equal(hours.real(local('2026-11-06T06:00:00')).planet, 'venus');
  assert.equal(hours.real(local('2026-11-08T06:00:00')).planet, 'sun');
});

test('hours follow the Chaldean order through the day and the night', () => {
  const day2 = hours.real(local('2026-11-03T07:00:00'));
  assert.equal(day2.planet, 'sun'); // Hỏa → Mặt Trời
  assert.equal(day2.night, false);
  // Tuesday night: Thổ, Mộc, Hỏa… — 20:00 is the third night hour
  const evening = hours.real(local('2026-11-03T20:00:00'));
  assert.equal(evening.night, true);
  assert.equal(evening.planet, 'mars');
  assert.equal(evening.next, 'sun');
  const len = (evening.endsAt - evening.startsAt) / 60000;
  assert.ok(len > 55 && len < 66, `night hour lasted ${len} min`);
  assert.ok(evening.startsAt <= local('2026-11-03T20:00:00') && evening.endsAt > local('2026-11-03T20:00:00'));
});

test('just after midnight is still the previous day\'s night', () => {
  // 01:00 Wednesday belongs to Tuesday's night (Tuesday's rules continue until sunrise)
  const late = hours.real(local('2026-11-04T01:00:00'));
  assert.equal(late.night, true);
  const sunrise = hours.real(local('2026-11-04T06:00:00'));
  assert.equal(sunrise.planet, 'mercury'); // Wednesday
});

test('cycle mode rotates one planet per clock hour', () => {
  const a = hours.cycle(local('2026-11-03T20:10:00')), b = hours.cycle(local('2026-11-03T21:10:00'));
  assert.equal(a.next, b.planet);
  assert.equal(b.startsAt - a.startsAt, 3600000);
});
