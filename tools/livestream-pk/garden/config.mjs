// Every number of the Vườn Mây spec in one place; config.json's "garden" section overrides any of them.
export const GARDEN_DEFAULTS = Object.freeze({
  // Four horizontal cloud terraces, stacked vertically; 108 plots each preserves the 432-player capacity.
  tierWidth: 2700, tierHeight: 1200, plotsPerTier: 108, plotsPerRow: 18, plotCell: 120, tierMarginX: 270, tierMarginY: 240,
  sleepAfterMs: 300000, tickMaxDtMs: 5000,
  // growth and care
  graceMs: 120000, oldYield: 0.5,
  waterDecayMs: 60000, dryGrowth: 0.5, waterBoost: 0.06, waterCooldownMs: 15000,
  pestChancePerSec: 0.003, pestGrowth: 0.6, pestYield: 0.7,
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
  camera: Object.freeze({ holdMinMs: 2000, giftHoldMs: 4000, lowGiftHoldMs: 2500, stealHoldMs: 3000, levelHoldMs: 2500, queueMax: 8, giftTtlMs: 15000, ttlMs: 6000, mergeMs: 1500, gapMs: 1000, quotaWindowMs: 60000, quotaMin: 2, idleHoldMs: 8000, eventHoldMs: 4000, zoomWorld: 0.34, zoomTier: 0.4, zoomClose: 1 }),
});

export const gardenConfig = (over = {}) => ({ ...GARDEN_DEFAULTS, ...over, camera: { ...GARDEN_DEFAULTS.camera, ...over.camera } });
