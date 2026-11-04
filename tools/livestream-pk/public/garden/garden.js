// Vườn Mây: the channel's paper-doodle style drawn directly on the canvas; no generated image assets.
import { createMusic } from '../music.js';
import { createSfx } from '../sfx.js';
import { createAvatarCache, easeCamera, lodOf, plotPos, visiblePlots, worldToScreen } from './view.js';

const VP = { w: 1080, h: 1920 };
const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const stage = document.getElementById('stage'), banner = document.getElementById('banner'), feed = document.getElementById('feed'), hint = document.getElementById('hint');
const audienceCount = document.getElementById('audienceCount'), eventLabel = document.getElementById('eventLabel'), sessionLabel = document.getElementById('sessionLabel'), leaders = document.getElementById('leaders'), audioToggle = document.getElementById('audioToggle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const volume = (key, fallback) => { const n = Number(params.get(key)); return params.has(key) && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; };
const music = createMusic({ volume: volume('music', 0.18) }), playSfx = createSfx(volume('sfx', 0.18));
music.toggleMute();
let soundEnabled = false, audioOn = false;
const sfx = (name, arg) => { if (soundEnabled) playSfx(name, arg); };
audioToggle.addEventListener('click', () => {
  audioOn = !audioOn;
  soundEnabled = audioOn;
  music.toggleMute();
  if (audioOn) { music.resume(); playSfx('boop'); }
  audioToggle.textContent = audioOn ? '♫ Tắt âm thanh' : '♫ Bật âm thanh';
  audioToggle.setAttribute('aria-pressed', String(audioOn));
});
const fit = () => {
  const scale = Math.min(innerWidth / VP.w, innerHeight / VP.h);
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(innerWidth - VP.w * scale) / 2}px`;
  stage.style.top = `${(innerHeight - VP.h * scale) / 2}px`;
};
addEventListener('resize', fit); fit();

let meta = null, lastSessionNo = null, focusPlot = null, focusAt = 0, focusMs = 0;
const plots = new Map(), floaters = [], avatars = createAvatarCache(200);
let cam = { x: 1350, y: 2400, zoom: 0.34 }, from = cam, to = cam, shotAt = 0, serverEvent = null, welcomed = false;
const EASE_MS = 600;
const C = { paper: '#F6F0E6', card: '#FFFDF9', ink: '#2F3C44', softInk: '#5C6B75', hair: '#4B5B61', skin: '#F1C6A0', shadow: '#D0C1B3', teal: '#8EC0B9', coral: '#E97A66', ochre: '#F2C45C', slate: '#435064' };
const eventNames = { rain: 'Mưa mây', pests: 'Bão sâu', merchant: 'Thương lái', golden: 'Giờ vàng' };
const FONT = '"Patrick Hand", "Segoe Print", cursive';
const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });

function say(text) {
  const li = el('li', text);
  feed.append(li);
  while (feed.children.length > 4) feed.firstChild.remove();
  setTimeout(() => li.remove(), 12000);
}
let bannerTimer = 0;
function show(title, sub = '', ms = 3500) {
  banner.replaceChildren(document.createTextNode(title), ...(sub ? [el('small', sub)] : []));
  banner.classList.add('on');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('on'), ms);
}

const nameOf = id => plots.get(id)?.owner?.nickname ?? 'Ai đó';
const posOf = id => { const p = plots.get(id); return p && meta ? plotPos(p, meta) : null; };
function float(kind, id) { const p = posOf(id); if (p) floaters.push({ kind, ...p, born: performance.now() }); }

function handleFx(fx) {
  const C = meta?.copy;
  if (!C) return;
  switch (fx.type) {
    case 'joined': {
      sfx('join');
      const tier = meta.tiers.find(t => t.id === fx.tier)?.label ?? 'mây';
      if (fx.count > 1) say(`${fx.count} người vừa vào vườn · ${tier}`);
      else show(C.joined(fx.names?.[0] ?? 'bạn'), C.joinedHint(tier), 5500);
      break;
    }
    case 'gift': sfx('milestone'); show(`${fx.nickname ?? 'Ai đó'} · ${C.gifts[fx.tier]}`, fx.tier === 'tree' ? 'Thần thụ nở rộ trên tầng mây' : '', fx.tier === 'tree' || fx.tier === 'rain' ? 4200 : 2600); break;
    case 'steal': say(C.steal(nameOf(fx.thiefPlotId), nameOf(fx.plotId))); float('coin', fx.plotId); break;
    case 'catch': say(C.caught(nameOf(fx.plotId), nameOf(fx.thiefPlotId))); float('sparkle', fx.plotId); break;
    case 'dog-bark': say(C.bark(nameOf(fx.plotId))); break;
    case 'levelup': sfx('milestone'); say(C.levelUp(nameOf(fx.plotId), fx.level)); float('sparkle', fx.plotId); break;
    case 'plant': sfx('sparkle'); break;
    case 'harvest': sfx('sparkle'); if (fx.count > 3) say(`${fx.count} người vừa hái`); break;
    case 'pest-cleared': sfx('sparkle'); break;
    case 'title': sfx('title'); show(`${fx.nickname ?? 'Người làm vườn'} nhận danh hiệu`, fx.titles?.join(' · ') ?? '', 5000); break;
    case 'card': show(`${fx.nickname ?? 'Người làm vườn'} · cấp ${fx.level}`, `${fx.competition?.rank ? `Hạng ${fx.competition.rank} · ` : ''}${fx.competition?.points ?? 0} điểm phiên · ${(fx.competition?.titles ?? []).map(t => t.label).join(' · ') || 'Chưa có danh hiệu'} · Tiếp theo: ${fx.competition?.milestone?.label ?? '—'}`, 6000); break;
    case 'event-start': sfx('actOpen'); show(C.events[fx.kind], C.eventHint[fx.kind], 4500); break;
    case 'water': case 'help': if (fx.count > 3) say(`${fx.count} người đang tưới`); break;
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
    eventLabel.textContent = status.event ? `Sự kiện · ${eventNames[status.event] ?? status.event}` : 'Vườn trên mây đang yên bình';
    if (status.competition) renderCompetition(status.competition);
  } catch { /* the live Garden stream continues without the optional status ribbon */ }
}

function onMessage(event, data) {
  if (event === 'meta') {
    meta = data;
    hint.textContent = data.copy.howTo;
    music.setLists(data.music ?? { calm: [], upbeat: [] });
    if (!welcomed) { welcomed = true; show(data.copy.welcome, data.copy.howTo, 6500); }
  } else if (event === 'reset') {
    plots.clear(); floaters.length = 0; serverEvent = null;
    show('Vườn mô phỏng đã làm mới', 'Bắt đầu bằng một bình luận hoặc “trồng rau”.', 4200);
  } else if (event === 'frame') {
    for (const [id, p] of Object.entries(data.parts.plots ?? {})) plots.set(id, p);
    if ('event' in data.parts) serverEvent = data.parts.event;
    if ('event' in data.parts) music.setMood(serverEvent?.kind === 'golden' || serverEvent?.kind === 'pests' ? 'upbeat' : 'calm');
    if (data.parts.competition) renderCompetition(data.parts.competition);
    for (const fx of data.fx ?? []) handleFx(fx);
  } else if (event === 'shot') {
    from = cam;
    to = { x: data.x, y: data.y, zoom: data.zoom };
    focusPlot = data.plotId ?? null;
    focusAt = performance.now(); focusMs = data.holdMs ?? 3500;
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
  const cfg = meta.cfg, center = worldToScreen({ x: cfg.tierWidth / 2, y: index * cfg.tierHeight + cfg.tierHeight / 2 }, cam, VP);
  const width = cfg.tierWidth - 150, height = 900, s = cam.zoom;
  ctx.save(); ctx.translate(center.x, center.y); ctx.scale(s, s);
  cloudPath(width, height); ctx.fillStyle = C.shadow; ctx.fill();
  ctx.save(); ctx.translate(0, -20); cloudPath(width, height); ctx.fillStyle = C.card; ctx.strokeStyle = C.ink; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.moveTo(-width * .40, -height * .17); ctx.quadraticCurveTo(-width * .12, -height * .25, width * .02, -height * .16); ctx.quadraticCurveTo(width * .26, -height * .08, width * .40, -height * .16); ctx.lineTo(width * .39, height * .20); ctx.quadraticCurveTo(width * .06, height * .27, -width * .02, height * .20); ctx.quadraticCurveTo(-width * .24, height * .26, -width * .40, height * .17); ctx.closePath();
  ctx.fillStyle = C.teal; ctx.fill(); ctx.restore();
  ctx.restore();

  // A paper tag marks the level without bringing back sign names or sign symbols.
  const tag = worldToScreen({ x: cfg.tierWidth / 2, y: index * cfg.tierHeight + 220 }, cam, VP), tagW = 680 * s, tagH = 126 * s;
  ctx.save(); ctx.translate(tag.x, tag.y); ctx.rotate(-.012);
  ctx.beginPath(); ctx.moveTo(-tagW * .50, -tagH * .43); ctx.lineTo(tagW * .49, -tagH * .48); ctx.quadraticCurveTo(tagW * .52, 0, tagW * .48, tagH * .45); ctx.lineTo(-tagW * .48, tagH * .50); ctx.quadraticCurveTo(-tagW * .52, 0, -tagW * .50, -tagH * .43);
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, 6 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = `bold ${Math.max(23, 82 * s)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${String(index + 1).padStart(2, '0')}  ·  ${tier.label}`, 0, 0);
  ctx.restore();
  drawTierLandmark(index);
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
  const at = worldToScreen(plotPos(p, meta), cam, VP), size = meta.cfg.plotCell * .82 * cam.zoom;
  ctx.save(); ctx.translate(at.x, at.y); ctx.scale(size / 100, size / 100); ctx.globalAlpha = p.awake ? 1 : .58;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, 43, 40, 8, -.06, 0, Math.PI * 2); ctx.fillStyle = C.shadow; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(-37, 1, -33, 11); ctx.lineTo(-26, 43); ctx.quadraticCurveTo(-2, 50, 28, 42); ctx.lineTo(34, 8); ctx.quadraticCurveTo(8, 15, -34, 4); ctx.closePath();
  ctx.fillStyle = C.skin; ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, 5); ctx.quadraticCurveTo(-2, 14, 34, 7); ctx.stroke();
  if (p.crop) drawRipeCrop(p.crop.type, p.stage ?? 0);
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
  if (p.owner && lod === 'close') {
    const labelY = at.y + size * .56;
    ctx.save(); ctx.font = `36px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const title = `${p.owner.nickname.slice(0, 15)}  ·  cấp ${p.owner.level}`;
    const w = Math.min(520, ctx.measureText(title).width + 34);
    ctx.fillStyle = C.card; ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(at.x - w / 2, labelY); ctx.lineTo(at.x + w / 2, labelY - 2); ctx.lineTo(at.x + w / 2 - 3, labelY + 48); ctx.lineTo(at.x - w / 2 + 2, labelY + 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillText(title, at.x, labelY + 4);
    const img = avatars.get(p.owner.avatar);
    if (img) { ctx.beginPath(); ctx.arc(at.x, at.y - size * .75, size * .18, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, at.x - size * .18, at.y - size * .93, size * .36, size * .36); }
    ctx.restore();
  }
}

function drawDot(p) {
  const at = worldToScreen(plotPos(p, meta), cam, VP), r = Math.max(4, 47 * cam.zoom);
  ctx.beginPath(); ctx.ellipse(at.x, at.y, r * 1.08, r * .84, -.08, 0, Math.PI * 2);
  ctx.fillStyle = !p.crop ? C.paper : p.stage >= 3 ? (p.crop.type === 'nammay' ? C.coral : C.ochre) : C.teal;
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1.5, 5 * cam.zoom); ctx.globalAlpha = p.awake ? 1 : .52; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawSparkle(x, y, r, color = C.ochre) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * .15, y - r * .16, x + r, y); ctx.quadraticCurveTo(x + r * .12, y + r * .13, x, y + r); ctx.quadraticCurveTo(x - r * .12, y + r * .12, x - r, y); ctx.quadraticCurveTo(x - r * .1, y - r * .12, x, y - r); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function drawAtmosphere(now) {
  const cfg = meta.cfg;
  meta.tiers.forEach((tier, i) => {
    const y = i * cfg.tierHeight + cfg.tierHeight / 2;
    const drift = reduceMotion ? 0 : Math.sin(now / 3200 + i * 1.3) * 70;
    for (const [x, dy] of [[cfg.tierWidth * .18, -390], [cfg.tierWidth * .78, 390]]) {
      const at = worldToScreen({ x: x + drift, y: y + dy }, cam, VP);
      ctx.save(); ctx.translate(at.x, at.y); ctx.scale(cam.zoom, cam.zoom); ctx.globalAlpha = .38;
      cloudPath(170, 68); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.teal; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    }
    const a = worldToScreen({ x: cfg.tierWidth * .12, y: y - 300 }, cam, VP), b = worldToScreen({ x: cfg.tierWidth * .88, y: y + 330 }, cam, VP);
    const pulse = reduceMotion ? .45 : .35 + (Math.sin(now / 1100 + i * 1.7) + 1) * .12;
    ctx.globalAlpha = pulse; drawSparkle(a.x, a.y, Math.max(3, 15 * cam.zoom)); drawSparkle(b.x, b.y, Math.max(3, 12 * cam.zoom), C.coral); ctx.globalAlpha = 1;
  });
  if (serverEvent?.kind === 'rain') {
    ctx.strokeStyle = 'rgba(67,80,100,.45)'; ctx.lineWidth = 3;
    const t = reduceMotion ? 0 : now;
    for (let i = 0; i < 18; i++) { const x = (i * 79 + (t / 18) % 1080) % 1080, y = (i * 113 + (t / 9) % 1920) % 1920; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 11, y + 28); ctx.stroke(); }
  } else if (serverEvent?.kind === 'golden') {
    ctx.globalAlpha = .6; for (let i = 0; i < 14; i++) drawSparkle((i * 137 + 31) % 1080, (i * 281 + 67) % 1920, 4 + (i % 3) * 2, C.ochre); ctx.globalAlpha = 1;
  }
}

