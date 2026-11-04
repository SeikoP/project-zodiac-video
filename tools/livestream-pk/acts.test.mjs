import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTS, HEADS, createActs, headAt } from './acts.mjs';

const MIN = 60000;

test('acts take turns, arena then reunion, five minutes each', () => {
  const a = createActs();
  const first = a.at(0), second = a.at(5 * MIN), third = a.at(10 * MIN);
  assert.equal(first.act.id, 'arena');
  assert.equal(second.act.id, 'reunion');
  assert.equal(third.act.id, 'arena');
  for (const r of [first, second, third]) assert.equal(r.endsAt - r.startsAt, 300000);
  assert.equal(first.startsAt, 0);
  assert.equal(second.startsAt, 5 * MIN);
});

test('any time inside an act belongs to it, and next is the other act', () => {
  const a = createActs();
  const t = 12 * 5 * MIN + 2 * MIN + 17000; // inside the 13th slot (an arena)
  const r = a.at(t);
  assert.equal(r.act.id, 'arena');
  assert.ok(r.startsAt <= t && t < r.endsAt);
  assert.equal(r.next.id, 'reunion');
  assert.equal(a.at(r.endsAt).act.id, 'reunion');
  assert.equal(a.at(r.endsAt - 1).act.id, 'arena');
  assert.equal(a.at(r.endsAt).next.id, 'arena');
});

test('headAt is the middle of the act', () => {
  assert.equal(createActs().headAt(), 2.5);
  assert.equal(createActs({ minutes: 10 }).headAt(), 5);
  assert.equal(headAt('elite', 5), 2.5);
});

test('the minutes option and a custom list change the rotation', () => {
  const acts = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
  const a = createActs({ minutes: 1, acts });
  assert.deepEqual([0, 1, 2, 3].map(n => a.at(n * MIN).act.id), ['x', 'y', 'z', 'x']);
  assert.equal(a.at(0).endsAt - a.at(0).startsAt, 60000);
});

test('the headliners and their labels', () => {
  const [arena, reunion] = ACTS;
  assert.deepEqual(arena.heads, ['elite', 'tug', 'starcatch', 'quizchain']);
  assert.deepEqual(reunion.heads, ['roast', 'guessobject', 'chestrain', 'moonnight', 'final']);
  for (const act of ACTS) {
    assert.ok(act.label && act.color && act.quest.stat);
    for (const id of act.heads) assert.ok(HEADS[id]?.label, id);
  }
  assert.equal(HEADS.tug.label, 'Kéo co 2 phe');
  assert.equal(HEADS.roast.label, 'Vòng quay may mắn');
  assert.equal(HEADS.guessobject.label, 'Đoán vật');
  assert.equal(HEADS.final.label, 'Chung kết đua phe');
});
