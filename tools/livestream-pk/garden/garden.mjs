// Vườn Mây: wires comments, gifts and time into the garden modules. The only place that knows how they fit together.
import { gardenConfig } from './config.mjs';
import { catchPests, clearWeeds, fertilize, harvest, plant, tickPlots, water } from './care.mjs';
import { createLimiter, parseCommand, resolveMention } from './commands.mjs';
import { COPY } from './copy.mjs';
import { CROPS, stageOf } from './crops.mjs';
import { createEvents, modifiers } from './events.mjs';
import { applyGift } from './gifts.mjs';
import { applyHearts, heartStatus, tickHearts } from './hearts.mjs';
import { catchThief, dog, steal, tickSteal } from './steal.mjs';
import { createCompetition } from './competition.mjs';
import { bump, emptyGardenState, ensureUser, isAwake, managePresence, migrateSeedZone, TIERS, seat, touch } from './world.mjs';
import { potTierOf } from './progress.mjs';

export function createGarden({ config = {}, now = Date.now, rng = Math.random, onEvent = () => {}, onStateChange = () => {}, state = emptyGardenState(now()) } = {}) {
  const ctx = { state, cfg: gardenConfig(config), now, rng, emit: e => onEvent(e), markDirty: onStateChange, limiter: createLimiter(now) };
  migrateSeedZone(ctx);
  const competition = createCompetition({ state, now });
  ctx.mods = () => modifiers(ctx);
  const events = createEvents(ctx);
  ctx.onPestCleared = id => events.notePestCleared(id);

  function run(user, cmd) {
    if (!ctx.limiter.allow(user.userId, 'care', ctx.cfg.careGapMs)) return { ok: false, reason: 'cooldown' };
    const target = cmd.mention ? resolveMention(state, cmd.mention, user.userId) : null;
    if (cmd.mention && !target) return { ok: false, reason: 'no-target' }; // a name nobody (or two people) answers to is never guessed at
    let result, scoreAction = null;
    switch (cmd.cmd) {
      case 'plant': result = plant(ctx, user, cmd.arg ?? 'rau'); scoreAction = 'plant'; break;
      case 'water': result = water(ctx, user, target ?? user); scoreAction = target && target !== user ? 'help' : 'water'; break;
      case 'pest': result = catchPests(ctx, user); scoreAction = 'pest'; break;
      case 'weed': result = clearWeeds(ctx, user); scoreAction = 'help'; break;
      case 'fertilize': result = fertilize(ctx, user); scoreAction = 'water'; break;
      case 'harvest': result = harvest(ctx, user); scoreAction = 'harvest'; break;
      case 'steal': result = steal(ctx, user, target); break;
      case 'catch': result = catchThief(ctx, user); scoreAction = 'catch'; break;
      case 'dog': result = dog(ctx, user); scoreAction = 'protect'; break;
      case 'card':
        ctx.emit({ type: 'card', userId: user.userId, nickname: user.nickname, level: user.level, xp: user.xp, gold: user.gold, stats: user.stats, competition: competition.profile(user) });
        return { ok: true };
      default: return { ok: false, reason: 'unknown-command' };
    }
    if (result?.ok && scoreAction) {
      const award = competition.score(user, scoreAction);
      if (award?.titles.length) ctx.emit({ type: 'title', userId: user.userId, nickname: user.nickname, titles: award.titles, points: award.total });
    }
    return result;
  }

  function chat(u) {
    const cmd = parseCommand(u.comment);
    let user = state.users[u.userId];
    const fresh = !user;
    let joined = false;
    user ??= ensureUser(ctx, u);
    if (!user.seat) {
      const plot = seat(ctx, user);
      if (!plot) { if (fresh) delete state.users[u.userId]; return { ok: false, reason: 'no-room' }; }
      joined = true;
      ctx.emit({ type: 'joined', userId: user.userId, plotId: plot.id });
      const award = competition.score(user, 'join');
      if (award?.titles.length) ctx.emit({ type: 'title', userId: user.userId, nickname: user.nickname, titles: award.titles, points: award.total });
    }
    if (!cmd) touch(ctx, user);
    return { ...(cmd ? run(user, cmd) : { ok: true }), action: cmd?.cmd ?? 'chat', joined, plotId: user.seat && `${user.seat.tier}:${user.seat.slot}`, competition: competition.profile(user) };
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
    return { id: p.id, tier: p.tier, slot: p.slot, owner: o && { userId: o.userId, nickname: o.nickname, avatar: o.avatar, level: o.level },
      potTier: o ? potTierOf(o.level).id : null,
      stage: p.crop ? stageOf(p.crop, now(), ctx.cfg) : null,
      crop: p.crop && { type: p.crop.type, progress: p.crop.progress, pest: Boolean(p.crop.pest), weeds: Boolean(p.crop.weeds), fertilized: Boolean(p.crop.fertilized), stolen: p.crop.stolen, variant: p.crop.variant ?? 'common' },
      water: p.water, dog: p.dogUntil > now(), shield: p.shieldUntil > now(), deco: p.deco, awake: Boolean(o) && isAwake(ctx, p) };
  };

  return {
    state, cfg: ctx.cfg, events, competition,
    chat,
    gift: g => applyGift(ctx, ensureUser(ctx, g), g),
    like: data => { const result = applyHearts(ctx, data); if (result.ok) ctx.markDirty(); return result; }, social() {}, member() {},
    tick() { managePresence(ctx); tickPlots(ctx); tickHearts(ctx); tickSteal(ctx); events.tick(); expire(); },
    changes(seen) {
      const parts = {}, plots = {};
      for (const p of Object.values(state.plots)) if (p.ver > (seen.ver ?? 0)) plots[p.id] = view(p);
      seen.ver = state.ver;
      if (Object.keys(plots).length) parts.plots = plots;
      const ev = JSON.stringify(state.event);
      if (ev !== seen.event) { seen.event = ev; parts.event = state.event; }
      const heart = heartStatus(state);
      if (seen.hearts !== heart.revision) { seen.hearts = heart.revision; parts.hearts = heart; }
      const revision = competition.revision();
      if (revision !== seen.competition) { seen.competition = revision; parts.competition = competition.status(); }
      return parts;
    },
    meta: () => ({ tiers: TIERS, copy: COPY, crops: CROPS, cfg: {
      tierWidth: ctx.cfg.tierWidth, tierHeight: ctx.cfg.tierHeight, plotsPerTier: ctx.cfg.plotsPerTier, plotsPerRow: ctx.cfg.plotsPerRow,
      plotCell: ctx.cfg.plotCell, activeCapacity: ctx.cfg.activeCapacity, modulesPerRow: ctx.cfg.modulesPerRow, moduleCapacity: ctx.cfg.moduleCapacity,
      potsPerShelf: ctx.cfg.potsPerShelf, shelvesPerModule: ctx.cfg.shelvesPerModule, potSpacingX: ctx.cfg.potSpacingX, shelfSpacingY: ctx.cfg.shelfSpacingY,
      moduleGapX: ctx.cfg.moduleGapX, moduleGapY: ctx.cfg.moduleGapY, zoneMarginX: ctx.cfg.zoneMarginX, zoneMarginY: ctx.cfg.zoneMarginY,
      potScale: ctx.cfg.potScale, potBottomOffset: ctx.cfg.potBottomOffset, potShelfGap: ctx.cfg.potShelfGap,
      tierMarginX: ctx.cfg.tierMarginX, tierMarginY: ctx.cfg.tierMarginY, camera: ctx.cfg.camera,
      graceMs: ctx.cfg.graceMs, sleepAfterMs: ctx.cfg.sleepAfterMs, evictAfterMs: ctx.cfg.evictAfterMs,
      rainMs: ctx.cfg.rainMs, rainMult: ctx.cfg.rainMult, pestStormMs: ctx.cfg.pestStormMs,
      merchantMs: ctx.cfg.merchantMs, merchantMult: ctx.cfg.merchantMult, goldenMs: ctx.cfg.goldenMs, goldenMult: ctx.cfg.goldenMult,
    } }),
    ctx,
  };
}
