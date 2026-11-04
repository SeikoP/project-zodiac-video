// Four vertically stacked cloud terraces, with the same 432 persistent plots as the original garden.
export const TIERS = Object.freeze([
  { id: 'cloud-1', label: 'Chân Mây' },
  { id: 'cloud-2', label: 'Vườn Gió' },
  { id: 'cloud-3', label: 'Nắng Vàng' },
  { id: 'cloud-4', label: 'Đỉnh Mây' },
]);

export const plotId = (tier, slot) => `${tier}:${slot}`;
export const nightOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function emptyGardenState(now = Date.now()) {
  return { v: 3, ver: 0, users: {}, plots: {}, thefts: [], event: null, session: null, night: nightOf(now), lastTick: now };
}

const origin = (tier, cfg) => ({ x: 0, y: TIERS.findIndex(x => x.id === tier) * cfg.tierHeight });
export function tierCenter(tier, cfg) { const o = origin(tier, cfg); return { x: o.x + cfg.tierWidth / 2, y: o.y + cfg.tierHeight / 2 }; }
export function plotCenter(tier, slot, cfg) {
  const o = origin(tier, cfg);
  return { x: o.x + cfg.tierMarginX + (slot % cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2, y: o.y + cfg.tierMarginY + Math.floor(slot / cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2 };
}

export const bump = (ctx, plot) => { plot.ver = ++ctx.state.ver; };

export function ensureUser(ctx, { userId, nickname, avatar }) {
  const users = ctx.state.users;
  const u = (users[userId] ??= { userId, nickname: '', avatar: '', level: 1, xp: 0, gold: ctx.cfg.startGold, seat: null, deco: [], lastSeen: ctx.now(), stats: { harvest: 0, steal: 0, caught: 0 }, dogNight: null });
  if (nickname) u.nickname = nickname;
  if (avatar) u.avatar = avatar;
  if (!u.nickname) u.nickname = `Người xem ${String(userId).slice(-4)}`;
  return u;
}

const plotAt = (ctx, tier, slot) => ctx.state.plots[plotId(tier, slot)] ??= { id: plotId(tier, slot), tier, slot, owner: null, crop: null, water: 1, lastActive: ctx.now(), dogUntil: 0, shieldUntil: 0, deco: [], ver: 0 };
const owned = (ctx, tier) => Object.values(ctx.state.plots).filter(p => p.tier === tier && p.owner);

function take(ctx, user, plot) {
  plot.owner = user.userId;
  plot.crop = null;
  plot.water = 1;
  plot.lastActive = ctx.now();
  plot.dogUntil = plot.shieldUntil = 0;
  plot.deco = [...user.deco];
  user.seat = { tier: plot.tier, slot: plot.slot };
  user.lastSeen = ctx.now();
  bump(ctx, plot);
  return plot;
}

function room(ctx, user, tier) {
  const mine = owned(ctx, tier), n = ctx.cfg.plotsPerTier;
  if (mine.length < n) {
    const used = new Set(mine.map(p => p.slot));
    for (let s = 0; s < n; s++) if (!used.has(s)) return take(ctx, user, plotAt(ctx, tier, s));
  }
  return null;
}

function evict(ctx, user, tier) {
  const free = owned(ctx, tier).filter(p => !p.crop).sort((a, b) => a.lastActive - b.lastActive)[0];
  if (!free) return null;
  ctx.state.users[free.owner].seat = null;
  return take(ctx, user, free);
}

// Prefer a requested tier, then the least occupied ones; only empty plots are ever reclaimed.
export function seat(ctx, user, preferred) {
  if (user.seat) return ctx.state.plots[plotId(user.seat.tier, user.seat.slot)];
  const order = [...TIERS.map(x => x.id)].sort((a, b) => owned(ctx, a).length - owned(ctx, b).length);
  if (TIERS.some(x => x.id === preferred)) order.unshift(...order.splice(order.indexOf(preferred), 1));
  return order.map(tier => room(ctx, user, tier)).find(Boolean) ?? order.map(tier => evict(ctx, user, tier)).find(Boolean) ?? null;
}

export function touch(ctx, user) {
  user.lastSeen = ctx.now();
  if (!user.seat) return;
  const plot = ctx.state.plots[plotId(user.seat.tier, user.seat.slot)];
  if (!plot) return;
  plot.lastActive = ctx.now();
  bump(ctx, plot);
}

export const isAwake = (ctx, plot) => Boolean(plot.owner) && ctx.now() - plot.lastActive < ctx.cfg.sleepAfterMs;
