// A field event every 3-5 minutes keeps the screen moving and gives the whole room something to do together.
import { CROPS } from './crops.mjs';
import { addGold } from './progress.mjs';
import { bump, isAwake } from './world.mjs';

export const EVENT_TYPES = ['rain', 'pests', 'merchant', 'golden'];
const DURATION = { rain: 'rainMs', pests: 'pestStormMs', merchant: 'merchantMs', golden: 'goldenMs' };

export function modifiers(ctx) {
  const e = ctx.state.event, cfg = ctx.cfg;
  return { grow: e?.kind === 'rain' ? cfg.rainMult : 1, gold: e?.kind === 'golden' ? cfg.goldenMult : 1, boost: e?.kind === 'merchant' ? { crop: e.crop, mult: cfg.merchantMult } : null };
}

export function createEvents(ctx) {
  const { cfg, state } = ctx;
  const gap = () => cfg.eventMinMs + ctx.rng() * (cfg.eventMaxMs - cfg.eventMinMs);
  let nextAt = ctx.now() + gap(), last = null;

  function start(kind) {
    const now = ctx.now();
    const e = (state.event = { kind, endsAt: now + cfg[DURATION[kind]] });
    if (kind === 'merchant') e.crop = Object.keys(CROPS)[Math.floor(ctx.rng() * Object.keys(CROPS).length)];
    if (kind === 'pests') {
      const sick = Object.values(state.plots).filter(p => p.crop && p.crop.progress < 1 && isAwake(ctx, p));
      for (let i = sick.length - 1; i > 0; i--) { const j = Math.floor(ctx.rng() * (i + 1)); [sick[i], sick[j]] = [sick[j], sick[i]]; }
      const hit = sick.slice(0, Math.floor(sick.length * cfg.stormShare));
      for (const p of hit) { p.crop.pest = true; bump(ctx, p); }
      Object.assign(e, { total: hit.length, cleared: 0, participants: {} });
    }
    last = kind;
    ctx.emit({ type: 'event-start', kind, endsAt: e.endsAt, crop: e.crop ?? null, total: e.total ?? null });
  }

  function end() {
    const e = state.event;
    state.event = null;
    nextAt = ctx.now() + gap();
    let ok = true;
    if (e.kind === 'pests') {
      ok = e.total > 0 && e.cleared / e.total >= cfg.stormPass;
      if (ok) for (const id of Object.keys(e.participants)) addGold(state.users[id], cfg.stormReward);
    }
    ctx.emit({ type: 'event-end', kind: e.kind, ok });
  }

  return {
    tick() {
      const now = ctx.now();
      if (state.event) { if (now >= state.event.endsAt) end(); return; }
      if (now < nextAt) return;
      const kinds = EVENT_TYPES.filter(k => k !== last);
      start(kinds[Math.floor(ctx.rng() * kinds.length)]);
    },
    force(kind) { if (state.event) end(); start(kind); },
    current: () => state.event,
    notePestCleared(userId) {
      const e = state.event;
      if (e?.kind !== 'pests') return;
      e.cleared++;
      e.participants[userId] = true;
    },
  };
}
