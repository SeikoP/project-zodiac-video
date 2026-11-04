// Many people doing the same small thing in the same moment become one effect ("23 people are watering"),
// not 23 popups. One-off moments (gifts, thefts, level ups) pass straight through.
const MERGE = new Set(['joined', 'water', 'help', 'plant', 'harvest', 'pest-cleared']);
const tierOf = e => (e.plotId ? String(e.plotId).split(':')[0] : null);

export function createCoalescer({ windowMs = 250, now = Date.now } = {}) {
  let groups = new Map(), direct = [];
  return {
    push(e) {
      if (!MERGE.has(e.type)) return void direct.push(e);
      const tier = tierOf(e), key = `${e.type}|${tier}`;
      const g = groups.get(key) ?? { first: now(), fx: { type: e.type, tier, count: 0, names: [] } };
      g.fx.count++;
      if (e.nickname && g.fx.names.length < 3 && !g.fx.names.includes(e.nickname)) g.fx.names.push(e.nickname);
      groups.set(key, g);
    },
    flush() {
      const out = direct;
      direct = [];
      const t = now();
      for (const [key, g] of groups) if (t - g.first >= windowMs) { out.push(g.fx); groups.delete(key); }
      return out;
    },
  };
}
