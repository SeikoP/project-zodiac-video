import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseAction } from './game.mjs';
import { readSky, boonFor } from './sky.mjs';
import { createDirector } from './director.mjs';

// A sky the tests control: the Sun in Leo, the Moon in Pisces, Mercury retrograde in Aries.
const SKY = { planets: [{ id: 'sun', sign: 'leo', deg: 5, retro: false }, { id: 'moon', sign: 'pisces', deg: 2, retro: false }, { id: 'mercury', sign: 'aries', deg: 9, retro: true }], moon: { full: false, phase: 'Trăng non', icon: '🌑' }, mercuryRetro: true };
const OFF = { skyBoons: false, bossEverySeconds: 0, chaosEverySeconds: 0, chaosEveryRetroSeconds: 0, chestEveryMinutes: 0 };
const setup = (config = {}, sky = null) => {
  let t = Date.UTC(2026, 10, 3, 12, 1);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, readSky: sky && (() => sky), onEvent: e => events.push(e), config: { hours: false, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...OFF, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); }, at: () => t };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);

test('the real sky: the Sun in Scorpio and Mercury retrograde in early November 2026, direct again by mid-December', () => {
  const nov = readSky(Date.UTC(2026, 10, 3, 12));
  assert.equal(nov.planets.find(p => p.id === 'sun').sign, 'scorpio');
  assert.equal(nov.mercuryRetro, true);
  assert.equal(nov.planets.find(p => p.id === 'sun').retro, false);
  const dec = readSky(Date.UTC(2026, 11, 15, 12));
  assert.equal(dec.planets.find(p => p.id === 'sun').sign, 'sagittarius');
  assert.equal(dec.mercuryRetro, false);
  assert.equal(readSky(Date.UTC(2026, 10, 24, 12)).moon.full, true);
  assert.ok(nov.moon.nextInMs > 0 && nov.moon.nextInMs < 3 * 86400000);
});

test('a planet boosts its sign for the actions it rules; the Sun boosts every action but not rewards', () => {
  assert.equal(boonFor(SKY, 'leo', 'comment').mult, 1.5);
  assert.equal(boonFor(SKY, 'leo', 'checkin').mult, 1);
  assert.equal(boonFor(SKY, 'pisces', 'like').mult, 2);
  assert.equal(boonFor(SKY, 'pisces', 'comment').mult, 1);
  assert.deepEqual(boonFor(SKY, 'aries', 'comment').by, ['mercury']);
  const crowded = { planets: ['sun', 'jupiter', 'moon'].map(id => ({ id, sign: 'leo' })) };
  assert.equal(boonFor(crowded, 'leo', 'like').mult, 3); // 1.5 × 1.25 × 2 = 3.75, capped
});

test('the game applies sky boons to a sign\'s fans', () => {
  const { game, events } = setup({ skyBoons: true, commentLight: 2 }, SKY);
  game.chat(u('a', { comment: 'sư tử' }));
  game.chat(u('b', { comment: 'kim ngưu' }));
  assert.equal(game.state.wheel.given.leo, 3);
  assert.equal(game.state.wheel.given.taurus, 2);
  assert.deepEqual(of(events, 'light')[0].boon, ['sun']);
});

test('Thủy Nghịch sends starlight to the opposite sign until enough viewers comment "thuận"', () => {
  const { game, events } = setup({ commentLight: 2, chaosFixMin: 2, chaosFixLight: 5 });
  game.chat(u('a', { comment: 'sư tử' }));
  game.chat(u('b', { comment: 'bảo bình' }));
  game.startChaos();
  assert.equal(of(events, 'chaos-start')[0].need, 2);
  game.like(u('a', { count: 10 })); // 2 light from a Leo fan → Aquarius
  assert.equal(game.state.wheel.given.aquarius, 2 + 2);
  assert.deepEqual(of(events, 'swap')[0], { type: 'swap', from: 'leo', to: 'aquarius', amount: 2 });
  game.chat(u('a', { comment: 'thuận' }));
  game.chat(u('a', { comment: 'thuận' })); // the same viewer counts once
  assert.ok(game.state.chaos);
  game.chat(u('b', { comment: 'thuận hành!' }));
  assert.equal(game.state.chaos, null);
  const fixed = of(events, 'chaos-fixed')[0];
  assert.deepEqual(fixed.fixers.sort(), ['a', 'b']);
  assert.equal(game.state.wheel.given.leo, 2 + 5); // the reward lands on the fixer's own sign again
});

