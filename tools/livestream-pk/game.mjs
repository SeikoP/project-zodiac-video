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
import { cleanName, safeAvatar } from './names.mjs';
import { occasionOn } from './public/occasions.js';
import { readSky as readRealSky, boonFor, BOON_CAP } from './sky.mjs';
import { signOfDate, parseBirthDate, birthChart, readChart } from './birth.mjs';
import { createHours } from './hours.mjs';
import { HOURS, HOUR_PLANETS, THEME_OF, HEADS, HEAD_QUEST, headAt, hourEdition, pairing } from './hours-table.mjs';
import { createRun, RUN_DEFAULTS } from './run.mjs';
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
const SIGN = Object.fromEntries(SIGNS.map(s => [s.id, s]));
const OPPOSITE = Object.fromEntries(SIGNS.map((s, i) => [s.id, SIGNS[(i + 6) % 12].id]));
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
  // a small room gets smaller goals: wheel and moon scale with the viewers on stage (floor .2, full at 12)
  adaptiveCrowd: true,
  crowdFloor: 0.2,
  crowdFull: 12,
  // a room that fills up mid-round raises the goals it set while small: every crowdRetuneSeconds, up to ×crowdRetuneStep, never down (0 = off)
  crowdRetuneSeconds: 30,
  crowdRetuneStep: 1.25,
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
  ...ALTAR_DEFAULTS,
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
  // "bầu trời ngày sinh": a birthday comment shows that day's real sky (once per viewer per cooldown)
  birthSky: true,
  birthCooldownSeconds: 600,
  // every viewer who picks a sign gets a star with their name on the community sky (kept across nights)
  starsShown: 90,
  // a big moment at least this often while people are around (star roll call, someone's birth sky, a meteor shower); 0 = off
  showEverySeconds: 75,
  // giờ hành tinh: themed hours (hourPlanets: Hỏa, Kim for now) take turns, hourMinutes each ("cycle"), or follow the
  // real planetary hours ("real"). Each allows only some automatic events, has its own starlight rule and 2–3
  // headliners taking turns act by act (hours-table.mjs). false = everything always on, as before.
  hours: true,
  hourMode: 'cycle',
  hourMinutes: 5, // in "cycle" mode each planet's turn lasts this long (one act per turn)
  hourPlanets: HOUR_PLANETS, // the planets in the rotation; more join by adding them here
  skyPlace: { lat: 10.82, lon: 106.63, tz: 7 }, // where sunrise and sunset are computed (TP.HCM)
  eliteHpFactor: 1.8,
  pairEverySeconds: 25,
  pairLight: 10,
  quizChainLength: 5,
  ...RUN_DEFAULTS,
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
const FIX_RE = /\b(thuan hanh|sua song)\b|^\s*thuan\b/;
const UPGRADE_RE = /\b(nang cap|len cap|len lv|up lv)\b/;
const COMBINE_RE = /\bghep the\b/;
const VAULT_RE = /^\s*(kho|tui|tui do|xem kho|kho do|khoe|khoe kho|so sao|xem so sao|so sao cua toi)[\s!.]*$|\b(khoe the|bo the|xem the)\b/;
const GEM_POWER_RE = /^\s*(tung ngoc|nem ngoc|dung ngoc)\b/;
const MOON_POWER_RE = /^\s*(thap trang|dot trang)\b/;
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
  if (FIX_RE.test(t)) return 'fix';
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
    chaos: null, // Thủy Nghịch: { endsAt, need, fixers: { userId: nickname }, real }
    nextChaosAt: 0,
    boss: null, // see boss.mjs
    nextBossAt: 0,
    chest: { no: 0, openUntil: 0, claimed: {}, recent: [] },
    welcomes: [], // newcomers' stars the room can greet, newest first: { id, userId, nickname, avatar, at, greeters: { userId: nickname }, done }
    wishes: [], // the last few wishes, newest first: { id, userId, nickname, avatar, sign, text, at, blessers: { userId: nickname }, blessed }
    wishNo: 0,
    // the hours, acts and headliners, and what is playing right now (null when nothing is)
    hourForce: null, hourAnnounced: null, act: { key: null, phase: null, light: {} }, head: null, quest: null,
    run: null, runMeta: null, roast: null, tug: null, predict: null, nextShowAt: 0, showNo: 0,
  };
}

