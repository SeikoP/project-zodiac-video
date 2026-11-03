import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { HEADS, HOURS, HEAD_QUEST } from './hours-table.mjs';
import { CATCH_WORDS } from './minigames.mjs';

const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ config: { hours: false, skyBoons: false, bossEverySeconds: 0, chaosEverySeconds: 0, chaosEveryRetroSeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, ...config }, now: () => t, rng: () => 0, readSky: sky, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { for (let left = ms; left > 0; left -= 500) { t += Math.min(500, left); game.tick(); } };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}
const crowd = s => { for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình'], ['c', 'Song Ngư']]) s.say(id, sign); };

test('the roguelike sky run is gone; the two new headliners take its place', () => {
  assert.equal(HEADS.run, undefined);
  assert.ok(HEADS.mystery && HEADS.starcatch);
  assert.ok(HOURS.mars.heads.includes('starcatch'));
  assert.ok(HOURS.venus.heads.includes('mystery'));
  assert.equal(HEAD_QUEST.starcatch.stat, 'catches');
  assert.equal(HEAD_QUEST.mystery.stat, 'correct');
});

// --- Cung bí ẩn: a hidden sign, a clue every few seconds, the first three right guesses win ---
test('cung bí ẩn: clues come one by one; a sign name is a guess, once per clue each; three winners', () => {
  const s = setup({ mysteryClueSeconds: 10, mysteryClues: 5 });
  crowd(s);
  s.game.startHead('mystery');
  const [start] = s.of('mystery-start');
  assert.ok(start.clue && start.of === 5);
  const answer = s.game.state.mystery.sign;
  const wrong = answer === 'leo' ? 'Bảo Bình' : 'Sư Tử';
  s.say('a', wrong);
  s.say('a', 'Song Tử'); // a second guess on the same clue is ignored
  assert.equal(s.v('a').sign, 'leo', 'guessing never changes your team');
  s.advance(10_000);
  assert.equal(s.of('mystery-clue').length, 1);
  const label = { aries: 'Bạch Dương', taurus: 'Kim Ngưu', gemini: 'Song Tử', cancer: 'Cự Giải', leo: 'Sư Tử', virgo: 'Xử Nữ', libra: 'Thiên Bình', scorpio: 'Bọ Cạp', sagittarius: 'Nhân Mã', capricorn: 'Ma Kết', aquarius: 'Bảo Bình', pisces: 'Song Ngư' }[answer];
  const gems = id => ['fire', 'earth', 'air', 'water'].reduce((n, k) => n + (s.v(id).bag[k] ?? 0), 0);
  const g0 = gems('b');
  for (const id of ['b', 'c', 'a', 'd']) s.say(id, label);
  const wins = s.of('mystery-win');
  assert.deepEqual(wins.map(w => [w.rank, w.userId]), [[1, 'b'], [2, 'c'], [3, 'a']]);
  assert.equal(gems('b') - g0, 2);
  const end = s.of('mystery-end')[0];
  assert.equal(end.sign, answer);
  assert.equal(end.winners.length, 3);
  assert.equal(s.game.state.mystery, null);
});

test('cung bí ẩn ends after its last clue if nobody finds it', () => {
  const s = setup({ mysteryClueSeconds: 10, mysteryClues: 3, mysteryLastSeconds: 12 });
  crowd(s);
  s.game.startHead('mystery');
  s.advance(10_000 * 2 + 12_500);
  const end = s.of('mystery-end')[0];
  assert.ok(end);
  assert.equal(end.winners.length, 0);
  assert.equal(s.of('mystery-clue').length, 2);
});

// --- Hứng sao băng: a word rides a falling star; the first three to type it catch it ---
test('hứng sao băng: a word falls each round; the first three to type it catch it; most catches wins a gem', () => {
  const s = setup({ catchRounds: 2, catchEverySeconds: 6, catchWinners: 3 });
  crowd(s);
  s.game.startHead('starcatch');
  s.advance(1000);
  const [r1] = s.of('catch-star');
  assert.ok(CATCH_WORDS.includes(r1.word));
  const d0 = s.v('a').bag.dust;
  s.say('a', r1.word.toUpperCase());
  s.say('a', r1.word); // once per star
  s.say('b', `  ${r1.word} `);
  s.say('c', 'sai rồi');
  assert.deepEqual(s.of('catch').map(c => [c.userId, c.rank]), [['a', 1], ['b', 2]]);
  assert.ok(s.v('a').bag.dust > d0);
  s.advance(6000);
  const r2 = s.of('catch-star')[1];
  s.say('a', r2.word);
  s.advance(6000);
  const end = s.of('catch-end')[0];
  assert.equal(end.top[0].userId, 'a');
  assert.equal(end.top[0].catches, 2);
  assert.equal(s.game.state.starcatch, null);
});
