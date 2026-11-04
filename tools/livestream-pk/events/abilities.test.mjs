import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../game.mjs';
import { ABILITY_DEFAULTS, ABILITY_IDS, describeAbility } from './abilities.mjs';

// --- the table (spec section 5, Ruling N) ---
const ROWS = [
  ['boss', 'mid', 'ultimate', 'Đòn tuyệt kỹ!'],
  ['boss', 'big', 'thaw', 'Phá băng!'],
  ['tug', 'mid', 'yank', 'Giật mạnh!'],
  ['tug', 'big', 'boost', 'Tăng tốc phe!'],
  ['final', 'mid', 'boost', 'Phe bừng sáng x1,5!'],
  ['final', 'big', 'advance', 'Cả vòng sáng thêm một chặng!'],
  ['chestrain', 'mid', 'extra-chest', 'Thêm một rương!'],
  ['chestrain', 'big', 'golden-chest', 'Rương vàng!'],
  ['wish', 'small', 'bless', 'Thêm một lời chúc!'],
  ['wish', 'mid', 'gild', 'Đèn hóa sao vàng!'],
  ['wish', 'big', 'full-moon', 'Trăng đầy!'],
  ['roast', 'small', 'ticket', '+1 vé quay!'],
  ['roast', 'mid', 'pick', 'Chọn phe quay trúng!'],
  ['roast', 'big', 'respin', 'Quay lại cả vòng!'],
  ['journey', 'small', 'progress', 'Chặng tiến thêm!'],
  ['journey', 'mid', 'progress', 'Chặng tiến thêm!'],
  ['journey', 'big', 'complete', 'Hoàn thành chặng!'],
];

test('the ability table names every row and describeAbility gives its banner', () => {
  for (const [event, tier, ability, text] of ROWS) {
    assert.equal(ABILITY_IDS[event][tier], ability, `${event}/${tier}`);
    assert.equal(describeAbility(event, tier), text, `${event}/${tier}`);
  }
  assert.equal(describeAbility('quiz', 'big'), null);
  assert.equal(describeAbility('boss', 'small'), null, 'a small boss gift is the ordinary extra hit');
  assert.equal(describeAbility(null, 'mid'), null);
});

test('ability constants are the numbers of Ruling N', () => {
  assert.deepEqual(ABILITY_DEFAULTS, {
    bossUltFactor: 3, bossUltShield: 3, tugBoostFactor: 2, tugBoostSeconds: 60, tugGiftSwingMax: 35,
    raceBoostFactor: 1.5, raceBoostSeconds: 30, raceAdvanceShare: 0.25,
    goldChestDust: 40, goldChestGems: 2, roastPickSeconds: 15, journeyGiftPerDiamond: 0.2,
  });
});

// --- a whole game, one gift at a time ---
const CONFIG = { acts: false, bossEverySeconds: 0, chestEveryMinutes: 0, showEverySeconds: 0, autoQuiz: false, quietSeconds: 9999, moonGoal: 600, checkinPerNight: 0, luckyEverySeconds: 1e9, adaptiveCrowd: false, commentLight: 0, lightPerDiamond: 1, teamLightCost: 1000, bossHpMin: 100000, bossDiamondDamage: 5 };
function mk(config = {}) {
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const game = createGame({ now: () => t, rng: () => 0, onEvent: e => events.push(e), config: { ...CONFIG, ...config } });
  const api = {
    game, events, st: game.state,
    advance: ms => { t += ms; game.tick(); },
    now: () => t,
    of: type => events.filter(e => e.type === type),
    abilities: () => events.filter(e => e.type === 'gift-ability'),
    seat(id, team) {
      game.state.viewers[id] = { nickname: id.toUpperCase(), avatar: `av-${id}`, team, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 };
      game.like({ userId: id, nickname: id.toUpperCase(), count: 0 });
    },
    give(id, diamonds) { return game.gift({ userId: id, nickname: id.toUpperCase(), diamonds, count: 1, giftName: 'Rose' }); },
    say(id, comment) { game.chat({ userId: id, nickname: id.toUpperCase(), comment }); },
  };
  return api;
}
const FOUR = s => { s.seat('r1', 'red'); s.seat('b1', 'blue'); s.seat('y1', 'yellow'); s.seat('g1', 'green'); };
const lightOf = (s, team) => s.st.wheel.light[team];

