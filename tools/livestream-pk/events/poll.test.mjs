import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../game.mjs';

const BASE = { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, pollSeconds: 20, pollLight: 3, commentLight: 0, commentCooldownSeconds: 0, checkinPerNight: 0, adaptiveCrowd: false, moonGoal: 1e9 };
function setup({ polls = ['Phe nào ngủ nướng giỏi nhất?'], config = {}, state, start = 1_000_000 } = {}) {
  let t = start;
  const events = [];
  const game = createGame({ state, polls, config: { ...BASE, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  return { game, events, say, advance: ms => { t += ms; game.tick(); }, now: () => t, of: type => events.filter(e => e.type === type) };
}
const light = (game, team) => Object.values(game.state.viewers).filter(v => v.team === team).reduce((s, v) => s + (v.lifetime ?? 0), 0);

test('startPoll() with nothing in the poll bank starts nothing and says so (false)', () => {
  const s = setup({ polls: [] });
  assert.equal(s.game.startPoll(), false);
  assert.equal(s.game.state.poll, null);
  assert.equal(s.events.length, 0);
});

test('a team poll offers the four teams; "1"–"4" votes once each and the votes live in a reactions block', () => {
  const s = setup();
  s.say('a', 'đỏ'); s.say('b', 'vàng');
  assert.ok(s.game.startPoll());
  const p = s.game.snapshot().hud.poll;
  assert.equal(p.q, 'Phe nào ngủ nướng giỏi nhất?');
  assert.deepEqual(p.options.map(o => o.team).sort(), ['blue', 'green', 'red', 'yellow']);
  s.say('a', '2'); s.say('a', '3'); s.say('b', 'số 2');
  assert.deepEqual(s.game.snapshot().hud.poll.options.map(o => o.n), [0, 2, 0, 0]);
  assert.deepEqual(s.game.state.poll.rx.byGroup, { 1: [], 2: ['a', 'b'], 3: [], 4: [] });
  assert.equal('voted' in s.game.state.poll, false);
  assert.equal(s.game.state.viewers.a.team, 'red', 'a vote never moves a team');
});

test('a vote consumes the line only when it is a valid number for the open poll; anything else is ordinary chat', () => {
  const s = setup({ config: { commentLight: 5 } });
  s.say('a', 'đỏ');
  s.game.startPoll();
  s.game.state.poll.options = s.game.state.poll.options.slice(0, 2); // a poll with two options
  s.game.state.poll.rx = {}; // (shape comes back on the next vote)
  const before = s.game.state.viewers.a.lifetime;
  s.say('a', '3'); // no third option: not a vote
  assert.equal(s.game.snapshot().hud.poll.total, 0);
  assert.ok(s.game.state.viewers.a.lifetime > before, 'it is ordinary chat and pays commentLight');
  s.say('a', '2');
  assert.equal(s.game.snapshot().hud.poll.total, 1);
  s.say('a', 'hello');
  assert.equal(s.game.snapshot().hud.poll.total, 1);
});

test('numbers 1-4 never pick or change a team while a poll is open; a colour name still places a newcomer', () => {
  const s = setup();
  s.say('a', 'đỏ'); s.say('b', 'vàng');
  s.game.startPoll();
  s.say('c', '2'); // newcomer: votes, placed by the balance and not by the digit
  s.say('d', 'xanh dương');
  assert.equal(s.game.state.viewers.c.team, 'green');
  assert.equal(s.game.state.viewers.d.team, 'blue');
  assert.equal(s.game.snapshot().hud.poll.total, 1);
});

test('the poll pays pollLight to each voter on their team and reports the winner', () => {
  const s = setup();
  s.say('a', 'đỏ'); s.say('b', 'vàng'); s.say('c', 'xanh lá');
  s.game.startPoll();
  s.say('a', '2'); s.say('b', '2'); s.say('c', '2'); s.say('c', '1');
  s.advance(20_000);
  const end = s.of('poll-end')[0];
  assert.deepEqual([end.winner, end.votes, end.total, end.kind], [1, 3, 3, 'team']);
  assert.equal(s.game.state.poll, null);
  assert.equal(light(s.game, 'red'), 3);
  assert.equal(light(s.game, 'yellow'), 3);
  assert.equal(light(s.game, 'green'), 3);
});

test('the next-act poll offers up to four headliners and stores the winner in st.headVote', () => {
  const s = setup({ polls: [{ kind: 'next' }], config: { acts: true, demoTurns: false, pollSeconds: 10 }, start: 5 * 60000 * 70000 + 1000 });
  s.say('a', 'đỏ');
  s.game.startPoll();
  const p = s.game.snapshot().hud.poll;
  assert.equal(p.kind, 'next');
  assert.ok(p.options.length >= 1 && p.options.length <= 4);
  assert.ok(p.options.every(o => o.head && o.label));
  s.say('a', '4');
  s.advance(12_000);
  const end = s.of('poll-end')[0];
  assert.equal(end.kind, 'next');
  const vote = s.game.state.headVote;
  assert.equal(vote.id, end.option.head);
  assert.ok(vote.until > vote.from);
});

test('JSON round trip mid-poll keeps the votes; nobody votes twice after the restart', () => {
  const s = setup();
  s.say('a', 'đỏ'); s.say('b', 'vàng');
  s.game.startPoll();
  s.say('a', '1');
  const saved = JSON.parse(JSON.stringify(s.game.state));
  const s2 = setup({ state: saved, start: s.now() });
  assert.equal(s2.game.snapshot().hud.poll.total, 1);
  s2.say('a', '3');
  s2.say('b', '3');
  assert.deepEqual(s2.game.snapshot().hud.poll.options.map(o => o.n), [1, 0, 1, 0]);
  s2.advance(21_000);
  assert.equal(s2.of('poll-end')[0].total, 2);
});
