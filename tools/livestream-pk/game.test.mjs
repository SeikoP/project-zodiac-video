import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseSign, parseAction, cleanWish, titleOf, DEFAULT_CONFIG, SIGNS } from './game.mjs';
import { createDirector } from './director.mjs';
import { drawFortune } from './fortunes.mjs';
import { giftOf } from './tiktok.mjs';

test('parseSign reads names with or without accents, and numbers 1-12', () => {
  assert.equal(parseSign('em chọn Sư Tử nha'), 'leo');
  assert.equal(parseSign('SONG NGU'), 'pisces');
  assert.equal(parseSign('thiên yết'), 'scorpio');
  assert.equal(parseSign('7'), 'libra');
  assert.equal(parseSign('13'), null);
  assert.equal(parseSign('hello'), null);
});

test('parseSign reads a birthday as day/month', () => {
  assert.equal(parseSign('12/8'), 'leo');
  assert.equal(parseSign('sinh 12-8 nha'), 'leo');
  assert.equal(parseSign('20/1'), 'aquarius');
  assert.equal(parseSign('19/1'), 'capricorn');
  assert.equal(parseSign('22/12'), 'capricorn');
  assert.equal(parseSign('21/12'), 'sagittarius');
  assert.equal(parseSign('8/20'), 'leo'); // tolerate month/day
  assert.equal(parseSign('32/13'), null);
});