test('giftEventId: the running event, a headliner that is not a registry event, a lantern, the journey, else null', () => {
  const s = mk();
  FOUR(s);
  assert.equal(s.game.giftEventId(), 'journey', 'a quiet room: the night journey');
  s.say('r1', 'ước được điểm cao');
  assert.equal(s.game.giftEventId(), 'wish', 'an un-gilded lantern is pending');
  s.advance(60_000);
  assert.equal(s.game.giftEventId(), 'journey', 'the lantern window is over');
  s.game.startBoss(3);
  assert.equal(s.game.giftEventId(), 'boss');
  s.st.boss = null; // beaten, but the registry has not ticked yet
  assert.equal(s.game.giftEventId(), 'journey', 'a finished event is not an event');
  s.advance(1000);
  assert.ok(s.game.startHead('final'));
  assert.equal(s.game.giftEventId(), 'final');
  s.st.head = null;
  assert.ok(s.game.startHead('chestrain'));
  assert.equal(s.game.giftEventId(), 'chestrain');
  s.st.head = null;
  assert.ok(s.game.startHead('moonnight'));
  assert.equal(s.game.giftEventId(), 'wish');
  s.st.head = null;
  s.st.journey = { night: s.st.night.no, i: 4, got: 0, done: true };
  assert.equal(s.game.giftEventId(), null);
});

test('the tiers: quiz, guess and starcatch have no abilities and fall to the default path', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('starcatch');
  assert.equal(s.game.giftEventId(), 'starcatch');
  const before = lightOf(s, 'red');
  s.give('r1', 150);
  assert.equal(s.abilities().length, 0);
  assert.equal(lightOf(s, 'red') - before, 150);
});

// --- Boss ---
test('boss small: the ordinary extra hit, no ability', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  const hp = s.st.boss.hp;
  s.give('b1', 5);
  assert.equal(s.abilities().length, 0);
  assert.equal(hp - s.st.boss.hp, 25);
  assert.equal(s.of('boss-hit').at(-1).nickname, 'B1');
});

test('boss mid: Đòn tuyệt kỹ — fixed extra damage diamonds x3 and 3 shield, once', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  const hp = s.st.boss.hp;
  s.give('b1', 20);
  assert.deepEqual(s.abilities().map(({ type, event, tier, ability, userId, nickname, team, diamonds }) => ({ type, event, tier, ability, userId, nickname, team, diamonds })), [
    { type: 'gift-ability', event: 'boss', tier: 'mid', ability: 'ultimate', userId: 'b1', nickname: 'B1', team: 'blue', diamonds: 20 },
  ]);
  assert.equal(s.abilities()[0].text, 'Đòn tuyệt kỹ!');
  assert.equal(s.st.boss.shield, 3);
  assert.equal(hp - s.st.boss.hp, 20 * 5 + 20 * 3, 'the normal hit plus the ultimate');
  assert.equal(s.of('boss-hit').filter(h => h.ultimate).length, 1);
});

test('boss big: Phá băng thaws the giver\'s team only, then the same damage as mid', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  s.st.boss.frozen = { team: 'red', until: s.now() + 99_999, need: 2, rescuers: {} };
  const hp = s.st.boss.hp;
  s.give('b1', 100); // blue is not frozen: the ice stays
  assert.equal(s.st.boss.frozen.team, 'red');
  assert.equal(s.of('boss-rescue').length, 0);
  assert.equal(s.abilities()[0].ability, 'thaw');
  assert.equal(hp - s.st.boss.hp, 100 * 5 + 100 * 3);
  const hp2 = s.st.boss.hp;
  s.give('r1', 100);
  assert.equal(s.st.boss.frozen, null, 'the giver\'s team is free');
  assert.deepEqual(s.of('boss-rescue').map(e => [e.team, e.nickname]), [['red', 'R1']]);
  assert.equal(hp2 - s.st.boss.hp, 100 * 5 * 2 + 100 * 3, 'thawed first, so the red crit lands too');
  assert.equal(s.abilities().length, 2);
});

