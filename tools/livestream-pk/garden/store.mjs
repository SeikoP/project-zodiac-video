// Saving and loading the garden: a bad file never stops the show, a failed write is retried, writes never overlap.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { emptyGardenState } from './world.mjs';

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

export function loadState(file, now = Date.now()) {
  const fresh = emptyGardenState(now);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fresh; }
  if (!isObj(raw)) return fresh;
  return {
    ...fresh, ...raw, v: 1,
    users: isObj(raw.users) ? raw.users : {},
    plots: isObj(raw.plots) ? raw.plots : {},
    thefts: Array.isArray(raw.thefts) ? raw.thefts : [],
    ver: Number.isFinite(raw.ver) ? raw.ver : 0,
    night: typeof raw.night === 'string' ? raw.night : fresh.night,
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
    const nothing = !u.xp && !u.deco?.length && !u.stats.harvest && !u.stats.steal && !u.stats.caught;
    if (!idle || !nothing) continue;
    if (u.seat) { const p = state.plots[`${u.seat.island}:${u.seat.slot}`]; if (p) { p.owner = null; p.crop = null; } }
    delete state.users[id];
  }
}
