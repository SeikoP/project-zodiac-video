import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { CHAPTERS, createJourney, JOURNEY_DEFAULTS } from './journey.mjs';

function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { for (let left = ms; left > 0; left -= 1000) { t += Math.min(1000, left); game.tick(); } };
  // a viewer already on `team` and on stage, whatever the balance would have said
  const seat = (id, team) => {
    game.state.viewers[id] = { nickname: id.toUpperCase(), avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
    game.like({ userId: id, nickname: id.toUpperCase(), count: 0 });
  };
  return { game, events, say, seat, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id], journey: () => game.snapshot().cosmos.journey };
}
const FIVE = ['đỏ', 'vàng', 'xanh lá', 'xanh dương', 'đỏ'];

// --- hành trình đêm: one story in five chapters ---
test('the night is a journey of five chapters, the first is gathering the room', () => {
  assert.deepEqual(CHAPTERS.map(c => c.id), ['gather', 'lit', 'moon', 'win', 'wheel']);
  const s = setup();
  const j = s.journey();
  assert.deepEqual([j.no, j.of, j.id, j.got, j.need], [1, 5, 'gather', 0, 5]);
  assert.ok(j.label && j.goal && j.icon);
});

test('a chapter completes from what the room does, pays everyone on stage and opens the next', () => {
  const s = setup({ journeyDust: 10 });
  FIVE.slice(0, 4).forEach((team, i) => s.say(`u${i}`, team));
  assert.equal(s.journey().got, 4);
  const before = s.v('u0').bag.dust;
  s.say('u4', FIVE[4]);
  const [c] = s.of('chapter');
  assert.deepEqual([c.no, c.id, c.next.id], [1, 'gather', 'lit']);
  assert.equal(c.people, 5);
  assert.ok(s.v('u0').bag.dust >= before + 10);
  assert.deepEqual([s.journey().no, s.journey().id, s.journey().got], [2, 'lit', 0]);
});

test('the last chapter ends the journey with a moon shard for everyone on stage; a new night starts over', () => {
  const events = [], paid = { dust: {}, moon: {} };
  const st = { night: { no: 1 }, viewers: { a: { nickname: 'A', team: 'red' }, b: { nickname: 'B', team: 'yellow' } } };
  const j = createJourney({ st, cfg: JOURNEY_DEFAULTS, now: () => 0, onEvent: e => events.push(e), stageIds: () => ['a', 'b'][Symbol.iterator](),
    dust: (u, v, n) => { paid.dust[u.userId] = (paid.dust[u.userId] ?? 0) + n; }, moon: u => { paid.moon[u.userId] = (paid.moon[u.userId] ?? 0) + 1; } });
  const feed = { gather: { type: 'join' }, lit: { type: 'lit' }, moon: { type: 'moon-full' }, win: { type: 'boss-defeated' }, wheel: { type: 'wheel-complete' } };
  for (const c of CHAPTERS) for (let i = 0; i < c.need; i++) j.note(feed[c.id]);
  assert.deepEqual(events.filter(e => e.type === 'chapter').map(e => e.no), [1, 2, 3, 4, 5]);
  assert.equal(events.filter(e => e.type === 'journey-done').length, 1);
  assert.deepEqual(paid.moon, { a: 1, b: 1 });
  assert.equal(j.view().done, true);
  j.note({ type: 'lit' }); // nothing after the end
  assert.equal(events.filter(e => e.type === 'chapter').length, 5);
  st.night.no = 2;
  assert.deepEqual([j.view().no, j.view().got, j.view().done], [1, 0, false]);
});

// --- đua phe: the four colour teams race through the night, a lead change is announced ---
test('the four teams race on starlight; a new leader is announced ("Đảo chiều!") once', () => {
  const s = setup({ teamLeadCooldownSeconds: 0, commentLight: 5 });
  s.say('f', 'đỏ');
  s.say('w', 'xanh dương');
  const race = () => s.game.snapshot().cosmos.journey.teams;
  s.advance(6000); s.say('f', 'hay quá');
  assert.equal(race().lead, 'red');
  s.game.gift({ userId: 'w', nickname: 'W', diamonds: 100, count: 1 });
  assert.equal(race().lead, 'blue');
  const leads = s.of('team-lead');
  assert.equal(leads.at(-1).team, 'blue');
  assert.equal(leads.at(-1).prev, 'red');
  assert.ok(race().light.blue > race().light.red);
  assert.ok(s.of('host-cue').some(c => c.key === 'team-lead' && /Đảo chiều/.test(c.text) && /phe/.test(c.text)));
  assert.deepEqual(Object.keys(race().light), ['red', 'yellow', 'green', 'blue']);
});

