import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyState, acceptState, parseAction, cleanWish, titleOf, DEFAULT_CONFIG, TEAMS, TEAM_IDS, DEMOS } from './game.mjs';
import { createDirector } from './director.mjs';
import { drawFortune } from './fortunes.mjs';
import { giftOf } from './tiktok.mjs';

test('a birthday is no longer read: it names no team and reveals nothing', () => {
  const events = [];
  const game = createGame({ now: () => Date.UTC(2026, 10, 3, 12), rng: () => 0, onEvent: e => events.push(e), config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false } });
  game.chat({ userId: 'b1', nickname: 'b1', comment: '12/8' });
  assert.equal(game.state.viewers.b1.team, 'red', 'the date names nothing, so the newcomer takes the smallest team (the first on a tie)');
  assert.deepEqual(events.filter(e => /^birth/.test(e.type)), []);
  assert.ok(!events.some(e => e.type === 'show' && e.kind === 'birth'));
});

test('cards, bingo and birth are gone from the saved state', () => {
  const st = emptyState();
  for (const k of ['cards', 'bingo', 'birth']) assert.ok(!(k in st), k);
});

test('with an empty quiz bank startQuiz() is false and nothing opens', () => {
  const game = createGame({ now: () => Date.UTC(2026, 10, 3, 12), rng: () => 0, quiz: [], config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: true } });
  assert.equal(game.startQuiz(), false);
  assert.equal(game.state.quiz, null);
});

test('card and bingo comments are ordinary chat now', () => {
  for (const c of ['bingo', 'khoe thẻ', 'ghép thẻ', 'xem thẻ']) assert.equal(parseAction(c), null, c);
  assert.equal(parseAction('sổ sao'), 'vault');
  assert.equal(parseAction('kho'), 'vault');
  assert.ok(!DEMOS.includes('bingo'));
});

test('parseAction finds keywords without tripping on everyday words', () => {
  assert.equal(parseAction('Xin quẻ'), 'fortune');
  assert.equal(parseAction('quê em ở Huế'), null);
  assert.equal(parseAction('ước thi đỗ đại học'), 'wish');
  assert.equal(parseAction('cầu mong bình an'), 'wish');
  assert.equal(parseAction('câu này khó quá'), null);
  assert.equal(parseAction('nhảy đi'), null); // dancing was dropped: it did nothing for the room
  assert.equal(parseAction('bây giờ là mấy giờ'), null);
});

test('cleanWish strips links and long numbers, and hides blocked words', () => {
  assert.equal(cleanWish('ước gặp crush shop.vn/abc 0912345678', DEFAULT_CONFIG.blockedWords), 'ước gặp crush');
  assert.equal(cleanWish('ước vcl', DEFAULT_CONFIG.blockedWords), null);
  assert.equal(cleanWish('ước các bạn lớn nhanh, đeo kính đẹp', DEFAULT_CONFIG.blockedWords), 'ước các bạn lớn nhanh, đeo kính đẹp');
});

const QUIZ = [{ q: 'Cung đầu tiên?', options: ['Bạch Dương', 'Song Ngư', 'Ma Kết'], answer: 'A' }];
const setup = (config = {}) => {
  let t = Date.UTC(2026, 10, 3, 12);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, quiz: QUIZ, polls: ['Cung nào nấu ăn ngon nhất?', 'Cung nào ngủ nướng giỏi nhất?'], onEvent: e => events.push(e), config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); } };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);
