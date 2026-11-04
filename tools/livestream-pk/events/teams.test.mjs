import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, TEAM_IDS, parseTeam, parseSwitchTeam } from './teams.mjs';

test('four teams in fixed order', () => {
  assert.deepEqual(TEAM_IDS, ['red', 'yellow', 'green', 'blue']);
  assert.equal(TEAMS.length, 4);
  for (const t of TEAMS) assert.ok(t.label && t.color && t.glyph);
});

test('parseTeam reads a whole-sentence team name or digit', () => {
  assert.equal(parseTeam('đỏ'), 'red');
  assert.equal(parseTeam('Xanh lá'), 'green');
  assert.equal(parseTeam('phe xanh duong'), 'blue');
  assert.equal(parseTeam('3'), 'green');
  assert.equal(parseTeam('5'), null);
  assert.equal(parseTeam('do an gi'), null);
  assert.equal(parseTeam('cho do vao day'), null);
  assert.equal(parseTeam('xanh'), null);
});

test('parseSwitchTeam needs a switch word or a bare colour name', () => {
  assert.equal(parseSwitchTeam('đổi vàng'), 'yellow');
  assert.equal(parseSwitchTeam('đổi sang 2'), 'yellow');
  assert.equal(parseSwitchTeam('chuyển qua phe xanh lá'), 'green');
  assert.equal(parseSwitchTeam('xanh dương'), 'blue');
  assert.equal(parseSwitchTeam('2'), null);
  assert.equal(parseSwitchTeam('do an gi'), null);
});
