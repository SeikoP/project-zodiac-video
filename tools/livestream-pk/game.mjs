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
//   "xin quẻ" → a free daily zodiac reading on the altar · "ước …" → a wish lantern · "kho" → everything you own.
// Gifts trigger on-stage effects by size and are thanked by name, never ranked.
//
// Built for busy rooms: every handler is O(1) in the number of viewers; the stage keeps only the
// most recently active viewers; snapshot parts carry version numbers so callers send only what changed.
import { CONSTELLATIONS } from './public/constellations.js';
import { dayKey } from './fortunes.mjs';
import { createAltar, ALTAR_DEFAULTS } from './altar.mjs';
import { createJourney, JOURNEY_DEFAULTS } from './journey.mjs';
import { cleanName, safeAvatar } from './names.mjs';
import { occasionOn } from './public/occasions.js';
import { signOfDate } from './birth.mjs';
import { ACTS, HEADS, HEAD_QUEST, createActs } from './acts.mjs';
import { createMystery, createStarcatch, MINIGAME_DEFAULTS } from './minigames.mjs';
import { createRoast, ROAST_DEFAULTS } from './roast.mjs';
import { createTug, TUG_DEFAULTS } from './tug.mjs';
import { createPredict, PREDICT_DEFAULTS } from './predict.mjs';
import { createBingo, BINGO_DEFAULTS } from './bingo.mjs';
import { createPass, PASS_DEFAULTS } from './pass.mjs';
import { createBoss, BOSS_DEFAULTS } from './boss.mjs';
import { createCards, CARD_DEFAULTS } from './cards.mjs';
import { createBag, BAG_DEFAULTS } from './bag.mjs';
import { EDITION, CARD_TOTAL, parseCard } from './public/cards.js';

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
// the room's heat, the Fanclub and the level multiply the light of every action, together at most this much
const LIGHT_CAP = 3;
const SIGN = Object.fromEntries(SIGNS.map(s => [s.id, s]));
const ORDER = Object.fromEntries(SIGNS.map((s, i) => [s.id, i]));
// Visitor counts that get a small celebration.
const MILESTONES = [1, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000];
const zeros = () => Object.fromEntries(SIGNS.map(s => [s.id, 0]));

export const DEFAULT_CONFIG = Object.freeze({
  rehearsal: false, // only the isolated simulator plays "sim:" viewers; everywhere else they are ignored at the door
  // starlight per action
  commentLight: 2,
  commentCooldownSeconds: 5,
  likesPerLight: 5,
  followLight: 20,
  shareLight: 20,
  lightPerDiamond: 5,
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
  giftGoal: 0, // the shared gift goal (xu) and its meteor shower; 0 = off (a gift bar on screen reads as asking for gifts)
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
  // every this many polls (with the acts on) the room picks the next act's headliner instead
  pollNextEvery: 3,
  // a small room gets smaller goals: wheel and moon scale with the viewers on stage (floor .2, full at 12)
  adaptiveCrowd: true,
  crowdFloor: 0.2,
  crowdFull: 12,
  // a room that fills up mid-round raises the goals it set while small: every crowdRetuneSeconds, up to ×crowdRetuneStep, never down (0 = off)
  crowdRetuneSeconds: 30,
  crowdRetuneStep: 1.25,
  autoQuiz: true,
  quietSeconds: 45,
  ...BOSS_DEFAULTS,
  ...CARD_DEFAULTS,
  ...BAG_DEFAULTS,
  ...ALTAR_DEFAULTS,
  ...JOURNEY_DEFAULTS,
  // "kho" (also "khoe", "khoe thẻ", "sổ sao"): everything a viewer owns in one panel, once per this many seconds each
  vaultCooldownSeconds: 30,
  // resources used in the room's events: "tung ngọc" in a fight hits like a gift of this many coins; "thắp trăng"
  // raises the moon by this share of its goal; each at most once per powerCooldownSeconds per viewer
  gemPowerDiamonds: 20,
  moonShardShare: 0.2,
  powerCooldownSeconds: 10,
  // a wish the room blesses: "chúc" within the window; enough blessings and the wish becomes a star
  blessWindowSeconds: 45,
  blessNeed: 3,
  blessDust: 3,
  // a newcomer lands as a star; enough "chào" from the room within the window and it lights up (+bụi sao for them)
  welcomeWindowSeconds: 30,
  welcomeNeed: 3,
  welcomeDust: 5,
  switchCooldownSeconds: 30, // "đổi <cung>": at most this often, so the lucky star can't be chased sign to sign
  // every viewer who picks a sign gets a star with their name on the community sky (kept across nights)
  starsShown: 90,
  // a big moment at least this often while people are around (star roll call, a meteor shower); 0 = off
  showEverySeconds: 75,
  // Màn: the show runs in acts of actMinutes that take turns (acts.mjs); each opens, plays a headliner from its middle
  // and closes with an MVP. false = no acts, everything always on.
  acts: true,
  actMinutes: 5,
  eliteHpFactor: 1.8,
  quizChainLength: 5,
  ...MINIGAME_DEFAULTS,
  ...ROAST_DEFAULTS,
  ...TUG_DEFAULTS,
  ...PREDICT_DEFAULTS,
  ...BINGO_DEFAULTS,
  ...PASS_DEFAULTS,
  auraSeconds: 90, // a gift leaves a golden aura round the giver's mascot this long
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
  show: { join: true, flow: false, title: false, streak: false, wish: true, overtake: true, milestone: true, hearts: true },
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
export { signOfDate };
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
  // only Vietnamese names count here: the English ids include everyday words ("leo" = climb)
  const whole = squash(comment);
  return whole ? SWITCH_NAMES.find(([alias]) => alias === whole)?.[1] ?? null : null;
}
const SWITCH_NAMES = [...SIGNS.map(s => [squash(s.label), s.id]), ...Object.entries(EXTRA_ALIASES)];

// Keyword actions, matched on accent-free words.
const FORTUNE_RE = /\b(xin que|gieo que|rut que|boc que|xin xam|gieo xam)\b/;
const WISH_RE = /^\s*(uoc|mong|nguyen|cau (nguyen|mong|cho|chuc))\b/;
const CLAIM_RE = /^\s*(nhan|nhan the|nhan ruong|mo ruong)[\s!.]*$/;
const UPGRADE_RE = /\b(nang cap|len cap|len lv|up lv)\b/;
const COMBINE_RE = /\bghep the\b/;
const VAULT_RE = /^\s*(kho|tui|tui do|xem kho|kho do|khoe|khoe kho|so sao|xem so sao|so sao cua toi)[\s!.]*$|\b(khoe the|bo the|xem the)\b/;
const GEM_POWER_RE = /^\s*(tung ngoc|nem ngoc|dung ngoc)\b/;
const MOON_POWER_RE = /^\s*(thap trang|dot trang)\b/;
const VOTE_RE = /^\s*(?:so|chon|phieu|bau)?\s*([1-4])\s*[!.]*$/;
export const parseVote = comment => { const m = norm(comment).match(VOTE_RE); return m ? Number(m[1]) - 1 : null; };
const WELCOME_RE = /^\s*(xin chao|chao mung|chao|hi|hello|helo|welcome)\b/;
const BLESS_RE = /^\s*(chuc|chuc phuc|thanh hien thuc|thanh su|amen|\+1)\b/;
// what the house mascots demonstrate in a quiet room, in turn
export const DEMOS = ['join', 'wish', 'fortune', 'upgrade', 'bless', 'chest', 'switch'];
const BINGO_RE = /^\s*(bingo|xem bingo|the bingo)[\s!.]*$/;
const CALL_RE = /^\s*(goi sao|goi sao may man)[\s!.]*$/;
export function parseAction(comment) {
  const t = norm(comment);
  if (WISH_RE.test(t)) return 'wish';
  if (CLAIM_RE.test(t)) return 'claim';
  if (VAULT_RE.test(t)) return 'vault';
  if (GEM_POWER_RE.test(t)) return 'gem-power';
  if (MOON_POWER_RE.test(t)) return 'moon-power';
  if (UPGRADE_RE.test(t)) return 'upgrade';
  if (COMBINE_RE.test(t)) return 'combine';
  if (BLESS_RE.test(t)) return 'bless';
  if (WELCOME_RE.test(t)) return 'welcome';
  if (CALL_RE.test(t)) return 'call';
  if (BINGO_RE.test(t)) return 'bingo';
  if (FORTUNE_RE.test(t)) return 'fortune';
  return null;
}

// Wish text shown on stream: no links/numbers-as-contacts, and blocked words hide the text.
export function cleanWish(comment, blockedWords) {
  const clean = String(comment ?? '').replace(/https?:\/\/\S+|\S+\.(com|vn|net)\S*/gi, '').replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim();
  // long wishes end on a whole word, never in the middle of one
  const text = clean.length <= 100 ? clean : clean.slice(0, 101).replace(/\s+\S*$/, '').slice(0, 100);
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
    greetingNo: 0,
    fortune: null,
    fortuneQueue: [],
    quiz: null,
    quizCursor: 0,
    quietTurn: 0,
    poll: null,
    pollCursor: 0,
    quietUntil: 0,
    lastActivityAt: 0,
    boss: null, // see boss.mjs
    nextBossAt: 0,
    chest: { no: 0, openUntil: 0, claimed: {}, recent: [] },
    welcomes: [], // newcomers' stars the room can greet, newest first: { id, userId, nickname, avatar, at, greeters: { userId: nickname }, done }
    wishes: [], // the last few wishes, newest first: { id, userId, nickname, avatar, sign, text, at, blessers: { userId: nickname }, blessed }
    wishNo: 0,
    // the acts and headliners, and what is playing right now (null when nothing is)
    act: { key: null, phase: null, light: {} }, head: null, quest: null,
    mystery: null, starcatch: null, roast: null, tug: null, predict: null, nextShowAt: 0, showNo: 0,
  };
}

