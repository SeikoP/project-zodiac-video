import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { ROASTS } from './roast.mjs';

function setup() {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6 }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id, comment });
  const advance = ms => { t += ms; game.tick(); };
  const seat = (id, team) => {
    game.state.viewers[id] = { nickname: id, avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
    game.like({ userId: id, nickname: id, count: 0 }); // puts them on stage on the team given (roster.mjs would redirect a crowded team)
  };
  return { game, events, say, seat, advance, of: type => events.filter(e => e.type === type) };
}

test('every team has its own roasts', () => {
  assert.deepEqual(Object.keys(ROASTS), ['red', 'yellow', 'green', 'blue']);
  for (const lines of Object.values(ROASTS)) assert.ok(lines.length >= 5);
});

test('the wheel lands on a team with fans here; enough "oan" clears its name and pays the protesters', () => {
  const s = setup();
  s.seat('a', 'red'); s.seat('b', 'red'); s.seat('c', 'blue');
  const r = s.game.startRoast('red');
  assert.equal(r.team, 'red');
  assert.equal(s.of('roast-start')[0].need, 1);
  s.say('a', 'oan quá'); // still spinning: doesn't count yet
  assert.equal(s.game.snapshot().cosmos.roast.protests, 0);
  s.advance(6000);
  const before = s.game.state.viewers.a.lifetime;
  s.say('a', 'oan quá');
  s.say('c', 'chuẩn luôn');
  s.say('c', 'oan'); // only the roasted team's fans can protest
  assert.equal(s.game.snapshot().cosmos.roast.protests, 1);
  s.advance(20_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, true);
  assert.ok(s.game.state.viewers.a.lifetime > before);
});

test('an unanswered roast stands, and the team gets the lucky star as consolation', () => {
  const s = setup();
  s.say('a', 'xanh dương');
  s.game.startRoast('blue');
  s.advance(26_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, false);
  assert.equal(end.consoled, true);
  assert.equal(s.game.state.lucky.team, 'blue');
});
