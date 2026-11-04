// Deliberate camera director for a small LIVE room: stay on a stable active-garden overview,
 // queue meaningful moments, then hold each close shot long enough to understand the player's crop.
import { TIERS, plotCenter, tierCenter } from './world.mjs';

const WIDTH = 1080, VIEW_HEIGHT = 1320;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createCamera({ cfg, now, getPlots = () => [] }) {
  const c = cfg.camera;
  let queue = [], current = null, locked = false, shown = [];

  const split = id => { const [tier, slot] = String(id).split(':'); return { tier, slot: Number(slot) }; };
  const plotAt = id => { const p = split(id); return { tier: p.tier, ...plotCenter(p.tier, p.slot, cfg) }; };

  function overviewTarget() {
    const active = getPlots().filter(p => p?.owner);
    if (!active.length) {
      const p = tierCenter(TIERS[0].id, cfg);
      return { tier: TIERS[0].id, x: p.x, y: p.y - 120 / c.zoomWorld, zoom: c.zoomWorld };
    }
    const pts = active.map(p => ({ p, ...plotCenter(p.tier, p.slot, cfg) }));
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const width = Math.max(cfg.plotCell * 5, maxX - minX + cfg.plotCell * 3.4);
    const height = Math.max(cfg.plotCell * 5, maxY - minY + cfg.plotCell * 3.6);
    const zoom = clamp(Math.min(WIDTH / width, VIEW_HEIGHT / height) * .88, c.zoomWorld, c.zoomTier);
    const tier = pts.every(p => p.p.tier === pts[0].p.tier) ? pts[0].p.tier : null;
    return { tier, x: (minX + maxX) / 2, y: (minY + maxY) / 2 - 120 / zoom, zoom };
  }

  function baseOf(e) {
    return { at: now(), type: e.type, plotId: e.plotId ?? null, nickname: e.nickname ?? null,
      ttl: e.type === 'gift' ? c.giftTtlMs : c.ttlMs, gift: e.type === 'gift' };
  }

  function candidate(e) {
    const base = baseOf(e);
    if (e.type === 'event-start') return { ...base, kind: 'event', priority: 0, ...overviewTarget(), holdMs: c.eventHoldMs, easeMs: c.overviewEaseMs, eventKind: e.kind };
    if (e.type === 'gift') {
      if (!e.plotId) return { ...base, kind: 'gift', priority: 1, ...overviewTarget(), holdMs: c.giftHoldMs, easeMs: c.overviewEaseMs, giftKind: e.tier };
      const p = plotAt(e.plotId), big = e.tier === 'rain' || e.tier === 'tree';
      return { ...base, kind: 'gift', priority: big ? 1 : 2, tier: p.tier, x: p.x, y: p.y, zoom: c.zoomClose,
        holdMs: big ? c.giftHoldMs : c.lowGiftHoldMs, easeMs: c.easeMs, giftKind: e.tier };
    }
    if (e.type === 'steal' || e.type === 'catch') {
      const a = plotAt(e.plotId), b = e.thiefPlotId ? plotAt(e.thiefPlotId) : a;
      const zoom = clamp(Math.min(WIDTH / (Math.abs(a.x - b.x) + 520), VIEW_HEIGHT / (Math.abs(a.y - b.y) + 520)), c.zoomTier, c.zoomClose);
      return { ...base, kind: e.type, priority: 2, tier: a.tier, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom, holdMs: c.stealHoldMs, easeMs: c.easeMs };
    }
    if (e.type === 'levelup' || (e.type === 'ripe' && (e.first || e.crop === 'nammay'))) {
      const p = plotAt(e.plotId);
      return { ...base, kind: e.type, priority: 3, tier: p.tier, x: p.x, y: p.y, zoom: c.zoomClose, holdMs: c.levelHoldMs, easeMs: c.easeMs };
    }
    if (e.type === 'joined') {
      const p = plotAt(e.plotId);
      return { ...base, kind: 'welcome', priority: 4, tier: p.tier, x: p.x, y: p.y, zoom: c.zoomClose, holdMs: c.welcomeHoldMs, easeMs: c.easeMs };
    }
    return null;
  }

  function trim() {
    const t = now();
    queue = queue.filter(q => t - q.at <= q.ttl);
    if (queue.length <= c.queueMax) return;
    queue.sort((a, b) => a.priority - b.priority || a.at - b.at);
    queue.length = c.queueMax;
  }

  function push(e) {
    if (locked) return;
    const cand = candidate(e);
    if (!cand) return;
    // A wave of arrivals must not monopolize the camera; keep at most two pending welcomes.
    if (cand.kind === 'welcome' && queue.filter(q => q.kind === 'welcome').length >= 2) return;
    // Repeated gift packets for the same pot inside a short window are one visual moment.
    if (cand.kind === 'gift' && cand.plotId) {
      const same = queue.find(q => q.kind === 'gift' && q.plotId === cand.plotId && cand.at - q.at <= c.mergeMs);
      if (same) {
        Object.assign(same, { at: cand.at, priority: Math.min(same.priority, cand.priority), holdMs: Math.max(same.holdMs, cand.holdMs),
          giftKind: cand.giftKind, ttl: Math.max(same.ttl, cand.ttl) });
        return;
      }
    }
    queue.push(cand);
    trim();
  }

  function choose() {
    trim();
    if (!queue.length) return null;
    shown = shown.filter(s => now() - s.t <= c.quotaWindowMs);
    const gifts = shown.filter(s => s.gift).length, nonGift = shown.filter(s => !s.gift).length;
    const pool = gifts >= 1 && nonGift < c.quotaMin && queue.some(q => !q.gift) ? queue.filter(q => !q.gift) : queue;
    const best = pool.reduce((a, b) => (b.priority < a.priority || (b.priority === a.priority && b.at < a.at) ? b : a));
    queue.splice(queue.indexOf(best), 1);
    return best;
  }

  const overviewShot = () => ({ kind: 'overview', priority: 9, ...overviewTarget(), holdMs: Infinity, easeMs: c.overviewEaseMs, gift: false });

  function start(shot) {
    const t = now();
    const hold = shot.kind === 'overview' ? Infinity : Math.max(shot.holdMs, c.holdMinMs);
    current = { ...shot, startedAt: t, until: hold === Infinity ? Infinity : t + hold };
    if (shot.kind !== 'overview') shown.push({ t, gift: shot.gift });
    const { at, ttl, gift, type, ...out } = shot;
    return { ...out, label: type ?? shot.kind, pending: queue.length };
  }

  return {
    push,
    setLock(on) { locked = Boolean(on); if (locked) queue = []; },
    tick() {
      if (locked) return null;
      trim();
      const t = now();
      // Overview is home base: any queued real moment can leave it immediately.
      if (current?.kind === 'overview' && queue.length) return start(choose());
      if (current && t < current.until) return null;
      const next = choose();
      if (next) return start(next);
      if (!current || current.kind !== 'overview') return start(overviewShot());
      return null;
    },
    state: () => ({ queue: queue.map(q => ({ ...q })), current: current && { ...current }, locked }),
  };
}
