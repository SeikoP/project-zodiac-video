// Builds a large, varied quiz bank: ~15 question templates generated from the sign data
// (so questions never repeat word for word), plus the hand-written trivia in quiz.json.
// Questions are interleaved by template so two of the same kind never come back to back.
import { SIGNS } from './game.mjs';
import { SIGN_DATA, MODES, ELEMENT_LABEL, insideDates } from './public/signs.js';
import { PROFILES } from './public/profiles.js';

const LETTERS = 'ABC';
const label = Object.fromEntries(SIGNS.map(s => [s.id, s.label]));
const elementOf = Object.fromEntries(SIGNS.map(s => [s.id, s.element]));
const index = Object.fromEntries(SIGNS.map((s, i) => [s.id, i]));
const ELEMENTS = Object.keys(ELEMENT_LABEL);

// Small seeded PRNG so a bank can be reproduced (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// One question: the correct text plus distractors, placed at a random letter.
function make(kind, q, correct, pool, rng) {
  const wrong = shuffle([...new Set(pool.filter(x => x !== correct))], rng).slice(0, 2);
  if (wrong.length < 2) return null;
  const options = shuffle([correct, ...wrong], rng);
  return { kind, q, options, answer: LETTERS[options.indexOf(correct)] };
}

const TEMPLATES = {
  element: rng => SIGNS.map(s => make('element', `${s.label} thuộc nguyên tố nào?`, ELEMENT_LABEL[s.element], Object.values(ELEMENT_LABEL), rng)),
  symbol: rng => SIGNS.map(s => make('symbol', `Biểu tượng của ${s.label} là gì?`, SIGN_DATA[s.id].symbol, SIGNS.map(x => SIGN_DATA[x.id].symbol), rng)),
  planet: rng => SIGNS.map(s => make('planet', `Hành tinh chủ quản truyền thống của ${s.label}?`, SIGN_DATA[s.id].planet, ['Sao Hỏa', 'Sao Kim', 'Sao Thủy', 'Mặt Trăng', 'Mặt Trời', 'Sao Mộc', 'Sao Thổ'], rng)),
  mode: rng => SIGNS.map(s => make('mode', `${s.label} thuộc nhóm tính chất nào?`, MODES[SIGN_DATA[s.id].mode], Object.values(MODES), rng)),
  opposite: rng => SIGNS.map(s => make('opposite', `Cung đối diện ${s.label} trên vòng hoàng đạo?`, label[SIGN_DATA[s.id].opposite], SIGNS.map(x => x.label), rng)),
  order: rng => SIGNS.map((s, i) => make('order', `${s.label} là cung thứ mấy trong vòng hoàng đạo?`, String(i + 1), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], rng)),
  next: rng => SIGNS.map((s, i) => make('next', `Cung đứng ngay sau ${s.label}?`, SIGNS[(i + 1) % 12].label, SIGNS.map(x => x.label), rng)),
  birthday: rng => SIGNS.flatMap(s => insideDates(s.id).map(d => make('birthday', `Sinh ngày ${d} thuộc cung nào?`, s.label, SIGNS.map(x => x.label), rng))),
  english: rng => SIGNS.map(s => make('english', `Tên tiếng Anh của ${s.label}?`, SIGN_DATA[s.id].en, SIGNS.map(x => SIGN_DATA[x.id].en), rng)),
  fromEnglish: rng => SIGNS.map(s => make('fromEnglish', `${SIGN_DATA[s.id].en} là cung nào?`, s.label, SIGNS.map(x => x.label), rng)),
  whichElement: rng => ELEMENTS.flatMap(el => [0, 1, 2].map(k => {
    const members = SIGNS.filter(s => s.element === el), others = SIGNS.filter(s => s.element !== el);
    const ask = [`Cung nào thuộc nguyên tố ${ELEMENT_LABEL[el]}?`, `Nguyên tố ${ELEMENT_LABEL[el]} gồm cung nào sau đây?`, `Chọn cung thuộc nhóm nguyên tố ${ELEMENT_LABEL[el]}:`][k];
    return make('whichElement', ask, members[k].label, others.map(s => s.label), rng);
  })),
  compat: rng => SIGNS.map(s => {
    const m = SIGN_DATA[s.id].match, others = SIGNS.filter(x => x.id !== s.id && !m.includes(x.id));
    return make('compat', `Cung nào thường được xem là hợp với ${s.label}?`, label[m[0]], others.map(x => x.label), rng);
  }),
  // Questions built from the longer sign profiles (public/profiles.js) and the one-liners in signs.js.
  strength: rng => SIGNS.flatMap(s => [0, 1].map(k => {
    const own = PROFILES[s.id].strengths, others = SIGNS.filter(x => x.id !== s.id).flatMap(x => PROFILES[x.id].strengths).filter(t => !own.includes(t));
    return make('strength', k ? `Điểm mạnh nào là của ${s.label}?` : `${s.label} nổi tiếng với điểm mạnh nào?`, own[k], others, rng);
  })),
  quirk: rng => SIGNS.flatMap(s => PROFILES[s.id].quirks.map(q => make('quirk', `Cung nào hay “${q}”?`, s.label, SIGNS.map(x => x.label), rng))),
  jobs: rng => SIGNS.flatMap(s => [0, 1].map(k => {
    const own = PROFILES[s.id].jobs, others = SIGNS.filter(x => x.id !== s.id).flatMap(x => PROFILES[x.id].jobs).filter(t => !own.includes(t));
    return make('jobs', k ? `${s.label} hợp làm nghề nào?` : `Nghề nào hợp với ${s.label}?`, own[k], others, rng);
  })),
  line: rng => SIGNS.flatMap(s => SIGN_DATA[s.id].lines.map(l => make('line', `“${l}” — câu này hợp với cung nào?`, s.label, SIGNS.map(x => x.label), rng))),
  aka: rng => [
    make('aka', 'Thiên Yết là tên gọi khác của cung nào?', 'Bọ Cạp', SIGNS.map(x => x.label), rng),
    make('aka', 'Hổ Cáp là tên gọi khác của cung nào?', 'Bọ Cạp', SIGNS.map(x => x.label), rng),
    make('aka', 'Xạ Thủ là tên gọi khác của cung nào?', 'Nhân Mã', SIGNS.map(x => x.label), rng),
    make('aka', 'Nam Dương là tên gọi khác của cung nào?', 'Ma Kết', SIGNS.map(x => x.label), rng),
  ],
};

// extra: hand-written { q, options, answer } from quiz.json. Returns a flat, interleaved list.
export function buildQuizBank({ extra = [], seed = Date.now() } = {}) {
  const rng = seeded(seed);
  const groups = Object.entries(TEMPLATES).map(([, fn]) => shuffle(fn(rng).filter(Boolean), rng));
  groups.push(shuffle(extra.filter(x => x?.q && Array.isArray(x.options) && x.options.length >= 2 && 'ABCD'.includes(x.answer)).map(x => ({ kind: 'trivia', ...x })), rng));
  // the same wording twice (a hand-written date question and a generated one) counts once
  const seen = new Set();
  for (const g of groups) for (let i = g.length - 1; i >= 0; i--) { if (seen.has(g[i].q)) g.splice(i, 1); else seen.add(g[i].q); }
  const out = [];
  let last = null;
  while (groups.some(g => g.length)) {
    // take from the non-empty group with the most left, skipping the kind we just used
    const pick = groups.filter(g => g.length && g[0].kind !== last).sort((a, b) => b.length - a.length)[0] ?? groups.find(g => g.length);
    const item = pick.shift();
    out.push(item);
    last = item.kind;
  }
  return out;
}
