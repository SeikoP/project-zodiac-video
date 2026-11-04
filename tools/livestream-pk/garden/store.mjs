// Saving and loading the garden: a bad file never stops the show, a failed write is retried, writes never overlap.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { emptyGardenState, TIERS } from './world.mjs';

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

function moveLegacy(raw) {
  const zones = new Set();
  for (const [id, p] of Object.entries(raw.plots ?? {})) { const zone = p?.island ?? id.split(':')[0]; if (zone) zones.add(zone); }
  for (const u of Object.values(raw.users ?? {})) if (u?.seat?.island) zones.add(u.seat.island);
  const placement = new Map([...zones].sort().map((old, i) => [old, { tier: TIERS[i % TIERS.length].id, band: Math.floor(i / TIERS.length) }]));
  const moveId = id => {
    if (!id) return id;
    const [zone, rawSlot] = String(id).split(':');
    const p = placement.get(zone);
    return p ? `${p.tier}:${p.band * 36 + (Number(rawSlot) || 0)}` : id;
  };
  const plots = {};
  for (const [id, old] of Object.entries(raw.plots ?? {})) {
    const [zone, rawSlot] = String(id).split(':');
    const oldZone = old?.island ?? zone, p = placement.get(oldZone);
    if (!p) { plots[id] = old; continue; }
    const slot = p.band * 36 + (Number(old.slot ?? rawSlot) || 0), nextId = `${p.tier}:${slot}`;
    const plot = { ...old, id: nextId, tier: p.tier, slot };
    delete plot.island;
    if (plot.crop?.type === 'linhthao') plot.crop.type = 'nammay';
    plots[nextId] = plot;
  }
  const users = isObj(raw.users) ? raw.users : {};
  for (const user of Object.values(users)) if (user && typeof user === 'object') {
    if (user.seat?.island) {
      const p = placement.get(user.seat.island);
      user.seat = p ? { tier: p.tier, slot: p.band * 36 + (Number(user.seat.slot) || 0) } : null;
    }
    delete user.sign;
  }
  const thefts = (Array.isArray(raw.thefts) ? raw.thefts : []).map(t => ({ ...t, plotId: moveId(t.plotId) }));
  const event = raw.event ? { ...raw.event, ...(raw.event.crop === 'linhthao' && { crop: 'nammay' }) } : null;
  return { ...raw, v: 3, users, plots, thefts, event };
}

export function loadState(file, now = Date.now()) {
  const fresh = emptyGardenState(now);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fresh; }
  if (!isObj(raw)) return fresh;
  const migrated = raw.v === 2 || raw.v === 3 || raw.v === 4 ? raw : moveLegacy(raw);
  return {
    ...fresh, ...migrated, v: migrated.v >= 4 ? 4 : 3,
    users: isObj(migrated.users) ? migrated.users : {},
    plots: isObj(migrated.plots) ? migrated.plots : {},
    thefts: Array.isArray(migrated.thefts) ? migrated.thefts : [],
    ver: Number.isFinite(migrated.ver) ? migrated.ver : 0,
    night: typeof migrated.night === 'string' ? migrated.night : fresh.night,
    event: migrated.event ?? null,
    session: isObj(migrated.session) ? migrated.session : null,
    lastTick: now, // time spent switched off does not count as growth
  };
}

export function createSaver({ file, getState, intervalMs = 10000, fs: io = fsp, log = console.error }) {
  let dirty = false, chain = Promise.resolve();
  const write = async () => {
    dirty = false;
    try {
      await io.mkdir(path.dirname(file), { recursive: true });
      await io.writeFile(`${file}.tmp`, JSON.stringify(getState()));
      await io.rename(`${file}.tmp`, file);
    } catch (e) { dirty = true; log('[garden save]', e.message); }
  };
  const flush = () => (chain = chain.then(write));
  const timer = setInterval(() => { if (dirty) flush(); }, intervalMs);
  timer.unref?.();
  return { markDirty: () => { dirty = true; }, flush, dirty: () => dirty, stop: () => clearInterval(timer) };
}

// Forget people who only dropped by once (no harvest, no theft, no xp, no decorations) a week ago.
export function pruneUsers(state, now, days = 7) {
  for (const [id, u] of Object.entries(state.users)) {
    const idle = now - u.lastSeen > days * 86_400_000;
    const nothing = !u.xp && !u.deco?.length && !u.stats?.harvest && !u.stats?.steal && !u.stats?.caught && !Object.keys(u.titles ?? {}).length;
    if (!idle || !nothing) continue;
    if (u.seat) { const p = state.plots[`${u.seat.tier}:${u.seat.slot}`]; if (p) { p.owner = null; p.crop = null; } }
    delete state.users[id];
  }
}
