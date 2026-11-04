// Shirt colours from the channel token zodiac-paper-doodle-meme-v4; water is a slate tint
// light enough for the ink glyph on the wheel.
export const ELEMENT = {
  fire: { color: '#E97A66', name: 'Lửa' },
  earth: { color: '#F2C45C', name: 'Đất' },
  air: { color: '#8EC0B9', name: 'Khí' },
  water: { color: '#94AAC8', name: 'Nước' },
};

// One line per colour team for the spotlight cards shown while the room is quiet.
export const TEAM_LINES = {
  red: 'Đỏ rực như lửa trại: hô to là cả sân nghe thấy.',
  yellow: 'Vàng như nắng sớm: có mặt là sáng cả phòng.',
  green: 'Xanh bình tĩnh mà bền: càng về sau càng mạnh.',
  blue: 'Lam êm như sóng, nhưng dồn lại thì cả biển.',
};

export const mascot = (team, mood = 'idle') => `/mascots/${team}-${mood}.svg`;
export const fmt = n => Math.round(Number(n || 0)).toLocaleString('vi-VN');
export const clock = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Subscribes to the server's event stream; EventSource reconnects on its own.
// Behind a tunnel (any host that is not this machine) server-sent events do not stream, so the page polls instead.
const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])$/;
function poll(handlers, onStatus) {
  let id = '', up = null, misses = 0;
  const tick = async () => {
    try {
      const r = await fetch(`/poll?id=${id}&wait=1`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { id: next, msgs } = await r.json();
      id = next;
      misses = 0;
      if (up !== true) { up = true; onStatus?.(true); }
      for (const m of msgs) handlers[m.event]?.(m.data);
    } catch {
      // one dropped request through a tunnel is normal; only a streak of them means the server is really gone
      if (++misses >= 3 && up !== false) { up = false; onStatus?.(false); }
    }
    setTimeout(tick, misses ? 1000 : 0); // the server holds each request until there is news, so asking again at once is cheap
  };
  tick();
  return { close() {} };
}

export function subscribe(handlers, onStatus) {
  if (!LOCAL_HOST.test(location.hostname) || new URLSearchParams(location.search).has('poll')) return poll(handlers, onStatus);
  const es = new EventSource('/events');
  if (onStatus) { es.onopen = () => onStatus(true); es.onerror = () => onStatus(false); }
  for (const [name, fn] of Object.entries(handlers)) es.addEventListener(name, e => fn(JSON.parse(e.data)));
  return es;
}

export const api = (route, payload = {}) =>
  fetch(`/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json());
