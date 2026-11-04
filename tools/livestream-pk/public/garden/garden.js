// Vườn Mây: the channel's paper-doodle style drawn directly on the canvas; no generated image assets.
import { createMusic } from '../music.js';
import { createSfx } from '../sfx.js';
import { createAvatarCache, easeCamera, lodOf, plotPos, visiblePlots, worldToScreen } from './view.js';

const VP = { w: 1080, h: 1920 };
const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const stage = document.getElementById('stage'), feed = document.getElementById('feed'), hint = document.getElementById('hint'), shotLabel = document.getElementById('shotLabel');
const eventHero = document.getElementById('eventHero'), eventArt = document.getElementById('eventArt'), eventHeroTitle = document.getElementById('eventHeroTitle'), eventHeroHint = document.getElementById('eventHeroHint'), eventHeroMeta = document.getElementById('eventHeroMeta'), eventMeterFill = document.getElementById('eventMeterFill');
const audienceCount = document.getElementById('audienceCount'), eventLabel = document.getElementById('eventLabel'), sessionLabel = document.getElementById('sessionLabel'), leaders = document.getElementById('leaders');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const volume = (key, fallback) => { const n = Number(params.get(key)); return params.has(key) && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; };
const music = createMusic({ volume: volume('music', 0.16) }), playSfx = createSfx(volume('sfx', 0.2));
const sfx = (name, arg, { duck = .72, ms = 1500 } = {}) => {
  if (duck < 1) music.duck(duck, ms);
  playSfx(name, arg);
};
// No visible audio control: LIVE/OBS attempts playback automatically. A normal browser that
// blocks autoplay unlocks on the first interaction anywhere, without adding overlay chrome.
const unlockAudio = () => music.resume();
addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
addEventListener('keydown', unlockAudio, { once: true, capture: true });
const fit = () => {
  const scale = Math.min(innerWidth / VP.w, innerHeight / VP.h);
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(innerWidth - VP.w * scale) / 2}px`;
  stage.style.top = `${(innerHeight - VP.h * scale) / 2}px`;
};
addEventListener('resize', fit); fit();

let meta = null, lastSessionNo = null, focusPlot = null, focusAt = 0, focusMs = 0;
const plots = new Map(), floaters = [], avatars = createAvatarCache(160);
let cam = { x: 1350, y: 480, zoom: .38 }, from = cam, to = cam, shotAt = 0, cameraEaseMs = 1800, serverEvent = null, presentedEventKind = null;
const visualEvent = () => serverEvent && presentedEventKind === serverEvent.kind ? serverEvent : null;
const C = { paper: '#F6F0E6', card: '#FFFDF9', ink: '#2F3C44', softInk: '#5C6B75', hair: '#4B5B61', skin: '#F1C6A0', shadow: '#D0C1B3', teal: '#8EC0B9', coral: '#E97A66', ochre: '#F2C45C', slate: '#435064' };
const POT_ACCENTS = { 'cloud-1': '#EBC49E', 'cloud-2': '#B8D6C4', 'cloud-3': '#F2D57D', 'cloud-4': '#DDB6BA' };
const TIER_SCENES = [
  { rail: '#B8D6C4', trim: '#8EC0B9', flag: '#EBC49E' },
  { rail: '#D9C7A9', trim: '#A9CDBF', flag: '#F2C45C' },
  { rail: '#E9D38C', trim: '#E3A17F', flag: '#F2C45C' },
  { rail: '#C8C4D7', trim: '#9FBDB6', flag: '#DDB6BA' },
];
const eventNames = { rain: 'Mưa tưới', pests: 'Đợt sâu bệnh', merchant: 'Chợ phiên', golden: 'Giờ vàng' };
const EVENT_ART = {
  rain: '/garden/assets/event-rain.svg',
  pests: '/garden/assets/event-pests.svg',
  merchant: '/garden/assets/event-merchant.svg',
  golden: '/garden/assets/event-golden.svg',
};
const DECOR_ART = [
  '/garden/assets/decor-watering-can.svg',
  '/garden/assets/decor-birdhouse.svg',
  '/garden/assets/decor-windchime.svg',
  '/garden/assets/decor-lantern.svg',
];
const POT_ART = {
  clay: '/garden/assets/pot-clay.svg',
  glazed: '/garden/assets/pot-glazed.svg',
  banded: '/garden/assets/pot-banded.svg',
  royal: '/garden/assets/pot-royal.svg',
  astral: '/garden/assets/pot-astral.svg',
};
const POT_LABEL = { clay: 'Đất nung', glazed: 'Men lá', banded: 'Viền đồng', royal: 'Bệ ngọc', astral: 'Tinh tú' };
const CROP_ART = {
  rau: { common: '/garden/assets/crop-rau.svg', lush: '/garden/assets/crop-rau-lush.svg', golden: '/garden/assets/crop-rau-golden.svg' },
  huongduong: { common: '/garden/assets/crop-huongduong.svg', lush: '/garden/assets/crop-huongduong-lush.svg', golden: '/garden/assets/crop-huongduong-golden.svg' },
  nammay: { common: '/garden/assets/crop-nammay.svg', lush: '/garden/assets/crop-nammay-lush.svg', golden: '/garden/assets/crop-nammay-golden.svg' },
};
const artCache = new Map();
function gardenArt(src) {
  if (!src) return null;
  if (!artCache.has(src)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    artCache.set(src, image);
  }
  const image = artCache.get(src);
  return image.complete && image.naturalWidth ? image : null;
}
const FONT = '"Patrick Hand", "Segoe Print", cursive';
const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

function say(text, ms = 6500) {
  const li = el('li', text);
  feed.append(li);
  while (feed.children.length > 2) feed.firstChild.remove();
  setTimeout(() => li.remove(), ms);
}
function show(title, sub = '', ms = 3500) {
  say(sub ? `${title} · ${sub}` : title, Math.min(7000, ms));
}

const nameOf = id => plots.get(id)?.owner?.nickname ?? 'Ai đó';
const posOf = id => { const p = plots.get(id); return p && meta ? plotPos(p, meta) : null; };
function float(kind, id) { const p = posOf(id); if (p) floaters.push({ kind, ...p, born: performance.now() }); }

function handleFx(fx) {
  const C = meta?.copy;
  if (!C) return;
  switch (fx.type) {
    case 'joined': {
      sfx('join', 0, { duck: .86, ms: 700 });
      const tier = meta.tiers.find(t => t.id === fx.tier)?.label ?? 'khu vườn';
      if (fx.count > 2) say(`${fx.count} người vừa vào · ${tier}`, 4500);
      break;
    }
    case 'gift':
      if (fx.tier === 'tree' || fx.tier === 'rain') say(`${fx.nickname ?? 'Ai đó'} · ${C.gifts[fx.tier]}`, 5200);
      break;
    case 'steal': sfx('cardFlip'); say(C.steal(nameOf(fx.thiefPlotId), nameOf(fx.plotId)), 5200); float('coin', fx.plotId); break;
    case 'catch': sfx('cleared'); say(C.caught(nameOf(fx.plotId), nameOf(fx.thiefPlotId)), 5200); float('sparkle', fx.plotId); break;
    case 'dog-bark': sfx('bossHit', null, { duck: .82, ms: 700 }); break;
    case 'levelup': sfx('milestone', null, { duck: .5, ms: 1800 }); say(C.levelUp(nameOf(fx.plotId), fx.level), 5200); float('sparkle', fx.plotId); break;
    case 'plant': sfx('sparkle', null, { duck: .9, ms: 500 }); break;
    case 'harvest': sfx('cleared', null, { duck: .75, ms: 1000 }); break;
    case 'pest-cleared': sfx('cleared', null, { duck: .82, ms: 800 }); break;
    case 'weed-cleared': sfx('cardFlip', null, { duck: .86, ms: 600 }); break;
    case 'fertilize': sfx('boon', null, { duck: .78, ms: 1000 }); break;
    case 'title': sfx('title', null, { duck: .4, ms: 2200 }); say(`${fx.nickname ?? 'Người làm vườn'} · ${fx.titles?.join(' · ') ?? 'danh hiệu mới'}`, 6000); break;
    case 'card': show(`${fx.nickname ?? 'Người làm vườn'} · cấp ${fx.level}`, `${fx.competition?.rank ? `Hạng ${fx.competition.rank} · ` : ''}${fx.competition?.points ?? 0} điểm · ${(fx.competition?.titles ?? []).map(t => t.label).join(' · ') || 'Chưa có danh hiệu'}`, 6000); break;
    case 'event-start':
      music.setMood(fx.kind === 'pests' || fx.kind === 'golden' ? 'upbeat' : 'calm');
      break;
    case 'event-end':
      if (presentedEventKind === fx.kind) sfx(fx.ok === false ? 'fall' : 'actClose', null, { duck: .48, ms: 1800 });
      presentedEventKind = null;
      music.setMood('calm');
      break;
    default:
  }
}

function renderCompetition(value) {
  const session = value?.session, current = value?.standings ?? [], previous = session?.previous?.podium ?? [];
  const rows = current.length ? current.slice(0, 3) : previous;
  sessionLabel.textContent = current.length ? `Phiên ${session.no}` : previous.length ? `Kết quả phiên ${session.previous.no}` : session ? `Phiên ${session.no} · chưa có điểm` : 'Chờ khách đầu tiên';
  leaders.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('li'); empty.className = 'empty';
    empty.textContent = 'Người đầu tiên sẽ mở phiên mới.'; leaders.append(empty); return;
  }
  for (const row of rows) {
    const item = document.createElement('li'), rank = document.createElement('span'), name = document.createElement('span'), points = document.createElement('b');
    rank.className = 'rank'; rank.textContent = `${row.rank}.`;
    name.className = 'leader-name'; name.textContent = row.nickname;
    points.className = 'points'; points.textContent = `${row.points} đ`;
    item.append(rank, name, points);
    if (row.title) { const title = document.createElement('small'); title.className = 'leader-title'; title.textContent = row.title; item.append(title); }
    if (row.rank === 1 && current.length && row.milestone) { const next = document.createElement('small'); next.className = 'leader-next'; next.textContent = `Tiếp theo · ${row.milestone.label} (${row.milestone.progress}/${row.milestone.target})`; item.append(next); }
    leaders.append(item);
  }
  if (lastSessionNo !== null && session?.no > lastSessionNo && previous.length) {
    show('Danh hiệu phiên LIVE', previous.map(row => `${row.nickname} · ${row.title}`).join('  /  '), 6500);
  }
  lastSessionNo = session?.no ?? null;
}

async function refreshStatus() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    audienceCount.textContent = `${status.viewers} người đang giữ vườn`;
    eventLabel.textContent = status.event ? `Sự kiện · ${eventNames[status.event] ?? status.event}` : 'Nhà kính đang yên bình';
    if (status.competition) renderCompetition(status.competition);
  } catch { /* the live Garden stream continues without the optional status ribbon */ }
}

function onMessage(event, data) {
  if (event === 'meta') {
    meta = data;
    hint.textContent = 'Bình luận để nhận chậu · trồng · tưới · hái';
    music.setLists(data.music ?? { calm: [], upbeat: [] });
    music.resume();
  } else if (event === 'reset') {
    plots.clear(); floaters.length = 0; serverEvent = null; presentedEventKind = null;
    say('Vườn mô phỏng đã làm mới', 4200);
  } else if (event === 'frame') {
    for (const [id, p] of Object.entries(data.parts.plots ?? {})) plots.set(id, p);
    if ('event' in data.parts) {
      serverEvent = data.parts.event;
      if (!serverEvent) presentedEventKind = null;
      music.setMood(serverEvent?.kind === 'golden' || serverEvent?.kind === 'pests' ? 'upbeat' : 'calm');
    }
    if (data.parts.competition) renderCompetition(data.parts.competition);
    for (const fx of data.fx ?? []) handleFx(fx);
  } else if (event === 'shot') {
    from = cam;
    to = { x: data.x, y: data.y, zoom: data.zoom };
    cameraEaseMs = Math.max(600, Number(data.easeMs) || 1800);
    const owner = data.plotId ? plots.get(data.plotId)?.owner?.nickname : data.nickname;
    const giftName = data.giftKind && meta?.copy?.gifts?.[data.giftKind];
    const labels = {
      overview: `TOÀN CẢNH · ${[...plots.values()].filter(p => p.owner && p.awake).length} CHẬU`,
      welcome: owner ? `CHÀO ${owner.toUpperCase()}` : 'NGƯỜI MỚI VÀO VƯỜN',
      gift: owner ? `${owner.toUpperCase()} · ${giftName ?? 'QUÀ VƯỜN'}` : (giftName ?? 'KHOẢNH KHẮC ĐẶC BIỆT'),
      steal: 'TRỘM CÂY',
      catch: 'BẮT QUẢ TANG',
      levelup: owner ? `${owner.toUpperCase()} · LÊN CẤP` : 'LÊN CẤP',
      ripe: owner ? `${owner.toUpperCase()} · CÂY CHÍN` : 'CÂY ĐÃ CHÍN',
      event: `SỰ KIỆN · ${eventNames[data.eventKind] ?? 'TOÀN VƯỜN'}`,
    };
    shotLabel.textContent = labels[data.kind] ?? 'VƯỜN MÂY';
    shotLabel.classList.toggle('active', data.kind !== 'overview');
    if (data.kind === 'event' && data.eventKind) {
      presentedEventKind = data.eventKind;
      const role = ({ rain: 'flow', pests: 'bossStart', merchant: 'chestOpen', golden: 'lucky' })[data.eventKind] ?? 'actOpen';
      sfx(role, null, { duck: .28, ms: 2800 });
    } else if (data.kind === 'gift') {
      const role = ({ dew: 'flow', star: 'sparkle', rain: 'flow', tree: 'starFly' })[data.giftKind] ?? 'milestone';
      sfx(role, null, { duck: data.giftKind === 'tree' || data.giftKind === 'rain' ? .35 : .68, ms: data.giftKind === 'tree' ? 2800 : 1600 });
    }
    focusPlot = data.plotId ?? null;
    focusAt = performance.now(); focusMs = data.holdMs ?? 5200;
    shotAt = performance.now();
  }
}

// SSE first; if the stream drops twice (a tunnel that cannot stream) fall back to long-polling.
function connect() {
  let fails = 0;
  const es = new EventSource('/events');
  for (const e of ['meta', 'frame', 'shot', 'reset']) es.addEventListener(e, m => { fails = 0; onMessage(e, JSON.parse(m.data)); });
  es.onerror = () => { if (++fails >= 2) { es.close(); poll(); } };
}
async function poll(id = '') {
  try {
    const r = await (await fetch(`/poll?wait=1${id ? `&id=${id}` : ''}`)).json();
    for (const m of r.msgs) onMessage(m.event, m.data);
    setTimeout(() => poll(r.id), 50);
  } catch { setTimeout(() => poll(id), 2000); }
}

// ---------- paper-doodle scene ----------
function cloudPath(width, height) {
  ctx.beginPath();
  ctx.moveTo(-width * .49, height * .12);
  ctx.bezierCurveTo(-width * .54, -height * .08, -width * .43, -height * .31, -width * .30, -height * .30);
  ctx.bezierCurveTo(-width * .24, -height * .52, -width * .07, -height * .47, width * .01, -height * .34);
  ctx.bezierCurveTo(width * .11, -height * .52, width * .25, -height * .40, width * .28, -height * .23);
  ctx.bezierCurveTo(width * .48, -height * .28, width * .53, -height * .06, width * .47, height * .12);
  ctx.bezierCurveTo(width * .51, height * .34, width * .33, height * .43, width * .19, height * .35);
  ctx.bezierCurveTo(width * .03, height * .47, -width * .11, height * .40, -width * .20, height * .33);
  ctx.bezierCurveTo(-width * .38, height * .47, -width * .53, height * .33, -width * .49, height * .12);
  ctx.closePath();
}

function drawBackdrop(now) {
  const sky = ctx.createLinearGradient(0, 0, 0, VP.h);
  sky.addColorStop(0, visualEvent()?.kind === 'golden' ? '#F5E1A3' : '#DCEBE4');
  sky.addColorStop(.56, '#F6F0E6');
  sky.addColorStop(1, '#D8E1D5');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VP.w, VP.h);

  const drift = reduceMotion ? 0 : Math.sin(now / 5200) * 16;
  ctx.save();
  ctx.globalAlpha = .38;
  ctx.fillStyle = C.ochre;
  ctx.beginPath(); ctx.arc(850 + drift, 370, 112, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.globalAlpha = .08;
  for (let x = -80; x < VP.w + 120; x += 180) {
    ctx.beginPath(); ctx.moveTo(x + drift * .25, 250); ctx.lineTo(x - 80 + drift * .25, VP.h); ctx.stroke();
  }
  for (let y = 420; y < VP.h; y += 260) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VP.w, y + 70); ctx.stroke();
  }
  ctx.restore();

  ctx.save(); ctx.strokeStyle = 'rgba(47,60,68,.16)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const side of [62, VP.w - 62]) {
    const dir = side < VP.w / 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(side, -20); ctx.bezierCurveTo(side + dir * 52, 520, side - dir * 30, 1180, side, VP.h + 30); ctx.stroke();
    for (let y = 240; y < VP.h; y += 285) {
      ctx.save(); ctx.globalAlpha = .38; drawLeaf(side + dir * 10, y, 22, dir < 0 ? .8 : -.8, y % 570 ? C.teal : C.ochre); ctx.restore();
    }
  }
  ctx.restore();
}

function drawLeaf(x, y, size, angle = 0, color = C.teal) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-size * .8, -size * .6, -size * 1.1, size * .7, 0, size); ctx.bezierCurveTo(size * .8, size * .5, size * .8, -size * .5, 0, 0); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, size * .12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, size * .85); ctx.quadraticCurveTo(0, size * .35, size * .18, size * .1); ctx.stroke();
  ctx.restore();
}

function drawVine(x1, y1, x2, y2) {
  const s = cam.zoom;
  const a = worldToScreen({ x: x1, y: y1 }, cam, VP), b = worldToScreen({ x: x2, y: y2 }, cam, VP);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 15 * s; ctx.strokeStyle = C.teal;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + 100 * s, a.y + 100 * s, b.x - 120 * s, b.y - 100 * s, b.x, b.y); ctx.stroke();
  ctx.lineWidth = 5 * s; ctx.strokeStyle = C.ink; ctx.stroke();
  drawLeaf(a.x + 35 * s, a.y + 45 * s, 42 * s, -.9, C.teal);
  drawLeaf(b.x - 25 * s, b.y - 40 * s, 36 * s, 1.1, C.ochre);
  ctx.restore();
}

function drawTier(tier, index) {
  const cfg = meta.cfg;
  const center = worldToScreen({ x: cfg.tierWidth / 2, y: index * cfg.tierHeight + cfg.tierHeight / 2 }, cam, VP);
  const s = cam.zoom, scene = TIER_SCENES[index] ?? TIER_SCENES[0];
  const bays = 3, rows = Math.ceil(cfg.plotsPerTier / cfg.plotsPerRow);
  const bayCols = cfg.plotsPerRow / bays, bayW = bayCols * cfg.plotCell, totalW = cfg.plotsPerRow * cfg.plotCell;
  const shelfStart = -(rows - 1) * cfg.plotCell / 2 - 18;
  const roofY = shelfStart - 155, deckY = shelfStart + (rows - 1) * cfg.plotCell + 72;
  ctx.save(); ctx.translate(center.x, center.y); ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  ctx.fillStyle = C.shadow;
  ctx.beginPath(); ctx.roundRect(-totalW / 2 - 70, deckY + 26, totalW + 140, 88, 28); ctx.fill();
  ctx.fillStyle = scene.trim; ctx.strokeStyle = C.ink; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.roundRect(-totalW / 2 - 70, deckY, totalW + 140, 82, 28); ctx.fill(); ctx.stroke();

  for (let bay = 0; bay < bays; bay++) {
    const bx = -totalW / 2 + bayW * (bay + .5);
    const left = bx - bayW / 2 + 24, right = bx + bayW / 2 - 24;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(left, roofY + 34); ctx.quadraticCurveTo(bx, roofY - 72, right, roofY + 34); ctx.stroke();
    ctx.strokeStyle = scene.rail; ctx.lineWidth = 22; ctx.stroke();

    for (const x of [left, right]) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, roofY + 34); ctx.lineTo(x, deckY + 10); ctx.stroke();
      ctx.strokeStyle = scene.rail; ctx.lineWidth = 15; ctx.stroke();
    }

    for (let row = 0; row < rows; row++) {
      const shelfY = shelfStart + row * cfg.plotCell;
      ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.roundRect(left + 18, shelfY + 13, bayW - 84, 31, 12); ctx.fill();
      ctx.fillStyle = row % 2 ? C.paper : scene.rail; ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(left + 18, shelfY, bayW - 84, 30, 12); ctx.fill(); ctx.stroke();
    }

    const signW = Math.min(370, bayW - 80);
    ctx.fillStyle = bay % 2 ? scene.flag : C.card; ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(bx - signW / 2, roofY - 46, signW, 58, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${tier.label} · ${String.fromCharCode(65 + bay)}`, bx, roofY - 17);

    const deco = gardenArt(DECOR_ART[(index + bay) % DECOR_ART.length]);
    if (deco) { ctx.save(); ctx.globalAlpha = .9; ctx.drawImage(deco, right - 105, roofY + 58, 86, 86); ctx.restore(); }
  }
  ctx.restore();
}

