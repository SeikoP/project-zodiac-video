import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { ALL_HOUR_PLANETS as HOUR_PLANETS, HOUR_PLANETS as HOUR_PLANETS_DEFAULT, HOURS, HEADS, HEAD_QUEST, hourEdition } from './hours-table.mjs';

const HOUR = 3600000;
const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
// "cycle" mode: clock hour n belongs to HOUR_PLANETS[n % 4]; start `minute` minutes into such an hour
const at = (planet, minute = 1) => HOUR * (4 * 7000 + HOUR_PLANETS.indexOf(planet)) + minute * 60000;

function setup(planet, config = {}, minute = 1) {
  let t = at(planet, minute);
  const events = [];
  const game = createGame({
    config: { hourMode: 'cycle', hourMinutes: 60, hourPlanets: HOUR_PLANETS, bossEverySeconds: 60, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false, ...config },
    now: () => t, rng: () => 0.3, readSky: sky, onEvent: e => events.push(e),
  });
  const advance = ms => { for (let left = ms; left > 0; left -= 1000) { t += Math.min(1000, left); game.tick(); } };
  const crowd = () => { for (const [i, s] of ['Sư Tử', 'Bảo Bình', 'Kim Ngưu', 'Cự Giải'].entries()) game.chat({ userId: `u${i}`, nickname: `U${i}`, comment: s }); };
  return { game, events, advance, crowd, of: type => events.filter(e => e.type === type), now: () => t };
}

test('the boss only comes on its own in hours that allow it', () => {
  const venus = setup('venus');
  venus.crowd();
  venus.advance(90_000);
  assert.equal(venus.of('boss-start').length, 0);
  const mars = setup('mars');
  mars.crowd();
  mars.advance(90_000);
  assert.equal(mars.of('boss-start').length, 1);
});

test('the hour\'s rule multiplies the starlight of its kind of action', () => {
  const lifetime = (planet, config) => {
    const s = setup(planet, config);
    s.game.chat({ userId: 'x', nickname: 'X', comment: 'Sư Tử' });
    s.advance(10_000);
    const before = s.game.state.viewers.x.lifetime;
    s.game.chat({ userId: 'x', nickname: 'X', comment: 'hay quá' });
    return s.game.state.viewers.x.lifetime - before;
  };
  assert.equal(lifetime('mercury'), 2 * lifetime('mercury', { hours: false })); // Sao Thủy: comments x2
  assert.equal(lifetime('venus'), lifetime('venus', { hours: false }));
});

test('a new hour is announced once, with what comes next', () => {
  const s = setup('venus', {}, 59);
  s.crowd();
  s.advance(5_000);
  s.events.length = 0;
  s.advance(70_000);
  const starts = s.of('hour-start');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].planet, 'mercury');
  assert.equal(starts[0].next.planet, 'saturn');
  assert.equal(s.game.snapshot().cosmos.hour.planet, 'mercury');
});

test('minute 5 of an act brings the hour\'s headliner: an elite boss in the hour of Mars', () => {
  const s = setup('mars', { bossEverySeconds: 0 }, 4.9);
  s.crowd();
  s.advance(15_000);
  const head = s.of('head-start');
  assert.equal(head.length, 1);
  assert.equal(head[0].id, 'elite');
  assert.equal(s.game.state.boss.elite, true);
});

test('the hour of Saturn starts the sky run at minute 2, and A/B/C comments vote its doors', () => {
  const s = setup('saturn', {}, 1.95);
  s.crowd();
  s.advance(5_000);
  assert.equal(s.of('run-start').length, 1);
  assert.equal(s.game.state.run.phase.kind, 'door');
  s.game.chat({ userId: 'u0', nickname: 'U0', comment: 'a' });
  assert.equal(s.game.state.run.phase.votes[0], 1);
  assert.equal(s.game.state.viewers.u0.sign, 'leo'); // a vote is not a sign pick
  assert.ok(s.game.snapshot().cosmos.run);
});

test('đêm se duyên pairs two viewers with a score, and the act closes with its MVP', () => {
  const s = setup('venus', { pairEverySeconds: 25 }, 4.95);
  s.crowd();
  s.advance(40_000);
  const pairs = s.of('pair');
  assert.ok(pairs.length >= 1);
  assert.notEqual(pairs[0].a.userId, pairs[0].b.userId);
  assert.ok(pairs[0].score >= 50 && pairs[0].score <= 99);
  s.advance(3.2 * 60000);
  const close = s.of('act-close');
  assert.equal(close.length, 1);
  assert.ok(close[0].top[0].nickname);
  assert.equal(s.of('head-end').at(-1).id, 'matchmaking');
});

test('the host can force the next hour; hours off leaves everything on', () => {
  const s = setup('venus');
  s.crowd();
  assert.equal(s.game.forceHour('mars').planet, 'mars');
  assert.equal(s.of('hour-start').at(-1).planet, 'mars');
  const off = setup('venus', { hours: false });
  assert.equal(off.game.snapshot().cosmos.hour, null);
});