test('Thủy Nghịch that nobody fixes simply ends; it comes far more often while Mercury is really retrograde', () => {
  const { game, events, advance } = setup({ chaosSeconds: 30 });
  game.chat(u('a', { comment: 'leo' }));
  game.startChaos();
  advance(31000);
  assert.equal(of(events, 'chaos-end').length, 1);
  const retro = setup({ chaosEverySeconds: 1500, chaosEveryRetroSeconds: 300 }, SKY);
  const calm = setup({ chaosEverySeconds: 1500, chaosEveryRetroSeconds: 300 }, { ...SKY, mercuryRetro: false });
  assert.ok(retro.game.state.nextChaosAt - retro.at() <= 300000);
  assert.ok(calm.game.state.nextChaosAt - calm.at() >= 1500000 * 0.8);
});

test('the boss: every element has its own part', () => {
  const { game, events } = setup({ bossHpMin: 10000, bossCommentDamage: 6, bossLikeDamage: 0.5, bossDiamondDamage: 5 });
  for (const [id, sign] of [['fire', 'leo'], ['earth', 'taurus'], ['air', 'gemini'], ['water', 'pisces']]) game.chat(u(id, { comment: sign }));
  game.startBoss();
  assert.equal(of(events, 'boss-start').length, 1);
  game.gift(u('fire', { diamonds: 10, count: 1 }));
  assert.deepEqual(of(events, 'boss-hit').at(-1), { type: 'boss-hit', userId: 'fire', nickname: 'fire', sign: 'leo', dmg: 100, crit: true, combo: 0 });
  game.like(u('water', { count: 10 }));
  assert.equal(of(events, 'boss-hit').at(-1).dmg, 15); // 10 × 0.5 × 3
  game.like(u('earth', { count: 10 }));
  assert.equal(of(events, 'boss-hit').at(-1).dmg, 5);
  game.chat(u('earth', { comment: 'cố lên' }));
  assert.equal(game.state.boss.shield, 1);
  game.chat(u('air', { comment: 'đánh' }));
  assert.equal(of(events, 'boss-hit').at(-1).combo, 1);
});

test('air comments build a combo while they keep coming; comments have a per-viewer cooldown', () => {
  const { game, events, advance } = setup({ bossHpMin: 10000, bossCommentDamage: 10, bossCommentCooldownMs: 1500, bossComboMs: 4000 });
  game.chat(u('a', { comment: 'song tử' }));
  game.chat(u('b', { comment: 'thiên bình' }));
  game.startBoss();
  game.chat(u('a', { comment: 'x' }));
  game.chat(u('a', { comment: 'x' })); // cooldown: no hit
  game.chat(u('b', { comment: 'x' }));
  advance(2000);
  game.chat(u('a', { comment: 'x' }));
  const hits = of(events, 'boss-hit');
  assert.deepEqual(hits.map(h => [h.combo, h.dmg]), [[1, 12], [2, 13], [3, 15]]);
  advance(5000);
  game.chat(u('b', { comment: 'x' }));
  assert.equal(of(events, 'boss-hit').at(-1).combo, 1); // the combo broke
});

