// Vườn Mây server (npm run garden). Own port, own data, shares only tiktok.mjs with Đêm Hội Hoàng Đạo.
//   http://127.0.0.1:4858/   overlay for TikTok LIVE Studio (Web/Link source, 1080×1920) and the host's API
//   PK_SHARE_PORT=4859 npm run share   read-only copy for the https tunnel (port 4859)
// Every FRAME_MS each page gets the plots that changed since it last heard, the merged effects, and any new camera shot.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGarden } from './garden.mjs';
import { createCamera } from './camera.mjs';
import { createCoalescer } from './fx.mjs';
import { createHub } from './hub.mjs';
import { createSaver, loadState, pruneUsers } from './store.mjs';
import { ISLANDS } from './world.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(root, 'public');
const FRAME_MS = Number(process.env.PK_FRAME_MS) || 150;
const TYPES = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

const trusted = req => {
  const ip = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return LOCAL.test(new URL(origin).host); } catch { return false; }
};
const readBody = req => new Promise(resolve => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
});

export async function startGardenServer({ port = Number(process.env.PK_GARDEN_PORT || 4858), sharePort = Number(process.env.PK_GARDEN_SHARE_PORT || 4859), dir = process.env.PK_DATA_DIR ?? path.join(root, 'data'), config, tiktok = !process.env.PK_NO_TIKTOK, now = Date.now, log = console.log } = {}) {
  const full = config ?? readJson(path.join(root, 'config.json'), {});
  const file = path.join(dir, 'garden-state.json');
  const state = loadState(file, now());
  pruneUsers(state, now());
  const hub = createHub(), coalescer = createCoalescer({ now });
  let garden, camera, lastShot = null;
  const saver = createSaver({ file, getState: () => state });
  const onEvent = e => {
    const u = e.userId && state.users[e.userId];
    const out = u && !e.nickname ? { ...e, nickname: u.nickname } : e;
    camera?.push(out);
    coalescer.push(out);
    saver.markDirty();
  };
  garden = createGarden({ config: full.garden, state, now, onEvent });
  camera = createCamera({ cfg: garden.cfg, now });
  const meta = () => ({ ...garden.meta(), islands: ISLANDS });

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
    event: b => { garden.events.force(String(b.type)); },
    sim: b => {
      const user = { userId: 'sim:' + String(b.user?.userId ?? 'x'), nickname: String(b.user?.nickname ?? 'Người xem').slice(0, 32), avatar: '' };
      if (b.kind === 'gift') garden.gift({ ...user, diamonds: Number(b.diamonds) || 1, count: Number(b.count) || 1 });
      else garden.chat({ ...user, comment: String(b.comment ?? '') });
    },
  };

  function serveFile(res, p) {
    const target = path.resolve(p);
    if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return void res.writeHead(404).end('not found');
    fs.readFile(target, (err, buf) => {
      if (err) return void res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(buf);
    });
  }

  const handler = shared => async (req, res) => {
    if (shared ? !['GET', 'HEAD'].includes(req.method) : !trusted(req)) return void res.writeHead(shared ? 405 : 403).end('forbidden');
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return void res.writeHead(400).end('bad request'); }
    if (shared && url.pathname.startsWith('/api/')) return void res.writeHead(404).end('not found');
    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const c = { seen: {}, host: !shared, busy: () => res.writableNeedDrain, send: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) };
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
        c = { seen: {}, host: !shared, lastPoll: Date.now(), queue, wake: null, busy: () => queue.length > 400,
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
      try { return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: await api(await readBody(req)) ?? null })); }
      catch (e) { return void res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: e?.message ?? String(e) })); }
    }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return void res.writeHead(400).end('bad request'); }
    serveFile(res, path.join(PUBLIC, p === '/' ? 'garden/index.html' : p));
  };

  const listen = (server, p) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(p, '127.0.0.1', () => resolve(server.address().port)); });
  const main = http.createServer(handler(false)), share = http.createServer(handler(true));
  const boundPort = await listen(main, port);
  const boundShare = await listen(share, sharePort).catch(e => { log(`[garden] cổng chia sẻ ${sharePort}: ${e.message}`); return null; });

  let bridge = null;
  if (tiktok && full.tiktokUsername) {
    const [{ createTikTokBridge }, { createDiagnostics }] = await Promise.all([import('../tiktok.mjs'), import('../diagnostics.mjs')]);
    const diag = createDiagnostics({ dir: process.env.PK_LOG_DIR ?? path.join(root, 'logs'), record: Boolean(full.recordEvents || process.env.PK_RECORD) });
    bridge = createTikTokBridge({ game: diag.wrap(garden), probe: diag.probe, onStatus: s => hub.broadcast('tiktok', s, true) });
    bridge.connect(full.tiktokUsername);
  }
  log(`Vườn Mây running:\n  overlay  http://127.0.0.1:${boundPort}/${boundShare ? `\n  chia sẻ (chỉ xem)  http://127.0.0.1:${boundShare}/` : ''}`);

  return {
    port: boundPort, sharePort: boundShare, url: `http://127.0.0.1:${boundPort}/`, garden, camera,
    async close() {
      clearInterval(frame); clearInterval(reaper);
      await bridge?.disconnect?.();
      await saver.flush(); saver.stop();
      for (const c of hub.clients) c.wake?.();
      main.closeAllConnections?.(); share.closeAllConnections?.();
      await Promise.all([new Promise(r => main.close(r)), new Promise(r => share.close(r))]);
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startGardenServer().catch(e => { console.error(e); process.exit(1); });
}