function drawTierLandmark(index) {
  const cfg = meta.cfg, at = worldToScreen({ x: cfg.tierWidth * .84, y: index * cfg.tierHeight + cfg.tierHeight * .56 }, cam, VP);
  ctx.save(); ctx.translate(at.x, at.y); ctx.scale(cam.zoom, cam.zoom);
  ctx.strokeStyle = C.ink; ctx.fillStyle = C.card; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (index === 0) {
    ctx.beginPath(); ctx.moveTo(0, 38); ctx.quadraticCurveTo(-4, 4, 0, -28); ctx.stroke();
    drawLeaf(-1, -10, 30, -.8, C.teal); drawLeaf(0, 10, 26, .75, C.ochre);
  } else if (index === 1) {
    ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); ctx.stroke(); }
  } else if (index === 2) {
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -35); ctx.moveTo(-28, -35); ctx.lineTo(28, -35); ctx.lineTo(22, 26); ctx.quadraticCurveTo(0, 48, -22, 26); ctx.closePath();
    ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(0, -15); ctx.strokeStyle = C.ochre; ctx.lineWidth = 6; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-48, 28); ctx.lineTo(-39, -22); ctx.lineTo(-10, 3); ctx.lineTo(0, -43); ctx.lineTo(13, 3); ctx.lineTo(40, -22); ctx.lineTo(49, 28); ctx.closePath();
    ctx.fillStyle = C.teal; ctx.fill(); ctx.stroke(); drawSparkle(0, -8, 9, C.ochre);
  }
  ctx.restore();
}

