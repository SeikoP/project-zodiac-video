import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_XP, levelOf, addXp, addGold, spendGold } from './progress.mjs';

test('levelOf walks the XP table and caps at 10', () => {
  assert.deepEqual([0, 29, 30, 89, 90, 3000, 1e9].map(levelOf), [1, 1, 2, 2, 3, 10, 10]);
  assert.equal(LEVEL_XP.length, 10);
});

test('addXp reports a level up exactly when a threshold is crossed', () => {
  const u = { xp: 29, level: 1 };
  assert.deepEqual(addXp(u, 2), { level: 2, leveledUp: true });
  assert.equal(u.level, 2);
  assert.equal(addXp(u, 1).leveledUp, false);
});

test('spendGold refuses what the player does not have', () => {
  const u = { gold: 5 };
  assert.equal(spendGold(u, 6), false);
  assert.equal(u.gold, 5);
  assert.equal(spendGold(u, 5), true);
  addGold(u, 3);
  assert.equal(u.gold, 3);
});
