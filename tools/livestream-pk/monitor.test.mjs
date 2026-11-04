import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonitor } from './monitor.mjs';

const fakeGame = () => { const seen = []; return { seen, chat: e => seen.push(['chat', e]), gift: e => seen.push(['gift', e]), like: e => seen.push(['like', e]), social: e => seen.push(['social', e]) }; };

test('monitor counts and logs what viewers do, and still forwards every call to the game', () => {
  let t = 1_000_000;
  const m = createMonitor({ now: () => t, label: id => id.toUpperCase() });
  const g = fakeGame(), tapped = m.tap(g);
  tapped.chat({ userId: 'u1', nickname: 'Lan', comment: 'xin quẻ' });
  tapped.gift({ userId: 'u1', nickname: 'Lan', giftName: 'Rose', diamonds: 1, count: 3 });
  tapped.social({ userId: 'u2', nickname: 'Minh', kind: 'share' });
  assert.equal(g.seen.length, 3);
  const s = m.stats();
  assert.equal(s.rates.chat.perMin, 1);
  assert.equal(s.rates.gift.total, 1);
  assert.equal(s.rates.share.perMin, 1);
  assert.equal(s.diamonds, 3);
  assert.equal(s.lastKind, 'share');
  assert.deepEqual(m.all().map(e => e.kind), ['chat', 'gift', 'share']);
  assert.match(m.all()[1].text, /Lan tặng Rose x3 \(3 xu\)/);
});

test('rates only count the last minute, and likes are summarised instead of logged one by one', () => {
  let t = 5_000_000;
  const m = createMonitor({ now: () => t });
  const tapped = m.tap(fakeGame());
  for (let i = 0; i < 30; i++) tapped.like({ userId: 'u', count: 2 });
  assert.equal(m.stats().rates.like.perMin, 60);
  assert.ok(m.all().filter(e => e.kind === 'like').length <= 1);
  t += 5000;
  m.flushLikes();
  assert.equal(m.all().filter(e => e.kind === 'like').length, 1);
  t += 61_000;
  assert.equal(m.stats().rates.like.perMin, 0);
  assert.equal(m.stats().rates.like.total, 60);
});

test('game events become readable lines; drain returns each line once', () => {
  const m = createMonitor({ label: id => id.toUpperCase() });
  m.note({ type: 'join', nickname: 'Hoa', team: 'red' });
  m.note({ type: 'lit', team: 'yellow', by: 'red' });
  m.note({ type: 'dance' }); // too minor to log
  assert.equal(m.drain().length, 2);
  assert.equal(m.drain().length, 0);
  assert.match(m.all()[1].text, /YELLOW đã sáng \(nhờ RED\)/);
});

test('skipped events (rehearsal viewers on the real server) are neither counted nor logged', () => {
  const m = createMonitor({ now: () => 1_000_000 });
  const tapped = m.tap(fakeGame(), { skip: e => String(e.userId).startsWith('sim:') });
  tapped.gift({ userId: 'sim:x', nickname: 'X', giftName: 'Galaxy', diamonds: 1000, count: 1 });
  tapped.chat({ userId: 'sim:x', nickname: 'X', comment: 'hi' });
  tapped.like({ userId: 'sim:x', count: 50 });
  tapped.social({ userId: 'sim:x', kind: 'follow' });
  tapped.chat({ userId: 'real', nickname: 'R', comment: 'hi' });
  const s = m.stats();
  assert.deepEqual([s.diamonds, s.rates.gift.total, s.rates.chat.total, s.rates.like.total, s.rates.follow.total], [0, 0, 1, 0, 0]);
  assert.deepEqual(m.all().map(e => e.kind), ['chat']);
});
