// Start a second, fully isolated server for the TikTok LIVE rehearsal UI.
//   npm run simulator
// The simulator never connects to TikTok and never reads/writes the production state or logs.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PK_SIM_PORT || 4850);
const sharePort = Number(process.env.PK_SIM_SHARE_PORT || port + 1);
const env = {
  ...process.env,
  PK_PORT: String(port),
  PK_SHARE_PORT: String(sharePort),
  PK_DATA_DIR: path.resolve(process.env.PK_SIM_DATA_DIR || path.join(root, '.simulator-data')),
  PK_LOG_DIR: path.resolve(process.env.PK_SIM_LOG_DIR || path.join(root, '.simulator-logs')),
  PK_SIMULATOR: '1',
  PK_NO_TIKTOK: '1',
};
delete env.EULERSTREAM_API_KEY; // offline: never carry the live key, even when it is exported in the shell
const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
  cwd: root, env, stdio: 'inherit',
});
let stopping = false;

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  child.kill(process.platform === 'win32' ? 'SIGTERM' : signal);
  const force = setTimeout(() => child.kill('SIGKILL'), 1500);
  force.unref();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
child.on('error', error => {
  console.error('[simulator] Không khởi động được server:', error.message);
  process.exitCode = 1;
});

const url = `http://127.0.0.1:${port}/simulator`;
console.log('\nTikTok LIVE Simulator (offline, isolated)');
console.log(`  Màn hình: ${url}`);
console.log(`  Bảng điều khiển: http://127.0.0.1:${port}/control`);
console.log(`  Dữ liệu riêng: ${env.PK_DATA_DIR}`);
console.log('  TikTok thật: đã khóa trong tiến trình này');
console.log('  Dừng: Ctrl+C\n');

if (!process.env.PK_NO_OPEN) {
  setTimeout(() => {
    const [cmd, args] = process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd, args, { stdio: 'ignore', detached: true }).unref(); } catch { /* browser opening is optional */ }
  }, 900);
}
