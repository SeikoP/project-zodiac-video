// Test helpers: a context with a fake clock, a fixed rng and an event log.
import { gardenConfig } from './config.mjs';
import { emptyGardenState, ensureUser, seat } from './world.mjs';

export function makeCtx(over = {}) {
  let t = over.start ?? Date.UTC(2026, 10, 4, 12);
  const events = [];
  const state = over.state ?? emptyGardenState(t);
  const ctx = { state, cfg: gardenConfig(over.cfg), now: () => t, rng: over.rng ?? (() => 0.5), emit: e => events.push(e) };
  return { ctx, events, advance: ms => { t += ms; } };
}

// A seated player; `level`/`gold` seed the record directly.
export function addUser(ctx, id, { island = 'leo', level = 1, gold = 0 } = {}) {
  const user = ensureUser(ctx, { userId: id, nickname: id.toUpperCase(), avatar: '' });
  user.level = level;
  user.gold = gold;
  const plot = seat(ctx, user, island);
  return { user, plot };
}
