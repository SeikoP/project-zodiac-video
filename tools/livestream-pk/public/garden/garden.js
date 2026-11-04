// Vườn Mây overlay: draws the garden on a canvas, follows the server's camera shots, shows banners and a short feed.
import { createAvatarCache, easeCamera, lodOf, plotPos, visiblePlots, worldToScreen } from './view.js';

const VP = { w: 1080, h: 1920 };
const canvas = document.getElementById('world'), ctx = canvas.getContext('2d');
const stage = document.getElementById('stage'), banner = document.getElementById('banner'), feed = document.getElementById('feed'), hint = document.getElementById('hint');
const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / VP.w, innerHeight / VP.h)})`; };
addEventListener('resize', fit); fit();

let meta = null;
const plots = new Map(), floaters = [], avatars = createAvatarCache(200);
let cam = { x: 1800, y: 2400, zoom: 0.3 }, from = cam, to = cam, shotAt = 0, serverEvent = null;
const EASE_MS = 600;
const CROP = { rau: '🥬', huongduong: '🌻', linhthao: '🌸' };
const STAGE_ICON = ['•', '🌱', '🌿'];
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
function float(text, id) { const p = posOf(id); if (p) floaters.push({ text, ...p, born: performance.now() }); }

function handleFx(fx) {
  const C = meta?.copy;
  if (!C) return;
  switch (fx.type) {
    case 'gift': show(`${fx.nickname ?? 'Ai đó'} · ${C.gifts[fx.tier]}`, C.gifts[fx.tier] === C.gifts.tree ? '🌳 Thần thụ đứng lại trong vườn' : '', fx.tier === 'tree' || fx.tier === 'rain' ? 4200 : 2600); break;
    case 'steal': say(C.steal(nameOf(fx.thiefPlotId), nameOf(fx.plotId))); float('-20%', fx.plotId); break;
    case 'catch': say(C.caught(nameOf(fx.plotId), nameOf(fx.thiefPlotId))); break;
    case 'dog-bark': say(C.bark(nameOf(fx.plotId))); break;
    case 'levelup': say(C.levelUp(nameOf(fx.plotId), fx.level)); float('⭐', fx.plotId); break;
    case 'event-start': show(C.events[fx.kind], C.eventHint[fx.kind], 4500); break;
    case 'water': case 'help': if (fx.count > 3) say(`💧 ${fx.count} người đang tưới`); break;
    case 'harvest': if (fx.count > 3) say(`🧺 ${fx.count} người vừa hái`); break;
    default:
  }
}

function onMessage(event, data) {
  if (event === 'meta') { meta = data; hint.textContent = data.copy.howTo; }
  else if (event === 'frame') {
    for (const [id, p] of Object.entries(data.parts.plots ?? {})) plots.set(id, p);
    if ('event' in data.parts) serverEvent = data.parts.event;
    for (const fx of data.fx ?? []) handleFx(fx);
  } else if (event === 'shot') { from = cam; to = { x: data.x, y: data.y, zoom: data.zoom }; shotAt = performance.now(); }
}

// SSE first; if the stream drops twice (a tunnel that cannot stream) fall back to long-polling.
function connect() {
  let fails = 0;
  const es = new EventSource('/events');
  for (const e of ['meta', 'frame', 'shot']) es.addEventListener(e, m => { fails = 0; onMessage(e, JSON.parse(m.data)); });
  es.onerror = () => { if (++fails >= 2) { es.close(); poll(); } };
}
async function poll(id = '') {
  try {
    const r = await (await fetch(`/poll?wait=1${id ? `&id=${id}` : ''}`)).json();
    for (const m of r.msgs) onMessage(m.event, m.data);
    setTimeout(() => poll(r.id), 50);
  } catch { setTimeout(() => poll(id), 2000); }
}

// ---------- drawing ----------
function cloud(island, i) {
  const o = { x: (i % meta.cfg.islandCols) * meta.cfg.islandSize + meta.cfg.islandSize / 2, y: Math.floor(i / meta.cfg.islandCols) * meta.cfg.islandSize + meta.cfg.islandSize / 2 };
  const c = worldToScreen(o, cam, VP), r = meta.cfg.islandSize * 0.5 * cam.zoom;
  const g = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,.35)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  if (cam.zoom < 1.5) {
    ctx.fillStyle = 'rgba(47,60,68,.75)'; ctx.font = `${Math.max(26, 60 * cam.zoom)}px 'Patrick Hand', 'Segoe UI', Arial, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(meta.signNames?.[island] ?? island, c.x, c.y - r * 0.82);
  }
}

