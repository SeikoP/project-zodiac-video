import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, roleOf, ROLES_PERSONAL, STAT_KEYS } from './profile.mjs';
import { QUESTS, drawQuests } from './quests.mjs';
import { createReward } from './events/reward.mjs';

function setup({ night = 1, t0 = 1_000_000 } = {}) {
  let t = t0;
  const st = { night: { no: night }, viewers: {} };
  const events = [];
  const given = [];
  const cfg = { profileCooldownSeconds: 30 };
  const mk = kind => (u, v, n, why) => { given.push({ kind, userId: u.userId, n, why }); };
  const ref = { profile: null };
  const reward = createReward({ sinks: { dust: mk('dust'), gem: mk('gem'), moon: mk('moon') }, tally: id => ref.profile.tally(id) });
  const profile = ref.profile = createProfile({ st, cfg, reward, now: () => t, onEvent: e => events.push(e) });
  const addViewer = (id, extra = {}) => (st.viewers[id] = { nickname: id.toUpperCase(), avatar: '', team: 'red', lifetime: 0, ...extra });
  return { st, events, given, profile, reward, addViewer, advance: ms => { t += ms; }, u: id => ({ userId: id }) };
}
const quested = s => s.given.filter(g => g.why === 'quest');

test('the quest bank: at least 15 quests, none about gifts, every stat is one the system writes', () => {
  assert.ok(QUESTS.length >= 15);
  assert.equal(new Set(QUESTS.map(q => q.id)).size, QUESTS.length, 'ids are unique');
  for (const q of QUESTS) {
    assert.notEqual(q.stat, 'gift');
    assert.ok(STAT_KEYS.includes(q.stat), `${q.id}: ${q.stat}`);
    assert.ok(q.goal > 0 && q.label && ['dust', 'gem', 'moon'].includes(q.reward.kind) && q.reward.n > 0, q.id);
    assert.ok(!/quà|tặng|xu\b|coin/i.test(q.label), `${q.id}: no gift wording`);
  }
});

test('drawQuests: three distinct quests, stable for (user, night), different on another night', () => {
  const a = drawQuests('u', 1, QUESTS);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map(q => q.id)).size, 3);
  assert.equal(new Set(a.map(q => q.stat)).size, 3, 'three different kinds of play');
  assert.deepEqual(drawQuests('u', 1, QUESTS), a);
  assert.notDeepEqual(drawQuests('u', 2, QUESTS).map(q => q.id), a.map(q => q.id));
  const seen = new Set();
  for (let n = 1; n <= 10; n++) for (const q of drawQuests('u', n, QUESTS)) seen.add(q.id);
  assert.ok(seen.size > 6, 'the bank is actually used');
  for (let i = 0; i < 50; i++) assert.equal(new Set(drawQuests(`user${i}`, 3, QUESTS).map(q => q.id)).size, 3);
});

test('a quest completes once per night and pays through the reward service exactly once', () => {
  const s = setup();
  const v = s.addViewer('a');
  const [q] = drawQuests('a', 1, QUESTS);
  s.profile.track(s.u('a'), v, q.stat, q.goal - 1);
  assert.equal(quested(s).length, 0);
  assert.equal(s.profile.progress('a').find(x => x.id === q.id).done, false);
  s.profile.track(s.u('a'), v, q.stat, 1);
  assert.equal(quested(s).length, 1);
  assert.deepEqual([quested(s)[0].kind, quested(s)[0].n], [q.reward.kind, q.reward.n]);
  s.profile.track(s.u('a'), v, q.stat, 50);
  assert.equal(quested(s).length, 1, 'never a second time');
  assert.equal(s.events.filter(e => e.type === 'my-quest-done' && e.label === q.label).length, 1, 'announced once');
  assert.equal(s.profile.progress('a').find(x => x.id === q.id).done, true);
});

test('a viewer without a team plays nothing: no stats, no payout', () => {
  const s = setup();
  const v = s.addViewer('a', { team: null });
  s.profile.track(s.u('a'), v, 'comments', 100);
  assert.equal(s.given.length, 0);
  assert.deepEqual(s.profile.statsOf('a'), {});
});

test('a new night resets the counters and the quests, but keeps the MVP titles', () => {
  const s = setup();
  const v = s.addViewer('a');
  s.profile.track(s.u('a'), v, 'comments', 7);
  s.profile.mvp('boss', 'a');
  assert.equal(s.profile.statsOf('a').comments, 7);
  s.st.night.no = 2;
  assert.deepEqual(s.profile.statsOf('a'), {});
  assert.deepEqual(s.profile.progress('a').map(q => q.got), [0, 0, 0]);
  assert.deepEqual(s.profile.card('a').titles, ['MVP Boss ×1']);
  const [q] = drawQuests('a', 2, QUESTS);
  s.profile.track(s.u('a'), v, q.stat, q.goal);
  assert.equal(quested(s).length, 1, 'the next night\'s quest can be done again');
});

test('roleOf: the biggest group of actions wins; a tie or a small total is no role', () => {
  assert.deepEqual(ROLES_PERSONAL, ['fighter', 'guard', 'cheer']);
  assert.equal(roleOf({ hits: 6, pulls: 2, thaws: 1 }), 'fighter');
  assert.equal(roleOf({ pulls: 5 }), 'fighter');
  assert.equal(roleOf({ thaws: 3, shields: 4, hits: 2 }), 'guard');
  assert.equal(roleOf({ blessings: 3, wishes: 1, predictions: 2, hits: 1 }), 'cheer');
  assert.equal(roleOf({ hits: 3, thaws: 3 }), null, 'tie');
  assert.equal(roleOf({ hits: 5, thaws: 5 }), null, 'tie, even when big');
  assert.equal(roleOf({ hits: 4 }), null, 'total below 5');
  assert.equal(roleOf({ hits: 3, blessings: 1 }), null, 'total below 5');
  assert.equal(roleOf({}), null);
  assert.equal(roleOf(undefined), null);
  assert.equal(roleOf({ comments: 99, likes: 99 }), null, 'chatting alone is not a role');
});