test('boss big that lands the kill names the giver as the finisher', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  s.st.boss.hp = 200;
  s.give('g1', 100);
  const end = s.of('boss-defeated')[0];
  assert.equal(end.finisher.nickname, 'G1');
  assert.equal(end.finisher.team, 'green');
  assert.equal(end.finisher.ability, 'thaw');
  assert.equal(s.st.boss, null);
});

test('boss mid on a frozen team: the shield still rises, the frozen team deals no damage', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  s.st.boss.frozen = { team: 'red', until: s.now() + 99_999, need: 2, rescuers: {} };
  const hp = s.st.boss.hp;
  s.give('r1', 20);
  assert.equal(s.st.boss.hp, hp);
  assert.equal(s.st.boss.shield, 3);
});

test('a gift right after the boss was beaten uses the default path: no boss ability, light once, no throw', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  s.st.boss.hp = 1;
  s.give('b1', 5); // beats it
  assert.equal(s.of('boss-defeated').length, 1);
  const before = lightOf(s, 'blue'), n = s.abilities().length, count = s.st.gifts.count;
  assert.doesNotThrow(() => s.give('b1', 50));
  assert.equal(s.abilities().filter(a => a.event === 'boss').length, 0);
  assert.equal(lightOf(s, 'blue') - before, 50, 'the team light grows by diamonds x lightPerDiamond, once');
  assert.equal(s.st.gifts.count, count + 1);
  assert.ok(s.abilities().length <= n + 1);
});

// --- Tug ---
const tugRoom = () => {
  const s = mk();
  s.seat('r1', 'red'); s.seat('r2', 'red'); s.seat('b1', 'blue'); s.seat('b2', 'blue');
  assert.ok(s.game.startTug());
  s.advance(16_000);
  return s;
};

test('tug small: an ordinary pull, no ability', () => {
  const s = tugRoom();
  const v = s.st.tug.value;
  s.give('r1', 4);
  assert.equal(s.abilities().length, 0);
  assert.equal(s.st.tug.value - v, -10, 'red is team a: the knot moves negative');
});

test('tug mid: Giật mạnh — a named tug-yank', () => {
  const s = tugRoom();
  s.give('b1', 20);
  const y = s.of('tug-yank');
  assert.equal(y.length, 1);
  assert.deepEqual([y[0].userId, y[0].nickname, y[0].team], ['b1', 'B1', 'blue']);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability, a.nickname]), [['tug', 'mid', 'yank', 'B1']]);
});

test('tug mid during the warm-up is not an ability (nothing pulls yet)', () => {
  const s = mk();
  s.seat('r1', 'red'); s.seat('b1', 'blue');
  s.game.startTug();
  s.give('r1', 20);
  assert.equal(s.abilities().length, 0);
});

test('tug big: Tăng tốc — the giver\'s team pulls x2 for 60 seconds, a gift alone cannot end the tug', () => {
  const s = tugRoom();
  s.give('r1', 100);
  assert.ok(s.st.tug, 'one gift does not win the tug');
  assert.deepEqual([s.st.tug.boost.team, s.st.tug.boost.until - s.now()], ['red', 60_000]);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['tug', 'big', 'boost']]);
  const v = s.st.tug.value;
  s.give('r2', 4); // red: 10 x2
  assert.equal(v - s.st.tug.value, 20);
  const w = s.st.tug.value;
  s.give('b1', 4); // blue is not boosted
  assert.equal(s.st.tug.value - w, 10);
  s.advance(61_000);
  const x = s.st.tug.value;
  s.give('r2', 4);
  assert.equal(x - s.st.tug.value, 10, 'the boost is over');
});

