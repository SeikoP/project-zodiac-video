// Pre-live checklist.
//   npm run check                    check everything offline
//   npm run check -- --online        also ask TikTok whether @username is live right now
//   npm run setup -- <username>      create config.json for that account, then check
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const initAt = args.indexOf('--init');
const online = args.includes('--online');
const CONFIG = path.join(root, 'config.json');
const results = [];
const ok = (msg) => results.push(['ok', msg]);
const warn = (msg) => results.push(['warn', msg]);
const bad = (msg) => results.push(['bad', msg]);

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return e; } };

// --- optional: create config.json for an account ---------------------------------------------------
if (initAt >= 0) {
  const user = (args[initAt + 1] ?? '').replace(/^@/, '').trim();
  if (!user || user.startsWith('--')) { console.error('Dùng: npm run setup -- <username TikTok>'); process.exit(1); }
  const example = readJson(path.join(root, 'config.example.json'));
  const next = fs.existsSync(CONFIG) ? { ...readJson(CONFIG), tiktokUsername: user } : { ...example, tiktokUsername: user };
  fs.writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n');
  console.log(`Đã ghi config.json với tiktokUsername = ${user}`);
}

// 1. Node ----------------------------------------------------------------------------------------------
const [major, minor] = process.versions.node.split('.').map(Number);
major > 22 || (major === 22 && minor >= 9) || (major === 20 && minor >= 19) ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} quá cũ — cần Node 20.19 hoặc 22.9 trở lên`);

// 2. dependencies ------------------------------------------------------------------------------------------
fs.existsSync(path.join(root, 'node_modules', 'tiktok-live-connector')) ? ok('Đã cài thư viện (node_modules)') : bad('Chưa cài thư viện — chạy: npm install');

// 3. config -----------------------------------------------------------------------------------------------------
const { DEFAULT_CONFIG } = await import('../game.mjs');
let cfg = {};
if (!fs.existsSync(CONFIG)) warn('Chưa có config.json — dùng cấu hình mặc định (tạo bằng: npm run setup -- <username>)');
else {
  const c = readJson(CONFIG);
  if (c instanceof Error) bad(`config.json lỗi cú pháp: ${c.message}`);
  else {
    cfg = c;
    ok('config.json đọc được');
    const known = new Set([...Object.keys(DEFAULT_CONFIG), 'tiktokUsername', 'limits', 'musicDir', 'musicExclude', 'musicUpbeat']);
    const typos = Object.keys(c).filter(k => !known.has(k));
    typos.length ? warn(`config.json có khoá lạ (gõ sai?): ${typos.join(', ')}`) : ok('Các khoá trong config.json đều hợp lệ');
    const wrong = Object.entries(c).filter(([k, v]) => k in DEFAULT_CONFIG && typeof v !== typeof DEFAULT_CONFIG[k]).map(([k]) => k);
    wrong.length ? bad(`Sai kiểu dữ liệu: ${wrong.join(', ')}`) : ok('Kiểu dữ liệu của cấu hình đúng');
  }
}
const user = String(cfg.tiktokUsername ?? '').replace(/^@/, '').trim();
if (!user) warn('Chưa đặt tiktokUsername — bạn vẫn có thể nhập tay ở bảng điều khiển khi bắt đầu live');
else /^[\w.]{2,24}$/.test(user) ? ok(`Tài khoản TikTok: @${user}`) : bad(`Username "${user}" không hợp lệ (chỉ chữ, số, dấu chấm, gạch dưới)`);

// 4. content ----------------------------------------------------------------------------------------------------
const { buildQuizBank } = await import('../quizbank.mjs');
const extra = readJson(path.join(root, 'quiz.json'));
if (extra instanceof Error) bad(`quiz.json lỗi: ${extra.message}`);
else {
  const bank = buildQuizBank({ extra });
  bank.length ? ok(`Ngân hàng câu đố: ${bank.length} câu (${extra.length} câu viết tay)`) : ok('Ngân hàng câu đố đang trống (câu đố phe màu sẽ thêm sau) — game sẽ không mở câu đố');
}

// 5. assets ---------------------------------------------------------------------------------------------------------
const teams = ['red', 'yellow', 'green', 'blue'];
const missing = teams.flatMap(s => ['idle', 'hype', 'win', 'panic', 'sad'].map(m => `${s}-${m}.svg`)).filter(f => !fs.existsSync(path.join(root, 'public/mascots', f)));
missing.length ? bad(`Thiếu ${missing.length} linh vật — chạy: node build-mascots.mjs`) : ok('Đủ 20 hình linh vật');
fs.existsSync(path.join(root, 'public/fonts/PatrickHand-Regular.ttf')) ? ok('Có font hiển thị') : warn('Thiếu public/fonts/PatrickHand-Regular.ttf — chữ tiêu đề sẽ dùng font dự phòng');
const musicDir = path.resolve(root, cfg.musicDir ?? '../../assets/music');
const { listMusic } = await import('../music.mjs');
const tracks = listMusic({ dir: musicDir, exclude: cfg.musicExclude, upbeat: cfg.musicUpbeat });
if (!fs.existsSync(musicDir)) warn(`Không thấy thư mục nhạc: ${musicDir} — overlay sẽ chạy không có nhạc nền`);
else if (!tracks.calm.length && !tracks.upbeat.length) warn('Thư mục nhạc không có file mp3/ogg/wav/m4a nào dùng được');
else {
  ok(`Nhạc nền: ${tracks.calm.length} bài nhẹ + ${tracks.upbeat.length} bài sôi động${tracks.skipped.length ? ` (bỏ qua ${tracks.skipped.length} file hiệu ứng/hài)` : ''}`);
  if (!tracks.calm.length || !tracks.upbeat.length) warn('Chỉ có một nhóm nhạc nên không đổi được không khí theo phòng (bài có chữ "fun" trong tên được xếp vào nhóm sôi động)');
  if (tracks.calm.length + tracks.upbeat.length < 3) warn('Dưới 3 bài nhạc — sẽ lặp lại khá nhanh, nên thêm nhạc vào thư mục (nhớ kiểm tra giấy phép)');
}

const packFile = path.join(root, 'audio-pack.json');
if (fs.existsSync(packFile)) {
  const pack = readJson(packFile);
  const have = pack.sfx.filter(x => fs.existsSync(path.join(root, 'public/sfx', x.file))).length;
  have === pack.sfx.length ? ok(`Hiệu ứng thật: ${have}/${pack.sfx.length} file (public/sfx)`) : warn(`Mới có ${have}/${pack.sfx.length} hiệu ứng thật — chạy: npm run audio (thiếu thì tự dùng âm tổng hợp)`);
}

// 6. port + data dir ----------------------------------------------------------------------------------------------------
const port = Number(process.env.PK_PORT || 4848);
const free = await new Promise(resolve => {
  const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
  s.listen(port, '127.0.0.1');
});
free ? ok(`Cổng ${port} đang trống`) : warn(`Cổng ${port} đang được dùng — server đã chạy rồi? (hoặc đặt PK_PORT khác)`);
try {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  const probe = path.join(root, 'data', '.write-test');
  fs.writeFileSync(probe, 'x'); fs.unlinkSync(probe);
  ok('Ghi được thư mục data (lưu điểm giữa các buổi)');
} catch (e) { bad(`Không ghi được thư mục data: ${e.message}`); }
const stateFile = path.join(root, 'data', 'state.json');
if (fs.existsSync(stateFile)) {
  const st = readJson(stateFile);
  const sim = st instanceof Error ? 0 : Object.keys(st.viewers ?? {}).filter(id => id.startsWith('sim:')).length;
  sim ? warn(`data/state.json còn ${sim} người xem diễn tập — sẽ tự xoá khi server LIVE khởi động`) : ok('Dữ liệu đã lưu không có người xem diễn tập');
}

// 7. TikTok (optional, needs network) ----------------------------------------------------------------------------------------
if (online) {
  if (!user) warn('Bỏ qua kiểm tra online: chưa có username');
  else {
    try {
      const { TikTokLiveConnection } = await import('tiktok-live-connector');
      // fetchIsLive() needs a connected state in this library version, so try a real (read-only) connect instead.
      const conn = new TikTokLiveConnection(user, {
        processInitialData: false,
        ...(process.env.EULERSTREAM_API_KEY ? { signApiKey: process.env.EULERSTREAM_API_KEY } : {}),
      });
      let live = false;
      try {
        await Promise.race([conn.connect(), new Promise((_, rej) => setTimeout(() => rej(new Error('quá thời gian chờ 20s')), 20000))]);
        live = true;
        await conn.disconnect().catch(() => {});
      } catch (e) {
        const err = e?.exception ?? e;
        if (/Room ID/i.test(String(err?.message))) { warn(`Không tìm thấy phòng live của @${user} — chưa phát, hoặc username sai/không công khai. Kiểm tra lại khi bạn đã bắt đầu live.`); live = null; }
        else if (err?.name !== 'UserOfflineError' && !/isn't online/i.test(String(err?.message))) throw err;
      }
      if (live === null) { /* already reported above */ } else live ? ok(`@${user} đang live — sẵn sàng kết nối`) : warn(`@${user} hiện chưa live (kết nối được khi bạn bắt đầu phát)`);
    } catch (e) { warn(`Không kiểm tra được TikTok: ${e.message}`); }
  }
}

// --- report ---------------------------------------------------------------------------------------------------------------------
const icon = { ok: '✔', warn: '⚠', bad: '✖' };
console.log('\nKiểm tra trước giờ live\n');
for (const [kind, msg] of results) console.log(`  ${icon[kind]} ${msg}`);
const errors = results.filter(r => r[0] === 'bad').length, warnings = results.filter(r => r[0] === 'warn').length;
console.log(`\n${errors ? `✖ ${errors} lỗi cần sửa trước khi live.` : warnings ? `✔ Sẵn sàng, còn ${warnings} lưu ý.` : '✔ Mọi thứ sẵn sàng.'}\n`);
process.exit(errors ? 1 : 0);
