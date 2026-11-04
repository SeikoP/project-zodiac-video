// The live experience is one Seed Zone. Legacy cloud-2..4 IDs are accepted only for save migration.
export const SEED_ZONE = Object.freeze({ id: 'cloud-1', label: 'Khu Gieo Hạt' });
export const TIERS = Object.freeze([SEED_ZONE]);
export const LEGACY_TIER_IDS = Object.freeze(['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4']);

export const plotId = (tier, slot) => `${tier}:${slot}`;
export const nightOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function emptyGardenState(now = Date.now()) {
  return { v: 4, ver: 0, users: {}, plots: {}, thefts: [], event: null, session: null, night: nightOf(now), lastTick: now };
}

export function plotLayout(slot, cfg) {
  const module = Math.floor(slot / cfg.moduleCapacity);
  const within = slot % cfg.moduleCapacity;
  const row = Math.floor(within / cfg.potsPerShelf);
  const col = within % cfg.potsPerShelf;
  const moduleCol = module % cfg.modulesPerRow;
  const moduleRow = Math.floor(module / cfg.modulesPerRow);
  const spanX = (cfg.potsPerShelf - 1) * cfg.potSpacingX;
  const spanY = (cfg.shelvesPerModule - 1) * cfg.shelfSpacingY;
  const x = cfg.zoneMarginX + moduleCol * (spanX + cfg.moduleGapX) + col * cfg.potSpacingX;
  const y = cfg.zoneMarginY + moduleRow * (spanY + cfg.moduleGapY) + row * cfg.shelfSpacingY;
  return { module, moduleCol, moduleRow, row, col, x, y, shelfY: y + cfg.potBottomOffset + cfg.potShelfGap };
}

export function tierCenter(_tier, cfg) {
  return { x: cfg.tierWidth / 2, y: cfg.tierHeight / 2 };
}

export function plotCenter(_tier, slot, cfg) {
  const p = plotLayout(slot, cfg);
  return { x: p.x, y: p.y };
}

export const shelfSurface = (slot, cfg) => plotLayout(slot, cfg).shelfY;
export const bump = (ctx, plot) => { plot.ver = ++ctx.state.ver; };

export function ensureUser(ctx, { userId, nickname, avatar }) {
  const users = ctx.state.users;
  const u = (users[userId] ??= { userId, nickname: '', avatar: '', level: 1, xp: 0, gold: ctx.cfg.startGold, seat: null, deco: [], lastSeen: ctx.now(), stats: { harvest: 0, steal: 0, caught: 0 }, dogNight: null });
  if (nickname) u.nickname = nickname;
  if (avatar) u.avatar = avatar;
  if (!u.nickname) u.nickname = `Người xem ${String(userId).slice(-4)}`;
  return u;
}

const newPlot = (ctx, slot) => ({
  id: plotId(SEED_ZONE.id, slot), tier: SEED_ZONE.id, slot, owner: null, crop: null, water: 1,
  lastActive: ctx.now(), sleeping: false, dogUntil: 0, shieldUntil: 0, deco: [], ver: 0,
});
const plotAt = (ctx, slot) => ctx.state.plots[plotId(SEED_ZONE.id, slot)] ??= newPlot(ctx, slot);

function take(ctx, user, plot) {
  plot.owner = user.userId;
  plot.crop = plot.crop ?? null;
  plot.water = Number.isFinite(plot.water) ? plot.water : 1;
  plot.lastActive = ctx.now();
  plot.sleeping = false;
  plot.dogUntil = plot.shieldUntil = 0;
  plot.deco = [...user.deco];
  user.seat = { tier: SEED_ZONE.id, slot: plot.slot };
  user.lastSeen = ctx.now();
  bump(ctx, plot);
  return plot;
}

function occupied(ctx) {
  return Object.values(ctx.state.plots).filter(p => p.tier === SEED_ZONE.id && p.owner && p.slot < ctx.cfg.activeCapacity);
}

