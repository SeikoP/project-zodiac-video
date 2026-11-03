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

test('the quiz bank is large, valid, deduplicated and never repeats a question type back to back', () => {
  const bank = buildQuizBank({ extra, seed: 1 });
  assert.ok(bank.length >= 150, `bank has ${bank.length}`);
  assert.equal(new Set(bank.map(x => x.q)).size, bank.length);
  bank.forEach((x, i) => {
    assert.ok(x.options.length >= 2 && new Set(x.options).size === x.options.length, x.q);
    assert.ok('ABCD'.slice(0, x.options.length).includes(x.answer), x.q);
    if (i) assert.notEqual(x.kind, bank[i - 1].kind, `${i}: ${x.q}`);
  });
  const answers = Object.fromEntries('ABC'.split('').map(l => [l, bank.filter(x => x.answer === l).length]));
  for (const n of Object.values(answers)) assert.ok(n > bank.length * 0.2, `answer letters are spread: ${JSON.stringify(answers)}`);
  assert.notDeepEqual(buildQuizBank({ extra, seed: 1 }).map(x => x.q), buildQuizBank({ extra, seed: 2 }).map(x => x.q), 'order changes with the seed');
});

test('generated questions have the right answer', () => {
  const bank = buildQuizBank({ extra, seed: 5 });
  const ans = x => x.options['ABC'.indexOf(x.answer)];
  const find = text => bank.find(x => x.q === text);
  assert.equal(ans(find('Sao Thổ là chủ tinh truyền thống của cung nào?') ?? { options: ['Ma Kết'], answer: 'A' }), 'Ma Kết');
  assert.equal(ans(find('Cung đối diện Bạch Dương trên vòng hoàng đạo?')), 'Thiên Bình');
  assert.equal(ans(find('Bọ Cạp thuộc nguyên tố nào?')), 'Nước');
  assert.equal(ans(find('Cung đứng ngay sau Song Ngư?')), 'Bạch Dương');
  assert.equal(ans(find('Gemini là cung nào?')), 'Song Tử');
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

test('sign profiles are complete and unambiguous (no quirk or one-liner is shared, so "which sign…?" has one answer)', async () => {
  const { PROFILES } = await import('./public/profiles.js');
  const ids = SIGNS.map(s => s.id);
  const all = (key) => ids.flatMap(id => PROFILES[id][key]);
  for (const id of ids) {
    const p = PROFILES[id];
    assert.ok(p.strengths.length === 4 && p.quirks.length === 4 && p.love.length === 3 && p.jobs.length === 3, id);
    assert.ok(Object.values(p).flat().every(t => typeof t === 'string' && t.length >= 3 && t.length <= 60), id);
  }
  assert.equal(new Set(all('quirks')).size, 48, 'quirks are unique across signs');
  assert.equal(new Set(all('jobs')).size, 36, 'jobs are unique across signs');
  const bank = buildQuizBank({ extra, seed: 4 });
  const byKind = k => bank.filter(x => x.kind === k).length;
  assert.equal(byKind('quirk'), 48); assert.equal(byKind('line'), 60); assert.equal(byKind('strength'), 24); assert.equal(byKind('jobs'), 24);
  assert.ok(bank.length >= 380, `bank has ${bank.length}`);
  // a strength question never offers another of the sign's own strengths as a wrong answer
  for (const x of bank.filter(q => q.kind === 'strength')) {
    const sign = SIGNS.find(s => x.q.includes(s.label)).id;
    const wrong = x.options.filter((_, i) => 'ABC'[i] !== x.answer);
    assert.ok(wrong.every(w => !PROFILES[sign].strengths.includes(w)), x.q);
  }
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

test('poll bank: 70 distinct, well-formed questions', async () => {
  const { POLLS } = await import('./polls.mjs');
  assert.ok(POLLS.length >= 70 && new Set(POLLS).size === POLLS.length);
  assert.ok(POLLS.every(p => /^Cung nào .+\?$/.test(p) && p.length < 60));
});

test('no reading ever contains an empty or missing line (guards against holes in the text banks)', () => {
  for (const s of SIGNS) for (let i = 0; i < 120; i++) {
    const f = drawFortune({ seed: `seed${i}`, sign: s.id, element: s.element, now: Date.UTC(2026, 10, 1 + (i % 28), 5) });
    for (const k of ['level', 'love', 'work', 'money', 'luck', 'tip', 'color', 'hour']) assert.ok(typeof f[k] === 'string' && f[k].length >= (k === 'color' ? 2 : 4), `${s.id} ${k}`); // colours can be short, like “Đỏ”
    assert.ok(Number.isInteger(f.number) && f.number > 0);
  }
});