test('parseAction finds keywords without tripping on everyday words', () => {
  assert.equal(parseAction('Xin quẻ'), 'fortune');
  assert.equal(parseAction('quê em ở Huế'), null);
  assert.equal(parseAction('ước thi đỗ đại học'), 'wish');
  assert.equal(parseAction('cầu mong bình an'), 'wish');
  assert.equal(parseAction('câu này khó quá'), null);
  assert.equal(parseAction('nhảy đi'), 'dance');
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
  const game = createGame({ now: () => t, rng: () => 0, quiz: QUIZ, polls: ['Cung nào nấu ăn ngon nhất?', 'Cung nào ngủ nướng giỏi nhất?'], onEvent: e => events.push(e), config: { skyBoons: false, bossEverySeconds: 0, chaosEverySeconds: 0, chaosEveryRetroSeconds: 0, chestEveryMinutes: 0, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); } };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);
const light = (game, sign) => game.state.wheel.light[sign];

test('joining puts the viewer on stage; comments light their sign, with a cooldown', () => {
  const { game, advance } = setup({ commentLight: 2 });
  game.chat(u('a', { comment: 'sư tử' }));
  game.chat(u('a', { comment: 'hay quá' }));
  advance(5000);
  game.chat(u('a', { comment: 'hay quá' }));
  assert.equal(light(game, 'leo'), 4);
  assert.deepEqual(game.snapshot().stage.map(c => [c.userId, c.sign]), [['a', 'leo']]);
});

test('a lit constellation passes extra light to the dimmest dark one', () => {
  const { game, events } = setup({ constellationCost: 100, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('b', { comment: 'leo' }));
  game.chat(u('c', { comment: 'aries' }));
  game.gift(u('c', { diamonds: 30 })); // aries 30
  game.gift(u('b', { diamonds: 150 })); // leo 100 (lit) → 50 to taurus (dimmest, first in order among zeros)
  assert.equal(light(game, 'leo'), 100);
  assert.equal(light(game, 'taurus'), 50);
  assert.deepEqual(of(events, 'flow').map(e => [e.from, e.to, e.amount]), [['leo', 'taurus', 50]]);
  assert.deepEqual(of(events, 'lit').map(e => e.sign), ['leo']);
  assert.equal(game.snapshot().sky.litCount, 1);
});

test('lighting all 12 completes the wheel and starts a bigger one', () => {
  const { game, events } = setup({ constellationCost: 10, wheelGrowth: 0.5, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('d', { comment: 'pisces' }));
  game.gift(u('d', { diamonds: 125 })); // 12 × 10 = 120 completes wheel 1, 5 left for pisces on wheel 2 (cost 15)
  assert.deepEqual(of(events, 'wheel-complete').map(e => e.no), [1]);
  assert.equal(game.state.wheel.no, 2);
  assert.equal(light(game, 'pisces'), 5);
  assert.equal(game.snapshot().sky.sky.find(s => s.id === 'pisces').progress, 5 / 15);
});

test('the sky never ranks signs: snapshot has no per-sign totals to compare', () => {
  const { game } = setup();
  game.chat(u('e', { comment: 'leo' }));
  const sky = game.snapshot().sky;
  assert.deepEqual(Object.keys(sky.sky[0]).sort(), ['id', 'lit', 'progress', 'stars']);
  assert.equal(sky.waiting.length, 3);
});

test('likes raise the moon; a full moon doubles light for a while, then the goal grows', () => {
  const { game, events, advance } = setup({ moonGoal: 100, moonGrowth: 1.5, partySeconds: 60, likesPerLight: 5, commentLight: 0 });
  game.chat(u('f', { comment: 'kim ngưu' })); // moon +1
  game.like(u('f', { count: 99 })); // fills the moon first, so these 19 light are doubled
  assert.equal(of(events, 'moon-full').length, 1);
  assert.equal(game.state.moon.goal, 150);
  assert.equal(light(game, 'taurus'), 38);
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

test('gifts before choosing a sign are held, then land when they join', () => {
  const { game } = setup({ lightPerDiamond: 5, commentLight: 0 });
  game.gift(u('i', { diamonds: 10 }));
  assert.equal(game.snapshot().hud.pendingLight, 50);
  game.chat(u('i', { comment: 'ma kết' }));
  assert.equal(light(game, 'capricorn'), 50);
});

test('fortunes queue one at a time, are free, same all day, and need a sign', () => {
  const { game, events, advance } = setup({ fortuneSeconds: 9 });
  game.chat(u('j', { comment: 'xin quẻ' }));
  assert.equal(of(events, 'need-sign').length, 1);
  game.chat(u('j', { comment: 'bạch dương' }));
  game.chat(u('j', { comment: 'xin quẻ' }));
  game.chat(u('k', { comment: 'song tử xin quẻ' }));
  advance(100);
  assert.equal(game.state.fortune.userId, 'j');
  advance(9000);
  assert.equal(game.state.fortune.userId, 'k');
  const a = drawFortune({ seed: 'j', sign: 'aries', element: 'fire', now: Date.UTC(2026, 10, 3, 1) });
  const b = drawFortune({ seed: 'j', sign: 'aries', element: 'fire', now: Date.UTC(2026, 10, 3, 15) });
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
  game.chat(u('m', { comment: 'leo' }));
  game.social(u('m', { kind: 'follow' }));
  game.social(u('m', { kind: 'follow' }));
  assert.equal(light(game, 'leo'), 20);
  assert.equal(of(events, 'bell').length, 2);
  game.newNight();
  game.social(u('m', { kind: 'follow' }));
  assert.equal(light(game, 'leo'), 40);
});

test('a quiet room mostly shows a reading for a sign, with a quiz now and then', () => {
  const { game, advance } = setup({ demoTurns: false, autoQuiz: true, quietSeconds: 45 });
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
  for (const id of ['n', 'o', 'p']) game.chat(u(id, { comment: 'leo' }));
  game.startQuiz();
  game.chat(u('n', { comment: 'b' }));
  game.chat(u('n', { comment: 'a' }));
  game.chat(u('o', { comment: 'A' }));
  game.chat(u('p', { comment: 'a' }));
  assert.equal(light(game, 'leo'), 65);
});

test('the race ranks all 12 signs live and crowns the brightest sign when the wheel completes', () => {
  const { game, events } = setup({ constellationCost: 10, lightPerDiamond: 1, commentLight: 0 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('b', { comment: 'aries' }));
  game.gift(u('b', { diamonds: 4 }));
  game.gift(u('a', { diamonds: 9 }));
  const race = game.snapshot().race;
  assert.equal(race.order.length, 12);
  assert.equal(race.leader, 'leo');
  assert.deepEqual(race.order.slice(0, 2).map(r => r.id), ['leo', 'aries']);
  game.gift(u('a', { diamonds: 130 })); // lights leo, spreads to the rest, completes the wheel
  const done = of(events, 'wheel-complete')[0];
  assert.equal(done.winner, 'leo');
  assert.equal(done.podium.length, 3);
  assert.equal(done.crowned, 1);
  assert.equal(game.state.season.crowns.leo, 1);
  assert.equal(game.state.viewers.a.crowns, 1);
  assert.equal(game.state.viewers.b.crowns ?? 0, 0);
  assert.equal(game.snapshot().race.total, 0); // a fresh race on the next wheel
});

test('overtakes are announced, but not more often than the cooldown', () => {
  const { game, events, advance } = setup({ commentLight: 0, lightPerDiamond: 1, overtakeCooldownSeconds: 8 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('b', { comment: 'aries' }));
  game.gift(u('a', { diamonds: 5 }));
  game.gift(u('b', { diamonds: 9 }));
  assert.deepEqual(of(events, 'overtake').map(e => [e.sign, e.from]), [['aries', 'leo']]);
  game.gift(u('a', { diamonds: 20 })); // leo retakes the lead inside the cooldown: quiet
  assert.equal(of(events, 'overtake').length, 1);
  advance(9000);
  game.gift(u('b', { diamonds: 50 }));
  assert.equal(of(events, 'overtake').length, 2);
});

test('returning viewers get a streak bonus on the first action of the night', () => {
  const { game, events } = setup({ commentLight: 0, checkinPerNight: 5, checkinMax: 12 });
  game.chat(u('s', { comment: 'leo' })); // night 1: streak 1, silent bonus
  assert.equal(light(game, 'leo'), 5);
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // streak 2
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // streak 3, capped
  assert.equal(light(game, 'leo'), 5 + 10 + 12);
  assert.deepEqual(of(events, 'streak').map(e => [e.streak, e.amount]), [[2, 10], [3, 12]]);
  game.newNight();
  game.newNight();
  game.chat(u('s', { comment: 'hi' })); // missed a night: back to 1
  assert.equal(game.state.viewers.s.streak, 1);
});

test('the lucky star picks a sign from the lower half of the race and doubles it briefly', () => {
  const { game, events, advance } = setup({ commentLight: 0, lightPerDiamond: 1, luckyEverySeconds: 50, luckySeconds: 20, luckyMultiplier: 2 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('b', { comment: 'libra' }));
  game.gift(u('a', { diamonds: 30 }));
  advance(50000);
  assert.equal(of(events, 'lucky-start')[0].sign, 'libra');
  assert.equal(game.snapshot().hud.lucky.sign, 'libra');
  game.gift(u('b', { diamonds: 10 }));
  game.gift(u('a', { diamonds: 10 }));
  assert.equal(light(game, 'libra'), 20);
  assert.equal(light(game, 'leo'), 40);
  advance(20000);
  assert.equal(of(events, 'lucky-end').length, 1);
  game.gift(u('b', { diamonds: 10 }));
  assert.equal(light(game, 'libra'), 30);
});

test('the stage holds only the most recent viewers and drops idle ones', () => {
  const { game, advance } = setup({ crowdMax: 3, presenceMinutes: 1 });
  for (const id of ['q1', 'q2', 'q3', 'q4']) game.chat(u(id, { comment: 'leo' }));
  assert.deepEqual(game.snapshot().stage.map(c => c.userId), ['q2', 'q3', 'q4']);
  advance(30000);
  game.like(u('q2', { count: 1 }));
  advance(31000);
  assert.deepEqual(game.snapshot().stage.map(c => c.userId), ['q2']);
});

test('changes() returns only parts that moved since the caller last looked', () => {
  const { game } = setup();
  const seen = {};
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['cosmos', 'gifts', 'hud', 'lobby', 'race', 'sky', 'stage', 'thanks']);
  assert.deepEqual(game.changes(seen), {});
  game.chat(u('r', { comment: 'leo' }));
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['hud', 'lobby', 'race', 'sky', 'stage']);
});

test('handlers stay fast with a large saved audience', () => {
  const { game } = setup();
  for (let i = 0; i < 50000; i++) game.state.viewers[`old${i}`] = { nickname: `old${i}`, avatar: '', sign: 'leo', lifetime: i, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
  const t0 = performance.now();
  for (let i = 0; i < 5000; i++) { game.chat(u(`v${i % 500}`, { comment: SIGNS[i % 12].label })); game.like(u(`v${i % 500}`, { count: 3 })); }
  for (let i = 0; i < 40; i++) game.changes({});
  assert.ok(performance.now() - t0 < 1500, `took ${Math.round(performance.now() - t0)}ms`);
});

test('director caps effects per frame and sums the routine ones', () => {
  const d = createDirector({ joins: 2, sparkles: 1, fireworks: 1, meteors: 1, hearts: 2 });
  for (let i = 0; i < 50; i++) d.push({ type: 'join', userId: `j${i}`, nickname: `j${i}`, sign: 'leo' });
  for (let i = 0; i < 10; i++) d.push({ type: 'likes', userId: `l${i % 3}`, sign: 'leo', count: 5 });
  d.push({ type: 'gift', tier: 'meteor', userId: 'g1' });
  d.push({ type: 'gift', tier: 'meteor', userId: 'g2' }); // no meteor slot → firework
  d.push({ type: 'gift', tier: 'meteor', userId: 'g3' }); // → sparkle
  d.push({ type: 'gift', tier: 'sparkle', userId: 'g4' }); // dropped
  d.push({ type: 'flow', from: 'leo', to: 'virgo', amount: 3 });
  d.push({ type: 'flow', from: 'leo', to: 'virgo', amount: 4 });
  d.push({ type: 'moon-full', count: 1 });
  const fx = d.flush();
  const by = t => fx.filter(e => e.type === t);
  assert.equal(by('joins')[0].people.length, 2);
  assert.equal(by('joins')[0].more, 48);
  assert.deepEqual(by('hearts')[0].from, [{ userId: 'l0', count: 20 }, { userId: 'l1', count: 15 }]);
  assert.deepEqual(by('gift').map(g => [g.userId, g.tier]), [['g1', 'meteor'], ['g2', 'firework'], ['g3', 'sparkle']]);
  assert.deepEqual(by('flows')[0].flows, [{ from: 'leo', to: 'virgo', amount: 7 }]);
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

test('purgeSim removes rehearsal viewers from the stage, pending light and the thank-you bar', () => {
  const { game } = setup({ commentLight: 0 });
  game.chat(u('sim:fan1', { comment: 'leo' }));
  game.chat(u('real1', { comment: 'leo' }));
  game.gift(u('sim:fan1', { diamonds: 5 }));
  game.gift(u('sim:fan9', { diamonds: 5 })); // no sign yet: held as pending
  assert.equal(game.purgeSim(), 2);
  assert.deepEqual(game.snapshot().stage.map(c => c.userId), ['real1']);
  assert.equal(game.snapshot().hud.pendingLight, 0);
  assert.deepEqual(game.snapshot().thanks, []);
});

test('a poll counts one vote per viewer, does not move existing teams, and names the winning sign', () => {
  const { game, events, advance } = setup({ pollSeconds: 20, pollLight: 3, commentLight: 0 });
  game.chat(u('a', { comment: 'sư tử' }));
  game.chat(u('b', { comment: 'aries' }));
  game.startPoll();
  game.chat(u('a', { comment: 'bọ cạp' })); // vote, stays in leo
  game.chat(u('a', { comment: 'leo' })); // second vote ignored
  game.chat(u('b', { comment: 'bọ cạp' }));
  game.chat(u('c', { comment: 'leo' })); // no team yet: votes and joins
  assert.equal(game.state.viewers.a.sign, 'leo');
  assert.equal(game.state.viewers.c.sign, 'leo');
  assert.equal(game.snapshot().hud.poll.votes.scorpio, 2);
  advance(20000);
  const end = of(events, 'poll-end')[0];
  assert.deepEqual([end.winner, end.votes, end.total], ['scorpio', 2, 3]);
  assert.equal(game.state.poll, null);
  assert.equal(light(game, 'leo'), 3); // a voted with a team (+3); c had none yet, so no light
  assert.equal(light(game, 'aries'), 3); // b
});

test('quiet rooms mostly read a sign, with a quiz and a poll now and then', () => {
  const { game, advance } = setup({ demoTurns: false, autoQuiz: true, quietSeconds: 45 });
  const kinds = [];
  for (let i = 0; i < 8; i++) {
    advance(45000);
    kinds.push(game.state.quiz ? 'quiz' : game.state.poll ? 'poll' : 'fortune');
    if (game.state.quiz) game.endQuiz();
  }
  assert.deepEqual(kinds, ['fortune', 'fortune', 'fortune', 'quiz', 'fortune', 'fortune', 'fortune', 'poll'], 'one quiz and one poll per eight turns');
});

test('small rooms get smaller goals; they scale with viewers on stage', () => {
  const small = setup({ adaptiveCrowd: true, constellationCost: 240, crowdFloor: 0.2, crowdFull: 12, moonGoal: 600 }).game;
  assert.equal(small.state.wheel.cost, 48);
  assert.equal(small.state.moon.goal, 120);
  const { game } = setup({ adaptiveCrowd: true, constellationCost: 240, crowdFloor: 0.2, crowdFull: 12, lightPerDiamond: 1, commentLight: 0 });
  for (let i = 0; i < 12; i++) game.chat(u(`v${i}`, { comment: 'leo' }));
  game.gift(u('v0', { diamonds: 600 })); // 12 × 48 completes the first wheel; the next one is priced for 12 viewers
  assert.equal(game.state.wheel.no, 2);
  assert.equal(game.state.wheel.cost, Math.round(240 * 1.5));
});

test('viewers who have not picked a sign wait in the lobby, first come first served, until they name one', () => {
  const { game, advance } = setup();
  game.like(u('a', { count: 1 }));
  game.chat(u('b', { comment: 'xin chào' }));
  game.chat(u('c', { comment: 'sư tử' }));
  let lobby = game.snapshot().lobby;
  assert.equal(lobby.total, 2, 'c picked a sign, so only a and b wait');
  assert.deepEqual(lobby.people.map(p => p.nickname), ['a', 'b']);
  assert.equal(lobby.latest.nickname, 'b');
  game.chat(u('a', { comment: 'kim ngưu' }));
  lobby = game.snapshot().lobby;
  assert.deepEqual(lobby.people.map(p => p.nickname), ['b'], 'naming a sign leaves the line');
  advance(11 * 60000);
  game.tick();
  assert.equal(game.snapshot().lobby.total, 0, 'viewers who went quiet drop out of the line');
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
