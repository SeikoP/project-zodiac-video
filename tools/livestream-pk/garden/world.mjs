// The map (12 islands of 36 plots) and who sits where. State is plain JSON so it can be saved as it is.
import { SIGN_DATA } from '../public/signs.js';

export const ISLANDS = Object.keys(SIGN_DATA);
export const plotId = (island, slot) => `${island}:${slot}`;

export const nightOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function emptyGardenState(now = Date.now()) {
  return { v: 1, ver: 0, users: {}, plots: {}, thefts: [], event: null, night: nightOf(now), lastTick: now };
}

const origin = (island, cfg) => { const i = ISLANDS.indexOf(island); return { x: (i % cfg.islandCols) * cfg.islandSize, y: Math.floor(i / cfg.islandCols) * cfg.islandSize }; };
export function islandCenter(island, cfg) { const o = origin(island, cfg); return { x: o.x + cfg.islandSize / 2, y: o.y + cfg.islandSize / 2 }; }
export function plotCenter(island, slot, cfg) {
  const o = origin(island, cfg);
  return { x: o.x + cfg.islandMargin + (slot % cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2, y: o.y + cfg.islandMargin + Math.floor(slot / cfg.plotsPerRow) * cfg.plotCell + cfg.plotCell / 2 };
}

export const bump = (ctx, plot) => { plot.ver = ++ctx.state.ver; };

export function ensureUser(ctx, { userId, nickname, avatar }) {
  const users = ctx.state.users;
  const u = (users[userId] ??= { userId, nickname: '', avatar: '', sign: null, level: 1, xp: 0, gold: ctx.cfg.startGold, seat: null, deco: [], lastSeen: ctx.now(), stats: { harvest: 0, steal: 0, caught: 0 }, dogNight: null });
  if (nickname) u.nickname = nickname;
  if (avatar) u.avatar = avatar;
  if (!u.nickname) u.nickname = `Người xem ${String(userId).slice(-4)}`;
  return u;
}

const plotAt = (ctx, island, slot) => ctx.state.plots[plotId(island, slot)] ??= { id: plotId(island, slot), island, slot, owner: null, crop: null, water: 1, lastActive: ctx.now(), dogUntil: 0, shieldUntil: 0, deco: [], ver: 0 };
const owned = (ctx, island) => Object.values(ctx.state.plots).filter(p => p.island === island && p.owner);

function take(ctx, user, plot) {
  plot.owner = user.userId;
  plot.crop = null;
  plot.water = 1;
  plot.lastActive = ctx.now();
  plot.dogUntil = plot.shieldUntil = 0;
  plot.deco = [...user.deco];
  user.seat = { island: plot.island, slot: plot.slot };
  user.sign = plot.island;
  user.lastSeen = ctx.now();
  bump(ctx, plot);
  return plot;
}

function room(ctx, user, island) {
  const mine = owned(ctx, island), n = ctx.cfg.plotsPerIsland;
  if (mine.length < n) {
    const used = new Set(mine.map(p => p.slot));
    for (let s = 0; s < n; s++) if (!used.has(s)) return take(ctx, user, plotAt(ctx, island, s));
  }
  return null;
}

function evict(ctx, user, island) {
  const free = owned(ctx, island).filter(p => !p.crop).sort((a, b) => a.lastActive - b.lastActive)[0];
  if (!free) return null;
  ctx.state.users[free.owner].seat = null;
  return take(ctx, user, free);
}

// A plot for `user`: theirs if they have one; else the asked island, then the emptiest islands; a full island frees
// the plot of its least recently active player who has no crop growing. null when nothing can be freed.
export function seat(ctx, user, preferred) {
  if (user.seat) return ctx.state.plots[plotId(user.seat.island, user.seat.slot)];
  const order = [...(ISLANDS.includes(preferred) ? [preferred] : []), ...ISLANDS.filter(i => i !== preferred).sort((a, b) => owned(ctx, a).length - owned(ctx, b).length)];
  if (!ISLANDS.includes(preferred)) return order.map(i => room(ctx, user, i)).find(Boolean) ?? order.map(i => evict(ctx, user, i)).find(Boolean) ?? null;
  return room(ctx, user, preferred) ?? evict(ctx, user, preferred) ?? order.slice(1).map(i => room(ctx, user, i)).find(Boolean) ?? order.slice(1).map(i => evict(ctx, user, i)).find(Boolean) ?? null;
}

export function touch(ctx, user) {
  user.lastSeen = ctx.now();
  if (!user.seat) return;
  const plot = ctx.state.plots[plotId(user.seat.island, user.seat.slot)];
  plot.lastActive = ctx.now();
  bump(ctx, plot);
}

export const isAwake = (ctx, plot) => Boolean(plot.owner) && ctx.now() - plot.lastActive < ctx.cfg.sleepAfterMs;
