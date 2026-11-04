// Vườn Mây server (npm run garden). Separate port and save file; TikTok events use the shared connector.
//   http://127.0.0.1:4858/   overlay for TikTok LIVE Studio (1080×1920) and the local host panel
// Every FRAME_MS each page gets the plots that changed since it last heard, the merged effects, and any new camera shot.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGarden } from './garden.mjs';
import { createCamera } from './camera.mjs';
import { createCoalescer } from './fx.mjs';
import { EVENT_TYPES } from './events.mjs';
import { createHub } from './hub.mjs';
import { createSaver, loadState, pruneUsers } from './store.mjs';
import { emptyGardenState, TIERS } from './world.mjs';
import { listMusic } from '../music.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(root, 'public');
const MUSIC_DIR = path.resolve(root, '../../assets/music');
const FRAME_MS = Number(process.env.PK_FRAME_MS) || 150;
const TYPES = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

const trusted = req => {
  const ip = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return false;
  if (req.headers.host && !LOCAL.test(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return LOCAL.test(new URL(origin).host); } catch { return false; }
};
const readBody = req => new Promise(resolve => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
});

export async function startGardenServer({ port = Number(process.env.PK_GARDEN_PORT || 4858), dir = process.env.PK_DATA_DIR ?? path.join(root, 'data'), config, tiktok = !process.env.PK_NO_TIKTOK, simulator = false, now = Date.now, log = console.log } = {}) {
  const full = config ?? readJson(path.join(root, 'config.json'), {});
  const musicDir = MUSIC_DIR, musicRoot = fs.existsSync(MUSIC_DIR) ? fs.realpathSync(MUSIC_DIR) : MUSIC_DIR;
  const music = listMusic({ dir: musicDir, exclude: full.musicExclude, upbeat: full.musicUpbeat });
  const musicFiles = new Set([...music.calm, ...music.upbeat].map(track => track.file));
  const file = path.join(dir, 'garden-state.json');
  const state = loadState(file, now());
  pruneUsers(state, now());
  const hub = createHub();
  let coalescer = createCoalescer({ now }), garden, camera, lastShot = null;
  const saver = createSaver({ file, getState: () => state });
  const onEvent = e => {
    const u = e.userId && state.users[e.userId];
    const out = u && !e.nickname ? { ...e, nickname: u.nickname } : e;
    camera?.push(out);
    coalescer.push(out);
    saver.markDirty();
  };
  const newGarden = () => createGarden({ config: full.garden, state, now, onEvent });
  garden = newGarden();
  camera = createCamera({ cfg: garden.cfg, now });
  const meta = () => ({ ...garden.meta(), music: { calm: music.calm, upbeat: music.upbeat } });
  const status = () => {
    const plots = Object.values(state.plots), crops = plots.filter(p => p.owner && p.crop);
    const players = Object.values(state.users).filter(u => u.seat);
    const cam = camera.state();
    return {
      simulator,
      viewers: players.length,
      players: players.map(u => ({ nickname: u.nickname, level: u.level, tier: u.seat.tier })),
      planted: crops.length,
      ripe: crops.filter(p => p.crop.progress >= 1).length,
      event: state.event?.kind ?? null,
      camera: { locked: cam.locked, current: cam.current?.kind ?? null, pending: cam.queue.length },
      competition: garden.competition.status(),
      tiers: TIERS.map(t => ({ id: t.id, label: t.label, viewers: plots.filter(p => p.tier === t.id && p.owner).length })),
    };
  };
  const reset = async () => {
    if (!simulator) throw new Error('reset-simulator-only');
    Object.assign(state, emptyGardenState(now()));
    coalescer = createCoalescer({ now });
    garden = newGarden();
    camera = createCamera({ cfg: garden.cfg, now });
    lastShot = null;
    for (const c of hub.clients) c.seen = {};
    hub.broadcast('reset', { ok: true });
    saver.markDirty();
    await saver.flush();
    return status();
  };

  const frame = setInterval(() => {
    garden.tick();
    const shot = camera.tick();
    if (shot) { lastShot = shot; hub.broadcast('shot', shot); }
    const fx = coalescer.flush();
    for (const c of hub.clients) {
      if (c.busy()) continue;
      const parts = garden.changes(c.seen);
      if (fx.length || Object.keys(parts).length) c.send('frame', { parts, fx });
    }
  }, FRAME_MS);

  // Behind a quick tunnel SSE does not stream, so pages can poll instead: first call opens a session, later calls drain it.
  const pollers = new Map();
  const reaper = setInterval(() => { for (const [id, c] of pollers) if (Date.now() - c.lastPoll > 15000) { pollers.delete(id); hub.remove(c); } }, 5000);

  const API = {
    'camera-lock': b => { camera.setLock(Boolean(b.on)); return { locked: Boolean(b.on) }; },
    event: b => {
      const type = String(b.type);
      if (!EVENT_TYPES.includes(type)) throw Object.assign(new Error('invalid-event-type'), { status: 400 });
      garden.events.force(type);
      return { event: type };
    },
    'session/finish': () => garden.competition.finish(),
    sim: b => {
      const user = { userId: 'sim:' + String(b.user?.userId ?? 'x').slice(0, 48), nickname: String(b.user?.nickname ?? 'Người xem').slice(0, 32), avatar: '' };
      if (b.kind === 'gift') return garden.gift({ ...user, diamonds: Number(b.diamonds) || 1, count: Number(b.count) || 1 });
      return garden.chat({ ...user, comment: String(b.comment ?? '').slice(0, 120) });
    },
    reset,
  };

  function serveFile(res, p) {
    const target = path.resolve(p);
    if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return void res.writeHead(404).end('not found');
    fs.readFile(target, (err, buf) => {
      if (err) return void res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(buf);
    });
  }

  function serveMusic(req, res, name) {
    const rel = String(name).replaceAll('\\', '/');
    const file = path.resolve(musicDir, ...rel.split('/'));
    if (!musicFiles.has(rel) || !file.startsWith(musicDir + path.sep)) return void res.writeHead(404).end('not found');
    let realFile, stat;
    try { realFile = fs.realpathSync(file); stat = fs.statSync(realFile); } catch { return void res.writeHead(404).end('not found'); }
    if (!realFile.startsWith(musicRoot + path.sep) || !stat.isFile()) return void res.writeHead(404).end('not found');
    const size = stat.size, type = AUDIO_TYPES[path.extname(realFile).toLowerCase()];
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!match) {
      res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'max-age=86400' });
      return void fs.createReadStream(realFile).pipe(res);
    }
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return void res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
    res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
    fs.createReadStream(realFile, { start, end }).pipe(res);
  }

  const handler = async (req, res) => {
    if (!trusted(req)) return void res.writeHead(403).end('forbidden');
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return void res.writeHead(400).end('bad request'); }
    if (url.pathname === '/api/status' && req.method === 'GET') return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(status()));
    if (url.pathname.startsWith('/music/')) {
      let name;
      try { name = decodeURIComponent(url.pathname.slice(7)); } catch { return void res.writeHead(400).end('bad request'); }
      return serveMusic(req, res, name);
    }
    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const c = { seen: {}, host: true, busy: () => res.writableNeedDrain, send: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) };
      c.send('meta', meta());
      c.send('frame', { parts: garden.changes(c.seen), fx: [] });
      if (lastShot) c.send('shot', lastShot);
      hub.add(c);
      req.on('close', () => hub.remove(c));
      return;
    }
    if (url.pathname === '/poll') {
      let id = url.searchParams.get('id'), c = pollers.get(id);
      if (!c) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const queue = [];
        c = { seen: {}, host: true, lastPoll: Date.now(), queue, wake: null, busy: () => queue.length > 400,
          send: (event, data) => {
            const last = queue.at(-1);
            if (event === 'frame' && last?.event === 'frame') { Object.assign(last.data.parts, data.parts); last.data.fx = last.data.fx.concat(data.fx); } // a page that is behind gets one merged frame
            else queue.push({ event, data });
            c.wake?.();
          } };
        pollers.set(id, c);
        hub.add(c);
        c.send('meta', meta());
        c.send('frame', { parts: garden.changes(c.seen), fx: [] });
        if (lastShot) c.send('shot', lastShot);
      }
      c.lastPoll = Date.now();
      if (url.searchParams.has('wait') && !c.queue.length) {
        await new Promise(done => { const timer = setTimeout(done, 8000); c.wake = () => { clearTimeout(timer); done(); }; req.on('close', c.wake); });
        c.wake = null;
        c.lastPoll = Date.now();
      }
      return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ id, msgs: c.queue.splice(0) }));
    }
    const api = url.pathname.startsWith('/api/') && Object.hasOwn(API, url.pathname.slice(5)) && API[url.pathname.slice(5)];
    if (api && req.method === 'POST') {
      const route = url.pathname.slice(5);
      if (!simulator && ['sim', 'reset'].includes(route)) return void res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'simulator-only' }));
      try {
        const result = await api(await readBody(req));
        saver.markDirty();
        return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: result ?? null }));
      }
      catch (e) { return void res.writeHead(e.status ?? 500, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: e?.message ?? String(e) })); }
    }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return void res.writeHead(400).end('bad request'); }
    serveFile(res, path.join(PUBLIC, p === '/' ? 'garden/index.html' : p === '/control' || p === '/garden/control' ? 'garden/control.html' : p));
  };

  const listen = (server, p) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(p, '127.0.0.1', () => resolve(server.address().port)); });
  const main = http.createServer(handler);
  const boundPort = await listen(main, port);

  let bridge = null;
  if (tiktok && full.tiktokUsername) {
    const [{ createTikTokBridge }, { createDiagnostics }] = await Promise.all([import('../tiktok.mjs'), import('../diagnostics.mjs')]);
    const diag = createDiagnostics({ dir: process.env.PK_LOG_DIR ?? path.join(root, 'logs'), record: Boolean(full.recordEvents || process.env.PK_RECORD) });
    bridge = createTikTokBridge({ game: diag.wrap(garden), probe: diag.probe, onStatus: s => hub.broadcast('tiktok', s, true) });
    bridge.connect(full.tiktokUsername);
  }
  log(`Vườn Mây running:\n  overlay  http://127.0.0.1:${boundPort}/\n  control  http://127.0.0.1:${boundPort}/control`);

  return {
    port: boundPort, url: `http://127.0.0.1:${boundPort}/`, garden, camera,
    async close() {
      clearInterval(frame); clearInterval(reaper);
      await bridge?.disconnect?.();
      await saver.flush(); saver.stop();
      for (const c of hub.clients) c.wake?.();
      main.closeAllConnections?.();
      await new Promise(r => main.close(r));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const simulator = process.argv.includes('--simulator');
  const running = startGardenServer(simulator ? {
    simulator: true,
    dir: process.env.PK_GARDEN_SIM_DATA_DIR ?? path.join(root, 'data', 'garden-simulator'),
    tiktok: false,
  } : {});
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void running.then(server => server.close()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  running.catch(e => { console.error(e); process.exit(1); });
}
