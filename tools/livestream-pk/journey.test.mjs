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
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id], journey: () => game.snapshot().cosmos.journey };
}
const SIGNS5 = ['Sư Tử', 'Bạch Dương', 'Bảo Bình', 'Kim Ngưu', 'Song Ngư'];

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
  SIGNS5.slice(0, 4).forEach((sign, i) => s.say(`u${i}`, sign));
  assert.equal(s.journey().got, 4);
  const before = s.v('u0').bag.dust;
  s.say('u4', SIGNS5[4]);
  const [c] = s.of('chapter');
  assert.deepEqual([c.no, c.id, c.next.id], [1, 'gather', 'lit']);
  assert.equal(c.people, 5);
  assert.ok(s.v('u0').bag.dust >= before + 10);
  assert.deepEqual([s.journey().no, s.journey().id, s.journey().got], [2, 'lit', 0]);
});

test('the last chapter ends the journey with a moon shard for everyone on stage; a new night starts over', () => {
  const events = [], paid = { dust: {}, moon: {} };
  const st = { night: { no: 1 }, viewers: { a: { nickname: 'A', sign: 'leo' }, b: { nickname: 'B', sign: 'aries' } } };
  const j = createJourney({ st, cfg: JOURNEY_DEFAULTS, now: () => 0, onEvent: e => events.push(e), stageIds: () => ['a', 'b'][Symbol.iterator](), elementOf: s => ({ leo: 'fire', aries: 'fire' })[s],
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

// --- đội nguyên tố: the four elements race through the night, a lead change is announced ---
test('the four element teams race on starlight; a new leader is announced once', () => {
  const s = setup({ elementLeadCooldownSeconds: 0, commentLight: 5 });
  s.say('f', 'Sư Tử'); // fire
  s.say('w', 'Song Ngư'); // water
  const el = () => s.game.snapshot().cosmos.journey.elements;
  s.advance(6000); s.say('f', 'hay quá');
  assert.equal(el().lead, 'fire');
  s.game.gift({ userId: 'w', nickname: 'W', diamonds: 100, count: 1 });
  assert.equal(el().lead, 'water');
  const leads = s.of('element-lead');
  assert.equal(leads.at(-1).element, 'water');
  assert.equal(leads.at(-1).prev, 'fire');
  assert.ok(el().light.water > el().light.fire);
});

// --- kịch tính & lời dẫn: host cues on every climax, the tug's reversals ---
test('host cues come on the climaxes: a boss near the end, the last seconds of a fight', () => {
  const s = setup({ bossSeconds: 60 });
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Bảo Bình']]) s.say(id, sign);
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
  for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Sư Tử'], ['c', 'Bảo Bình'], ['d', 'Bảo Bình']]) s.say(id, sign);
  const g = s.game.startTug();
  s.advance(16_000);
  s.game.state.tug.pos = -20; // side a leads
  s.advance(1000);
  assert.equal(s.of('tug-flip').length, 0, 'taking the lead is not a reversal');
  s.game.state.tug.pos = 15; // now side b
  s.advance(1000);
  const [flip] = s.of('tug-flip');
  assert.deepEqual([flip.lead, flip.other], [g.b, g.a]);
  assert.ok(s.of('host-cue').some(c => c.key === 'tug-flip'));
  s.game.state.tug.pos = -10; // straight back: too soon to call it again
  s.advance(1000);
  assert.equal(s.of('tug-flip').length, 1);
});

test('host cues are host-only material: the moon nearly full and the next headliner are cued too', () => {
  const s = setup({ moonGoal: 100 });
  s.say('a', 'Sư Tử');
  s.game.like({ userId: 'a', nickname: 'A', count: 88 });
  s.advance(1000);
  assert.ok(s.of('host-cue').some(c => c.key === 'moon-near'));
});
