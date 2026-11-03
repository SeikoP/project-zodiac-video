// Replays a recorded night into a running server (npm run live / npm start), keeping the original timing.
//   npm run replay -- logs/events-2026-11-05.jsonl            at 5× speed
//   npm run replay -- logs/events-2026-11-05.jsonl --speed 1  in real time
// Record a night by setting "recordEvents": true in config.json (or PK_RECORD=1).
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const speed = Number(args[args.indexOf('--speed') + 1]) > 0 && args.includes('--speed') ? Number(args[args.indexOf('--speed') + 1]) : 5;
const port = Number(process.env.PK_PORT || 4848);
if (!file || !fs.existsSync(file)) { console.error('Dùng: npm run replay -- <logs/events-….jsonl> [--speed 5]'); process.exit(1); }

const events = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
if (!events.length) { console.error('File không có sự kiện nào.'); process.exit(1); }
console.log(`Phát lại ${events.length} sự kiện (${((events.at(-1).t - events[0].t) / 1000 / speed).toFixed(0)} giây ở ${speed}×) vào http://127.0.0.1:${port}`);

let sent = 0;
const t0 = events[0].t, start = Date.now();
for (const e of events) {
  const wait = (e.t - t0) / speed - (Date.now() - start);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...e, replay: true }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sent++;
  } catch (err) { console.error(`Không gửi được (${err.message}) — server đang chạy chưa?`); process.exit(1); }
}
console.log(`✔ Đã phát ${sent}/${events.length} sự kiện.`);
