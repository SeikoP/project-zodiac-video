import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../game.mjs';
import { createRoast, ROAST_DEFAULTS } from '../roast.mjs';
import { TEASES } from '../teases.mjs';
import { createRoster } from './roster.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';

// --- the wheel on its own: a fake room, a fake clock ---
function room(people, config = {}, from = null) {
  let t = 1_000_000;
  const viewers = {}, stage = new Map();
  for (const [id, team] of people) { viewers[id] = { nickname: id.toUpperCase(), avatar: `av-${id}`, team }; stage.set(id, true); }
  const roster = createRoster({ viewers, stage });
  const events = [], paid = [], lucky = [];
  const reward = createReward({ sinks: { light: (u, v, n, why) => { paid.push([u.userId, n, why]); } } });
  const st = from ?? { roast: null };
  const cfg = { ...ROAST_DEFAULTS, ...config };
  const roast = createRoast({ st, cfg, now: () => t, rng: () => 0, onEvent: e => events.push(e), ctx: { roster }, reward, viewerOf: id => viewers[id], lucky: team => { lucky.push(team); return !config.noLucky; } });
  const say = (id, text) => roast.chat({ userId: id }, viewers[id], text);
  return { st, roast, roster, viewers, stage, events, paid, lucky, cfg, say, now: () => t, advance: ms => { t += ms; roast.tick(t); }, of: type => events.filter(e => e.type === type) };
}
const FIVE = [['r1', 'red'], ['r2', 'red'], ['r3', 'red'], ['b1', 'blue'], ['g1', 'green']];

test('needs is false on an empty stage (and start does not throw); one person is enough', () => {
  const empty = room([]);
  assert.equal(empty.roast.needs({ roster: empty.roster }), false);
  assert.ok(!empty.roast.start());
  assert.equal(empty.st.roast, null);
  assert.equal(empty.events.length, 0);
  const lone = room([['a', 'red']]);
  assert.equal(lone.roast.needs({ roster: lone.roster }), true);
  assert.ok(lone.roast.start());
  const reg = createRegistry({ ctx: { roster: empty.roster } });
  reg.register(empty.roast);
  assert.equal(reg.start('roast'), false);
});

test('the wheel picks one person who is on stage, not a team, and reads a tease', () => {
  const r = room(FIVE);
  r.viewers.gone = { nickname: 'GONE', team: 'blue' }; // known, but not on stage
  assert.ok(r.roast.start());
  const s = r.of('roast-start')[0];
  assert.ok(r.stage.has(s.userId));
  assert.equal(s.nickname, s.userId.toUpperCase());
  assert.equal(s.avatar, `av-${s.userId}`);
  assert.equal(s.team, r.viewers[s.userId].team);
  assert.ok(TEASES.includes(s.line));
  assert.equal(s.spinMs, 5000);
  assert.equal(s.seconds, 25);
  assert.equal('sign' in s, false);
  const named = room(FIVE);
  named.roast.start({ userId: 'b1' });
  assert.equal(named.of('roast-start')[0].userId, 'b1');
  const missing = room(FIVE);
  assert.ok(!missing.roast.start({ userId: 'nobody' }));
  assert.equal(missing.st.roast, null);
});

test('need = max(1, min(4, ceil(sameTeamPresent / 2)))', () => {
  const needFor = (n, startId) => {
    const people = Array.from({ length: n }, (_, i) => [`x${i}`, 'red']).concat([['o', 'blue']]);
    const r = room(people);
    r.roast.start({ userId: startId ?? 'x0' });
    return r.of('roast-start')[0].need;
  };
  assert.deepEqual([1, 2, 3, 4, 7, 8, 9, 20].map(n => needFor(n)), [1, 1, 2, 2, 4, 4, 4, 4]);
  assert.equal(needFor(5, 'o'), 1, 'a lone blue needs only one');
});