const STAGE_COLOR = ['#b99', '#9c6', '#5a4', '#e8b53a', '#a88'];
function dot(p) {
  const s = worldToScreen(plotPos(p, meta), cam, VP), r = Math.max(3, 70 * cam.zoom);
  ctx.fillStyle = p.crop ? STAGE_COLOR[p.stage ?? 0] : '#d9c8a8';
  ctx.globalAlpha = p.awake ? 1 : 0.45;
  ctx.fillRect(s.x - r / 2, s.y - r / 2, r, r);
  ctx.globalAlpha = 1;
}

function tile(p, lod) {
  const s = worldToScreen(plotPos(p, meta), cam, VP), size = meta.cfg.plotCell * 0.92 * cam.zoom;
  ctx.globalAlpha = p.awake ? 1 : 0.5;
  ctx.fillStyle = '#c9a77a'; ctx.strokeStyle = '#7a5b3a'; ctx.lineWidth = Math.max(1, 3 * cam.zoom);
  ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size); ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const icon = p.crop ? (p.stage >= 3 ? CROP[p.crop.type] : STAGE_ICON[p.stage]) : '';
  ctx.font = `${size * 0.55}px 'Segoe UI Emoji', sans-serif`;
  if (icon) ctx.fillText(p.stage === 4 ? '🥀' : icon, s.x, s.y);
  if (p.crop?.pest) ctx.fillText('🐛', s.x + size * 0.28, s.y - size * 0.28);
  if (p.dog) ctx.fillText('🐕', s.x - size * 0.3, s.y + size * 0.3);
  if (p.shield) ctx.fillText('🛡️', s.x - size * 0.3, s.y - size * 0.3);
  if (p.deco?.includes('golden-tree')) ctx.fillText('🌳', s.x + size * 0.32, s.y + size * 0.3);
  if (p.crop && p.stage < 3) { ctx.fillStyle = '#3b8fd9'; ctx.fillRect(s.x - size / 2, s.y + size / 2 - 5 * cam.zoom - 2, size * p.water, Math.max(2, 5 * cam.zoom)); }
  ctx.globalAlpha = 1;
  if (p.owner) {
    ctx.fillStyle = '#2F3C44'; ctx.textBaseline = 'alphabetic';
    ctx.font = `${Math.max(14, size * (lod === 'close' ? 0.16 : 0.2))}px 'Patrick Hand', 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(`${p.owner.nickname} · ${p.owner.level}`, s.x, s.y + size / 2 + size * 0.2);
    if (lod === 'close') { const img = avatars.get(p.owner.avatar); if (img) { ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y - size / 2 - size * 0.18, size * 0.14, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, s.x - size * 0.14, s.y - size / 2 - size * 0.32, size * 0.28, size * 0.28); ctx.restore(); } }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!meta) return;
  cam = easeCamera(from, to, now - shotAt, EASE_MS);
  const g = ctx.createLinearGradient(0, 0, 0, VP.h);
  g.addColorStop(0, serverEvent?.kind === 'golden' ? '#ffe9a8' : '#9fd5ee'); g.addColorStop(1, serverEvent?.kind === 'rain' ? '#7fa5c8' : '#e6f4fa');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VP.w, VP.h);
  meta.islands.forEach((isl, i) => cloud(isl, i));
  const { detail, dots } = visiblePlots([...plots.values()], cam, VP, meta);
  const lod = lodOf(cam.zoom);
  dots.forEach(dot);
  detail.forEach(p => tile(p, lod));
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], age = (now - f.born) / 1400;
    if (age >= 1) { floaters.splice(i, 1); continue; }
    const s = worldToScreen(f, cam, VP);
    ctx.globalAlpha = 1 - age; ctx.fillStyle = '#2F3C44'; ctx.font = `${Math.max(24, 60 * cam.zoom)}px 'Patrick Hand', 'Segoe UI', Arial, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(f.text, s.x, s.y - 40 * cam.zoom - age * 80 * cam.zoom); ctx.globalAlpha = 1;
  }
}
requestAnimationFrame(frame);
connect();
