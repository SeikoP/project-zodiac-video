// Installs the audio pack described in audio-pack.json (free Mixkit music + sound effects):
//   npm run audio                      download what is missing (about 84 MB the first time)
//   npm run audio -- --from <dir>      copy from a folder that already holds music/<id>.mp3 and sfx/<id>.mp3
// Music goes to  <musicDir>/livestream/{calm,upbeat}/   (default ../../assets/music)
// Effects go to  public/sfx/  with a manifest.json that sfx.js reads.
// Every file is checked to be real MPEG audio before it is kept. Nothing is executed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(fs.readFileSync(path.join(root, 'audio-pack.json'), 'utf8'));
const config = fs.existsSync(path.join(root, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')) : {};
const musicRoot = path.resolve(root, config.musicDir ?? '../../assets/music', 'livestream');
const sfxDir = path.join(root, 'public', 'sfx');
const fromAt = process.argv.indexOf('--from');
const from = fromAt >= 0 ? path.resolve(process.argv[fromAt + 1]) : null;

const isMpeg = buf => buf.length > 1024 && ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0));
const musicUrl = id => `https://assets.mixkit.co/music/${id}/${id}.mp3`;
const sfxUrl = id => `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;

async function get(kind, item, dest) {
  if (fs.existsSync(dest) && isMpeg(fs.readFileSync(dest).subarray(0, 4096))) return 'có sẵn';
  let buf;
  const cached = from && path.join(from, kind, `${item.id}.mp3`);
  if (cached && fs.existsSync(cached)) buf = fs.readFileSync(cached);
  else {
    const res = await fetch(kind === 'music' ? musicUrl(item.id) : sfxUrl(item.id), { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (!isMpeg(buf)) throw new Error('không phải file MP3 hợp lệ');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return `${(buf.length / 1e6).toFixed(1)} MB`;
}

let failed = 0;
for (const m of pack.music) {
  const dest = path.join(musicRoot, m.mood, m.file);
  try { console.log(`✔ nhạc ${m.mood.padEnd(6)} ${m.title} — ${m.artist} (${await get('music', m, dest)})`); }
  catch (e) { failed++; console.error(`✖ nhạc ${m.title}: ${e.message}`); }
}
for (const x of pack.sfx) {
  try { await get('sfx', x, path.join(sfxDir, x.file)); }
  catch (e) { failed++; console.error(`✖ hiệu ứng ${x.id}: ${e.message}`); }
}
console.log(`✔ hiệu ứng: ${pack.sfx.filter(x => fs.existsSync(path.join(sfxDir, x.file))).length}/${pack.sfx.length} file trong public/sfx`);

// manifest for the overlay (only roles whose files are all present are kept)
const roles = {};
for (const [role, def] of Object.entries(pack.roles)) {
  const files = def.files.filter(f => fs.existsSync(path.join(sfxDir, f)));
  if (files.length) roles[role] = { gain: def.gain, files };
}
fs.mkdirSync(sfxDir, { recursive: true });
fs.writeFileSync(path.join(sfxDir, 'manifest.json'), JSON.stringify({ roles }, null, 2) + '\n');

// licence record next to the files
const lines = [
  '# Nguồn và giấy phép âm thanh', '',
  `Tất cả lấy từ **${pack.source}** (${pack.licenseUrl}) — ${pack.licenseName}, ngày lấy ${pack.retrieved}.`,
  'Giấy phép Mixkit cho dùng miễn phí (kể cả thương mại), không cần ghi nguồn, nhưng **không được** đăng ký nhạc vào Content ID hay bán lại/phát tán nguyên bản. Hãy đọc giấy phép ở liên kết trên một lần trước khi dùng cho kênh.', '',
  '## Nhạc nền', '', '| Nhóm | Bài | Tác giả | Thể loại | Thời lượng | File |', '|---|---|---|---|---|---|',
  ...pack.music.map(m => `| ${m.mood} | ${m.title} | ${m.artist} | ${m.genre} | ${Math.floor(m.seconds / 60)}:${String(m.seconds % 60).padStart(2, '0')} | ${m.file} |`), '',
  '## Hiệu ứng âm thanh', '', '| ID Mixkit | Nhãn | Dùng cho | File |', '|---|---|---|---|',
  ...pack.sfx.map(x => `| ${x.id} | ${x.tags} | ${Object.entries(pack.roles).filter(([, d]) => d.files.includes(x.file)).map(([r]) => r).join(', ')} | ${x.file} |`), '',
];
fs.mkdirSync(musicRoot, { recursive: true });
fs.writeFileSync(path.join(musicRoot, 'LICENSES.md'), lines.join('\n'));
fs.writeFileSync(path.join(sfxDir, 'LICENSES.md'), lines.join('\n'));
console.log(failed ? `\n✖ ${failed} file lỗi — chạy lại: npm run audio` : '\n✔ Gói âm thanh đã sẵn sàng.');
process.exit(failed ? 1 : 0);