const light = (game, team) => game.state.wheel.light[team];
// a viewer who is already on `team` and on stage, whatever the balance would have said (events/roster.mjs redirects a crowded team)
const seat = (game, id, team) => {
  game.state.viewers[id] = { nickname: id, avatar: '', team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
  game.like(u(id, { count: 0 }));
};

test('joining puts the viewer on stage; comments light their team, with a cooldown', () => {
  const { game, advance } = setup({ commentLight: 2 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('a', { comment: 'hay quá' }));
  advance(5000);
  game.chat(u('a', { comment: 'hay quá' }));
  assert.equal(light(game, 'red'), 4);
  assert.deepEqual(game.snapshot().stage.map(c => [c.userId, c.team]), [['a', 'red']]);
});

test('a lit team passes extra light to the dimmest dark one', () => {
  const { game, events } = setup({ signLightCost: 100, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('b', { comment: 'đỏ' }));
  game.chat(u('c', { comment: 'vàng' }));
  game.gift(u('c', { diamonds: 30 })); // yellow 30
  game.gift(u('b', { diamonds: 150 })); // red 100 (lit) → 50 to green (dimmest, first in order among zeros)
  assert.equal(light(game, 'red'), 100);
  assert.equal(light(game, 'green'), 50);
  assert.deepEqual(of(events, 'flow').map(e => [e.from, e.to, e.amount]), [['red', 'green', 50]]);
  assert.deepEqual(of(events, 'lit').map(e => e.team), ['red']);
  assert.equal(game.snapshot().sky.litCount, 1);
});

test('lighting all 4 completes the wheel and starts a bigger one', () => {
  const { game, events } = setup({ signLightCost: 10, wheelGrowth: 0.5, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('d', { comment: 'xanh dương' }));
  game.gift(u('d', { diamonds: 45 })); // 4 × 10 = 40 completes wheel 1, 5 left for blue on wheel 2 (cost 15)
  assert.deepEqual(of(events, 'wheel-complete').map(e => e.no), [1]);
  assert.equal(game.state.wheel.no, 2);
  assert.equal(light(game, 'blue'), 5);
  assert.equal(game.snapshot().sky.sky.find(s => s.id === 'blue').progress, 5 / 15);
});

test('the sky never ranks teams: snapshot has no per-team totals to compare', () => {
  const { game } = setup();
  game.chat(u('e', { comment: 'đỏ' }));
  const sky = game.snapshot().sky;
  assert.deepEqual(Object.keys(sky.sky[0]).sort(), ['id', 'lit', 'progress', 'stars']);
  assert.equal(sky.waiting.length, 3);
});

test('likes raise the moon; a full moon doubles light for a while, then the goal grows', () => {
  const { game, events, advance } = setup({ moonGoal: 100, moonGrowth: 1.5, partySeconds: 60, likesPerLight: 5, commentLight: 0 });
  game.chat(u('f', { comment: 'xanh dương' })); // moon +1
  game.like(u('f', { count: 99 })); // fills the moon first, so these 19 light are doubled
  assert.equal(of(events, 'moon-full').length, 1);
  assert.equal(game.state.moon.goal, 150);
  assert.equal(light(game, 'blue'), 38);
  advance(60000);
  assert.equal(of(events, 'moon-end').length, 1);
});

test('gifts pick an effect tier and thank the giver by name', () => {
  const { game, events } = setup();
  game.chat(u('g', { comment: '3' }));
  game.gift(u('g', { diamonds: 1, giftName: 'Rose' }));
  game.gift(u('h', { diamonds: 5, count: 3, giftName: 'Finger Heart' }));
  game.gift(u('g', { diamonds: 100, giftName: 'Hand Hearts' }));
  assert.deepEqual(of(events, 'gift').map(e => e.tier), ['sparkle', 'firework', 'meteor']);
  assert.deepEqual(game.snapshot().thanks.map(t => t.nickname), ['g', 'h']);
});

test('a gift from someone who has not typed anything lands at once in the team they were given; nothing is held back', () => {
  const { game } = setup({ lightPerDiamond: 5, commentLight: 0 });
  game.gift(u('i', { diamonds: 10 }));
  assert.equal(game.state.viewers.i.team, 'red', 'the smallest team, the first on a tie');
  assert.equal(light(game, 'red'), 50);
  assert.ok(!('pending' in game.state));
  assert.ok(!('pendingLight' in game.snapshot().hud));
  game.chat(u('i', { comment: 'xanh dương' })); // already seated: a bare colour name switches, but the light that landed stays
  assert.equal(light(game, 'red'), 50);
});

test('fortunes queue one at a time, are free and the same all day; a newcomer needs no team first', () => {
  const { game, events, advance } = setup({ fortuneSeconds: 9 });
  game.chat(u('j', { comment: 'xin quẻ' }));
  assert.equal(of(events, 'need-team').length, 0);
  game.chat(u('j', { comment: 'xin quẻ' })); // the same viewer again: still one reading
  game.chat(u('k', { comment: 'xin quẻ' }));
  advance(100);
  assert.equal(game.state.fortune.userId, 'j');
  advance(9000);
  assert.equal(game.state.fortune.userId, 'k');
  const a = drawFortune({ seed: 'j', team: 'red', element: 'fire', now: Date.UTC(2026, 10, 3, 1) });
  const b = drawFortune({ seed: 'j', team: 'red', element: 'fire', now: Date.UTC(2026, 10, 3, 15) });
  assert.deepEqual(a, b);
});

test('wishes have a cooldown and hide text with blocked words', () => {
  const { game, events, advance } = setup();
  game.chat(u('l', { comment: 'ước được tăng lương' }));
  game.chat(u('l', { comment: 'ước nữa' }));
  advance(60000);
  game.chat(u('l', { comment: 'ước đm' }));
  assert.deepEqual(of(events, 'wish').map(e => e.text), ['được tăng lương', null]);
});

test('follow/share ring the bell every time but pay once a night', () => {
  const { game, events } = setup({ followLight: 20, commentLight: 0 });
  game.chat(u('m', { comment: 'đỏ' }));
  game.social(u('m', { kind: 'follow' }));
  game.social(u('m', { kind: 'follow' }));
  assert.equal(light(game, 'red'), 20);
  assert.equal(of(events, 'bell').length, 2);
  game.newNight();
  game.social(u('m', { kind: 'follow' }));
  assert.equal(light(game, 'red'), 40);
});

test('a quiet room mostly shows a reading for a team, with a quiz now and then', () => {
  const { game, advance } = setup({ acts: false, demoTurns: false, autoQuiz: true, quietSeconds: 45 });
  advance(45000);
  assert.equal(game.state.fortune.userId, null, 'a reading comes first');
  advance(45000);
  assert.equal(game.state.fortune.userId, null, 'then another reading');
  advance(45000);
  assert.equal(game.state.fortune.userId, null, 'and a third');
  advance(45000);
  assert.ok(game.state.quiz, 'the fourth turn is a quiz');
});

test('quiz rewards the first correct answers', () => {
  const { game } = setup({ quizRewards: [40, 25], commentLight: 0 });
  for (const id of ['n', 'o', 'p']) seat(game, id, 'red');
  game.startQuiz();
  game.chat(u('n', { comment: 'b' }));
  game.chat(u('n', { comment: 'a' }));
  game.chat(u('o', { comment: 'A' }));
  game.chat(u('p', { comment: 'a' }));
  assert.equal(light(game, 'red'), 65);
});

test('the race ranks all 4 teams live and crowns the brightest team when the wheel completes', () => {
  const { game, events } = setup({ signLightCost: 10, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('b', { comment: 'vàng' }));
  game.gift(u('b', { diamonds: 4 }));
  game.gift(u('a', { diamonds: 9 }));
  const race = game.snapshot().race;
  assert.equal(race.order.length, 4);
  assert.equal(race.leader, 'red');
  assert.deepEqual(race.order.slice(0, 2).map(r => r.id), ['red', 'yellow']);
  game.gift(u('a', { diamonds: 130 })); // lights red, spreads to the rest, completes the wheel
  const done = of(events, 'wheel-complete')[0];
  assert.equal(done.winner, 'red');
  assert.equal(done.podium.length, 3);
  assert.equal(done.crowned, 1);
  assert.equal(game.state.season.crowns.red, 1);
  assert.equal(game.state.viewers.a.crowns, 1);
  assert.equal(game.state.viewers.b.crowns ?? 0, 0);
  assert.equal(game.snapshot().race.total, 0); // a fresh race on the next wheel
});

test('overtakes are announced, but not more often than the cooldown', () => {
  const { game, events, advance } = setup({ commentLight: 0, lightPerDiamond: 1, overtakeCooldownSeconds: 8 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('b', { comment: 'vàng' }));
  game.gift(u('a', { diamonds: 5 }));
  game.gift(u('b', { diamonds: 9 }));
  assert.deepEqual(of(events, 'overtake').map(e => [e.team, e.from]), [['yellow', 'red']]);
  game.gift(u('a', { diamonds: 20 })); // red retakes the lead inside the cooldown: quiet
  assert.equal(of(events, 'overtake').length, 1);
  advance(9000);
  game.gift(u('b', { diamonds: 50 }));
  assert.equal(of(events, 'overtake').length, 2);
});

test('returning viewers get a streak bonus on the first action of the night', () => {
  const { game, events } = setup({ commentLight: 0, checkinPerNight: 5, checkinMax: 12 });
  game.chat(u('s', { comment: 'đỏ' })); // night 1: streak 1, silent bonus
  assert.equal(light(game, 'red'), 5);
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // streak 2
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // streak 3, capped
  assert.equal(light(game, 'red'), 5 + 10 + 12);
  assert.deepEqual(of(events, 'streak').map(e => [e.streak, e.amount]), [[2, 10], [3, 12]]);
  game.newNight();
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // missed a night: back to 1
  assert.equal(game.state.viewers.s.streak, 1);
});

test('the lucky star picks a team from the lower half of the race and doubles it briefly', () => {
  const { game, events, advance } = setup({ commentLight: 0, lightPerDiamond: 1, luckyEverySeconds: 50, luckySeconds: 20, luckyMultiplier: 2 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('b', { comment: 'xanh lá' }));
  game.gift(u('a', { diamonds: 30 }));
  advance(50000);
  assert.equal(of(events, 'lucky-start')[0].team, 'green');
  assert.equal(game.snapshot().hud.lucky.team, 'green');
  game.gift(u('b', { diamonds: 10 }));
  game.gift(u('a', { diamonds: 10 }));
  assert.equal(light(game, 'green'), 20);
  assert.equal(light(game, 'red'), 40);
  advance(20000);
  assert.equal(of(events, 'lucky-end').length, 1);
  game.gift(u('b', { diamonds: 10 }));
  assert.equal(light(game, 'green'), 30);
});

test('the stage holds only the most recent viewers and drops idle ones', () => {
  const { game, advance } = setup({ crowdMax: 3, presenceMinutes: 1 });
  for (const id of ['q1', 'q2', 'q3', 'q4']) game.chat(u(id, { comment: 'đỏ' }));
  assert.deepEqual(game.snapshot().stage.map(c => c.userId), ['q2', 'q3', 'q4']);
  advance(30000);
  game.like(u('q2', { count: 1 }));
  advance(31000);
  assert.deepEqual(game.snapshot().stage.map(c => c.userId), ['q2']);
});

test('changes() returns only parts that moved since the caller last looked', () => {
  const { game } = setup();
  const seen = {};
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['cosmos', 'gifts', 'hud', 'race', 'sky', 'stage', 'stars', 'thanks']);
  assert.deepEqual(game.changes(seen), {});
  game.chat(u('r', { comment: 'đỏ' }));
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['hud', 'race', 'sky', 'stage', 'stars']); // a first team also lights the viewer's named star
});

test('handlers stay fast with a large saved audience', () => {
  const { game } = setup();
  for (let i = 0; i < 50000; i++) game.state.viewers[`old${i}`] = { nickname: `old${i}`, avatar: '', team: 'red', lifetime: i, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
  const t0 = performance.now();
  for (let i = 0; i < 5000; i++) { game.chat(u(`v${i % 500}`, { comment: TEAMS[i % 4].label })); game.like(u(`v${i % 500}`, { count: 3 })); }
  for (let i = 0; i < 40; i++) game.changes({});
  assert.ok(performance.now() - t0 < 1500, `took ${Math.round(performance.now() - t0)}ms`);
});

test('director caps effects per frame and sums the routine ones', () => {
  const d = createDirector({ joins: 2, sparkles: 1, fireworks: 1, meteors: 1, hearts: 2 });
  for (let i = 0; i < 50; i++) d.push({ type: 'join', userId: `j${i}`, nickname: `j${i}`, team: 'red' });
  for (let i = 0; i < 10; i++) d.push({ type: 'likes', userId: `l${i % 3}`, team: 'red', count: 5 });
  d.push({ type: 'gift', tier: 'meteor', userId: 'g1' });
  d.push({ type: 'gift', tier: 'meteor', userId: 'g2' }); // no meteor slot → firework
  d.push({ type: 'gift', tier: 'meteor', userId: 'g3' }); // → sparkle
  d.push({ type: 'gift', tier: 'sparkle', userId: 'g4' }); // dropped
  d.push({ type: 'flow', from: 'red', to: 'green', amount: 3 });
  d.push({ type: 'flow', from: 'red', to: 'green', amount: 4 });
  d.push({ type: 'moon-full', count: 1 });
  const fx = d.flush();
  const by = t => fx.filter(e => e.type === t);
  assert.equal(by('joins')[0].people.length, 2);
  assert.equal(by('joins')[0].more, 48);
  assert.deepEqual(by('hearts')[0].from, [{ userId: 'l0', count: 20 }, { userId: 'l1', count: 15 }]);
  assert.deepEqual(by('gift').map(g => [g.userId, g.tier]), [['g1', 'meteor'], ['g2', 'firework'], ['g3', 'sparkle']]);
  assert.deepEqual(by('flows')[0].flows, [{ from: 'red', to: 'green', amount: 7 }]);
  assert.equal(by('moon-full').length, 1);
  assert.deepEqual(d.flush(), []);
});

test('titles follow lifetime light', () => {
  assert.equal(titleOf(0), 'Tân Tinh');
  assert.equal(titleOf(600), 'Sao Sáng');
});

test('giftOf skips streak updates and reads the final repeat count', () => {
  const base = { user: { id: '9', nickname: 'Na' }, gift: { type: 1, diamondCount: 5, name: 'Finger Heart' }, repeatCount: 4 };
  assert.equal(giftOf({ ...base, repeatEnd: 0 }), null);
  const g = giftOf({ ...base, repeatEnd: 1 });
  assert.deepEqual([g.userId, g.diamonds, g.count, g.giftName], ['9', 5, 4, 'Finger Heart']);
});

test('visitor milestones are announced once each', () => {
  const { game, events } = setup();
  for (let i = 1; i <= 26; i++) game.chat(u(`m${i}`, { comment: 'hi' }));
  game.chat(u('m3', { comment: 'again' }));
  assert.deepEqual(of(events, 'milestone').map(e => e.count), [1, 10, 25]);
  assert.equal(of(events, 'milestone')[0].nickname, 'm1');
});

const SIM_COMMENTS = ['đỏ', '12/8', 'ước thi đỗ', 'nhận', 'chúc', 'đánh nó', 'kéo!', 'đoán A', 'A', 'nâng cấp', 'kho', 'bingo', 'xin quẻ', 'khoe thẻ'];
function simStorm(game) {
  for (const id of ['sim:x', 'sim:y']) {
    game.member(u(id));
    for (const comment of SIM_COMMENTS) game.chat(u(id, { comment }));
    game.gift(u(id, { diamonds: 1000, count: 3, giftName: 'Galaxy' }));
    game.like(u(id, { count: 500 }));
    game.social(u(id, { kind: 'follow' }));
    game.social(u(id, { kind: 'share' }));
  }
}
for (const [what, begin] of [['boss', g => g.startBoss()], ['tug', g => g.startTug()], ['mystery', g => g.startHead('guessobject')], ['starcatch', g => g.startHead('starcatch')]]) {
  test(`outside rehearsal, sim: viewers change nothing, even mid ${what}`, () => {
    const { game, events } = setup();
    for (const [id, team] of [['a', 'đỏ'], ['b', 'vàng'], ['c', 'xanh lá'], ['d', 'xanh dương']]) game.chat(u(id, { comment: team }));
    begin(game);
    assert.ok(game.state[what], `${what} should be running`);
    const before = structuredClone(game.state), n = events.length;
    simStorm(game);
    assert.deepEqual(game.state, before);
    assert.equal(events.length, n);
  });
}

test('rehearsal mode still plays sim: viewers', () => {
  const { game } = setup({ rehearsal: true });
  game.chat(u('sim:x', { comment: 'đỏ' }));
  assert.equal(game.state.viewers['sim:x'].team, 'red');
});

test('real ids containing "sim" are not dropped', () => {
  const { game } = setup();
  game.chat(u('simon', { comment: 'đỏ' }));
  assert.equal(game.state.viewers.simon.team, 'red');
});

test('a saved state with leftover sim: viewers loads without them', () => {
  const state = emptyState();
  const { game } = setup();
  game.chat(u('real', { comment: 'đỏ' }));
  Object.assign(state, structuredClone(game.state));
  state.viewers['sim:old'] = structuredClone(state.viewers.real);
  const again = createGame({ state, config: { acts: false } });
  assert.deepEqual(Object.keys(again.state.viewers), ['real']);
});

test('a poll offers four numbered options; "1"–"4" is a vote, once each, and never moves or picks a team', () => {
  const { game, events, advance } = setup({ pollSeconds: 20, pollLight: 3, commentLight: 0 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('b', { comment: 'vàng' }));
  game.startPoll();
  const p = game.snapshot().hud.poll;
  assert.equal(p.options.length, 4);
  assert.equal(new Set(p.options.map(o => o.team)).size, 4, 'four different teams to choose from');
  game.chat(u('a', { comment: '2' })); // a vote, a stays in red
  game.chat(u('a', { comment: '3' })); // a second vote is ignored
  game.chat(u('b', { comment: 'số 2' }));
  game.chat(u('c', { comment: '2' })); // no team yet: votes, and is placed by the balance (green), not by the digit (yellow)
  game.chat(u('d', { comment: 'xanh dương' })); // a colour name still picks a newcomer's team, but is not a vote
  assert.equal(game.state.viewers.a.team, 'red');
  assert.equal(game.state.viewers.c.team, 'green');
  assert.equal(game.state.viewers.d.team, 'blue');
  assert.deepEqual(game.snapshot().hud.poll.options.map(o => o.n), [0, 3, 0, 0]);
  advance(20000);
  const end = of(events, 'poll-end')[0];
  assert.deepEqual([end.winner, end.votes, end.total], [1, 3, 3]);
  assert.equal(end.option.label, p.options[1].label);
  assert.equal(game.state.poll, null);
  assert.equal(light(game, 'red'), 3); // a
  assert.equal(light(game, 'yellow'), 3); // b
  assert.equal(light(game, 'green'), 3); // c
});

test('a poll can let the room pick the next headliner of the other act', () => {
  let t = 5 * 60000 * 70000 + 1000;
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, polls: [{ kind: 'next' }], onEvent: e => events.push(e), config: { bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false, pollSeconds: 10, luckyEverySeconds: 1e9 } });
  game.chat(u('a', { comment: 'đỏ' }));
  assert.equal(game.snapshot().cosmos.act.id, 'arena');
  game.startPoll();
  const p = game.snapshot().hud.poll;
  assert.equal(p.kind, 'next');
  assert.equal(p.options.length, 4);
  game.chat(u('a', { comment: '4' }));
  for (let i = 0; i < 12; i++) { t += 1000; game.tick(); }
  const end = of(events, 'poll-end')[0];
  assert.equal(end.kind, 'next');
  const picked = end.option.head;
  t += 5 * 60000; game.tick(); // the reunion's turn
  assert.equal(game.snapshot().cosmos.act.id, 'reunion');
  assert.equal(game.snapshot().cosmos.act.head, picked, 'the voted headliner plays this turn');
});

test('quiet rooms mostly read a team, with a quiz and a poll now and then', () => {
  const { game, advance } = setup({ acts: false, demoTurns: false, autoQuiz: true, quietSeconds: 45 });
  const kinds = [];
  for (let i = 0; i < 8; i++) {
    advance(45000);
    kinds.push(game.state.quiz ? 'quiz' : game.state.poll ? 'poll' : 'fortune');
    if (game.state.quiz) game.endQuiz();
  }
  assert.deepEqual(kinds, ['fortune', 'fortune', 'fortune', 'quiz', 'fortune', 'fortune', 'fortune', 'poll'], 'one quiz and one poll per eight turns');
});

test('small rooms get smaller goals; they scale with viewers on stage', () => {
  const small = setup({ adaptiveCrowd: true, signLightCost: 240, crowdFloor: 0.2, crowdFull: 12, moonGoal: 600 }).game;
  assert.equal(small.state.wheel.cost, 48);
  assert.equal(small.state.moon.goal, 120);
  const { game } = setup({ adaptiveCrowd: true, signLightCost: 240, crowdFloor: 0.2, crowdFull: 12, lightPerDiamond: 1, commentLight: 0 });
  for (let i = 0; i < 12; i++) game.chat(u(`v${i}`, { comment: 'đỏ' }));
  game.gift(u('v0', { diamonds: 600 })); // 4 × 48 completes the first wheel; the next one is priced for 12 viewers
  assert.equal(game.state.wheel.no, 2);
  assert.equal(game.state.wheel.cost, Math.round(240 * 1.5));
});

test('there is no lobby: whatever a newcomer does first puts them on the stage with a team', () => {
  const { game } = setup();
  game.like(u('a', { count: 1 }));
  game.chat(u('b', { comment: 'xin chào' }));
  game.gift(u('c', { diamonds: 1 }));
  game.social(u('d', { kind: 'follow' }));
  assert.ok(!('lobby' in game.snapshot()));
  assert.ok(!('lobby' in game.changes({})));
  assert.deepEqual(game.snapshot().stage.map(c => [c.userId, c.team]), [['a', 'red'], ['b', 'yellow'], ['c', 'green'], ['d', 'blue']], 'each takes the smallest team');
});

test('the gift board counts the night, names the top gifter and fires a shared goal that grows', () => {
  const { game, events } = setup({ giftGoal: 10, giftGoalGrowth: 2 });
  game.gift(u('a', { diamonds: 4, count: 1, giftName: 'Rose' }));
  game.gift(u('b', { diamonds: 3, count: 2, giftName: 'Heart' }));
  let g = game.snapshot().gifts;
  assert.deepEqual([g.count, g.diamonds, g.top.nickname, g.recent[0].giftName], [3, 10, 'b', 'Heart']);
  assert.equal(of(events, 'gift-goal').length, 1, 'the first goal (10) is reached');
  assert.equal(g.goal.goal, 20, 'the next goal is twice as big');
  assert.equal(g.goal.sum, 0);
  game.gift(u('a', { diamonds: 5, count: 4 })); // 20 more
  assert.equal(of(events, 'gift-goal').length, 2);
  assert.equal(game.snapshot().gifts.top.nickname, 'a', 'a has given most now');
});

test('crowd goals ratchet up by at most 25% per retune and never fall', () => {
  const { game, events, advance } = setup({ adaptiveCrowd: true, moonGoal: 600, signLightCost: 240, presenceMinutes: 60, commentLight: 0 });
  const goals = () => [game.state.wheel.cost, game.state.moon.goal];
  const [w0, m0] = goals();
  assert.deepEqual([w0, m0], [48, 120]); // an empty room starts at the 0.2 floor
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'đỏ' }));
  advance(10_000);
  assert.deepEqual(goals(), [w0, m0], 'nothing changes before the first retune');
  advance(20_000);
  assert.deepEqual(goals(), [Math.ceil(w0 * 1.25), Math.ceil(m0 * 1.25)]);
  advance(10_000);
  assert.deepEqual(goals(), [Math.ceil(w0 * 1.25), Math.ceil(m0 * 1.25)], 'at most one step per 30 s');
  for (let i = 0; i < 12; i++) advance(30_000);
  assert.deepEqual(goals(), [240, 600], 'reaches the full-room goal and stops there');
  assert.equal(of(events, 'moon-full').length + of(events, 'wheel-complete').length, 0);
  advance(61 * 60_000); // everyone goes quiet and leaves the stage
  advance(30_000);
  assert.deepEqual(goals(), [240, 600], 'a goal never falls');
});

test('crowdRetuneSeconds: 0 keeps the goal set when it was set', () => {
  const { game, advance } = setup({ adaptiveCrowd: true, moonGoal: 600, signLightCost: 240, presenceMinutes: 60, commentLight: 0, crowdRetuneSeconds: 0 });
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'đỏ' }));
  for (let i = 0; i < 5; i++) advance(30_000);
  assert.deepEqual([game.state.wheel.cost, game.state.moon.goal], [48, 120]);
});

