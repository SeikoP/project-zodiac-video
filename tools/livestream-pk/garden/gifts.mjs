// Gifts affect the garden; the roulette result is chosen once on the server.
import { GARDEN_DEFAULTS } from './config.mjs';
import { plant } from './care.mjs';
import { strike } from './destruction.mjs';
import { spin } from './roulette.mjs';
import { advanceStage } from './crops.mjs';
import { bump, isAwake, seat, touch } from './world.mjs';

export function giftTier(total, tiers = GARDEN_DEFAULTS.giftTiers) {
  return total >= tiers[2] ? 'cataclysm' : total >= 500 ? 'meteor' : total >= tiers[1] ? 'rain' : total >= 50 ? 'roulette' : total >= tiers[0] ? 'star' : 'dew';
}

const growing = plot => plot.crop && plot.crop.progress < 1;

function lift(ctx, plot) {
  if (!growing(plot)) return;
  const from = plot.crop.progress;
  advanceStage(plot.crop, ctx.now());
  bump(ctx, plot);
  return { plotId:plot.id, from, to:plot.crop.progress };
}

function dew(ctx, plot) {
  const from = plot.crop?.progress ?? 0;
  plot.water = 1;
  if(plot.prank?.kind==='dry')plot.prank=null;
  if (growing(plot)) {
    plot.crop.progress = Math.min(1, plot.crop.progress + ctx.cfg.dewProgress);
    if (plot.crop.progress >= 1) plot.crop.ripeAt = ctx.now();
  }
  bump(ctx, plot);
  return { plotId:plot.id, from, to:plot.crop?.progress ?? 0 };
}

export function applyGift(ctx, user, { diamonds, count }) {
  const total = diamonds * count, tier = giftTier(total, ctx.cfg.giftTiers);
  const plot = seat(ctx, user);
  if(plot&&plot.brokenUntil>ctx.now()){plot.brokenUntil=0;bump(ctx,plot);}
  // A growth gift needs a fresh seed when the round has just cleared all crops.
  const seeded=Boolean(plot&&!plot.crop&&tier!=='roulette'&&plant(ctx,user,'rau',true).ok);
  const roulette=tier==='roulette'?spin(ctx,user,plot):null;
  const impact=['meteor','cataclysm'].includes(tier)?strike(ctx,user,plot,tier):null;
  const effects = [];
  const benefits={seeded:Number(seeded),watered:0,fertilized:0,weeds:0,protected:0};
  if (plot) touch(ctx, user);
  if (tier === 'dew' && plot) {effects.push(dew(ctx, plot));benefits.watered=1;}
  if (tier === 'star' && plot) {
    const effect=lift(ctx,plot); if(effect)effects.push(effect);
    if(plot.crop&&!plot.crop.fertilized){plot.crop.fertilized=true;benefits.fertilized=1;bump(ctx,plot);}
  }
  if (tier === 'rain') for (const p of Object.values(ctx.state.plots)) { const effect=lift(ctx,p); if(effect)effects.push(effect); }
  if(tier==='rain')for(const p of Object.values(ctx.state.plots))if(p.crop&&isAwake(ctx,p)){
    p.water=1;benefits.watered++;
    if(p.prank?.kind==='dry'||p.prank?.kind==='weeds')p.prank=null;
    if(p.crop.weeds){p.crop.weeds=false;benefits.weeds++;}
    bump(ctx,p);
  }
  const id=`${ctx.now()}:${ctx.state.giftSeq=(ctx.state.giftSeq??0)+1}`;
  ctx.emit({ type: 'gift',id,impact, tier, userId: user.userId, nickname: user.nickname, plotId: plot?.id ?? null, total, roulette, affected:effects.length, effects:effects.slice(0,ctx.cfg.activeCapacity), benefits, blessingMs:impact?.shieldMs??0 });
  return { tier, plotId: plot?.id ?? null,...(impact?{impact}:{}), ...(roulette?{roulette}:{}) };
}
