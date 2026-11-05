// Every number of the Vườn Mây spec in one place; config.json's "garden" section overrides any of them.
export const GARDEN_DEFAULTS = Object.freeze({
  // One visible Seed Zone, tuned for phone readability on a real LIVE.
  // Two portrait wings × 7 shelves × 3 pots = 42 active seats; the removed row funds larger pots and labels.
  tierWidth: 1960, tierHeight: 1600, plotsPerTier: 42, plotsPerRow: 6, plotCell: 120,
  activeCapacity: 42, modulesPerRow: 1, moduleCapacity: 42, potsPerShelf: 3, shelvesPerModule: 7,
  rackWings: 2, shelvesPerWing: 7, rackWingGapX: 166,
  potSpacingX: 168, shelfSpacingY: 205, moduleGapX: 220, moduleGapY: 205,
  zoneMarginX: 160, zoneMarginY: 300, potScale: 1.62, potBottomOffset: 84, potShelfGap: 1,
  tierMarginX: 220, tierMarginY: 250,
  // Presence: inactive pots leave the active scene quickly, then release the seat later.
  sleepAfterMs: 90000, evictAfterMs: 180000, tickMaxDtMs: 5000, plotSyncMs: 5000, sessionMs: 600000, awardsMs: 8000,
  // growth and care
  graceMs: 120000, oldYield: 0.5,
  waterDecayMs: 900000, dryGrowth: 0.5, waterBoost: 0.015, waterCooldownMs: 15000, waterSpeedMs: 30000, waterSpeedMult: 1.25,
  pestChancePerSec: 0.003, pestGrowth: 0.6, pestYield: 0.7,
  weedChancePerSec: 0.0018, weedGrowth: 0.72, weedYield: 0.88,
  fertilizeCost: 3, fertilizeBoost: 0.03, fertilizedGrowth: 1.18, fertilizedYield: 1.12,
  careGapMs: 1500, startGold: 20, helpXp: 2, helpGold: 1, helpCooldownMs: 30000, seedCostRate: 0.4,
  // stealing
  stealFrac: 0.2, stealMaxPerCrop: 2, stealCooldownMs: 20000, stealPerVictimMax: 3, stealVictimWindowMs: 600000,
  catchWindowMs: 10000, caughtBanMs: 60000, dogMs: 600000, dogCost: 30,
  shieldLevel: 2, shieldMs: 180000, shieldAfterStolen: 2, shieldStolenWindowMs: 180000,
  // gifts (total xu = diamonds x count)
  giftTiers: Object.freeze([5, 100, 1000]), dewProgress: 0.1, treeBlessingMs: 60000, rouletteBuffMs: 45000, rouletteMult: 1.3, prankMs: 20000,
  bossChance: .35, bossDelayMs: 120000, bossDurationMs: 60000, bossRewardXp: 8, bossRewardGold: 5, brokenMs: 8000,
  // field events
  eventMinMs: 180000, eventMaxMs: 300000, rainMs: 30000, rainMult: 2, pestStormMs: 20000, stormShare: 0.5, stormPass: 0.8, stormReward: 5,
  merchantMs: 60000, merchantMult: 2, goldenMs: 30000, goldenMult: 2,
  // camera
  camera: Object.freeze({
    holdMinMs: 1600, welcomeHoldMs: 0, giftHoldMs: 6200, lowGiftHoldMs: 2400,
    stealHoldMs: 1800, levelHoldMs: 1600, eventHoldMs: 1800, stableMinMs: 1600, overviewHoldMs: 6000, idleMs: 6000,
    queueMax: 7, giftTtlMs: 42000, ttlMs: 28000, mergeMs: 2200,
    quotaWindowMs: 60000, quotaMin: 2, easeMs: 500, overviewEaseMs: 600,
    zoomWorld: 0.48, zoomTier: 1.03, zoomClose: 2.35,
  }),
});

export const gardenConfig = (over = {}) => ({ ...GARDEN_DEFAULTS, ...over, camera: { ...GARDEN_DEFAULTS.camera, ...over.camera } });
