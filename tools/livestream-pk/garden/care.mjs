// Planting, watering, pests, harvesting and the per-tick growth of every awake plot.
import { CROPS, CROP_VARIANTS, cropVariant, seedCost, stageOf } from './crops.mjs';
import { addGold, addXp, spendGold } from './progress.mjs';
import { bump, isAwake, touch } from './world.mjs';

const plotOf = (ctx, user) => user.seat && ctx.state.plots[`${user.seat.tier}:${user.seat.slot}`];
const mods = ctx => ctx.mods?.() ?? { grow: 1, gold: 1, boost: null };
const fail = reason => ({ ok: false, reason });
const gain = (ctx, user, xp, plot) => { const r = addXp(user, xp); if (r.leveledUp) ctx.emit({ type: 'levelup', userId: user.userId, plotId: plot?.id ?? null, level: r.level }); };
const snapshot = (ctx, plot) => plot ? {
  crop: plot.crop ? { type:plot.crop.type,variant:plot.crop.variant??'common',progress:plot.crop.progress,pest:Boolean(plot.crop.pest),weeds:Boolean(plot.crop.weeds),fertilized:Boolean(plot.crop.fertilized),stolen:plot.crop.stolen??0,stage:stageOf(plot.crop,ctx.now(),ctx.cfg) } : null,
  water: plot.water ?? 0, waterBoostUntil:plot.waterBoostUntil??0, speedUntil:plot.speedUntil??0,
  prank: plot.prank ? { kind:plot.prank.kind,until:plot.prank.until } : null, brokenUntil:plot.brokenUntil??0,replantCredit:Boolean(plot.replantCredit)
} : null;

export function growthInfo(ctx,plot){
  const crop=plot.crop;if(!crop)return null;
  const rate=(plot.water>0?1:ctx.cfg.dryGrowth)*(crop.pest?ctx.cfg.pestGrowth:1)
    *(crop.weeds?ctx.cfg.weedGrowth:1)*(crop.fertilized?ctx.cfg.fertilizedGrowth:1)
    *(plot.waterBoostUntil>ctx.now()?ctx.cfg.waterSpeedMult:1)
    *(plot.speedUntil>ctx.now()?ctx.cfg.rouletteMult:1)
    *(plot.prank?.kind==='slow'&&plot.prank.until>ctx.now()?.75:1)*mods(ctx).grow;
  return {rate,bonusPercent:Math.round((rate-1)*100+1e-8),waterBoostUntil:plot.waterBoostUntil??0,
    speedUntil:plot.speedUntil??0,fertilized:Boolean(crop.fertilized)};
}

export function plant(ctx, user, cropId = null, seedGift = false) {
  if (cropId == null) {
    const own = plotOf(ctx, user);
    cropId = own?.replantCredit ? 'rau' : Object.values(CROPS).filter(c => c.minLevel <= user.level && (seedGift || seedCost(c.id, ctx.cfg) <= user.gold)).at(-1)?.id ?? 'rau';
  }
  const plot = plotOf(ctx, user), crop = CROPS[cropId];
  if (!plot || !crop) return fail('no-plot');
  if(plot.brokenUntil>ctx.now())return {ok:false,reason:'broken',retryAfterMs:plot.brokenUntil-ctx.now()};
  if (plot.crop) return fail('busy');
  if (user.level < crop.minLevel) return { ...fail('level'),requiredLevel:crop.minLevel };
  if (!seedGift && !(plot.replantCredit&&cropId==='rau') && !spendGold(user, seedCost(cropId, ctx.cfg))) return { ...fail('gold'),requiredGold:seedCost(cropId,ctx.cfg) };
  const before=snapshot(ctx,plot);
  plot.replantCredit=false;
  plot.crop = { type: cropId, progress: 0, ripeAt: null, pest: false, weeds: false, fertilized: false, stolen: 0, variant: cropVariant(user.level, ctx.rng()) };
  plot.water = 1;
  plot.waterBoostUntil=plot.speedUntil=0;plot.prank=null;
  touch(ctx, user);
  ctx.emit({ type: 'plant', plotId: plot.id, userId: user.userId, crop: cropId, before, after:snapshot(ctx,plot) });
  return { ok: true, crop: cropId };
}

