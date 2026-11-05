import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';

function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const garden = createGarden({ config, now: () => t, rng: () => 0.5, onEvent: e => events.push(e) });
  const say = (id, comment, nickname = garden.state.users[id]?.nickname ?? id.toUpperCase()) => garden.chat({ userId: id, nickname, avatar: '', comment });
  const advance = ms => { for (let left = ms; left > 0; left -= 500) { t += Math.min(500, left); garden.tick(); } };
  return { garden, events, say, advance, user: id => garden.state.users[id], plot: id => garden.state.plots[`${garden.state.users[id].seat.tier}:${garden.state.users[id].seat.slot}`] };
}

test('any ordinary comment automatically seats a newcomer on a cloud terrace', () => {
  const s = setup();
  s.say('a', 'chào mọi người');
  assert.equal(s.user('a').seat.tier, 'cloud-1');
  assert.equal(s.events[0].type, 'joined');
});

test('a planting command seats the newcomer and runs in the same comment', () => {
  const s = setup();
  s.say('a', 'trồng rau');
  assert.equal(s.user('a').seat !== null, true);
  assert.equal(s.plot('a').crop.type, 'rau', 'a newcomer starts with 20 gold, enough for seeds');
});

test('trồng automatically picks the highest unlocked affordable seed and preserves explicit choices', () => {
  for (const [level, gold, expected] of [[1,20,'rau'],[2,20,'huongduong'],[4,20,'nammay'],[4,9,'huongduong'],[4,4,'rau']]) {
    const s=setup();s.say('a','chào');Object.assign(s.user('a'),{level,gold});
    assert.equal(s.say('a','trồng').ok,true);
    assert.equal(s.plot('a').crop.type,expected);
    assert.match(s.events.findLast(e=>e.type==='action-feedback').message,/Rau|Hướng dương|Nấm mây/);
  }
  const s=setup();s.say('a','chào');Object.assign(s.user('a'),{level:4,gold:0});
  assert.equal(s.say('a','trồng').reason,'gold');assert.equal(s.plot('a').crop,null);
  s.advance(1600);s.plot('a').replantCredit=true;
  assert.equal(s.say('a','trồng').ok,true);assert.equal(s.plot('a').crop.type,'rau');
  const explicit=setup();explicit.say('a','chào');explicit.user('a').level=4;
  assert.equal(explicit.say('a','trồng rau').ok,true);assert.equal(explicit.plot('a').crop.type,'rau');
});

test('a player plants, the crop ripens over time, and hái pays gold and xp', () => {
  const s = setup();
  s.say('a', 'chào');
  s.user('a').gold = 20;
  s.say('a', 'trồng rau');
  assert.equal(s.plot('a').crop.type, 'rau');
  for (let i = 0; i < 37; i++) { s.advance(5000); s.plot('a').water = 1; s.plot('a').lastActive = Date.UTC(2026, 10, 4, 12) + (i + 1) * 5000; }
  s.advance(1000);
  s.say('a', 'hái');
  assert.equal(s.plot('a').crop, null);
  assert.ok(s.user('a').gold >= 16 + 10 - 1);
  assert.equal(s.user('a').xp, 5);
});

test('commands are rate limited to one care action per 1500ms', () => {
  const s = setup();
  s.say('a', 'chào');
  s.user('a').gold = 20;
  s.say('a', 'trồng rau');
  s.say('a', 'tưới');
  const water1 = s.plot('a').crop.progress;
  s.say('a', 'tưới');
  assert.equal(s.plot('a').crop.progress, water1);
});

test('tưới @tên helps the named neighbour; an ambiguous name does nothing', () => {
  const s = setup();
  s.say('a', 'chào', 'Lan An'); s.say('b', 'chào', 'Lan Anh'); s.say('c', 'chào', 'Mai');
  s.user('c').gold = 20; s.say('c', 'trồng rau');
  s.say('a', 'tưới @mai');
  assert.equal(s.user('c').xp, 2);
  s.advance(40_000);
  s.say('c', 'tưới @lan');
  assert.equal(s.user('a').xp, 2, 'two Lans: no change');
});

