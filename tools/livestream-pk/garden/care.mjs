// Planting, watering, pests, harvesting and the per-tick growth of every awake plot.
import { CROPS, seedCost, stageOf } from './crops.mjs';
import { addGold, addXp, spendGold } from './progress.mjs';
import { bump, isAwake, touch } from './world.mjs';

const plotOf = (ctx, user) => user.seat && ctx.state.plots[`${user.seat.tier}:${user.seat.slot}`];
const mods = ctx => ctx.mods?.() ?? { grow: 1, gold: 1, boost: null };
const fail = reason => ({ ok: false, reason });
const gain = (ctx, user, xp, plot) => { const r = addXp(user, xp); if (r.leveledUp) ctx.emit({ type: 'levelup', userId: user.userId, plotId: plot?.id ?? null, level: r.level }); };

export function plant(ctx, user, cropId) {
  const plot = plotOf(ctx, user), crop = CROPS[cropId];
  if (!plot || !crop) return fail('no-plot');
  if (plot.crop) return fail('busy');
  if (user.level < crop.minLevel) return fail('level');
  if (!spendGold(user, seedCost(cropId, ctx.cfg))) return fail('gold');
  plot.crop = { type: cropId, progress: 0, ripeAt: null, pest: false, stolen: 0 };
  plot.water = 1;
  touch(ctx, user);
  ctx.emit({ type: 'plant', plotId: plot.id, userId: user.userId, crop: cropId });
  return { ok: true };
}

export function water(ctx, user, target = user) {
  const plot = plotOf(ctx, target), now = ctx.now();
  if (!plot) return fail('no-plot');
  if (!plot.crop) return fail('no-crop');
  if (now - (plot.wateredAt ?? -Infinity) < ctx.cfg.waterCooldownMs) return fail('cooldown');
  const helping = target !== user;
  const pair = `${user.userId}>${target.userId}`;
  if (helping) {
    user.helped ??= {};
    if (now - (user.helped[pair] ?? -Infinity) < ctx.cfg.helpCooldownMs) return fail('cooldown');
    user.helped[pair] = now;
  }
  plot.wateredAt = now;
  plot.water = 1;
  if (plot.crop.progress < 1) {
    plot.crop.progress = Math.min(1, plot.crop.progress + ctx.cfg.waterBoost);
    if (plot.crop.progress >= 1) { plot.crop.ripeAt = now; ctx.emit({ type: 'ripe', plotId: plot.id, userId: target.userId, crop: plot.crop.type, first: target.stats.harvest === 0 }); }
  }
  touch(ctx, user);
  if (helping) {
    gain(ctx, user, ctx.cfg.helpXp, plotOf(ctx, user));
    gain(ctx, target, ctx.cfg.helpXp, plot);
    addGold(user, ctx.cfg.helpGold);
    ctx.emit({ type: 'help', plotId: plot.id, userId: user.userId, targetId: target.userId });
  } else ctx.emit({ type: 'water', plotId: plot.id, userId: user.userId });
  bump(ctx, plot);
  return { ok: true };
}

export function catchPests(ctx, user) {
  const plot = plotOf(ctx, user);
  if (!plot?.crop?.pest) return fail('no-pest');
  plot.crop.pest = false;
  touch(ctx, user);
  ctx.onPestCleared?.(user.userId);
  ctx.emit({ type: 'pest-cleared', plotId: plot.id, userId: user.userId });
  return { ok: true, cleared: true };
}

export function harvest(ctx, user) {
  const plot = plotOf(ctx, user);
  if (!plot?.crop) return fail('no-crop');
  const stage = stageOf(plot.crop, ctx.now(), ctx.cfg);
  if (stage < 3) return fail('not-ripe');
  const def = CROPS[plot.crop.type], m = mods(ctx);
  const factor = (1 - ctx.cfg.stealFrac * plot.crop.stolen) * (plot.crop.pest ? ctx.cfg.pestYield : 1) * (stage === 4 ? ctx.cfg.oldYield : 1) * m.gold * (m.boost?.crop === def.id ? m.boost.mult : 1);
  const gold = Math.max(1, Math.round(def.gold * factor));
  addGold(user, gold);
  user.stats.harvest++;
  plot.crop = null;
  touch(ctx, user);
  gain(ctx, user, def.xp, plot);
  ctx.emit({ type: 'harvest', plotId: plot.id, userId: user.userId, gold, xp: def.xp, crop: def.id });
  return { ok: true, gold, xp: def.xp, factor };
}

// Advance every awake crop. dt is clamped so a frozen host (laptop asleep) cannot ripen the whole garden at once.
export function tickPlots(ctx) {
  const now = ctx.now(), dt = Math.max(0, Math.min(now - ctx.state.lastTick, ctx.cfg.tickMaxDtMs));
  ctx.state.lastTick = now;
  if (!dt) return;
  const m = mods(ctx), cfg = ctx.cfg;
  for (const plot of Object.values(ctx.state.plots)) {
    if (!plot.crop || !isAwake(ctx, plot)) continue;
    const crop = plot.crop;
    plot.water = Math.max(0, plot.water - dt / cfg.waterDecayMs);
    if (crop.progress < 1) {
      if (!crop.pest && ctx.rng() < cfg.pestChancePerSec * dt / 1000) { crop.pest = true; ctx.emit({ type: 'pest', plotId: plot.id, userId: plot.owner }); }
      crop.progress += dt / CROPS[crop.type].growMs * (plot.water > 0 ? 1 : cfg.dryGrowth) * (crop.pest ? cfg.pestGrowth : 1) * m.grow;
      if (crop.progress >= 1) { crop.progress = 1; crop.ripeAt = now; ctx.emit({ type: 'ripe', plotId: plot.id, userId: plot.owner, crop: crop.type, first: ctx.state.users[plot.owner]?.stats.harvest === 0 }); }
    }
    bump(ctx, plot);
  }
}