test('mvp adds a title per event that counts up, and announces it', () => {
  const s = setup();
  s.addViewer('a');
  s.profile.mvp('boss', 'a');
  assert.deepEqual(s.st.viewers.a.titles, ['MVP Boss ×1']);
  s.profile.mvp('tug', 'a');
  s.profile.mvp('boss', 'a');
  assert.deepEqual(s.st.viewers.a.titles, ['MVP Kéo co ×1', 'MVP Boss ×2']);
  assert.deepEqual(s.profile.card('a').titles, ['MVP Boss ×2', 'MVP Kéo co ×1'], 'newest first');
  const e = s.events.filter(x => x.type === 'mvp').at(-1);
  assert.deepEqual([e.userId, e.event, e.title, e.count, e.team], ['a', 'boss', 'MVP Boss ×2', 2, 'red']);
  s.profile.mvp('act:cho', 'a', 'Màn Chợ đêm');
  assert.equal(s.st.viewers.a.titles.at(-1), 'MVP Màn Chợ đêm ×1');
  assert.equal(s.profile.mvp('boss', 'nobody'), null, 'an unknown viewer gets nothing');
  assert.equal(s.profile.mvp('boss', null), null);
});

test('card shows the bag level, role, up to three latest titles, streak and tonight\'s quests', () => {
  const s = setup();
  const v = s.addViewer('a', { level: 3, streak: 4 });
  s.profile.track(s.u('a'), v, 'hits', 8);
  for (const e of ['boss', 'tug', 'roast', 'catch']) s.profile.mvp(e, 'a');
  const c = s.profile.card('a');
  assert.equal(c.level, 3);
  assert.equal(c.role, 'fighter');
  assert.equal(c.streak, 4);
  assert.equal(c.titles.length, 3);
  assert.equal(c.titles[0], 'MVP Hứng sao ×1');
  assert.equal(c.quests.length, 3);
  assert.deepEqual(Object.keys(c.quests[0]).sort(), ['done', 'goal', 'got', 'id', 'label', 'reward']);
  s.addViewer('b');
  assert.equal(s.profile.card('b').level, 1);
  assert.equal(s.profile.card('b').role, null);
  assert.equal(s.profile.card('nobody').level, 1);
});

test('roleBonus is +3% with a role and nothing without', () => {
  const s = setup();
  const v = s.addViewer('a');
  assert.equal(s.profile.roleBonus(v), 0);
  s.profile.track(s.u('a'), v, 'hits', 6);
  assert.equal(s.profile.roleBonus(v), 0.03);
  assert.equal(s.profile.roleLabel(v), 'Chiến binh');
});

test('"hồ sơ": the card is shown once per 30 seconds per person', () => {
  const s = setup();
  const v = s.addViewer('a', { avatar: 'x.png', streak: 2 });
  s.addViewer('b');
  assert.equal(s.profile.show(s.u('a'), v), true);
  assert.equal(s.profile.show(s.u('a'), v), false);
  s.advance(29_000);
  assert.equal(s.profile.show(s.u('a'), v), false);
  assert.equal(s.profile.show(s.u('b'), s.st.viewers.b), true, 'another person is not held back');
  s.advance(1_001);
  assert.equal(s.profile.show(s.u('a'), v), true);
  const shown = s.events.filter(e => e.type === 'profile');
  assert.equal(shown.length, 3);
  const e = shown[0];
  assert.deepEqual([e.userId, e.nickname, e.avatar, e.team, e.level, e.role, e.streak], ['a', 'A', 'x.png', 'red', 1, null, 2]);
  assert.deepEqual(e.titles, []);
  assert.equal(e.quests.length, 3);
  assert.deepEqual(Object.keys(e.quests[0]).sort(), ['done', 'goal', 'got', 'label']);
});

test('stats, quests and titles survive a JSON round trip (a restart keeps the role inputs)', () => {
  const s = setup();
  const v = s.addViewer('a', { level: 2 });
  s.profile.track(s.u('a'), v, 'blessings', 6);
  s.reward.grant(s.u('a'), v, 'dust', 4, 'boss');
  s.profile.mvp('boss', 'a');
  const [q] = drawQuests('a', 1, QUESTS);
  s.profile.track(s.u('a'), v, q.stat, q.goal);
  const copy = JSON.parse(JSON.stringify(s.st));
  assert.deepEqual(copy, s.st);
  const again = createProfile({ st: copy, cfg: { profileCooldownSeconds: 30 }, reward: createReward({ sinks: { dust: () => {}, gem: () => {}, moon: () => {} } }), now: () => 0 });
  assert.deepEqual(again.card('a'), s.profile.card('a'));
  assert.equal(again.statsOf('a').blessings, 6);
  assert.equal(again.progress('a').find(x => x.id === q.id).done, true);
  const before = quested(s).length;
  again.track(s.u('a'), copy.viewers.a, q.stat, 99); // a done quest stays done after the restart
  assert.equal(quested(s).length, before);
  assert.equal(copy.viewers.a.stats.rw.boss, 4, 'reward tallies live in the viewer too');
});
