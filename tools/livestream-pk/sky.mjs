// The real sky over the show: where the Sun, Moon and planets stand in the zodiac right now (tropical,
// geocentric, from astronomy-engine — computed offline), which ones are retrograde, the Moon's phase, and
// when the Moon moves on to its next sign. The game turns this into small boons ("chiếu mệnh"): the fans of
// a sign that hosts a planet get extra starlight for the kind of action that planet rules.
import * as Astronomy from 'astronomy-engine';

const ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// boon: which kinds of starlight the planet multiplies for the fans of the sign it stands in.
export const PLANETS = Object.freeze([
  { id: 'sun', label: 'Mặt Trời', glyph: '☉', body: 'Sun', kinds: 'all', mult: 1.5, boon: 'mọi ánh sao' },
  { id: 'moon', label: 'Mặt Trăng', glyph: '☽', body: 'Moon', kinds: ['like'], mult: 2, boon: 'thả tim' },
  { id: 'mercury', label: 'Sao Thủy', glyph: '☿', body: 'Mercury', kinds: ['comment', 'quiz', 'poll', 'fortune'], mult: 2, boon: 'bình luận' },
  { id: 'venus', label: 'Sao Kim', glyph: '♀', body: 'Venus', kinds: ['follow', 'share'], mult: 2, boon: 'theo dõi · chia sẻ' },
  { id: 'mars', label: 'Sao Hỏa', glyph: '♂', body: 'Mars', kinds: ['gift'], mult: 1.5, boon: 'quà' },
  { id: 'jupiter', label: 'Sao Mộc', glyph: '♃', body: 'Jupiter', kinds: 'all', mult: 1.25, boon: 'mọi ánh sao' },
  { id: 'saturn', label: 'Sao Thổ', glyph: '♄', body: 'Saturn', kinds: ['checkin'], mult: 2, boon: 'thưởng chuỗi đêm' },
]);
export const BOON_CAP = 3;
// What a viewer does (as opposed to rewards the game hands out); "all" planets boost only these.
const ACTIONS = new Set(['comment', 'like', 'gift', 'follow', 'share', 'quiz', 'poll', 'fortune']);

// [phase angle below, name, icon, short name for tight spots]
const PHASES = [
  [22.5, 'Trăng non', '🌑', 'Trăng non'], [67.5, 'Trăng lưỡi liềm', '🌒', 'Lưỡi liềm'], [112.5, 'Trăng thượng huyền', '🌓', 'Thượng huyền'], [157.5, 'Trăng gần rằm', '🌔', 'Gần rằm'],
  [202.5, 'Trăng tròn', '🌕', 'Trăng tròn'], [247.5, 'Trăng sau rằm', '🌖', 'Sau rằm'], [292.5, 'Trăng hạ huyền', '🌗', 'Hạ huyền'], [337.5, 'Trăng tàn', '🌘', 'Trăng tàn'], [360, 'Trăng non', '🌑', 'Trăng non'],
];

function longitude(body, date) {
  if (body === 'Sun') return Astronomy.SunPosition(date).elon;
  if (body === 'Moon') return Astronomy.EclipticGeoMoon(date).lon;
  return Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon;
}
const signAt = lon => ZODIAC[Math.floor((((lon % 360) + 360) % 360) / 30)];
// Signed shortest difference b - a in degrees (handles the 360→0 wrap).
const diff = (a, b) => ((b - a + 540) % 360) - 180;

// Everything the overlay and the game need about the sky at time `t` (ms).
export function readSky(t) {
  const date = new Date(t), later = new Date(t + 3600000);
  const planets = PLANETS.map(p => {
    const lon = longitude(p.body, date);
    // apparent motion over the next hour: backwards along the zodiac = retrograde (never for Sun/Moon)
    const retro = p.id !== 'sun' && p.id !== 'moon' && diff(lon, longitude(p.body, later)) < 0;
    return { id: p.id, sign: signAt(lon), deg: Math.floor(lon % 30), retro };
  });
  const phaseDeg = Astronomy.MoonPhase(date);
  const [, phase, icon, short] = PHASES.find(([max]) => phaseDeg < max);
  // the Moon's next sign: it moves ~0.5°/h, so the hourly speed gives the time to the next 30° boundary
  const moonLon = longitude('Moon', date), speed = diff(moonLon, longitude('Moon', later));
  const toNext = 30 - (moonLon % 30);
  return {
    at: t,
    planets,
    moon: { phase, short, icon, deg: Math.round(phaseDeg), full: Math.abs(phaseDeg - 180) < 12, new: phaseDeg < 12 || phaseDeg > 348, nextSign: ZODIAC[(ZODIAC.indexOf(signAt(moonLon)) + 1) % 12], nextInMs: Math.round((toNext / speed) * 3600000) },
    mercuryRetro: planets.find(p => p.id === 'mercury').retro,
  };
}

// The multiplier the sky gives a sign's fans for one kind of starlight, and which planets gave it.
export function boonFor(sky, sign, kind) {
  let mult = 1;
  const by = [];
  for (const p of sky?.planets ?? []) {
    if (p.sign !== sign) continue;
    const def = PLANETS.find(x => x.id === p.id);
    if (def.kinds === 'all' ? !ACTIONS.has(kind) : !def.kinds.includes(kind)) continue;
    mult *= def.mult;
    by.push(p.id);
  }
  return { mult: Math.min(BOON_CAP, mult), by };
}
