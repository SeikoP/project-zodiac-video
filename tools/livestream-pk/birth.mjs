// Birthday comments ("12/8", "12/8/1998"): which sign a day/month falls in, and a date parsed out of a comment.
// day/month → the sign the Sun is in on that date (popular Vietnamese boundaries).
const SIGN_START = [[1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'], [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'], [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn']];
export function signOfDate(day, month) {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  const [, start, id] = SIGN_START[month - 1];
  return day >= start ? id : month === 1 ? 'capricorn' : SIGN_START[month - 2][2];
}

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