// --- Race (the finale headliner) ---
test('final small: just the team light', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('final');
  s.give('r1', 5);
  assert.equal(s.abilities().length, 0);
  assert.equal(lightOf(s, 'red'), 5);
});

test('final mid: the giver\'s team light x1.5 for 30 seconds', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('final');
  s.give('r1', 20);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['final', 'mid', 'boost']]);
  assert.deepEqual([s.st.teamBoost.red.mult, s.st.teamBoost.red.until - s.now()], [1.5, 30_000]);
  const before = lightOf(s, 'red');
  s.say('r1', 'hello'); // commentLight is 0: use a like carry instead
  s.give('r1', 4); // a small gift: 4 x 1.5 = 6
  assert.equal(lightOf(s, 'red') - before, 6);
  s.give('b1', 4);
  assert.equal(lightOf(s, 'blue') - 4 >= 0, true);
  assert.equal(lightOf(s, 'blue'), 4, 'another team is not boosted');
  s.advance(31_000);
  const after = lightOf(s, 'red');
  s.give('r1', 4);
  assert.equal(lightOf(s, 'red') - after, 4, 'the boost has run out');
});

test('final big: every team gets a quarter of the wheel cost, the race gap stays', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('final');
  s.give('r1', 100);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['final', 'big', 'advance']]);
  const cost = s.st.wheel.cost;
  assert.equal(cost, 1000);
  assert.deepEqual(['red', 'yellow', 'green', 'blue'].map(t => lightOf(s, t)), [350, 250, 250, 250], 'the giver\'s own 100 plus a stage for everyone');
});

test('final big can finish the wheel: the pour rules apply (a team that is lit overflows to the dimmest)', () => {
  const s = mk({ teamLightCost: 100 });
  FOUR(s);
  s.game.startHead('final');
  s.give('r1', 100); // red lit by its own gift; the stage then adds 25 to everyone
  assert.equal(s.of('lit').length >= 1, true);
  assert.equal(s.st.wheel.no, 1);
  s.give('b1', 100);
  s.give('y1', 100);
  s.give('g1', 100);
  assert.equal(s.of('wheel-complete').length >= 1, true);
});

// --- Chest rain ---
test('chestrain small: the ordinary team light', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('chestrain');
  s.give('r1', 3);
  assert.equal(s.abilities().length, 0);
});

test('chestrain mid: one extra opening (a fresh chest everybody may claim)', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('chestrain');
  s.say('r1', 'nhận');
  const no = s.st.chest.no, dust = s.st.viewers.r1.bag.dust;
  s.give('b1', 20);
  assert.equal(s.st.chest.no, no + 1);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['chestrain', 'mid', 'extra-chest']]);
  assert.equal(s.of('chest-open').length, 2, 'the head opened one, the gift one more');
  s.say('r1', 'nhận');
  assert.ok(s.st.viewers.r1.bag.dust > dust, 'the same person claims the new chest too');
  assert.equal(s.st.chest.gold, false);
});

test('chestrain big: Rương vàng — each claimer gets 40 bụi sao and 2 gems of their own colour', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('chestrain');
  s.give('b1', 100);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['chestrain', 'big', 'golden-chest']]);
  assert.equal(s.of('chest-open').at(-1).gold, true);
  const r = s.st.viewers.r1, bl = s.st.viewers.b1;
  const rd = r.bag?.dust ?? 0, rg = r.bag?.red ?? 0, bg = bl.bag?.blue ?? 0;
  s.say('r1', 'nhận');
  s.say('b1', 'nhận');
  s.say('r1', 'nhận');
  assert.equal(r.bag.dust - rd, 40);
  assert.equal(r.bag.red - rg, 2);
  assert.equal(bl.bag.blue - bg, 2);
});

