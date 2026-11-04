// Every number of the Vườn Mây spec in one place; config.json's "garden" section overrides any of them.
export const GARDEN_DEFAULTS = Object.freeze({
  // Four persistent districts remain available, but a normal <100 viewer LIVE fills one readable
  // 18 × 6 district before opening the next. Plot IDs and the 432 hard ceiling remain compatible.
  tierWidth: 2700, tierHeight: 1200, plotsPerTier: 108, plotsPerRow: 18, plotCell: 120, tierMarginX: 270, tierMarginY: 240,
  // Presence: inactive pots leave the active scene quickly, then release the seat later.
  sleepAfterMs: 90000, evictAfterMs: 480000, tickMaxDtMs: 5000, plotSyncMs: 5000,
  // growth and care
  graceMs: 120000, oldYield: 0.5,
  waterDecayMs: 60000, dryGrowth: 0.5, waterBoost: 0.06, waterCooldownMs: 15000,
  pestChancePerSec: 0.003, pestGrowth: 0.6, pestYield: 0.7,
  weedChancePerSec: 0.0018, weedGrowth: 0.72, weedYield: 0.88,
  fertilizeCost: 3, fertilizeBoost: 0.08, fertilizedGrowth: 1.18, fertilizedYield: 1.12,
  careGapMs: 1500, startGold: 20, helpXp: 2, helpGold: 1, helpCooldownMs: 30000, seedCostRate: 0.4,
  // stealing
  stealFrac: 0.2, stealMaxPerCrop: 2, stealCooldownMs: 20000, stealPerVictimMax: 3, stealVictimWindowMs: 600000,
  catchWindowMs: 10000, caughtBanMs: 60000, dogMs: 600000, dogCost: 30,
  shieldLevel: 2, shieldMs: 180000, shieldAfterStolen: 2, shieldStolenWindowMs: 180000,
  // gifts (total xu = diamonds x count)
  giftTiers: Object.freeze([5, 100, 1000]), dewProgress: 0.1,
  // field events
  eventMinMs: 180000, eventMaxMs: 300000, rainMs: 30000, rainMult: 2, pestStormMs: 20000, stormShare: 0.5, stormPass: 0.8, stormReward: 5,
  merchantMs: 60000, merchantMult: 2, goldenMs: 30000, goldenMult: 2,
  // camera
  camera: Object.freeze({
    holdMinMs: 5200, welcomeHoldMs: 6000, giftHoldMs: 7000, lowGiftHoldMs: 5600,
    stealHoldMs: 6500, levelHoldMs: 6000, eventHoldMs: 9000,
    queueMax: 14, giftTtlMs: 60000, ttlMs: 45000, mergeMs: 2200,
    quotaWindowMs: 60000, quotaMin: 2, easeMs: 1800, overviewEaseMs: 2200,
    zoomWorld: 0.38, zoomTier: 0.82, zoomClose: 1.5,
  }),
});

export const gardenConfig = (over = {}) => ({ ...GARDEN_DEFAULTS, ...over, camera: { ...GARDEN_DEFAULTS.camera, ...over.camera } });
