// The twelve zodiac signs and the comment parser that reads their names. The colour-team game no longer uses them; they
// stay only because Vườn Mây (garden/) keeps its twelve islands by sign and imports them from game.mjs.
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('đ', 'd');

export const SIGNS = Object.freeze([
  { id: 'aries', label: 'Bạch Dương', glyph: '♈', element: 'fire' },
  { id: 'taurus', label: 'Kim Ngưu', glyph: '♉', element: 'earth' },
  { id: 'gemini', label: 'Song Tử', glyph: '♊', element: 'air' },
  { id: 'cancer', label: 'Cự Giải', glyph: '♋', element: 'water' },
  { id: 'leo', label: 'Sư Tử', glyph: '♌', element: 'fire' },
  { id: 'virgo', label: 'Xử Nữ', glyph: '♍', element: 'earth' },
  { id: 'libra', label: 'Thiên Bình', glyph: '♎', element: 'air' },
  { id: 'scorpio', label: 'Bọ Cạp', glyph: '♏', element: 'water' },
  { id: 'sagittarius', label: 'Nhân Mã', glyph: '♐', element: 'fire' },
  { id: 'capricorn', label: 'Ma Kết', glyph: '♑', element: 'earth' },
  { id: 'aquarius', label: 'Bảo Bình', glyph: '♒', element: 'air' },
  { id: 'pisces', label: 'Song Ngư', glyph: '♓', element: 'water' },
]);

const squash = s => norm(s).replace(/[^a-z0-9]/g, '');
// Other common Vietnamese names for a sign.
const EXTRA_ALIASES = { thienyet: 'scorpio', hocap: 'scorpio', thannong: 'scorpio', trinhnu: 'virgo', sonduong: 'capricorn' };
const ALIASES = [
  ...SIGNS.flatMap(s => [[squash(s.label), s.id], [squash(s.id), s.id]]),
  ...Object.entries(EXTRA_ALIASES),
].sort((a, b) => b[0].length - a[0].length);

// Returns the sign a comment names, or null. A bare number 1-12 (optionally "#3", "số 3")
// picks by order; a sign name anywhere in the comment wins.
export function parseSign(comment) {
  const raw = String(comment ?? '').trim();
  const num = raw.match(/^(?:#|so\s*|số\s*)?(\d{1,2})$/i);
  if (num) return SIGNS[Number(num[1]) - 1]?.id ?? null;
  const text = squash(raw);
  if (!text) return null;
  let best = null;
  for (const [alias, id] of ALIASES) {
    const at = text.indexOf(alias);
    if (at >= 0 && (!best || at < best.at)) best = { at, id };
  }
  return best?.id ?? null;
}