// readSky(t) gives the real sky (sky.mjs); tests pass their own, or null for none.
export function createGame({ config = {}, state = emptyState(), quiz = [], polls = [], now = () => Date.now(), rng = Math.random, onEvent = () => {}, readSky = readRealSky } = {}) {
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
    st.moon.light += amount * (cfg.skyBoons && sky?.moon.full ? 2 : 1) * (st.head?.id === 'moonnight' ? 2 : 1);
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
    if (st.chaos || st.boss || st.run || st.tug) return null;
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
    const b = st.chaos || st.run || st.tug ? null : boss.start(Math.max(3, stage.size));
    if (b) bossWas = true;
    return b;
  }

  // Sky editions a chest can drop right now: Thủy Nghịch during the chaos or a real retrograde, Trăng Tròn on a real full moon.
  const cards = createCards({ st, cfg, now, rng, onEvent, signs: SIGNS.map(s => s.id), specials: () => [...(st.chaos || sky?.mercuryRetro ? ['retro'] : []), ...(sky?.moon.full ? ['fullmoon'] : [])], hourEdition: () => hourEdition(hour?.planet, rng()) });
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
  const FIGHTS = [['boss', () => st.boss], ['tug', () => st.tug], ['run', () => st.run?.phase?.kind === 'fight']];
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
    else run.hit(u, v, 'gift', cfg.gemPowerDiamonds);
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

  // --- Hành trình Tầng Trời: the roguelike run (run.mjs) ----------------------------------------------
  const run = createRun({
    st, cfg, now, dayKey: () => dayKey(now()),
    onEvent: e => { if (e.type === 'run-won') questAdd('floors'); onEvent(e); },
    present: () => [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign),
    gem: (id, v, n) => gem({ userId: id }, v, n, 'run'),
    reward: (id, floors, cleared) => {
      const v = st.viewers[id];
      if (!v) return;
      v.runBest = Math.max(v.runBest ?? 0, floors);
      if (floors) shine({ userId: id }, v, cfg.runLightPerFloor * floors, 'run');
      if (cleared) bag.add({ userId: id }, v, 'moon', 1, 'run');
    },
  });

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
  listen = e => {
    bingo.note(e);
    // predictions open before a big outcome and settle when it is known
    if (e.type === 'tug-start') predict.open({ key: 'tug', q: `${label(e.a)} hay ${label(e.b)} thắng kéo co?`, options: [label(e.a), label(e.b)], closesAt: now() + e.warmup * 1000 });
    else if (e.type === 'tug-end') predict.resolve('tug', e.winner === e.a ? 0 : e.winner === e.b ? 1 : null);
    else if (e.type === 'run-start') predict.open({ key: 'run', q: 'Đoàn có vượt qua tầng 3?', options: ['Có', 'Không'], closesAt: now() + 25000 });
    else if (e.type === 'run-end') predict.resolve('run', e.cleared || e.floors >= 3 ? 0 : 1);
    else if (e.type === 'head-start' && e.id === 'elite') predict.open({ key: 'elite', q: 'Cả phòng hạ được Boss tinh anh?', options: ['Hạ được', 'Nó trốn thoát'], closesAt: now() + 20000 });
    else if (e.type === 'boss-defeated') predict.resolve('elite', 0);
    else if (e.type === 'boss-escaped') predict.resolve('elite', 1);
  };
  // a patron's star: lifetime gifts (xu) make the giver's star in the community sky bigger and golden
  const patronTier = v => { const g = v.giftTotal ?? 0; return g >= 1000 ? 3 : g >= 100 ? 2 : g >= 10 ? 1 : 0; };

  // --- giờ hành tinh: which automatic events may start, the starlight rule, the acts and their headliners -----
  const hourCalc = createHours(cfg.skyPlace);
  const baseChest = cfg.chestEveryMinutes;
  const themed = p => (HOURS[p] ? p : THEME_OF[p] ?? cfg.hourPlanets[0]); // a planet without a theme yet borrows one
  const nextTheme = p => cfg.hourPlanets[(cfg.hourPlanets.indexOf(p) + 1) % cfg.hourPlanets.length];
  function hourNow() {
    const t = now(), f = st.hourForce;
    if (f && t < f.endsAt && HOURS[f.planet]) return { planet: f.planet, startsAt: f.startsAt, endsAt: f.endsAt, next: nextTheme(f.planet), forced: true };
    const h = cfg.hourMode === 'real' ? hourCalc.real(t) : hourCalc.cycle(t, cfg.hourPlanets, cfg.hourMinutes * 60000);
    return { ...h, planet: themed(h.planet), next: themed(h.next) };
  }
  let hour = cfg.hours ? hourNow() : null;
  const H = () => (hour ? HOURS[hour.planet] : null);
  const allow = kind => !hour || Boolean(H().allow[kind]);
  const HOUR_ACTIONS = new Set(['comment', 'like', 'gift', 'follow', 'share', 'quiz', 'poll', 'fortune']);
  const hourMult = kind => { const r = H()?.rules; return r ? r[kind] ?? (HOUR_ACTIONS.has(kind) ? r.all ?? 1 : 1) : 1; };
  const luckyEvery = () => (H()?.luckyEvery ?? cfg.luckyEverySeconds) * 1000;
  function applyHour() {
    cfg.chestEveryMinutes = H()?.chestEvery ?? baseChest;
    touch('cosmos', 'hud');
  }
  if (hour) applyHour();
  function refreshHour() {
    hour = cfg.hours ? hourNow() : null;
    applyHour();
    if (!hour) return;
    const a = st.hourAnnounced;
    if (a?.planet === hour.planet && a?.startsAt === hour.startsAt) return;
    st.hourAnnounced = { planet: hour.planet, startsAt: hour.startsAt };
    if (stage.size || lobby.size) onEvent({ type: 'hour-start', ...hourView() });
  }
  function hourView() {
    if (!hour) return null;
    const h = H(), n = HOURS[hour.next];
    return { planet: hour.planet, label: h.label, glyph: h.glyph, color: h.color, theme: h.theme, mood: h.mood, rule: h.ruleText, head: HEADS[currentHead()].label, heads: h.heads.map(id => HEADS[id].label), startsAt: hour.startsAt, endsAt: hour.endsAt, forced: Boolean(hour.forced),
      next: { planet: hour.next, label: n.label, glyph: n.glyph, head: HEADS[n.heads[0]].label } };
  }
  function forceHour(planet) {
    const t = now();
    st.hourForce = planet ? { planet, startsAt: t, endsAt: t + 3600000 } : null;
    refreshHour();
    return hourView();
  }

  // Acts: 10 minutes each (:00/:10/:20…). Minute 0 opens, the hour's headliner plays from headAt to CLOSE_AT,
  // the last minutes close the act with its MVP (most starlight earned in the act).
  // a planet's turn of 5 minutes is one act; longer hours are cut into acts of at most 10 minutes
  const slotMin = cfg.hourMode === 'cycle' ? cfg.hourMinutes : 60, ACT_MIN = Math.min(10, slotMin);
  const ACT = ACT_MIN * 60000, CLOSE_AT = ACT_MIN * 0.85;
  st.act ??= { key: null, phase: null, light: {} };
  const minuteInAct = t => (t % ACT) / 60000;
  // the act's place in its hour (0-based) picks this act's headliner from the hour's list, in turn
  // (ceil: an act that began just before an unaligned real hour still counts as that hour's first)
  // when a planet's turn is a single act, the headliner moves on each time the planet comes round again
  const visits = () => (hour && !hour.forced && cfg.hourMode === 'cycle' ? Math.floor(Math.floor(hour.startsAt / (cfg.hourMinutes * 60000)) / cfg.hourPlanets.length) * Math.max(1, Math.round((hour.endsAt - hour.startsAt) / ACT)) : 0);
  const actIndex = (t = now()) => (hour ? visits() + Math.max(0, Math.ceil((Math.floor(t / ACT) * ACT - hour.startsAt) / ACT)) : 0);
  const currentHead = (t = now()) => { const heads = H()?.heads ?? []; return heads[actIndex(t) % heads.length]; };
  const roomLive = () => stage.size > 0 && now() - st.lastActivityAt < 600000;
  function actTick(t) {
    if (!hour) return;
    const key = Math.floor(t / ACT), m = minuteInAct(t), h = H();
    const phase = m < 1 ? 'open' : m < headAt(currentHead(t), ACT_MIN) ? 'play' : m < CLOSE_AT ? 'head' : 'close';
    if (key !== st.act.key) {
      st.act = { key, phase: null, light: {} };
      if (roomLive() && !st.run) onEvent({ type: 'act-open', ...actView(), hour: hourView() });
    }
    // the headliner waits (and retries every tick) while a quiz, poll or reading is open, so they never overlap
    if (phase === 'head' && !st.act.headDone && roomLive() && !st.quiz && !st.poll && !st.fortune && startHead()) st.act.headDone = true;
    if (phase === st.act.phase) return;
    st.act.phase = phase;
    touch('cosmos');
    if (phase === 'close') { endHead(); if (roomLive() && !st.run) actClose(); }
  }
  function actView() {
    if (!hour) return null;
    const t = now(), key = Math.floor(t / ACT);
    const head = currentHead(t);
    return { no: actIndex(t) + 1, of: Math.max(1, Math.round((hour.endsAt - hour.startsAt) / ACT)), phase: st.act.phase, head, headLabel: HEADS[head].label, headInMs: Math.max(0, key * ACT + headAt(head, ACT_MIN) * 60000 - t), endsInMs: (key + 1) * ACT - t };
  }
  function actClose() {
    const top = Object.entries(st.act.light).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([id]) => st.viewers[id]);
    const nextAt = (Math.floor(now() / ACT) + 1) * ACT, nextHour = nextAt >= hour.endsAt;
    const nx = nextHour ? HOURS[hour.next] : H(), nextHead = nextHour ? nx.heads[0] : currentHead(nextAt);
    // the act's MVP takes home this hour's card
    const mvp = top[0] && st.viewers[top[0][0]];
    if (mvp?.sign) cards.give({ userId: top[0][0] }, mvp, `${mvp.sign}:${hourEdition(hour.planet, rng())}`, 'mvp');
    onEvent({ type: 'act-close', top: top.map(([id, light]) => ({ userId: id, nickname: st.viewers[id].nickname, avatar: st.viewers[id].avatar, sign: st.viewers[id].sign, light })),
      next: { planet: nextHour ? hour.next : hour.planet, label: nx.label, glyph: nx.glyph, head: HEADS[nextHead].label, newHour: nextHour } });
  }

  // Headliners: the hour's list in turn, one per act, from headAt() to CLOSE_AT. The host can start one any time.
  function startHead(id = currentHead()) {
    if (!id || !HEADS[id] || st.head || st.boss || st.chaos || st.run || st.roast || st.tug) return null;
    const t = now(), m = minuteInAct(t);
    const endsAt = t + Math.max(90000, (m < CLOSE_AT && hour ? CLOSE_AT - m : 3) * 60000);
    st.head = { id, startedAt: t, endsAt };
    if (id === 'elite') {
      if (!boss.start(Math.round(Math.max(3, stage.size) * cfg.eliteHpFactor))) { st.head = null; return null; }
      st.boss.elite = true;
    } else if (id === 'matchmaking') st.head.nextAt = t + 4000;
    else if (id === 'quizchain') Object.assign(st.head, { left: cfg.quizChainLength, nextAt: t + 2000, streaks: {}, best: null, inQuiz: false });
    else if (id === 'moonnight') { st.head.nextAt = t + 40000; showFortune({ userId: null, nickname: null, avatar: '', sign: pickEventSign() }); }
    else if (id === 'final') Object.assign(st.head, { base: { ...st.wheel.given }, wheel: st.wheel.no });
    else if (id === 'chestrain') { cards.openNow(); st.head.chests = [t + 60000, t + 120000]; }
    else if (id === 'run') { if (!run.start()) { st.head = null; return null; } }
    else if (id === 'roast') { if (!roast.start()) { st.head = null; return null; } }
    else if (id === 'chaos') { if (!startChaos()) { st.head = null; return null; } }
    else if (id === 'tug') { if (!tug.start()) { st.head = null; return null; } }
    touch('cosmos');
    onEvent({ type: 'head-start', id, label: HEADS[id].label, planet: hour?.planet ?? null, seconds: Math.round((endsAt - t) / 1000) });
    return st.head;
  }
  function headTick(t) {
    const h = st.head;
    if (!h) return;
    // these play to their own end
    if (h.id === 'run' || h.id === 'roast' || h.id === 'chaos' || h.id === 'tug') { if (!st[h.id]) endHead(); return; }
    if (t >= h.endsAt && !(h.id === 'quizchain' && st.quiz)) return endHead();
    if (h.id === 'matchmaking' && t >= h.nextAt) { h.nextAt = t + cfg.pairEverySeconds * 1000; makePair(); }
    if (h.id === 'quizchain') {
      if (h.inQuiz && !st.quiz) { h.inQuiz = false; h.nextAt = t + 3500; }
      if (!st.quiz && !st.poll && h.left > 0 && t >= h.nextAt && startQuiz()) { h.left--; h.inQuiz = true; }
    }
    if (h.id === 'moonnight' && t >= h.nextAt) { h.nextAt = t + 40000; runShow('birth'); }
    if (h.id === 'chestrain' && h.chests.length && t >= h.chests[0]) { h.chests.shift(); cards.openNow(); }
  }
  function endHead() {
    const h = st.head;
    if (!h || (['run', 'roast', 'chaos', 'tug'].includes(h.id) && st[h.id])) return;
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

  // Ghép đôi định mệnh: two viewers on stage, a compatibility score from their elements, a little starlight for both.
  function makePair() {
    const list = [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign);
    if (list.length < 2) return null;
    const i = Math.floor(rng() * list.length);
    let j = Math.floor(rng() * (list.length - 1));
    if (j >= i) j++;
    const [[ia, a], [ib, b]] = [list[i], list[j]];
    const salt = [...`${ia}|${ib}`].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);
    const { score, line } = pairing(SIGN[a.sign].element, SIGN[b.sign].element, salt);
    shine({ userId: ia }, a, cfg.pairLight, 'pair');
    shine({ userId: ib }, b, cfg.pairLight, 'pair');
    const who = (id, v) => ({ userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign });
    onEvent({ type: 'pair', a: who(ia, a), b: who(ib, b), score, line });
    return { score };
  }

  // Nhiệm vụ giờ: one goal per hour the whole room reaches just by taking part (comments, blessings, right answers,
  // hearts, starlight, cards, floors — never gifts). Everyone on stage shares the reward.
  function questTick() {
    const q = (hour && HEAD_QUEST[currentHead()]) || H()?.quest, key = hour && `${hour.planet}@${hour.startsAt}`;
    if (!q || st.quest?.key === key) return;
    const { stat, unit, reward, rewardText } = q;
    st.quest = { key, stat, unit, reward, rewardText, goal: Math.max(1, Math.round(q.base + q.per * Math.max(1, stage.size))), got: 0, done: false };
    touch('cosmos');
  }
  function questAdd(stat, n = 1) {
    const q = st.quest;
    if (!q || q.done || q.stat !== stat || !(n > 0) || q.key !== (hour && `${hour.planet}@${hour.startsAt}`)) return;
    q.got = Math.min(q.goal, q.got + n);
    touch('cosmos');
    if (q.got < q.goal) return;
    q.done = true;
    const h = H(), people = [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v?.sign);
    for (const [id, v] of people) {
      const u = { userId: id };
      if (q.reward === 'gem') gem(u, v, 1, 'quest');
      else if (q.reward === 'dust') bag.add(u, v, 'dust', 10, 'quest');
      else if (q.reward === 'moon') bag.add(u, v, 'moon', 1, 'quest');
      else shine(u, v, 20, 'quest');
    }
    onEvent({ type: 'quest-done', planet: hour.planet, glyph: h.glyph, color: h.color, goal: q.goal, unit: q.unit, reward: q.rewardText, people: people.length });
  }
  const questView = () => {
    const q = st.quest, h = H();
    return q && h?.quest && q.key === `${hour.planet}@${hour.startsAt}` ? { got: q.got, goal: q.goal, done: q.done, unit: q.unit ?? h.quest.unit, reward: q.rewardText ?? h.quest.rewardText, glyph: h.glyph, color: h.color } : null;
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
    const boon = cfg.skyBoons ? boonFor(sky, v.sign, kind) : { mult: 1, by: [] };
    const sky_ = Math.min(BOON_CAP, boon.mult * hourMult(kind)); // the real sky and the hour's rule share one cap
    const amount = Math.round(base * (partying() ? cfg.partyMultiplier : 1) * (st.lucky?.sign === v.sign ? cfg.luckyMultiplier : 1) * sky_ * bag.bonus(v) * heatMult() * fanMult(v));
    if (st.act) st.act.light[u.userId] = (st.act.light[u.userId] ?? 0) + amount;
    if (kind !== 'quest') questAdd('light', amount);
    pass.addXp(u, v, amount);
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
    if (st.run && run.chat(u, v, norm(u.comment))) { addHeat(u.userId, 1); return; } // A/B/C while the party votes
    if (st.roast) roast.chat(u, v, norm(u.comment)); // "oan!" / "chuẩn!" while a sign is being roasted
    if (st.predict && predict.chat(u, v, norm(u.comment))) { addHeat(u.userId, 1); return; } // "đoán A"
    const sign = parseSign(u.comment);
    // While a poll runs, naming a sign is a vote; it only joins a team for viewers who have none yet.
    if (st.poll && sign && !st.poll.voted[u.userId]) castVote(u, v, sign);
    addHeat(u.userId, 1);
    if (!v.sign) { if (sign) join(u, v, sign); }
    else if (!st.poll) switchSign(u, v, parseSwitch(u.comment));
    // a short comment that is a birthday ("12/8", "12/8/1998") also opens that day's sky
    if (cfg.birthSky && String(u.comment ?? '').length <= 32) { const bd = parseBirthDate(u.comment); if (bd) revealBirth(u, v, bd); }
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
    else if (action === 'fix') fixChaos(u, v);
    else if (action === 'bingo') bingo.show(u, v);
    boss.hit(u, v, 'comment');
    run.hit(u, v, 'comment');
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

  // The sky on the day the viewer was born. The year (when given) only feeds the computation: neither the event
  // nor the saved state carries it, just the signs the planets stood in.
  function revealBirth(u, v, bd) {
    const key = `${bd.day}/${bd.month}/${bd.year ? 'y' : ''}`;
    if (v.birthKey === key && now() - (v.birthAt ?? 0) < cfg.birthCooldownSeconds * 1000) return;
    v.birthKey = key;
    v.birthAt = now();
    const chart = birthChart(bd);
    if (chart.full) { v.chart = chart.planets; touch('cosmos'); }
    onEvent(birthEvent(u.userId, v, chart.full ? chart.planets : v.chart ?? chart.planets, false));
  }
  const birthEvent = (userId, v, planets, replay) => {
    const full = planets.length > 1, sun = planets.find(p => p.id === 'sun').sign;
    return { type: 'birth-sky', userId, nickname: v.nickname, avatar: v.avatar, sign: v.sign ?? sun, sun, planets, full, lines: readChart({ planets, full }), replay };
  };

  // --- the big moment every ~75 s: a roll call of tonight's stars, someone's birth sky, or a meteor shower ----
  st.nextShowAt ||= now() + (cfg.showEverySeconds || 0) * 1000;
  const presentWith = test => [...stage.keys()].map(id => [id, st.viewers[id]]).filter(([, v]) => v && test(v));
  // the hour picks the kinds (in turn); a kind that can't run right now falls back to one that can
  function showKind(want) {
    const kinds = H()?.shows ?? ['starcall', 'birth'];
    const k = want ?? kinds[(st.showNo ?? 0) % kinds.length];
    if (k === 'birth') return presentWith(v => v.chart).length ? 'birth' : 'meteor';
    if (k === 'pair') return presentWith(v => v.sign).length >= 2 ? 'pair' : 'starcall';
    if (k === 'roast') return presentWith(v => v.sign).length ? 'roast' : 'starcall';
    return k;
  }
  const nextShowKind = () => showKind();
  function runShow(want) {
    const kind = showKind(want);
    if (!want) st.showNo = (st.showNo ?? 0) + 1;
    st.nextShowAt = now() + cfg.showEverySeconds * 1000;
    touch('cosmos');
    if (kind === 'birth') {
      const list = presentWith(v => v.chart), [id, v] = list[Math.floor(rng() * list.length)];
      return onEvent(birthEvent(id, v, v.chart, true));
    }
    if (kind === 'pair') return makePair();
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
    run.hit(u, v, 'gift', diamonds);
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
    run.hit(u, v, 'like', n);
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
    run.hit(u, v, kind);
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
    if (st.moon.partyUntil && t >= st.moon.partyUntil) {
      st.moon.partyUntil = 0;
      touch('hud');
      onEvent({ type: 'moon-end' });
    }
    // Lucky star: starts on a timer while people are around; the countdown is published once a second
    // (every 10s while waiting), not on every tick.
    if (hour && (t >= hour.endsAt || (st.hourForce && t >= st.hourForce.endsAt && hour.forced))) { if (st.hourForce && t >= st.hourForce.endsAt) st.hourForce = null; refreshHour(); }
    else if (hour && !st.hourAnnounced) refreshHour();
    if (st.lucky) { if (t >= st.lucky.endsAt) endLucky(); }
    else if (t >= st.nextLuckyAt && t - st.lastActivityAt < 60000) { if (allow('lucky')) startLucky(); else st.nextLuckyAt = t + luckyEvery(); }
    const luckyTick = st.lucky ? Math.ceil((st.lucky.endsAt - t) / 1000) : 1000 + Math.ceil((st.nextLuckyAt - t) / 10000);
    if (luckyTick !== lastLuckyTick) { lastLuckyTick = luckyTick; touch('hud'); }
    if (st.poll && t >= st.poll.endsAt) endPoll();
    // The real sky, Thủy Nghịch, the boss (they never overlap) and the chest. Readings wait while the boss is up.
    if (t - skyAt >= 60000) refreshSky();
    const active = t - st.lastActivityAt < 60000, busy = st.quiz || st.poll || st.fortune;
    // the hour's acts and headliner; the run (if one is on) plays before anything else may start
    actTick(t);
    questTick();
    run.tick();
    roast.tick();
    tug.tick();
    predict.tick();
    headTick(t);
    const playing = st.run || st.head || st.roast || st.tug;
    if (st.chaos && t >= st.chaos.endsAt) endChaos(false);
    else if (!st.chaos && !st.boss && t >= st.nextChaosAt) { if (active && stage.size && allow('chaos') && !playing) startChaos(); else scheduleChaos(); }
    // bossWas spans ticks: a boss beaten by a gift ends between two ticks, not inside boss.tick()
    const hadBoss = bossWas;
    boss.tick();
    bossWas = Boolean(st.boss);
    if (hadBoss && !st.boss) st.nextBossAt = cfg.bossEverySeconds ? t + cfg.bossEverySeconds * 1000 : Infinity;
    if (!st.boss && !st.chaos && !busy && active && stage.size && t >= st.nextBossAt) { if (allow('boss') && !playing) startBoss(); else st.nextBossAt = t + 60000; }
    if (cfg.showEverySeconds && t >= st.nextShowAt) {
      // the boss, Thủy Nghịch, readings, the run and a headliner are big moments already: the show waits behind them.
      // A quiet room still gets it (that is when a newcomer needs something to watch), just not an abandoned one.
      if (!st.boss && !st.chaos && !busy && !playing && t - st.lastActivityAt < 600000 && stage.size) runShow();
      else { st.nextShowAt = t + 15000; touch('cosmos'); }
    }
    if (st.boss || hadBoss || st.run) touch('cosmos');
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
      // 3× a house mascot shows a command, 3× a sign's reading, 1× quiz, 1× poll — whichever of those the hour allows
      let kind = (cfg.demoTurns ? [3, 1, 3, 0, 1, 3, 1, 2] : [1, 1, 1, 0, 1, 1, 1, 2])[turn % 8];
      const ok = k => k === 3 ? cfg.demoTurns : allow(['quiz', 'reading', 'poll'][k]);
      if (!ok(kind)) kind = [1, 0, 2, 3].find(ok) ?? -1;
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
      return { userId: id, nickname: v.nickname, avatar: v.avatar, sign: v.sign, title: titleOf(v.lifetime), streak: v.streak ?? 0, crowns: v.crowns ?? 0, level: v.level ?? 1, fan: v.fanLevel ?? 0, sub: Boolean(v.subscriber),
        aura: (v.auraUntil ?? 0) > now() ? v.auraUntil : 0, frame: pass.frameOf(v) };
    }),
    thanks: () => st.thanks.map(({ nickname, avatar, sign }) => ({ nickname, avatar, sign })),
    gifts: () => {
      const g = st.gifts;
      return { count: g.count, diamonds: g.diamonds, top: g.top, goal: { sum: g.goalSum, goal: giftGoal(), no: g.goalNo }, recent: g.recent.map(({ nickname, avatar, giftName, giftImage, count }) => ({ nickname, avatar, giftName, giftImage, count })) };
    },
    // the real sky (planets, moon phase, retrograde), Thủy Nghịch, the boss and the star chest
    cosmos: () => {
      const t = now(), c = st.chaos;
      const fansHere = [];
      for (const id of stage.keys()) { const v = st.viewers[id]; if (v?.fanLevel || v?.subscriber) fansHere.push(v); }
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
        welcomes: st.welcomes.filter(w => !w.done && t - w.at < cfg.welcomeWindowSeconds * 1000).slice(0, 3).map(w => ({ id: w.id, nickname: w.nickname, greetings: Object.keys(w.greeters).length })),
        welcomeNeed: cfg.welcomeNeed,
        heat: { level: heat.level, score: heatScore(), levels: cfg.heatLevels, multiplier: heatMult() },
        fans: fansHere.sort((a, b) => (b.fanLevel ?? 0) - (a.fanLevel ?? 0)).slice(0, 3).map(v => ({ nickname: v.nickname, avatar: v.avatar, level: v.fanLevel ?? 0 })),
        fanCount: fansHere.length,
        show: cfg.showEverySeconds ? { inMs: Math.max(0, st.nextShowAt - t), kind: nextShowKind() } : null,
        hour: hourView(),
        act: actView(),
        head: st.head && { id: st.head.id, label: HEADS[st.head.id].label, remainingMs: Math.max(0, st.head.endsAt - t), left: st.head.left ?? null },
        run: run.view(),
        quest: questView(),
        roast: roast.view(),
        tug: tug.view(),
        predict: predict.view(),
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
    const cosmosTimers = st.chaos || st.boss || cards.isOpen() || st.run || st.head || st.roast || st.tug || st.predict;
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
    scheduleChaos();
    touch('hud', 'race', 'sky', 'stage', 'thanks', 'lobby', 'gifts', 'cosmos', 'stars');
    onEvent({ type: 'reset' });
  }

  // Keeps the saved state small in long-running channels: forget one-time visitors after a while.
  function pruneViewers(days = 45) {
    const cutoff = now() - days * 86400000;
    for (const [id, v] of Object.entries(st.viewers)) if (v.lastSeenAt < cutoff && v.lifetime < 100 && !stage.has(id)) delete st.viewers[id];
  }

  return { startPoll, endPoll, chat, member, gift, like, social, startLucky, endLucky, startQuiz, endQuiz, showFortune, startBoss, startChaos, endChaos, openChest: cards.openNow, forceHour, startHead, makePair, startRun: () => (st.boss || st.chaos || st.tug ? null : run.start()), startTug: () => (st.boss || st.chaos || st.run ? null : tug.start()), startRoast: sign => (st.boss || st.chaos || st.run ? null : roast.start(sign)), stopRun: () => run.stop(), hour: hourView, tick, changes, snapshot, newNight, resetAll, pruneViewers, sky: () => sky, state: st, config: cfg };
}
