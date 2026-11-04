import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, emptyState, parseSign, parseAction, cleanWish, titleOf, DEFAULT_CONFIG, SIGNS, DEMOS } from './game.mjs';
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

test('a birthday is no longer read: it picks no sign and reveals nothing', () => {
  for (const c of ['12/8', 'sinh 12-8 nha', '20/1', '8/20', '12 tháng 8']) assert.equal(parseSign(c), null, c);
  const events = [];
  const game = createGame({ now: () => Date.UTC(2026, 10, 3, 12), rng: () => 0, onEvent: e => events.push(e), config: { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false } });
  game.chat({ userId: 'b1', nickname: 'b1', comment: '12/8' });
  assert.equal(game.state.viewers.b1.sign ?? null, null);
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
  const { game, events } = setup({ signLightCost: 100, lightPerDiamond: 1, commentLight: 0 });
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
  const { game, events } = setup({ signLightCost: 10, wheelGrowth: 0.5, lightPerDiamond: 1, commentLight: 0 });
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
  for (const id of ['n', 'o', 'p']) game.chat(u(id, { comment: 'leo' }));
  game.startQuiz();
  game.chat(u('n', { comment: 'b' }));
  game.chat(u('n', { comment: 'a' }));
  game.chat(u('o', { comment: 'A' }));
  game.chat(u('p', { comment: 'a' }));
  assert.equal(light(game, 'leo'), 65);
});

test('the race ranks all 12 signs live and crowns the brightest sign when the wheel completes', () => {
  const { game, events } = setup({ signLightCost: 10, lightPerDiamond: 1, commentLight: 0 });
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
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['cosmos', 'gifts', 'hud', 'lobby', 'race', 'sky', 'stage', 'stars', 'thanks']);
  assert.deepEqual(game.changes(seen), {});
  game.chat(u('r', { comment: 'leo' }));
  assert.deepEqual(Object.keys(game.changes(seen)).sort(), ['hud', 'lobby', 'race', 'sky', 'stage', 'stars']); // a first sign also lights the viewer's named star
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

const SIM_COMMENTS = ['Sư Tử', '12/8', 'ước thi đỗ', 'nhận', 'chúc', 'đánh nó', 'kéo!', 'đoán A', 'A', 'nâng cấp', 'kho', 'bingo', 'xin quẻ', 'khoe thẻ'];
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
    for (const [id, sign] of [['a', 'Sư Tử'], ['b', 'Sư Tử'], ['c', 'Bảo Bình'], ['d', 'Bảo Bình']]) game.chat(u(id, { comment: sign }));
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
  game.chat(u('sim:x', { comment: 'Sư Tử' }));
  assert.equal(game.state.viewers['sim:x'].sign, 'leo');
});

test('real ids containing "sim" are not dropped', () => {
  const { game } = setup();
  game.chat(u('simon', { comment: 'Sư Tử' }));
  assert.equal(game.state.viewers.simon.sign, 'leo');
});

test('a saved state with leftover sim: viewers loads without them', () => {
  const state = emptyState();
  const { game } = setup();
  game.chat(u('real', { comment: 'Sư Tử' }));
  Object.assign(state, structuredClone(game.state));
  state.viewers['sim:old'] = structuredClone(state.viewers.real);
  const again = createGame({ state, config: { acts: false } });
  assert.deepEqual(Object.keys(again.state.viewers), ['real']);
});

test('a poll offers four numbered options; "1"–"4" is a vote, once each, and never moves or makes a team', () => {
  const { game, events, advance } = setup({ pollSeconds: 20, pollLight: 3, commentLight: 0 });
  game.chat(u('a', { comment: 'sư tử' }));
  game.chat(u('b', { comment: 'aries' }));
  game.startPoll();
  const p = game.snapshot().hud.poll;
  assert.equal(p.options.length, 4);
  assert.equal(new Set(p.options.map(o => o.sign)).size, 4, 'four different signs to choose from');
  game.chat(u('a', { comment: '2' })); // a vote, a stays in leo
  game.chat(u('a', { comment: '3' })); // a second vote is ignored
  game.chat(u('b', { comment: 'số 2' }));
  game.chat(u('c', { comment: '2' })); // no team yet: votes, does not join
  game.chat(u('d', { comment: 'bọ cạp' })); // a sign name still joins a newcomer, but is not a vote
  assert.equal(game.state.viewers.a.sign, 'leo');
  assert.equal(game.state.viewers.c?.sign ?? null, null);
  assert.equal(game.state.viewers.d.sign, 'scorpio');
  assert.deepEqual(game.snapshot().hud.poll.options.map(o => o.n), [0, 3, 0, 0]);
  advance(20000);
  const end = of(events, 'poll-end')[0];
  assert.deepEqual([end.winner, end.votes, end.total], [1, 3, 3]);
  assert.equal(end.option.label, p.options[1].label);
  assert.equal(game.state.poll, null);
  assert.equal(light(game, 'leo'), 3); // a voted with a team (+3); c had none, so no light
  assert.equal(light(game, 'aries'), 3); // b
});

