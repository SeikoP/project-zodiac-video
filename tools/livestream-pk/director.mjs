// The director turns a firehose of game events into a few on-screen effects per frame.
// A busy room can produce hundreds of likes/comments per second; the overlay should get
// at most a handful of effects every frame, with the important ones (big gifts, lit
// constellations, the full moon) never dropped and the routine ones summed or sampled.

export const DEFAULT_LIMITS = Object.freeze({
  joins: 3, // named joins per frame; the rest become a count
  dances: 6,
  wishes: 2,
  sparkles: 4,
  fireworks: 2,
  meteors: 1,
  hearts: 8, // avatars that float hearts per frame
  titles: 1,
  bells: 1,
  streaks: 2,
  hits: 4, // named boss hits per frame (crits first); the rest only count toward each sign's total
  cards: 4,
  loot: 3,
  fans: 2,
});

export function createDirector(limits = {}) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  let f = fresh();

  function fresh() {
    return { joins: [], moreJoins: 0, dances: new Set(), wishes: [], gifts: { sparkle: [], firework: [], meteor: [] }, hearts: new Map(), flows: new Map(), hits: [], hitSigns: new Map(), cards: [], moreCards: 0, loot: [], moreLoot: 0, fans: [], moreFans: 0, lit: [], titles: [], bells: [], moreBells: 0, streaks: [], other: [] };
  }

  function push(e) {
    switch (e.type) {
      case 'join': if (f.joins.length < L.joins) f.joins.push({ userId: e.userId, nickname: e.nickname, avatar: e.avatar, sign: e.sign, from: e.from }); else f.moreJoins++; break;
      case 'fan-arrive': if (f.fans.length < L.fans) f.fans.push(e); else f.moreFans++; break; // the whole fan club may walk in at once
      case 'dance': if (f.dances.size < L.dances) f.dances.add(e.userId); break;
      case 'wish': if (f.wishes.length < L.wishes) f.wishes.push(e); break;
      case 'likes': if (e.sign && (f.hearts.has(e.userId) || f.hearts.size < L.hearts)) f.hearts.set(e.userId, (f.hearts.get(e.userId) ?? 0) + e.count); break;
      case 'gift': {
        // A gift that doesn't fit its tier this frame is shown one tier down instead of vanishing.
        const order = ['meteor', 'firework', 'sparkle'], cap = { meteor: L.meteors, firework: L.fireworks, sparkle: L.sparkles };
        for (const tier of order.slice(order.indexOf(e.tier))) {
          if (f.gifts[tier].length < cap[tier]) { f.gifts[tier].push({ userId: e.userId, nickname: e.nickname, avatar: e.avatar, sign: e.sign, giftName: e.giftName, giftImage: e.giftImage, count: e.count, diamonds: e.diamonds }); break; }
        }
        break;
      }
      case 'flow': f.flows.set(`${e.from}>${e.to}`, (f.flows.get(`${e.from}>${e.to}`) ?? 0) + e.amount); break;
      case 'boss-hit': {
        f.hitSigns.set(e.sign, (f.hitSigns.get(e.sign) ?? 0) + e.dmg);
        if (f.hits.length < L.hits) f.hits.push(e);
        else if (e.crit) { const i = f.hits.findIndex(h => !h.crit); if (i >= 0) f.hits[i] = e; }
        break;
      }
      case 'loot': if (f.loot.length < L.loot) f.loot.push(e); else f.moreLoot++; break; // a moon shard for 40 people is one line, not 40
      case 'card': {
        // rare cards always make it; plain ones fill the remaining slots
        if (f.cards.length < L.cards) f.cards.push(e);
        else if (e.card.edition !== 'base') { const i = f.cards.findIndex(c => c.card.edition === 'base'); if (i >= 0) f.cards[i] = e; else f.moreCards++; }
        else f.moreCards++;
        break;
      }
      case 'lit': f.lit.push({ sign: e.sign, by: e.by }); break;
      case 'title-up': if (f.titles.length < L.titles) f.titles.push(e); break;
      case 'bell': if (f.bells.length < L.bells) f.bells.push({ userId: e.userId, nickname: e.nickname, kind: e.kind }); else f.moreBells++; break;
      case 'streak': if (f.streaks.length < L.streaks) f.streaks.push(e); break;
      case 'light': case 'fortune': case 'quiz-start': break; // shown through state, not as effects
      default: f.other.push(e); // rare, important: moon-full, wheel-complete, quiz-end, track, need-sign, night-start, reset…
    }
  }

  // Returns this frame's effects (empty array if nothing happened) and starts a new frame.
  function flush() {
    const fx = [];
    if (f.joins.length) fx.push({ type: 'joins', people: f.joins, more: f.moreJoins });
    if (f.dances.size) fx.push({ type: 'dance', userIds: [...f.dances] });
    for (const w of f.wishes) fx.push(w);
    for (const tier of ['meteor', 'firework', 'sparkle']) for (const g of f.gifts[tier]) fx.push({ type: 'gift', tier, ...g });
    if (f.hearts.size) fx.push({ type: 'hearts', from: [...f.hearts].map(([userId, count]) => ({ userId, count })) });
    if (f.flows.size) fx.push({ type: 'flows', flows: [...f.flows].map(([k, amount]) => { const [from, to] = k.split('>'); return { from, to, amount }; }) });
    if (f.hitSigns.size) fx.push({ type: 'boss-hits', hits: f.hits, bySign: Object.fromEntries(f.hitSigns) });
    if (f.cards.length) fx.push({ type: 'cards', cards: f.cards, more: f.moreCards });
    if (f.loot.length) fx.push({ type: 'loots', loot: f.loot, more: f.moreLoot });
    if (f.fans.length) fx.push({ type: 'fans', fans: f.fans, more: f.moreFans });
    for (const l of f.lit) fx.push({ type: 'lit', ...l });
    for (const t of f.titles) fx.push({ type: 'title-up', userId: t.userId, nickname: t.nickname, sign: t.sign, title: t.title });
    if (f.bells.length) fx.push({ type: 'bells', people: f.bells, more: f.moreBells });
    fx.push(...f.streaks);
    fx.push(...f.other);
    f = fresh();
    return fx;
  }

  return { push, flush };
}
