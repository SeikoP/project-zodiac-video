// Local server for Đêm Hội Hoàng Đạo (TikTok LIVE interactive overlay).
//   http://127.0.0.1:4848/          overlay (OBS / TikTok LIVE Studio browser source, 1080×1920)
//   http://127.0.0.1:4848/control   control panel for the host
// Binds to localhost only: the control API has no auth.
//
// Every FRAME_MS each page gets at most one "frame" message: the snapshot parts that changed since
// that page last heard (versioned by the game) plus the effects the director picked for this frame.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, emptyState, SIGNS } from './game.mjs';
import { createDirector } from './director.mjs';
import { buildQuizBank } from './quizbank.mjs';
import { POLLS } from './polls.mjs';
import { listMusic } from './music.mjs';
import { createTikTokBridge } from './tiktok.mjs';
import { createDiagnostics, ingest } from './diagnostics.mjs';
import { createMonitor } from './monitor.mjs';
import { PLANETS } from './sky.mjs';
import { ROLES } from './boss.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(dir, 'public');
const PORT = Number(process.env.PK_PORT || 4848);
const FRAME_MS = Number(process.env.PK_FRAME_MS) || 150; // how often changed parts are pushed to the overlay
const DATA = process.env.PK_DATA_DIR ?? path.join(dir, 'data'); // PK_DATA_DIR / PK_LOG_DIR let tests run on throwaway folders
const STATE_FILE = path.join(DATA, 'state.json');

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const config = readJson(path.join(dir, 'config.json'), {});
// ~200 generated questions from the sign data plus the hand-written trivia, in a fresh order each launch.
const quiz = buildQuizBank({ extra: readJson(path.join(dir, 'quiz.json'), []) });
const state = { ...emptyState(), ...readJson(STATE_FILE, {}) };
const SETTINGS_FILE = path.join(DATA, 'settings.json'); // the panel's switches survive a restart
const saved = readJson(SETTINGS_FILE, {});

let dirty = false;
const director = createDirector(config.limits);
// Background music: the channel's own licensed tracks (assets/music) unless musicDir says otherwise.
const MUSIC_DIR = path.resolve(dir, config.musicDir ?? '../../assets/music');
const music = listMusic({ dir: MUSIC_DIR, exclude: config.musicExclude, upbeat: config.musicUpbeat });
const monitor = createMonitor({ label: id => SIGNS.find(s => s.id === id)?.label ?? id });
const game = createGame({ config: { ...config, ...saved, show: { ...config.show, ...saved.show } }, state, quiz, polls: POLLS, onEvent: e => { director.push(e); monitor.note(e); dirty = true; } });
const tapped = monitor.tap(game); // everything a viewer does (TikTok or rehearsal) passes through here to be counted and logged
const recorded = createDiagnostics({ dir: process.env.PK_LOG_DIR ?? path.join(dir, 'logs'), record: Boolean(config.recordEvents || process.env.PK_RECORD) });
const diag = recorded;
if (diag.recording) console.log(`[diagnostics] recording events to ${diag.eventsFile}`);
const tiktok = createTikTokBridge({ game: diag.wrap(tapped), probe: diag.probe, onStatus: s => { monitor.system(`TikTok: ${s.state}${s.detail ? ` — ${s.detail}` : ''}`); broadcast('tiktok', s); } });
const meta = () => ({ signs: SIGNS, config: game.config, music: { calm: music.calm, upbeat: music.upbeat }, planets: PLANETS.map(({ id, label, glyph, boon, mult }) => ({ id, label, glyph, boon, mult })), roles: ROLES });

// A client is one open overlay/panel page: { send(event, data), seen, busy(), host }. Normally it is a server-sent-events
// stream; behind a quick tunnel (which does not stream SSE) the page polls /poll and gets its queued messages instead.
const clients = new Set();
const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
function broadcast(event, data, hostOnly = false) { for (const c of clients) if (c.host || !hostOnly) c.send(event, data); }
// Log lines and rates hold raw viewer names and comments, so only the host's own pages (not the shared overlay) get them.
setInterval(() => { const entries = monitor.drain(); if (entries.length) broadcast('log', { entries }, true); }, 500);
setInterval(() => broadcast('stats', { ...monitor.stats(), tiktok: tiktok.status() }, true), 2000);
const pollers = new Map(); // id -> client with a queue and the time of its last poll
setInterval(() => { for (const [id, c] of pollers) if (Date.now() - c.lastPoll > 15000) { pollers.delete(id); clients.delete(c); } }, 5000);

setInterval(() => {
  game.tick();
  const fx = director.flush();
  for (const c of clients) {
    if (c.busy()) continue; // slow page: skip, it catches up with the next frame's parts
    const parts = game.changes(c.seen);
    if (fx.length || Object.keys(parts).length) c.send('frame', { parts, fx });
  }
}, FRAME_MS);