export function createGame({ config = {}, state = emptyState(), quiz = [], polls = [], now = () => Date.now(), rng = Math.random, onEvent = () => {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config, show: { ...DEFAULT_CONFIG.show, ...config.show } };
  const st = state;
  // every event also feeds the bingo cards and the predictions (set up further down)
  const emit = onEvent;
  let listen = () => {};
  onEvent = e => { emit(e); listen(e); };
  st.night.startedAt ??= now();
  st.lastActivityAt ||= now();
  st.wheel.given ??= zeros();
  st.season ??= { light: zeros(), crowns: zeros() };
  st.lucky ??= null;
  st.gifts ??= freshGifts();
  st.wishes ??= [];
  st.welcomes ??= [];
  st.wishNo ??= 0;
  st.greetingNo ??= 0;
  // rehearsal viewers left in a saved state by older versions: off the stage lists before the first real viewer arrives
  if (!cfg.rehearsal) {
    const sim = id => String(id ?? '').startsWith('sim:');
    for (const map of [st.viewers, st.pending, st.gifts.by]) for (const id of Object.keys(map ?? {})) if (sim(id)) delete map[id];
    st.gifts.top = Object.values(st.gifts.by).reduce((top, b) => (!top || b.diamonds >= top.diamonds ? { nickname: b.nickname, diamonds: b.diamonds } : top), null);
    for (const k of ['thanks', 'wishes', 'welcomes', 'fortuneQueue']) st[k] = (st[k] ?? []).filter(x => !sim(x.userId));
    st.gifts.recent = st.gifts.recent.filter(x => !sim(x.userId));
  }
  st.nextLuckyAt ||= now() + cfg.luckyEverySeconds * 1000;
  const rehearsalOnly = u => !cfg.rehearsal && String(u?.userId ?? '').startsWith('sim:');
  const partying = () => now() < st.moon.partyUntil;

  // Version counters let the server send a part only when it changed.
  const ver = { hud: 1, race: 1, sky: 1, stage: 1, thanks: 1, lobby: 1, gifts: 1, cosmos: 1, stars: 1 };
  const touch = (...parts) => { for (const p of parts) ver[p]++; };

  // The stage: most recently active viewers with a sign, oldest first (Map keeps insertion order).
  const stage = new Map();
  const signsOnStage = () => [...new Set([...stage.keys()].map(id => st.viewers[id]?.sign).filter(id => SIGN[id]))];
  const pickEventSign = () => {
    const present = signsOnStage();
    const choices = present.length ? present : SIGNS.map(s => s.id);
    return choices[Math.floor(rng() * choices.length)];
  };
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
  // Raises the wheel and moon goals toward what the room's size calls for now; never lowers them.
  let lastRetuneAt = now();
  function retuneGoals(t) {
    if (!cfg.adaptiveCrowd || !cfg.crowdRetuneSeconds || t - lastRetuneAt < cfg.crowdRetuneSeconds * 1000) return;
    lastRetuneAt = t;
    const raise = (cur, target) => (target > cur ? Math.min(target, Math.ceil(cur * cfg.crowdRetuneStep)) : cur);
    // once a constellation is lit the wheel cost stays put: raising it would dim a sign the room already lit
    const anyLit = Object.values(st.wheel.light).some(l => l >= st.wheel.cost);
    const wheel = anyLit ? st.wheel.cost : raise(st.wheel.cost, wheelCost(st.wheel.no)), moon = raise(st.moon.goal, moonGoalFor(st.moon.full));
    if (wheel === st.wheel.cost && moon === st.moon.goal) return;
    st.wheel.cost = wheel;
    st.moon.goal = moon;
    touch('hud', 'cosmos');
  }

  const newViewer = nickname => ({ nickname, avatar: '', sign: null, lifetime: 0, lastSeenAt: 0, lastCommentAt: 0, likeCarry: 0, bonusNight: {}, fortuneAt: 0, wishAt: 0, night: 0 });

  function viewer(u) {
    const name = cleanName(u.nickname || u.userId, cfg.blockedWords);
    const v = (st.viewers[u.userId] ??= newViewer(name));
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
    // someone still choosing a sign already gets a pale star in the community sky; picking a sign makes it theirs (see join)
    if (!v.star) {
      v.star = { x: rng(), y: rng(), at: now(), unsigned: true };
      touch('stars');
    }
    return v;
  }

  // A join is only greeted: nothing persistent is created, so lurkers don't count as visitors.
  let greeted = new Set(), greetedNo = 0;
  function member(u) {
    if (rehearsalOnly(u)) return false;
    if (!u?.userId || u.userId === 'unknown') return false;
    if (greetedNo !== st.night.no) { greeted = new Set(); greetedNo = st.night.no; }
    if (greeted.has(u.userId)) return false;
    greeted.add(u.userId);
    const nickname = st.viewers[u.userId]?.nickname ?? cleanName(u.nickname || u.userId, cfg.blockedWords);
    const avatar = safeAvatar(u.avatar) || st.viewers[u.userId]?.avatar || '';
    // a newcomer is a quiet star in the community sky from the moment they walk in; not a visitor, not in the lobby
    const v = (st.viewers[u.userId] ??= { ...newViewer(nickname), avatar, lastSeenAt: now() });
    if (!v.star) {
      v.star = { x: rng(), y: rng(), at: now(), unsigned: true };
      touch('stars');
    }
    // their star flies in and lands on the rim of the cluster; the room's "chào" lights it up (like blessing a wish)
    const w = { id: ++st.greetingNo, userId: u.userId, nickname, avatar, at: now(), greeters: {}, done: false };
    st.welcomes.unshift(w);
    st.welcomes.length = Math.min(st.welcomes.length, 6);
    onEvent({ type: 'greeting', id: w.id, userId: u.userId, nickname, avatar, sign: v.sign, x: v.star.x, y: v.star.y, need: cfg.welcomeNeed, seconds: cfg.welcomeWindowSeconds });
    return true;
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
    st.moon.light += amount * (st.head?.id === 'moonnight' ? 2 : 1);
    touch('hud');
    if (st.moon.light < st.moon.goal) return;
    st.moon.full++;
    st.moon.light = 0;
    st.moon.goal = moonGoalFor(st.moon.full);
    st.moon.partyUntil = now() + cfg.partySeconds * 1000;
    onEvent({ type: 'moon-full', count: st.moon.full, seconds: cfg.partySeconds, multiplier: cfg.partyMultiplier });
    for (const id of stage.keys()) if (st.viewers[id]) bag.add({ userId: id }, st.viewers[id], 'moon', 1, 'moon'); // everyone there gets a moon shard
  }

  // --- the boss and the star chest ---------------------------------------------
  const boss = createBoss({
    st, cfg, now, onEvent,
    elementOf: id => SIGN[id].element,
    signsOnStage,
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
    const b = st.tug ? null : boss.start(Math.max(3, stage.size));
    if (b) bossWas = true;
    return b;
  }

  const cards = createCards({ st, cfg, now, rng, onEvent, signs: SIGNS.map(s => s.id), specials: () => [] });
  const bag = createBag({ cfg, now, onEvent, elementOf: id => SIGN[id].element });
  // one gem of the viewer's own element (what their next level needs)
  const gem = (u, v, n, why) => { if (v?.sign) bag.add(u, v, SIGN[v.sign].element, n, why); };
  // --- bàn quẻ (altar.mjs): "xin quẻ", and the room's "chuẩn" / "xin vía" while a reading is on ---
  const altar = createAltar({ st, cfg, now, onEvent, touch, signs: SIGN, pickSign: () => pickEventSign(), shine: (u, v, n, why) => shine(u, v, n, why), dust: (u, v, n, why) => bag.add(u, v, 'dust', n, why) });
  const showFortune = req => altar.show(req);

  // --- kho chung: resources, level, cards, Sổ Sao and bingo in one panel ("kho", "khoe", "khoe thẻ", "sổ sao") ---
  function showVault(u, v) {
    if (now() - (v.vaultAt ?? 0) < cfg.vaultCooldownSeconds * 1000) return;
    v.vaultAt = now();
    const ids = Object.keys(v.cards ?? {}).map(parseCard);
    const best = ids.sort((a, b) => EDITION[b.edition].rarity - EDITION[a.edition].rarity).slice(0, 3);
    const p = v.sign ? pass.view(v) : null, b = v.sign ? bingo.cardOf(u.userId, v) : null;
    onEvent({ type: 'vault', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, level: bag.levelOf(v), bag: { ...(v.bag ?? {}) }, next: bag.nextCost(v),
      cards: { unique: ids.length, total: CARD_TOTAL, best, setDone: Boolean(v.setDone) },
      pass: p, bingo: b && { lines: b.lines, marked: b.marked.filter(Boolean).length }, title: titleOf(v.lifetime) });
  }

  // --- resources used in the room's events ---
  const FIGHTS = [['boss', () => st.boss], ['tug', () => st.tug]];
  const powerReady = v => now() - (v.powerAt ?? 0) >= cfg.powerCooldownSeconds * 1000;
  function powerNeed(u, v, why) {
    if (now() - (v.powerHintAt ?? 0) < cfg.powerCooldownSeconds * 1000) return;
    v.powerHintAt = now();
    onEvent({ type: 'power-need', userId: u.userId, nickname: v.nickname, why });
  }
  // "tung ngọc": one gem (own element first) lands like a gift on the fight that is on
  function gemPower(u, v) {
    if (!v.sign || !powerReady(v)) return;
    const target = FIGHTS.find(([, on]) => on())?.[0];
    if (!target) return powerNeed(u, v, 'no-fight');
    const held = v.bag ?? {}, own = SIGN[v.sign].element;
    const res = (held[own] ?? 0) > 0 ? own : ['fire', 'earth', 'air', 'water'].find(k => (held[k] ?? 0) > 0);
    if (!res) return powerNeed(u, v, 'no-gem');
    v.powerAt = now();
    held[res]--;
    onEvent({ type: 'power', kind: 'gem', res, target, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign });
    if (target === 'boss') boss.hit(u, v, 'gift', cfg.gemPowerDiamonds);
    else if (target === 'tug') tug.pull(u, v, 'gift', cfg.gemPowerDiamonds);
  }
  // "thắp trăng": one moon shard raises the moon by a share of its goal
  function moonPower(u, v) {
    if (!v.sign || !powerReady(v)) return;
    if (!(v.bag?.moon > 0)) return powerNeed(u, v, 'no-moon');
    v.powerAt = now();
    v.bag.moon--;
    onEvent({ type: 'power', kind: 'moon', res: 'moon', target: 'moon', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign });
    raiseMoon(Math.round(st.moon.goal * cfg.moonShardShare));
  }

  // --- two short headliners (minigames.mjs): Cung bí ẩn and Hứng sao băng ---
  const mystery = createMystery({ st, cfg, now, rng, onEvent, parseSign, gem: (u, v, n, why) => gem(u, v, n, why), quest: stat => questAdd(stat) });
  const starcatch = createStarcatch({ st, cfg, now, rng, onEvent, gem: (u, v, n, why) => gem(u, v, n, why), quest: stat => questAdd(stat),
    dust: (u, v, n, why) => bag.add(u, v, 'dust', n, why), shine: (u, v, n, why) => shine(u, v, n, why) });

  // --- vòng quay bóc phốt (roast.mjs) ---------------------------------------------------------------
  const roast = createRoast({
    st, cfg, now, rng, onEvent,
    present: () => [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign),
    shine: (id, n, kind) => { const v = st.viewers[id]; if (v) shine({ userId: id }, v, n, kind); },
    lucky: sign => (st.lucky ? null : startLucky(sign)),
  });

  // --- kéo co, dự đoán, bingo, sổ sao (tug.mjs, predict.mjs, bingo.mjs, pass.mjs) ------------------------------
  const onStageNow = () => [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign);
  const shineId = (id, n, kind) => { const v = st.viewers[id]; if (v) shine({ userId: id }, v, n, kind); };
  const tug = createTug({ st, cfg, now, onEvent, present: onStageNow, shine: shineId });
  const predict = createPredict({ st, cfg, now, onEvent });
  const bingo = createBingo({ st, cfg, now, onEvent, stageIds: () => stage.keys(), gem: (u, v, n) => gem(u, v, n, 'bingo'), moon: (u, v) => bag.add(u, v, 'moon', 1, 'bingo') });
  const pass = createPass({ cfg, now, onEvent, seasonOf: () => dayKey(now()).slice(0, 7), gem: (u, v, n) => gem(u, v, n, 'pass'), moon: (u, v, n) => bag.add(u, v, 'moon', n, 'pass'), card: (u, v) => cards.give(u, v, cards.draw(v), 'pass') });
  const label = id => SIGN[id]?.label ?? id;
  // --- hành trình đêm & đội nguyên tố (journey.mjs) ---
  const journey = createJourney({ st, cfg, now, onEvent, stageIds: () => stage.keys(), elementOf: id => SIGN[id].element, dust: (u, v, n) => bag.add(u, v, 'dust', n, 'journey'), moon: (u, v) => bag.add(u, v, 'moon', 1, 'journey') });

  // --- lời dẫn cho host: one line at each climax, sent only to the host's panel (never on stream) ---
  const cued = new Map(); // once-key -> time it was said
  function cue(key, text, once = key) {
    if (cued.has(once)) return;
    cued.set(once, now());
    onEvent({ type: 'host-cue', key, text });
  }
  const EL_LABEL = { fire: 'Hỏa', earth: 'Thổ', air: 'Phong', water: 'Thủy' };
  let tugSide = 0, tugFlips = 0, tugFlipAt = 0;
  function cueTick(t) {
    for (const [k, at] of cued) if (t - at > 600000) cued.delete(k);
    const b = st.boss;
    if (b && b.hp > 0 && b.hp <= b.max * 0.25) cue('boss-low', 'Sao Chổi chỉ còn 1/4 máu! Hô cả phòng chat dồn dập, ai có ngọc thì gõ “tung ngọc” để kết liễu.', `boss-low@${b.startedAt}`);
    const fights = [['boss', b && b.hp > 0 && b.endsAt, 'trận Sao Chổi'], ['tug', st.tug && st.tug.endsAt, 'kéo co']];
    for (const [id, endsAt, name] of fights) if (endsAt && endsAt - t <= 15000 && endsAt > t) cue('last-seconds', `Còn 15 giây ${name}! Đếm ngược cùng cả phòng — mỗi comment, mỗi tim đều tính.`, `last@${id}@${endsAt}`);
    if (!partying() && st.moon.light >= st.moon.goal * 0.85) cue('moon-near', 'Trăng sắp tròn rồi — rủ cả nhà thả tim thêm chút nữa để mở tiệc trăng!', `moon@${st.night.no}@${st.moon.full}`);
    const act = actView();
    if (act && act.phase === 'play' && act.headInMs > 0 && act.headInMs <= 30000) cue('head-soon', `30 giây nữa: ${act.headLabel}. Giới thiệu luật cho người mới vào nhé.`, `head@${Math.floor(t / 60000 / 10)}@${act.head}`);
    // kéo co đảo chiều: the rope crosses the middle
    const g2 = st.tug;
    if (!g2 || t < g2.startsAt) { tugSide = 0; return; }
    const side = Math.sign(Math.round(g2.pos));
    if (side && tugSide && side !== tugSide && t - tugFlipAt >= 5000) {
      const lead = side < 0 ? g2.a : g2.b, other = side < 0 ? g2.b : g2.a;
      tugFlipAt = t;
      onEvent({ type: 'tug-flip', lead, other, pos: Math.round(g2.pos) });
      cue('tug-flip', `Đảo chiều! ${SIGN[lead].label} vừa lật thế kéo co — fan ${SIGN[other].label} ơi, kéo lại!`, `flip@${g2.startsAt}@${++tugFlips}`);
    }
    if (side) tugSide = side;
  }

  listen = e => {
    journey.note(e);
    bingo.note(e);
    if (e.type === 'chapter') cue('chapter', `Xong chặng ${e.no}/${e.of}: ${e.label}! ${e.next ? `Chặng tiếp: ${e.next.label} — cần ${e.next.need} ${e.next.goal}.` : 'Cả hành trình đêm nay đã trọn vẹn, cảm ơn cả nhà!'}`, `chapter@${st.night.no}@${e.no}`);
    else if (e.type === 'element-lead') cue('element-lead', `Đảo chiều! Đội ${EL_LABEL[e.element]} vượt lên dẫn đầu đêm nay — đội ${EL_LABEL[e.prev]} ơi, gỡ lại nào!`, `lead@${now()}`);
    // predictions open before a big outcome and settle when it is known
    if (e.type === 'tug-start') predict.open({ key: 'tug', q: `${label(e.a)} hay ${label(e.b)} thắng kéo co?`, options: [label(e.a), label(e.b)], closesAt: now() + e.warmup * 1000 });
    else if (e.type === 'tug-end') predict.resolve('tug', e.winner === e.a ? 0 : e.winner === e.b ? 1 : null);
    else if (e.type === 'head-start' && e.id === 'elite') predict.open({ key: 'elite', q: 'Cả phòng hạ được Boss tinh anh?', options: ['Hạ được', 'Nó trốn thoát'], closesAt: now() + 20000 });
    else if (e.type === 'boss-defeated') predict.resolve('elite', 0);
    else if (e.type === 'boss-escaped') predict.resolve('elite', 1);
  };
  // a patron's star: lifetime gifts (xu) make the giver's star in the community sky bigger and golden
  const patronTier = v => { const g = v.giftTotal ?? 0; return g >= 1000 ? 3 : g >= 100 ? 2 : g >= 10 ? 1 : 0; };

  // --- Màn: the acts, their headliners and their quest ------------------------------------------------------
  // An act lasts cfg.actMinutes. Minute 0 opens it, its headliner plays from the middle (headAt) until CLOSE_AT, the
  // last stretch closes it with its MVP (most starlight earned in the act). The acts take turns, each visit of an act
  // moving on to the next headliner of its list.
  const acts = createActs({ minutes: cfg.actMinutes });
  const ACT_MIN = cfg.actMinutes, ACT = ACT_MIN * 60000, CLOSE_AT = ACT_MIN * 0.85;
  let slot = cfg.acts ? acts.at(now()) : null; // { act, startsAt, endsAt, next, index } of the act running now
  const luckyEvery = () => cfg.luckyEverySeconds * 1000;
  st.act ??= { key: null, phase: null, light: {} };
  const minuteInAct = t => (t % ACT) / 60000;
  const headOf = s_ => s_.act.heads[Math.floor(s_.index / ACTS.length) % s_.act.heads.length];
  // a headliner the room voted for plays in its act's next turn (st.headVote: { act, id, from, until })
  const voted = (s_, t) => { const v = st.headVote; return v && s_.act.id === v.act && t >= v.from && t < v.until ? v.id : null; };
  const currentHead = (t = now()) => { if (!cfg.acts) return undefined; const s_ = acts.at(t); return voted(s_, t) ?? headOf(s_); };
  const roomLive = () => stage.size > 0 && now() - st.lastActivityAt < 600000;
  function actTick(t) {
    if (!slot) return;
    if (t >= slot.endsAt) { slot = acts.at(t); touch('cosmos', 'hud'); }
    const key = Math.floor(t / ACT), m = minuteInAct(t);
    const phase = m < 1 ? 'open' : m < acts.headAt() ? 'play' : m < CLOSE_AT ? 'head' : 'close';
    if (key !== st.act.key) {
      st.act = { key, phase: null, light: {} };
      if (roomLive()) onEvent({ type: 'act-open', ...actView() });
    }
    // the headliner waits (and retries every tick) while a quiz, poll or reading is open, so they never overlap
    if (phase === 'head' && !st.act.headDone && roomLive() && !st.quiz && !st.poll && !st.fortune && startHead()) st.act.headDone = true;
    if (phase === st.act.phase) return;
    st.act.phase = phase;
    touch('cosmos');
    if (phase === 'close') { endHead(); if (roomLive()) actClose(); }
  }
  const actInfo = (s_, head) => ({ id: s_.act.id, label: s_.act.label, color: s_.act.color, glyph: '★', head: HEADS[head].label });
  function actView() {
    if (!slot) return null;
    const t = now(), key = Math.floor(t / ACT), head = currentHead(t);
    return { ...actInfo(slot, head), no: slot.index + 1, heads: slot.act.heads.map(id => HEADS[id].label), startsAt: slot.startsAt, endsAt: slot.endsAt, phase: st.act.phase, head, headLabel: HEADS[head].label, headInMs: Math.max(0, key * ACT + acts.headAt() * 60000 - t), endsInMs: (key + 1) * ACT - t,
      next: actInfo({ act: slot.next }, headOf({ act: slot.next, index: slot.index + 1 })) };
  }
  function actClose() {
    const top = Object.entries(st.act.light).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([id]) => st.viewers[id]);
    // the act's MVP takes home a card
    const mvp = top[0] && st.viewers[top[0][0]];
    if (mvp?.sign) cards.give({ userId: top[0][0] }, mvp, cards.draw(mvp, 'boss'), 'mvp');
    onEvent({ type: 'act-close', top: top.map(([id, light]) => ({ userId: id, nickname: st.viewers[id].nickname, avatar: st.viewers[id].avatar, sign: st.viewers[id].sign, light })),
      next: { act: slot.next.id, label: slot.next.label, glyph: '★', head: HEADS[headOf({ act: slot.next, index: slot.index + 1 })].label } });
  }

  // Headliners: the act's list in turn, one per act, from headAt() to CLOSE_AT. The host can start one any time.
  // Those that play to their own end keep their state under st[OWN_END[id]]; "Đoán vật" is still the old mystery game.
  const OWN_END = { roast: 'roast', tug: 'tug', guessobject: 'mystery', starcatch: 'starcatch' };
  function startHead(id = currentHead()) {
    if (!id || !HEADS[id] || st.head || st.boss || st.roast || st.tug || st.mystery || st.starcatch) return null;
    const t = now(), m = minuteInAct(t);
    const endsAt = t + Math.max(90000, (m < CLOSE_AT && slot ? CLOSE_AT - m : 3) * 60000);
    st.head = { id, startedAt: t, endsAt };
    if (id === 'elite') {
      if (!boss.start(Math.round(Math.max(3, stage.size) * cfg.eliteHpFactor))) { st.head = null; return null; }
      st.boss.elite = true;
    } else if (id === 'quizchain') Object.assign(st.head, { left: cfg.quizChainLength, nextAt: t + 2000, streaks: {}, best: null, inQuiz: false });
    else if (id === 'moonnight') { st.head.nextAt = t + 40000; showFortune({ userId: null, nickname: null, avatar: '', sign: pickEventSign() }); }
    else if (id === 'final') Object.assign(st.head, { base: { ...st.wheel.given }, wheel: st.wheel.no });
    else if (id === 'chestrain') { cards.openNow(); st.head.chests = [t + 60000, t + 120000]; }
    else if (id === 'guessobject') { if (!mystery.start()) { st.head = null; return null; } }
    else if (id === 'starcatch') { if (!starcatch.start()) { st.head = null; return null; } }
    else if (id === 'roast') { if (!roast.start()) { st.head = null; return null; } }
    else if (id === 'tug') { if (!tug.start()) { st.head = null; return null; } }
    touch('cosmos');
    onEvent({ type: 'head-start', id, label: HEADS[id].label, act: slot?.act.id ?? null, seconds: Math.round((endsAt - t) / 1000) });
    return st.head;
  }
  function headTick(t) {
    const h = st.head;
    if (!h) return;
    // these play to their own end
    if (OWN_END[h.id]) { if (!st[OWN_END[h.id]]) endHead(); return; }
    if (t >= h.endsAt && !(h.id === 'quizchain' && st.quiz)) return endHead();
    if (h.id === 'quizchain') {
      if (h.inQuiz && !st.quiz) { h.inQuiz = false; h.nextAt = t + 3500; }
      if (!st.quiz && !st.poll && h.left > 0 && t >= h.nextAt && startQuiz()) { h.left--; h.inQuiz = true; }
    }
    if (h.id === 'moonnight' && t >= h.nextAt) { h.nextAt = t + 40000; runShow('meteor'); }
    if (h.id === 'chestrain' && h.chests.length && t >= h.chests[0]) { h.chests.shift(); cards.openNow(); }
  }
  function endHead() {
    const h = st.head;
    if (!h || (OWN_END[h.id] && st[OWN_END[h.id]])) return;
    st.head = null;
    touch('cosmos');
    const out = { type: 'head-end', id: h.id, label: HEADS[h.id].label };
    if (h.id === 'final') {
      const base = h.wheel === st.wheel.no ? h.base : zeros();
      const gains = SIGNS.map(s => ({ id: s.id, gain: st.wheel.given[s.id] - (base[s.id] ?? 0) })).sort((a, b) => b.gain - a.gain || ORDER[a.id] - ORDER[b.id]);
      if (gains[0].gain > 0) {
        const winner = gains[0].id;
        st.season.crowns[winner]++;
        let fans = 0;
        for (const id of stage.keys()) { const v = st.viewers[id]; if (v?.sign === winner) { v.crowns = (v.crowns ?? 0) + 1; fans++; } }
        Object.assign(out, { winner, fans, podium: gains.slice(0, 3) });
        touch('race');
      }
    }
    if (h.id === 'quizchain' && h.best) {
      out.best = h.best;
      const v = st.viewers[h.best.userId];
      if (v) gem({ userId: h.best.userId }, v, 2, 'quiz');
    }
    onEvent(out);
  }

  // Nhiệm vụ Màn: one goal per act the whole room reaches just by taking part (comments, blessings, right answers,
  // hearts, starlight, cards, floors — never gifts). Everyone on stage shares the reward.
  function questTick() {
    const q = slot && (HEAD_QUEST[currentHead()] || slot.act.quest), key = slot && `${slot.act.id}@${slot.startsAt}`;
    if (!q || st.quest?.key === key) return;
    const { stat, unit, reward, rewardText } = q;
    st.quest = { key, stat, unit, reward, rewardText, goal: Math.max(1, Math.round(q.base + q.per * Math.max(1, stage.size))), got: 0, done: false };
    touch('cosmos');
  }
  function questAdd(stat, n = 1) {
    const q = st.quest;
    if (!q || q.done || q.stat !== stat || !(n > 0) || q.key !== (slot && `${slot.act.id}@${slot.startsAt}`)) return;
    q.got = Math.min(q.goal, q.got + n);
    touch('cosmos');
    if (q.got < q.goal) return;
    q.done = true;
    const people = [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign);
    for (const [id, v] of people) {
      const u = { userId: id };
      if (q.reward === 'gem') gem(u, v, 1, 'quest');
      else if (q.reward === 'dust') bag.add(u, v, 'dust', 10, 'quest');
      else if (q.reward === 'moon') bag.add(u, v, 'moon', 1, 'quest');
      else shine(u, v, 20, 'quest');
    }
    onEvent({ type: 'quest-done', act: slot.act.id, glyph: '★', color: slot.act.color, goal: q.goal, unit: q.unit, reward: q.rewardText, people: people.length });
  }
  const questView = () => {
    const q = st.quest;
    return q && slot && q.key === `${slot.act.id}@${slot.startsAt}` ? { got: q.got, goal: q.goal, done: q.done, unit: q.unit, reward: q.rewardText, glyph: '★', color: slot.act.color } : null;
  };

  // --- newcomers the room can greet: "chào" goes to the newest open welcome that isn't your own -------------------
  function welcome(u, v) {
    const t = now();
    const w = st.welcomes.find(x => !x.done && x.userId !== u.userId && !x.greeters[u.userId] && t - x.at < cfg.welcomeWindowSeconds * 1000);
    if (!w) return;
    w.greeters[u.userId] = v.nickname;
    const count = Object.keys(w.greeters).length;
    if (count < cfg.welcomeNeed) return void onEvent({ type: 'welcome-hi', id: w.id, userId: w.userId, nickname: w.nickname, by: v.nickname, count, need: cfg.welcomeNeed });
    w.done = true;
    const owner = st.viewers[w.userId];
    if (owner) bag.add({ userId: w.userId }, owner, 'dust', cfg.welcomeDust, 'welcome');
    onEvent({ type: 'welcome-done', id: w.id, userId: w.userId, nickname: w.nickname, avatar: w.avatar, sign: owner?.sign ?? null, greeters: Object.values(w.greeters).slice(0, 5), count, dust: cfg.welcomeDust });
  }

  // --- wishes the room can bless --------------------------------------------------------------------
  function bless(u, v) {
    const t = now();
    const w = st.wishes.find(x => !x.blessed && x.userId !== u.userId && !x.blessers[u.userId] && t - x.at < cfg.blessWindowSeconds * 1000);
    if (!w) return;
    w.blessers[u.userId] = v.nickname;
    bag.add(u, v, 'dust', cfg.blessDust);
    questAdd('blessings');
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
    const amount = Math.round(base * (partying() ? cfg.partyMultiplier : 1) * (st.lucky?.sign === v.sign ? cfg.luckyMultiplier : 1) * Math.min(LIGHT_CAP, bag.bonus(v) * heatMult() * fanMult(v))); // the room's heat, the Fanclub and the level share one cap
    if (st.act) st.act.light[u.userId] = (st.act.light[u.userId] ?? 0) + amount;
    if (kind !== 'quest') questAdd('light', amount);
    pass.addXp(u, v, amount);
    const before = v.lifetime;
    v.lifetime += amount;
    bag.fromLight(v, amount);
    if (v.wheelNo !== st.wheel.no) { v.wheelNo = st.wheel.no; v.wheelLight = 0; }
    v.wheelLight += amount;
    const to = v.sign;
    st.wheel.given[to] += amount; // counted before pour so it still lands in a wheel that completes right now
    st.season.light[to] += amount;
    touch('race');
    checkOvertake(to);
    pour(to, amount);
    onEvent({ type: 'light', kind, userId: u.userId, sign: v.sign, amount });
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
    if (!v.star || v.star.unsigned) {
      v.star = { x: v.star?.x ?? rng(), y: v.star?.y ?? rng(), at: now() };
      touch('stars');
      onEvent({ type: 'star-born', userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign, x: v.star.x, y: v.star.y });
    }
    const held = st.pending[u.userId];
    if (held) {
      delete st.pending[u.userId];
      shine(u, v, held, 'pending');
    }
  }

  // A clear "đổi <cung>" moves the viewer to another sign (light already given stays where it landed).
  function switchSign(u, v, to) {
    if (!to || to === v.sign) return;
    // a sign frozen by the boss is stuck until its fans break the ice
    if (st.boss?.frozen?.sign === v.sign) return onEvent({ type: 'switch-wait', userId: u.userId, nickname: v.nickname, sign: v.sign, to, frozen: true });
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
    if (v.callNight === st.night.no) return;
    if (st.lucky) return onEvent({ type: 'fan-call-wait', userId: u.userId, nickname: v.nickname, seconds: Math.ceil((st.lucky.endsAt - now()) / 1000) });
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
    const gap = slot - heat.at;
    if (gap <= 0) return;
    if (gap >= heat.buckets.length) heat.buckets.fill(0); // a long gap (sleep, stall): the whole window is cold
    else for (let i = 0; i < gap; i++) { heat.buckets.shift(); heat.buckets.push(0); }
    heat.per.clear(); // the per-viewer cap counts within one bucket
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
    if (rehearsalOnly(u)) return;
    const v = viewer(u);
    if (st.quiz && answerQuiz(u, v)) return;
    if ((st.mystery && mystery.chat(u, v, u.comment)) || (st.starcatch && starcatch.chat(u, v, u.comment))) { addHeat(u.userId, 1); raiseMoon(1); return; } // a guess or a catch
    if (st.roast) roast.chat(u, v, norm(u.comment)); // "oan!" / "chuẩn!" while a sign is being roasted
    if (st.predict && predict.chat(u, v, norm(u.comment))) { addHeat(u.userId, 1); return; } // "đoán A"
    const sign = parseSign(u.comment);
    // While a poll runs, "1"–"4" is a vote (never a team pick); sign names still join newcomers as usual.
    const vote = st.poll ? parseVote(u.comment) : null;
    if (vote !== null) { if (!st.poll.voted[u.userId] && vote < st.poll.options.length) castVote(u, v, vote); addHeat(u.userId, 1); return; }
    addHeat(u.userId, 1);
    if (!v.sign) { if (sign) join(u, v, sign); }
    else if (!st.poll) switchSign(u, v, parseSwitch(u.comment));
    if (v.sign && v.checkin) {
      const bonus = v.checkin;
      v.checkin = 0;
      shine(u, v, bonus, 'checkin');
      if (v.streak >= 2) onEvent({ type: 'streak', userId: u.userId, nickname: v.nickname, sign: v.sign, streak: v.streak, amount: bonus });
    }
    altar.chat(u, v, u.comment); // "chuẩn" / "xin vía" while a reading is on screen
    const action = parseAction(u.comment);
    if (action === 'wish') wish(u, v);
    else if (action === 'fortune') altar.request(u, v, u.comment);
    else if (action === 'claim') {
      const had = st.chest.claimed[u.userId];
      cards.claim(u, v);
      if (!had && st.chest.claimed[u.userId]) { gem(u, v, 1, 'chest'); questAdd('claims'); }
    }
    else if (action === 'upgrade') { if (v.sign) bag.upgrade(u, v); else onEvent({ type: 'need-sign', userId: u.userId, nickname: v.nickname, for: 'upgrade' }); }
    else if (action === 'combine' && v.sign) cards.combine(u, v);
    else if (action === 'vault') showVault(u, v);
    else if (action === 'gem-power') gemPower(u, v);
    else if (action === 'moon-power') moonPower(u, v);
    else if (action === 'bless') bless(u, v);
    else if (action === 'welcome') welcome(u, v);
    else if (action === 'call') fanCall(u, v);
    else if (action === 'bingo') bingo.show(u, v);
    boss.hit(u, v, 'comment');
    tug.pull(u, v, 'comment');
    raiseMoon(1);
    if (v.sign && now() - v.lastCommentAt >= cfg.commentCooldownSeconds * 1000) {
      v.lastCommentAt = now();
      questAdd('comments'); // at most one per viewer per few seconds, so spamming doesn't fill it
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

  // --- the big moment every ~75 s: a roll call of tonight's stars or a meteor shower ----
  st.nextShowAt ||= now() + (cfg.showEverySeconds || 0) * 1000;
  const presentWith = test => [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v && test(v));
  // the kinds come in turn; a kind that can't run right now falls back to one that can
  function showKind(want) {
    const kinds = ['starcall', 'meteor'];
    const k = want ?? kinds[(st.showNo ?? 0) % kinds.length];
    if (k === 'roast') return presentWith(v => v.sign).length ? 'roast' : 'starcall';
    return k;
  }
  const nextShowKind = () => showKind();
  function runShow(want) {
    const kind = showKind(want);
    if (!want) st.showNo = (st.showNo ?? 0) + 1;
    st.nextShowAt = now() + cfg.showEverySeconds * 1000;
    touch('cosmos');
    if (kind === 'roast') return roast.start();
    const people = presentWith(v => v.star).slice(-12).map(([id, v]) => ({ userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign, x: v.star.x, y: v.star.y }));
    onEvent({ type: 'showtime', kind: kind === 'starcall' && people.length ? 'starcall' : 'meteor', people });
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
    if (cfg.giftGoal > 0) g.goalSum += diamonds;
    // a big gift can fill several goals at once: one celebration, and the bar keeps only what is left over
    let reached = 0;
    while (cfg.giftGoal > 0 && g.goalSum >= giftGoal()) {
      reached = giftGoal();
      g.goalSum -= reached;
      g.goalNo++;
    }
    if (reached) onEvent({ type: 'gift-goal', no: g.goalNo, goal: reached, nickname: v.nickname, sign: v.sign });
    touch('gifts');
  }

  function gift(u) {
    if (rehearsalOnly(u)) return;
    const v = viewer(u);
    const count = Math.max(1, u.count | 0);
    const diamonds = Math.max(0, u.diamonds) * count;
    const tier = diamonds >= cfg.meteorDiamonds ? 'meteor' : diamonds >= cfg.fireworkDiamonds ? 'firework' : 'sparkle';
    onEvent({ type: 'gift', tier, userId: u.userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign, giftName: u.giftName, giftImage: u.giftImage ?? '', count, diamonds });
    recordGift(u, v, count, diamonds);
    thank(u, v);
    boss.hit(u, v, 'gift', diamonds);
    tug.pull(u, v, 'gift', diamonds);
    // the giver: a golden aura on the wheel for a while, and a patron's star in the community sky
    const tierBefore = patronTier(v);
    v.giftTotal = (v.giftTotal ?? 0) + diamonds;
    v.auraUntil = now() + cfg.auraSeconds * 1000;
    touch('stage');
    if (patronTier(v) !== tierBefore) touch('stars');
    addHeat(u.userId, Math.min(6, 1 + diamonds));
    raiseMoon(diamonds * 2);
    return shine(u, v, diamonds * cfg.lightPerDiamond, 'gift');
  }

  // Likes are the "gõ mõ" of this room: every tap raises the moon.
  function like(u) {
    if (rehearsalOnly(u)) return;
    const v = viewer(u);
    const n = Math.max(0, u.count | 0);
    raiseMoon(n);
    boss.hit(u, v, 'like', n);
    tug.pull(u, v, 'like', n);
    questAdd('likes', n);
    addHeat(u.userId, Math.ceil(n / 15));
    onEvent({ type: 'likes', userId: u.userId, sign: v.sign, count: n });
    if (!cfg.likesPerLight || !v.sign) return 0;
    const total = v.likeCarry + n;
    v.likeCarry = total % cfg.likesPerLight;
    return shine(u, v, Math.floor(total / cfg.likesPerLight), 'like');
  }

  // Follow and share ring the bell every time but pay once per viewer per night.
  function social(u) {
    if (rehearsalOnly(u)) return;
    const v = viewer(u);
    const kind = u.kind === 'share' ? 'share' : 'follow';
    onEvent({ type: 'bell', kind, userId: u.userId, nickname: v.nickname, sign: v.sign });
    if (v.bonusNight[kind] === st.night.no) return 0;
    v.bonusNight[kind] = st.night.no;
    thank(u, v);
    boss.hit(u, v, kind);
    tug.pull(u, v, kind);
    addHeat(u.userId, 3);
    raiseMoon(20);
    return shine(u, v, kind === 'share' ? cfg.shareLight : cfg.followLight, kind);
  }

  // --- lucky star: a short x2 window for a sign from the lower half of the race --------------------
  function startLucky(sign) {
    if (!SIGN[sign]) {
      const present = new Set(signsOnStage());
      const low = rank().slice(6).filter(r => !present.size || present.has(r.id));
      const choices = low.length ? low : rank().filter(r => present.has(r.id));
      sign = choices[Math.floor(rng() * choices.length)].id;
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
    st.nextLuckyAt = now() + luckyEvery();
    touch('hud');
    onEvent({ type: 'lucky-end', sign });
  }

  // --- poll: a light "which sign…?" question the whole room answers -----------------------------------
  // Bình chọn: four numbered options, "1"–"4" to vote. A "which sign…?" question offers four signs; every
  // pollNextEvery-th poll (with the acts on) asks which headliner the next act should play.
  function pollOptions(entry) {
    if (entry?.kind === 'next' && slot) {
      const n = slot.next, start = Math.max(0, n.heads.indexOf(currentHead(slot.endsAt)));
      const heads = [...n.heads.slice(start), ...n.heads.slice(0, start)].slice(0, 4);
      return { kind: 'next', q: `Màn ${n.label} tới, cả phòng muốn chơi gì?`, options: heads.map(id => ({ label: HEADS[id].label, head: id })) };
    }
    if (typeof entry === 'string') {
      const pool = SIGNS.map(s => s.id), picks = [];
      while (picks.length < 4) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      return { kind: 'sign', q: entry, options: picks.map(id => ({ label: SIGN[id].label, sign: id })) };
    }
    return { kind: 'custom', q: entry.q, options: entry.options.slice(0, 4).map(label => ({ label })) };
  }
  function startPoll() {
    if (!polls.length || st.poll || st.quiz || st.fortune) return null;
    const n = st.pollCursor++;
    let entry = slot && cfg.pollNextEvery && n % cfg.pollNextEvery === cfg.pollNextEvery - 1 ? { kind: 'next' } : polls[n % polls.length];
    if (entry?.kind === 'next' && !slot) entry = polls.find(p => p?.kind !== 'next'); // no acts: nothing to pick
    if (!entry) return null;
    const p = pollOptions(entry);
    st.poll = { ...p, endsAt: now() + cfg.pollSeconds * 1000, votes: p.options.map(() => 0), voted: {}, total: 0, act: slot?.next.id ?? null, from: slot?.endsAt ?? 0, slot: slot ? slot.endsAt - slot.startsAt : 0 };
    touch('hud');
    onEvent({ type: 'poll-start', q: p.q, kind: p.kind, options: p.options });
    return st.poll;
  }
  function castVote(u, v, i) {
    st.poll.voted[u.userId] = true;
    st.poll.votes[i]++;
    st.poll.total++;
    touch('hud');
    if (v.sign) shine(u, v, cfg.pollLight, 'poll');
  }
  function endPoll() {
    const p = st.poll;
    if (!p) return;
    st.poll = null;
    touch('hud');
    const top = Math.max(...p.votes), winner = p.total ? p.votes.indexOf(top) : null;
    const option = winner === null ? null : p.options[winner];
    if (p.kind === 'next' && option) st.headVote = { act: p.act, id: option.head, from: p.from, until: p.from + p.slot };
    onEvent({ type: 'poll-end', q: p.q, kind: p.kind, total: p.total, winner, option, votes: top, sign: option?.sign ?? null });
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
    const chain = st.head?.id === 'quizchain' ? st.head : null; // đố nhanh liên hoàn: answers in a row
    if (chain) {
      const n = chain.streaks[u.userId] = letter === st.quiz.answer ? (chain.streaks[u.userId] ?? 0) + 1 : 0;
      if (n && n > (chain.best?.streak ?? 0)) chain.best = { userId: u.userId, nickname: v.nickname, sign: v.sign, streak: n };
    }
    if (letter !== st.quiz.answer) return true;
    questAdd('correct');
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
    tickNo++;
    const t = now();
    retuneGoals(t);
    cueTick(t);
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
    if (st.poll && t >= st.poll.endsAt) endPoll();
    // The boss and the chest. Readings wait while the boss is up.
    const active = t - st.lastActivityAt < 60000, busy = st.quiz || st.poll || st.fortune;
    // the act and its headliner
    actTick(t);
    questTick();
    mystery.tick(t);
    starcatch.tick(t);
    roast.tick();
    tug.tick();
    predict.tick();
    headTick(t);
    const playing = st.head || st.roast || st.tug || st.mystery || st.starcatch;
    // bossWas spans ticks: a boss beaten by a gift ends between two ticks, not inside boss.tick()
    const hadBoss = bossWas;
    boss.tick();
    bossWas = Boolean(st.boss);
    if (hadBoss && !st.boss) st.nextBossAt = cfg.bossEverySeconds ? t + cfg.bossEverySeconds * 1000 : Infinity;
    if (!st.boss && !busy && active && stage.size && t >= st.nextBossAt) { if (!playing) startBoss(); else st.nextBossAt = t + 60000; }
    if (cfg.showEverySeconds && t >= st.nextShowAt) {
      // the boss, readings and a headliner are big moments already: the show waits behind them.
      // A quiet room still gets it (that is when a newcomer needs something to watch), just not an abandoned one.
      if (!st.boss && !busy && !playing && t - st.lastActivityAt < 600000 && stage.size) runShow();
      else { st.nextShowAt = t + 15000; touch('cosmos'); }
    }
    if (st.boss || hadBoss || st.mystery || st.starcatch) touch('cosmos');
    if (cards.tick(st.lastActivityAt)) touch('cosmos');
    rollHeat();
    const hl = heatLevelOf(heatScore());
    if (hl !== heat.level) {
      if (hl > heat.level) onEvent({ type: 'heat-up', level: hl, multiplier: cfg.heatMultipliers[hl] ?? 1 });
      heat.level = hl;
      touch('cosmos');
    }
    altar.tick(t, !st.quiz && !st.poll && !st.boss);
    if (st.quiz && t >= st.quiz.endsAt) endQuiz();
    // Quiet room: mostly a sign's reading of the day; a quiz and a light poll come once each per eight
    // turns (about every six minutes), so they leave room for gifts, lit signs and the other events.
    const headWaiting = st.act?.phase === 'head' && !st.act.headDone; // don't open a quiz/poll in the way of the headliner
    if (!st.quiz && !st.fortune && !st.poll && !st.boss && !playing && !headWaiting && t - st.lastActivityAt >= cfg.quietSeconds * 1000 && t >= st.quietUntil) {
      const turn = st.quietTurn++;
      st.quietUntil = t + 45000;
      // 3× a house mascot shows a command, 3× a sign's reading, 1× quiz, 1× poll — whichever of those can run
      let kind = (cfg.demoTurns ? [3, 1, 3, 0, 1, 3, 1, 2] : [1, 1, 1, 0, 1, 1, 1, 2])[turn % 8];
      if (kind === 3 && !cfg.demoTurns) kind = 1;
      if (kind === 0 && cfg.autoQuiz && quiz.length) startQuiz();
      else if (kind === 2 && polls.length) startPoll();
      else if (kind === 3) onEvent({ type: 'demo', demo: DEMOS[(st.demoNo = (st.demoNo ?? 0) + 1) % DEMOS.length], sign: pickEventSign() });
      else if (kind >= 0) showFortune({ userId: null, nickname: null, avatar: '', sign: pickEventSign() });
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
        fortune: altar.view(t),
        fortuneQueue: st.fortuneQueue.length,
        quiz: q && { q: q.q, options: q.options, remainingMs: Math.max(0, q.endsAt - t), winners: q.winners, tries: Object.keys(q.answered).length },
        lucky: st.lucky && { sign: st.lucky.sign, remainingMs: Math.max(0, st.lucky.endsAt - t), multiplier: cfg.luckyMultiplier },
        luckyInMs: st.lucky ? 0 : Math.max(0, st.nextLuckyAt - t),
        poll: st.poll && { q: st.poll.q, kind: st.poll.kind, options: st.poll.options.map((o, i) => ({ ...o, n: st.poll.votes[i] })), remainingMs: Math.max(0, st.poll.endsAt - t), total: st.poll.total },
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
      return { userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign, title: titleOf(v.lifetime), streak: v.streak ?? 0, crowns: v.crowns ?? 0, level: v.level ?? 1, fan: v.fanLevel ?? 0, sub: Boolean(v.subscriber),
        aura: (v.auraUntil ?? 0) > now() ? v.auraUntil : 0, frame: pass.frameOf(v) };
    }),
    thanks: () => st.thanks.map(({ nickname, avatar, sign }) => ({ nickname, avatar, sign })),
    gifts: () => {
      const g = st.gifts;
      return { count: g.count, diamonds: g.diamonds, top: g.top, goal: { sum: g.goalSum, goal: giftGoal(), no: g.goalNo }, recent: g.recent.map(({ nickname, avatar, giftName, giftImage, count }) => ({ nickname, avatar, giftName, giftImage, count })) };
    },
    // the boss and the star chest
    cosmos: () => {
      const t = now();
      const fansHere = [];
      for (const id of stage.keys()) { const v = st.viewers[id]; if (v?.fanLevel || v?.subscriber) fansHere.push(v); }
      return {
        boss: boss.view(),
        bossInMs: st.boss || !Number.isFinite(st.nextBossAt) ? null : Math.max(0, st.nextBossAt - t),
        chest: cards.view(),
        wishes: st.wishes.slice(0, 5).map(w => ({ id: w.id, nickname: w.nickname, avatar: w.avatar, sign: w.sign, text: w.text, blessed: w.blessed, blessings: Object.keys(w.blessers).length, open: !w.blessed && t - w.at < cfg.blessWindowSeconds * 1000 })),
        blessNeed: cfg.blessNeed,
        welcomes: st.welcomes.filter(w => !w.done && t - w.at < cfg.welcomeWindowSeconds * 1000).slice(0, 3).map(w => ({ id: w.id, nickname: w.nickname, greetings: Object.keys(w.greeters).length })),
        welcomeNeed: cfg.welcomeNeed,
        heat: { level: heat.level, score: heatScore(), levels: cfg.heatLevels, multiplier: heatMult() },
        fans: fansHere.sort((a, b) => (b.fanLevel ?? 0) - (a.fanLevel ?? 0)).slice(0, 3).map(v => ({ nickname: v.nickname, avatar: v.avatar, level: v.fanLevel ?? 0 })),
        fanCount: fansHere.length,
        show: cfg.showEverySeconds ? { inMs: Math.max(0, st.nextShowAt - t), kind: nextShowKind() } : null,
        act: actView(),
        head: st.head && { id: st.head.id, label: HEADS[st.head.id].label, remainingMs: Math.max(0, st.head.endsAt - t), left: st.head.left ?? null },
        mystery: mystery.view(t),
        starcatch: starcatch.view(t),
        quest: questView(),
        roast: roast.view(),
        tug: tug.view(),
        predict: predict.view(),
        journey: journey.view(),
      };
    },
    // the community sky: a named star for everyone who ever picked a sign, most recently seen first
    stars: () => {
      const list = [];
      for (const [id, v] of Object.entries(st.viewers)) if (v.star) list.push([id, v]);
      list.sort((a, b) => b[1].lastSeenAt - a[1].lastSeenAt);
      return list.slice(0, cfg.starsShown).map(([id, v]) => ({ userId: id, nickname: v.nickname, sign: v.sign, x: v.star.x, y: v.star.y, mag: Math.min(5, 1 + Math.floor(Math.log2(1 + v.lifetime / 50))), patron: patronTier(v) }));
    },
    // first eight in line for the waiting-queue layout, plus how many wait in all and who arrived last (to greet)
    lobby: () => {
      const ids = [...lobby.keys()], pick = id => ({ nickname: st.viewers[id].nickname, avatar: st.viewers[id].avatar });
      return { total: ids.length, people: ids.slice(0, 8).map(pick), latest: ids.length ? pick(ids.at(-1)) : null };
    },
  };

  // Parts whose version moved past `seen` (a { part: version } object the caller keeps).
  // hud is time-based while a timer runs, so it is always included then.
  const built = {};
  let tickNo = 0;
  function changes(seen = {}) {
    const out = {};
    const timers = partying() || st.fortune || st.quiz || st.lucky || st.poll;
    const cosmosTimers = st.boss || cards.isOpen() || st.mystery || st.starcatch || st.head || st.roast || st.tug || st.predict;
    for (const [name, build] of Object.entries(parts)) {
      if (seen[name] === ver[name] && !(timers && name === 'hud') && !(cosmosTimers && name === 'cosmos')) continue;
      seen[name] = ver[name];
      // every client behind on a part gets the same object within one tick: build it once
      const hit = built[name];
      out[name] = hit && hit.tick === tickNo && hit.ver === ver[name] ? hit.value : (built[name] = { tick: tickNo, ver: ver[name], value: build() }).value;
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
    touch('hud', 'stage', 'thanks', 'lobby', 'gifts', 'stars');
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
    st.nextLuckyAt = now() + luckyEvery();
    st.nextBossAt = cfg.bossEverySeconds ? now() + cfg.bossEverySeconds * 500 : Infinity;
    touch('hud', 'race', 'sky', 'stage', 'thanks', 'lobby', 'gifts', 'cosmos', 'stars');
    onEvent({ type: 'reset' });
  }

  // Keeps the saved state small in long-running channels: forget one-time visitors after a while.
  function pruneViewers(days = 45) {
    const cutoff = now() - days * 86400000;
    for (const [id, v] of Object.entries(st.viewers)) if (v.lastSeenAt < cutoff && v.lifetime < 100 && !stage.has(id)) delete st.viewers[id];
  }

  return { startPoll, endPoll, chat, member, gift, like, social, startLucky, endLucky, startQuiz, endQuiz, showFortune, startBoss, openChest: cards.openNow, startHead, startTug: () => (st.boss ? null : tug.start()), startRoast: sign => (st.boss ? null : roast.start(sign)), act: actView, tick, changes, snapshot, newNight, resetAll, pruneViewers, state: st, config: cfg };
}
