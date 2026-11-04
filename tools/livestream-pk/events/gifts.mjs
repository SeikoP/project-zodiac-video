// Gift tiers and a per-event dispatcher. Effects are fixed per tier; dispatch never throws.

export const GIFT_DEFAULTS = { giftMid: 10, giftBig: 100 };

export function giftTier(diamonds, cfg = {}) {
  const mid = cfg.giftMid ?? GIFT_DEFAULTS.giftMid;
  const big = cfg.giftBig ?? GIFT_DEFAULTS.giftBig;
  if (!Number.isFinite(diamonds) || diamonds < mid) return 'small';
  if (diamonds < big) return 'mid';
  return 'big';
}

export function createGiftDispatcher({ cfg = {} } = {}) {
  const tables = new Map();
  function register(eventId, table) { tables.set(eventId, table ?? {}); }
  function dispatch(g) {
    const tier = giftTier(g.diamonds, cfg);
    const fn = g.eventId == null ? null : tables.get(g.eventId)?.[tier];
    if (typeof fn !== 'function') return { tier, handled: false };
    try {
      // an ability that finds nothing to act on (no lantern, an event already over) answers false: the gift then takes the ordinary path
      const done = fn({ user: g.user, viewer: g.viewer, team: g.team, diamonds: g.diamonds, tier });
      return { tier, handled: done !== false };
    } catch {
      return { tier, handled: false };
    }
  }
  return { register, dispatch };
}