// Persist off the hot path, at most every 10s; forget one-time visitors once a day.
let saving = false, lastPrune = 0;
setInterval(async () => {
  if (!dirty || saving) return;
  saving = true;
  dirty = false;
  if (Date.now() - lastPrune > 86400000) { game.pruneViewers(); lastPrune = Date.now(); }
  try {
    await fs.promises.mkdir(DATA, { recursive: true });
    await fs.promises.writeFile(`${STATE_FILE}.tmp`, JSON.stringify(game.state));
    await fs.promises.rename(`${STATE_FILE}.tmp`, STATE_FILE);
  } catch (e) { console.error('[save]', e.message); dirty = true; }
  saving = false;
}, 10000);

const TYPES = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const ROUTES = { '/': 'overlay.html', '/overlay': 'overlay.html', '/control': 'control.html', '/simulator': 'simulator/index.html' };

const body = req => new Promise(resolve => {
  let s = '';
  req.on('data', c => (s += c));
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
});

const GIFTS = [['Rose', 1], ['TikTok', 1], ['Finger Heart', 5], ['Doughnut', 30], ['Hand Hearts', 100], ['Galaxy', 1000]];
const SIM_LINES = ['xin quẻ', 'nhảy đi', 'ước thi đỗ', 'ước gặp được người thương', 'hay quá', '❤️❤️', 'cầu mong bình an', 'quẩy lên', 'nhận', 'thuận', 'khoe thẻ', 'đánh nó', 'chúc', 'chúc phúc nha', 'nâng cấp', 'kho', 'ước có người yêu thương mình'];
// every seventh rehearsal viewer is a fan club member, so the fan club look can be rehearsed too
const sim = name => {
  const nickname = String(name ?? 'Người xem').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 32) || 'Người xem';
  const n = Number(nickname.match(/\d+$/)?.[0]);
  return { userId: 'sim:' + nickname, nickname, ...(n && n % 7 === 0 ? { fanLevel: 3 + (n % 9), fanClub: 'Hội Sao' } : {}) };
};
const simulated = recorded.wrap(tapped);
function simulatorEvent(kind, data, mirror = true) {
  if (mirror && process.env.PK_SIMULATOR === '1') broadcast('sim-event', { kind, ...data }, true);
}
function simMember(user, mirror = true) {
  const fresh = simulated.member(user);
  if (fresh) simulatorEvent('member', { user }, mirror);
  return fresh;
}
function simChat(user, comment, mirror = true) {
  simulated.chat({ ...user, comment });
  simulatorEvent('chat', { user, comment }, mirror);
}
function simLike(user, count, mirror = true) {
  simulated.like({ ...user, count });
  simulatorEvent('like', { user, count }, mirror);
}
function simGift(user, gift, mirror = true) {
  simulated.gift({ ...user, ...gift });
  simulatorEvent('gift', { user, ...gift }, mirror);
}
function simSocial(user, kind, mirror = true) {
  simulated.social({ ...user, kind });
  simulatorEvent('social', { user, kind }, mirror);
}
// A crowd of simulated viewers doing typical things. Every event goes through the same
// monitor/diagnostics wrapper as a real viewer; stress mode suppresses per-event UI mirroring.
function simulateCrowd(size = 6, giftRate = 0.3, { mirror = true } = {}) {
  for (let i = 0; i < size; i++) {
    const user = sim(`fan${1 + Math.floor(Math.random() * Math.max(30, size * 3))}`);
    simMember(user, mirror);
    simChat(user, String(1 + Math.floor(Math.random() * 12)), mirror);
    if (Math.random() < 0.4) simChat(user, SIM_LINES[Math.floor(Math.random() * SIM_LINES.length)], mirror);
    simLike(user, Math.floor(Math.random() * 40), mirror);
    if (Math.random() < giftRate) {
      const [giftName, diamonds] = GIFTS[Math.floor(Math.random() ** 3 * GIFTS.length)];
      simGift(user, { diamonds, count: 1 + Math.floor(Math.random() * 3), giftName }, mirror);
    }
  }
}
let storm = null;
const API = {
  'night/new': () => {
    // keep a copy of the saved state before each new night (last 14 kept), so a bad night can be rolled back
    try {
      if (fs.existsSync(STATE_FILE)) {
        fs.copyFileSync(STATE_FILE, path.join(DATA, `backup-night-${game.state.night.no}.json`));
        const old = fs.readdirSync(DATA).filter(f => /^backup-night-\d+\.json$/.test(f)).sort((a, b) => parseInt(b.match(/\d+/)[0]) - parseInt(a.match(/\d+/)[0])).slice(14);
        for (const f of old) fs.unlinkSync(path.join(DATA, f));
      }
    } catch (e) { console.error('[backup]', e.message); }
    return game.newNight();
  },
  'poll/start': () => game.startPoll(),
  'music/skip': () => broadcast('cmd', { type: 'music-skip' }),
  'music/mute': () => broadcast('cmd', { type: 'music-mute' }),
  reset: () => game.resetAll(),
  'quiz/start': () => game.startQuiz(),
  'fortune/sign': b => game.showFortune({ userId: null, nickname: null, avatar: '', sign: b.sign }),
  'lucky/start': b => game.startLucky(b.sign),
  'boss/start': () => game.startBoss(),
  'chaos/start': () => game.startChaos(),
  'chaos/end': () => game.endChaos(false),
  'chest/open': () => game.openChest(),
  // giờ hành tinh: hold one hour for 60 minutes (or back to the real sky with no planet), start the headliner now
  'hour/set': b => game.forceHour(['mars', 'venus', 'mercury', 'saturn'].includes(b.planet) ? b.planet : null),
  'headline/start': () => game.startHead(),
  'run/start': () => game.startRun(),
  'run/stop': () => game.stopRun(),
  pair: () => game.makePair(),
  roast: b => game.startRoast(b.sign),
  'tug/start': () => game.startTug(),
  settings: b => {
    for (const k of ['autoQuiz', 'showWishText']) if (typeof b[k] === 'boolean') game.config[k] = b[k];
    for (const [k, v] of Object.entries(b.show ?? {})) if (k in game.config.show && typeof v === 'boolean') game.config.show[k] = v;
    broadcast('meta', meta());
    try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ autoQuiz: game.config.autoQuiz, showWishText: game.config.showWishText, show: game.config.show })); } catch (e) { console.error('[settings]', e.message); }
  },
  // Connecting to a real room drops any rehearsal viewers first.
  // Feed one recorded event (see npm run replay); same path as a real TikTok event.
  ingest: b => ingest(b.replay ? tapped : diag.wrap(tapped), b), // replayed events are not recorded a second time
  'tiktok/connect': b => {
    if (process.env.PK_SIMULATOR === '1') throw new Error('TikTok connection is disabled in the isolated simulator.');
    const n = game.purgeSim(); if (n) console.log(`[setup] removed ${n} rehearsal viewers`); return tiktok.connect(b.username);
  },
  'tiktok/disconnect': () => tiktok.disconnect(),
  // Simulated viewers, for rehearsing without going live. Don't use them while actually live.
  'sim/member': b => simMember(sim(b.user)),
  'sim/chat': b => { const user = sim(b.user); return simChat(user, String(b.comment ?? '').slice(0, 500)); },
  'sim/gift': b => { const user = sim(b.user); return simGift(user, { diamonds: Number(b.diamonds) || 1, count: Number(b.count) || 1, giftName: String(b.giftName || 'Rose').slice(0, 64) }); },
  'sim/like': b => { const user = sim(b.user); return simLike(user, Math.max(1, Math.min(10000, Number(b.count) || 15))); },
  'sim/social': b => { const user = sim(b.user); return simSocial(user, b.kind === 'share' ? 'share' : 'follow'); },
  'sim/crowd': b => simulateCrowd(Math.min(100, Math.max(1, Number(b.count) || 6)), Math.max(0, Math.min(1, Number(b.giftRate ?? 0.3)))),
  // Busy-room rehearsal: `perSecond` simulated viewers act every second until stopped.
  'sim/storm': b => {
    clearInterval(storm);
    storm = null;
    const perSecond = Math.min(2000, Math.max(0, Number(b.perSecond) || 0));
    if (perSecond) storm = setInterval(() => simulateCrowd(perSecond / 10, 0.05, { mirror: false }), 100);
    return { perSecond };
  },
};