test('"oan" counts only after the spin, from the chosen person and teammates, never from others', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'r1' });
  assert.equal(r.say('r2', 'oan quá'), false, 'still spinning');
  r.advance(5001);
  assert.equal(r.say('r2', 'oan quá'), true, 'a teammate');
  assert.equal(r.say('r1', 'oan'), true, 'the chosen person');
  assert.equal(r.say('b1', 'oan'), false, 'another team cannot protest');
  assert.equal(r.say('b1', 'chuẩn luôn'), true, 'others agree');
  assert.equal(r.say('r3', 'chuẩn'), false, 'the chosen team cannot agree');
  assert.equal(r.say('g1', 'hello'), false, 'ordinary chat falls through');
  assert.equal(r.roast.view().protests, 2);
  assert.equal(r.roast.view().agree, 1);
});

test('a second reaction by the same person is ignored, whichever it is', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'r1' });
  r.advance(5001);
  assert.equal(r.say('r2', 'oan'), true);
  assert.equal(r.say('r2', 'oan'), false);
  assert.equal(r.say('b1', 'chuẩn'), true);
  assert.equal(r.say('b1', 'chuẩn'), false);
  assert.equal(r.say('b1', 'haha'), false);
  assert.equal(r.roast.view().protests, 1);
  assert.equal(r.roast.view().agree, 1);
});

test('enough "oan" clears the person: protesters are paid, nobody is consoled', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'r1' }); // three on red: need 2
  assert.equal(r.of('roast-start')[0].need, 2);
  r.advance(5001);
  r.say('r2', 'oan'); r.say('r3', 'oan quá'); r.say('b1', 'chuẩn');
  r.advance(21_000);
  const end = r.of('roast-end')[0];
  assert.equal(end.cleared, true);
  assert.deepEqual([end.userId, end.nickname, end.team, end.protests, end.need, end.agree, end.consoled], ['r1', 'R1', 'red', 2, 2, 1, false]);
  assert.ok(TEASES.includes(end.line));
  assert.deepEqual(end.names, ['R2', 'R3']);
  assert.deepEqual(r.paid, [['r2', 15, 'roast'], ['r3', 15, 'roast']]);
  assert.deepEqual(r.lucky, []);
  assert.equal(r.st.roast, null);
  assert.equal(r.roast.isDone(), true);
});

test('too few "oan": the tease stands, agreers are paid and the person\'s team gets the lucky star', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'r1' }); // need 2
  r.advance(5001);
  r.say('r2', 'oan'); r.say('b1', 'chuẩn'); r.say('g1', 'dung roi');
  r.advance(21_000);
  const end = r.of('roast-end')[0];
  assert.equal(end.cleared, false);
  assert.equal(end.consoled, true);
  assert.deepEqual(r.lucky, ['red']);
  assert.deepEqual(r.paid, [['b1', 3, 'roast'], ['g1', 3, 'roast']]);
  assert.deepEqual(end.names, ['B1', 'G1']);
});

test('an unanswered wheel is consoled too, and the consolation can be refused (lucky star already on)', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'b1' });
  r.advance(26_000);
  assert.equal(r.of('roast-end')[0].cleared, false);
  assert.deepEqual(r.lucky, ['blue']);
  const busy = room(FIVE, { noLucky: true });
  busy.roast.start({ userId: 'b1' });
  busy.advance(26_000);
  assert.equal(busy.of('roast-end')[0].consoled, false);
});

test('while the wheel is on, the registry refuses a second start and routes chat', () => {
  const r = room(FIVE);
  const reg = createRegistry({ now: r.now, ctx: { roster: r.roster } });
  reg.register(r.roast);
  assert.equal(reg.start('roast', { userId: 'r1' }), true);
  assert.equal(reg.start('roast'), false);
  r.advance(5001);
  assert.equal(reg.chat({ userId: 'r2' }, r.viewers.r2, 'oan'), true);
  assert.equal(reg.chat({ userId: 'b1' }, r.viewers.b1, 'xin chào'), false);
  reg.tick(r.now() + 30_000);
});