test('a retune never dims a team that is already lit', () => {
  const { game, events, advance } = setup({ adaptiveCrowd: true, moonGoal: 600, signLightCost: 240, presenceMinutes: 60, commentLight: 0, lightPerDiamond: 1 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.gift(u('a', { diamonds: 48, count: 1 })); // exactly the small-room cost
  assert.equal(of(events, 'lit').length, 1);
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'xanh dương' }));
  for (let i = 0; i < 5; i++) advance(30_000);
  assert.ok(game.state.wheel.light.red >= game.state.wheel.cost, 'Đỏ stays lit');
  assert.ok(game.state.moon.goal > 120, 'the moon still follows the room');
});

test('a saved state loads without leftover sim: entries in the thank-you bar, recent gifts, wishes or fortune queue', () => {
  const { game } = setup({ rehearsal: true, commentLight: 0 });
  for (const id of ['sim:old', 'real']) {
    game.chat(u(id, { comment: 'đỏ' }));
    game.gift(u(id, { diamonds: 5, giftName: 'Rose' }));
    game.chat(u(id, { comment: 'ước thi đỗ' }));
  }
  game.gift(u('sim:newcomer', { diamonds: 5 }));
  game.gift(u('sim:old', { diamonds: 50, giftName: 'Rose' })); // the night's top supporter, for now
  const state = structuredClone(game.state);
  const again = createGame({ state, config: { acts: false } });
  const s = again.state, sim = x => String(x?.userId ?? '').startsWith('sim:');
  assert.equal(Object.keys(s.viewers).some(id => id.startsWith('sim:')), false, 'viewers');
  for (const k of ['thanks', 'wishes', 'fortuneQueue']) assert.equal(s[k].some(sim), false, k);
  assert.equal(s.gifts.recent.some(sim), false, 'gifts.recent');
  assert.ok(s.thanks.length + s.gifts.recent.length > 0, 'the real viewer is still thanked');
  assert.equal(s.gifts.top?.nickname, 'real', 'the top supporter is a real viewer');
});

