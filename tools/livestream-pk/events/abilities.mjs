// What a gift does in each event (spec section 5, Ruling N). The effects themselves live next to the event they change
// (boss.mjs, tug.mjs, roast.mjs, game.mjs); this file holds the constants, the short ids the overlay reads and the
// banner texts. The effects are fixed by the coins of the gift - nothing here is random - and no text here may ask
// for or hint at gifts (events/copy.test.mjs scans this file).

export const ABILITY_DEFAULTS = Object.freeze({
  bossUltFactor: 3, // Đòn tuyệt kỹ: extra damage = coins x this
  bossUltShield: 3, // ... and this much shield for the room
  tugBoostFactor: 2, // Tăng tốc: the giver's team pulls x this ...
  tugBoostSeconds: 60, // ... for this long
  tugGiftSwingMax: 35, // one gift never moves the rope (of +-100) more than this, boost included, so one gift cannot end a fresh tug
  raceBoostFactor: 1.5, // the finale: the giver's team light x this ...
  raceBoostSeconds: 30, // ... for this long
  raceAdvanceShare: 0.25, // a big gift: every team gets this share of the wheel cost
  goldChestDust: 40, // Rương vàng: bụi sao for each claimer ...
  goldChestGems: 2, // ... and gems of their own colour
  roastPickSeconds: 15, // the giver has this long to name the team the wheel lands on
  journeyGiftPerDiamond: 0.2, // chapter steps per coin for a small or mid gift
});

// event id -> tier -> ability id. A tier that is missing has no ability: the gift takes the ordinary path.
export const ABILITY_IDS = Object.freeze({
  boss: { mid: 'ultimate', big: 'thaw' },
  tug: { mid: 'yank', big: 'boost' },
  final: { mid: 'boost', big: 'advance' },
  chestrain: { mid: 'extra-chest', big: 'golden-chest' },
  wish: { small: 'bless', mid: 'gild', big: 'full-moon' },
  roast: { small: 'ticket', mid: 'pick', big: 'respin' },
  journey: { small: 'progress', mid: 'progress', big: 'complete' },
});

const TEXTS = {
  boss: { mid: 'Đòn tuyệt kỹ!', big: 'Phá băng!' },
  tug: { mid: 'Giật mạnh!', big: 'Tăng tốc phe!' },
  final: { mid: 'Phe bừng sáng x1,5!', big: 'Cả vòng sáng thêm một chặng!' },
  chestrain: { mid: 'Thêm một rương!', big: 'Rương vàng!' },
  wish: { small: 'Thêm một lời chúc!', mid: 'Đèn hóa sao vàng!', big: 'Trăng đầy!' },
  roast: { small: '+1 vé quay!', mid: 'Chọn phe quay trúng!', big: 'Quay lại cả vòng!' },
  journey: { small: 'Chặng tiến thêm!', mid: 'Chặng tiến thêm!', big: 'Hoàn thành chặng!' },
};

// the banner text for an ability, or null when that event and tier have none
export const describeAbility = (eventId, tier) => TEXTS[eventId]?.[tier] ?? null;
