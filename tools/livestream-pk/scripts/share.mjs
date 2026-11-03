// Gives the overlay a public https address, for TikTok LIVE Studio's "link" source (it refuses localhost).
//   npm run share
// Needs the server running (npm run live) and cloudflared installed (winget install Cloudflare.cloudflared).
// Only the read-only overlay is shared (port PK_SHARE_PORT, default 4849): no control panel, no API.
// The address is random and changes every time; anyone who has it can watch the overlay, so do not post it.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PK_SHARE_PORT || 4849);
// A fresh winget install is not on PATH in terminals opened before it, so also look where the installer puts it.
const installed = ['ProgramFiles', 'ProgramFiles(x86)'].map(v => process.env[v] && path.join(process.env[v], 'cloudflared', 'cloudflared.exe')).find(f => f && existsSync(f));
const found = installed ? { status: 0 } : spawnSync(process.platform === 'win32' ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' });
if (found.status !== 0) {
  console.error('Chưa có cloudflared. Cài một lần bằng:\n  winget install Cloudflare.cloudflared\nrồi mở lại terminal và chạy lại: npm run share');
  process.exit(1);
}
try {
  const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`Không thấy server ở cổng ${port} (${e.message}). Chạy npm run live trước rồi thử lại.`);
  process.exit(1);
}

const child = spawn(installed ?? 'cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let shown = false;
const scan = d => {
  const m = !shown && /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(d));
  if (!m) return;
  shown = true;
  console.log(`\nDán địa chỉ này vào ô Link của TikTok LIVE Studio:\n\n  ${m[0]}/\n\nNếu ô Link báo lỗi ngay, chờ vài giây cho địa chỉ mới có hiệu lực rồi thử lại. Giữ cửa sổ này mở trong suốt buổi live. Ctrl+C để dừng chia sẻ.\n`);
};
child.stdout.on('data', scan);
child.stderr.on('data', scan);
child.on('exit', code => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
