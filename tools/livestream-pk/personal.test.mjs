import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseAction } from './game.mjs';

function setup(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, luckyEverySeconds: 1e9, adaptiveCrowd: false, checkinPerNight: 0, ...config }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  const say = (id, comment) => game.chat({ userId: id, nickname: id.toUpperCase(), comment });
  const advance = ms => { t += ms; game.tick(); };
  return { game, events, say, advance, of: type => events.filter(e => e.type === type), v: id => game.state.viewers[id] };
}

test('"hồ sơ" shows the card once per 30 seconds per person', () => {
  for (const c of ['hồ sơ', 'ho so', 'xem hồ sơ']) assert.equal(parseAction(c), 'profile', c);
  assert.equal(parseAction('hồ sơ xin việc của tôi hay lắm nhé'), null);
  const s = setup();
  s.say('a', 'đỏ');
  s.say('b', 'xanh dương');
  s.say('a', 'hồ sơ');
  s.say('a', 'hồ sơ');
  assert.equal(s.of('profile').length, 1, 'twice within 30 seconds shows once');
  s.say('b', 'hồ sơ');
  assert.equal(s.of('profile').length, 2, 'someone else is not held back');
  s.advance(31_000);
  s.say('a', 'ho so');
  const cards = s.of('profile');
  assert.equal(cards.length, 3);
  const e = cards[0];
  assert.deepEqual([e.userId, e.nickname, e.team, e.level, e.role], ['a', 'A', 'red', 1, null]);
  assert.equal(e.quests.length, 3);
});

test('"hồ sơ" reports the mascot level from "nâng cấp" - the only level there is', () => {
  const s = setup();
  s.say('a', 'đỏ');
  Object.assign(s.v('a').bag, { dust: 500, red: 5, moon: 3 });
  s.say('a', 'nâng cấp');
  assert.equal(s.v('a').level, 2);
  s.advance(1000);
  s.say('a', 'hồ sơ');
  assert.equal(s.of('profile')[0].level, 2);
  assert.equal(s.game.profile.card('a').level, 2);
});

test('what a viewer does feeds tonight\'s counters, saved inside the viewer', () => {
  const s = setup();
  s.say('a', 'đỏ');
  s.game.like({ userId: 'a', nickname: 'A', count: 7 });
  s.game.social({ userId: 'a', nickname: 'A', kind: 'share' });
  s.game.social({ userId: 'a', nickname: 'A', kind: 'follow' });
  const c = s.v('a').stats.c;
  assert.ok(c.comments >= 1);
  assert.deepEqual([c.likes, c.shares, c.follows], [7, 1, 1]);
  const copy = JSON.parse(JSON.stringify(s.game.state));
  assert.deepEqual(copy.viewers.a.stats, s.v('a').stats);
});

test('minutes in the room are counted once a minute for everyone on stage', () => {
  const s = setup();
  s.say('a', 'đỏ');
  for (let i = 0; i < 3; i++) { s.advance(60_000); s.say('a', 'còn đây'); }
  assert.equal(s.v('a').stats.c.minutes, 3);
});

test('hits on the boss make a Chiến binh, worth 3% more starlight', () => {
  const s = setup({ bossHpMin: 1e6, commentLight: 100, commentCooldownSeconds: 0, bossCommentCooldownMs: 0 });
  s.say('a', 'đỏ');
  s.say('b', 'xanh dương');
  s.game.startBoss();
  for (let i = 0; i < 6; i++) { s.advance(100); s.say('a', `đánh ${i}`); }
  assert.ok(s.v('a').stats.c.hits >= 5);
  assert.equal(s.game.profile.card('a').role, 'fighter');
  assert.equal(s.game.profile.card('b').role, null);
  const light = id => s.of('light').filter(e => e.userId === id && e.kind === 'comment').at(-1).amount;
  assert.ok(light('a') > light('b'), 'the role bonus shows in the starlight');
});

test('a wish, a blessing and a tug pull are counted for the person who did them', () => {
  const s = setup({ blessNeed: 1 });
  for (const [id, t] of [['a', 'đỏ'], ['b', 'đỏ'], ['c', 'xanh dương'], ['d', 'xanh dương']]) s.say(id, t);
  s.say('a', 'ước thi đỗ');
  s.say('b', 'chúc');
  assert.equal(s.v('a').stats.c.wishes, 1);
  assert.equal(s.v('b').stats.c.blessings, 1);
  assert.ok(s.game.startTug());
  s.advance(15_000);
  s.say('c', 'kéo!');
  assert.ok((s.v('c').stats.c.pulls ?? 0) >= 1);
});

test('finishing a boss tags its top fighter of each team with an MVP title', () => {
  const s = setup({ bossHpMin: 100, bossHpPerViewer: 1, bossDiamondDamage: 5 });
  s.say('big', 'đỏ');
  s.say('small', 'xanh dương');
  s.game.startBoss();
  s.say('small', 'x');
  s.game.gift({ userId: 'big', nickname: 'BIG', diamonds: 10, count: 1 });
  assert.deepEqual(s.v('big').titles, ['MVP Boss ×1']);
  assert.deepEqual(s.v('small').titles, ['MVP Boss ×1']);
  assert.deepEqual(s.of('mvp').map(e => e.userId).sort(), ['big', 'small']);
  s.advance(1000);
  s.say('big', 'hồ sơ');
  assert.deepEqual(s.of('profile')[0].titles, ['MVP Boss ×1']);
});

test('a quest done in the game pays Điểm sáng once and is announced', () => {
  const s = setup();
  s.say('a', 'đỏ');
  const q = s.game.profile.questsFor('a')[0];
  s.game.profile.track({ userId: 'a' }, s.v('a'), q.stat, q.goal);
  s.game.profile.track({ userId: 'a' }, s.v('a'), q.stat, q.goal);
  assert.equal(s.of('my-quest-done').filter(e => e.id === q.id).length, 1);
  assert.equal(s.v('a').stats.rw.quest, q.reward.n, 'paid once, counted by the reward service inside the viewer');
});

test('user-visible names: Điểm sáng and Sổ mùa, no cards', () => {
  const s = setup({ passXpPerLevel: 1 });
  s.say('a', 'đỏ');
  for (let i = 0; i < 12; i++) { s.advance(6000); s.say('a', `chào ${i}`); }
  s.say('a', 'kho');
  const e = s.of('vault')[0];
  assert.equal(e.labels.dust, 'Điểm sáng');
  assert.equal(e.labels.moon, 'Mảnh trăng');
  assert.ok(s.of('pass-up').length >= 4);
  const json = JSON.stringify(s.events);
  assert.ok(!/Bụi sao|bụi sao|Sổ Sao|thẻ/.test(json), 'no old names in anything the game says');
});