test('JSON round trip mid-wheel keeps the person, the line and who already reacted', () => {
  const r = room(FIVE);
  r.roast.start({ userId: 'r1' });
  r.advance(5001);
  r.say('r2', 'oan'); r.say('b1', 'chuẩn');
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = room(FIVE, {}, saved);
  const reg = createRegistry({ now: r2.now, ctx: { roster: r2.roster } });
  reg.register(r2.roast);
  assert.equal(reg.adopt('roast'), true);
  r2.advance(5001); // the fake clock of the second room starts over
  assert.equal(r2.say('r2', 'oan'), false, 'r2 had reacted');
  assert.equal(r2.say('b1', 'chuẩn'), false, 'b1 had reacted');
  assert.equal(r2.say('r3', 'oan'), true);
  assert.equal(r2.say('g1', 'chuẩn'), true);
  r2.advance(26_000);
  const end = r2.of('roast-end')[0];
  assert.deepEqual([end.userId, end.cleared, end.protests, end.agree, end.need], ['r1', true, 2, 2, 2]);
});

test('every tease is friendly: no zodiac words and at most 90 characters', () => {
  assert.ok(TEASES.length >= 12);
  assert.equal(new Set(TEASES).size, TEASES.length);
  const banned = /cung|chòm|chom|hoàng đạo|zodiac|sư tử|bạch dương|kim ngưu|song tử|cự giải|xử nữ|thiên bình|bò cạp|nhân mã|ma kết|bảo bình|song ngư|hành tinh|sao hỏa|sao kim|sao thủy|sao mộc|sao thổ|mặt trăng|nguyên tố/i;
  for (const line of TEASES) {
    assert.ok(line.length <= 90, `${line.length} chars: ${line}`);
    assert.ok(!banned.test(line), `mentions a sign, planet or element: ${line}`);
  }
});

// --- inside the game ---
function setup(config = {}) {
  let t = 1_000_000;
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id, comment });
  const advance = ms => { t += ms; game.tick(); };
  const seat = (id, team) => {
    game.state.viewers[id] = { nickname: id, avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
    game.like({ userId: id, nickname: id, count: 0 }); // puts them on stage on the team given (roster.mjs would redirect a crowded team)
  };
  return { game, events, say, seat, advance, now: () => t, of: type => events.filter(e => e.type === type) };
}

test('startRoast(userId) spins for that person; "oan" from a teammate clears them and pays the protester', () => {
  const s = setup();
  s.seat('a', 'red'); s.seat('b', 'red'); s.seat('c', 'blue');
  const r = s.game.startRoast('a');
  assert.ok(r);
  assert.equal(s.game.state.roast.userId, 'a');
  assert.equal(s.of('roast-start')[0].need, 1);
  s.say('b', 'oan quá'); // still spinning: doesn't count yet
  assert.equal(s.game.snapshot().cosmos.roast.protests, 0);
  s.advance(6000);
  const before = s.game.state.viewers.b.lifetime;
  s.say('b', 'oan quá');
  s.say('c', 'chuẩn luôn');
  s.say('c', 'oan'); // only the person's team can protest
  assert.equal(s.game.snapshot().cosmos.roast.protests, 1);
  s.advance(20_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, true);
  assert.ok(s.game.state.viewers.b.lifetime > before);
});

test('startRoast() with no one on stage does nothing; with no argument it picks someone present', () => {
  const s = setup();
  assert.ok(!s.game.startRoast());
  assert.equal(s.game.state.roast, null);
  s.seat('a', 'green');
  assert.ok(s.game.startRoast());
  assert.equal(s.game.state.roast.userId, 'a');
});

