// One main event at a time. Events are plain definitions; the registry routes chat, gifts and ticks to
// whichever is active and reports start/end through onEvent. Nothing a definition throws gets out: it is
// reported once as { type: 'event-error', id, where } and the registry carries on (a def whose start, needs
// or tick throws never stays active).
import { createGiftDispatcher } from './gifts.mjs';

export function createRegistry({ now = Date.now, onEvent = () => {}, cfg = {}, ctx = {} } = {}) {
  const defs = new Map();
  const dispatcher = createGiftDispatcher({ cfg });
  let current = null;
  const registry = { ctx };

  function guard(id, where, fn, fallback) {
    try { return fn(); } catch {
      try { onEvent({ type: 'event-error', id, where }); } catch { /* a broken listener must not break the registry */ }
      return fallback;
    }
  }

  registry.register = def => {
    defs.set(def.id, def);
    if (def.gift) dispatcher.register(def.id, def.gift);
  };
  registry.active = () => current;
  // Adopt an event whose state was loaded from disk (nothing to start, nothing to announce).
  registry.adopt = id => {
    if (current !== null || !defs.has(id)) return false;
    current = id;
    return true;
  };
  registry.start = (id, opts) => {
    const def = defs.get(id);
    if (!def) return false;
    // an event that finished between two ticks (a boss beaten by a gift) does not block the next one
    if (current !== null && guard(current, 'isDone', () => defs.get(current)?.isDone?.(), false)) registry.end(current);
    if (current !== null) return false;
    if (def.needs && !guard(id, 'needs', () => def.needs(registry.ctx), false)) return false;
    let threw = true;
    const started = guard(id, 'start', () => { const ok = def.start(opts); threw = false; return ok; }, false);
    if (threw) guard(id, 'end', () => def.end?.()); // a start that died half way must not leave its state behind
    if (!started) return false;
    current = id;
    onEvent({ type: 'event-start', id });
    return true;
  };
  registry.end = id => {
    if (current === null || current !== id) return;
    const def = defs.get(id);
    current = null;
    guard(id, 'end', () => def?.end?.());
    onEvent({ type: 'event-end', id });
  };
  registry.tick = t => {
    const id = current;
    if (!id) return;
    const def = defs.get(id);
    if (!guard(id, 'tick', () => { def.tick?.(t); return true; }, false)) return registry.end(id);
    if (current === id && guard(id, 'isDone', () => def.isDone?.(), false)) registry.end(id);
  };
  registry.chat = (u, v, text) => {
    const def = current && defs.get(current);
    return !!(def?.chat && guard(current, 'chat', () => def.chat(u, v, text), false));
  };
  // One viewer action (comment | like | gift | follow | share) for the active event; returns what it counted for (0 if nothing).
  registry.contribute = (action, u, v, n) => {
    const def = current && defs.get(current);
    if (typeof def?.contribute !== 'function') return 0;
    const got = guard(current, 'contribute', () => def.contribute(u, v, action, n), 0);
    return Number.isFinite(got) ? got : 0;
  };
  registry.gift = g => dispatcher.dispatch({ ...g, eventId: current });
  registry.views = t => {
    const out = {};
    for (const [id, def] of defs) {
      if (!def.view) continue;
      const v = guard(id, 'view', () => def.view(t), null);
      if (v != null) out[id] = v;
    }
    return out;
  };
  return registry;
}