function serveMusic(req, res, name) {
  const file = path.join(MUSIC_DIR, name);
  if (!file.startsWith(MUSIC_DIR + path.sep) || !fs.existsSync(file) || !/\.(mp3|ogg|wav|m4a)$/i.test(file)) return res.writeHead(404).end('not found');
  const size = fs.statSync(file).size, type = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' }[path.extname(file).toLowerCase()];
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (!m) { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'max-age=86400' }); return void fs.createReadStream(file).pipe(res); }
  const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start > end || start >= size) return res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
  res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
  fs.createReadStream(file, { start, end }).pipe(res);
}

function serveFile(res, file, root) {
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !type || !fs.existsSync(file)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': type, 'cache-control': file.includes(`${path.sep}mascots${path.sep}`) || file.includes(`${path.sep}fonts${path.sep}`) ? 'max-age=86400' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

// The panel and overlay are only ever opened at localhost. Refusing any other Host (DNS rebinding) or
// Origin (another website calling this API from the host's own browser) keeps the unauthenticated API private.
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const trusted = req => {
  if (!LOCAL.test(req.headers.host ?? '')) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return LOCAL.test(new URL(origin).host); } catch { return false; }
};
const decode = s => { try { return decodeURIComponent(s); } catch { return null; } };

// Two listeners share one handler. The main one (PORT) is the host's: panel + API, localhost only.
// The share one (SHARE_PORT) is for a tunnel (see npm run share): it serves just the overlay, read-only, so
// TikTok LIVE Studio's "link" source can load it from a public https address without exposing the API.
const SHARE_PORT = Number(process.env.PK_SHARE_PORT || 4849);
const HOST_ONLY = new Set(['/control', '/control.html', '/host-prompts.js', '/audit.js']);
const handler = shared => async (req, res) => {
  if (shared ? !['GET', 'HEAD'].includes(req.method) : !trusted(req)) return void res.writeHead(shared ? 405 : 403).end('forbidden');
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return void res.writeHead(400).end('bad request'); }
  if (shared && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/simulator') || HOST_ONLY.has(url.pathname))) return void res.writeHead(404).end('not found');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const client = { seen: {}, host: !shared, send: (event, data) => sse(res, event, data), busy: () => res.writableNeedDrain };
    if (client.host) client.send('log', { entries: monitor.all(), reset: true });
    client.send('meta', meta());
    client.send('tiktok', tiktok.status());
    client.send('frame', { parts: game.changes(client.seen), fx: [] });
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return;
  }
  if (url.pathname === '/poll') {
    // First call (no id) opens a session and returns the full state; later calls return what queued since.
    let id = url.searchParams.get('id'), c = pollers.get(id);
    if (!c) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const queue = [];
      c = {
        seen: {}, host: !shared, lastPoll: Date.now(), queue, wake: null, busy: () => queue.length > 400,
        send: (event, data) => {
          const last = queue.at(-1);
          // a page that is behind gets one merged frame instead of a backlog: newest parts win, effects keep their order
          if (event === 'frame' && last?.event === 'frame') { Object.assign(last.data.parts, data.parts); last.data.fx = last.data.fx.concat(data.fx); }
          else queue.push({ event, data });
          c.wake?.();
        },
      };
      if (c.host) c.send('log', { entries: monitor.all(), reset: true });
      pollers.set(id, c);
      clients.add(c);
      c.send('meta', meta());
      c.send('tiktok', tiktok.status());
      c.send('frame', { parts: game.changes(c.seen), fx: [] });
    }
    c.lastPoll = Date.now();
    // Long poll: hold the request until something is queued (or ~8s), so a message goes out the moment it exists
    // instead of waiting for the page's next poll. Pages that don't ask (no `wait`) get the old immediate answer.
    if (url.searchParams.has('wait') && !c.queue.length) {
      await new Promise(done => {
        const timer = setTimeout(done, 8000);
        c.wake = () => { clearTimeout(timer); done(); };
        req.on('close', c.wake);
      });
      c.wake = null;
      c.lastPoll = Date.now();
    }
    const msgs = c.queue.splice(0);
    return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ id, msgs }));
  }
  const api = url.pathname.startsWith('/api/') && Object.hasOwn(API, url.pathname.slice(5)) && API[url.pathname.slice(5)];
  if (api && req.method === 'POST') {
    try {
      const result = await api(await body(req));
      dirty = true;
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: result ?? null }));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
    }
    return;
  }
  const route = ROUTES[url.pathname], decoded = decode(url.pathname.startsWith('/music/') ? url.pathname.slice(7) : url.pathname);
  if (decoded === null) return void res.writeHead(400).end('bad request');
  if (url.pathname.startsWith('/music/')) return serveMusic(req, res, decoded);
  serveFile(res, path.join(PUBLIC, route ?? decoded), PUBLIC);
};

http.createServer(handler(false)).listen(PORT, '127.0.0.1', () => {
  console.log(`Đêm Hội Hoàng Đạo running:\n  overlay  http://127.0.0.1:${PORT}/\n  control  http://127.0.0.1:${PORT}/control`);
  if (config.tiktokUsername && !process.env.PK_NO_TIKTOK) { game.purgeSim(); tiktok.connect(config.tiktokUsername); }
});
// Read-only copy of the overlay for a tunnel; still bound to localhost, the tunnel client connects from this machine.
http.createServer(handler(true)).listen(SHARE_PORT, '127.0.0.1', () => console.log(`  chia sẻ overlay (chỉ xem, cho tunnel)  http://127.0.0.1:${SHARE_PORT}/`))
  .on('error', e => console.error(`[share] không mở được cổng ${SHARE_PORT}: ${e.message}`));