export function water(ctx, user, target = user) {
  const plot = plotOf(ctx, target), now = ctx.now();
  if (!plot) return fail('no-plot');
  if (!plot.crop) return fail('no-crop');
  if (now - (plot.wateredAt ?? -Infinity) < ctx.cfg.waterCooldownMs) return { ...fail('cooldown'), retryAfterMs:ctx.cfg.waterCooldownMs-(now-plot.wateredAt) };
  const helping = target !== user, before=snapshot(ctx,plot);
  const pair = `${user.userId}>${target.userId}`;
  if (helping) {
    user.helped ??= {};
    if (now - (user.helped[pair] ?? -Infinity) < ctx.cfg.helpCooldownMs) return { ...fail('cooldown'), retryAfterMs:ctx.cfg.helpCooldownMs-(now-user.helped[pair]) };
    user.helped[pair] = now;
  }
  plot.waterBoostUntil=now+ctx.cfg.waterSpeedMs;
  if(plot.prank?.kind==='dry')plot.prank=null;
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
    ctx.emit({ type: 'help', plotId: plot.id, userId: user.userId, targetId: target.userId, before, after:snapshot(ctx,plot) });
  } else ctx.emit({ type: 'water', plotId: plot.id, userId: user.userId, before, after:snapshot(ctx,plot) });
  bump(ctx, plot);
  return { ok: true };
}

export function catchPests(ctx, user, target = null) {
  let plot = plotOf(ctx, target ?? user);
  const event = ctx.state.event;
  if (!target && !plot?.crop?.pest && event?.kind === 'pests' && event.phase === 'active' && ctx.now() < event.endsAt) {
    plot = Object.values(ctx.state.plots).find(p => event.targets?.[p.id] === false && p.crop?.pest && isAwake(ctx, p));
  }
  if (!plot?.crop?.pest) return fail('no-pest');
  const before=snapshot(ctx,plot);
  plot.crop.pest = false;
  touch(ctx, user);
  bump(ctx, plot);
  ctx.onPestCleared?.(user.userId, plot.id);
  ctx.emit({ type: 'pest-cleared', plotId: plot.id, userId: user.userId, before, after:snapshot(ctx,plot) });
  return { ok: true, cleared: true };
}

export function clearWeeds(ctx, user, target = user) {
  const plot = plotOf(ctx, target);
  if (!plot?.crop?.weeds) return fail('no-weeds');
  const before=snapshot(ctx,plot);
  plot.crop.weeds = false;
  if(plot.prank?.kind==='weeds')plot.prank=null;
  touch(ctx, user);
  addGold(user, 1);
  gain(ctx, user, 1, plot);
  bump(ctx,plot);
  ctx.emit({ type: 'weed-cleared', plotId: plot.id, userId: user.userId, before, after:snapshot(ctx,plot) });
  return { ok: true, gold: 1, xp: 1 };
}

export function fertilize(ctx, user) {
  const plot = plotOf(ctx, user), now = ctx.now();
  if (!plot?.crop) return fail('no-crop');
  if (plot.crop.fertilized) return fail('already-fertilized');
  if (!spendGold(user, ctx.cfg.fertilizeCost)) return { ...fail('gold'),requiredGold:ctx.cfg.fertilizeCost };
  const before=snapshot(ctx,plot);
  plot.crop.fertilized = true;
  if (plot.crop.progress < 1) {
    plot.crop.progress = Math.min(1, plot.crop.progress + ctx.cfg.fertilizeBoost);
    if (plot.crop.progress >= 1) {
      plot.crop.ripeAt = now;
      ctx.emit({ type: 'ripe', plotId: plot.id, userId: user.userId, crop: plot.crop.type, first: user.stats.harvest === 0 });
    }
  }
  touch(ctx, user);
  ctx.emit({ type: 'fertilize', plotId: plot.id, userId: user.userId, before, after:snapshot(ctx,plot) });
  bump(ctx, plot);
  return { ok: true, progress: plot.crop.progress };
}