function drawSeedling(stage) {
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (stage === 0) {
    ctx.beginPath(); ctx.ellipse(0, -1, 9, 6, -.2, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke(); return;
  }
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, -8, 2, -31 - stage * 4); ctx.stroke();
  if (stage >= 1) drawLeaf(-1, -19, 16, -1.1, stage === 4 ? C.shadow : C.teal);
  if (stage >= 2) drawLeaf(1, -25, 15, .85, stage === 4 ? C.shadow : C.teal);
}

function drawRipeCrop(type, stage) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (stage < 3) { drawSeedling(stage); return; }
  if (type === 'huongduong') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(3, -15, 0, -39); ctx.stroke();
    drawLeaf(-1, -15, 15, -1.2); drawLeaf(0, -20, 14, .8);
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 18, -47 + Math.sin(a) * 17, 8, 13, a, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, -47, 12, 0, Math.PI * 2); ctx.fillStyle = C.hair; ctx.fill(); ctx.stroke();
  } else if (type === 'nammay') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, -12, 2, -31); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-27, -27); ctx.quadraticCurveTo(-23, -55, 1, -52); ctx.quadraticCurveTo(25, -53, 29, -28); ctx.quadraticCurveTo(3, -19, -27, -27); ctx.closePath(); ctx.fillStyle = stage === 4 ? C.shadow : C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -30); ctx.quadraticCurveTo(0, -37, 12, -29); ctx.stroke();
  } else {
    drawLeaf(0, -25, 22, -.9, stage === 4 ? C.shadow : C.teal);
    drawLeaf(0, -29, 20, .8, stage === 4 ? C.shadow : C.ochre);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(-5, -10, 1, -35); ctx.stroke();
  }
}

