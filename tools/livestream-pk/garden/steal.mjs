// Light-hearted theft: take a slice of a ripe crop, the owner has a few seconds to catch you, a dog guards for free.
import { CROPS, stageOf } from './crops.mjs';
import { addGold, spendGold } from './progress.mjs';
import { bump, isAwake, nightOf, touch } from './world.mjs';

const plotOf = (ctx, user) => user.seat && ctx.state.plots[`${user.seat.island}:${user.seat.slot}`];
const fail = reason => ({ ok: false, reason });
const shielded = (ctx, user, plot) => user.level <= ctx.cfg.shieldLevel || plot.shieldUntil > ctx.now();
const ripe = (ctx, plot) => plot.crop && stageOf(plot.crop, ctx.now(), ctx.cfg) === 3;
let seq = 0;

// a random open victim on the thief's own island
function pick(ctx, thief) {
  const mine = plotOf(ctx, thief), users = ctx.state.users;
  const open = Object.values(ctx.state.plots).filter(p => p.island === mine.island && p.owner && p.owner !== thief.userId && isAwake(ctx, p) && ripe(ctx, p)
    && p.dogUntil <= ctx.now() && !shielded(ctx, users[p.owner], p) && p.crop.stolen < ctx.cfg.stealMaxPerCrop);
  return open.length ? users[open[Math.floor(ctx.rng() * open.length)].owner] : null;
}

export function steal(ctx, thief, victim) {
  const now = ctx.now(), cfg = ctx.cfg;
  if (!plotOf(ctx, thief)) return fail('no-plot');
  if ((thief.banUntil ?? 0) > now) return fail('banned');
  if (victim === null) { victim = pick(ctx, thief); if (!victim) return fail('no-target'); }
  if (victim.userId === thief.userId) return fail('self');
  const plot = plotOf(ctx, victim);
  if (!plot) return fail('no-target');
  if (!isAwake(ctx, plot)) return fail('asleep');
  if (!ripe(ctx, plot)) return fail('not-ripe');
  if (plot.dogUntil > now) { ctx.emit({ type: 'dog-bark', plotId: plot.id, userId: victim.userId, thiefId: thief.userId }); return fail('dog'); }
  if (shielded(ctx, victim, plot)) return fail('shield');
  thief.stealLog ??= {};
  const log = (thief.stealLog[victim.userId] = (thief.stealLog[victim.userId] ?? []).filter(t => now - t < cfg.stealVictimWindowMs));
  if (plot.crop.stolen >= cfg.stealMaxPerCrop || log.length >= cfg.stealPerVictimMax) return fail('cap');
  if (!ctx.limiter.allow(thief.userId, 'steal', cfg.stealCooldownMs)) return fail('cooldown');
  const amount = Math.max(1, Math.round(CROPS[plot.crop.type].gold * cfg.stealFrac));
  addGold(thief, amount);
  plot.crop.stolen++;
  log.push(now);
  thief.stats.steal++;
  ctx.state.thefts.push({ id: ++seq, thief: thief.userId, victim: victim.userId, plotId: plot.id, amount, at: now });
  victim.stolenLog = (victim.stolenLog ?? []).filter(t => now - t < cfg.shieldStolenWindowMs).concat(now);
  if (victim.stolenLog.length >= cfg.shieldAfterStolen) plot.shieldUntil = now + cfg.shieldMs;
  touch(ctx, thief);
  bump(ctx, plot);
  ctx.emit({ type: 'steal', plotId: plot.id, thiefId: thief.userId, victimId: victim.userId, thiefPlotId: plotOf(ctx, thief).id, amount });
  return { ok: true, amount, victimId: victim.userId };
}

export function catchThief(ctx, victim) {
  const now = ctx.now(), i = ctx.state.thefts.findLastIndex(t => t.victim === victim.userId && now - t.at <= ctx.cfg.catchWindowMs);
  if (i < 0) return fail('no-thief');
  const [theft] = ctx.state.thefts.splice(i, 1), thief = ctx.state.users[theft.thief], plot = ctx.state.plots[theft.plotId];
  thief.gold = Math.max(0, thief.gold - theft.amount);
  thief.banUntil = now + ctx.cfg.caughtBanMs;
  if (plot?.crop && plot.crop.stolen > 0) { plot.crop.stolen--; bump(ctx, plot); }
  victim.stats.caught++;
  touch(ctx, victim);
  ctx.emit({ type: 'catch', plotId: theft.plotId, thiefId: thief.userId, victimId: victim.userId, thiefPlotId: plotOf(ctx, thief)?.id ?? null });
  return { ok: true };
}

export function dog(ctx, user) {
  const plot = plotOf(ctx, user), now = ctx.now(), night = nightOf(now);
  if (!plot) return fail('no-plot');
  if (plot.dogUntil > now) return fail('active');
  const free = user.dogNight !== night;
  if (free) user.dogNight = night;
  else if (!spendGold(user, ctx.cfg.dogCost)) return fail('gold');
  plot.dogUntil = now + ctx.cfg.dogMs;
  touch(ctx, user);
  ctx.emit({ type: 'dog', plotId: plot.id, userId: user.userId });
  return { ok: true, free };
}

export function tickSteal(ctx) {
  const now = ctx.now();
  ctx.state.thefts = ctx.state.thefts.filter(t => now - t.at <= ctx.cfg.catchWindowMs);
}