test('the boss freezes the sign hurting it most; its fans break the ice, or the boss heals', () => {
  const { game, events, advance } = setup({ bossHpMin: 1000, bossAttackSeconds: 10, bossFreezeSeconds: 8, bossHealShare: 0.1, bossDiamondDamage: 5 });
  game.chat(u('f1', { comment: 'leo' }));
  game.chat(u('f2', { comment: 'leo' }));
  game.chat(u('w', { comment: 'pisces' }));
  game.startBoss();
  game.gift(u('f1', { diamonds: 20, count: 1 })); // 200 damage, Leo leads
  advance(10000);
  const freeze = of(events, 'boss-freeze')[0];
  assert.deepEqual([freeze.sign, freeze.need], ['leo', 2]);
  game.gift(u('f1', { diamonds: 20, count: 1 }));
  assert.equal(game.state.boss.hp, 800); // frozen: no damage
  game.chat(u('f1', { comment: 'phá băng' }));
  game.chat(u('f2', { comment: 'cứu' }));
  assert.equal(of(events, 'boss-rescue')[0].nickname, 'f2');
  assert.equal(game.state.boss.frozen, null);
  advance(10000); // the next freeze nobody breaks
  game.chat(u('w', { comment: 'x' }));
  advance(8500);
  assert.equal(of(events, 'boss-heal')[0].heal, 100);
  assert.equal(game.state.boss.hp, 800 - 6 + 100);
});

test('a full enough shield blocks the attack instead of a freeze', () => {
  const { game, events, advance } = setup({ bossHpMin: 10000, bossAttackSeconds: 10, bossShieldCost: 3, bossCommentCooldownMs: 0 });
  game.chat(u('e', { comment: 'ma kết' }));
  game.startBoss();
  for (let i = 0; i < 3; i++) game.chat(u('e', { comment: 'khiên' }));
  advance(10000);
  assert.equal(of(events, 'boss-blocked')[0].sign, 'capricorn');
  assert.equal(of(events, 'boss-freeze').length, 0);
  assert.equal(game.state.boss.shield, 0);
});

test('beating the boss pays everyone who hit it, and the top hitter gets the boss card', () => {
  const { game, events } = setup({ bossHpMin: 100, bossHpPerViewer: 1, bossReward: 30, bossDiamondDamage: 5 });
  game.chat(u('big', { comment: 'leo' }));
  game.chat(u('small', { comment: 'pisces' }));
  game.startBoss();
  game.chat(u('small', { comment: 'x' }));
  game.gift(u('big', { diamonds: 10, count: 1 }));
  const won = of(events, 'boss-defeated')[0];
  assert.equal(won.fighters, 2);
  assert.equal(won.mvp.nickname, 'big');
  assert.equal(won.mvps.fire.nickname, 'big');
  assert.equal(won.mvps.water.nickname, 'small');
  assert.equal(game.state.boss, null);
  assert.ok(game.state.viewers.big.cards['leo:boss']);
  assert.equal(Object.keys(game.state.viewers.small.cards).length, 1);
  assert.ok(of(events, 'light').some(e => e.kind === 'boss' && e.userId === 'small' && e.amount === 30));
});

test('a boss nobody beats in time escapes, and the next one is scheduled', () => {
  const { game, events, advance } = setup({ bossHpMin: 1e6, bossSeconds: 60, bossEverySeconds: 300 });
  game.chat(u('a', { comment: 'leo' }));
  game.startBoss();
  advance(61000);
  assert.equal(of(events, 'boss-escaped').length, 1);
  assert.ok(game.state.nextBossAt > Date.UTC(2026, 10, 3, 12, 1) + 300000);
});

test('a boss beaten by a gift (between ticks) also schedules the next one', () => {
  const { game, advance } = setup({ bossHpMin: 10, bossHpPerViewer: 1, bossEverySeconds: 300, bossDiamondDamage: 5 });
  game.chat(u('a', { comment: 'leo' }));
  game.startBoss();
  advance(250);
  game.gift(u('a', { diamonds: 10, count: 1 }));
  assert.equal(game.state.boss, null);
  advance(250);
  assert.ok(game.state.nextBossAt >= Date.UTC(2026, 10, 3, 12, 1) + 300000);
});

test('readings wait while the boss is up', () => {
  const { game, advance } = setup({ bossHpMin: 1e6, bossSeconds: 60 });
  game.chat(u('a', { comment: 'leo' }));
  game.startBoss();
  game.chat(u('a', { comment: 'xin quẻ' }));
  advance(500);
  assert.equal(game.state.fortune, null);
  advance(61000);
  assert.ok(game.state.fortune);
});