function drawPlot(p, lod) {
  if (!p.owner || !p.awake) return;
  const at = worldToScreen(plotPos(p, meta), cam, VP), size = meta.cfg.plotCell * 1.1 * cam.zoom;
  ctx.save(); ctx.translate(at.x, at.y); ctx.scale(size / 100, size / 100); ctx.globalAlpha = 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const potImage = gardenArt(POT_ART[p.potTier] ?? POT_ART.clay);
  if (potImage) ctx.drawImage(potImage, -52, -4, 104, 62);
  else {
    ctx.beginPath(); ctx.ellipse(0, 47, 44, 9, -.03, 0, Math.PI * 2); ctx.fillStyle = C.shadow; ctx.fill();
    ctx.beginPath(); ctx.roundRect(-38, 39, 76, 10, 5); ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-35, 8); ctx.lineTo(-27, 42); ctx.quadraticCurveTo(0, 52, 28, 42); ctx.lineTo(35, 8); ctx.closePath();
    ctx.fillStyle = POT_ACCENTS[p.tier] ?? C.skin; ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-40, 1, 80, 14, 7); ctx.fillStyle = POT_ACCENTS[p.tier] ?? C.skin; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 8, 30, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#8C6650'; ctx.fill();
  }

  if (p.crop) {
    const variant = p.crop.variant ?? 'common';
    if (variant === 'golden') {
      ctx.save(); ctx.globalAlpha = .34; ctx.fillStyle = C.ochre; ctx.shadowColor = C.ochre; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(0, -42, 45, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (variant === 'lush') {
      ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(0, -38, 39, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const cropImage = (p.stage ?? 0) >= 3 ? gardenArt(CROP_ART[p.crop.type]?.[variant] ?? CROP_ART[p.crop.type]?.common) : null;
    if (cropImage) ctx.drawImage(cropImage, -49, -96, 98, 98);
    else drawRipeCrop(p.crop.type, p.stage ?? 0);

    if (p.crop.weeds) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      for (const x of [-28, -17, 22, 31]) {
        ctx.beginPath(); ctx.moveTo(x, 9); ctx.quadraticCurveTo(x - 8, -2, x - 4, -13); ctx.stroke();
        drawLeaf(x - 4, -9, 8, x < 0 ? -.9 : .9, C.teal);
      }
    }
    if (p.crop.fertilized) {
      ctx.globalAlpha = .82;
      drawSparkle(-36, -54, 7, C.ochre); drawSparkle(35, -38, 5, C.ochre);
      ctx.globalAlpha = 1;
    }
  }
  if (p.crop?.pest) {
    ctx.beginPath(); ctx.arc(31, -14, 8, 0, Math.PI * 2); ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(20, -23); ctx.moveTo(37, -18); ctx.lineTo(41, -23); ctx.stroke();
  }
  if (p.shield) {
    ctx.beginPath(); ctx.moveTo(28, -39); ctx.lineTo(40, -35); ctx.lineTo(37, -23); ctx.quadraticCurveTo(33, -18, 28, -16); ctx.quadraticCurveTo(22, -21, 20, -28); ctx.closePath(); ctx.fillStyle = C.teal; ctx.fill(); ctx.stroke();
  }
  if (p.dog) {
    ctx.beginPath(); ctx.arc(-31, -9, 5, 0, Math.PI * 2); ctx.arc(-39, -18, 4, 0, Math.PI * 2); ctx.arc(-29, -21, 4, 0, Math.PI * 2); ctx.fillStyle = C.coral; ctx.fill(); ctx.stroke();
  }
  if (p.deco?.includes('golden-tree')) {
    ctx.beginPath(); ctx.moveTo(-40, -17); ctx.lineTo(-35, -28); ctx.lineTo(-30, -18); ctx.lineTo(-19, -16); ctx.lineTo(-27, -9); ctx.lineTo(-25, 1); ctx.lineTo(-35, -4); ctx.lineTo(-44, 1); ctx.lineTo(-42, -9); ctx.lineTo(-50, -16); ctx.closePath(); ctx.fillStyle = C.ochre; ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  if (p.owner && cam.zoom >= .82) {
    const focused = focusPlot === p.id && cam.zoom >= 1.25;
    const labelY = at.y + size * .55;
    const fontSize = focused ? 29 : 18;
    const shortName = p.owner.nickname.slice(0, focused ? 12 : 7);
    const title = focused ? `${shortName} · Lv${p.owner.level} · ${POT_LABEL[p.potTier] ?? 'Đất nung'}` : shortName;
    ctx.save(); ctx.font = `${fontSize}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const maxW = focused ? 360 : 112, h = focused ? 40 : 27;
    const w = Math.min(maxW, ctx.measureText(title).width + (focused ? 24 : 14));
    ctx.fillStyle = focused ? C.ochre : 'rgba(255,253,249,.94)'; ctx.strokeStyle = C.ink; ctx.lineWidth = focused ? 4 : 2.5;
    ctx.beginPath(); ctx.roundRect(at.x - w / 2, labelY, w, h, focused ? 11 : 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(title, at.x, labelY + (focused ? 3 : 2));

    if (focused) {
      const stageName = ['Hạt', 'Mầm', 'Đang lớn', 'Chín', 'Quá lứa'][p.stage ?? 0] ?? 'Đang lớn';
      const cropName = p.crop ? (meta.crops?.[p.crop.type]?.label ?? p.crop.type) : 'Chưa trồng';
      const variant = p.crop?.variant === 'golden' ? 'Ánh kim' : p.crop?.variant === 'lush' ? 'Sum suê' : '';
      const alert = p.crop?.pest ? ' · Có sâu' : p.crop?.weeds ? ' · Có cỏ' : p.crop?.fertilized ? ' · Đã bón phân' : '';
      const status = p.crop ? `${cropName} · ${stageName}${variant ? ` · ${variant}` : ''}${alert}` : cropName;
      ctx.font = `22px ${FONT}`;
      const sw = Math.min(390, ctx.measureText(status).width + 24), sy = labelY + 45;
      ctx.fillStyle = 'rgba(255,253,249,.96)'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(at.x - sw / 2, sy, sw, 34, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.crop?.pest || p.crop?.weeds ? C.coral : C.softInk; ctx.fillText(status, at.x, sy + 2);
    }

    const avatarR = focused ? Math.max(26, size * .16) : Math.max(12, size * .095);
    const avatarX = at.x - size * .28, avatarY = at.y - size * .62;
    // A small plant-label stake physically connects identity to the pot.
    ctx.strokeStyle = C.ink; ctx.lineWidth = focused ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(avatarX + avatarR * .2, avatarY + avatarR); ctx.lineTo(at.x - size * .18, at.y - size * .05); ctx.stroke();
    ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR + 3, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = focused ? 4 : 2.5; ctx.stroke();
    const img = avatars.get(p.owner.avatar);
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2); ctx.restore();
    } else {
      ctx.fillStyle = C.slate; ctx.font = `bold ${Math.round(avatarR * 1.2)}px ${FONT}`; ctx.textBaseline = 'middle';
      ctx.fillText((p.owner.nickname || '?').trim().slice(0, 1).toUpperCase(), avatarX, avatarY + 1);
    }
    ctx.restore();
  }
}

function drawDot(p) {
  if (!p.owner || !p.awake) return;
  const at = worldToScreen(plotPos(p, meta), cam, VP), r = Math.max(4, 47 * cam.zoom);
  ctx.beginPath(); ctx.ellipse(at.x, at.y, r * 1.08, r * .84, -.08, 0, Math.PI * 2);
  ctx.fillStyle = !p.crop ? C.paper : p.stage >= 3 ? (p.crop.type === 'nammay' ? C.coral : C.ochre) : C.teal;
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, 5 * cam.zoom); ctx.globalAlpha = p.awake ? 1 : .52; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawSparkle(x, y, r, color = C.ochre) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * .15, y - r * .16, x + r, y); ctx.quadraticCurveTo(x + r * .12, y + r * .13, x, y + r); ctx.quadraticCurveTo(x - r * .12, y + r * .12, x - r, y); ctx.quadraticCurveTo(x - r * .1, y - r * .12, x, y - r); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function drawAtmosphere(now, activeTierIds) {
  const cfg = meta.cfg, t = reduceMotion ? 0 : now;

  meta.tiers.forEach((tier, i) => {
    if (!activeTierIds.has(tier.id)) return;
    const y = i * cfg.tierHeight + cfg.tierHeight / 2, bays = 3;
    for (let bay = 0; bay < bays; bay++) {
      const x = cfg.tierWidth * ((bay + 1) / (bays + 1));
      const at = worldToScreen({ x: x + Math.sin(t / 2600 + bay) * 24, y: y - 250 }, cam, VP);
      ctx.globalAlpha = .28;
      drawSparkle(at.x, at.y, Math.max(3, 10 * cam.zoom), bay % 2 ? C.ochre : C.teal);
      ctx.globalAlpha = 1;
    }
  });

  const shownEvent = visualEvent();
  if (shownEvent?.kind === 'rain') {
    const wash = ctx.createLinearGradient(0, 0, 0, VP.h);
    wash.addColorStop(0, 'rgba(70,119,139,.20)'); wash.addColorStop(1, 'rgba(142,192,185,.08)');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.strokeStyle = 'rgba(52,79,94,.58)'; ctx.lineWidth = 4;
    for (let i = 0; i < 56; i++) {
      const x = (i * 79 + (t / 13) % 1160) % 1160 - 40, y = (i * 113 + (t / 7) % 2020) % 2020 - 40;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 17, y + 44); ctx.stroke();
    }
  } else if (shownEvent?.kind === 'golden') {
    const g = ctx.createRadialGradient(VP.w / 2, 650, 80, VP.w / 2, 650, 850);
    g.addColorStop(0, 'rgba(242,196,92,.28)'); g.addColorStop(1, 'rgba(242,196,92,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.globalAlpha = .82;
    for (let i = 0; i < 44; i++) drawSparkle((i * 137 + 31 + t / 28) % 1080, (i * 281 + 67 + t / 80) % 1920, 6 + (i % 4) * 3, C.ochre);
    ctx.globalAlpha = 1;
  } else if (shownEvent?.kind === 'pests') {
    ctx.fillStyle = 'rgba(233,122,102,.10)'; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.save(); ctx.strokeStyle = 'rgba(233,122,102,.72)'; ctx.lineWidth = 18; ctx.setLineDash([34, 22]);
    ctx.beginPath(); ctx.moveTo(18, 360); ctx.lineTo(18, 1720); ctx.moveTo(VP.w - 18, 360); ctx.lineTo(VP.w - 18, 1720); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 30; i++) {
      const x = (i * 173 + 70 + t / 18) % 1160 - 40, y = (i * 257 + 120 + Math.sin(t / 300 + i) * 55) % 1880;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t / 210 + i) * .45);
      ctx.fillStyle = C.coral; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-12, -18); ctx.moveTo(5, -10); ctx.lineTo(12, -18); ctx.stroke(); ctx.restore();
    }
  } else if (shownEvent?.kind === 'merchant') {
    ctx.fillStyle = 'rgba(242,196,92,.08)'; ctx.fillRect(0, 0, VP.w, VP.h);
    ctx.save(); ctx.strokeStyle = C.coral; ctx.lineWidth = 7; ctx.setLineDash([26, 14]);
    ctx.beginPath(); ctx.moveTo(60, 510); ctx.quadraticCurveTo(540, 610, 1020, 510); ctx.stroke(); ctx.restore();
    ctx.globalAlpha = .86;
    for (let i = 0; i < 26; i++) {
      const x = (i * 191 + 61) % 1080, y = (i * 313 + 93 + t / 44) % 1920;
      drawSparkle(x, y, 8 + (i % 3) * 2, i % 2 ? C.ochre : C.coral);
    }
    ctx.globalAlpha = 1;
  }
}

function renderEventHero() {
  const e = visualEvent();
  stage.classList.toggle('event-live', Boolean(e));
  eventHero.classList.toggle('on', Boolean(e));
  eventHero.setAttribute('aria-hidden', String(!e));
  if (!e) return;

  const src = EVENT_ART[e.kind] ?? '';
  if (eventArt.getAttribute('src') !== src) eventArt.setAttribute('src', src);
  eventArt.alt = eventNames[e.kind] ?? 'Sự kiện';
  eventHero.dataset.kind = e.kind;
  eventHeroTitle.textContent = eventNames[e.kind] ?? e.kind;
  eventHeroHint.textContent = meta.copy?.eventHint?.[e.kind] ?? '';

  const key = { rain: 'rainMs', pests: 'pestStormMs', merchant: 'merchantMs', golden: 'goldenMs' }[e.kind];
  const duration = Math.max(1, Number(meta.cfg?.[key]) || 1);
  const remaining = Math.max(0, Number(e.endsAt || 0) - Date.now());
  let progress = Math.max(0, Math.min(1, remaining / duration));
  let metaText = `Còn ${Math.ceil(remaining / 1000)} giây`;
  if (e.kind === 'pests' && Number(e.total) > 0) {
    const cleared = Number(e.cleared) || 0;
    progress = Math.max(0, Math.min(1, cleared / e.total));
    metaText = `${cleared}/${e.total} ổ sâu đã dọn · còn ${Math.ceil(remaining / 1000)} giây`;
  } else if (e.kind === 'rain') metaText = `Tăng trưởng ×${meta.cfg.rainMult} · ${metaText}`;
  else if (e.kind === 'golden') metaText = `Vàng ×${meta.cfg.goldenMult} · ${metaText}`;
  else if (e.kind === 'merchant') metaText = `Giá thu mua ×${meta.cfg.merchantMult} · ${metaText}`;
  eventHeroMeta.textContent = metaText;
  eventMeterFill.style.width = `${Math.round(progress * 100)}%`;
}

function drawFocus(now) {
  if (!focusPlot || now - focusAt > focusMs) return;
  const plot = plots.get(focusPlot);
  if (!plot) return;
  const at = worldToScreen(plotPos(plot, meta), cam, VP), age = (now - focusAt) / Math.max(1, focusMs);
  const radius = Math.max(80, meta.cfg.plotCell * .9 * cam.zoom) + (reduceMotion ? 0 : Math.sin(now / 130) * 12);
  ctx.save();
  const dim = ctx.createRadialGradient(at.x, at.y, radius * .45, at.x, at.y, radius * 4.2);
  dim.addColorStop(0, 'rgba(47,60,68,0)');
  dim.addColorStop(.45, 'rgba(47,60,68,.04)');
  dim.addColorStop(1, 'rgba(47,60,68,.25)');
  ctx.fillStyle = dim; ctx.fillRect(0, 0, VP.w, VP.h);
  ctx.globalAlpha = Math.max(.3, 1 - age * .58); ctx.strokeStyle = C.ochre; ctx.lineWidth = 12; ctx.shadowColor = C.ochre; ctx.shadowBlur = 30; ctx.setLineDash([20, 10]);
  ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 4; ctx.strokeStyle = C.card; ctx.beginPath(); ctx.arc(at.x, at.y, radius * .72, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawFloaters(now) {
  if (reduceMotion) return;
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], age = (now - f.born) / 1400;
    if (age >= 1) { floaters.splice(i, 1); continue; }
    const p = worldToScreen(f, cam, VP), y = p.y - age * 110 * cam.zoom;
    ctx.globalAlpha = 1 - age;
    if (f.kind === 'sparkle') drawSparkle(p.x, y, Math.max(8, 28 * cam.zoom));
    else if (f.kind === 'coin') { ctx.beginPath(); ctx.ellipse(p.x, y, 14 * cam.zoom + 4, 18 * cam.zoom + 4, -.12, 0, Math.PI * 2); ctx.fillStyle = C.ochre; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

let lastFrameAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!meta || now - lastFrameAt < 1000 / 45 - 2) return;
  lastFrameAt = now;
  cam = reduceMotion ? to : easeCamera(from, to, now - shotAt, cameraEaseMs);
  ctx.fillStyle = ({ rain: '#D8EDE8', pests: '#F1E0DA', merchant: '#F4E9D5', golden: '#F6EDCF' })[visualEvent()?.kind] ?? '#E7EFE7';
  ctx.fillRect(0, 0, VP.w, VP.h);
  drawBackdrop(now);

  const active = [...plots.values()].filter(p => p.owner && p.awake);
  const activeTierIds = new Set(active.map(p => p.tier));
  if (!activeTierIds.size) activeTierIds.add(meta.tiers[0].id);
  meta.tiers.forEach((tier, i) => { if (activeTierIds.has(tier.id)) drawTier(tier, i); });
  drawAtmosphere(now, activeTierIds);

  const { detail, dots } = visiblePlots(active, cam, VP, meta);
  const lod = lodOf(cam.zoom);
  dots.forEach(drawDot);
  detail.forEach(p => drawPlot(p, lod));
  drawFocus(now);
  drawFloaters(now);
  renderEventHero();
}
requestAnimationFrame(frame);
connect();
refreshStatus();
setInterval(refreshStatus, 8000);
