// Many people doing the same small thing in the same moment become one effect ("23 people are watering"),
// not 23 popups. One-off moments (gifts, thefts, level ups) pass straight through.
const MERGE = new Set(['joined', 'water', 'help', 'plant', 'harvest', 'pest-cleared', 'weed-cleared', 'fertilize','boss-hit']);
const tierOf = e => (e.plotId ? String(e.plotId).split(':')[0] : null);

export function createCoalescer({ windowMs = 250, now = Date.now } = {}) {
  let groups = new Map(), direct = [];
  return {
    push(e) {
      if(['title','levelup'].includes(e.type)&&e.userId){const previous=direct.find(p=>['title','levelup'].includes(p.type)&&p.userId===e.userId);if(previous){const titles=[...(previous.titles??[]),...(e.titles??[])];Object.assign(previous,{...e,type:titles.length?'title':e.type,level:e.level??previous.level,titles});return;}}
      if (!MERGE.has(e.type)) return void direct.push(e);
      const tier = tierOf(e), key = `${e.type}|${tier}`;
      const g = groups.get(key) ?? { first: now(), fx: { type: e.type,eventId:e.eventId,receivedAt:e.receivedAt, tier, count: 0, names: [] } };
      g.fx.count++;
      if(e.type==='boss-hit')g.fx.damage=(g.fx.damage??0)+e.damage;
      if (e.plotId) {
        g.fx.plots ??= [];
        if (g.fx.plots.length < 8) g.fx.plots.push({ plotId: e.plotId,...(e.before?{before:e.before}:{}),...(e.after?{after:e.after}:{}),...(e.targetId?{targetId:e.targetId}:{}),...(e.xp!=null?{xp:e.xp}:{}), ...(e.gold != null ? { gold: e.gold } : {}) });
      }
      if (e.type === 'joined' && e.plotId) {
        g.fx.seats ??= [];
        if (g.fx.seats.length < 3) g.fx.seats.push({ nickname: e.nickname ?? '', slot: Number(String(e.plotId).split(':')[1]) });
      }
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
