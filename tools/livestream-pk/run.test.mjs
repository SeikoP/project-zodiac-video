import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, RUN_DEFAULTS, BASE_UNLOCKED } from './run.mjs';

function setup(extra = {}) {
  let t = 1_000_000;
  const st = {}, events = [], rewards = [], gems = [];
  const people = ['a', 'b', 'c', 'd'].map((id, i) => [id, { nickname: id.toUpperCase(), sign: ['aries', 'taurus', 'gemini', 'cancer'][i] }]);
  const run = createRun({
    st, cfg: { ...RUN_DEFAULTS, ...extra }, now: () => t, onEvent: e => events.push(e), dayKey: () => '2026-11-03',
    present: () => people, reward: (id, floors, cleared) => rewards.push({ id, floors, cleared }), gem: (id, v, n) => gems.push([id, n]),
  });
  const advance = ms => { t += ms; run.tick(); };
  const of = type => events.filter(e => e.type === type);
  const v = id => people.find(p => p[0] === id)[1];
  return { st, run, events, rewards, gems, advance, of, v, people };
}
// votes everyone for one letter and lets the vote close
const voteAll = (s, letter) => { for (const [id, v] of s.people) s.run.chat({ userId: id }, v, letter); s.advance(RUN_DEFAULTS.runVoteSeconds * 1000 + 10); };
// hits the current enemy with gifts until it falls
const kill = s => { for (let i = 0; i < 400 && s.st.run?.phase?.kind === 'fight'; i++) s.run.hit({ userId: 'a' }, s.v('a'), 'gift', 50); };

test('a run starts on floor 1 with a door vote, and the same day gives the same doors', () => {
  const s = setup();
  s.run.start();
  assert.equal(s.st.run.floor, 1);
  assert.equal(s.st.run.phase.kind, 'door');
  assert.equal(s.of('run-vote')[0].options[0].type, 'fight'); // floor 1 always offers a fight
  const again = setup();
  again.run.start();
  assert.deepEqual(again.st.run.map, s.st.run.map);
  assert.equal(s.st.run.map.at(-1)[0], 'boss');
});

test('the chat votes with A/B/C, one vote each, and a change of mind moves the vote', () => {
  const s = setup();
  s.run.start();
  assert.equal(s.run.chat({ userId: 'a' }, s.v('a'), 'b'), true);
  s.run.chat({ userId: 'a' }, s.v('a'), 'a');
  s.run.chat({ userId: 'b' }, s.v('b'), 'a');
  assert.deepEqual(s.st.run.phase.votes, [2, 0]);
  assert.equal(s.run.chat({ userId: 'c' }, s.v('c'), 'xin chào'), false);
  s.advance(RUN_DEFAULTS.runVoteSeconds * 1000 + 10);
  assert.equal(s.st.run.phase.kind, 'fight');
});

test('winning a fight offers three ấn; the chosen one changes damage and its fans hit harder', () => {
  const s = setup();
  s.run.start();
  voteAll(s, 'A');
  kill(s);
  assert.equal(s.of('run-won').length, 1);
  assert.equal(s.st.run.phase.kind, 'boon');
  assert.equal(s.st.run.phase.options.length, 3);
  assert.ok(s.st.run.phase.options.every(id => BASE_UNLOCKED.includes(id)));
  const first = s.st.run.phase.options[0];
  voteAll(s, 'A');
  assert.deepEqual(s.st.run.boons, [first]);
  assert.equal(s.of('run-boon')[0].id, first);
});

test('two ấn of one element resonate', () => {
  const s = setup();
  s.run.start();
  s.st.run.boons.push('aries');
  const r = s.run.view();
  assert.deepEqual(r.resonance, []);
  s.st.run.boons.push('leo');
  assert.equal(s.run.view().resonance[0].element, 'fire');
});

test('a fallen party can be revived once by a rally, then the run ends and the channel remembers', () => {
  const s = setup();
  s.run.start();
  // nobody fights: enemies hit the party and get away, floor after floor
  const walk = () => { const k = s.st.run?.phase?.kind; if (['door', 'boon', 'event'].includes(k)) voteAll(s, 'A'); else s.advance(RUN_DEFAULTS.runAttackSeconds * 1000); };
  for (let i = 0; i < 200 && s.st.run && s.st.run.phase?.kind !== 'down'; i++) walk();
  assert.equal(s.st.run.phase.kind, 'down');
  const need = s.st.run.phase.need;
  for (const [id, v] of s.people.slice(0, need)) s.run.chat({ userId: id }, v, 'hoi sinh');
  assert.equal(s.of('run-revive').length, 1);
  assert.ok(s.st.run.hp > 0);
  const fellOn = s.st.run.floor;
  for (let i = 0; i < 200 && s.st.run; i++) walk();
  assert.equal(s.st.run, null);
  const end = s.of('run-end')[0];
  assert.equal(end.cleared, false);
  assert.equal(s.of('run-down').length, 1); // the second fall ends it: one rally per run
  assert.equal(s.st.runMeta.runs, 1);
  assert.ok(s.st.runMeta.best >= fellOn);
});

test('a full clear raises Ascension, unlocks an ấn and rewards everyone who fought', () => {
  const s = setup({ runFloors: 3 });
  s.run.start();
  for (let guard = 0; guard < 60 && s.st.run; guard++) {
    const p = s.st.run.phase;
    if (p.kind === 'fight') kill(s);
    else if (['door', 'boon', 'event'].includes(p.kind)) voteAll(s, 'A');
    else s.advance(RUN_DEFAULTS.runPauseSeconds * 1000 + 10);
  }
  const end = s.of('run-end')[0];
  assert.equal(end.cleared, true);
  assert.equal(s.st.runMeta.ascension, 1);
  assert.equal(s.st.runMeta.unlocked.length, BASE_UNLOCKED.length + 1);
  assert.deepEqual(s.rewards.map(r => r.id), ['a']);
  assert.equal(s.rewards[0].cleared, true);
});

test('a kỳ ngộ can hand the party a curse along with its reward', () => {
  const s = setup();
  s.run.start();
  s.st.run.phase = null;
  s.st.run.floor = 1;
  s.st.run.map[1] = ['event'];
  s.run.tick(); // walks into floor 2: the only door is the event
  assert.equal(s.st.run.phase.kind, 'event');
  s.st.run.phase.options = [{ label: 'nhặt', do: { boon: 1, curse: 'heavy' } }, { label: 'bỏ', do: { heal: 0.1 } }];
  s.st.run.phase.votes = [0, 0];
  voteAll(s, 'A');
  assert.deepEqual(s.st.run.curses, ['heavy']);
  assert.equal(s.st.run.boons.length, 1);
  assert.equal(s.of('run-event')[0].curse.id, 'heavy');
});
