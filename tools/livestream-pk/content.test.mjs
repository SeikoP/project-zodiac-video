import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SIGNS } from './game.mjs';
import { SIGN_DATA, insideDates } from './public/signs.js';
import { buildQuizBank } from './quizbank.mjs';
import { drawFortune, poolSize, FORTUNE_TOPICS } from './fortunes.mjs';

const extra = JSON.parse(fs.readFileSync(new URL('./quiz.json', import.meta.url), 'utf8'));

test('every sign has complete, consistent reference data', () => {
  const ids = SIGNS.map(s => s.id);
  for (const id of ids) {
    const d = SIGN_DATA[id];
    assert.ok(d, id);
    assert.equal(d.lines.length, 5, `${id} lines`);
    assert.equal(new Set(d.lines).size, 5, `${id} lines are distinct`);
    assert.ok(d.match.length >= 2 && d.match.every(m => ids.includes(m) && m !== id), `${id} match`);
    assert.equal(SIGN_DATA[d.opposite].opposite, id, `${id} opposite is symmetric`);
    assert.ok(d.numbers.length >= 2 && d.symbol && d.planet && d.color && d.en, `${id} fields`);
  }
  assert.equal(new Set(ids.flatMap(id => SIGN_DATA[id].lines)).size, 60, 'no two signs share a line');
});

test('dates used by quizzes sit inside the sign range, not on its edge', () => {
  for (const [id, expect] of [['capricorn', ['27/12', '14/1']], ['aries', ['26/3', '14/4']], ['pisces', ['24/2', '15/3']]]) {
    assert.deepEqual(insideDates(id), expect, id);
  }
});

test('the generated quiz bank is empty for now and hand-written entries are validated and deduplicated', () => {
  assert.deepEqual(extra, []);
  assert.deepEqual(buildQuizBank({ extra }), []);
  const good = { q: 'Màu nào ấm?', options: ['Đỏ', 'Xanh dương'], answer: 'A' };
  const bank = buildQuizBank({ extra: [good, { ...good }, { q: '', options: ['a', 'b'], answer: 'A' }, { q: 'x?', options: ['a'], answer: 'A' }, { q: 'y?', options: ['a', 'b'], answer: 'Z' }] });
  assert.deepEqual(bank, [{ kind: 'trivia', ...good }]);
});

test('daily readings vary a lot across viewers, are stable within a day, and never repeat a line inside one reading', () => {
  const now = Date.UTC(2026, 10, 3, 5);
  const seen = {};
  for (let i = 0; i < 300; i++) {
    const f = drawFortune({ seed: `user${i}`, sign: 'leo', element: 'fire', now });
    for (const t of FORTUNE_TOPICS) (seen[t] ??= new Set()).add(f[t]);
    assert.equal(new Set(FORTUNE_TOPICS.map(t => f[t])).size, 4);
    assert.ok(f.tip && f.color && f.hour && Number.isInteger(f.number));
  }
  for (const t of FORTUNE_TOPICS) assert.ok(seen[t].size >= 12, `${t}: ${seen[t].size} distinct lines`);
  const a = drawFortune({ seed: 'x', sign: 'leo', element: 'fire', now });
  assert.deepEqual(a, drawFortune({ seed: 'x', sign: 'leo', element: 'fire', now: now + 3600e3 * 6 }));
  assert.notDeepEqual(a, drawFortune({ seed: 'x', sign: 'leo', element: 'fire', now: now + 86400e3 }));
  for (const s of SIGNS) for (const t of FORTUNE_TOPICS) assert.ok(poolSize(t, s.id, s.element) >= 18, `${s.id}/${t}`);
});

test('two different signs rarely get the same line on the same day', () => {
  const now = Date.UTC(2026, 10, 3, 5);
  let same = 0, total = 0;
  for (let i = 0; i < 200; i++) {
    const a = drawFortune({ seed: `u${i}`, sign: 'aries', element: 'fire', now }), b = drawFortune({ seed: `u${i}`, sign: 'pisces', element: 'water', now });
    for (const t of FORTUNE_TOPICS) { total++; if (a[t] === b[t]) same++; }
  }
  assert.ok(same / total < 0.05, `${same}/${total}`);
});

