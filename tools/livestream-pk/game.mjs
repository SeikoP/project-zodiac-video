// Đêm Hội Hoàng Đạo — a zodiac festival for TikTok LIVE where all 12 signs share one sky and race
// gently for the brightest wheel. Pure logic, no I/O.
//
// The whole room shares one sky:
//   • Viewers comment a sign name (or 1-12), or their birthday as day/month, and join that sign.
//   • Everything they do sheds "ánh sao" (starlight) into their sign's constellation.
//   • A constellation that is already lit passes the extra light on to the dimmest one still dark
//     ("ánh sao lan toả"), so every sign helps the others.
//   • When all 12 are lit, the zodiac wheel completes: a celebration, then a new, slightly bigger wheel.
//   • Likes and activity raise one shared moon; a full moon throws a party.
// The race ("Đua sao") is always on, no rounds to start: every bit of light a viewer sheds also counts
// for their sign's share of the current wheel. All 12 signs are ranked live; when the wheel completes the
// brightest sign is crowned (season crowns + a badge for the fans who helped). To keep it fair and
// worth coming back for: a "lucky star" rotates through the lower half of the race for a short x2 window,
// returning viewers get a streak bonus, and everything is a team score, never a ranking of people.
// Comment keywords (from the "chùa online" / "sàn nhạc" trends, in an astrology frame):
//   "xin quẻ" → a free daily zodiac reading on the altar · "ước …" → a wish lantern · "nhảy" → dance.
// Gifts trigger on-stage effects by size and are thanked by name, never ranked.
//
// Built for busy rooms: every handler is O(1) in the number of viewers; the stage keeps only the
// most recently active viewers; snapshot parts carry version numbers so callers send only what changed.
import { CONSTELLATIONS } from './public/constellations.js';
import { drawFortune, dayKey } from './fortunes.mjs';
import { cleanName, safeAvatar } from './names.mjs';
import { occasionOn } from './public/occasions.js';
import { readSky as readRealSky, boonFor } from './sky.mjs';
import { createBoss, BOSS_DEFAULTS } from './boss.mjs';
import { createCards, CARD_DEFAULTS } from './cards.mjs';
import { createBag, BAG_DEFAULTS } from './bag.mjs';

export const SIGNS = Object.freeze([
  { id: 'aries', label: 'Bạch Dương', glyph: '♈', element: 'fire' },
  { id: 'taurus', label: 'Kim Ngưu', glyph: '♉', element: 'earth' },
  { id: 'gemini', label: 'Song Tử', glyph: '♊', element: 'air' },
  { id: 'cancer', label: 'Cự Giải', glyph: '♋', element: 'water' },
  { id: 'leo', label: 'Sư Tử', glyph: '♌', element: 'fire' },
  { id: 'virgo', label: 'Xử Nữ', glyph: '♍', element: 'earth' },
  { id: 'libra', label: 'Thiên Bình', glyph: '♎', element: 'air' },
  { id: 'scorpio', label: 'Bọ Cạp', glyph: '♏', element: 'water' },
  { id: 'sagittarius', label: 'Nhân Mã', glyph: '♐', element: 'fire' },
  { id: 'capricorn', label: 'Ma Kết', glyph: '♑', element: 'earth' },
  { id: 'aquarius', label: 'Bảo Bình', glyph: '♒', element: 'air' },
  { id: 'pisces', label: 'Song Ngư', glyph: '♓', element: 'water' },
]);
const SIGN = Object.fromEntries(SIGNS.map(s => [s.id, s]));
const OPPOSITE = Object.fromEntries(SIGNS.map((s, i) => [s.id, SIGNS[(i + 6) % 12].id]));
const ORDER = Object.fromEntries(SIGNS.map((s, i) => [s.id, i]));
// Visitor counts that get a small celebration.
const MILESTONES = [1, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000];
const zeros = () => Object.fromEntries(SIGNS.map(s => [s.id, 0]));

export const DEFAULT_CONFIG = Object.freeze({
  // starlight per action
  commentLight: 2,
  commentCooldownSeconds: 5,
  likesPerLight: 5,
  followLight: 20,
  shareLight: 20,
  lightPerDiamond: 5,
  fortuneLight: 3,
  quizRewards: [40, 25, 15],
  // the shared sky
  constellationCost: 240, // light to light one constellation on the first wheel
  wheelGrowth: 0.5, // each new wheel costs this much more (0.5 → ×1.5, ×2, …)
  // moon (room-wide goal)
  moonGoal: 600,
  moonGrowth: 1.5,
  partySeconds: 40,
  partyMultiplier: 2,
  // gifts → effects (diamonds of one send = coin value × count)
  fireworkDiamonds: 10,
  // the room's shared gift goal: when everybody's gifts this night add up to it, a meteor shower; the next goal is bigger
  giftGoal: 30,
  giftGoalGrowth: 1.4,
  meteorDiamonds: 100,
  // retention: streak check-in, wheel crown, lucky star
  checkinPerNight: 5, // light per night of streak (first action of the night)
  checkinMax: 40,
  crownLifetime: 50, // lifetime light for each fan who helped the crowned sign
  luckyEverySeconds: 100,
  luckySeconds: 20,
  luckyMultiplier: 2,
  overtakeCooldownSeconds: 8,
  // keywords
  fortuneSeconds: 6,
  fortuneCooldownMinutes: 10,
  wishCooldownSeconds: 60,
  showWishText: true,
  // matched as whole words, with accents (so 'lớn', 'các', 'đeo' stay allowed)
  blockedWords: ['đm', 'dm', 'đmm', 'dmm', 'đcm', 'dcm', 'vcl', 'vl', 'clm', 'lồn', 'cặc', 'địt', 'đéo', 'đụ', 'fuck', 'shit'],
  // stage
  presenceMinutes: 10,
  crowdMax: 40,
  thanksMax: 5,
  // quiet room
  quizSeconds: 12,
  recordEvents: false, // keep logs/events-<date>.jsonl of everything TikTok sent (for npm run replay)
  pollSeconds: 20,
  pollLight: 3,
  // a small room gets smaller goals: wheel and moon scale with the viewers on stage (floor .2, full at 12)
  adaptiveCrowd: true,
  crowdFloor: 0.2,
  crowdFull: 12,
  autoQuiz: true,
  quietSeconds: 45,
  // the real sky: planets standing in a sign boost its fans' starlight; a real full moon fills the game's moon twice as fast
  skyBoons: true,
  // Thủy Nghịch: for a while every sign's starlight lands on its opposite sign, until enough viewers comment "thuận".
  // It comes often while Mercury is really retrograde, rarely otherwise. 0 = only when the host calls it.
  chaosEverySeconds: 1500,
  chaosEveryRetroSeconds: 480,
  chaosSeconds: 40,
  chaosFixMin: 3,
  chaosFixShare: 0.5, // of the viewers on stage, capped at 12
  chaosFixLight: 5,
  ...BOSS_DEFAULTS,
  ...CARD_DEFAULTS,
  ...BAG_DEFAULTS,
  // a wish the room blesses: "chúc" within the window; enough blessings and the wish becomes a star
  blessWindowSeconds: 45,
  blessNeed: 3,
  blessDust: 3,
  switchCooldownSeconds: 30, // "đổi <cung>": at most this often, so the lucky star can't be chased sign to sign
  // fan club members / subscribers of the room: a little extra starlight, a greeting, and "gọi sao" once a night
  fanBonus: 0.1,
  fanBonusPerLevel: 0.01,
  fanBonusMax: 0.3,
  subscriberBonus: 0.1,
  // Nhiệt phòng: what the whole room did in the last 20 seconds; hotter rooms shed more starlight
  heatLevels: [12, 30, 60, 110],
  heatMultipliers: [1, 1.1, 1.25, 1.5, 2],
  // quiet room: some of the turns are the house mascots showing a command (clearly labelled as mascots)
  demoTurns: true,
  // which minor announcements the overlay shows; the big ones (gifts, follows, lit signs, readings, quizzes) are always on
  show: { join: true, dance: false, flow: false, title: false, streak: false, wish: true, overtake: true, milestone: true, hearts: true },
});

