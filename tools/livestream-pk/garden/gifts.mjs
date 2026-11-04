// Gifts are visible actions with a fixed meaning per amount (xu = diamonds x count). Never gold, XP or a random reward.
import { GARDEN_DEFAULTS } from './config.mjs';
import { advanceStage } from './crops.mjs';
import { bump, seat, touch } from './world.mjs';

export function giftTier(total, tiers = GARDEN_DEFAULTS.giftTiers) {
  return total >= tiers[2] ? 'tree' : total >= tiers[1] ? 'rain' : total >= tiers[0] ? 'star' : 'dew';
}

const growing = plot => plot.crop && plot.crop.progress < 1;

function lift(ctx, plot) {
  if (!growing(plot)) return;
  advanceStage(plot.crop, ctx.now());
  bump(ctx, plot);
}

function dew(ctx, plot) {
  plot.water = 1;
  if (growing(plot)) {
    plot.crop.progress = Math.min(1, plot.crop.progress + ctx.cfg.dewProgress);
    if (plot.crop.progress >= 1) plot.crop.ripeAt = ctx.now();
  }
  bump(ctx, plot);
}

export function applyGift(ctx, user, { diamonds, count }) {
  const total = diamonds * count, tier = giftTier(total, ctx.cfg.giftTiers);
  const plot = seat(ctx, user);
  if (plot) touch(ctx, user);
  if (tier === 'dew' && plot) dew(ctx, plot);
  if (tier === 'star' && plot) lift(ctx, plot);
  if (tier === 'rain' || tier === 'tree') for (const p of Object.values(ctx.state.plots)) lift(ctx, p);
  if (tier === 'tree' && !user.deco.includes('golden-tree')) {
    user.deco.push('golden-tree');
    if (plot) { plot.deco.push('golden-tree'); bump(ctx, plot); }
  }
  ctx.emit({ type: 'gift', tier, userId: user.userId, nickname: user.nickname, plotId: plot?.id ?? null, total });
  return { tier, plotId: plot?.id ?? null };
}
