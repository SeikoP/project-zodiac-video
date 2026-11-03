// "Bầu trời ngày bạn chào đời": a viewer comments their birthday and the overlay shows where the Sun, Moon and
// planets really stood that day (astronomy-engine, offline), with a short reading for the Moon, Venus and Mars.
// Without a year only the Sun is certain (the Moon changes sign every ~2.5 days), so a day/month gets the Sun
// and an invitation to add the year. The year is used for the computation only; it is never put on screen.
import { PLANETS, longitudeOf } from './sky.mjs';

const ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

// day/month → the sign the Sun is in on that date (popular Vietnamese boundaries).
const SIGN_START = [[1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'], [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'], [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn']];
export function signOfDate(day, month) {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  const [, start, id] = SIGN_START[month - 1];
  return day >= start ? id : month === 1 ? 'capricorn' : SIGN_START[month - 2][2];
}
const ELEMENT = { aries: 'fire', leo: 'fire', sagittarius: 'fire', taurus: 'earth', virgo: 'earth', capricorn: 'earth', gemini: 'air', libra: 'air', aquarius: 'air', cancer: 'water', scorpio: 'water', pisces: 'water' };

// One line per planet and element: what that placement is said to colour (entertainment only).
export const READINGS = Object.freeze({
  moon: {
    title: 'Trong lòng',
    fire: 'cảm xúc đến nhanh như lửa: giận nhanh, quên cũng nhanh',
    earth: 'cần sự yên ổn mới thấy bình an, thương ai là thương bền',
    air: 'nói ra được là nhẹ lòng, cần người hiểu mình qua lời',
    water: 'nhạy cảm, đọc được lòng người, dễ thương mà cũng dễ tủi',
  },
  venus: {
    title: 'Khi yêu',
    fire: 'yêu là phải rõ ràng, nồng nhiệt, thích được theo đuổi',
    earth: 'yêu bằng hành động: nhớ từng bữa ăn, từng chi tiết nhỏ',
    air: 'phải hợp chuyện mới yêu, cần tự do và tiếng cười',
    water: 'yêu sâu, nhớ lâu, đã thương là khó buông',
  },
  mars: {
    title: 'Khi bắt tay vào việc',
    fire: 'làm ngay nghĩ sau, có lửa là không ai cản nổi',
    earth: 'chậm mà chắc, đã bắt đầu là làm tới cùng',
    air: 'nhiều ý tưởng, xoay xở giỏi, chán nhanh nếu lặp lại',
    water: 'làm theo cảm giác, mạnh nhất khi bảo vệ người mình thương',
  },
});

// "12/8", "12-8-1998", "12.8.98", "12 tháng 8 năm 1998" → { day, month, year|null }; null when there is no date.
// A two-digit year is read as 19xx/20xx, whichever is not in the future.
export function parseBirthDate(comment, thisYear = new Date().getFullYear()) {
  const t = String(comment ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const m = t.match(/(?:^|[^\d])(\d{1,2})\s*(?:[/.-]|thang)\s*(\d{1,2})(?:\s*(?:[/.-]|nam)\s*(\d{2}|\d{4}))?(?!\d)/);
  if (!m) return null;
  let day = Number(m[1]), month = Number(m[2]);
  if (month > 12 && day <= 12) [day, month] = [month, day]; // tolerate m/d
  if (!signOfDate(day, month) || day > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return null;
  let year = m[3] ? Number(m[3]) : null;
  if (year !== null && year < 100) year += 2000 + year > thisYear ? 1900 : 2000;
  if (year !== null && (year < 1920 || year > thisYear)) year = null;
  if (year !== null && month === 2 && day === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return null;
  return { day, month, year };
}

// The planets on that day at noon in Vietnam (UTC+7). Without a year only the Sun's sign (from the date) is given.
export function birthChart({ day, month, year }) {
  const sun = signOfDate(day, month);
  if (!year) return { sun, planets: [{ id: 'sun', sign: sun }], full: false };
  const date = new Date(Date.UTC(year, month - 1, day, 5));
  const planets = PLANETS.map(p => {
    const lon = longitudeOf(p.body, date);
    return { id: p.id, sign: ZODIAC[Math.floor((((lon % 360) + 360) % 360) / 30)], deg: Math.floor(((lon % 360) + 360) % 30) };
  });
  return { sun, planets, full: true };
}

// The three lines shown under the chart (Moon, Venus, Mars), each tied to the sign the planet stood in.
export function readChart(chart) {
  if (!chart.full) return [];
  return ['moon', 'venus', 'mars'].map(id => {
    const sign = chart.planets.find(p => p.id === id).sign;
    return { planet: id, sign, title: READINGS[id].title, text: READINGS[id][ELEMENT[sign]] };
  });
}