const TITLES = [[15000, 'Thiên Hà'], [3000, 'Chòm Sao'], [500, 'Sao Sáng'], [0, 'Tân Tinh']];
export const titleOf = points => TITLES.find(([min]) => points >= min)[1];

export const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');
const squash = s => norm(s).replace(/[^a-z0-9]/g, '');
// Other common Vietnamese names for a sign.
const EXTRA_ALIASES = { thienyet: 'scorpio', hocap: 'scorpio', thannong: 'scorpio', trinhnu: 'virgo', sonduong: 'capricorn' };
const ALIASES = [
  ...SIGNS.flatMap(s => [[squash(s.label), s.id], [squash(s.id), s.id]]),
  ...Object.entries(EXTRA_ALIASES),
].sort((a, b) => b[0].length - a[0].length);

// Comment "12/8", "12-8", "12 tháng 8" (day/month) → the sign that date falls in.
const SIGN_START = [[1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'], [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'], [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn']];
export function signOfDate(day, month) {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  const [, start, id] = SIGN_START[month - 1];
  return day >= start ? id : month === 1 ? 'capricorn' : SIGN_START[month - 2][2];
}
function parseBirthday(raw) {
  const m = norm(raw).match(/(\d{1,2})\s*(?:[/.-]|thang)\s*(\d{1,2})/);
  if (!m) return null;
  let day = Number(m[1]), month = Number(m[2]);
  if (month > 12 && day <= 12) [day, month] = [month, day]; // tolerate m/d
  return signOfDate(day, month);
}

// Returns the sign a comment names, or null. A bare number 1-12 (optionally "#3", "số 3")
// picks by order; a sign name anywhere in the comment wins; otherwise a day/month birthday.
export function parseSign(comment) {
  const raw = String(comment ?? '').trim();
  const num = raw.match(/^(?:#|so\s*|số\s*)?(\d{1,2})$/i);
  if (num) return SIGNS[Number(num[1]) - 1]?.id ?? null;
  const text = squash(raw);
  if (!text) return null;
  let best = null;
  for (const [alias, id] of ALIASES) {
    const at = text.indexOf(alias);
    if (at >= 0 && (!best || at < best.at)) best = { at, id };
  }
  return best?.id ?? parseBirthday(raw);
}

// A viewer who already has a sign keeps it unless they clearly ask for another: "đổi Sư Tử", "đổi sang 7",
// "chuyển qua cung Bảo Bình", or a comment that is nothing but a sign's name. "Sư Tử đỉnh quá" from a Kim Ngưu
// fan is cheering, not switching.
export function parseSwitch(comment) {
  const t = norm(comment).trim();
  const m = t.match(/^(doi|chuyen)\s+(?:sang\s+|qua\s+|ve\s+|thanh\s+)?(?:cung\s+)?(.+)$/);
  if (m) return parseSign(m[2]);
  const whole = squash(comment);
  return whole ? ALIASES.find(([alias]) => alias === whole)?.[1] ?? null : null;
}

// Keyword actions, matched on accent-free words.
const FORTUNE_RE = /\b(xin que|gieo que|rut que|boc que|xin xam|gieo xam)\b/;
const DANCE_RE = /\b(nhay|quay|dance)\b/;
const WISH_RE = /^\s*(uoc|mong|nguyen|cau (nguyen|mong|cho|chuc))\b/;
const CLAIM_RE = /^\s*(nhan|nhan the|nhan ruong|mo ruong)[\s!.]*$/;
const FIX_RE = /\b(thuan hanh|sua song)\b|^\s*thuan\b/;
const CARDS_RE = /\b(khoe the|bo the|xem the)\b/;
const UPGRADE_RE = /\b(nang cap|len cap|len lv|up lv)\b/;
const COMBINE_RE = /\bghep the\b/;
const BAG_RE = /^\s*(kho|tui|tui do|xem kho|kho do)[\s!.]*$/;
const BLESS_RE = /^\s*(chuc|chuc phuc|thanh hien thuc|thanh su|amen|\+1)\b/;
// what the house mascots demonstrate in a quiet room, in turn
export const DEMOS = ['join', 'wish', 'fortune', 'upgrade', 'bless', 'chest', 'switch'];
const CALL_RE = /^\s*(goi sao|goi sao may man)[\s!.]*$/;
export function parseAction(comment) {
  const t = norm(comment);
  if (WISH_RE.test(t)) return 'wish';
  if (CLAIM_RE.test(t)) return 'claim';
  if (FIX_RE.test(t)) return 'fix';
  if (CARDS_RE.test(t)) return 'cards';
  if (UPGRADE_RE.test(t)) return 'upgrade';
  if (COMBINE_RE.test(t)) return 'combine';
  if (BAG_RE.test(t)) return 'bag';
  if (BLESS_RE.test(t)) return 'bless';
  if (CALL_RE.test(t)) return 'call';
  if (FORTUNE_RE.test(t)) return 'fortune';
  if (DANCE_RE.test(t)) return 'dance';
  return null;
}

// Wish text shown on stream: no links/numbers-as-contacts, and blocked words hide the text.
export function cleanWish(comment, blockedWords) {
  const text = String(comment ?? '').replace(/https?:\/\/\S+|\S+\.(com|vn|net)\S*/gi, '').replace(/\d{6,}/g, '').trim().slice(0, 70);
  const words = new Set(text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u));
  return blockedWords.some(w => words.has(w)) ? null : text;
}

const freshGifts = () => ({ count: 0, diamonds: 0, top: null, by: {}, recent: [], goalSum: 0, goalNo: 0 });

export function emptyState() {
  return {
    night: { no: 1, startedAt: null, visitors: 0 },
    viewers: {}, // userId -> { nickname, avatar, sign, lifetime, lastSeenAt, lastCommentAt, likeCarry, bonusNight, fortuneAt, wishAt, night }
    pending: {}, // userId -> light waiting for a sign
    wheel: { no: 1, light: zeros(), given: zeros() }, // given: light each sign's fans poured in (the race)
    season: { light: zeros(), crowns: zeros() },
    lucky: null, // { sign, endsAt }
    nextLuckyAt: 0,
    moon: { light: 0, goal: 0, full: 0, partyUntil: 0 },
    thanks: [], // recent supporters, newest first: { userId, nickname, avatar, sign }
    gifts: freshGifts(), // this night's gifts: totals, top gifter, the last few, progress to the shared goal
    fortune: null,
    fortuneQueue: [],
    quiz: null,
    quizCursor: 0,
    quietTurn: 0,
    poll: null,
    pollCursor: 0,
    quietUntil: 0,
    lastActivityAt: 0,
    chaos: null, // Thủy Nghịch: { endsAt, need, fixers: { userId: nickname }, real }
    nextChaosAt: 0,
    boss: null, // see boss.mjs
    nextBossAt: 0,
    chest: { no: 0, openUntil: 0, claimed: {}, recent: [] },
    wishes: [], // the last few wishes, newest first: { id, userId, nickname, avatar, sign, text, at, blessers: { userId: nickname }, blessed }
    wishNo: 0,
  };
}

// readSky(t) gives the real sky (sky.mjs); tests pass their own, or null for none.
export function createGame({ config = {}, state = emptyState(), quiz = [], polls = [], now = () => Date.now(), rng = Math.random, onEvent = () => {}, readSky = readRealSky } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config, show: { ...DEFAULT_CONFIG.show, ...config.show } };
  const st = state;
  st.night.startedAt ??= now();
  st.lastActivityAt ||= now();
  st.wheel.given ??= zeros();
  st.season ??= { light: zeros(), crowns: zeros() };
  st.lucky ??= null;
  st.gifts ??= freshGifts();
  st.wishes ??= [];
  st.wishNo ??= 0;
  st.nextLuckyAt ||= now() + cfg.luckyEverySeconds * 1000;
  const partying = () => now() < st.moon.partyUntil;

  // Version counters let the server send a part only when it changed.
  const ver = { hud: 1, race: 1, sky: 1, stage: 1, thanks: 1, lobby: 1, gifts: 1, cosmos: 1 };
  const touch = (...parts) => { for (const p of parts) ver[p]++; };

  // The stage: most recently active viewers with a sign, oldest first (Map keeps insertion order).
  const stage = new Map();
  // Moving to the back is O(1); only arrivals and departures count as a change for the overlay.
  function onStage(userId, changed = false) {
    if (!stage.delete(userId)) changed = true;
    stage.set(userId, true);
    if (stage.size > cfg.crowdMax) stage.delete(stage.keys().next().value);
    if (changed) touch('stage');
  }

  // The lobby: viewers who showed up (comment, like, gift…) but have not picked a sign yet, first come first served.
  // The overlay shows it as the waiting-queue layout while nobody is on stage; picking a sign moves a viewer to the stage.
  const LOBBY_MAX = 60;
  const lobby = new Map();
  function inLobby(userId) {
    if (lobby.has(userId)) return;
    lobby.set(userId, true);
    if (lobby.size > LOBBY_MAX) lobby.delete(lobby.keys().next().value);
    touch('lobby');
  }
  function outOfLobby(userId) { if (lobby.delete(userId)) touch('lobby'); }

  // Small rooms get smaller goals so a single viewer still sees progress.
  const crowdFactor = () => (cfg.adaptiveCrowd ? Math.min(1, Math.max(cfg.crowdFloor, stage.size / cfg.crowdFull)) : 1);
  const wheelCost = no => Math.round(cfg.constellationCost * (1 + cfg.wheelGrowth * (no - 1)) * crowdFactor());
  const moonGoalFor = full => Math.max(cfg.adaptiveCrowd ? 60 : 1, Math.round(cfg.moonGoal * Math.pow(cfg.moonGrowth, full) * crowdFactor()));
  st.wheel.cost ||= wheelCost(st.wheel.no);
  st.moon.goal ||= moonGoalFor(0);

  function viewer(u) {
    const name = cleanName(u.nickname || u.userId, cfg.blockedWords);
    const v = (st.viewers[u.userId] ??= { nickname: name, avatar: '', sign: null, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 });
    if (u.nickname) v.nickname = name;
    const avatar = safeAvatar(u.avatar);
    if (avatar) v.avatar = avatar;
    // fan club level / subscriber come with chat and gift events; a like without them doesn't clear them
    if (u.fanLevel) { v.fanLevel = u.fanLevel; v.fanClub = cleanName(u.fanClub || '', cfg.blockedWords); }
    if (u.subscriber) v.subscriber = true;
    if ((v.fanLevel || v.subscriber) && v.fanNight !== st.night.no) {
      v.fanNight = st.night.no;
      onEvent({ type: 'fan-arrive', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, level: v.fanLevel ?? 0, club: v.fanClub ?? '', subscriber: Boolean(v.subscriber) });
      touch('cosmos');
    }
    if (v.night !== st.night.no) {
      v.streak = v.lastNight === st.night.no - 1 ? (v.streak ?? 0) + 1 : 1; // consecutive nights
      v.lastNight = st.night.no;
      v.checkin = Math.min(cfg.checkinMax, cfg.checkinPerNight * v.streak);
      v.night = st.night.no;
      st.night.visitors++;
      if (MILESTONES.includes(st.night.visitors)) onEvent({ type: 'milestone', count: st.night.visitors, nickname: v.nickname });
      touch('hud');
    }
    v.lastSeenAt = now();
    st.lastActivityAt = now();
    if (v.sign) onStage(u.userId); else inLobby(u.userId);
    return v;
  }

  function thank(u, v) {
    const i = st.thanks.findIndex(t => t.userId === u.userId);
    if (i >= 0) st.thanks.splice(i, 1);
    st.thanks.unshift({ userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign });
    st.thanks.length = Math.min(st.thanks.length, cfg.thanksMax);
    touch('thanks');
  }

  function raiseMoon(amount) {
    if (partying() || amount <= 0) return;
    st.moon.light += cfg.skyBoons && sky?.moon.full ? amount * 2 : amount;
    touch('hud');
    if (st.moon.light < st.moon.goal) return;
    st.moon.full++;
    st.moon.light = 0;
    st.moon.goal = moonGoalFor(st.moon.full);
    st.moon.partyUntil = now() + cfg.partySeconds * 1000;
    onEvent({ type: 'moon-full', count: st.moon.full, seconds: cfg.partySeconds, multiplier: cfg.partyMultiplier });
    for (const id of stage.keys()) if (st.viewers[id]) bag.add({ userId: id }, st.viewers[id], 'moon', 1, 'moon'); // everyone there gets a moon shard
  }

  // --- the real sky, Thủy Nghịch, the boss and the star chest ---------------------------------------------
  // The sky is recomputed once a minute; a failure just leaves the last one (or none) in place.
  let sky = null, skyAt = 0;
  function refreshSky() {
    skyAt = now();
    if (!readSky) return;
    try { sky = readSky(now()); touch('cosmos'); } catch (e) { console.error('[sky]', e?.message ?? e); }
  }
  refreshSky();

  const scheduleChaos = () => {
    const every = sky?.mercuryRetro ? cfg.chaosEveryRetroSeconds : cfg.chaosEverySeconds;
    st.nextChaosAt = every ? now() + every * 1000 * (0.8 + 0.4 * rng()) : Infinity;
  };
  if (!st.nextChaosAt) scheduleChaos();
  function startChaos() {
    if (st.chaos || st.boss) return null;
    // never more than the viewers actually there (a room of two can still fix it)
    const need = Math.max(1, Math.min(12, stage.size, Math.max(cfg.chaosFixMin, Math.ceil(stage.size * cfg.chaosFixShare))));
    st.chaos = { endsAt: now() + cfg.chaosSeconds * 1000, need, fixers: {}, real: Boolean(sky?.mercuryRetro) };
    touch('cosmos');
    onEvent({ type: 'chaos-start', seconds: cfg.chaosSeconds, need, real: st.chaos.real });
    return st.chaos;
  }
  function fixChaos(u, v) {
    const c = st.chaos;
    if (!c || c.fixers[u.userId]) return;
    c.fixers[u.userId] = v.nickname;
    touch('cosmos');
    if (Object.keys(c.fixers).length >= c.need) endChaos(true);
  }
  function endChaos(fixed) {
    const c = st.chaos;
    if (!c) return;
    st.chaos = null; // first, so the fixers' reward lands on their own sign
    scheduleChaos();
    touch('cosmos');
    const ids = Object.keys(c.fixers);
    if (fixed) for (const id of ids) if (st.viewers[id]) { shine({ userId: id }, st.viewers[id], cfg.chaosFixLight, 'chaos'); gem({ userId: id }, st.viewers[id], 1, 'chaos'); }
    onEvent({ type: fixed ? 'chaos-fixed' : 'chaos-end', fixers: ids.slice(0, 5).map(id => c.fixers[id]), count: ids.length });
  }

  const boss = createBoss({
    st, cfg, now, onEvent,
    elementOf: id => SIGN[id].element,
    signsOnStage: () => [...new Set([...stage.keys()].map(id => st.viewers[id]?.sign).filter(Boolean))],
    fansOf: sign => { let n = 0; for (const id of stage.keys()) if (st.viewers[id]?.sign === sign) n++; return n; },
    reward: (userId, mvp) => {
      const v = st.viewers[userId];
      if (!v?.sign) return;
      shine({ userId }, v, cfg.bossReward, 'boss');
      cards.give({ userId }, v, cards.draw(v, mvp ? 'boss' : undefined), 'boss');
      gem({ userId }, v, mvp ? 4 : 2, 'boss');
    },
  });
  st.nextBossAt ||= cfg.bossEverySeconds ? now() + cfg.bossEverySeconds * 500 : Infinity; // the first one comes half as soon
  let bossWas = Boolean(st.boss);
  function startBoss() {
    const b = st.chaos ? null : boss.start(Math.max(3, stage.size));
    if (b) bossWas = true;
    return b;
  }

  // Sky editions a chest can drop right now: Thủy Nghịch during the chaos or a real retrograde, Trăng Tròn on a real full moon.
  const cards = createCards({ st, cfg, now, rng, onEvent, signs: SIGNS.map(s => s.id), specials: () => [...(st.chaos || sky?.mercuryRetro ? ['retro'] : []), ...(sky?.moon.full ? ['fullmoon'] : [])] });
  const bag = createBag({ cfg, now, onEvent, elementOf: id => SIGN[id].element });
  // one gem of the viewer's own element (what their next level needs)
  const gem = (u, v, n, why) => { if (v?.sign) bag.add(u, v, SIGN[v.sign].element, n, why); };

  // --- wishes the room can bless --------------------------------------------------------------------
  function bless(u, v) {
    const t = now();
    const w = st.wishes.find(x => !x.blessed && x.userId !== u.userId && !x.blessers[u.userId] && t - x.at < cfg.blessWindowSeconds * 1000);
    if (!w) return;
    w.blessers[u.userId] = v.nickname;
    bag.add(u, v, 'dust', cfg.blessDust);
    touch('cosmos');
    const count = Object.keys(w.blessers).length;
    onEvent({ type: 'wish-bless', id: w.id, nickname: v.nickname, avatar: v.avatar, wisher: w.nickname, count, need: cfg.blessNeed });
    if (count < cfg.blessNeed) return;
    w.blessed = true;
    const owner = st.viewers[w.userId];
    if (owner) bag.add({ userId: w.userId }, owner, 'moon', 1, 'wish');
    onEvent({ type: 'wish-blessed', id: w.id, userId: w.userId, nickname: w.nickname, avatar: w.avatar, sign: w.sign, text: w.text, blessers: Object.values(w.blessers).slice(0, 5), count });
  }

  // --- the shared sky --------------------------------------------------------
  const cost = () => st.wheel.cost;
  const isLit = id => st.wheel.light[id] >= cost();
  function dimmest() {
    let best = null;
    for (const s of SIGNS) if (!isLit(s.id) && (!best || st.wheel.light[s.id] < st.wheel.light[best])) best = s.id;
    return best;
  }

  // Pours light into `sign`; once it is lit the rest flows to the dimmest constellation still dark.
  function pour(sign, amount) {
    let rest = amount;
    touch('sky');
    while (rest > 0) {
      const target = isLit(sign) ? dimmest() : sign;
      if (!target) break;
      const add = Math.min(rest, cost() - st.wheel.light[target]);
      st.wheel.light[target] += add;
      rest -= add;
      if (target !== sign) onEvent({ type: 'flow', from: sign, to: target, amount: add });
      if (isLit(target)) {
        onEvent({ type: 'lit', sign: target, by: sign });
        if (SIGNS.every(s => isLit(s.id))) completeWheel();
      }
    }
  }

  // --- the race: all 12 signs ranked by the light their fans poured into this wheel -------------
  const rank = () => SIGNS.map(x => ({ id: x.id, given: st.wheel.given[x.id] })).sort((a, b) => b.given - a.given || ORDER[a.id] - ORDER[b.id]);
  let leader = null, lastOvertake = 0;
  function checkOvertake(sign) {
    const g = st.wheel.given;
    leader ??= rank()[0].id;
    if (sign === leader || g[sign] <= g[leader]) return;
    const from = leader;
    leader = sign;
    if (g[from] > 0 && now() - lastOvertake > cfg.overtakeCooldownSeconds * 1000) {
      lastOvertake = now();
      onEvent({ type: 'overtake', sign, from });
    }
  }

  // The brightest sign of a finished wheel is crowned; the fans who helped it get a badge and a little lifetime light.
  function completeWheel() {
    const no = st.wheel.no, ranked = rank();
    const winner = ranked[0].given > 0 ? ranked[0].id : null;
    let crowned = 0;
    if (winner) {
      st.season.crowns[winner]++;
      for (const v of Object.values(st.viewers)) {
        if (v.wheelNo === no && v.sign === winner && v.wheelLight > 0) { v.crowns = (v.crowns ?? 0) + 1; v.lifetime += cfg.crownLifetime; crowned++; }
      }
    }
    onEvent({ type: 'wheel-complete', no, winner, podium: ranked.slice(0, 3), crowned });
    st.wheel = { no: no + 1, light: zeros(), given: zeros(), cost: wheelCost(no + 1) };
    leader = null;
    touch('race');
  }

  // Credits `base` light to the viewer's sign (doubled during the moon party).
  function shine(u, v, base, kind) {
    if (base <= 0) return 0;
    if (!v.sign) {
      if (kind === 'gift' || kind === 'follow' || kind === 'share' || kind === 'quiz') st.pending[u.userId] = (st.pending[u.userId] ?? 0) + base;
      return 0;
    }
    const boon = cfg.skyBoons ? boonFor(sky, v.sign, kind) : { mult: 1, by: [] };
    const amount = Math.round(base * (partying() ? cfg.partyMultiplier : 1) * (st.lucky?.sign === v.sign ? cfg.luckyMultiplier : 1) * boon.mult * bag.bonus(v) * heatMult() * fanMult(v));
    const before = v.lifetime;
    v.lifetime += amount;
    bag.fromLight(v, amount);
    if (v.wheelNo !== st.wheel.no) { v.wheelNo = st.wheel.no; v.wheelLight = 0; }
    v.wheelLight += amount;
    // during Thủy Nghịch the light goes astray: it lands on the opposite sign, in the race and in the sky
    const to = st.chaos ? OPPOSITE[v.sign] : v.sign;
    st.wheel.given[to] += amount; // counted before pour so it still lands in a wheel that completes right now
    st.season.light[to] += amount;
    touch('race');
    checkOvertake(to);
    pour(to, amount);
    if (to !== v.sign) onEvent({ type: 'swap', from: v.sign, to, amount });
    onEvent({ type: 'light', kind, userId: u.userId, sign: v.sign, amount, boon: boon.by.length ? boon.by : undefined });
    if (titleOf(before) !== titleOf(v.lifetime)) onEvent({ type: 'title-up', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, title: titleOf(v.lifetime) });
    return amount;
  }

  function join(u, v, sign) {
    if (v.sign === sign) return;
    const from = v.sign;
    v.sign = sign;
    if (from) v.switchAt = now(); // the first correction is free; only later switches wait for the cooldown
    outOfLobby(u.userId);
    onStage(u.userId, true);
    onEvent({ type: 'join', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign, from });
    const held = st.pending[u.userId];
    if (held) {
      delete st.pending[u.userId];
      shine(u, v, held, 'pending');
    }
  }

  // A clear "đổi <cung>" moves the viewer to another sign (light already given stays where it landed).
  function switchSign(u, v, to) {
    if (!to || to === v.sign) return;
    const wait = cfg.switchCooldownSeconds * 1000 - (now() - (v.switchAt ?? 0));
    if (wait > 0) return onEvent({ type: 'switch-wait', userId: u.userId, nickname: v.nickname, sign: v.sign, to, seconds: Math.ceil(wait / 1000) });
    join(u, v, to);
  }

  // "gọi sao": a fan club member or subscriber calls the lucky star onto their own sign, once a night.
  function fanCall(u, v) {
    if (!v.sign) return onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'call' });
    if (!v.fanLevel && !v.subscriber) {
      if (now() - (v.callHintAt ?? 0) > 60000) { v.callHintAt = now(); onEvent({ type: 'fan-only', userId: u.userId, nickname: v.nickname, sign: v.sign }); }
      return;
    }
    if (v.callNight === st.night.no || st.lucky) return;
    v.callNight = st.night.no;
    onEvent({ type: 'fan-call', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, level: v.fanLevel ?? 0, club: v.fanClub ?? '' });
    startLucky(v.sign);
  }

  // --- Nhiệt phòng: activity over the last 20 seconds, in 2-second buckets ---------------------------
  // Each viewer adds at most a little per bucket, so one spammer can't heat the room alone.
  const heat = { buckets: new Array(10).fill(0), per: new Map(), at: 0, level: 0 };
  function rollHeat() {
    const slot = Math.floor(now() / 2000);
    if (!heat.at) heat.at = slot;
    for (; heat.at < slot && heat.at > slot - 11; heat.at++) { heat.buckets.shift(); heat.buckets.push(0); heat.per.clear(); }
    heat.at = slot;
  }
  function addHeat(userId, n) {
    rollHeat();
    const had = heat.per.get(userId) ?? 0, add = Math.max(0, Math.min(n, 6 - had));
    if (!add) return;
    heat.per.set(userId, had + add);
    heat.buckets[9] += add;
  }
  const heatScore = () => heat.buckets.reduce((a, b) => a + b, 0);
  const heatLevelOf = score => cfg.heatLevels.filter(x => score >= x).length;
  const heatMult = () => cfg.heatMultipliers[heat.level] ?? 1;
  const fanMult = v => 1 + (v.fanLevel ? Math.min(cfg.fanBonusMax, cfg.fanBonus + cfg.fanBonusPerLevel * v.fanLevel) : 0) + (v.subscriber ? cfg.subscriberBonus : 0);

  function chat(u) {
    const v = viewer(u);
    if (st.quiz && answerQuiz(u, v)) return;
    const sign = parseSign(u.comment);
    // While a poll runs, naming a sign is a vote; it only joins a team for viewers who have none yet.
    if (st.poll && sign && !st.poll.voted[u.userId]) castVote(u, v, sign);
    addHeat(u.userId, 1);
    if (!v.sign) { if (sign) join(u, v, sign); }
    else if (!st.poll) switchSign(u, v, parseSwitch(u.comment));
    if (v.sign && v.checkin) {
      const bonus = v.checkin;
      v.checkin = 0;
      shine(u, v, bonus, 'checkin');
      if (v.streak >= 2) onEvent({ type: 'streak', userId: u.userId, nickname: v.nickname, sign: v.sign, streak: v.streak, amount: bonus });
    }
    const action = parseAction(u.comment);
    if (action === 'wish') wish(u, v);
    else if (action === 'fortune') requestFortune(u, v);
    else if (action === 'dance' && v.sign) onEvent({ type: 'dance', userId: u.userId, sign: v.sign });
    else if (action === 'claim') {
      const had = st.chest.claimed[u.userId];
      cards.claim(u, v);
      if (!had && st.chest.claimed[u.userId]) gem(u, v, 1, 'chest');
    }
    else if (action === 'upgrade') { if (v.sign) bag.upgrade(u, v); else onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'upgrade' }); }
    else if (action === 'combine' && v.sign) cards.combine(u, v);
    else if (action === 'bag') bag.show(u, v);
    else if (action === 'bless') bless(u, v);
    else if (action === 'call') fanCall(u, v);
    else if (action === 'cards') cards.show(u, v);
    else if (action === 'fix') fixChaos(u, v);
    boss.hit(u, v, 'comment');
    raiseMoon(1);
    if (v.sign && now() - v.lastCommentAt >= cfg.commentCooldownSeconds * 1000) {
      v.lastCommentAt = now();
      shine(u, v, cfg.commentLight, 'comment');
    }
  }

  function wish(u, v) {
    if (now() - v.wishAt < cfg.wishCooldownSeconds * 1000) return;
    v.wishAt = now();
    const text = cfg.showWishText ? cleanWish(u.comment, cfg.blockedWords) : null;
    // the lantern carries the wish without its "ước…" opening, so it reads like the wish itself
    const shown = text && text.replace(/^\s*(ước|mong|nguyện|cầu (nguyện|mong|cho|chúc))\s*(gì\s*)?(là\s*)?/iu, '').trim();
    const w = { id: ++st.wishNo, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, text: shown || text, at: now(), blessers: {}, blessed: false };
    st.wishes.unshift(w);
    st.wishes.length = Math.min(st.wishes.length, 6);
    touch('cosmos');
    onEvent({ type: 'wish', id: w.id, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, text: w.text, need: cfg.blessNeed, seconds: cfg.blessWindowSeconds });
  }

  function requestFortune(u, v) {
    if (!v.sign) return onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'fortune' });
    if (now() - v.fortuneAt < cfg.fortuneCooldownMinutes * 60000) return;
    if (st.fortuneQueue.some(f => f.userId === u.userId) || st.fortuneQueue.length >= 12) return;
    v.fortuneAt = now();
    st.fortuneQueue.push({ userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign });
    touch('hud');
    shine(u, v, cfg.fortuneLight, 'fortune');
  }

  // Reading for a viewer, or a "quẻ chung" for a sign when the room is quiet (userId null).
  function showFortune(req) {
    const s = SIGN[req.sign];
    st.fortune = { ...req, ...drawFortune({ seed: req.userId ?? 'room', sign: s.id, element: s.element, now: now() }), endsAt: now() + cfg.fortuneSeconds * 1000 };
    touch('hud');
    onEvent({ type: 'fortune', userId: req.userId, sign: req.sign });
  }

  // diamonds = coin value of ONE gift; count = final repeat count of the streak.
  // The night's gift board: totals, who gave most, the last few gifts and the room's shared goal.
  const giftGoal = () => Math.max(1, Math.round(cfg.giftGoal * Math.pow(cfg.giftGoalGrowth, st.gifts.goalNo)));
  function recordGift(u, v, count, diamonds) {
    const g = st.gifts;
    g.count += count;
    g.diamonds += diamonds;
    const by = (g.by[u.userId] ??= { nickname: v.nickname, diamonds: 0 });
    by.nickname = v.nickname;
    by.diamonds += diamonds;
    if (!g.top || by.diamonds >= g.top.diamonds) g.top = { nickname: v.nickname, diamonds: by.diamonds };
    g.recent.unshift({ userId: u.userId, nickname: v.nickname, avatar: v.avatar, giftName: u.giftName ?? '', giftImage: u.giftImage ?? '', count });
    g.recent.length = Math.min(g.recent.length, 4);
    g.goalSum += diamonds;
    // a big gift can fill several goals at once: one celebration, and the bar keeps only what is left over
    let reached = 0;
    while (g.goalSum >= giftGoal()) {
      reached = giftGoal();
      g.goalSum -= reached;
      g.goalNo++;
    }
    if (reached) onEvent({ type: 'gift-goal', no: g.goalNo, goal: reached, nickname: v.nickname, sign: v.sign });
    touch('gifts');
  }

  function gift(u) {
    const v = viewer(u);
    const count = Math.max(1, u.count | 0);
    const diamonds = Math.max(0, u.diamonds) * count;
    const tier = diamonds >= cfg.meteorDiamonds ? 'meteor' : diamonds >= cfg.fireworkDiamonds ? 'firework' : 'sparkle';
    onEvent({ type: 'gift', tier, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, giftName: u.giftName, giftImage: u.giftImage ?? '', count, diamonds });
    recordGift(u, v, count, diamonds);
    thank(u, v);
    boss.hit(u, v, 'gift', diamonds);
    addHeat(u.userId, Math.min(6, 1 + diamonds));
    raiseMoon(diamonds * 2);
    return shine(u, v, diamonds * cfg.lightPerDiamond, 'gift');
  }

  // Likes are the "gõ mõ" of this room: every tap raises the moon.
  function like(u) {
    const v = viewer(u);
    const n = Math.max(0, u.count | 0);
    raiseMoon(n);
    boss.hit(u, v, 'like', n);
    addHeat(u.userId, Math.ceil(n / 15));
    onEvent({ type: 'likes', userId: u.userId, sign: v.sign, count: n });
    if (!cfg.likesPerLight || !v.sign) return 0;
    const total = v.likeCarry + n;
    v.likeCarry = total % cfg.likesPerLight;
    return shine(u, v, Math.floor(total / cfg.likesPerLight), 'like');
  }

  // Follow and share ring the bell every time but pay once per viewer per night.
  function social(u) {
    const v = viewer(u);
    const kind = u.kind === 'share' ? 'share' : 'follow';
    onEvent({ type: 'bell', kind, userId: u.userId, nickname: v.nickname, sign: v.sign });
    if (v.bonusNight[kind] === st.night.no) return 0;
    v.bonusNight[kind] = st.night.no;
    thank(u, v);
    boss.hit(u, v, kind);
    addHeat(u.userId, 3);
    raiseMoon(20);
    return shine(u, v, kind === 'share' ? cfg.shareLight : cfg.followLight, kind);
  }

  // --- lucky star: a short x2 window for a sign from the lower half of the race --------------------
  function startLucky(sign) {
    if (!SIGN[sign]) {
      const low = rank().slice(6).map(r => r.id);
      sign = low[Math.floor(rng() * low.length)];
    }
    st.lucky = { sign, endsAt: now() + cfg.luckySeconds * 1000 };
    touch('hud');
    onEvent({ type: 'lucky-start', sign, seconds: cfg.luckySeconds, multiplier: cfg.luckyMultiplier });
    return st.lucky;
  }
  function endLucky() {
    if (!st.lucky) return;
    const sign = st.lucky.sign;
    st.lucky = null;
    st.nextLuckyAt = now() + cfg.luckyEverySeconds * 1000;
    touch('hud');
    onEvent({ type: 'lucky-end', sign });
  }

  // --- poll: a light "which sign…?" question the whole room answers -----------------------------------
  function startPoll() {
    if (!polls.length || st.poll || st.quiz || st.fortune) return null;
    st.poll = { q: polls[st.pollCursor++ % polls.length], endsAt: now() + cfg.pollSeconds * 1000, votes: zeros(), voted: {}, total: 0 };
    touch('hud');
    onEvent({ type: 'poll-start', q: st.poll.q });
    return st.poll;
  }
  function castVote(u, v, sign) {
    st.poll.voted[u.userId] = true;
    st.poll.votes[sign]++;
    st.poll.total++;
    touch('hud');
    if (v.sign) shine(u, v, cfg.pollLight, 'poll');
  }
  function endPoll() {
    const p = st.poll;
    if (!p) return;
    st.poll = null;
    touch('hud');
    const ranked = SIGNS.map(x => ({ id: x.id, n: p.votes[x.id] })).sort((a, b) => b.n - a.n || ORDER[a.id] - ORDER[b.id]);
    onEvent({ type: 'poll-end', q: p.q, total: p.total, winner: p.total ? ranked[0].id : null, votes: ranked[0].n });
  }

  // --- quiz -------------------------------------------------------------
  function startQuiz() {
    if (!quiz.length || st.quiz || st.poll) return null;
    const item = quiz[st.quizCursor++ % quiz.length];
    st.quiz = { ...item, endsAt: now() + cfg.quizSeconds * 1000, answered: {}, winners: [] };
    touch('hud');
    onEvent({ type: 'quiz-start' });
    return st.quiz;
  }

  function answerQuiz(u, v) {
    const letter = norm(u.comment).trim().toUpperCase();
    if (!/^[A-D]$/.test(letter) || st.quiz.answered[u.userId]) return false;
    st.quiz.answered[u.userId] = letter;
    touch('hud');
    if (letter !== st.quiz.answer) return true;
    const reward = cfg.quizRewards[st.quiz.winners.length];
    if (reward === undefined) return true;
    st.quiz.winners.push({ nickname: v.nickname, sign: v.sign, reward });
    thank(u, v);
    shine(u, v, reward, 'quiz');
    gem(u, v, 1, 'quiz');
    return true;
  }

  function endQuiz() {
    const q = st.quiz;
    if (!q) return;
    st.quiz = null;
    touch('hud');
    onEvent({ type: 'quiz-end', answer: q.answer, answerText: q.options['ABCD'.indexOf(q.answer)], winners: q.winners });
  }

  // Call about every 100-250ms.
  let lastLuckyTick = null;
  function tick() {
    const t = now();
    if (st.moon.partyUntil && t >= st.moon.partyUntil) {
      st.moon.partyUntil = 0;
      touch('hud');
      onEvent({ type: 'moon-end' });
    }
    // Lucky star: starts on a timer while people are around; the countdown is published once a second
    // (every 10s while waiting), not on every tick.
    if (st.lucky) { if (t >= st.lucky.endsAt) endLucky(); }
    else if (t >= st.nextLuckyAt && t - st.lastActivityAt < 60000) startLucky();
    const luckyTick = st.lucky ? Math.ceil((st.lucky.endsAt - t) / 1000) : 1000 + Math.ceil((st.nextLuckyAt - t) / 10000);
    if (luckyTick !== lastLuckyTick) { lastLuckyTick = luckyTick; touch('hud'); }
    if (st.fortune && t >= st.fortune.endsAt) { st.fortune = null; touch('hud'); }
    if (st.poll && t >= st.poll.endsAt) endPoll();
    // The real sky, Thủy Nghịch, the boss (they never overlap) and the chest. Readings wait while the boss is up.
    if (t - skyAt >= 60000) refreshSky();
    const active = t - st.lastActivityAt < 60000, busy = st.quiz || st.poll || st.fortune;
    if (st.chaos && t >= st.chaos.endsAt) endChaos(false);
    else if (!st.chaos && !st.boss && t >= st.nextChaosAt) { if (active && stage.size) startChaos(); else scheduleChaos(); }
    // bossWas spans ticks: a boss beaten by a gift ends between two ticks, not inside boss.tick()
    const hadBoss = bossWas;
    boss.tick();
    bossWas = Boolean(st.boss);
    if (hadBoss && !st.boss) st.nextBossAt = cfg.bossEverySeconds ? t + cfg.bossEverySeconds * 1000 : Infinity;
    if (!st.boss && !st.chaos && !busy && active && stage.size && t >= st.nextBossAt) startBoss();
    if (st.boss || hadBoss) touch('cosmos');
    if (cards.tick(st.lastActivityAt)) touch('cosmos');
    rollHeat();
    const hl = heatLevelOf(heatScore());
    if (hl !== heat.level) {
      if (hl > heat.level) onEvent({ type: 'heat-up', level: hl, multiplier: cfg.heatMultipliers[hl] ?? 1 });
      heat.level = hl;
      touch('cosmos');
    }
    if (!st.fortune && !st.quiz && !st.poll && !st.boss && st.fortuneQueue.length) showFortune(st.fortuneQueue.shift());
    if (st.quiz && t >= st.quiz.endsAt) endQuiz();
    // Quiet room: mostly a sign's reading of the day; a quiz and a light poll come once each per eight
    // turns (about every six minutes), so they leave room for gifts, lit signs and the other events.
    if (!st.quiz && !st.fortune && !st.poll && !st.boss && t - st.lastActivityAt >= cfg.quietSeconds * 1000 && t >= st.quietUntil) {
      const turn = st.quietTurn++;
      st.quietUntil = t + 45000;
      // 3× a house mascot shows a command, 3× a sign's reading, 1× quiz, 1× poll
      const kind = (cfg.demoTurns ? [3, 1, 3, 0, 1, 3, 1, 2] : [1, 1, 1, 0, 1, 1, 1, 2])[turn % 8];
      if (kind === 0 && cfg.autoQuiz && quiz.length) startQuiz();
      else if (kind === 2 && polls.length) startPoll();
      else if (kind === 3) onEvent({ type: 'demo', demo: DEMOS[(st.demoNo = (st.demoNo ?? 0) + 1) % DEMOS.length], sign: SIGNS[Math.floor(rng() * 12)].id });
      else showFortune({ userId: null, nickname: null, avatar: '', sign: SIGNS[Math.floor(rng() * 12)].id });
    }
    // Drop viewers who went quiet from the stage (at most crowdMax entries to look at).
    const cutoff = t - cfg.presenceMinutes * 60000;
    for (const id of stage.keys()) {
      if ((st.viewers[id]?.lastSeenAt ?? 0) >= cutoff) break;
      stage.delete(id);
      touch('stage');
    }
    for (const id of lobby.keys()) {
      if ((st.viewers[id]?.lastSeenAt ?? 0) >= cutoff) break;
      outOfLobby(id);
    }
  }

  // --- snapshot parts -----------------------------------------------------------
  const parts = {
    hud: () => {
      const t = now(), q = st.quiz;
      return {
        night: { ...st.night },
        occasion: occasionOn(dayKey(t)),
        moon: { light: st.moon.light, goal: st.moon.goal, full: st.moon.full, partyMs: Math.max(0, st.moon.partyUntil - t) },
        fortune: st.fortune && { ...st.fortune, remainingMs: Math.max(0, st.fortune.endsAt - t) },
        fortuneQueue: st.fortuneQueue.length,
        quiz: q && { q: q.q, options: q.options, remainingMs: Math.max(0, q.endsAt - t), winners: q.winners, tries: Object.keys(q.answered).length },
        lucky: st.lucky && { sign: st.lucky.sign, remainingMs: Math.max(0, st.lucky.endsAt - t), multiplier: cfg.luckyMultiplier },
        luckyInMs: st.lucky ? 0 : Math.max(0, st.nextLuckyAt - t),
        poll: st.poll && { q: st.poll.q, remainingMs: Math.max(0, st.poll.endsAt - t), votes: { ...st.poll.votes }, total: st.poll.total },
        pendingLight: Object.values(st.pending).reduce((a, b) => a + b, 0),
        quietMs: t - st.lastActivityAt,
      };
    },
    race: () => {
      const r = rank(), total = r.reduce((a, b) => a + b.given, 0);
      return { wheel: st.wheel.no, total, leader: total > 0 ? r[0].id : null, order: r.map((x, i) => ({ id: x.id, given: x.given, rank: i + 1, crowns: st.season.crowns[x.id] })) };
    },
    sky: () => {
      const c = cost();
      const sky = SIGNS.map(s => {
        const progress = Math.min(1, st.wheel.light[s.id] / c);
        return { id: s.id, progress, lit: progress >= 1, stars: Math.floor(progress * CONSTELLATIONS[s.id].stars.length) };
      });
      return { wheel: st.wheel.no, litCount: sky.filter(s => s.lit).length, sky, waiting: sky.filter(s => !s.lit).sort((a, b) => a.progress - b.progress || ORDER[a.id] - ORDER[b.id]).slice(0, 3).map(s => s.id) };
    },
    stage: () => [...stage.keys()].map(id => {
      const v = st.viewers[id];
      return { userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign, title: titleOf(v.lifetime), streak: v.streak ?? 0, crowns: v.crowns ?? 0, level: v.level ?? 1, fan: v.fanLevel ?? 0, sub: Boolean(v.subscriber) };
    }),
    thanks: () => st.thanks.map(({ nickname, avatar, sign }) => ({ nickname, avatar, sign })),
    gifts: () => {
      const g = st.gifts;
      return { count: g.count, diamonds: g.diamonds, top: g.top, goal: { sum: g.goalSum, goal: giftGoal(), no: g.goalNo }, recent: g.recent.map(({ nickname, avatar, giftName, giftImage, count }) => ({ nickname, avatar, giftName, giftImage, count })) };
    },
    // the real sky (planets, moon phase, retrograde), Thủy Nghịch, the boss and the star chest
    cosmos: () => {
      const t = now(), c = st.chaos;
      return {
        sky: sky && { planets: sky.planets, moon: sky.moon, mercuryRetro: sky.mercuryRetro },
        boons: cfg.skyBoons,
        chaos: c && { remainingMs: Math.max(0, c.endsAt - t), need: c.need, got: Object.keys(c.fixers).length, fixers: Object.values(c.fixers).slice(-3), real: c.real },
        chaosInMs: c || !Number.isFinite(st.nextChaosAt) ? null : Math.max(0, st.nextChaosAt - t),
        boss: boss.view(),
        bossInMs: st.boss || !Number.isFinite(st.nextBossAt) ? null : Math.max(0, st.nextBossAt - t),
        chest: cards.view(),
        wishes: st.wishes.slice(0, 5).map(w => ({ id: w.id, nickname: w.nickname, avatar: w.avatar, sign: w.sign, text: w.text, blessed: w.blessed, blessings: Object.keys(w.blessers).length, open: !w.blessed && t - w.at < cfg.blessWindowSeconds * 1000 })),
        blessNeed: cfg.blessNeed,
        heat: { level: heat.level, score: heatScore(), levels: cfg.heatLevels, multiplier: heatMult() },
        fans: [...stage.keys()].map(id => st.viewers[id]).filter(v => v?.fanLevel || v?.subscriber).sort((a, b) => (b.fanLevel ?? 0) - (a.fanLevel ?? 0)).slice(0, 3).map(v => ({ nickname: v.nickname, avatar: v.avatar, level: v.fanLevel ?? 0 })),
        fanCount: [...stage.keys()].filter(id => st.viewers[id]?.fanLevel || st.viewers[id]?.subscriber).length,
      };
    },
    // first eight in line for the waiting-queue layout, plus how many wait in all and who arrived last (to greet)
    lobby: () => {
      const ids = [...lobby.keys()], pick = id => ({ nickname: st.viewers[id].nickname, avatar: st.viewers[id].avatar });
      return { total: ids.length, people: ids.slice(0, 8).map(pick), latest: ids.length ? pick(ids.at(-1)) : null };
    },
  };

  // Parts whose version moved past `seen` (a { part: version } object the caller keeps).
  // hud is time-based while a timer runs, so it is always included then.
  function changes(seen = {}) {
    const out = {};
    const timers = partying() || st.fortune || st.quiz || st.lucky || st.poll;
    const cosmosTimers = st.chaos || st.boss || cards.isOpen();
    for (const [name, build] of Object.entries(parts)) {
      if (seen[name] === ver[name] && !(timers && name === 'hud') && !(cosmosTimers && name === 'cosmos')) continue;
      seen[name] = ver[name];
      out[name] = build();
    }
    return out;
  }
  const snapshot = () => Object.fromEntries(Object.entries(parts).map(([k, f]) => [k, f()]));

  // A new night: the moon, follow/share bonuses and the visitor count restart; the sky keeps going.
  function newNight() {
    st.night = { no: st.night.no + 1, startedAt: now(), visitors: 0 };
    stage.clear();
    lobby.clear();
    st.moon = { light: 0, goal: moonGoalFor(0), full: 0, partyUntil: 0 };
    st.pending = {};
    st.thanks = [];
    st.gifts = freshGifts();
    touch('hud', 'stage', 'thanks', 'lobby', 'gifts');
    onEvent({ type: 'night-start', no: st.night.no });
  }

  function resetAll() {
    Object.assign(st, { ...emptyState(), lastActivityAt: now(), quizCursor: st.quizCursor });
    st.night.startedAt = now();
    stage.clear();
    lobby.clear();
    st.wheel.cost = wheelCost(1);
    st.moon.goal = moonGoalFor(0);
    leader = null;
    st.nextLuckyAt = now() + cfg.luckyEverySeconds * 1000;
    st.nextBossAt = cfg.bossEverySeconds ? now() + cfg.bossEverySeconds * 500 : Infinity;
    scheduleChaos();
    touch('hud', 'race', 'sky', 'stage', 'thanks', 'lobby', 'gifts', 'cosmos');
    onEvent({ type: 'reset' });
  }

  // Keeps the saved state small in long-running channels: forget one-time visitors after a while.
  function pruneViewers(days = 45) {
    const cutoff = now() - days * 86400000;
    for (const [id, v] of Object.entries(st.viewers)) if (v.lastSeenAt < cutoff && v.lifetime < 100 && !stage.has(id)) delete st.viewers[id];
  }

  // Removes the rehearsal viewers ("sim:" ids) so a real live starts without them on stage or in the thank-you bar.
  function purgeSim() {
    let n = 0;
    for (const id of Object.keys(st.viewers)) if (id.startsWith('sim:')) { delete st.viewers[id]; delete st.pending[id]; stage.delete(id); lobby.delete(id); n++; }
    st.thanks = st.thanks.filter(t => !t.userId.startsWith('sim:'));
    st.gifts.recent = st.gifts.recent.filter(r => !r.userId.startsWith('sim:'));
    st.fortuneQueue = st.fortuneQueue.filter(f => !f.userId.startsWith('sim:'));
    boss.purge('sim:');
    if (st.chaos) for (const id of Object.keys(st.chaos.fixers)) if (id.startsWith('sim:')) delete st.chaos.fixers[id];
    st.chest.recent = [];
    st.wishes = st.wishes.filter(w => !w.userId.startsWith('sim:'));
    touch('hud', 'stage', 'thanks', 'race', 'lobby', 'gifts', 'cosmos');
    return n;
  }

  return { startPoll, endPoll, purgeSim, chat, gift, like, social, startLucky, endLucky, startQuiz, endQuiz, showFortune, startBoss, startChaos, endChaos, openChest: cards.openNow, tick, changes, snapshot, newNight, resetAll, pruneViewers, sky: () => sky, state: st, config: cfg };
}