test('the star chest opens on the quarter hour while people are around; one card per viewer per chest', () => {
  const { game, events, advance } = setup({ chestEveryMinutes: 15, chestOpenSeconds: 20 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('a', { comment: 'nhận' }));
  assert.equal(of(events, 'card').length, 0); // not open yet
  assert.equal(game.changes({}).cosmos.chest.inMs, 14 * 60000);
  advance(13 * 60000);
  game.chat(u('a', { comment: 'vẫn ở đây' }));
  advance(60000);
  assert.equal(of(events, 'chest-open').length, 1);
  game.chat(u('a', { comment: 'nhận' }));
  game.chat(u('a', { comment: 'nhận!' }));
  game.chat(u('b', { comment: 'nhận' })); // no sign yet
  const cards = of(events, 'card');
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].card, { sign: 'leo', edition: 'star' }); // rng 0: own sign, and the lowest roll (no sky edition without a sky)
  assert.equal(of(events, 'need-sign').at(-1).userId, 'b');
  advance(21000);
  assert.equal(of(events, 'chest-close')[0].claims, 1);
});

test('nobody around: the chest skips its turn', () => {
  const { events, advance } = setup({ chestEveryMinutes: 15, chestIdleMinutes: 10 });
  advance(14 * 60000);
  assert.equal(of(events, 'chest-open').length, 0);
});

test('"khoe thẻ" shows a viewer\'s collection, at most once a minute each', () => {
  const { game, events, advance } = setup({ chestEveryMinutes: 15, showCooldownSeconds: 60 });
  advance(14 * 60000 - 1000);
  game.chat(u('a', { comment: 'leo' }));
  advance(1000);
  game.chat(u('a', { comment: 'nhận' }));
  game.chat(u('a', { comment: 'khoe thẻ nè' }));
  game.chat(u('a', { comment: 'khoe thẻ' }));
  const shown = of(events, 'collection');
  assert.equal(shown.length, 1);
  assert.equal(shown[0].unique, 1);
  assert.equal(shown[0].total, 120); // 12 signs × (5 classic + Hoàng Kim + 4 themed-hour editions)
});

test('keywords: "nhận" claims, "thuận" fixes, "khoe thẻ" shows; "nhân mã" is still just a sign', () => {
  assert.equal(parseAction('nhận'), 'claim');
  assert.equal(parseAction('Mở rương!'), 'claim');
  assert.equal(parseAction('nhân mã'), null);
  assert.equal(parseAction('nhận xét hay'), null);
  assert.equal(parseAction('thuận'), 'fix');
  assert.equal(parseAction('sửa sóng đi'), 'fix');
  assert.equal(parseAction('mọi việc thuận lợi'), null);
  assert.equal(parseAction('khoe thẻ'), 'cards');
  assert.equal(parseAction('xem thẻ của mình'), 'cards');
});

test('director keeps the crits and the rare cards when a frame overflows', () => {
  const d = createDirector({ hits: 2, cards: 2 });
  for (let i = 0; i < 5; i++) d.push({ type: 'boss-hit', userId: `h${i}`, sign: 'leo', dmg: 10, crit: i === 4 });
  for (let i = 0; i < 5; i++) d.push({ type: 'card', userId: `c${i}`, card: { sign: 'leo', edition: i === 4 ? 'star' : 'base' } });
  d.push({ type: 'swap', from: 'leo', to: 'aquarius', amount: 2 });
  const fx = d.flush();
  const hits = fx.find(e => e.type === 'boss-hits');
  assert.equal(hits.bySign.leo, 50);
  assert.ok(hits.hits.some(h => h.crit));
  const cards = fx.find(e => e.type === 'cards');
  assert.ok(cards.cards.some(c => c.card.edition === 'star'));
  assert.equal(cards.more, 2);
  assert.deepEqual(fx.find(e => e.type === 'swaps').swaps, [{ from: 'leo', to: 'aquarius' }]);
});
