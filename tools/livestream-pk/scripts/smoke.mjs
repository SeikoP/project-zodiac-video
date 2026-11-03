// 10-second end-to-end check of the real server (not mocks): starts it on a spare port with a throwaway
// data folder, sends TikTok-style events, checks the overlay stream reflects them, records and replays them.
//   npm run smoke
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4871 + Math.floor(Math.random() * 100);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-smoke-'));
// run a private copy of the data/logs folders so a real night's state is never touched
const env = { ...process.env, PK_PORT: String(port), PK_RECORD: '1', PK_NO_TIKTOK: '1', PK_DATA_DIR: path.join(work, 'data'), PK_LOG_DIR: path.join(work, 'logs') };
const results = [];
const check = (ok, msg) => { results.push(ok); console.log(`  ${ok ? '✔' : '✖'} ${msg}`); };
const post = (route, body) => fetch(`http://127.0.0.1:${port}/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(root, 'server.mjs')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
server.stdout.on('data', d => (out += d));
server.stderr.on('data', d => (out += d));

try {
  console.log(`\nSmoke test (cổng ${port})\n`);
  for (let i = 0; i < 50 && !out.includes('running'); i++) await sleep(100);
  check(out.includes('running'), 'server khởi động');

  // read what the overlay would receive
  const frames = [];
  const ac = new AbortController();
  fetch(`http://127.0.0.1:${port}/events`, { signal: ac.signal }).then(async res => {
    const dec = new TextDecoder();
    for await (const chunk of res.body) for (const block of dec.decode(chunk).split('\n\n')) if (block.startsWith('event: frame')) frames.push(JSON.parse(block.split('data: ')[1]));
  }).catch(() => {});

  const u = (id, nick) => ({ userId: id, nickname: nick, avatar: 'https://p16.tiktokcdn.com/a.jpeg' });
  await post('ingest', { type: 'chat', ...u('1', 'Lan'), comment: 'em là sư tử' });
  await post('ingest', { type: 'like', ...u('1', 'Lan'), count: 30 });
  await post('ingest', { type: 'gift', ...u('1', 'Lan'), diamonds: 30, count: 1, giftName: 'Doughnut' });
  await post('ingest', { type: 'social', ...u('1', 'Lan'), kind: 'follow' });
  await sleep(900);
  const lastPart = key => frames.map(f => f.parts?.[key]).filter(Boolean).at(-1);
  const stage = lastPart('stage') ?? [], sky = lastPart('sky');
  check(stage.some(v => v.userId === '1' && v.sign === 'leo'), 'bình luận "sư tử" đưa người xem vào cung Sư Tử');
  check(sky?.sky?.find(s => s.id === 'leo')?.progress > 0, 'quà + follow thắp sáng chòm Sư Tử');
  check(frames.some(f => f.fx?.some(e => e.type === 'gift')), 'overlay nhận hiệu ứng quà');

  const bad = await post('ingest', { type: 'nope' });
  check(bad.ok === false, 'sự kiện sai bị từ chối, server vẫn sống');
  check((await fetch(`http://127.0.0.1:${port}/control`)).status === 200 && (await fetch(`http://127.0.0.1:${port}/`)).status === 200, 'trang overlay và bảng điều khiển mở được');
  check((await fetch(`http://127.0.0.1:${port}/simulator`)).status === 200, 'màn hình TikTok LIVE Simulator được phục vụ');
  const mp3 = fs.existsSync(path.join(root, 'public/sfx/manifest.json')) ? await fetch(`http://127.0.0.1:${port}/sfx/manifest.json`) : null;
  check(!mp3 || mp3.status === 200, 'gói hiệu ứng âm thanh được phục vụ');

  ac.abort();
  await sleep(200);
  const logFile = fs.readdirSync(path.join(work, 'logs')).find(f => f.startsWith('events-'));
  const lines = logFile ? fs.readFileSync(path.join(work, 'logs', logFile), 'utf8').trim().split('\n').length : 0;
  check(lines === 4, `ghi lại đủ 4 sự kiện (có ${lines})`);
  const replay = spawnSync(process.execPath, [path.join(root, 'scripts/replay.mjs'), path.join(work, 'logs', logFile ?? 'none'), '--speed', '1000'], { env, encoding: 'utf8' });
  check(replay.status === 0 && /Đã phát 4\/4/.test(replay.stdout), 'phát lại được đêm vừa ghi');
  const after = fs.readFileSync(path.join(work, 'logs', logFile), 'utf8').trim().split('\n').length;
  check(after === 4, 'phát lại không ghi trùng vào file ghi');
} finally {
  server.kill();
  await sleep(300);
  fs.rmSync(work, { recursive: true, force: true });
}
const failed = results.filter(r => !r).length;
console.log(failed ? `\n✖ ${failed} bước lỗi.\n` : '\n✔ Toàn bộ luồng chạy tốt.\n');
process.exit(failed ? 1 : 0);