test('parseAction reads a greeting: "chào", "xin chào", "hi", "hello", "welcome"', () => {
  for (const c of ['chào', 'Chào bạn mới', 'xin chào', 'hi', 'Hello!', 'welcome', 'chào mừng']) assert.equal(parseAction(c), 'welcome', c);
  for (const c of ['chúc', 'chao ôi đẹp quá'.replace('chao ôi', 'trời ơi'), 'hihi']) assert.notEqual(parseAction(c), 'welcome', c);
});

test('a newcomer arrives as a star at the rim of the cluster, and the room\'s "chào" lights it up', () => {
  const { game, events } = setup({ welcomeNeed: 3, welcomeWindowSeconds: 30, welcomeDust: 5, commentLight: 0 }); // commentLight 0: the newcomer's own comment would otherwise add dust
  for (const id of ['a', 'b', 'c']) game.chat(u(id, { comment: 'đỏ' }));
  game.member(u('new', { avatar: '' }));
  const g = of(events, 'greeting')[0];
  assert.equal(g.userId, 'new');
  assert.deepEqual([g.need, g.seconds], [3, 30]);
  assert.ok(g.x >= 0 && g.x < 1 && g.y >= 0 && g.y <= 1, 'carries the star position');
  assert.deepEqual([g.x, g.y], [game.state.viewers.new.star.x, game.state.viewers.new.star.y]);
  game.chat(u('new', { comment: 'chào' })); // greeting yourself does not count
  game.chat(u('a', { comment: 'chào' }));
  game.chat(u('a', { comment: 'chào bạn' })); // once each
  game.chat(u('b', { comment: 'hi' }));
  assert.deepEqual(of(events, 'welcome-hi').map(e => e.count), [1, 2]);
  game.chat(u('c', { comment: 'hello' }));
  const done = of(events, 'welcome-done');
  assert.equal(done.length, 1);
  assert.equal(done[0].userId, 'new');
  assert.deepEqual(done[0].greeters, ['a', 'b', 'c']);
  assert.equal(game.state.viewers.new.bag.dust, 5);
  game.chat(u('d', { comment: 'chào' }));
  assert.equal(of(events, 'welcome-hi').length, 2, 'a lit welcome takes no more');
});