test('an unanswered wheel stands, and the person\'s team gets the lucky star as consolation', () => {
  const s = setup();
  s.say('a', 'xanh dương');
  s.game.startRoast('a');
  s.advance(26_000);
  const end = s.of('roast-end')[0];
  assert.equal(end.cleared, false);
  assert.equal(end.consoled, true);
  assert.equal(s.game.state.lucky.team, 'blue');
});

test('a line that is not a reaction is still ordinary chat during the wheel', () => {
  const s = setup({ commentLight: 5, commentCooldownSeconds: 0 });
  s.seat('a', 'red'); s.seat('b', 'blue');
  s.game.startRoast('a');
  s.advance(6000);
  const before = s.game.state.viewers.b.lifetime;
  s.say('b', 'xin chào mọi người');
  assert.ok(s.game.state.viewers.b.lifetime > before);
});

test('a saved game mid-wheel keeps going after a restart', () => {
  const s = setup();
  s.seat('a', 'red'); s.seat('b', 'red'); s.seat('c', 'blue');
  s.game.startRoast('a');
  s.advance(6000);
  s.say('b', 'oan');
  const saved = JSON.parse(JSON.stringify(s.game.state));
  let t = s.now();
  const events = [];
  const again = createGame({ state: saved, config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e6 }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  assert.equal(again.snapshot().cosmos.roast.protests, 1);
  assert.equal(again.startRoast('c'), null, 'the adopted wheel blocks a second one');
  t += 26_000; again.tick();
  const end = events.find(e => e.type === 'roast-end');
  assert.equal(end.cleared, true);
});

// --- gift abilities: tickets, the giver's pick, the second spin ---
function wheel(people, { rng = () => 0, config = {}, st = null, at = 1_000_000 } = {}) {
  let t = at;
  const viewers = {}, stage = new Map();
  for (const [id, team] of people) { viewers[id] = { nickname: id.toUpperCase(), avatar: '', team }; stage.set(id, true); }
  const roster = createRoster({ viewers, stage });
  const events = [];
  const reward = createReward({ sinks: { light: () => {} } });
  const state = st ?? { roast: null };
  const roast = createRoast({ st: state, cfg: { ...ROAST_DEFAULTS, ...config }, now: () => t, rng, onEvent: e => events.push(e), ctx: { roster }, reward, viewerOf: id => viewers[id], lucky: () => null });
  const give = (tier, id, diamonds = 20) => roast.gift[tier]({ user: { userId: id }, viewer: viewers[id], team: viewers[id].team, diamonds, tier });
  return { st: state, roast, viewers, events, give, now: () => t, advance: ms => { t += ms; roast.tick(t); }, say: (id, text) => roast.chat({ userId: id }, viewers[id], text), of: type => events.filter(e => e.type === type) };
}

test('tickets weight the next pick by 1 + tickets and are spent when the wheel lands on that person', () => {
  const people = [['a', 'red'], ['b', 'red'], ['c', 'blue']];
  const none = wheel(people, { rng: () => 0.5 });
  none.roast.start();
  assert.equal(none.st.roast.userId, 'b', 'no tickets: the plain uniform pick (floor(0.5 x 3) = b)');
  const w = wheel(people, { rng: () => 0.5 });
  w.st.roastTickets.a = 3; // weights a:4 b:1 c:1 - half of 6 lands inside a
  w.roast.start();
  assert.equal(w.st.roast.userId, 'a');
  assert.deepEqual(w.st.roastTickets, {}, 'spent');
  const kept = wheel(people, { rng: () => 0.99 });
  kept.st.roastTickets.a = 3;
  kept.roast.start();
  assert.equal(kept.st.roast.userId, 'c');
  assert.deepEqual(kept.st.roastTickets, { a: 3 }, 'not picked: kept for next time');
});

test('gift.small adds one ticket per gift; it needs a team', () => {
  const w = wheel([['a', 'red'], ['n', null]]);
  w.give('small', 'a'); w.give('small', 'a');
  assert.deepEqual(w.st.roastTickets, { a: 2 });
  assert.equal(w.give('small', 'n'), false);
});

test('gift.mid opens the pick; a colour comment from the giver sends the wheel to that team (not a switch); once per wheel', () => {
  const w = wheel([['a', 'red'], ['b', 'red'], ['c', 'blue'], ['d', 'green']]);
  w.roast.start({ userId: 'a' });
  assert.notEqual(w.give('mid', 'c'), false);
  assert.equal(w.st.roast.pick.team, 'blue');
  assert.equal(w.say('d', 'xanh lá'), false, 'someone else\'s colour comment is ordinary chat');
  assert.equal(w.say('c', '2'), false, 'a bare digit is not a pick');
  assert.equal(w.say('c', 'ĐỎ'), true);
  assert.equal(w.st.roast.team, 'red');
  assert.equal(w.st.roast.userId, 'b', 'the person it landed on is spared');
  assert.equal(w.st.roast.respun, true);
  assert.equal(w.st.roast.pick, undefined);
  assert.equal(w.of('roast-start').at(-1).again, true);
  assert.equal(w.give('mid', 'd'), false, 'once per wheel');
  assert.equal(w.give('big', 'd'), false);
});

test('gift.mid with a team nobody is on, or no comment: the giver\'s own team', () => {
  const w = wheel([['a', 'red'], ['c', 'blue'], ['d', 'blue']]);
  w.roast.start({ userId: 'a' });
  w.give('mid', 'c');
  w.say('c', 'vàng'); // nobody on yellow
  assert.equal(w.st.roast.team, 'blue');
  const late = wheel([['a', 'red'], ['c', 'blue']]);
  late.roast.start({ userId: 'a' });
  late.give('mid', 'c');
  late.advance(14_000);
  assert.equal(late.st.roast.userId, 'a', 'still waiting for the pick');
  late.advance(1_100);
  assert.equal(late.st.roast.userId, 'c');
});

test('the pick keeps the wheel on until it is made even when the protest window would have ended', () => {
  const w = wheel([['a', 'red'], ['c', 'blue']]);
  w.roast.start({ userId: 'a' });
  w.advance(24_000);
  w.give('mid', 'c');
  w.advance(5_000);
  assert.equal(w.of('roast-end').length, 0);
  w.advance(12_000);
  assert.equal(w.st.roast.userId, 'c', 'the giver\'s team was spun');
});

test('gift.big re-rolls the whole wheel once, and answers false when there is no wheel', () => {
  const w = wheel([['a', 'red'], ['b', 'red'], ['c', 'blue']]);
  assert.equal(w.give('big', 'c', 200), false, 'no wheel is on');
  w.roast.start({ userId: 'a' });
  w.advance(6000);
  w.say('b', 'oan');
  assert.equal(w.give('big', 'c', 200), true);
  assert.notEqual(w.st.roast.userId, 'a');
  assert.equal(w.roast.view().protests, 0, 'a fresh round of reactions');
  assert.equal(w.give('big', 'c', 200), false);
  const lone = wheel([['a', 'red']]);
  lone.roast.start();
  assert.equal(lone.give('big', 'a', 200), true, 'a lone viewer: the wheel lands on them again');
});

test('roastTickets, pick and respun survive a JSON round trip', () => {
  const w = wheel([['a', 'red'], ['b', 'red'], ['c', 'blue']]);
  w.st.roastTickets.c = 2;
  w.roast.start({ userId: 'a' });
  w.give('mid', 'c');
  const saved = JSON.parse(JSON.stringify(w.st));
  const again = wheel([['a', 'red'], ['b', 'red'], ['c', 'blue']], { st: saved, at: w.now() });
  assert.deepEqual(again.st.roastTickets, { c: 2 });
  assert.equal(again.say('c', 'xanh dương'), true);
  assert.equal(again.st.roast.team, 'blue');
});