export function harvest(ctx, user) {
  const plot = plotOf(ctx, user);
  if (!plot?.crop) return fail('no-crop');
  const stage = stageOf(plot.crop, ctx.now(), ctx.cfg);
  if (stage < 3) return fail('not-ripe');
  const def = CROPS[plot.crop.type], m = mods(ctx), variant = CROP_VARIANTS[plot.crop.variant] ?? CROP_VARIANTS.common;
  const factor = (1 - ctx.cfg.stealFrac * plot.crop.stolen)
    * (plot.crop.pest ? ctx.cfg.pestYield : 1)
    * (plot.crop.weeds ? ctx.cfg.weedYield : 1)
    * (plot.crop.fertilized ? ctx.cfg.fertilizedYield : 1)
    * variant.yield
    * (stage === 4 ? ctx.cfg.oldYield : 1)
    * m.gold
    * (m.boost?.crop === def.id ? m.boost.mult : 1);
  const gold = Math.max(1, Math.round(def.gold * factor));
  addGold(user, gold);
  user.stats.harvest++;
  const before=snapshot(ctx,plot);
  plot.crop = null;plot.prank=null;plot.waterBoostUntil=plot.speedUntil=0;
  touch(ctx, user);
  gain(ctx, user, def.xp, plot);
  ctx.emit({ type: 'harvest', plotId: plot.id, userId: user.userId, gold, xp: def.xp, crop: def.id, before, after:snapshot(ctx,plot), first:user.stats.harvest===1 });
  return { ok: true, gold, xp: def.xp, factor };
}

// Advance every awake crop. dt is clamped so a frozen host (laptop asleep) cannot ripen the whole garden at once.
export function tickPlots(ctx) {
  const now = ctx.now(), dt = Math.max(0, Math.min(now - ctx.state.lastTick, ctx.cfg.tickMaxDtMs));
  ctx.state.lastTick = now;
  if (!dt) return;
  const cfg = ctx.cfg;
  for (const plot of Object.values(ctx.state.plots)) {
    if (!plot.crop || !isAwake(ctx, plot)) continue;
    const crop = plot.crop;
    const beforeStage = stageOf(crop, now, cfg);
    let visibleChange = false;
    plot.water = Math.max(0, plot.water - dt / cfg.waterDecayMs);
    if (crop.progress < 1) {
      if (!(plot.blessingUntil > now) && !crop.pest && ctx.rng() < cfg.pestChancePerSec * dt / 1000) {
        crop.pest = true; visibleChange = true;
        ctx.emit({ type: 'pest', plotId: plot.id, userId: plot.owner });
      }
      crop.progress += dt / CROPS[crop.type].growMs
        * growthInfo(ctx,plot).rate;
      if (crop.progress >= 1) {
        crop.progress = 1; crop.ripeAt = now; visibleChange = true;
        ctx.emit({ type: 'ripe', plotId: plot.id, userId: plot.owner, crop: crop.type, first: ctx.state.users[plot.owner]?.stats.harvest === 0 });
      }
      if (!(plot.blessingUntil > now) && !crop.weeds && ctx.rng() > 1 - cfg.weedChancePerSec * dt / 1000) {
        crop.weeds = true; visibleChange = true;
        ctx.emit({ type: 'weed', plotId: plot.id, userId: plot.owner });
      }
    }
    if (stageOf(crop, now, cfg) !== beforeStage) visibleChange = true;
    if (visibleChange || now - (plot.lastSyncAt ?? 0) >= cfg.plotSyncMs) {
      plot.lastSyncAt = now;
      bump(ctx, plot);
    }
  }
}
