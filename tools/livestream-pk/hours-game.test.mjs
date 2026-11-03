import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { HOUR_PLANETS } from './hours-table.mjs';

const HOUR = 3600000;
const sky = () => ({ planets: [], moon: { full: false }, mercuryRetro: false });
// "cycle" mode: clock hour n belongs to HOUR_PLANETS[n % 4]; start `minute` minutes into such an hour
const at = (planet, minute = 1) => HOUR * (4 * 7000 + HOUR_PLANETS.indexOf(planet)) + minute * 60000;

function setup(planet, config = {}, minute = 1) {
  let t = at(planet, minute);
  const events = [];
  const game = createGame({
    config: { hourMode: 'cycle', bossEverySeconds: 60, chaosEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false, ...config },
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

test('minute 10 of an act brings the hour\'s headliner: an elite boss in the hour of Mars', () => {
  const s = setup('mars', { bossEverySeconds: 0 }, 9.9);
  s.crowd();
  s.advance(15_000);
  const head = s.of('head-start');
  assert.equal(head.length, 1);
  assert.equal(head[0].id, 'elite');
  assert.equal(s.game.state.boss.elite, true);
});

test('the hour of Saturn starts the sky run at minute 5, and A/B/C comments vote its doors', () => {
  const s = setup('saturn', {}, 4.95);
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
  const s = setup('venus', { pairEverySeconds: 25 }, 9.95);
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
  const s = setup('venus', {}, 12.85);
  s.advance(1_000); // the act begins first
  s.crowd();
  s.game.chat({ userId: 'u2', nickname: 'U2', comment: 'mình góp nè' });
  s.advance(10_000);
  const card = s.events.find(e => e.type === 'card' && e.why === 'mvp');
  assert.ok(card);
  assert.equal(card.card.edition, 'h-venus');
});
