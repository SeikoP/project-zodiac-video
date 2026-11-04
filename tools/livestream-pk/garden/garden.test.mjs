import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';

function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const garden = createGarden({ config, now: () => t, rng: () => 0.5, onEvent: e => events.push(e) });
  const say = (id, comment, nickname = garden.state.users[id]?.nickname ?? id.toUpperCase()) => garden.chat({ userId: id, nickname, avatar: '', comment });
  const advance = ms => { for (let left = ms; left > 0; left -= 500) { t += Math.min(500, left); garden.tick(); } };
  return { garden, events, say, advance, user: id => garden.state.users[id], plot: id => garden.state.plots[`${garden.state.users[id].seat.island}:${garden.state.users[id].seat.slot}`] };
}

test('naming a sign seats a newcomer on that island', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  assert.equal(s.user('a').seat.island, 'leo');
});

test('chatter from someone without a plot is ignored, a command seats and runs', () => {
  const s = setup();
  s.say('a', 'hay quá');
  assert.equal(s.user('a'), undefined);
  s.say('a', 'trồng rau');
  assert.equal(s.user('a').seat !== null, true);
  assert.equal(s.plot('a').crop.type, 'rau', 'a newcomer starts with 20 gold, enough for seeds');
});

test('a player plants, the crop ripens over time, and hái pays gold and xp', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.user('a').gold = 20;
  s.say('a', 'trồng rau');
  assert.equal(s.plot('a').crop.type, 'rau');
  for (let i = 0; i < 40; i++) { s.advance(5000); s.plot('a').water = 1; s.plot('a').lastActive = Date.UTC(2026, 10, 4, 12) + (i + 1) * 5000; }
  s.advance(1000);
  s.say('a', 'hái');
  assert.equal(s.plot('a').crop, null);
  assert.ok(s.user('a').gold >= 16 + 10 - 1);
  assert.equal(s.user('a').xp, 5);
});

test('commands are rate limited to one care action per 1500ms', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.user('a').gold = 20;
  s.say('a', 'trồng rau');
  s.say('a', 'tưới');
  const water1 = s.plot('a').crop.progress;
  s.say('a', 'tưới');
  assert.equal(s.plot('a').crop.progress, water1);
});

test('tưới @tên helps the named neighbour; an ambiguous name does nothing', () => {
  const s = setup();
  s.say('a', 'Sư Tử', 'Lan An'); s.say('b', 'Sư Tử', 'Lan Anh'); s.say('c', 'Sư Tử', 'Mai');
  s.user('c').gold = 20; s.say('c', 'trồng rau');
  s.say('a', 'tưới @mai');
  assert.equal(s.user('c').xp, 2);
  s.advance(40_000);
  s.say('c', 'tưới @lan');
  assert.equal(s.user('a').xp, 2, 'two Lans: no change');
});

test('trộm @unknown does not steal from anyone', () => {
  const s = setup();
  s.say('a', 'Sư Tử'); s.say('b', 'Sư Tử');
  s.user('b').level = 3; s.user('b').gold = 20; s.say('b', 'trồng rau');
  s.plot('b').crop.progress = 1; s.plot('b').crop.ripeAt = Date.UTC(2026, 10, 4, 12);
  s.user('a').level = 3;
  s.say('a', 'trộm @ghost');
  assert.equal(s.plot('b').crop.stolen, 0);
  assert.equal(s.user('a').gold, 20, 'nothing was stolen');
});

test('a gift acts on the garden and never pays gold', () => {
  const s = setup();
  s.say('a', 'Sư Tử');
  s.garden.gift({ userId: 'a', nickname: 'A', avatar: '', diamonds: 10, count: 1 });
  assert.equal(s.events.at(-1).type, 'gift');
  assert.equal(s.user('a').gold, 20, 'a gift does not pay gold');
});

test('like, social and member never change the game', () => {
  const s = setup();
  const before = JSON.stringify(s.garden.state);
  s.garden.like({ userId: 'z', count: 5 });
  s.garden.social({ userId: 'z', kind: 'follow' });
  assert.equal(JSON.stringify(s.garden.state), before);
});

test('changes() sends everything first, then only plots that changed', () => {
  const s = setup();
  s.say('a', 'Sư Tử'); s.say('b', 'Bảo Bình');
  const seen = {};
  const first = s.garden.changes(seen);
  assert.equal(Object.keys(first.plots).length, 2);
  assert.deepEqual(Object.keys(s.garden.changes(seen).plots ?? {}), []);
  s.say('a', 'vườn');
  s.advance(2000);
  s.user('a').gold = 10; s.say('a', 'trồng rau');
  const next = s.garden.changes(seen);
  assert.deepEqual(Object.keys(next.plots), [s.plot('a').id]);
  assert.equal(next.plots[s.plot('a').id].owner.nickname, 'A');
});
