// The camera director. The server decides every shot (so it is testable); the page only eases toward it.
// Gifts get the best shots, but the light is shared: once a gift has been shown, a waiting non-gift moment
// (first ripe crop, level up, a catch) is shown before more gifts until two of them were shown in the last minute.
import { TIERS, plotCenter, tierCenter } from './world.mjs';

const PRIORITY = { gift: 1, steal: 3, catch: 3, levelup: 4, ripe: 4, 'event-start': 5 };
const WIDTH = 1080, HEIGHT = 1920;

export function createCamera({ cfg, now }) {
  const c = cfg.camera;
  const worldCenter = { x: cfg.tierWidth / 2, y: TIERS.length * cfg.tierHeight / 2 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let queue = [], current = null, locked = false, shown = [], idleIndex = 0;

  const split = id => { const [tier, slot] = String(id).split(':'); return { tier, slot: Number(slot) }; };
  const plotAt = id => { const p = split(id); return { tier: p.tier, ...plotCenter(p.tier, p.slot, cfg) }; };

  function candidate(e) {
    const t = now(), base = { at: t, type: e.type, plotId: e.plotId, ttl: e.type === 'gift' ? c.giftTtlMs : c.ttlMs, gift: e.type === 'gift' };
    if (e.type === 'joined') {
      const p = plotAt(e.plotId);
      return { ...base, kind: 'welcome', priority: 2, tier: p.tier, x: p.x, y: p.y, zoom: c.zoomClose, holdMs: c.giftHoldMs };
    }
    if (e.type === 'gift') {
      if (!e.plotId) return { ...base, kind: 'gift', priority: 1, tier: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.giftHoldMs };
      const big = e.tier === 'rain' || e.tier === 'tree', p = plotAt(e.plotId);
      return { ...base, kind: 'gift', priority: big ? 1 : 2, tier: p.tier, x: p.x, y: p.y, zoom: big ? c.zoomClose : c.zoomTier, holdMs: big ? c.giftHoldMs : c.lowGiftHoldMs };
    }
    if (e.type === 'steal' || e.type === 'catch') {
      const a = plotAt(e.plotId), b = e.thiefPlotId ? plotAt(e.thiefPlotId) : a;
      const zoom = clamp(Math.min(WIDTH / (Math.abs(a.x - b.x) + 480), HEIGHT / (Math.abs(a.y - b.y) + 480)), c.zoomTier, c.zoomClose);
      return { ...base, kind: e.type, priority: 3, tier: a.tier, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom, holdMs: c.stealHoldMs };
    }
    if (e.type === 'levelup' || (e.type === 'ripe' && (e.first || e.crop === 'nammay'))) {
      const p = plotAt(e.plotId);
      return { ...base, kind: e.type, priority: 4, tier: p.tier, x: p.x, y: p.y, zoom: c.zoomClose, holdMs: c.levelHoldMs };
    }
    if (e.type === 'event-start') return { ...base, kind: 'event', priority: 5, tier: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.eventHoldMs };
    return null;
  }

  function push(e) {
    if (locked) return;
    const cand = candidate(e);
    if (!cand) return;
    const same = cand.tier && queue.find(q => q.tier === cand.tier && cand.at - q.at <= c.mergeMs);
    if (same) {
      Object.assign(same, { kind: 'tier', priority: Math.min(same.priority, cand.priority), x: (same.x + cand.x) / 2, y: (same.y + cand.y) / 2, plotId: null, zoom: c.zoomTier, holdMs: Math.max(same.holdMs, cand.holdMs), gift: same.gift && cand.gift, ttl: Math.max(same.ttl, cand.ttl) });
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
    // The wide 432-pot overview made every pot unreadable on a phone. Tour 12 readable
    // showcase windows instead; plot coordinates and persisted ownership stay unchanged.
    const index = idleIndex++ % (TIERS.length * 3);
    const tier = TIERS[Math.floor(index / 3)];
    const column = index % 3;
    const x = cfg.tierWidth * (.24 + column * .26);
    return { kind: 'idle', priority: 9, tier: tier.id, x, y: tierCenter(tier.id, cfg).y, zoom: c.zoomTier, holdMs: c.idleHoldMs, gift: false };
  }

  function start(shot) {
    const t = now();
    current = { ...shot, startedAt: t, until: t + (shot.kind === 'gap' ? shot.holdMs : Math.max(shot.holdMs, c.holdMinMs)) };
    if (shot.kind !== 'gap' && shot.kind !== 'idle') shown.push({ t, gift: shot.gift });
    const { at, ttl, gift, type, ...out } = shot;
    return { ...out, label: type ?? shot.kind };
  }

  return {
    push,
    setLock(on) { locked = Boolean(on); if (locked) queue = []; },
    tick() {
      if (locked) return null;
      const t = now();
      const idleYields = current?.kind === 'idle' && queue.length && t - current.startedAt >= c.holdMinMs; // a drift is filler: a real moment may cut it short
      if (current && t < current.until && !idleYields) return null;
      queue = queue.filter(q => t - q.at <= q.ttl);
      if (queue.length && current && current.kind !== 'gap' && current.kind !== 'idle') return start({ kind: 'gap', priority: 9, tier: null, ...worldCenter, zoom: c.zoomWorld, holdMs: c.gapMs, gift: false });
      return start(choose() ?? idleShot());
    },
    state: () => ({ queue: queue.map(q => ({ ...q })), current: current && { ...current }, locked }),
  };
}
