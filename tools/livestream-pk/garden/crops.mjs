// The crop table and the growth stages. progress runs 0..1; at 1 the crop is ripe and `ripeAt` is stamped.
export const CROPS = Object.freeze({
  rau: { id: 'rau', label: 'Rau', minLevel: 1, growMs: 180000, gold: 10, xp: 5 },
  huongduong: { id: 'huongduong', label: 'Hướng dương', minLevel: 2, growMs: 300000, gold: 22, xp: 12 },
  nammay: { id: 'nammay', label: 'Nấm mây', minLevel: 4, growMs: 480000, gold: 45, xp: 25 },
});

const fold = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd').replace(/\s+/g, '').trim();
export const cropByName = text => Object.keys(CROPS).find(id => fold(text).replaceAll(' ', '') === id) ?? null;
export const seedCost = (id, cfg) => Math.round(CROPS[id].gold * cfg.seedCostRate);

export const STAGE_AT = Object.freeze([0, 0.2, 0.55, 1]);

// 0 seed, 1 sprout, 2 growing, 3 ripe, 4 old (ripe longer than the grace period)
export function stageOf(crop, now, cfg) {
  if (crop.progress >= 1) return now - crop.ripeAt > cfg.graceMs ? 4 : 3;
  return crop.progress < STAGE_AT[1] ? 0 : crop.progress < STAGE_AT[2] ? 1 : 2;
}

export function advanceStage(crop, now) {
  if (crop.progress >= 1) return;
  crop.progress = STAGE_AT.find(at => at > crop.progress) ?? 1;
  if (crop.progress >= 1) crop.ripeAt = now;
}