test('trộm @unknown does not steal from anyone', () => {
  const s = setup();
  s.say('a', 'chào'); s.say('b', 'chào');
  s.user('b').level = 3; s.user('b').gold = 20; s.say('b', 'trồng rau');
  s.plot('b').crop.progress = 1; s.plot('b').crop.ripeAt = Date.UTC(2026, 10, 4, 12);
  s.user('a').level = 3;
  s.say('a', 'trộm @ghost');
  assert.equal(s.plot('b').crop.stolen, 0);
  assert.equal(s.user('a').gold, 20, 'nothing was stolen');
});

test('a gift acts on the garden and never pays gold', () => {
  const s = setup();
  s.say('a', 'chào');
  s.garden.gift({ userId: 'a', nickname: 'A', avatar: '', diamonds: 10, count: 1 });
  assert.equal(s.events.at(-1).type, 'gift');
  assert.equal(s.user('a').gold, 20, 'a gift does not pay gold');
});

test('likes only change hearts and do not seat users', () => {
  const s = setup();
  const before = JSON.stringify(s.garden.state);
  s.garden.like({ userId: 'z', count: 5 });
  s.garden.social({ userId: 'z', kind: 'follow' });
  assert.notEqual(JSON.stringify(s.garden.state), before);
  assert.equal(Object.keys(s.garden.state.users).length, 0);
  assert.equal(s.garden.state.hearts.total, 5);
});

test('changes() sends everything first, then only plots that changed', () => {
  const s = setup();
  s.say('a', 'chào'); s.say('b', 'chào');
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

test('a viewer who cannot get a plot when the Seed Zone is full of crops leaves no record behind', () => {
  const s = setup({ activeCapacity: 2 });
  s.say('p0','trồng rau'); s.advance(2000); s.say('p1','trồng rau');
  assert.equal(Object.values(s.garden.state.users).filter(u=>u.seat).length,2);
  s.advance(2000); s.say('late','trồng rau');
  assert.equal(s.garden.state.users.late,undefined);
});


test('ordinary chat wakes a sleeping player and inactivity eventually frees the visible pot', () => {
  const s = setup({ sleepAfterMs: 100, evictAfterMs: 400 });
  s.say('a', 'xin chào');
  const id = s.plot('a').id;
  s.advance(150);
  assert.equal(s.garden.state.plots[id].sleeping, true);
  s.say('a', 'tôi vẫn ở đây');
  assert.equal(s.garden.state.plots[id].sleeping, false);
  s.advance(450);
  assert.equal(s.user('a').seat, null);
  assert.equal(s.garden.state.plots[id].owner, null);
});

test('new care commands add decisions beyond water and harvest', () => {
  const s = setup();
  s.say('a', 'trồng rau');
  s.advance(2000);
  assert.equal(s.say('a', 'bón phân').ok, true);
  s.plot('a').crop.weeds = true;
  s.advance(2000);
  assert.equal(s.say('a', 'nhổ cỏ').ok, true);
});

test('view data exposes pot tier and crop visual state', () => {
  const s = setup();
  s.say('a', 'trồng rau');
  s.user('a').level = 7;
  const seen = {};
  const first = s.garden.changes(seen);
  const plot = first.plots[s.plot('a').id];
  assert.equal(plot.potTier, 'royal');
  assert.equal(plot.crop.variant, 'common');
  assert.equal(plot.crop.fertilized, false);
  assert.deepEqual(plot.owner.competition,s.garden.competition.profile(s.user('a')));
  assert.equal(plot.owner.competition.points,2);
});

test('meta exposes the two-wing rack geometry required by the browser renderer', () => {
  const s = setup();
  const cfg = s.garden.meta().cfg;
  assert.deepEqual([cfg.rackWings, cfg.shelvesPerWing, cfg.rackWingGapX], [2, 7, 166]);
});

test('pest mention routes to the neighbor and syncs the changed plot',()=>{
 const s=setup();s.say('a','trồng rau');s.say('b','trồng rau');
 s.plot('b').crop.pest=true;const seen={};s.garden.changes(seen);
 s.advance(1600);const result=s.say('a','bắt sâu @b');
 assert.equal(result.ok,true);assert.equal(s.plot('b').crop.pest,false);
 assert.equal(s.garden.changes(seen).plots[s.plot('b').id].crop.pest,false);
 assert.equal(s.plot('a').crop.type,'rau');
});
