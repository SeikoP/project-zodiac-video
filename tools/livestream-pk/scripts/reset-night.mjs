// Xóa dữ liệu đêm cũ (state.json, backup-night-*.json, settings.json) để bắt đầu đêm mới.
//   npm run reset-night                dry run: chỉ liệt kê
//   npm run reset-night -- --apply     xóa thật
//   npm run reset-night -- --dir <thư mục dữ liệu>
// Không bao giờ đụng tới garden-state.json hay tệp khác.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MATCH = name => name === 'state.json' || name === 'settings.json' || /^backup-night-.+\.json$/.test(name);

export function resetNight({ dir, apply }) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { removed: [] }; }
  const removed = entries.filter(e => e.isFile() && MATCH(e.name)).map(e => e.name).sort();
  if (apply) for (const name of removed) fs.rmSync(path.join(dir, name), { force: true });
  return { removed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : (process.env.PK_DATA_DIR ?? path.join(root, 'data'));
  const apply = args.includes('--apply');
  const { removed } = resetNight({ dir, apply });
  if (!removed.length) console.log(`Không có gì để xóa trong ${dir}`);
  else if (apply) console.log(`Đã xóa: ${removed.join(', ')}`);
  else { console.log(`Sẽ xóa: ${removed.join(', ')}`); console.log('Thêm --apply để xóa thật.'); }
}
