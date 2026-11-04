import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { steal, catchThief, dog, tickSteal } from './steal.mjs';

// a thief and a victim on one island; the victim's rau is ripe (10 gold), both are level 3 so no newcomer shield
function scene() {
  const k = makeCtx();
  const thief = addUser(k.ctx, 'thief', { gold: 0, level: 3 }), vic = addUser(k.ctx, 'vic', { gold: 100, level: 3 });
  const ripen = () => { vic.plot.crop = { type: 'rau', progress: 1, ripeAt: k.ctx.now(), pest: false, stolen: 0 }; };
  ripen();
  const wake = () => { vic.plot.lastActive = thief.plot.lastActive = k.ctx.now(); };
  return { ...k, thief, vic, ripen, wake };
}

test('stealing takes 20% (at least 1 gold) from a ripe crop and leaves the rest', () => {
  const s = scene();
  const r = steal(s.ctx, s.thief.user, s.vic.user);
  assert.deepEqual([r.ok, r.amount, s.thief.user.gold, s.vic.plot.crop.stolen], [true, 2, 2, 1]);
  assert.equal(s.events.at(-1).type, 'steal');
});

test('refuses: self, unripe, newcomer shield, asleep', () => {
  const s = scene();
  assert.equal(steal(s.ctx, s.vic.user, s.vic.user).reason, 'self');
  s.vic.plot.crop.progress = 0.5;
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'not-ripe');
  s.vic.plot.crop.progress = 1;
  s.vic.user.level = 2;
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'shield');
  s.vic.user.level = 3;
  s.advance(301_000);
  s.thief.plot.lastActive = s.ctx.now();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'asleep');
  assert.equal(s.thief.user.gold, 0);
});

test('a crop can be stolen from twice per harvest; the 20s cooldown applies in between', () => {
  const s = scene();
  s.vic.user.level = 3;
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).ok, true);
  s.vic.plot.shieldUntil = 0;
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'cooldown');
  s.advance(21_000); s.wake();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).ok, true);
  s.vic.plot.shieldUntil = 0;
  s.advance(21_000); s.wake(); s.vic.plot.crop.ripeAt = s.ctx.now();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'cap');
});

test('one thief gets at most 3 thefts per victim per 10 minutes', () => {
  const s = scene();
  for (let i = 0; i < 3; i++) {
    s.ripen(); s.vic.plot.shieldUntil = 0; s.vic.user.stolenLog = [];
    s.advance(21_000); s.wake(); s.vic.plot.crop.ripeAt = s.ctx.now();
    assert.equal(steal(s.ctx, s.thief.user, s.vic.user).ok, true);
  }
  s.ripen(); s.vic.plot.shieldUntil = 0; s.vic.user.stolenLog = [];
  s.advance(21_000); s.wake(); s.vic.plot.crop.ripeAt = s.ctx.now();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'cap');
});

test('catching the thief within 10s returns the gold, restores the crop and bans the thief for 60s', () => {
  const s = scene();
  steal(s.ctx, s.thief.user, s.vic.user);
  s.advance(5000);
  assert.equal(catchThief(s.ctx, s.vic.user).ok, true);
  assert.deepEqual([s.thief.user.gold, s.vic.plot.crop.stolen, s.vic.user.stats.caught], [0, 0, 1]);
  s.advance(21_000); s.wake(); s.vic.plot.crop.ripeAt = s.ctx.now();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'banned');
  s.advance(40_000); s.wake(); s.vic.plot.crop.ripeAt = s.ctx.now();
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).ok, true);
});

test('a catch after 10s is too late', () => {
  const s = scene();
  steal(s.ctx, s.thief.user, s.vic.user);
  s.advance(10_001);
  tickSteal(s.ctx);
  assert.equal(catchThief(s.ctx, s.vic.user).reason, 'no-thief');
  assert.equal(s.ctx.state.thefts.length, 0);
});

test('a dog stops the theft for free and barks', () => {
  const s = scene();
  assert.equal(dog(s.ctx, s.vic.user).free, true);
  const r = steal(s.ctx, s.thief.user, s.vic.user);
  assert.equal(r.reason, 'dog');
  assert.equal(s.thief.user.gold, 0);
  assert.equal(s.events.at(-1).type, 'dog-bark');
});

test('the dog is free once a night, then costs 30 gold; it needs the gold', () => {
  const s = scene();
  assert.equal(dog(s.ctx, s.vic.user).free, true);
  s.advance(600_001);
  s.vic.user.gold = 29;
  assert.equal(dog(s.ctx, s.vic.user).reason, 'gold');
  s.vic.user.gold = 30;
  assert.deepEqual([dog(s.ctx, s.vic.user).ok, s.vic.user.gold], [true, 0]);
});

test('two thefts within 3 minutes put the plot under a 3 minute shield', () => {
  const s = scene();
  const second = addUser(s.ctx, 'thief2', { level: 3 });
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).ok, true);
  assert.equal(steal(s.ctx, second.user, s.vic.user).ok, true);
  assert.equal(s.vic.plot.shieldUntil, s.ctx.now() + 180_000);
  s.vic.plot.crop.stolen = 0;
  assert.equal(steal(s.ctx, s.thief.user, s.vic.user).reason, 'shield');
});

test('stealing with no name picks a ripe awake plot on the thief island, or reports none', () => {
  const s = scene();
  assert.equal(steal(s.ctx, s.thief.user, null).victimId, 'vic');
  s.advance(21_000); s.wake();
  s.vic.plot.crop = null;
  assert.equal(steal(s.ctx, s.thief.user, null).reason, 'no-target');
});
