import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, parseAction } from './game.mjs';

const OFF = { bossEverySeconds: 0, chestEveryMinutes: 0 };
const setup = (config = {}) => {
  let t = Date.UTC(2026, 10, 3, 12, 1);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, onEvent: e => events.push(e), config: { acts: false, autoQuiz: false, quietSeconds: 9999, moonGoal: 1e9, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, ...OFF, ...config } });
  return { game, events, advance: ms => { t += ms; game.tick(); } };
};
const u = (id, extra) => ({ userId: id, nickname: id, ...extra });
const of = (events, type) => events.filter(e => e.type === type);

test('keywords for the bag, upgrades and blessing a wish', () => {
  assert.equal(parseAction('nâng cấp'), 'upgrade');
  assert.equal(parseAction('lên cấp đi'), 'upgrade');
  assert.equal(parseAction('kho'), 'vault');
  assert.equal(parseAction('kho báu ở đâu'), null);
  assert.equal(parseAction('chúc bạn thành công'), 'bless');
  assert.equal(parseAction('cầu chúc bình an'), 'wish');
});

test('starlight drops stardust into the bag', () => {
  const { game } = setup({ commentLight: 10, dustPerLight: 0.5 });
  game.chat(u('a', { comment: 'leo' }));
  assert.equal(game.state.viewers.a.bag.dust, 5);
});

test('"nâng cấp" says what is missing, then levels up once the bag holds enough, and the level adds starlight', () => {
  const { game, events } = setup({ commentLight: 10, levelDust: [5, 999, 999, 999], levelGems: [1, 1, 1, 1], levelMoon: [0, 0, 0, 0], levelBonus: 0.5, commentCooldownSeconds: 0 });
  game.chat(u('a', { comment: 'leo' }));
  game.chat(u('a', { comment: 'nâng cấp' }));
  assert.deepEqual(of(events, 'upgrade-need')[0].missing, { fire: 1 });
  game.state.viewers.a.bag.fire = 1;
  game.chat(u('a', { comment: 'nâng cấp' }));
  assert.equal(of(events, 'level-up')[0].level, 2);
  assert.equal(game.state.viewers.a.bag.fire, 0);
  const before = game.state.wheel.given.leo;
  game.chat(u('a', { comment: 'hay' }));
  assert.equal(game.state.wheel.given.leo - before, 15); // 10 × 1.5
  assert.equal(game.changes({}).stage.find(v => v.userId === 'a').level, 2);
});

test('gems come from the quiz, the boss and the chest; moon shards from a full moon', () => {
  const { game, advance } = setup({ passXpPerLevel: 1e9, moonGoal: 5, adaptiveCrowd: false, bossHpMin: 10, bossHpPerViewer: 1, bossDiamondDamage: 5, chestEveryMinutes: 15 });
  game.chat(u('a', { comment: 'song ngư' }));
  game.like(u('a', { count: 10 }));
  assert.equal(game.state.viewers.a.bag.moon, 1);
  game.startBoss();
  game.gift(u('a', { diamonds: 5, count: 1 }));
  assert.equal(game.state.viewers.a.bag.water, 4); // the MVP's double share
  advance(13 * 60000);
  game.chat(u('a', { comment: 'còn đây' }));
  advance(60000);
  game.chat(u('a', { comment: 'nhận' }));
  assert.equal(game.state.viewers.a.bag.water, 5);
});

test('a wish the room blesses becomes a star: blessers get stardust, the wisher a moon shard', () => {
  const { game, events, advance } = setup({ blessNeed: 2, blessDust: 3, blessWindowSeconds: 30 });
  game.chat(u('w', { comment: 'leo' }));
  game.chat(u('w', { comment: 'ước thi đỗ đại học' }));
  assert.equal(of(events, 'wish')[0].text, 'thi đỗ đại học');
  game.chat(u('w', { comment: 'chúc' })); // not your own wish
  game.chat(u('b1', { comment: 'chúc bạn đỗ nha' }));
  game.chat(u('b1', { comment: 'chúc' })); // once each
  assert.equal(of(events, 'wish-bless').length, 1);
  game.chat(u('b2', { comment: 'chúc phúc' }));
  const done = of(events, 'wish-blessed')[0];
  assert.deepEqual(done.blessers, ['b1', 'b2']);
  assert.equal(game.state.viewers.w.bag.moon, 1);
  assert.equal(game.state.viewers.b1.bag.dust, 3);
  advance(60000);
  game.chat(u('w', { comment: 'ước có người yêu' }));
  advance(31000);
  game.chat(u('b1', { comment: 'chúc' })); // too late
  assert.equal(of(events, 'wish-bless').length, 2);
  const wishes = game.changes({}).cosmos.wishes;
  assert.deepEqual(wishes.map(w => [w.text, w.blessed, w.open]), [['có người yêu', false, false], ['thi đỗ đại học', true, false]]);
});

test('a gift big enough for several shared gift goals fills them all, with one celebration', () => {
  const { game, events } = setup({ giftGoal: 10, giftGoalGrowth: 1 });
  game.chat(u('a', { comment: 'leo' }));
  game.gift(u('a', { diamonds: 35, count: 1 }));
  assert.equal(of(events, 'gift-goal').length, 1);
  assert.equal(game.state.gifts.goalNo, 3);
  assert.equal(game.state.gifts.goalSum, 5);
});
