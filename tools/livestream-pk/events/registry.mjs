// One main event at a time. Events are plain definitions; the registry routes chat, gifts and ticks to
// whichever is active and reports start/end through onEvent.
import { createGiftDispatcher } from './gifts.mjs';

export function createRegistry({ now = Date.now, onEvent = () => {}, cfg = {}, ctx = {} } = {}) {
  const defs = new Map();
  const dispatcher = createGiftDispatcher({ cfg });
  let current = null;
  const registry = { ctx };

  registry.register = def => {
    defs.set(def.id, def);
    if (def.gift) dispatcher.register(def.id, def.gift);
  };
  registry.active = () => current;
  registry.start = (id, opts) => {
    const def = defs.get(id);
    if (!def || current) return false;
    if (def.needs && !def.needs(registry.ctx)) return false;
    if (!def.start(opts)) return false;
    current = id;
    onEvent({ type: 'event-start', id });
    return true;
  };
  registry.end = id => {
    if (current === null || current !== id) return;
    const def = defs.get(id);
    current = null;
    def?.end?.();
    onEvent({ type: 'event-end', id });
  };
  registry.tick = t => {
    const id = current;
    if (!id) return;
    const def = defs.get(id);
    def.tick?.(t);
    if (current === id && def.isDone?.()) registry.end(id);
  };
  registry.chat = (u, v, text) => {
    const def = current && defs.get(current);
    return !!(def?.chat && def.chat(u, v, text));
  };
  registry.gift = g => dispatcher.dispatch({ ...g, eventId: current });
  registry.views = t => {
    const out = {};
    for (const [id, def] of defs) {
      if (!def.view) continue;
      const v = def.view(t);
      if (v != null) out[id] = v;
    }
    return out;
  };
  return registry;
}
