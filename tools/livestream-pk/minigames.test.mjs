import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { ACTS, HEADS, HEAD_QUEST } from './acts.mjs';
import { CATCH_WORDS } from './minigames.mjs';
import { GUESS_BANK } from './events/guess-bank.mjs';

function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { for (let left = ms; left > 0; left -= 500) { t += Math.min(500, left); game.tick(); } };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}
const crowd = s => { for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương'], ['c', 'xanh lá']]) s.say(id, team); };

test('the roguelike sky run is gone; the two new headliners take its place', () => {
  assert.equal(HEADS.run, undefined);
  assert.ok(HEADS.guessobject && HEADS.starcatch);
  assert.ok(ACTS.find(a => a.id === 'arena').heads.includes('starcatch'));
  assert.ok(ACTS.find(a => a.id === 'reunion').heads.includes('guessobject'));
  assert.equal(HEAD_QUEST.starcatch.stat, 'catches');
  assert.equal(HEAD_QUEST.guessobject.stat, 'correct');
});

// --- Đoán vật: a hidden object, a clue every ten seconds, the first three right guesses win gems ---
test('đoán vật: clues come one by one; once per clue each; aliases and accents count; three winners', () => {
  const s = setup({ mysteryClueSeconds: 10 });
  crowd(s);
  s.game.startHead('guessobject');
  const [start] = s.of('mystery-start');
  assert.ok(start.clue && start.of === 4);
  const entry = GUESS_BANK.find(e => e.answer === s.game.state.guess.answer);
  s.say('a', 'đỏ'); // a wrong guess (a colour name is not a team change here)
  s.say('a', entry.answer); // a second guess on the same clue is ignored
  assert.equal(s.v('a').team, 'red', 'guessing never changes your team');
  assert.equal(s.of('mystery-win').length, 0);
  s.advance(10_000);
  assert.equal(s.of('mystery-clue').length, 1);
  const gems = id => ['fire', 'earth', 'air', 'water'].reduce((n, k) => n + (s.v(id).bag[k] ?? 0), 0);
  const g0 = gems('b');
  s.say('b', entry.aliases[0].toUpperCase());
  s.say('c', entry.answer);
  s.say('a', entry.answer);
  s.say('d', entry.answer);
  const wins = s.of('mystery-win');
  assert.deepEqual(wins.map(w => [w.rank, w.userId]), [[1, 'b'], [2, 'c'], [3, 'a']]);
  assert.equal(gems('b') - g0, 2);
  const end = s.of('mystery-end')[0];
  assert.equal(end.answer, entry.answer);
  assert.equal(end.winners.length, 3);
  assert.equal(s.game.state.guess, null);
});

test('đoán vật ends after its last clue if nobody finds it', () => {
  const s = setup({ mysteryClueSeconds: 10, mysteryClues: 3, mysteryLastSeconds: 12 });
  crowd(s);
  s.game.startHead('guessobject');
  s.advance(10_000 * 2 + 12_500);
  const end = s.of('mystery-end')[0];
  assert.ok(end);
  assert.equal(end.winners.length, 0);
  assert.ok(end.answer);
  assert.equal(s.of('mystery-clue').length, 2);
  assert.equal(s.of('head-end').length, 1);
});

test("a guess does not eat the room's commands: 'đổi' goes on to the game", () => {
  const s = setup({});
  crowd(s);
  s.game.startHead('guessobject');
  s.say('a', 'đổi vàng');
  assert.equal(s.v('a').team, 'yellow');
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