test('a lead change is announced at most once per teamLeadCooldownSeconds (default 90)', () => {
  assert.equal(JOURNEY_DEFAULTS.teamLeadCooldownSeconds, 90);
  const s = setup({ commentLight: 0, lightPerDiamond: 1 });
  s.say('f', 'đỏ'); s.say('w', 'xanh dương'); s.say('g', 'xanh lá');
  const gift = (id, diamonds) => s.game.gift({ userId: id, nickname: id.toUpperCase(), diamonds, count: 1 });
  gift('f', 10); // red leads: the first leader is never an "Đảo chiều"
  gift('w', 20); // blue takes over, but the clock for the first announcement started when red led
  assert.equal(s.of('team-lead').length, 0, 'inside the cooldown of the first lead');
  s.advance(91_000);
  gift('g', 30); // green overtakes after the cooldown
  assert.deepEqual(s.of('team-lead').map(e => [e.team, e.prev]), [['green', 'blue']]);
  s.advance(30_000);
  gift('f', 100); // red again, but only 30 s after the last announcement
  assert.equal(s.of('team-lead').length, 1);
  s.advance(61_000);
  gift('w', 200);
  assert.deepEqual(s.of('team-lead').map(e => e.team), ['green', 'blue']);
});

test('chapter 5, Đại hội sao, completes when all 4 teams are lit — and chapter text speaks of phe, never cung or chòm', () => {
  const s = setup({ teamLightCost: 10, lightPerDiamond: 1, commentLight: 0 });
  for (const [id, team] of [['a', 'đỏ'], ['b', 'vàng'], ['c', 'xanh lá'], ['d', 'xanh dương']]) s.say(id, team);
  Object.assign(s.game.state.journey, { i: 4, got: 0, done: false });
  assert.equal(s.journey().id, 'wheel');
  assert.match(s.journey().goal, /4 phe/);
  for (const [id, n] of [['a', 10], ['b', 10], ['c', 10]]) s.game.gift({ userId: id, nickname: id, diamonds: n, count: 1 });
  assert.equal(s.of('wheel-complete').length, 0);
  assert.equal(s.journey().done, false, 'three lit teams are not enough');
  s.game.gift({ userId: 'd', nickname: 'd', diamonds: 10, count: 1 });
  assert.equal(s.of('wheel-complete').length, 1);
  assert.equal(s.journey().done, true);
  assert.deepEqual(s.of('chapter').map(c => c.id), ['wheel']);
  assert.equal(s.of('journey-done').length, 1);
  for (const c of CHAPTERS) assert.ok(!/cung|chòm|hoàng đạo|nguyên tố/i.test(c.label + c.goal), c.id);
});

test('the journey and the team race carry on through a JSON restart', () => {
  const s = setup({ teamLightCost: 100, lightPerDiamond: 1, commentLight: 0 });
  for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương']]) s.say(id, team);
  s.game.gift({ userId: 'a', nickname: 'A', diamonds: 40, count: 1 });
  const saved = JSON.parse(JSON.stringify(s.game.state));
  const events = [];
  const again = createGame({ state: saved, config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, teamLightCost: 100, lightPerDiamond: 1, commentLight: 0 }, now: () => Date.UTC(2026, 10, 4, 12), rng: () => 0, onEvent: e => events.push(e) });
  const j = again.snapshot().cosmos.journey;
  assert.deepEqual([j.no, j.got, j.teams.lead, j.teams.light.red], [s.journey().no, s.journey().got, 'red', 40]);
  assert.equal(again.state.wheel.light.red, 40);
});