function room(ctx, user) {
  const mine = occupied(ctx), n = ctx.cfg.activeCapacity;
  if (mine.length >= n) return null;
  const used = new Set(mine.map(p => p.slot));
  for (let s = 0; s < n; s++) if (!used.has(s)) return take(ctx, user, plotAt(ctx, s));
  return null;
}

function evict(ctx, user) {
  const free = occupied(ctx).filter(p => !p.crop).sort((a, b) => a.lastActive - b.lastActive)[0];
  if (!free) return null;
  const previous = ctx.state.users[free.owner];
  if (previous) previous.seat = null;
  free.crop = null;
  return take(ctx, user, free);
}

export function seat(ctx, user) {
  if (user.seat?.tier === SEED_ZONE.id && user.seat.slot < ctx.cfg.activeCapacity) {
    return ctx.state.plots[plotId(SEED_ZONE.id, user.seat.slot)] ?? null;
  }
  user.seat = null;
  return room(ctx, user) ?? evict(ctx, user);
}

export function migrateSeedZone(ctx) {
  const needs = ctx.state.v < 4 || Object.values(ctx.state.users).some(u => u.seat && (u.seat.tier !== SEED_ZONE.id || u.seat.slot >= ctx.cfg.activeCapacity));
  if (!needs) return { migrated: false, seated: occupied(ctx).length };

  const snapshots = Object.values(ctx.state.plots)
    .filter(p => p.owner && ctx.state.users[p.owner])
    .map(p => ({ ...p, deco: [...(p.deco ?? [])], crop: p.crop ? { ...p.crop } : null }))
    .sort((a, b) => Number(Boolean(a.sleeping)) - Number(Boolean(b.sleeping)) || (b.lastActive ?? 0) - (a.lastActive ?? 0))
    .slice(0, ctx.cfg.activeCapacity);

  for (const user of Object.values(ctx.state.users)) user.seat = null;
  ctx.state.plots = {};
  ctx.state.thefts = [];
  ctx.state.ver = 0;

  snapshots.forEach((old, slot) => {
    const plot = { ...newPlot(ctx, slot), ...old, id: plotId(SEED_ZONE.id, slot), tier: SEED_ZONE.id, slot, ver: ++ctx.state.ver };
    ctx.state.plots[plot.id] = plot;
    const user = ctx.state.users[plot.owner];
    if (user) user.seat = { tier: SEED_ZONE.id, slot };
  });
  ctx.state.v = 4;
  return { migrated: true, seated: snapshots.length };
}

export function touch(ctx, user) {
  user.lastSeen = ctx.now();
  if (!user.seat) return;
  const plot = ctx.state.plots[plotId(SEED_ZONE.id, user.seat.slot)];
  if (!plot) return;
  plot.lastActive = ctx.now();
  plot.sleeping = false;
  bump(ctx, plot);
}

export const isAwake = (ctx, plot) => Boolean(plot.owner) && !plot.sleeping && ctx.now() - plot.lastActive < ctx.cfg.sleepAfterMs;

export function managePresence(ctx) {
  const now = ctx.now();
  let sleeping = 0, evicted = 0;
  for (const plot of Object.values(ctx.state.plots)) {
    if (!plot.owner) continue;
    const user = ctx.state.users[plot.owner];
    if (!user) {
      plot.owner = null; plot.crop = null; plot.sleeping = false; plot.deco = []; bump(ctx, plot);
      continue;
    }
    const age = now - plot.lastActive;
    if (age >= ctx.cfg.evictAfterMs) {
      if (user.seat?.slot === plot.slot) user.seat = null;
      plot.owner = null; plot.crop = null; plot.water = 1; plot.wateredAt = null; plot.sleeping = false;
      plot.dogUntil = plot.shieldUntil = 0; plot.deco = [];
      bump(ctx, plot); evicted++; continue;
    }
    const nextSleeping = age >= ctx.cfg.sleepAfterMs;
    if (Boolean(plot.sleeping) !== nextSleeping) { plot.sleeping = nextSleeping; bump(ctx, plot); }
    if (nextSleeping) sleeping++;
  }
  return { sleeping, evicted };
}
