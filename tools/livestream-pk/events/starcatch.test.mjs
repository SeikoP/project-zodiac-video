import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarcatch, CATCH_WORDS, MINIGAME_DEFAULTS } from '../minigames.mjs';
import { createReward } from './reward.mjs';
import { createRegistry } from './registry.mjs';

function room(people = ['a', 'b', 'c', 'd'], config = {}, from = null) {
  let t = 3_000_000;
  const viewers = Object.fromEntries(people.map((id, i) => [id, { nickname: id.toUpperCase(), team: ['red', 'blue', 'green', 'yellow'][i % 4] }]));
  const events = [], paid = [], quests = [];
  const pay = kind => (u, v, n, why) => { paid.push([u.userId, kind, n, why]); };
  const reward = createReward({ sinks: { light: pay('light'), dust: pay('dust'), gem: pay('gem') } });
  const st = from ?? { starcatch: null };
  const cfg = { ...MINIGAME_DEFAULTS, catchRounds: 3, catchEverySeconds: 6, catchWinners: 3, ...config };
  const sc = createStarcatch({ st, cfg, now: () => t, rng: () => 0, onEvent: e => events.push(e), reward, viewerOf: id => viewers[id], quest: s => quests.push(s) });
  const say = (id, text) => sc.chat({ userId: id }, viewers[id], text);
  return { st, sc, viewers, events, paid, quests, say, now: () => t, advance: ms => { t += ms; sc.tick(t); }, of: type => events.filter(e => e.type === type) };
}

test('a word falls each round; the first three to type it catch it, once each per star', () => {
  const r = room();
  r.sc.start();
  const [star] = r.of('catch-star');
  assert.ok(CATCH_WORDS.includes(star.word));
  assert.equal(r.say('a', star.word.toUpperCase()), true);
  assert.equal(r.say('a', star.word), true, 'once per star, but still a star word');
  assert.equal(r.say('b', `  ${star.word} `), true);
  assert.equal(r.say('c', 'sai rồi'), false);
  assert.equal(r.say('c', star.word), true);
  assert.equal(r.say('d', star.word), true, 'a fourth catch is too late but still the star word');
  assert.deepEqual(r.of('catch').map(c => [c.userId, c.rank]), [['a', 1], ['b', 2], ['c', 3]]);
  assert.deepEqual(r.paid.filter(p => p[0] === 'a').map(p => [p[1], p[2], p[3]]), [['dust', 3, 'catch'], ['light', 4, 'catch']]);
  assert.equal(r.paid.some(p => p[0] === 'd'), false);
  assert.deepEqual(r.quests, ['catches', 'catches', 'catches']);
});

test('eight rounds by default; the person who caught most gets a gem at the end', () => {
  const r = room(['a', 'b', 'c'], { catchRounds: MINIGAME_DEFAULTS.catchRounds });
  assert.equal(MINIGAME_DEFAULTS.catchRounds, 8);
  r.sc.start();
  for (let i = 1; i <= 8; i++) {
    const star = r.of('catch-star').at(-1);
    assert.equal(star.round, i);
    r.say('a', star.word);
    if (i % 2) r.say('b', star.word);
    r.advance(6000);
  }
  assert.equal(r.of('catch-star').length, 8);
  const end = r.of('catch-end')[0];
  assert.deepEqual(end.top.map(x => [x.userId, x.catches]), [['a', 8], ['b', 4]]);
  assert.deepEqual(r.paid.filter(p => p[1] === 'gem'), [['a', 'gem', 1, 'catch']]);
  assert.equal(r.st.starcatch, null);
  assert.equal(r.sc.isDone(), true);
});

test('a new round is a new chance: the winners list starts over', () => {
  const r = room();
  r.sc.start();
  const w1 = r.of('catch-star')[0].word;
  r.say('a', w1);
  r.advance(6000);
  const w2 = r.of('catch-star')[1];
  assert.equal(w2.round, 2);
  r.say('a', w2.word);
  assert.deepEqual(r.of('catch').map(c => [c.userId, c.round, c.rank]), [['a', 1, 1], ['a', 2, 1]]);
});

test('view shows round, word, catches so far and the best catchers', () => {
  const r = room();
  assert.equal(r.sc.view(r.now()), null);
  r.sc.start();
  const word = r.of('catch-star')[0].word;
  r.say('b', word);
  const v = r.sc.view(r.now());
  assert.deepEqual([v.round, v.of, v.word, v.caught, v.need, v.nextInMs], [1, 3, word, 1, 3, 6000]);
  assert.deepEqual(v.top, [{ nickname: 'B', catches: 1 }]);
});

test('registered in the registry; JSON round trip mid-event carries on', () => {
  const r = room();
  const reg = createRegistry({ now: r.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg.register(r.sc);
  assert.equal(reg.start('starcatch'), true);
  r.advance(6000);
  const word = r.of('catch-star')[1].word;
  r.say('a', word);
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = room(['a', 'b', 'c', 'd'], {}, saved);
  const reg2 = createRegistry({ now: r2.now, onEvent: () => {}, cfg: {}, ctx: {} });
  reg2.register(r2.sc);
  assert.equal(reg2.adopt('starcatch'), true);
  assert.equal(r2.say('a', word), true);
  assert.equal(r2.of('catch').length, 0, 'a already caught this star before the restart');
  assert.equal(r2.say('b', word), true);
  assert.deepEqual(r2.of('catch').map(c => [c.userId, c.rank, c.round]), [['b', 2, 2]]);
  r2.advance(12_000); // the new run's clock restarts, so jump past the saved deadline
  r2.advance(6000);
  r2.advance(6000);
  assert.equal(r2.of('catch-end').length, 1);
  assert.equal(r2.st.starcatch, null);
});
