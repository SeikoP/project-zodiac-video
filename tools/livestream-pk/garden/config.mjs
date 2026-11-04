// Every number of the Vườn Mây spec in one place; config.json's "garden" section overrides any of them.
export const GARDEN_DEFAULTS = Object.freeze({
  // One visible Seed Zone, tuned for a real <100-viewer LIVE.
  // One continuous rack, 16 shelves × 6 pots = 96 active seats. Legacy cloud-* saves migrate into this zone.
  tierWidth: 1320, tierHeight: 3900, plotsPerTier: 96, plotsPerRow: 6, plotCell: 120,
  activeCapacity: 96, modulesPerRow: 1, moduleCapacity: 96, potsPerShelf: 6, shelvesPerModule: 16,
  potSpacingX: 170, shelfSpacingY: 220, moduleGapX: 220, moduleGapY: 200,
  zoneMarginX: 230, zoneMarginY: 260, potScale: 1.05, potBottomOffset: 61, potShelfGap: 1,
  tierMarginX: 220, tierMarginY: 250,
  // Presence: inactive pots leave the active scene quickly, then release the seat later.
  sleepAfterMs: 90000, evictAfterMs: 480000, tickMaxDtMs: 5000, plotSyncMs: 5000,
  // growth and care
  graceMs: 120000, oldYield: 0.5,
  waterDecayMs: 900000, dryGrowth: 0.5, waterBoost: 0.015, waterCooldownMs: 15000,
  pestChancePerSec: 0.003, pestGrowth: 0.6, pestYield: 0.7,
  weedChancePerSec: 0.0018, weedGrowth: 0.72, weedYield: 0.88,
  fertilizeCost: 3, fertilizeBoost: 0.03, fertilizedGrowth: 1.18, fertilizedYield: 1.12,
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
    holdMinMs: 4600, welcomeHoldMs: 0, giftHoldMs: 6200, lowGiftHoldMs: 5000,
    stealHoldMs: 6000, levelHoldMs: 5600, eventHoldMs: 7600, stableMinMs: 4400,
    queueMax: 7, giftTtlMs: 42000, ttlMs: 28000, mergeMs: 2200,
    quotaWindowMs: 60000, quotaMin: 2, easeMs: 1450, overviewEaseMs: 1700,
    zoomWorld: 0.3, zoomTier: 0.82, zoomClose: 1.5,
  }),
});

export const gardenConfig = (over = {}) => ({ ...GARDEN_DEFAULTS, ...over, camera: { ...GARDEN_DEFAULTS.camera, ...over.camera } });