// --- Wish / moon ---
test('wish small: the nearest un-gilded lantern gets one blessing from the giver', () => {
  const s = mk();
  FOUR(s);
  s.say('y1', 'ước đậu đại học');
  const w = s.st.wishes[0];
  s.give('b1', 3);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['wish', 'small', 'bless']]);
  assert.deepEqual(Object.keys(w.blessers), ['b1']);
  assert.equal(s.of('wish-bless').length, 1);
  s.give('b1', 3); // the same person cannot bless the same lantern twice
  assert.equal(Object.keys(w.blessers).length, 1);
  assert.equal(s.abilities().length, 1, 'no lantern left for them: the default path');
});

test('wish small: the lantern with the most blessings is the nearest, not the newest', () => {
  const s = mk();
  FOUR(s);
  s.say('g1', 'ước một');
  s.say('r1', 'chúc');
  s.say('y1', 'ước hai');
  const [newer, older] = s.st.wishes;
  assert.equal(Object.keys(older.blessers).length, 1);
  s.give('b1', 3);
  assert.deepEqual(Object.keys(older.blessers).sort(), ['b1', 'r1']);
  assert.deepEqual(Object.keys(newer.blessers), []);
});

test('wish mid: the nearest lantern turns gold now and its owner gets the moon shard', () => {
  const s = mk();
  FOUR(s);
  s.say('y1', 'ước bình an');
  const w = s.st.wishes[0];
  s.give('b1', 20);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['wish', 'mid', 'gild']]);
  assert.equal(w.blessed, true);
  assert.equal(s.of('wish-blessed').length, 1);
  assert.equal(s.of('wish-blessed')[0].nickname, 'Y1');
  assert.equal(s.st.viewers.y1.bag.moon, 1);
});

test('wish big: the moon is full now', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('moonnight');
  s.give('b1', 100);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['wish', 'big', 'full-moon']]);
  assert.equal(s.of('moon-full').length, 1);
  assert.equal(s.st.moon.full, 1);
});

test('wish small/mid with no lantern pending: nothing to bless, the default path', () => {
  const s = mk();
  FOUR(s);
  s.game.startHead('moonnight');
  s.give('b1', 3);
  s.give('b1', 20);
  assert.equal(s.abilities().length, 0);
});

// --- Roast ---
const roastRoom = () => {
  const s = mk();
  s.seat('r1', 'red'); s.seat('r2', 'red'); s.seat('b1', 'blue'); s.seat('g1', 'green');
  assert.ok(s.game.startRoast('r1'));
  return s;
};

test('roast small: +1 ticket for the giver, kept for the next wheel', () => {
  const s = roastRoom();
  s.give('b1', 3);
  s.give('b1', 3);
  assert.equal(s.st.roastTickets.b1, 2);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['roast', 'small', 'ticket'], ['roast', 'small', 'ticket']]);
});

test('roast mid: the giver names the team in a comment within 15 seconds; default is their own team', () => {
  const s = roastRoom();
  s.give('b1', 20);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['roast', 'mid', 'pick']]);
  assert.equal(s.st.roast.pick.userId, 'b1');
  s.advance(1000);
  s.say('b1', 'xanh lá');
  assert.equal(s.st.roast.team, 'green');
  assert.equal(s.st.roast.userId, 'g1');
  assert.equal(s.st.viewers.b1.team, 'blue', 'the pick comment does not move the giver');
  assert.equal(s.of('roast-start').at(-1).again, true);
  // timeout: their own team
  const t = roastRoom();
  t.give('g1', 20);
  t.advance(16_000);
  assert.equal(t.st.roast.team, 'green');
  assert.equal(t.st.roast.userId, 'g1');
});

test('roast big: rolls the whole wheel again, once', () => {
  const s = roastRoom();
  const first = s.st.roast.line;
  s.give('b1', 100);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['roast', 'big', 'respin']]);
  assert.equal(s.of('roast-start').length, 2);
  assert.notEqual(s.st.roast.userId, 'r1', 'a new person');
  assert.ok(s.st.roast.line);
  void first;
  s.give('g1', 100);
  assert.equal(s.of('roast-start').length, 2, 'only once per wheel');
  assert.equal(s.abilities().length, 1);
});

