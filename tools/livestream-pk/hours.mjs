// Giờ hành tinh: the old astrologers' planetary hours, computed from the real sunrise and sunset where the show is.
// Daylight (sunrise → sunset) and night (sunset → next sunrise) are each split into 12 equal "hours"; the first hour
// after sunrise belongs to the ruler of that weekday, then the rulers follow the Chaldean order. A summer night hour is
// a little shorter than a winter one, and every weekday evening gets a different line-up.
import * as Astronomy from 'astronomy-engine';

export const CHALDEAN = Object.freeze(['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon']);
const WEEKDAY_RULER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']; // Sunday → Saturday
const HOUR = 3600000;

// place: { lat, lon, tz } (tz in hours east of UTC, used only for the weekday of the sunrise)
export function createHours({ lat = 10.82, lon = 106.63, tz = 7 } = {}) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const search = (dir, from, days = 2) => Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, dir, new Date(from), days)?.date.getTime() ?? null;
  let block = null; // { rise, set, nextRise, ruler } of the day that contains the last asked time

  function dayOf(t) {
    if (block && t >= block.rise && t < block.nextRise) return block;
    let rise = search(+1, t - 36 * HOUR);
    for (let n = rise && search(+1, rise + 60000); n !== null && n <= t; n = search(+1, rise + 60000)) rise = n;
    if (rise === null || rise > t) return null; // polar day/night: never for a Vietnamese show
    const set = search(-1, rise, 1), nextRise = search(+1, set, 1);
    const weekday = new Date(rise + tz * HOUR).getUTCDay();
    return (block = { rise, set, nextRise, ruler: WEEKDAY_RULER[weekday] });
  }

  // The planetary hour at time t: its ruler, when it started and ends, and the next ruler.
  function real(t) {
    const d = dayOf(t);
    if (!d) return cycle(t);
    const day = t < d.set, from = day ? d.rise : d.set, len = ((day ? d.set : d.nextRise) - from) / 12;
    const i = Math.min(11, Math.floor((t - from) / len)) + (day ? 0 : 12);
    const planet = CHALDEAN[(CHALDEAN.indexOf(d.ruler) + i) % 7];
    const startsAt = from + (i % 12) * len;
    return { planet, startsAt: Math.round(startsAt), endsAt: Math.round(startsAt + len), next: CHALDEAN[(CHALDEAN.indexOf(planet) + 1) % 7], night: !day, index: i };
  }

  // A plain rotation: one planet per `slot` ms (default a clock hour), through `planets` (default: all seven in the Chaldean order).
  function cycle(t, planets = CHALDEAN, slot = HOUR) {
    const n = Math.floor(t / slot), k = planets.length, planet = planets[((n % k) + k) % k];
    return { planet, startsAt: n * slot, endsAt: (n + 1) * slot, next: planets[(((n + 1) % k) + k) % k], night: false, index: n % 24 };
  }

  return { real, cycle };
}
