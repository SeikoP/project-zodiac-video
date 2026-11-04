// Vườn Mây: wires comments, gifts and time into the garden modules. The only place that knows how they fit together.
import { parseSign } from '../game.mjs';
import { gardenConfig } from './config.mjs';
import { catchPests, harvest, plant, tickPlots, water } from './care.mjs';
import { createLimiter, parseCommand, resolveMention } from './commands.mjs';
import { COPY } from './copy.mjs';
import { CROPS, stageOf } from './crops.mjs';
import { createEvents, modifiers } from './events.mjs';
import { applyGift } from './gifts.mjs';
import { catchThief, dog, steal, tickSteal } from './steal.mjs';
import { bump, emptyGardenState, ensureUser, ISLANDS, seat } from './world.mjs';

export function createGarden({ config = {}, now = Date.now, rng = Math.random, onEvent = () => {}, state = emptyGardenState(now()) } = {}) {
  const ctx = { state, cfg: gardenConfig(config), now, rng, emit: e => onEvent(e), limiter: createLimiter(now) };
  ctx.mods = () => modifiers(ctx);
  const events = createEvents(ctx);
  ctx.onPestCleared = id => events.notePestCleared(id);

  function run(user, cmd) {
    if (!ctx.limiter.allow(user.userId, 'care', ctx.cfg.careGapMs)) return;
    const target = cmd.mention ? resolveMention(state, cmd.mention, user.userId) : null;
    if (cmd.mention && !target) return; // a name nobody (or two people) answers to is never guessed at
    switch (cmd.cmd) {
      case 'plant': return plant(ctx, user, cmd.arg ?? 'rau');
      case 'water': return water(ctx, user, target ?? user);
      case 'pest': return catchPests(ctx, user);
      case 'harvest': return harvest(ctx, user);
      case 'steal': return steal(ctx, user, target);
      case 'catch': return catchThief(ctx, user);
      case 'dog': return dog(ctx, user);
      case 'card': return ctx.emit({ type: 'card', userId: user.userId, nickname: user.nickname, level: user.level, xp: user.xp, gold: user.gold, stats: user.stats });
    }
  }

  function chat(u) {
    const cmd = parseCommand(u.comment);
    let user = state.users[u.userId];
    if (!cmd) {
      const sign = !user?.seat && parseSign(u.comment);
      if (sign) seat(ctx, ensureUser(ctx, u), sign);
      return;
    }
    user = ensureUser(ctx, u);
    if (!user.seat && !seat(ctx, user)) return;
    run(user, cmd);
  }

  function expire() {
    const t = now();
    for (const p of Object.values(state.plots)) {
      if (p.dogUntil && p.dogUntil <= t) { p.dogUntil = 0; bump(ctx, p); }
      if (p.shieldUntil && p.shieldUntil <= t) { p.shieldUntil = 0; bump(ctx, p); }
    }
  }

  const view = p => {
    const o = p.owner && state.users[p.owner];
    return { id: p.id, island: p.island, slot: p.slot, owner: o && { userId: o.userId, nickname: o.nickname, avatar: o.avatar, level: o.level, sign: o.sign },
      stage: p.crop ? stageOf(p.crop, now(), ctx.cfg) : null, crop: p.crop && { type: p.crop.type, progress: p.crop.progress, pest: p.crop.pest, stolen: p.crop.stolen },
      water: p.water, dog: p.dogUntil > now(), shield: p.shieldUntil > now() || (o ? o.level <= ctx.cfg.shieldLevel : false), deco: p.deco, awake: Boolean(o) && now() - p.lastActive < ctx.cfg.sleepAfterMs };
  };

  return {
    state, cfg: ctx.cfg, events,
    chat,
    gift: g => { applyGift(ctx, ensureUser(ctx, g), g); },
    like() {}, social() {}, member() {},
    tick() { tickPlots(ctx); tickSteal(ctx); events.tick(); expire(); },
    changes(seen) {
      const parts = {}, plots = {};
      for (const p of Object.values(state.plots)) if (p.ver > (seen.ver ?? 0)) plots[p.id] = view(p);
      seen.ver = state.ver;
      if (Object.keys(plots).length) parts.plots = plots;
      const ev = JSON.stringify(state.event);
      if (ev !== seen.event) { seen.event = ev; parts.event = state.event; }
      return parts;
    },
    meta: () => ({ islands: ISLANDS, copy: COPY, crops: CROPS, cfg: { plotCell: ctx.cfg.plotCell, plotsPerRow: ctx.cfg.plotsPerRow, islandSize: ctx.cfg.islandSize, islandCols: ctx.cfg.islandCols, islandMargin: ctx.cfg.islandMargin, camera: ctx.cfg.camera, graceMs: ctx.cfg.graceMs } }),
    ctx,
  };
}
