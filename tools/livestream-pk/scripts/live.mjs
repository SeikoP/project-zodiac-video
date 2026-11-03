// One command to go live: checks everything, starts the server (restarting it if it ever crashes),
// writes a log file, opens the control panel.
//   npm run live
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PK_PORT || 4848);

const check = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { stdio: 'inherit' });
if (check.status !== 0) {
  console.error('Sửa các lỗi ✖ ở trên rồi chạy lại: npm run live');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
const logFile = path.join(root, 'logs', `live-${new Date().toISOString().slice(0, 10)}.log`);
const log = fs.createWriteStream(logFile, { flags: 'a' });
const stamp = msg => log.write(`[${new Date().toISOString()}] ${msg}\n`);

// Keep the show running: a crash restarts the server after 2s (state is saved to data/state.json every 10s).
// More than 5 crashes in 10 minutes means something is really wrong, so stop instead of looping.
let stopping = false, child = null, crashes = [];
function run() {
  child = spawn(process.execPath, [path.join(root, 'server.mjs')], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  stamp(`server started (pid ${child.pid})`);
  for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.on('data', d => { out.write(d); log.write(d); });
  }
  child.on('exit', (code, sig) => {
    if (stopping) { stamp('stopped'); log.end(); return process.exit(0); }
    const now = Date.now();
    crashes = crashes.filter(t => now - t < 600000).concat(now);
    stamp(`server exited unexpectedly (${code ?? sig})`);
    if (crashes.length > 5) {
      console.error('\nServer sập quá 5 lần trong 10 phút — dừng lại. Xem log:', logFile);
      return process.exit(1);
    }
    console.error(`\nServer dừng bất ngờ (${code ?? sig}) — khởi động lại sau 2 giây…`);
    setTimeout(run, 2000);
  });
}
function stop(sig) {
  if (stopping) return;
  stopping = true;
  if (!child || child.exitCode !== null) {
    log.end();
    return process.exit(0);
  }

  // On Windows, forwarding SIGINT to a child Node process can leave it orphaned.
  child.kill(process.platform === 'win32' ? 'SIGTERM' : sig);
  const forceKill = setTimeout(() => {
    if (child && child.exitCode === null) child.kill('SIGKILL');
  }, 1000);
  const giveUp = setTimeout(() => process.exit(1), 2500);
  child.once('exit', () => { clearTimeout(forceKill); clearTimeout(giveUp); });
  forceKill.unref();
  giveUp.unref();
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => stop(sig));
run();

setTimeout(() => {
  const url = `http://127.0.0.1:${port}/control`;
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { if (!process.env.PK_NO_OPEN) spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref(); } catch { /* opening the browser is a convenience only */ }
  console.log(`\nBảng điều khiển: ${url}`);
  console.log(`Overlay cho OBS / TikTok LIVE Studio (1080×1920): http://127.0.0.1:${port}/`);
  console.log(`Log: ${logFile}`);
  console.log('Dừng server: Ctrl+C\n');
}, 1500);