// --- Journey ---
test('journey small and mid add progress to a chapter with more than one step; big completes it', () => {
  const s = mk();
  FOUR(s);
  assert.equal(s.game.snapshot().cosmos.journey.id, 'gather');
  s.give('b1', 5);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['journey', 'small', 'progress']]);
  assert.equal(s.st.journey.got, 1, 'a 5-coin gift is worth one step of the five');
});

test('journey big completes the current chapter and opens the next', () => {
  const s = mk();
  FOUR(s);
  s.give('b1', 100);
  assert.deepEqual(s.abilities().map(a => [a.event, a.tier, a.ability]), [['journey', 'big', 'complete']]);
  assert.equal(s.of('chapter').length, 1);
  assert.equal(s.of('chapter')[0].id, 'gather');
  assert.equal(s.st.journey.i, 1);
});

test('journey mid never finishes a one-step chapter (that is the big gift\'s job)', () => {
  const s = mk();
  FOUR(s);
  Object.assign(s.st.journey, { i: 4, got: 0, done: false });
  s.give('b1', 50);
  assert.equal(s.of('chapter').length, 0);
  assert.equal(s.abilities().length, 0);
});

// --- no event ---
test('no event at all: the team light and the ordinary gift scene, no ability, no throw', () => {
  const s = mk();
  FOUR(s);
  s.st.journey = { night: s.st.night.no, i: 4, got: 0, done: true };
  assert.equal(s.game.giftEventId(), null);
  const before = lightOf(s, 'red');
  assert.doesNotThrow(() => s.give('r1', 150));
  assert.equal(lightOf(s, 'red') - before, 150);
  assert.equal(s.abilities().length, 0);
  assert.equal(s.of('gift').length, 1);
});

test('every gift is recorded, thanked and given an aura exactly once, with or without an ability', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  s.give('b1', 20);
  assert.equal(s.st.gifts.count, 1);
  assert.equal(s.st.gifts.diamonds, 20);
  assert.equal(s.st.thanks.filter(t => t.userId === 'b1').length, 1);
  assert.ok(s.st.viewers.b1.auraUntil > s.now());
  assert.equal(s.of('gift').length, 1);
  assert.equal(s.abilities().length, 1);
  assert.equal(lightOf(s, 'blue'), 20);
});

test('a zero-coin or malformed gift triggers no ability', () => {
  const s = mk();
  FOUR(s);
  s.game.startBoss(3);
  for (const d of [0, NaN, undefined, -3]) assert.doesNotThrow(() => s.game.gift({ userId: 'b1', nickname: 'B1', diamonds: d, count: 1 }));
  assert.equal(s.abilities().length, 0);
});

// --- JSON restore ---
test('tug.boost, teamBoost and roastTickets survive a JSON round trip', () => {
  const s = tugRoom();
  s.give('r1', 100);
  s.give('b1', 3); // not a ticket: the tug is on, not the wheel
  s.st.teamBoost = { red: { mult: 1.5, until: s.now() + 30_000 } };
  s.st.roastTickets = { b1: 2 };
  const saved = JSON.parse(JSON.stringify(s.st));
  assert.deepEqual(saved.tug.boost, s.st.tug.boost);
  const events = [];
  const again = createGame({ state: saved, now: () => s.now(), rng: () => 0, onEvent: e => events.push(e), config: { ...CONFIG } });
  assert.deepEqual(again.state.teamBoost, s.st.teamBoost);
  assert.deepEqual(again.state.roastTickets, { b1: 2 });
  const v = again.state.tug.value;
  again.gift({ userId: 'r2', nickname: 'R2', diamonds: 4, count: 1 });
  assert.equal(v - again.state.tug.value, 20, 'the restored boost still doubles the pull');
  again.gift({ userId: 'r1', nickname: 'R1', diamonds: 4, count: 1 });
  assert.ok(again.state.wheel.light.red > 0);
});