test('a welcome closes after its window; a "chào" goes to the newest open one', () => {
  const { game, events, advance } = setup({ welcomeNeed: 3, welcomeWindowSeconds: 30 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.member(u('n1'));
  advance(31_000);
  game.chat(u('a', { comment: 'chào' }));
  assert.equal(of(events, 'welcome-hi').length, 0);
  game.member(u('n2'));
  game.member(u('n3'));
  game.chat(u('a', { comment: 'chào' }));
  assert.equal(of(events, 'welcome-hi')[0].nickname, 'n3');
});

test('getting a team gives the viewer a named star that stays', () => {
  const events = [];
  const g = createGame({ config: { acts: false }, now: () => 1_000_000, rng: () => 0.25, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: 'đỏ' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  g.chat({ userId: 'a', nickname: 'An', comment: 'đổi xanh dương' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  const stars = g.snapshot().stars;
  assert.equal(stars.length, 1);
  assert.equal(stars[0].nickname, 'An');
  assert.equal(stars[0].x, 0.25);
});

test('a big moment comes on schedule: star roll call, then a meteor shower', () => {
  let t = 1_000_000;
  const events = [];
  const g = createGame({ config: { acts: false, showEverySeconds: 75, bossEverySeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999 }, now: () => t, rng: () => 0, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: 'đỏ' });
  assert.ok(g.snapshot().cosmos.show.inMs > 0);
  t += 76_000; g.chat({ userId: 'a', nickname: 'An', comment: 'hi' }); g.tick();
  const first = events.filter(e => e.type === 'showtime');
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'starcall');
  assert.equal(first[0].people[0].nickname, 'An');
});

// --- colour teams: placement, balance, switching, the saved schema ---------------------------------------------------

test('any first comment puts a newcomer on the smallest team, whatever it says', () => {
  const { game } = setup();
  for (const [id, comment] of [['a', 'xin chào'], ['b', 'hay quá'], ['c', 'do an gi'], ['d', 'cho do vao day'], ['e', 'ước thi đỗ']]) game.chat(u(id, { comment }));
  const teams = ['a', 'b', 'c', 'd', 'e'].map(id => game.state.viewers[id].team);
  assert.ok(teams.every(t => TEAM_IDS.includes(t)));
  assert.deepEqual(teams.slice(0, 4), ['red', 'yellow', 'green', 'blue'], 'the first four fill each team once, in order');
  assert.equal(teams[4], 'red', 'then the smallest again');
  assert.equal(game.roster.teamOf('c'), 'green');
  assert.deepEqual(game.roster.counts(), { red: 2, yellow: 1, green: 1, blue: 1 });
});

test('a colour typed first is honoured, unless that team already has more than twice the smallest', () => {
  const { game, events } = setup();
  game.chat(u('a', { comment: 'phe xanh dương' }));
  assert.equal(game.state.viewers.a.team, 'blue');
  game.chat(u('b', { comment: '3' })); // a bare digit picks a team for someone with none yet
  assert.equal(game.state.viewers.b.team, 'green');
  assert.equal(of(events, 'team-balance').length, 0, 'no redirect while the teams are even enough');
  seat(game, 's1', 'red'); seat(game, 's2', 'red'); seat(game, 's3', 'red'); // red 3, yellow 0, green 1, blue 1
  game.chat(u('c', { comment: 'đỏ' }));
  assert.equal(game.state.viewers.c.team, 'yellow', 'red is too crowded: the newcomer goes to the smallest team');
  const moved = of(events, 'team-balance');
  assert.equal(moved.length, 1);
  assert.deepEqual([moved[0].userId, moved[0].wanted, moved[0].team], ['c', 'red', 'yellow']);
});

test('a viewer with a team is not moved by a digit; "đổi 3" moves them at once the first time, then waits 30 s', () => {
  const { game, events, advance } = setup({ commentLight: 0 });
  game.chat(u('a', { comment: 'đỏ' }));
  game.chat(u('a', { comment: '3' }));
  assert.equal(game.state.viewers.a.team, 'red', 'a digit never switches');
  game.chat(u('a', { comment: 'cho xanh la vao day' }));
  assert.equal(game.state.viewers.a.team, 'red', 'a colour inside a sentence never switches');
  game.chat(u('a', { comment: 'đổi 3' }));
  assert.equal(game.state.viewers.a.team, 'green', 'the first correction is free');
  const join = of(events, 'join').at(-1);
  assert.deepEqual([join.team, join.from], ['green', 'red']);
  game.chat(u('a', { comment: 'đổi vàng' }));
  assert.equal(game.state.viewers.a.team, 'green');
  const wait = of(events, 'switch-wait')[0];
  assert.equal(wait.team, 'green');
  assert.equal(wait.to, 'yellow');
  assert.ok(wait.seconds > 0 && wait.seconds <= 30);
  advance(30_000);
  game.chat(u('a', { comment: 'vàng' })); // a bare colour name switches too
  assert.equal(game.state.viewers.a.team, 'yellow');
});

test('a team the boss froze cannot be left or joined', () => {
  const { game, events } = setup({ commentLight: 0 });
  seat(game, 'r', 'red'); seat(game, 'y', 'yellow');
  game.state.boss = { hp: 0, frozen: { team: 'red' } };
  game.chat(u('r', { comment: 'đổi vàng' }));
  assert.equal(game.state.viewers.r.team, 'red', 'nobody leaves the frozen team');
  game.chat(u('y', { comment: 'đổi đỏ' }));
  assert.equal(game.state.viewers.y.team, 'yellow', 'nobody joins it either');
  assert.deepEqual(of(events, 'switch-wait').map(e => e.frozen), [true, true]);
  game.chat(u('y', { comment: 'đổi xanh lá' }));
  assert.equal(game.state.viewers.y.team, 'green', 'other teams are free to switch');
});

test('100 newcomers who all type the same colour still all get a team, and no team runs far ahead', () => {
  const { game } = setup({ crowdMax: 1000 });
  for (let i = 0; i < 100; i++) game.chat(u(`n${i}`, { comment: 'đỏ' }));
  const counts = Object.fromEntries(TEAM_IDS.map(t => [t, 0]));
  for (let i = 0; i < 100; i++) counts[game.state.viewers[`n${i}`].team]++;
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 100, 'everybody has a team');
  assert.ok(Math.max(...Object.values(counts)) <= 2 * Math.min(...Object.values(counts)) + 2, JSON.stringify(counts));
  assert.deepEqual(game.roster.counts(), counts);
});

test('acceptState only takes a state saved with schema 2', () => {
  assert.equal(emptyState().schema, 2);
  assert.equal(acceptState({}), null);
  assert.equal(acceptState({ viewers: {} }), null);
  assert.equal(acceptState(null), null);
  assert.equal(acceptState('x'), null);
  assert.equal(acceptState({ schema: 1, viewers: {} }), null);
  const fresh = emptyState();
  assert.equal(acceptState(fresh), fresh);
});

test('resetAll keeps the roster working on the new state', () => {
  const { game } = setup();
  game.chat(u('a', { comment: 'đỏ' }));
  game.resetAll();
  assert.equal(game.state.schema, 2);
  assert.equal(game.roster.teamOf('a'), null);
  game.chat(u('b', { comment: 'vàng' }));
  assert.equal(game.roster.teamOf('b'), 'yellow');
  assert.deepEqual(game.roster.counts(), { red: 0, yellow: 1, green: 0, blue: 0 });
});
