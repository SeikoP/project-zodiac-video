// Bridges TikTok LIVE events into the game. Uses the unofficial tiktok-live-connector,
// which reads the public room stream by username (no TikTok login needed).
//
// The connector hands over TikTok's own protobuf field names (comment text is `content`, a like burst is
// `count`, the user's handle is `displayId`), while its README shows older flattened names (`comment`,
// `likeCount`, `uniqueId`). Every parser here accepts both, so a library update that renames things does
// not silently turn the show off.
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const img = m => m?.urlList?.[0] ?? m?.url_list?.[0] ?? '';
const num = (...vals) => { for (const v of vals) { const n = Number(v); if (Number.isFinite(n) && n > 0) return n; } return 0; };

// Fan club membership of this room (user.fansClub.data: club name + level) and the viewer's ties to the host
// (chat messages carry userIdentity: subscriber / moderator). Only what is there is returned.
export function fanOf(data) {
  const club = data?.user?.fansClub?.data ?? data?.user?.fansClub ?? {};
  const id = data?.userIdentity ?? {};
  const out = {};
  const level = Number(club.level) || 0;
  if (level) { out.fanLevel = level; out.fanClub = String(club.clubName ?? '').slice(0, 24); }
  if (id.isSubscriberOfAnchor) out.subscriber = true;
  if (id.isModeratorOfAnchor) out.moderator = true;
  return out;
}

export function userOf(data) {
  const u = data?.user ?? {};
  return {
    userId: String(u.id || u.userId || u.uniqueId || u.displayId || 'unknown'),
    nickname: u.nickname || u.displayId || u.uniqueId || '',
    avatar: img(u.avatarThumb) || img(u.avatarMedium) || img(u.profilePicture) || u.profilePictureUrl || '',
    ...fanOf(data),
  };
}

export const chatOf = d => ({ ...userOf(d), comment: String(d?.content ?? d?.comment ?? '') });
export const likeOf = d => ({ ...userOf(d), count: num(d?.count, d?.likeCount) });
export const socialOf = (d, kind) => ({ ...userOf(d), kind });
// TikTok's own id for a message (common.msgId); the connector can hand the same message over again after a reconnect.
// ("0" is the protobuf default for a message that carries none)
export const msgIdOf = d => { const id = String(d?.common?.msgId ?? d?.msgId ?? ''); return id === '' || id === '0' ? null : id; };

export const viewersOf = d => num(d?.viewerCount, d?.totalUser, d?.total);

// Returns null while a streakable gift is still repeating; the final event carries the count.
export function giftOf(data) {
  const g = data?.gift ?? {};
  const d = data?.giftDetails ?? {};
  const type = g.type ?? d.giftType ?? data?.giftType;
  if (type === 1 && !data?.repeatEnd) return null;
  return {
    ...userOf(data),
    diamonds: num(g.diamondCount, d.diamondCount, data?.extendedGiftInfo?.diamond_count),
    count: num(data?.repeatCount, data?.comboCount, 1),
    giftName: g.name || d.giftName || data?.extendedGiftInfo?.name || `#${data?.giftId ?? ''}`,
    giftImage: img(g.image) || img(d.giftImage) || '',
  };
}