test('a poll can let the room pick the next headliner of the other act', () => {
  let t = 5 * 60000 * 70000 + 1000;
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, polls: [{ kind: 'next' }], onEvent: e => events.push(e), config: { bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, demoTurns: false, pollSeconds: 10, luckyEverySeconds: 1e9 } });
  game.chat(u('a', { comment: 'Sư Tử' }));
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

test('quiet rooms mostly read a sign, with a quiz and a poll now and then', () => {
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

test('crowd goals ratchet up by at most 25% per retune and never fall', () => {
  const { game, events, advance } = setup({ adaptiveCrowd: true, moonGoal: 600, signLightCost: 240, presenceMinutes: 60, commentLight: 0 });
  const goals = () => [game.state.wheel.cost, game.state.moon.goal];
  const [w0, m0] = goals();
  assert.deepEqual([w0, m0], [48, 120]); // an empty room starts at the 0.2 floor
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'Sư Tử' }));
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
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'Sư Tử' }));
  for (let i = 0; i < 5; i++) advance(30_000);
  assert.deepEqual([game.state.wheel.cost, game.state.moon.goal], [48, 120]);
});

test('a retune never dims a constellation that is already lit', () => {
  const { game, events, advance } = setup({ adaptiveCrowd: true, moonGoal: 600, signLightCost: 240, presenceMinutes: 60, commentLight: 0, lightPerDiamond: 1 });
  game.chat(u('a', { comment: 'Sư Tử' }));
  game.gift(u('a', { diamonds: 48, count: 1 })); // exactly the small-room cost
  assert.equal(of(events, 'lit').length, 1);
  for (let i = 0; i < 22; i++) game.chat(u(`v${i}`, { comment: 'Bảo Bình' }));
  for (let i = 0; i < 5; i++) advance(30_000);
  assert.ok(game.state.wheel.light.leo >= game.state.wheel.cost, 'Sư Tử stays lit');
  assert.ok(game.state.moon.goal > 120, 'the moon still follows the room');
});

test('a saved state loads without leftover sim: entries in the thank-you bar, recent gifts, wishes, pending light or fortune queue', () => {
  const { game } = setup({ rehearsal: true, commentLight: 0 });
  for (const id of ['sim:old', 'real']) {
    game.chat(u(id, { comment: 'Sư Tử' }));
    game.gift(u(id, { diamonds: 5, giftName: 'Rose' }));
    game.chat(u(id, { comment: 'ước thi đỗ' }));
  }
  game.gift(u('sim:nosign', { diamonds: 5 })); // held as pending light
  game.gift(u('sim:old', { diamonds: 50, giftName: 'Rose' })); // the night's top supporter, for now
  const state = structuredClone(game.state);
  const again = createGame({ state, config: { acts: false } });
  const s = again.state, sim = x => String(x?.userId ?? '').startsWith('sim:');
  assert.equal(Object.keys(s.pending).some(id => id.startsWith('sim:')), false, 'pending');
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
  const { game, events } = setup({ welcomeNeed: 3, welcomeWindowSeconds: 30, welcomeDust: 5 });
  for (const id of ['a', 'b', 'c']) game.chat(u(id, { comment: 'Sư Tử' }));
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
  game.chat(u('a', { comment: 'Sư Tử' }));
  game.member(u('n1'));
  advance(31_000);
  game.chat(u('a', { comment: 'chào' }));
  assert.equal(of(events, 'welcome-hi').length, 0);
  game.member(u('n2'));
  game.member(u('n3'));
  game.chat(u('a', { comment: 'chào' }));
  assert.equal(of(events, 'welcome-hi')[0].nickname, 'n3');
});

test('picking a sign gives the viewer a named star that stays', () => {
  const events = [];
  const g = createGame({ config: { acts: false }, now: () => 1_000_000, rng: () => 0.25, onEvent: e => events.push(e) });
  g.chat({ userId: 'a', nickname: 'An', comment: 'Sư Tử' });
  assert.equal(events.filter(e => e.type === 'star-born').length, 1);
  g.chat({ userId: 'a', nickname: 'An', comment: 'đổi Bảo Bình' });
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
  g.chat({ userId: 'a', nickname: 'An', comment: 'Sư Tử' });
  assert.ok(g.snapshot().cosmos.show.inMs > 0);
  t += 76_000; g.chat({ userId: 'a', nickname: 'An', comment: 'hi' }); g.tick();
  const first = events.filter(e => e.type === 'showtime');
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'starcall');
  assert.equal(first[0].people[0].nickname, 'An');
});
