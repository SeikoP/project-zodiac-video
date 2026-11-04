import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';
import { ACTS, HEADS } from './acts.mjs';

const MIN = 60000, SLOT = 5 * MIN;
// Slot n belongs to ACTS[n % 2]. Slot 14000 is an arena whose visit number is 7000 (a multiple of 4 and of 5),
// so its headliners are the first of each list.
const slotOf = (act, visit) => 2 * (7000 + visit) + (act === 'reunion' ? 1 : 0);
const at = (act, minute = 1, visit = 0) => slotOf(act, visit) * SLOT + minute * MIN;

function setup(act, config = {}, minute = 1, visit = 0) {
  let t = at(act, minute, visit);
  const events = [];
  const game = createGame({
    config: { smallRoom: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false, ...config },
    now: () => t, rng: () => 0.3, onEvent: e => events.push(e),
  });
  const advance = ms => { for (let left = ms; left > 0; left -= 1000) { t += Math.min(1000, left); game.tick(); } };
  const crowd = () => { for (const [i, s] of ['đỏ', 'vàng', 'xanh lá', 'xanh dương'].entries()) game.chat({ userId: `u${i}`, nickname: `U${i}`, comment: s }); };
  return { game, events, advance, crowd, of: type => events.filter(e => e.type === type), now: () => t };
}

test('the first minute of an act announces it once, with the act that comes next', () => {
  const s = setup('arena', {}, 4.9);
  s.crowd();
  s.advance(5_000);
  s.events.length = 0;
  s.advance(20_000);
  const opens = s.of('act-open');
  assert.equal(opens.length, 1);
  assert.equal(opens[0].id, 'reunion');
  assert.equal(opens[0].next.id, 'arena');
  const view = s.game.snapshot().cosmos.act;
  assert.equal(view.id, 'reunion');
  assert.equal(view.endsAt - view.startsAt, SLOT);
});

test('minute 2.5 of an act brings its headliner: an elite boss in the arena', () => {
  const s = setup('arena', {}, 2.4);
  s.crowd();
  s.advance(15_000);
  const head = s.of('head-start');
  assert.equal(head.length, 1);
  assert.equal(head[0].id, 'elite');
  assert.equal(head[0].act, 'arena');
  assert.equal(s.game.state.boss.elite, true);
});

test('Đoán vật opens the reunion act as a headliner', () => {
  const s = setup('reunion', {}, 2.4, 1);
  s.crowd();
  s.advance(15_000);
  assert.equal(s.of('head-start')[0].id, 'guessobject');
  assert.ok(s.game.state.guess);
  assert.ok(s.game.state.head);
});

test('hứng sao băng plays at mid-act, and typing the falling word catches it', () => {
  const s = setup('arena', {}, 2.45, 2);
  s.crowd();
  s.advance(5_000);
  const [star] = s.of('catch-star');
  assert.ok(star);
  s.game.chat({ userId: 'u0', nickname: 'U0', comment: star.word });
  assert.equal(s.of('catch').length, 1);
  assert.ok(s.game.snapshot().cosmos.starcatch);
});

test('the act closes with its MVP and the headliner ends', () => {
  const s = setup('arena', {}, 4.1, 3); // quizchain
  s.advance(1_000); // the act begins first
  s.crowd();
  s.game.chat({ userId: 'u2', nickname: 'U2', comment: 'mình góp nè' });
  s.advance(10_000);
  const close = s.of('act-close');
  assert.equal(close.length, 1);
  assert.ok(close[0].top[0].nickname);
  assert.equal(close[0].next.label, 'Hội ngộ');
  assert.equal(s.game.state.head, null);
  assert.ok(s.game.state.viewers[close[0].top[0].userId].bag.dust >= 10, 'the act MVP takes home some Điểm sáng');
  assert.ok(s.game.state.viewers[close[0].top[0].userId].titles.some(t => /^MVP Màn .+ ×1$/.test(t)), 'and an MVP title for the act');
});

test('acts: false leaves everything on and no act running', () => {
  const off = setup('arena', { acts: false });
  assert.equal(off.game.snapshot().cosmos.act, null);
  assert.equal(off.game.startHead(), null);
});

test('nhiệm vụ Màn: the room fills the act\'s goal by taking part and everyone on stage is rewarded', () => {
  const s = setup('arena');
  s.crowd();
  s.advance(2_000);
  const q = s.game.snapshot().cosmos.quest;
  assert.equal(q.unit, 'bình luận');
  assert.equal(q.got, 0);
  // one comment each counts (a viewer's comments only count every few seconds, so spamming doesn't fill it)
  for (let i = 0; i < q.goal; i++) s.game.chat({ userId: `n${i}`, nickname: `N${i}`, comment: 'đỏ' });
  const done = s.of('quest-done');
  assert.equal(done.length, 1);
  assert.ok(done[0].people >= 4);
  const gems = b => b.red + b.yellow + b.green + b.blue;
  assert.ok(gems(s.game.state.viewers[`n${q.goal - 1}`].bag) >= 1);
  s.game.chat({ userId: 'late', nickname: 'Late', comment: 'đỏ' });
  assert.equal(s.of('quest-done').length, 1); // once per act
});

test('the acts take turns every five minutes and an act\'s headliner moves on each time it comes round', () => {
  const heads = [];
  for (let visit = 0; visit < 2; visit++) {
    const game = createGame({ config: { smallRoom: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false }, now: () => at('arena', 1, visit), rng: () => 0.3, onEvent: () => {} });
    const view = game.snapshot().cosmos.act;
    assert.equal(view.id, 'arena');
    assert.equal(view.next.id, 'reunion');
    assert.equal(view.endsAt - view.startsAt, SLOT);
    heads.push(view.headLabel);
  }
  assert.notEqual(heads[0], heads[1]);
});

test('every headliner belongs to exactly one act and each comes round within 40 acts', () => {
  const used = ACTS.flatMap(a => a.heads);
  assert.deepEqual([...used].sort(), Object.keys(HEADS).sort());
  assert.equal(new Set(used).size, used.length);
  const seen = new Set();
  for (let n = 0; n < 40; n++) {
    const game = createGame({ config: { smallRoom: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false }, now: () => (14000 + n) * SLOT + 1000, rng: () => 0.3, onEvent: () => {} });
    seen.add(game.snapshot().cosmos.act.headLabel);
  }
  assert.deepEqual([...seen].sort(), Object.values(HEADS).map(h => h.label).sort());
});

test('the quest follows a headliner that has its own goal: catches in hứng sao băng, right answers in a quiz chain', () => {
  for (const [act, visit, head, unit] of [['arena', 0, 'elite', 'bình luận'], ['arena', 2, 'starcatch', 'sao băng hứng được'], ['arena', 3, 'quizchain', 'câu trả lời đúng'], ['reunion', 1, 'guessobject', 'câu trả lời đúng']]) {
    const game = createGame({ config: { smallRoom: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false }, now: () => at(act, 1, visit), rng: () => 0.3, onEvent: () => {} });
    game.chat({ userId: 'a', nickname: 'A', comment: 'đỏ' });
    game.tick();
    const { act: view, quest } = game.snapshot().cosmos;
    assert.equal(view.headLabel, HEADS[head].label, head);
    assert.equal(quest?.unit, unit, head);
  }
});
