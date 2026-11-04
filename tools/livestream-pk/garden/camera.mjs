// The camera director. The server decides every shot (so it is testable); the page only eases toward it.
// Gifts get the best shots, but the light is shared: once a gift has been shown, a waiting non-gift moment
// (first ripe crop, level up, a catch) is shown before more gifts until two of them were shown in the last minute.
import { ISLANDS, islandCenter, plotCenter } from './world.mjs';

const PRIORITY = { gift: 1, steal: 3, catch: 3, levelup: 4, ripe: 4, 'event-start': 5 };
const WIDTH = 1080, HEIGHT = 1920;

export function createCamera({ cfg, now }) {
  const c = cfg.camera;
  const worldCenter = { x: cfg.islandCols * cfg.islandSize / 2, y: Math.ceil(ISLANDS.length / cfg.islandCols) * cfg.islandSize / 2 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let queue = [], current = null, locked = false, shown = [], idleIdx = 0;
  const activity = {};

  const split = id => { const [island, slot] = String(id).split(':'); return { island, slot: Number(slot) }; };
  const plotAt = id => { const p = split(id); return { island: p.island, ...plotCenter(p.island, p.slot, cfg) }; };

  function candidate(e) {
    const t = now(), base = { at: t, type: e.type, ttl: e.type === 'gift' ? c.giftTtlMs : c.ttlMs, gift: e.type === 'gift' };
    if (e.type === 'gift') {
      if (!e.plotId) return { ...base, kind: 'gift', priority: 1, island: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.giftHoldMs };
      const big = e.tier === 'rain' || e.tier === 'tree', p = plotAt(e.plotId);
      return big ? { ...base, kind: 'gift', priority: 1, island: p.island, x: p.x, y: p.y, zoom: c.zoomClose, holdMs: c.giftHoldMs }
        : { ...base, kind: 'gift', priority: 2, island: p.island, ...islandCenter(p.island, cfg), zoom: c.zoomIsland, holdMs: c.lowGiftHoldMs };
    }
    if (e.type === 'steal' || e.type === 'catch') {
      const a = plotAt(e.plotId), b = e.thiefPlotId ? plotAt(e.thiefPlotId) : a;
      const zoom = clamp(Math.min(WIDTH / (Math.abs(a.x - b.x) + 480), HEIGHT / (Math.abs(a.y - b.y) + 480)), c.zoomIsland, c.zoomClose);
      return { ...base, kind: e.type, priority: 3, island: a.island, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom, holdMs: c.stealHoldMs };
    }
    if (e.type === 'levelup' || (e.type === 'ripe' && e.crop === 'linhthao')) {
      const p = plotAt(e.plotId);
      return { ...base, kind: e.type, priority: 4, island: p.island, x: p.x, y: p.y, zoom: 1.6, holdMs: c.levelHoldMs };
    }
    if (e.type === 'event-start') return { ...base, kind: 'event', priority: 5, island: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.eventHoldMs };
    return null;
  }

  function noteActivity(island) { if (island) activity[island] = (activity[island] ?? 0) + 1; }

  function push(e) {
    if (e.plotId) noteActivity(split(e.plotId).island);
    if (locked) return;
    const cand = candidate(e);
    if (!cand) return;
    const same = cand.island && queue.find(q => q.island === cand.island && cand.at - q.at <= c.mergeMs);
    if (same) {
      Object.assign(same, { kind: 'island', priority: Math.min(same.priority, cand.priority), ...islandCenter(cand.island, cfg), zoom: c.zoomIsland, holdMs: Math.max(same.holdMs, cand.holdMs), gift: same.gift && cand.gift, ttl: Math.max(same.ttl, cand.ttl) });
      return;
    }
    queue.push(cand);
    if (queue.length > c.queueMax) {
      const worst = queue.reduce((w, q) => (q.priority > w.priority || (q.priority === w.priority && q.at < w.at) ? q : w));
      queue.splice(queue.indexOf(worst), 1);
    }
  }

  function choose() {
    const t = now();
    queue = queue.filter(q => t - q.at <= q.ttl);
    if (!queue.length) return null;
    shown = shown.filter(s => t - s.t <= c.quotaWindowMs);
    const nonGift = shown.filter(s => !s.gift).length, gifts = shown.filter(s => s.gift).length;
    const pool = gifts >= 1 && nonGift < c.quotaMin && queue.some(q => !q.gift) ? queue.filter(q => !q.gift) : queue;
    const best = pool.reduce((b, q) => (q.priority < b.priority || (q.priority === b.priority && q.at < b.at) ? q : b));
    queue.splice(queue.indexOf(best), 1);
    return best;
  }

  function idleShot() {
    const ranked = ISLANDS.filter(i => activity[i] > 0).sort((a, b) => activity[b] - activity[a]);
    const island = ranked[0] ?? ISLANDS[idleIdx++ % ISLANDS.length];
    for (const k of Object.keys(activity)) activity[k] *= 0.5;
    return { kind: 'idle', priority: 9, island, ...islandCenter(island, cfg), zoom: c.zoomIsland, holdMs: c.idleHoldMs, gift: false };
  }

  function start(shot) {
    const t = now();
    current = { ...shot, startedAt: t, until: t + (shot.kind === 'gap' ? shot.holdMs : Math.max(shot.holdMs, c.holdMinMs)) };
    if (shot.kind !== 'gap' && shot.kind !== 'idle') shown.push({ t, gift: shot.gift });
    const { at, ttl, gift, type, ...out } = shot;
    return { ...out, label: type ?? shot.kind };
  }

  return {
    push, noteActivity,
    setLock(on) { locked = Boolean(on); if (locked) queue = []; },
    tick() {
      if (locked) return null;
      const t = now();
      if (current && t < current.until) return null;
      queue = queue.filter(q => t - q.at <= q.ttl);
      if (queue.length && current && current.kind !== 'gap') return start({ kind: 'gap', priority: 9, island: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.gapMs, gift: false });
      return start(choose() ?? idleShot());
    },
    state: () => ({ queue: queue.map(q => ({ ...q })), current: current && { ...current }, locked }),
  };
}
