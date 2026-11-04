import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, MIN_TEAM_SIZE } from './roster.mjs';

function make(dist) {
  const viewers = {};
  const stage = new Map();
  let n = 0;
  for (const [team, c] of Object.entries(dist)) for (let i = 0; i < c; i++) { const id = `u${n++}`; viewers[id] = { team }; stage.set(id, true); }
  return { viewers, stage, roster: createRoster({ viewers, stage }) };
}

test('counts follow the stage, not all viewers', () => {
  const { viewers, roster } = make({ red: 2, blue: 1 });
  viewers.off = { team: 'green' };
  assert.deepEqual(roster.counts(), { red: 2, yellow: 0, green: 0, blue: 1 });
  assert.equal(roster.teamOf('off'), 'green');
  assert.equal(roster.teamOf('nobody'), null);
  assert.equal(roster.present('red').length, 2);
  assert.equal(roster.present().length, 3);
});

test('leastTeam breaks ties by light then TEAMS order', () => {
  const { roster } = make({ red: 1, yellow: 1, green: 1, blue: 1 });
  assert.equal(roster.leastTeam(), 'red');
  assert.equal(roster.leastTeam({ red: 5, yellow: 3, green: 1, blue: 1 }), 'green');
  const b = make({ red: 2, yellow: 2, green: 2, blue: 1 });
  assert.equal(b.roster.leastTeam({ blue: 99 }), 'blue');
});

test('place redirects a newcomer away from an oversized team', () => {
  const a = make({ red: 5, yellow: 2, green: 2, blue: 2 });
  const r = a.roster.place('red');
  assert.equal(r.redirected, true);
  assert.notEqual(r.team, 'red');
  const b = make({ red: 3, yellow: 2, green: 2, blue: 2 });
  assert.deepEqual(b.roster.place('red'), { team: 'red', redirected: false });
  assert.deepEqual(b.roster.place(null), { team: 'yellow', redirected: false });
});

test('a crowded team needs at least MIN_TEAM_SIZE people: a fresh room lets friends share a colour', () => {
  assert.equal(MIN_TEAM_SIZE, 3);
  const keep = (dist, want = 'red') => assert.deepEqual(make(dist).roster.place(want), { team: want, redirected: false }, JSON.stringify(dist));
  keep({ red: 1 });
  keep({ red: 2 });
  keep({ red: 3, yellow: 2, green: 2, blue: 2 });
  const moved = make({ red: 3 }).roster.place('red');
  assert.equal(moved.redirected, true);
  assert.equal(moved.team, 'yellow');
  const big = make({ red: 5, yellow: 2, green: 2, blue: 2 }).roster.place('red');
  assert.equal(big.redirected, true);
});

test('100 newcomers all asking for red stay balanced', () => {
  const { viewers, stage, roster } = make({});
  for (let i = 0; i < 100; i++) {
    const { team } = roster.place('red');
    viewers[`n${i}`] = { team };
    stage.set(`n${i}`, true);
  }
  const c = Object.values(roster.counts());
  assert.equal(c.reduce((a, b) => a + b, 0), 100);
  assert.ok(Math.max(...c) <= 2 * Math.min(...c) + 2);
});