// --- kịch tính & lời dẫn: host cues on every climax, the tug's reversals ---
test('host cues come on the climaxes: a boss near the end, the last seconds of a fight', () => {
  const s = setup({ bossSeconds: 60 });
  for (const [id, team] of [['a', 'đỏ'], ['b', 'xanh dương']]) s.say(id, team);
  s.game.startBoss();
  s.game.state.boss.hp = Math.floor(s.game.state.boss.max * 0.2);
  s.advance(1000);
  const cues = () => s.of('host-cue').map(c => c.key);
  assert.ok(cues().includes('boss-low'));
  s.advance(45_000);
  assert.ok(cues().includes('last-seconds'));
  assert.equal(cues().filter(k => k === 'boss-low').length, 1, 'once per boss');
  assert.ok(s.of('host-cue').every(c => typeof c.text === 'string' && c.text.length > 10));
});

test('a tug of war that changes hands is a reversal: the room and the host hear it', () => {
  const s = setup();
  for (const [id, team] of [['a', 'red'], ['b', 'red'], ['c', 'blue'], ['d', 'blue']]) s.seat(id, team);
  const g = s.game.startTug();
  s.advance(16_000);
  s.game.state.tug.value = -20; // side a leads
  s.advance(1000);
  assert.equal(s.of('tug-flip').length, 0, 'taking the lead is not a reversal');
  s.game.state.tug.value = 15; // now side b
  s.advance(1000);
  const [flip] = s.of('tug-flip');
  assert.deepEqual([flip.lead, flip.other], [g.b, g.a]);
  assert.ok(s.of('host-cue').some(c => c.key === 'tug-flip'));
  s.game.state.tug.value = -10; // straight back: too soon to call it again
  s.advance(1000);
  assert.equal(s.of('tug-flip').length, 1);
});

test('host cues are host-only material: the moon nearly full and the next headliner are cued too', () => {
  const s = setup({ moonGoal: 100 });
  s.say('a', 'đỏ');
  s.game.like({ userId: 'a', nickname: 'A', count: 88 });
  s.advance(1000);
  assert.ok(s.of('host-cue').some(c => c.key === 'moon-near'));
});

// --- gift abilities: progress and completing a chapter ---
const giveTo = (s, id, diamonds) => s.game.gift({ userId: id, nickname: id.toUpperCase(), diamonds, count: 1 });

test('progress adds steps to a chapter of several; a one-step chapter is left to its events; complete finishes the chapter', () => {
  const s = setup();
  FIVE.slice(0, 2).forEach((team, i) => s.say(`u${i}`, team));
  assert.equal(s.journey().got, 2);
  assert.equal(s.game.giftEventId(), 'journey');
  giveTo(s, 'u0', 10); // 10 x 0.2 = 2 steps
  assert.equal(s.journey().got, 4);
  giveTo(s, 'u0', 2.5); // half a step: kept, shown rounded down
  assert.equal(s.journey().got, 4);
  giveTo(s, 'u0', 2.5);
  assert.equal(s.of('chapter').length, 1, 'two halves make the fifth step');
  assert.equal(s.journey().id, 'lit');
  Object.assign(s.game.state.journey, { i: 2, got: 0, done: false }); // the moon chapter: one step
  giveTo(s, 'u0', 50);
  assert.equal(s.journey().id, 'moon', 'mid does not finish a one-step chapter');
  giveTo(s, 'u0', 100);
  assert.equal(s.journey().id, 'win', 'big completes it');
});

test('complete on the last chapter ends the journey (the moon shards are paid) and later gifts fall to the default path', () => {
  const s = setup();
  s.seat('a', 'red');
  Object.assign(s.game.state.journey, { i: 4, got: 0, done: false });
  giveTo(s, 'a', 100);
  assert.equal(s.of('journey-done').length, 1);
  assert.equal(s.game.giftEventId(), null);
  const n = s.of('gift-ability').length;
  giveTo(s, 'a', 100);
  assert.equal(s.of('gift-ability').length, n);
});

test('the journey view stays whole numbers while a gift adds fractions', () => {
  const s = setup();
  s.seat('a', 'red');
  giveTo(s, 'a', 3);
  assert.equal(Number.isInteger(s.journey().got), true);
});
