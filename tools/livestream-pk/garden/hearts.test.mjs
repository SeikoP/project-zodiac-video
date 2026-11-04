import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';

const setup = () => {
  let now = 1_000_000;
  const events = [];
  const garden = createGarden({ now: () => now, rng: () => 0, onEvent: e => events.push(e) });
  const step = ms => { now += ms; garden.tick(); };
  return { garden, events, step };
};

test('likes without chat never create a pot or change user state', () => {
  const { garden } = setup();
  assert.equal(garden.like({ userId: 'spectator', count: 50 }).ok, true);
  assert.equal(Object.keys(garden.state.users).length, 0);
  assert.equal(Object.keys(garden.state.plots).length, 0);
});

test('heart milestones rotate care, community, luck and then care', () => {
  const { garden, events } = setup();
  garden.chat({ userId: 'owner', nickname: 'Owner', comment: 'trồng rau' });
  const plot = Object.values(garden.state.plots)[0];
  const initial = plot.crop.progress;
  garden.like({ count: 100 });
  assert.ok(plot.crop.progress > initial);
  assert.equal(garden.state.hearts.step, 1);
  garden.like({ count: 400 });
  assert.equal(garden.state.hearts.step, 2);
  const oldGold = garden.state.users.owner.gold;
  garden.like({ count: 500 });
  assert.equal(garden.state.users.owner.gold, oldGold + 2);
  assert.equal(garden.state.hearts.step, 0);
  assert.deepEqual(events.filter(e => e.type === 'heart-milestone').map(e => e.kind), ['care','community','luck']);
});

test('large likes bursts drain one milestone per tick with no overflow spam', () => {
  const { garden, events, step } = setup();
  garden.like({ count: 1000 });
  assert.equal(events.filter(e => e.type === 'heart-milestone').length, 1);
  step(1000); step(1000);
  assert.equal(events.filter(e => e.type === 'heart-milestone').length, 3);
  assert.equal(garden.state.hearts.step, 0);
});

test('heart progress is capped to ten percent per growing crop', () => {
  const { garden } = setup();
  garden.chat({ userId: 'owner', nickname: 'Owner', comment: 'trồng rau' });
  const plot = Object.values(garden.state.plots)[0];
  for (let i = 0; i < 12; i++) {
    garden.like({ count: 1000 });
    for (let n = 0; n < 3; n++) garden.tick();
  }
  assert.ok(plot.crop.heartBonus <= .1 + 1e-9);
  assert.ok(plot.crop.progress < 1);
});

test('malformed like counts do not mutate state', () => {
  const { garden } = setup();
  for (const count of [-1, Infinity, NaN, 'oops']) {
    assert.equal(garden.like({ count }).ok, false);
  }
  assert.equal(garden.state.hearts, null);
});