function drawFocus(now) {
  if (!focusPlot || now - focusAt > focusMs) return;
  const plot = plots.get(focusPlot);
  if (!plot) return;
  const at = worldToScreen(plotPos(plot, meta), cam, VP), age = (now - focusAt) / Math.max(1, focusMs);
  const radius = Math.max(28, meta.cfg.plotCell * .72 * cam.zoom) + (reduceMotion ? 0 : Math.sin(now / 130) * 4);
  ctx.save(); ctx.globalAlpha = Math.max(.18, 1 - age * .65); ctx.strokeStyle = C.ochre; ctx.lineWidth = 6; ctx.setLineDash([11, 8]);
  ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
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

function frame(now) {
  requestAnimationFrame(frame);
  if (!meta) return;
  cam = reduceMotion ? to : easeCamera(from, to, now - shotAt, EASE_MS);
  ctx.fillStyle = serverEvent?.kind === 'rain' ? C.teal : C.paper;
  ctx.fillRect(0, 0, VP.w, VP.h);
  for (let i = 0; i < meta.tiers.length - 1; i++) {
    const y = (i + 1) * meta.cfg.tierHeight;
    drawVine(meta.cfg.tierWidth - 240, y - 430, meta.cfg.tierWidth - 350, y + 430);
  }
  meta.tiers.forEach(drawTier);
  drawAtmosphere(now);
  const { detail, dots } = visiblePlots([...plots.values()], cam, VP, meta);
  const lod = lodOf(cam.zoom);
  dots.forEach(drawDot);
  detail.forEach(p => drawPlot(p, lod));
  drawFocus(now);
  drawFloaters(now);
}
requestAnimationFrame(frame);
connect();
refreshStatus();
setInterval(refreshStatus, 8000);
