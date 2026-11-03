// The star chest and the card collection. The chest opens on the clock (every chestEveryMinutes, on the
// quarter hour by default) for a short window; viewers who are there and comment "nhận" get one card. A
// countdown to the next chest is always on screen, so there is always a reason to stay a few more minutes.
// Collections live on the viewer and last across nights; "khoe thẻ" shows yours on stream.
import { EDITION, CARD_TOTAL, cardId, parseCard } from './public/cards.js';

export const CARD_DEFAULTS = Object.freeze({
  chestEveryMinutes: 15, // 0 turns the chest off
  chestOpenSeconds: 25,
  chestIdleMinutes: 10, // skip a chest nobody is around for
  cardOwnSignShare: 0.5, // a drawn card is your own sign this often, otherwise any sign
  cardStarChance: 0.15,
  cardSpecialChance: 0.06, // a sky edition (Thủy Nghịch, Trăng Tròn) when the sky allows one
  cardHourChance: 0.3, // the current planetary hour's edition
  cardGoldChance: 0, // Hoàng Kim only comes from the pity counter (raise for a rare surprise)
  cardPity: 10, // this many chest cards in a row without a rare one (rarity 3+) → the next is Hoàng Kim
  showCooldownSeconds: 60,
  combineCount: 3, // "ghép thẻ": this many copies of a plain card → one Tinh Tú
});

export function createCards({ st, cfg, now, rng, onEvent, signs, specials, hourEdition = () => null }) {
  const period = () => cfg.chestEveryMinutes * 60000;
  st.chest ??= { no: 0, openUntil: 0, claimed: {}, recent: [] };
  const nextChestAt = () => (period() ? Math.ceil((now() + 1) / period()) * period() : Infinity);
  let scheduled = nextChestAt();

  function open() {
    const c = st.chest;
    c.no++;
    c.openUntil = now() + cfg.chestOpenSeconds * 1000;
    c.claimed = {};
    c.recent = [];
    onEvent({ type: 'chest-open', no: c.no, seconds: cfg.chestOpenSeconds });
  }
  function close() {
    const c = st.chest;
    c.openUntil = 0;
    onEvent({ type: 'chest-close', no: c.no, claims: Object.keys(c.claimed).length });
  }
  const isOpen = () => now() < st.chest.openUntil;

  // Draws one card for a viewer. `edition` forces one (the boss MVP); otherwise star/sky editions by chance.
  function draw(v, edition) {
    const sign = edition === 'boss' || rng() < cfg.cardOwnSignShare ? v.sign : signs[Math.floor(rng() * signs.length)];
    if (!edition) {
      const sky = specials(), hourEd = hourEdition();
      const roll = rng();
      edition = sky.length && roll < cfg.cardSpecialChance ? sky[Math.floor(rng() * sky.length)] : roll < cfg.cardSpecialChance + cfg.cardStarChance ? 'star'
        : hourEd && roll < cfg.cardSpecialChance + cfg.cardStarChance + cfg.cardHourChance ? hourEd : 'base';
    }
    return cardId(sign, edition);
  }

  function give(u, v, id, why) {
    v.cards ??= {};
    const isNew = !v.cards[id];
    v.cards[id] = (v.cards[id] ?? 0) + 1;
    const unique = Object.keys(v.cards).length;
    const { sign, edition } = parseCard(id);
    onEvent({ type: 'card', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, card: { sign, edition }, isNew, unique, why, pityLeft: Math.max(0, cfg.cardPity - (v.pity ?? 0)) });
    if (!v.setDone && signs.every(s => v.cards[cardId(s, 'base')] || v.cards[cardId(s, 'star')])) {
      v.setDone = true;
      onEvent({ type: 'set-complete', userId: u.userId, nickname: v.nickname, sign: v.sign });
    }
    return id;
  }

  // "nhận" while the chest is open: one card per viewer per chest. Returns true when the comment was a claim.
  function claim(u, v) {
    if (!isOpen() || st.chest.claimed[u.userId]) return false;
    if (!v.sign) { onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'chest' }); return true; }
    st.chest.claimed[u.userId] = true;
    // the pity counter: a rare card (rarity 3+) resets it; the cardPity-th chest without one is Hoàng Kim
    v.pity = (v.pity ?? 0) + 1;
    const pick = v.pity >= cfg.cardPity || (cfg.cardGoldChance > 0 && rng() < cfg.cardGoldChance) ? cardId(v.sign, 'gold') : draw(v);
    if (EDITION[parseCard(pick).edition].rarity >= 3) v.pity = 0;
    const id = give(u, v, pick, 'chest');
    st.chest.recent.unshift({ nickname: v.nickname, card: parseCard(id) });
    st.chest.recent.length = Math.min(st.chest.recent.length, 4);
    return true;
  }

  // "khoe thẻ": the viewer's collection on stream (rate-limited per viewer).
  function show(u, v) {
    if (now() - (v.showAt ?? 0) < cfg.showCooldownSeconds * 1000) return;
    v.showAt = now();
    const ids = Object.keys(v.cards ?? {});
    const best = ids.map(parseCard).sort((a, b) => EDITION[b.edition].rarity - EDITION[a.edition].rarity)[0] ?? null;
    const editions = {};
    for (const { edition } of ids.map(parseCard)) editions[edition] = (editions[edition] ?? 0) + 1;
    onEvent({ type: 'collection', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, unique: ids.length, total: CARD_TOTAL, best, editions, setDone: Boolean(v.setDone) });
  }

  // "ghép thẻ": three copies of a plain card become one Tinh Tú card of the same sign (own sign first).
  function combine(u, v) {
    const own = cardId(v.sign, 'base');
    const id = (v.cards?.[own] ?? 0) >= cfg.combineCount ? own : Object.keys(v.cards ?? {}).find(k => k.endsWith(':base') && v.cards[k] >= cfg.combineCount);
    if (!id) {
      if (now() - (v.combineAt ?? 0) >= cfg.showCooldownSeconds * 1000) { v.combineAt = now(); onEvent({ type: 'combine-need', userId: u.userId, nickname: v.nickname, sign: v.sign, need: cfg.combineCount }); }
      return false;
    }
    v.cards[id] -= cfg.combineCount;
    if (!v.cards[id]) delete v.cards[id];
    const { sign } = parseCard(id);
    onEvent({ type: 'combine', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, from: sign, count: cfg.combineCount });
    give(u, v, cardId(sign, 'star'), 'combine');
    return true;
  }

  // Returns true when the countdown shown on screen moved (so the caller can resend it).
  let lastShown = null;
  function tick(activeSince) {
    const t = now();
    if (st.chest.openUntil && t >= st.chest.openUntil) close();
    if (t >= scheduled) {
      if (!isOpen() && t - activeSince < cfg.chestIdleMinutes * 60000) open();
      scheduled = nextChestAt();
    }
    const left = isOpen() ? st.chest.openUntil - t : scheduled - t;
    const shown = `${isOpen()}|${Math.ceil(left / 1000)}`;
    if (shown === lastShown) return false;
    lastShown = shown;
    return true;
  }

  function view() {
    const t = now(), c = st.chest;
    return isOpen()
      ? { open: true, no: c.no, remainingMs: c.openUntil - t, claims: Object.keys(c.claimed).length, recent: c.recent }
      : { open: false, inMs: Number.isFinite(scheduled) ? scheduled - t : null };
  }

  return { claim, show, give, draw, combine, tick, view, openNow: () => { if (!isOpen()) open(); }, isOpen };
}
