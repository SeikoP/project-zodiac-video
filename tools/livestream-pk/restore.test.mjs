// The supervisor restarts the server and state is saved every 10 seconds, so a restart in the middle of an event is real:
// the saved `st` is plain JSON, the game is rebuilt from it, and the event goes on where it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';

const QUIZ = [{ q: 'Mặt trời mọc hướng nào?', options: ['Tây', 'Đông', 'Nam', 'Bắc'], answer: 'B' }];
const CFG = { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, commentLight: 0, bossHpMin: 10000 };
const u = (id, extra) => ({ userId: id, nickname: id.toUpperCase(), ...extra });
const of = (events, type) => events.filter(e => e.type === type);
const TEAMS4 = [['a', 'đỏ'], ['b', 'vàng'], ['c', 'xanh lá'], ['d', 'xanh dương']];

// a clock shared by the game before and after the restart
function world(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const clock = { now: () => t, advance: ms => { t += ms; } };
  const build = state => {
    const events = [];
    const game = createGame({ state, now: clock.now, rng: () => 0, quiz: QUIZ, onEvent: e => events.push(e), config: { ...CFG, ...config } });
    const advance = ms => { for (let left = ms; left > 0; left -= 500) { clock.advance(Math.min(500, left)); game.tick(); } };
    return { game, events, advance, say: (id, comment) => game.chat(u(id, { comment })) };
  };
  const first = build(undefined);
  for (const [id, team] of TEAMS4) first.say(id, team);
  // the restart: serialise, rebuild; the people are back on stage with their first words
  const restart = (g = first) => {
    const second = build(JSON.parse(JSON.stringify(g.game.state)));
    for (const [id] of TEAMS4) second.game.like(u(id, { count: 0 })); // back on stage without saying anything
    return second;
  };
  return { first, restart, clock, build };
}

test('a boss in the middle of the fight survives a restart and still ends through the registry', () => {
  const w = world();
  w.first.game.startBoss();
  w.first.game.gift(u('a', { diamonds: 10, count: 1 }));
  const hp = w.first.game.state.boss.hp;
  const g2 = w.restart();
  assert.equal(g2.game.state.boss.hp, hp);
  g2.game.gift(u('a', { diamonds: 10, count: 1 }));
  assert.ok(g2.game.state.boss.hp < hp, 'the rebuilt boss takes hits');
  g2.advance(160_000);
  assert.equal(g2.game.state.boss, null);
  assert.equal(of(g2.events, 'boss-escaped').length, 1);
  assert.ok(of(g2.events, 'event-end').some(e => e.id === 'boss'), 'the registry owned the boss again');
});

test('a tug in the middle of the pull survives a restart and still ends through the registry', () => {
  const w = world();
  w.first.game.startTug();
  w.first.advance(16_000);
  w.first.game.gift(u('a', { diamonds: 10, count: 1 }));
  const pos = w.first.game.state.tug.value;
  const g2 = w.restart();
  assert.equal(g2.game.state.tug.value, pos);
  g2.advance(100_000);
  assert.equal(g2.game.state.tug, null);
  assert.equal(of(g2.events, 'tug-end').length, 1);
  assert.ok(of(g2.events, 'event-end').some(e => e.id === 'tug'));
});

test('đoán vật survives a restart: the clue, who guessed and who won', () => {
  const w = world();
  w.first.game.startHead('guessobject');
  const answer = w.first.game.state.guess.answer;
  w.first.say('a', 'chó');
  w.first.advance(10_500);
  w.first.say('b', answer);
  const g2 = w.restart();
  assert.equal(g2.game.state.guess.clue, 2);
  assert.equal(g2.game.state.guess.answer, answer);
  g2.say('b', answer); // already won
  assert.equal(of(g2.events, 'mystery-win').length, 0);
  g2.say('a', answer);
  g2.say('c', answer);
  assert.deepEqual(of(g2.events, 'mystery-win').map(e => [e.userId, e.rank]), [['a', 2], ['c', 3]]);
  assert.equal(of(g2.events, 'mystery-end')[0].winners.length, 3);
  assert.equal(g2.game.state.guess, null);
  g2.advance(1000);
  assert.equal(of(g2.events, 'head-end').length, 1);
});

test('hứng sao băng survives a restart: the same star, the same catchers', () => {
  const w = world();
  w.first.game.startHead('starcatch');
  const star = of(w.first.events, 'catch-star')[0];
  w.first.say('a', star.word);
  const g2 = w.restart();
  assert.equal(g2.game.state.starcatch.word, star.word);
  g2.say('a', star.word);
  g2.say('b', star.word);
  assert.deepEqual(of(g2.events, 'catch').map(c => [c.userId, c.rank]), [['b', 2]]);
  g2.advance(8000 * 8);
  assert.equal(of(g2.events, 'catch-end').length, 1);
  assert.equal(g2.game.state.starcatch, null);
});

test('a quiz survives a restart: one answer each, ranks go on', () => {
  const w = world();
  w.first.game.startQuiz();
  w.first.say('a', 'A');
  w.first.say('b', 'B');
  const g2 = w.restart();
  assert.ok(g2.game.state.quiz);
  g2.say('a', 'B');
  g2.say('b', 'B');
  g2.say('c', 'B');
  assert.deepEqual(g2.game.state.quiz.winners.map(x => [x.nickname, x.reward]), [['B', 40], ['C', 25]]);
  g2.advance(13_000);
  assert.equal(g2.game.state.quiz, null);
  assert.equal(of(g2.events, 'quiz-end')[0].winners.length, 2);
  assert.equal(g2.game.startQuiz() !== null, true, 'the registry is free for the next question');
});

test('the star chest survives a restart: the ones who claimed cannot claim again', () => {
  const w = world({ chestOpenSeconds: 25 });
  w.first.game.openChest();
  w.first.say('a', 'nhận');
  const g2 = w.restart();
  const dustOf = id => g2.game.state.viewers[id].bag?.dust ?? 0;
  const before = { a: dustOf('a'), b: dustOf('b') };
  g2.say('a', 'nhận');
  g2.say('b', 'nhận');
  assert.equal(dustOf('a'), before.a, 'a already claimed this chest');
  assert.equal(dustOf('b') - before.b, 15);
  g2.advance(26_000);
  assert.equal(of(g2.events, 'chest-close')[0].claims, 2);
});

test('a wish being blessed survives a restart: two blessings before, the third after', () => {
  const w = world({ blessNeed: 3, blessWindowSeconds: 60 });
  w.first.say('a', 'ước thi đỗ');
  w.first.say('b', 'chúc');
  w.first.say('c', 'chúc');
  const g2 = w.restart();
  g2.say('b', 'chúc'); // already blessed
  assert.equal(of(g2.events, 'wish-blessed').length, 0);
  g2.say('d', 'chúc');
  const done = of(g2.events, 'wish-blessed')[0];
  assert.deepEqual(done.blessers.sort(), ['B', 'C', 'D']);
  assert.equal(g2.game.state.viewers.a.bag.moon, 1);
});

test('a greeting survives a restart: greeters so far are remembered and the window carries on', () => {
  const w = world({ welcomeNeed: 3, welcomeWindowSeconds: 30 });
  w.first.say('a', 'đỏ');
  w.first.game.member(u('new'));
  w.first.say('a', 'chào');
  w.first.say('b', 'chào');
  const g2 = w.restart();
  g2.say('a', 'chào'); // once each
  assert.equal(of(g2.events, 'welcome-done').length, 0);
  g2.say('c', 'chào');
  assert.equal(of(g2.events, 'welcome-done')[0].count, 3);
});