test('nhiệm vụ giờ: the room fills the hour\'s goal by taking part and everyone on stage is rewarded', () => {
  const s = setup('mars', { bossEverySeconds: 0 });
  s.crowd();
  s.advance(2_000);
  const q = s.game.snapshot().cosmos.quest;
  assert.equal(q.unit, 'bình luận');
  assert.equal(q.got, 0);
  // one comment each counts (a viewer's comments only count every few seconds, so spamming doesn't fill it)
  for (let i = 0; i < q.goal; i++) s.game.chat({ userId: `n${i}`, nickname: `N${i}`, comment: 'Sư Tử' });
  const done = s.of('quest-done');
  assert.equal(done.length, 1);
  assert.ok(done[0].people >= 4); // everyone still on stage (the stage keeps the most recent crowdMax)
  const gems = b => b.fire + b.earth + b.air + b.water;
  assert.ok(gems(s.game.state.viewers[`n${q.goal - 1}`].bag) >= 1); // someone still on stage got the reward
  s.game.chat({ userId: 'late', nickname: 'Late', comment: 'Sư Tử' });
  assert.equal(s.of('quest-done').length, 1); // once per hour
});

test('the act\'s MVP takes home a card of the hour', () => {
  const s = setup('venus', {}, 8.35);
  s.advance(1_000); // the act begins first
  s.crowd();
  s.game.chat({ userId: 'u2', nickname: 'U2', comment: 'mình góp nè' });
  s.advance(10_000);
  const card = s.events.find(e => e.type === 'card' && e.why === 'mvp');
  assert.ok(card);
  assert.equal(card.card.edition, 'h-venus');
});

test('by default two planets take 5-minute turns, and a planet\'s headliner moves on each time it comes round', () => {
  const SLOT = 5 * 60000, heads = [];
  for (let visit = 0; visit < 2; visit++) {
    let t = SLOT * (2 * (7000 + visit)) + 1000; // slot n belongs to ['mars', 'venus'][n % 2]
    const game = createGame({ config: { bossEverySeconds: 0, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false }, now: () => t, rng: () => 0.3, readSky: sky, onEvent: () => {} });
    const { hour } = game.snapshot().cosmos;
    assert.equal(hour.planet, 'mars');
    assert.equal(hour.next.planet, 'venus');
    assert.equal(hour.endsAt - hour.startsAt, SLOT);
    heads.push(hour.head);
  }
  assert.notEqual(heads[0], heads[1]);
});

test('every headliner belongs to one of the two planets that take turns', () => {
  const used = [...HOURS.mars.heads, ...HOURS.venus.heads];
  assert.deepEqual([...used].sort(), Object.keys(HEADS).sort());
  assert.equal(new Set(used).size, used.length);
  assert.deepEqual(HOUR_PLANETS_DEFAULT, ['mars', 'venus']);
});

test('in the default 5-minute turns, each of the ten headliners comes round within 100 minutes', () => {
  const seen = new Set();
  for (let n = 0; n < 20; n++) seen.add(defaultGame(turnAt(n)).snapshot().cosmos.hour.head);
  assert.deepEqual([...seen].sort(), Object.values(HEADS).map(h => h.label).sort());
});

// default cycle: 5-minute turns, mars on even turns; turn 70000 starts a visit count divisible by 5 (mars heads[0])
const turnAt = n => 5 * 60000 * (70000 + n) + 1000;
const defaultGame = t => createGame({ config: { bossEverySeconds: 0, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false }, now: () => t, rng: () => 0.3, readSky: sky, onEvent: () => {} });

test('the quest follows a headliner that has its own goal: floors in a sky run, right answers in a quiz chain', () => {
  for (const [n, head, unit] of [[0, 'elite', HOURS.mars.quest.unit], [4, 'run', HEAD_QUEST.run.unit], [8, 'quizchain', HEAD_QUEST.quizchain.unit], [1, 'matchmaking', HOURS.venus.quest.unit]]) {
    const game = defaultGame(turnAt(n));
    game.chat({ userId: 'a', nickname: 'A', comment: 'Sư Tử' });
    game.tick();
    const { hour, quest } = game.snapshot().cosmos;
    assert.equal(hour.head, HEADS[head].label, `turn ${n}`);
    assert.equal(quest?.unit, unit, head);
  }
  assert.equal(HEAD_QUEST.run.stat, 'floors');
  assert.equal(HEAD_QUEST.quizchain.stat, 'correct');
});

test('a planet hour also drops the card edition of the planet it took over', () => {
  assert.deepEqual([hourEdition('mars', 0.1), hourEdition('mars', 0.9)], ['h-mars', 'h-saturn']);
  assert.deepEqual([hourEdition('venus', 0.1), hourEdition('venus', 0.9)], ['h-venus', 'h-mercury']);
  assert.equal(hourEdition('mercury', 0.9), 'h-mercury');
  assert.equal(hourEdition('sun', 0.9), 'h-saturn', 'a borrowed theme drops the editions of its theme');
  assert.equal(hourEdition(null, 0.5), null);
});
