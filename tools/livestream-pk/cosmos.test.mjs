import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseAction } from './game.mjs';
import { createDirector } from './director.mjs';

const OFF = { bossEverySeconds: 0, chestEveryMinutes: 0 };
const setup = (config = {}) => {
  let t = Date.UTC(2026, 10, 3, 12, 1);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, onEvent: e => events.push(e), config: { acts: false, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...OFF, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); }, at: () => t };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);

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

test('beating the boss pays everyone who hit it, and the top hitter gets the bigger bụi sao share', () => {
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
  assert.ok(game.state.viewers.big.bag.dust >= game.state.viewers.small.bag.dust + 10, 'the MVP is paid 15 dust, the others 5');
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

test('the star chest opens on the quarter hour while people are around; one share per viewer per chest', () => {
  const { game, events, advance } = setup({ chestEveryMinutes: 15, chestOpenSeconds: 20 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('a', { comment: 'nhận' }));
  const dustBefore = game.state.viewers.a.bag.dust;
  assert.equal(game.state.chest.claimed.a, undefined); // not open yet
  assert.equal(game.changes({}).cosmos.chest.inMs, 14 * 60000);
  advance(13 * 60000);
  game.chat(u('a', { comment: 'vẫn ở đây' }));
  advance(60000);
  assert.equal(of(events, 'chest-open').length, 1);
  game.chat(u('a', { comment: 'nhận' }));
  game.chat(u('a', { comment: 'nhận!' }));
  game.chat(u('b', { comment: 'nhận' })); // no sign yet
  assert.equal(Object.keys(game.state.chest.claimed).length, 1);
  assert.equal(game.state.viewers.a.bag.dust - dustBefore >= 15, true, 'the claim pays 15 bụi sao');
  assert.deepEqual(game.state.chest.recent, [{ nickname: 'a', dust: 15 }]);
  assert.equal(of(events, 'need-sign').at(-1).userId, 'b');
  advance(21000);
  assert.equal(of(events, 'chest-close')[0].claims, 1);
});

test('nobody around: the chest skips its turn', () => {
  const { events, advance } = setup({ chestEveryMinutes: 15, chestIdleMinutes: 10 });
  advance(14 * 60000);
  assert.equal(of(events, 'chest-open').length, 0);
});

test('"kho" shows a viewer vault, at most once per cooldown each', () => {
  const { game, events, advance } = setup({ chestEveryMinutes: 15, vaultCooldownSeconds: 60 });
  advance(14 * 60000 - 1000);
  game.chat(u('a', { comment: 'leo' }));
  advance(1000);
  game.chat(u('a', { comment: 'nhận' }));
  game.chat(u('a', { comment: 'kho nè' }));
  game.chat(u('a', { comment: 'kho' }));
  const shown = of(events, 'vault');
  assert.equal(shown.length, 1);
  assert.ok(!('cards' in shown[0]) && !('bingo' in shown[0]));
});

test('keywords: "nhận" claims, "kho" shows; "nhân mã" is still just a sign', () => {
  assert.equal(parseAction('nhận'), 'claim');
  assert.equal(parseAction('Mở rương!'), 'claim');
  assert.equal(parseAction('nhân mã'), null);
  assert.equal(parseAction('nhận xét hay'), null);
  assert.equal(parseAction('khoe kho'), 'vault');
  assert.equal(parseAction('xem thẻ của mình'), null);
});

test('director keeps the crits and the rare cards when a frame overflows', () => {
  const d = createDirector({ hits: 2, cards: 2 });
  for (let i = 0; i < 5; i++) d.push({ type: 'boss-hit', userId: `h${i}`, sign: 'leo', dmg: 10, crit: i === 4 });
  for (let i = 0; i < 5; i++) d.push({ type: 'card', userId: `c${i}`, card: { sign: 'leo', edition: i === 4 ? 'star' : 'base' } });
  const fx = d.flush();
  const hits = fx.find(e => e.type === 'boss-hits');
  assert.equal(hits.bySign.leo, 50);
  assert.ok(hits.hits.some(h => h.crit));
  const cards = fx.find(e => e.type === 'cards');
  assert.ok(cards.cards.some(c => c.card.edition === 'star'));
  assert.equal(cards.more, 2);
});