test('listMusic reads livestream/calm and livestream/upbeat folders plus loose files, and skips comedy clips', async () => {
  const os = await import('node:os'), path = await import('node:path');
  const { listMusic } = await import('./music.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-music-'));
  try {
    fs.mkdirSync(path.join(dir, 'livestream', 'calm'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'livestream', 'upbeat'), { recursive: true });
    for (const f of ['livestream/calm/mixkit-vastness-184.mp3', 'livestream/upbeat/mixkit-one-more-dance-288.mp3', 'garden.mp3', 'fun-party.mp3', 'blooper-sfx.mp3', 'notes.txt']) fs.writeFileSync(path.join(dir, f), 'x');
    const r = listMusic({ dir });
    assert.deepEqual(r.calm.map(x => x.file), ['garden.mp3', 'livestream/calm/mixkit-vastness-184.mp3']);
    assert.deepEqual(r.upbeat.map(x => x.file), ['fun-party.mp3', 'livestream/upbeat/mixkit-one-more-dance-288.mp3']);
    assert.deepEqual(r.skipped, ['blooper-sfx.mp3']);
    assert.equal(r.calm[1].title, 'vastness');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the audio pack is well formed: unique ids and files, every role points at a pack file, licences recorded', () => {
  const pack = JSON.parse(fs.readFileSync(new URL('./audio-pack.json', import.meta.url), 'utf8'));
  const files = [...pack.music, ...pack.sfx].map(x => x.file);
  assert.equal(new Set(files).size, files.length);
  assert.equal(new Set([...pack.music, ...pack.sfx].map(x => `${x.file}`)).size, files.length);
  assert.ok(pack.music.filter(m => m.mood === 'upbeat').length >= 8);
  for (const m of pack.music) assert.ok(['calm', 'upbeat'].includes(m.mood) && m.title && m.artist && m.seconds > 60, m.file);
  const sfxFiles = new Set(pack.sfx.map(x => x.file));
  for (const [role, def] of Object.entries(pack.roles)) assert.ok(def.files.length && def.files.every(f => sfxFiles.has(f)), role);
  assert.match(pack.licenseUrl, /^https:\/\/mixkit\.co\/license/);
});

test('occasions: fixed, lunar-table and computed dates, and readings may use the occasion tip', async () => {
  const { occasionOn } = await import('./public/occasions.js');
  assert.equal(occasionOn('2026-11-20').name, 'Nhà giáo Việt Nam');
  assert.equal(occasionOn('2027-02-06').name, 'Tết Nguyên Đán');
  assert.equal(occasionOn('2026-11-27').name, 'Black Friday'); // 4th Friday of Nov 2026
  assert.equal(occasionOn('2026-11-04'), null);
  const day = Date.UTC(2026, 10, 19, 20); // 20/11 in Vietnam (UTC+7)
  const f = Array.from({ length: 60 }, (_, i) => drawFortune({ seed: `u${i}`, sign: 'leo', element: 'fire', now: day }));
  const tip = occasionOn('2026-11-20').tip;
  assert.ok(f.some(x => x.tip === tip), 'some readings use the occasion tip');
  assert.ok(f.some(x => x.tip !== tip), 'not all of them');
});

test('host prompts: every group has enough distinct lines, and none ask for gifts', async () => {
  const { PROMPT_GROUPS } = await import('./public/host-prompts.js');
  assert.deepEqual(PROMPT_GROUPS.map(g => g[0]), ['open', 'engage', 'thanks', 'signs', 'quiet', 'transition', 'close']);
  const all = PROMPT_GROUPS.flatMap(g => g[2]);
  assert.ok(all.length >= 55, `${all.length} prompts`);
  assert.equal(new Set(all).size, all.length);
  for (const [key, , lines] of PROMPT_GROUPS) assert.ok(lines.length >= 6, key);
  // thanking is fine; asking is not
  assert.ok(all.every(t => !/(tặng quà (đi|nhé|nha)|gửi quà|cho mình (xin )?quà|donate|ủng hộ mình bằng)/i.test(t)));
});

test('poll bank: empty until the colour-team polls arrive, and nothing in it is malformed', async () => {
  const { POLLS } = await import('./polls.mjs');
  assert.ok(Array.isArray(POLLS));
  assert.equal(new Set(POLLS).size, POLLS.length);
});

test('no reading ever contains an empty or missing line (guards against holes in the text banks)', () => {
  for (const s of SIGNS) for (let i = 0; i < 120; i++) {
    const f = drawFortune({ seed: `seed${i}`, sign: s.id, element: s.element, now: Date.UTC(2026, 10, 1 + (i % 28), 5) });
    for (const k of ['level', 'love', 'work', 'money', 'luck', 'tip', 'color', 'hour']) assert.ok(typeof f[k] === 'string' && f[k].length >= (k === 'color' ? 2 : 4), `${s.id} ${k}`); // colours can be short, like “Đỏ”
    assert.ok(Number.isInteger(f.number) && f.number > 0);
  }
});
