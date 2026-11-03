// Bàn quẻ: "xin quẻ" queues a free daily reading for the viewer; "xin quẻ tình duyên / công việc / tiền bạc" asks about
// one thing and the reading adds two lines on it. While a viewer's reading is on screen the room joins in:
//   "chuẩn" / "linh" / "đúng"  the reading rings true — its owner gets a little bụi sao for each one (once per person)
//   "xin vía" / "hút vía"       on a Thượng Cát / Đại Cát reading, borrow some of its luck — bụi sao for both
// When the room is quiet the host can show a "quẻ chung" for a sign (no owner: nothing to agree with).
import { drawFortune } from './fortunes.mjs';

// accent-free lower case, the same as game.mjs's norm (not imported: game.mjs imports this module)
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');

export const ALTAR_DEFAULTS = Object.freeze({
  fortuneSeconds: 10, // long enough for the room to answer "chuẩn" / "xin vía"
  fortuneCooldownMinutes: 10,
  fortuneLight: 3,
  fortuneQueueMax: 12,
  fortuneTrueDust: 1, // to the reading's owner, per "chuẩn"
  fortuneTrueMax: 10, // most "chuẩn" that pay the owner
  fortuneLuckDust: 2, // to whoever says "xin vía", and 1 to the owner
});

const TOPICS = [['love', /\b(tinh duyen|tinh yeu|tinh cam|nguoi yeu|crush)\b/], ['work', /\b(cong viec|su nghiep|hoc hanh|hoc tap|thi cu|thi)\b/], ['money', /\b(tien bac|tai loc|tien|tai chinh)\b/]];
export const parseFortuneTopic = comment => { const t = norm(comment); return TOPICS.find(([, re]) => re.test(t))?.[0] ?? null; };
const AGREE_RE = /^\s*(chuan|linh|dung)\b/;
const LUCK_RE = /^\s*(xin via|hut via|xin loc)\b/;
const LUCKY_LEVELS = new Set(['Thượng Cát', 'Đại Cát']);

// signs: SIGN by id ({ element }); pickSign(): a sign for a "quẻ chung"; shine(u, v, n, why); dust(u, v, n, why)
export function createAltar({ st, cfg, now, onEvent, touch, signs, pickSign, shine, dust }) {
  st.fortuneQueue ??= [];

  function request(u, v, comment) {
    if (!v.sign) return onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'fortune' });
    if (now() - (v.fortuneAt ?? 0) < cfg.fortuneCooldownMinutes * 60000) return;
    if (st.fortuneQueue.some(f => f.userId === u.userId) || st.fortuneQueue.length >= cfg.fortuneQueueMax) return;
    v.fortuneAt = now();
    st.fortuneQueue.push({ userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, topic: parseFortuneTopic(comment) });
    touch('hud');
    shine(u, v, cfg.fortuneLight, 'fortune');
  }

  // Shows a reading: a viewer's (req.userId) or a "quẻ chung" for a sign (userId null).
  function show(req) {
    const sign = signs[req.sign] ? req.sign : pickSign();
    st.fortune = { ...req, sign, ...drawFortune({ seed: req.userId ?? 'room', sign, element: signs[sign].element, now: now(), topic: req.topic ?? null }), agree: {}, luck: {}, endsAt: now() + cfg.fortuneSeconds * 1000 };
    touch('hud');
    onEvent({ type: 'fortune', userId: req.userId ?? null, sign, topic: req.topic ?? null });
  }

  // The room's answer to the reading on screen. Returns true when the comment was one.
  function chat(u, v, comment) {
    const f = st.fortune;
    if (!f?.userId || u.userId === f.userId || now() >= f.endsAt) return false;
    const t = norm(comment), owner = st.viewers[f.userId];
    if (AGREE_RE.test(t)) {
      if (f.agree[u.userId]) return true;
      f.agree[u.userId] = v.nickname;
      const count = Object.keys(f.agree).length;
      if (owner && count <= cfg.fortuneTrueMax) dust({ userId: f.userId }, owner, cfg.fortuneTrueDust, 'fortune');
      touch('hud');
      onEvent({ type: 'fortune-agree', userId: u.userId, nickname: v.nickname, owner: f.nickname, count });
      return true;
    }
    if (LUCK_RE.test(t) && LUCKY_LEVELS.has(f.level)) {
      if (f.luck[u.userId]) return true;
      f.luck[u.userId] = v.nickname;
      dust(u, v, cfg.fortuneLuckDust, 'fortune');
      if (owner) dust({ userId: f.userId }, owner, 1, 'fortune');
      touch('hud');
      onEvent({ type: 'fortune-luck', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, owner: f.nickname, level: f.level, count: Object.keys(f.luck).length });
      return true;
    }
    return false;
  }

  // free: nothing else holds the screen. Returns true when a reading started.
  function tick(t, free) {
    if (st.fortune && t >= st.fortune.endsAt) { st.fortune = null; touch('hud'); }
    if (!st.fortune && free && st.fortuneQueue.length) { show(st.fortuneQueue.shift()); return true; }
    return false;
  }

  const view = t => st.fortune && (({ agree, luck, ...f }) => ({ ...f, agree: Object.keys(agree ?? {}).length, luck: Object.keys(luck ?? {}).length, lucky: LUCKY_LEVELS.has(f.level), remainingMs: Math.max(0, f.endsAt - t) }))(st.fortune);
  return { request, show, chat, tick, view };
}