// game: anything with chat/gift/like/social (the game itself, or a recorder wrapping it).
// connect(username, options) can be replaced in tests. probe(type, data) sees every raw event (key names only matter).
export function createTikTokBridge({ game, log = console.log, onStatus = () => {}, connect = (u, o) => new TikTokLiveConnection(u, o), probe = () => {} }) {
  let conn = null;
  let wanted = null; // username we should stay connected to
  let retry = null;
  let delay = 5000;
  const status = { username: null, state: 'off', detail: '', viewers: 0 };
  const set = patch => { Object.assign(status, patch); onStatus({ ...status }); };

  // One guard for every handler: a malformed event is logged and skipped, never allowed to crash the show.
  // Joins arrive in bursts and only drive a greeting card: let a few through per second, drop the rest.
  let joinSec = 0, joinN = 0;
  const joinAllowed = () => { const s = Math.floor(Date.now() / 1000); if (s !== joinSec) { joinSec = s; joinN = 0; } return ++joinN <= 5; };

  // Messages already handed to the game: two rotating sets keep the last 5000–10000 ids, across reconnects to the same room.
  let seenNow = new Set(), seenBefore = new Set(), seenRoom = null;
  const seen = d => {
    const id = msgIdOf(d);
    if (id === null) return false;
    if (seenNow.has(id) || seenBefore.has(id)) return true;
    seenNow.add(id);
    if (seenNow.size > 5000) { seenBefore = seenNow; seenNow = new Set(); }
    return false;
  };

  const handle = (type, fn) => d => {
    try { probe(type, d); fn(d); } catch (e) { log(`[tiktok] bad ${type} event ignored: ${e?.message ?? e}`); }
  };

  async function open() {
    clearTimeout(retry);
    if (!wanted) return;
    const c = (conn = connect(wanted, {
      enableExtendedGiftInfo: false,
      ...(process.env.EULERSTREAM_API_KEY ? { signApiKey: process.env.EULERSTREAM_API_KEY } : {}),
    }));
    c.on(WebcastEvent.CHAT, handle('chat', d => { if (!seen(d)) game.chat(chatOf(d)); }));
    c.on(WebcastEvent.MEMBER, handle('member', d => { if (!seen(d) && joinAllowed()) game.member(userOf(d)); }));
    c.on(WebcastEvent.GIFT, handle('gift', d => { const g = giftOf(d); if (g && !seen(d)) game.gift(g); }));
    c.on(WebcastEvent.LIKE, handle('like', d => { if (!seen(d)) game.like(likeOf(d)); }));
    c.on(WebcastEvent.FOLLOW, handle('follow', d => { if (!seen(d)) game.social(socialOf(d, 'follow')); }));
    c.on(WebcastEvent.SHARE, handle('share', d => { if (!seen(d)) game.social(socialOf(d, 'share')); }));
    c.on(WebcastEvent.ROOM_USER, handle('roomUser', d => set({ viewers: viewersOf(d) })));
    c.on(WebcastEvent.STREAM_END, () => { set({ state: 'ended', detail: 'Live đã kết thúc' }); wanted = null; });
    c.on(ControlEvent.DISCONNECTED, () => { if (c === conn && wanted) schedule('Mất kết nối'); });
    c.on(ControlEvent.ERROR, e => log('[tiktok] error', e?.message ?? e));
    set({ username: wanted, state: 'connecting', detail: '' });
    try {
      const st = await c.connect();
      delay = 5000;
      set({ state: 'live', detail: `room ${st.roomId}` });
      log(`[tiktok] connected to @${wanted} room ${st.roomId}`);
    } catch (e) {
      if (c === conn) schedule(e?.message ?? String(e));
    }
  }

  function schedule(reason) {
    if (!wanted) return;
    set({ state: 'retrying', detail: `${reason} — thử lại sau ${Math.round(delay / 1000)}s` });
    log(`[tiktok] ${reason}; retry in ${delay}ms`);
    retry = setTimeout(open, delay);
    delay = Math.min(delay * 2, 60000);
  }

  return {
    status: () => ({ ...status }),
    async connect(username) {
      const room = String(username).replace(/^@/, '').trim();
      if (room !== seenRoom) { seenNow = new Set(); seenBefore = new Set(); seenRoom = room; }
      await this.disconnect();
      wanted = room;
      delay = 5000;
      await open();
    },
    async disconnect() {
      wanted = null;
      clearTimeout(retry);
      const c = conn;
      conn = null;
      if (c) try { await c.disconnect(); } catch {}
      set({ state: 'off', detail: '', username: null, viewers: 0 });
    },
  };
}
