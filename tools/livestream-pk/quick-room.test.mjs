import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';

test('one viewer gets four stars, a result, then another activity without losing progress', () => {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, onEvent: e => events.push(e), config: { smallRoom: true, acts: true, autoQuiz: false } });
  const user = { userId: 'solo', nickname: 'Solo' };
  game.tick();
  assert.equal(game.state.starcatch, null);
  game.chat({ ...user, comment: 'chào' });
  t += 2500; game.tick();
  assert.equal(game.state.starcatch.rounds, 4);
  assert.equal(game.openChest(), false, 'a chest must not steal the instruction during a short round');
  for (let i = 0; i < 4; i++) {
    game.chat({ ...user, comment: game.state.starcatch.word });
    t += 7000; game.tick();
  }
  assert.equal(game.state.starcatch, null);
  assert.ok(events.some(e => e.type === 'catch-end' && e.top[0]?.userId === 'solo'));
  assert.ok(game.state.viewers.solo.lifetime > 0);
  t += 10000; game.tick();
  assert.ok(game.state.guess);
  assert.equal(game.state.boss, null);
});

test('an abandoned room stops opening automatic activities', () => {
  let t = Date.UTC(2026, 10, 4, 12);
  const game = createGame({ now: () => t, config: { smallRoom: true } });
  game.chat({ userId: 'solo', nickname: 'Solo', comment: 'chào' });
  t += 60000; game.tick();
  assert.equal(game.state.starcatch, null);
  assert.equal(game.state.guess, null);
  assert.equal(game.state.boss, null);
});


test('arrivals expire after 25 seconds, actions after 90, and returning viewers keep progress', () => {
  let t = Date.UTC(2026, 10, 4, 12);
  const game = createGame({ now: () => t });
  const user = { userId: 'visitor', nickname: 'Visitor' };
  game.member(user);
  assert.equal(game.snapshot().stage.length, 1);
  t += 25001; game.tick();
  assert.equal(game.snapshot().stage.length, 0);
  assert.equal(Object.values(game.roster.counts()).reduce((a, b) => a + b, 0), 0);
  game.chat({ ...user, comment: 'chào' });
  const team = game.state.viewers.visitor.team, progress = game.state.viewers.visitor.lifetime;
  t += 90001; game.tick();
  assert.equal(game.snapshot().stage.length, 0);
  assert.equal(game.state.viewers.visitor.team, team);
  assert.equal(game.state.viewers.visitor.lifetime, progress);
  game.like({ ...user, count: 1 });
  assert.equal(game.snapshot().stage[0].team, team);
});

test('one other viewer can complete a welcome in a small room', () => {
  const events = [];
  const game = createGame({ onEvent: e => events.push(e) });
  game.member({ userId: 'new', nickname: 'New' });
  game.chat({ userId: 'host', nickname: 'Host', comment: 'chào' });
  assert.ok(events.some(e => e.type === 'welcome-done' && e.userId === 'new'));
});
