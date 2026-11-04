// Overlay for Đêm Hội Sao (four colour teams). Built to stay smooth in busy rooms:
//  • the server sends one small "frame" every 250ms (changed parts + a capped list of effects);
//  • DOM is touched only when a part changes, and only the bits that changed;
//  • everything that moves every frame (orbiting viewers, comets, particles, boss beams) is drawn
//    on one canvas from pre-rendered sprites, capped at ?fps= (default 30).
import { mascot, fmt, esc, clock, subscribe } from '/shared.js';
import { TEAMS } from '/teams.js';

import { ICON } from '/icons.js';
import { createSfx } from '/sfx.js';
import { createMusic } from '/music.js';
import { createLane } from '/lane.js';

const $ = id => document.getElementById(id);
const C = { paper: '#F6F0E6', gold: '#F2C45C', accent: '#E97A66', teal: '#8EC0B9' };
const params = new URLSearchParams(location.search);
if (params.has('transparent')) document.body.classList.add('transparent');
const phone = params.get('phone') === '1', FRAME_HEIGHT = phone ? 2400 : 1920;
const lite = params.get('lite') === '1'; // lighter rendering for a weak machine: 1x canvas, 24 fps, no CSS blur/shadow
if (lite) document.body.classList.add('lite');
const FPS = Math.min(60, Math.max(15, Number(params.get('fps')) || (lite ? 24 : 30)));

// TikTok's player covers the lower part of the frame with the viewers' chat (from about y=1200 of a 1080x1920
// stream on a tall phone), so everything to read sits above that line and only the community sky lives below it.
// ?phone=1 is a 1080x2400 canvas, which fills a tall phone; its top ~340px is under TikTok's header instead.
const stage = $('stage');
if (phone) { stage.classList.add('phone'); stage.style.height = `${FRAME_HEIGHT}px`; }
if (params.has('audit')) import('/audit.js').then(m => m.startAudit());
let K = 1, canvasReady = false; // canvas pixels per stage pixel: 2 when the source is rendered at or above 1080 wide (or on a HiDPI screen)
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / FRAME_HEIGHT);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(innerWidth - 1080 * s) / 2}px`;
  const k = !lite && s * (devicePixelRatio || 1) > 0.75 ? 2 : 1; // supersample once the source is anywhere near full size
  if (k !== K) { K = k; if (canvasReady) resizeCanvases(); }
}
addEventListener('resize', fit);
fit();

// --- state ------------------------------------------------------------------------
const S = { teams: [], config: {}, hud: null, sky: null, stage: [], thanks: [], race: null, lucky: null, cosmos: null, roles: {}, stars: [] };
const TEAM = Object.fromEntries(TEAMS.map(t => [t.id, t]));
const NO_TEAM = { id: '', label: '', color: '#F2C45C', glyph: '' }; // an id the page does not know yet never throws
const tm = id => TEAM[id] ?? NO_TEAM;
const color = id => tm(id).color;
// A renderer that chokes on a frame it does not know (an event scene still on the old shape) must not stop the others.
const warned = new Set();
const safe = (what, fn) => { try { return fn(); } catch (err) { if (!warned.has(what)) { warned.add(what); console.warn(`[overlay] ${what}:`, err?.message ?? err); } } };
const rnd = (a, b) => a + Math.random() * (b - a);

// --- wheel geometry ------------------------------------------------------------------
// Layout: one merged top card (title, moon, goal, race bars), then the wheel as a dial scaled (Z) to fit above the chat
// line, then the community sky. The wheel is built in its own 1016x1050 units (radii R, ARC...) and placed on the stage
// at WHEEL_L/WHEEL_T; at() and nodePos() return stage coordinates for the canvas.
// Four equal coloured arcs (quadrants) make the ring: red top-left, yellow top-right, green bottom-right, blue
// bottom-left. A team's arc fills and brightens with its light; viewers' mascots stand just outside their own arc.
const LAYOUT = phone ? { top: 345, wheelT: 662, wheelB: 1672, zone: 1700 } : { top: 20, wheelT: 330, wheelB: 1192, zone: 1210 };
const LOCAL_W = 1016, LOCAL_H = 1050, Z = Math.min(1, (LAYOUT.wheelB - LAYOUT.wheelT) / LOCAL_H);
const WHEEL_W = LOCAL_W * Z, WHEEL_H = LOCAL_H * Z, WHEEL_L = (1080 - WHEEL_W) / 2, WHEEL_T = LAYOUT.wheelT;
const CX = WHEEL_L + WHEEL_W / 2, CY = WHEEL_T + WHEEL_H / 2, R = 352, ARC_W = 64, STAND = R + 106;
for (const [k, v] of Object.entries({ top: LAYOUT.top, 'wheel-t': WHEEL_T, 'wheel-b': LAYOUT.wheelB, 'wheel-l': WHEEL_L, zone: LAYOUT.zone, cy: CY })) stage.style.setProperty(`--${k}`, `${v}px`);
stage.style.setProperty('--z', Z);
const on = key => S.config?.show?.[key] !== false;
const IDS = TEAMS.map(t => t.id);
const DEG = Math.PI / 180;
const angleOf = id => (-135 + IDS.indexOf(id) * 90) * DEG; // the middle of the team's quadrant
const at = (r, a) => [CX + Z * r * Math.cos(a), CY + Z * r * Math.sin(a)]; // r in wheel units → stage point
const local = ([x, y]) => [(x - WHEEL_L) / Z, (y - WHEEL_T) / Z]; // stage point → wheel units (inside #wheel)
const nodePos = id => at(R, angleOf(id));
// The crowd on an arc: up to CROWD_PER_TEAM mascots on fixed places along the team's arc, every other place a little
// further out so neighbours do not hide each other. A viewer's place comes from their userId and is kept for as long as
// they stay on stage, so nobody jumps when others arrive; when the arc is full the newcomer takes the place of the
// viewer who has been there longest, and nobody else moves.
const CROWD_PER_TEAM = 10, SPREAD = 68 * DEG;
const slotHash = s => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) >>> 0, 7);
function crowdSpot(id, slot) {
  const a = angleOf(id) + (slot - 4.5) / 9 * SPREAD;
  return [...at(STAND + (slot % 2 ? 52 : 0), a), a];
}
const crowd = Object.fromEntries(TEAMS.map(t => [t.id, Array(CROWD_PER_TEAM).fill(null)])); // team -> slot -> { v, order }
const arrivals = new Map(); // userId -> arrival number, for "oldest" and "newest"
let arrivalNo = 0;
function placeCrowd(list) {
  const here = new Map(list.map(v => [v.userId, v]));
  for (const id of IDS) {
    const slots = crowd[id];
    for (let i = 0; i < slots.length; i++) { // refresh the people who stay, free the places of those who left or changed team
      const o = slots[i];
      if (!o) continue;
      const v = here.get(o.v.userId);
      slots[i] = v && v.team === id ? { v, order: o.order } : null;
    }
  }
  for (const v of list) {
    if (!v.team || !crowd[v.team]) continue;
    if (!arrivals.has(v.userId)) arrivals.set(v.userId, ++arrivalNo);
    const slots = crowd[v.team];
    if (slots.some(o => o?.v.userId === v.userId)) continue;
    let slot = slotHash(v.userId) % CROWD_PER_TEAM;
    for (let k = 0; k < CROWD_PER_TEAM && slots[slot]; k++) slot = (slot + 1) % CROWD_PER_TEAM; // the next free place
    if (slots[slot]) { // full: replace the one who came first
      slot = slots.reduce((best, o, i) => (o.order < slots[best].order ? i : best), 0);
    }
    slots[slot] = { v, order: arrivals.get(v.userId) };
  }
  if (arrivals.size > 600) for (const k of arrivals.keys()) if (!here.has(k)) arrivals.delete(k);
}

// --- one-time builds -------------------------------------------------------------------
const nodes = {};
function build() {
  const ring = $('ring');
  const lx = LOCAL_W / 2, ly = LOCAL_H / 2, half = 42 * DEG; // a 6° gap between neighbours
  ring.setAttribute('viewBox', `0 0 ${LOCAL_W} ${LOCAL_H}`);
  const arcD = id => { const a = angleOf(id), p = b => `${(lx + R * Math.cos(b)).toFixed(1)} ${(ly + R * Math.sin(b)).toFixed(1)}`; return `M${p(a - half)} A${R} ${R} 0 0 1 ${p(a + half)}`; };
  ring.innerHTML = S.teams.map(t => `<g class="qa" id="qa-${t.id}" style="--el:${t.color}"><path class="qt" d="${arcD(t.id)}"/><path class="qg" d="${arcD(t.id)}"/><path class="qf" d="${arcD(t.id)}" pathLength="1"/></g>`).join('');
  for (const t of S.teams) {
    TEAM[t.id] = t;
    const [x, y] = local(nodePos(t.id)), el = document.createElement('div');
    el.className = `node node-${t.id}`;
    el.style.cssText = `left:${x}px;top:${y}px;--el:${t.color};--fill:0%`;
    el.innerHTML = `<span class="fill-clip" aria-hidden="true"><span></span></span><img class="ti" src="/art/team-${t.id}.svg" alt=""><span class="nm">${esc(t.label)}</span><span class="more"></span>`;
    $('wheel').append(el);
    nodes[t.id] = { el, more: el.querySelector('.more'), g: ring.querySelector(`#qa-${t.id}`), f: ring.querySelector(`#qa-${t.id} .qf`), lit: false };
  }
  buildRace();
  drawBackground();
  loadSprites();
}

// Race bars are created once and only re-ordered / re-sized afterwards.
const chips = {};
function buildRace() {
  for (const id of IDS) {
    const el = document.createElement('div');
    el.className = 'rc';
    el.style.setProperty('--el', color(id));
    el.innerHTML = `<i></i><span class="rk"></span><img class="ti" src="/art/team-${id}.svg" alt=""><span class="nm">${esc(tm(id).label)}</span><span class="v">0</span>`;
    $('race').append(el);
    chips[id] = { el, rk: el.querySelector('.rk'), nm: el.querySelector('.nm'), v: el.querySelector('.v'), crowns: -1 };
  }
}
// "Cách tham gia" sits at the top: step 1 never changes (pick your team); step 2 is the move that matters right now
// (fight the boss, claim the chest, fix Thủy Nghịch, bless a wish), otherwise it cycles through everything you can type.
// Icons are the same as the buttons on a viewer's own TikTok screen.
// Each line has to fit its half of the strip on a phone: a short command, then at most ~28 characters.
const TIPS = [
  [ICON.heart, 'Thả tim', 'trăng lên rằm'],
  [ICON.comment, '“đổi” + tên màu', 'sang phe khác · 30 giây một lần'],
  [ICON.comment, '“ước …”', 'thả đèn ước lên trời'],
  [ICON.comment, '“hồ sơ”', 'khoe cấp và thành tích'],
  [ICON.follow, 'Theo dõi', 'thêm Điểm sáng cho phe'],
];
let tipI = 0, lastTip = '';
function renderJoin() {
  const c = S.cosmos, h = S.hud, wish = c?.wishes?.find(w => w.open), hi = c?.welcomes?.[0];
  const sec = ms => Math.ceil((ms ?? 0) / 1000);
  // what to type right now, most urgent first: every live event says how to join it
  const tip = h?.poll ? ['🗳', 'Gõ 1, 2, 3 hoặc 4', 'bình chọn · mỗi người một phiếu', 'hot']
    : h?.quiz ? ['🧠', 'Gõ A, B hoặc C', 'trả lời câu đố · 3 người nhanh nhất', 'hot']
    : c?.chest?.open ? ['🎁', 'Gõ “nhận”', `còn ${sec(c.chest.remainingMs)}s`, 'hot']
    : c?.boss ? ['⚔️', 'Chat để đánh Sao Chổi', 'cả bốn phe cùng đánh', 'hot']
    : c?.tug ? ['🪢', 'Chat để kéo co', 'hai phe đang đấu', 'hot']
    : c?.starcatch?.word ? ['🌠', `Gõ “${c.starcatch.word}”`, 'hứng sao băng thật nhanh', 'hot']
    : c?.mystery ? ['🕵️', 'Gõ đáp án bạn đoán', 'đoán đúng được thưởng', 'hot']
    : hi ? ['👋', 'Gõ “chào”', `chào ${hi.nickname} · ${hi.greetings}/${c.welcomeNeed}`, 'hot']
    : wish ? ['🙏', 'Gõ “chúc”', `cho ${wish.nickname} · ${wish.blessings}/${c.blessNeed}`, 'hot']
    : TIPS[tipI % TIPS.length];
  const html = `<span class="ji">${tip[0]}</span><div><b>${esc(tip[1])}</b><span>${esc(tip[2])}</span></div>`;
  if (html === lastTip) return;
  lastTip = html;
  const el = $('jcmd');
  el.className = `j2${tip[3] ? ' hot' : ''}`;
  el.innerHTML = `<span class="jn">2</span>${html}`;
}
setInterval(() => { tipI++; if (S.teams.length) renderJoin(); }, 4500);

// --- sprites & cached text ------------------------------------------------------------------
const sprites = {};
function loadSprites() {
  for (const id of IDS) {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = 104; c.height = 152; c.getContext('2d').drawImage(img, 0, 0, 104, 152); sprites[id] = c; };
    img.src = mascot(id, 'idle');
  }
}
// Labels are centred on x but never drawn past the edges of the frame (the right button rail is see-through).
const drawLabel = (c, x, y) => fx.drawImage(c, Math.min(1044 - c.lw, Math.max(20, x - c.lw / 2)), y, c.lw, c.lh);
const labels = new Map();
function label(text, size = 15, col = C.paper) {
  const key = `${size}|${col}|${text}`;
  let c = labels.get(key);
  if (c) return c;
  if (labels.size > 400) labels.clear();
  c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `800 ${size}px 'Segoe UI', system-ui, sans-serif`;
  const w = Math.min(220, Math.ceil(g.measureText(text).width) + 14);
  c.lw = w; c.lh = size + 10; // logical size; the bitmap is 2x so the text stays sharp
  c.width = w * 2; c.height = (size + 10) * 2;
  g.scale(2, 2);
  g.font = `800 ${size}px 'Segoe UI', system-ui, sans-serif`;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.roundRect(0, 0, w, size + 10, 8); g.fill();
  g.fillStyle = col; g.textBaseline = 'middle'; g.fillText(text, 7, (size + 10) / 2, w - 14);
  labels.set(key, c);
  return c;
}

const skyStars = []; // the starfield is generated once so a resolution change redraws the same sky
function drawBackground() {
  const g = $('bg').getContext('2d');
  if (!skyStars.length) for (let i = 0; i < 260; i++) skyStars.push([rnd(.2, .9), rnd(0, 1080), rnd(0, FRAME_HEIGHT), rnd(.4, 1.8)]);
  g.setTransform(K, 0, 0, K, 0, 0);
  g.clearRect(0, 0, 1080, FRAME_HEIGHT);
  g.fillStyle = C.paper;
  const clusterY = LAYOUT.zone + 74;
  const clusterH = FRAME_HEIGHT - clusterY - 46;
  const clusterRX = 280, clusterRY = Math.min(152, clusterH * .31);
  const clusterCY = clusterY + clusterH * .5;
  for (const [a, x, y, r] of skyStars) {
    // Leave the visitor-star cluster clear: only named, recorded visitors are drawn there.
    const nx = (x - CX) / clusterRX, ny = (y - clusterCY) / clusterRY;
    if (nx * nx + ny * ny < 1) continue;
    g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

// --- canvas world ------------------------------------------------------------------------------
const fx = $('fx').getContext('2d');
// Both full-stage canvases are K times larger than the stage and drawn in stage units.
function resizeCanvases() {
  for (const id of ['bg', 'fx']) { $(id).width = 1080 * K; $(id).height = FRAME_HEIGHT * K; }
  fx.setTransform(K, 0, 0, K, 0, 0);
  if (skyStars.length) drawBackground();
}
canvasReady = true;
resizeCanvases();
let parts = [], comets = [], meteors = [];
const twinkles = Array.from({ length: 40 }, () => ({ x: rnd(0, 1080), y: rnd(0, 1300), p: rnd(0, 6) }));
const dancing = new Map(); // userId -> until (ms)
const MAX_PARTS = 900;

function burst(x, y, colors, n = 60, speed = 10) {
  n = Math.min(n, MAX_PARTS - parts.length);
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(2, speed); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: colors[i % colors.length], life: rnd(40, 70), g: .15, r: rnd(2, 4.5) }); }
}
function heartShape(x, y, r) { fx.beginPath(); fx.moveTo(x, y + r * .9); fx.bezierCurveTo(x - r * 1.6, y - r * .2, x - r * .6, y - r * 1.4, x, y - r * .4); fx.bezierCurveTo(x + r * .6, y - r * 1.4, x + r * 1.6, y - r * .2, x, y + r * .9); }
function hearts(x, y, n) {
  n = Math.min(n, 3, MAX_PARTS - parts.length);
  for (let i = 0; i < n; i++) parts.push({ x: x + rnd(-14, 14), y, vx: rnd(-.6, .6), vy: rnd(-2.6, -1.6), heart: true, life: 55, g: -.01, r: rnd(7, 10), c: C.accent });
}
function comet(from, to) {
  if (comets.length >= 8) return;
  let a0 = angleOf(from), a1 = angleOf(to);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; else if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  comets.push({ a0, a1, t: 0, c: color(from), c2: color(to), trail: [] });
}
function meteorShower(n = 20) { for (let i = 0; i < n; i++) meteors.push({ x: rnd(-100, 1300), y: -rnd(0, 800), v: rnd(16, 28), len: rnd(110, 260), delay: rnd(0, 60) }); }
// Boss fight: a bolt flies from a team's node into the boss at the centre; a damage number pops where it lands.
let shots = [], floats = [];
function shoot(team, dmg, crit = false, ult = false) {
  if (shots.length >= 16) return;
  const [x, y] = nodePos(team);
  shots.push({ x0: x, y0: y, t: 0, c: color(team), dmg, crit, ult });
}
let beams = [];
function beam(team, c, blocked = false) { const [x, y] = nodePos(team); beams.push({ x, y, c, blocked, t: 0 }); }

// Đèn ước: a paper lantern with the wish written on it rises slowly over the whole frame, carrying the wisher's
// avatar and a blessing counter ("gõ “chúc”"). A wish the room blesses turns gold and leaves a star behind.
const LANTERN_X = [90, 760, 430];
let lanternSlot = 0;
function releaseLantern(e) {
  const box = $('lanterns');
  const old = [...box.querySelectorAll('.lantern')];
  while (old.length >= 3) old.shift().remove();
  const el = document.createElement('div');
  el.className = 'lantern';
  el.dataset.id = e.id;
  el.style.left = `${LANTERN_X[lanternSlot++ % LANTERN_X.length] + rnd(-30, 30)}px`; // three lanes, so lanterns never stack
  el.style.setProperty('--sway', `${rnd(-60, 60)}px`);
  el.innerHTML = `<img class="lb" src="/art/lantern.svg" alt=""><div class="lt${e.text?.length > 70 ? ' xlong' : e.text?.length > 34 ? ' long' : ''}">${e.text ? `<b>${esc(e.text)}</b>` : '<b class="secret">điều ước bí mật ✨</b>'}</div>`
    + `<div class="lw">${avatarHtml(e)}<span>${esc(e.nickname)}</span></div>`
    + (e.demo ? '<div class="lbless">🎓 đèn mẫu của linh vật</div>' : `<div class="lbless">🙏 gõ “chúc” · <em>0</em>/${e.need}</div>`);
  el.addEventListener('animationend', ev => { if (ev.animationName === 'rise-lantern') el.remove(); });
  box.append(el);
}
// Lời chào ghé thăm: like a wish, but a glowing paper star instead of a lantern. It rises over the frame carrying
// “Chào <tên>!” and the room's “chào” count, while the newcomer's own star (their avatar) appears on the rim of the
// centre orbit, right round the wheel where everyone looks. Each “chào” makes it flash; enough of them and it bursts
// gold. When the welcome is over the star drifts down to its place in the community sky.
const GREET_X = [120, 800, 460];
let greetSlot = 0;
const visitors = new Map(); // userId -> the newcomer's star on the orbit rim
// the rim: an ellipse just outside the mascots, on the sides and below the wheel (the top belongs to the top card)
const rimPoint = x => { const a = Math.PI * (-0.12 + 1.24 * x); return [CX + Math.cos(a) * (STAND + 62), CY + Math.sin(a) * (STAND + 44)]; };
function releaseGreeting(e) {
  const box = $('lanterns');
  const old = [...box.querySelectorAll('.greet-star')];
  while (old.length >= 3) old.shift().remove();
  const el = document.createElement('div');
  el.className = 'greet-star';
  el.dataset.id = `g${e.id}`;
  el.style.left = `${GREET_X[greetSlot++ % GREET_X.length] + rnd(-24, 24)}px`;
  el.style.setProperty('--sway', `${rnd(-50, 50)}px`);
  el.innerHTML = `<div class="gs-star">${avatarHtml(e, 'av')}</div><div class="gs-txt"><b>Chào ${esc(e.nickname)}!</b><span>vừa ghé đêm hội ✨</span></div>`
    + `<div class="gs-count">👋 gõ “chào” · <em>0</em>/${e.need ?? 3}</div>`;
  el.addEventListener('animationend', ev => { if (ev.animationName === 'rise-greet') el.remove(); });
  box.append(el);
  const [x, y] = rimPoint(e.x ?? Math.random());
  visitors.set(e.userId, { ...e, x, y, c: e.team ? color(e.team) : C.gold, born: Date.now(), until: Date.now() + (e.seconds ?? 30) * 1000, flash: 0, done: false });
  burst(x, y, [C.gold, '#fff', C.paper], 40, 7);
}
function greetStar(e, done = false) {
  const el = $('lanterns').querySelector(`[data-id="g${e.id}"]`);
  const vs = visitors.get(e.userId);
  if (vs) {
    vs.flash = Date.now() + (done ? 1500 : 700);
    burst(vs.x, vs.y, done ? [C.gold, '#fff', C.paper] : [C.gold, C.paper], done ? 90 : 16, done ? 11 : 5);
    if (done) { vs.done = true; vs.until = Date.now() + 5000; }
  }
  if (!el) return;
  const em = el.querySelector('em');
  if (em) em.textContent = e.count;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (done) { el.classList.add('done'); el.querySelector('.gs-count').textContent = `⭐ ${e.greeters.slice(0, 3).join(', ')}${e.count > 3 ? '…' : ''} đã chào · +${e.dust} bụi sao`; }
}
const starPath = (x, y, r1, r2, rot = 0) => { fx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1; fx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } fx.closePath(); };
function drawVisitors(t) {
  const now = Date.now();
  for (const [id, v] of visitors) {
    if (now >= v.until) {
      visitors.delete(id);
      const s = S.stars.find(x => x.userId === id);
      if (s) fly(id, [v.x, v.y], starPoint(s), v.c, '', 0);
      continue;
    }
    const grow = Math.min(1, (now - v.born) / 500), lit = v.flash > now || v.done, pulse = 1 + .08 * Math.sin(t / 220);
    const r = (lit ? 46 : 36) * grow * pulse;
    fx.globalAlpha = lit ? .45 : .25; fx.fillStyle = C.gold;
    fx.beginPath(); fx.arc(v.x, v.y, r * 1.5, 0, 7); fx.fill();
    fx.globalAlpha = 1; fx.fillStyle = v.done ? C.gold : 'rgba(255, 240, 200, .95)';
    starPath(v.x, v.y, r, r * .48, t / 2400); fx.fill();
    drawAvatar(v, v.x, v.y, 17 * grow, v.done ? C.gold : v.c);
    drawLabel(label(v.done ? `✨ ${v.nickname}` : `✦ ${v.nickname}`, v.done ? 20 : 17, C.gold), v.x, v.y + r + 4);
  }
  fx.globalAlpha = 1;
}
function blessLantern(e, done = false) {
  const el = $('lanterns').querySelector(`[data-id="${e.id}"]`);
  if (!el) return;
  const em = el.querySelector('.lbless em');
  if (em) em.textContent = e.count;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (done) { el.classList.add('blessed'); if (e.gift) el.classList.add('gilded'); el.querySelector('.lbless').innerHTML = e.gift ? '⭐ đèn đã hóa sao vàng!' : '⭐ cả phòng đã chúc phúc!'; }
}

// Viewers' TikTok avatars, loaded once each. Rehearsal viewers (and anyone without a picture) get their initial
// on a coloured disc instead. Level 2+ shows as a coloured ring and a small "Lv" tag.
const LEVEL_COLOR = { 2: 'rgba(142,192,185,.9)', 3: 'rgba(242,196,92,.95)', 4: 'rgba(233,122,102,.95)', 5: 'rgba(180,140,242,1)' };
const avatars = new Map();
function avatarImg(url) {
  if (!url) return null;
  let img = avatars.get(url);
  if (!img) {
    if (avatars.size > 300) avatars.clear();
    img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    avatars.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}
const hueOf = s => [...String(s)].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);
// Fan club members and subscribers wear a golden double ring and a "♥level" tag above their avatar.
const FAN_GOLD = '#FFD45E';
const FRAME_COLOR = { silver: '#dfe7ec', gold: '#FFD45E', star: '#c9a7ff' }; // Sổ Sao frames (levels 10 / 20 / 30)
function drawAvatar(v, x, y, r, ring, lv = 1, tag = '', frame = null) {
  const img = avatarImg(v.avatar);
  fx.save();
  if (tag) {
    fx.beginPath(); fx.arc(x, y, r + 6, 0, 7); fx.strokeStyle = FAN_GOLD; fx.lineWidth = 3; fx.globalAlpha = .6 + .4 * Math.sin(Date.now() / 300); fx.stroke(); fx.globalAlpha = 1;
    fx.fillStyle = '#c43c6a'; fx.beginPath(); fx.roundRect(x - 20, y - r - 20, 40, 16, 8); fx.fill();
    fx.fillStyle = '#fff'; fx.font = "900 11px 'Segoe UI', system-ui, sans-serif"; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    fx.fillText(tag, x, y - r - 12);
  }
  fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.closePath();
  if (img) { fx.save(); fx.clip(); fx.drawImage(img, x - r, y - r, r * 2, r * 2); fx.restore(); }
  else {
    fx.fillStyle = `hsl(${hueOf(v.nickname)} 55% 62%)`; fx.fill();
    fx.fillStyle = '#2F3C44'; fx.font = `800 ${r}px 'Segoe UI', system-ui, sans-serif`; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    fx.fillText([...String(v.nickname).trim()][0]?.toUpperCase() ?? '?', x, y + 1);
  }
  fx.lineWidth = frame ? 5 : lv > 1 ? 4 : 3; fx.strokeStyle = frame ?? (lv > 1 ? LEVEL_COLOR[lv] : ring); fx.stroke();
  if (lv > 1) {
    fx.fillStyle = '#2F3C44'; fx.beginPath(); fx.roundRect(x - 15, y + r - 4, 30, 15, 7); fx.fill();
    fx.fillStyle = '#F2C45C'; fx.font = "900 11px 'Segoe UI', system-ui, sans-serif"; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    fx.fillText(`Lv${lv}`, x, y + r + 4);
  }
  fx.restore();
}
// The same avatar as HTML (lobby, cards): the picture, or the initial on a coloured disc.
const avatarHtml = (p, cls = 'av') => (p.avatar ? `<img class="${cls}" src="${esc(p.avatar)}" referrerpolicy="no-referrer" alt="">` : `<span class="${cls} ini" style="--h:${hueOf(p.nickname)}">${esc([...String(p.nickname ?? '?').trim()][0]?.toUpperCase() ?? '?')}</span>`);

// Where a given viewer is drawn right now (for hearts, sparkles).
const orbitSpots = new Map();
function spotOf(userId, team) { return orbitSpots.get(userId) ?? (team ? nodePos(team) : [CX, CY]); }

// --- the community sky (under the chat): a star for every viewer who ever picked a team ---------------------
// Tonight's viewers shine gold with their name; the others stay dim. A new star flies down from its owner's
// mascot; the big "điểm danh" moment flies tonight's stars in from above. Positions come from the server (0..1).
const SKY_Y = LAYOUT.zone + 74, SKY_H = FRAME_HEIGHT - SKY_Y - 46;
// Visitor stars form a loose ring around the edge of one centered ellipse.
// Keep the middle open; each point represents a real viewer with a saved community star.
const starPoint = s => {
  const angle = s.x * Math.PI * 2;
  const radius = .82 + Math.max(0, Math.min(1, s.y)) * .18;
  const clusterRadiusX = 250;
  const clusterRadiusY = Math.min(135, SKY_H * .28);
  return [
    CX + Math.cos(angle) * clusterRadiusX * radius,
    SKY_Y + SKY_H * .5 + Math.sin(angle) * clusterRadiusY * radius,
  ];
};
const flare = new Map(), landing = new Set(); // userId -> until (ms); stars still in flight are not drawn yet
let flights = [], hereIds = new Set();
function fly(userId, from, to, c, name, delay = 0) {
  if (flights.length >= 24) return;
  landing.add(userId);
  flights.push({ userId, x0: from[0], y0: from[1], x1: to[0], y1: to[1], c, name, t: -delay, trail: [] });
}
function drawCommunitySky(t, dt) {
  const now = Date.now();
  for (const s of S.stars) {
    if (landing.has(s.userId)) continue;
    const [x, y] = starPoint(s), here = hereIds.has(s.userId), lit = (flare.get(s.userId) ?? 0) > now;
    const tw = .5 + .5 * Math.sin(t / 700 + s.x * 40), r = 1.6 + s.mag * .7 + (s.patron ?? 0) * 1.6 + (lit ? 3 + 2 * Math.sin(t / 90) : here ? 1 : 0);
    fx.globalAlpha = (here || lit ? .22 : .08) + .08 * tw; fx.fillStyle = s.team ? color(s.team) : C.paper;
    fx.beginPath(); fx.arc(x, y, r * (lit ? 4 : 2.4), 0, 7); fx.fill();
    fx.globalAlpha = here || lit ? 1 : .45 + .25 * tw; fx.fillStyle = here || lit ? C.gold : C.paper;
    fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill();
    if (s.patron) { fx.globalAlpha = .9; fx.strokeStyle = FAN_GOLD; fx.lineWidth = 1.5 + s.patron * .5; fx.beginPath(); fx.arc(x, y, r + 4 + 2 * Math.sin(t / 400), 0, 7); fx.stroke(); }
    fx.globalAlpha = here || lit || s.patron ? 1 : .5;
    drawLabel(label(s.nickname, here || lit || s.patron ? 16 : 13, here || lit || s.patron ? C.gold : C.paper), x, y + r + 3);
  }
  fx.globalAlpha = 1;
  flights = flights.filter(f => f.t < 1);
  for (const f of flights) {
    f.t += dt / 80; // slow enough to read the name on the way down
    if (f.t < 0) continue;
    const e = 1 - (1 - Math.min(1, f.t)) ** 3, x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(e * Math.PI) * 120;
    f.trail.push([x, y]); if (f.trail.length > 16) f.trail.shift();
    f.trail.forEach(([px, py], i) => { fx.globalAlpha = i / f.trail.length * .9; fx.fillStyle = f.c; fx.beginPath(); fx.arc(px, py, 2 + i * .45, 0, 7); fx.fill(); });
    fx.globalAlpha = 1; fx.fillStyle = '#fff'; fx.beginPath(); fx.arc(x, y, 7, 0, 7); fx.fill();
    if (f.name) drawLabel(label(f.name, 18, C.gold), x, y + 10);
    if (f.t >= 1) { landing.delete(f.userId); flare.set(f.userId, Date.now() + 3500); burst(f.x1, f.y1, [f.c, C.gold, C.paper], 26, 6); }
  }
  fx.globalAlpha = 1;
}

// --- the act clock: a ring round the centre; the act's colour drains as its turn runs out ------------------------------
let clockOf = '', clockFlash = 0;
const HOUR_R = 308; // halfway between the centre circle (296) and the team arcs (320)
function drawHourFx(t) {
  const h = S.cosmos?.act;
  if (!h?.endsAt || !(h.endsAt > h.startsAt)) return;
  const now = Date.now(), span = Math.max(1, h.endsAt - h.startsAt), left = Math.max(0, Math.min(1, (h.endsAt - now) / span));
  const nextColor = h.next?.color ?? C.paper, top = -Math.PI / 2, end = top + Math.PI * 2 * left, rr = HOUR_R * Z;
  if (h.id !== clockOf) { if (clockOf) { clockFlash = now + 1600; burst(CX, CY - rr, [h.color, C.gold, '#fff'], 60, 8); } clockOf = h.id; }
  const flash = Math.max(0, (clockFlash - now) / 1600);
  fx.save();
  fx.lineCap = 'round';
  fx.globalAlpha = .28; fx.strokeStyle = nextColor; fx.lineWidth = 8 * Z;
  fx.beginPath(); fx.arc(CX, CY, rr, 0, Math.PI * 2); fx.stroke();
  fx.globalAlpha = .95; fx.strokeStyle = h.color; fx.lineWidth = (10 + 10 * flash) * Z; fx.shadowColor = h.color; fx.shadowBlur = 14 + 30 * flash;
  if (left > 0.002) { fx.beginPath(); fx.arc(CX, CY, rr, top, end); fx.stroke(); }
  fx.restore();
  // the medallion on the boundary, with the time left
  const mx = CX + Math.cos(end) * rr, my = CY + Math.sin(end) * rr, pr = (22 + 8 * flash + 2 * Math.sin(t / 300)) * Z;
  const g = fx.createRadialGradient(mx - pr * .3, my - pr * .3, 2, mx, my, pr * 1.7);
  g.addColorStop(0, '#fff'); g.addColorStop(.5, h.color); g.addColorStop(1, 'rgba(0,0,0,0)');
  fx.globalAlpha = 1; fx.fillStyle = g; fx.beginPath(); fx.arc(mx, my, pr * 1.7, 0, 7); fx.fill();
  fx.fillStyle = '#2F3C44'; fx.font = `400 ${Math.round(pr * 1.15)}px 'Segoe UI Symbol', sans-serif`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(h.glyph ?? '', mx, my + 1);
  drawLabel(label(`${h.label} · ${mmss(h.endsAt - now)}`, 15, h.color), mx, my + pr + 2);
  fx.globalAlpha = 1;
}

// --- the headliners: how each is played, in one line ---------------------------------------------------------------
const HEAD_ICON = { elite: '☄️', tug: '🪢', roast: '🎡', quizchain: '🧠', moonnight: '🌕', final: '👑', chestrain: '🎁', guessobject: '🕵️', starcatch: '🌠' };
const HEAD_HOW = {
  quizchain: `${S.config?.quizChainLength ?? 5} câu liền · trả lời đúng liên tiếp để giữ chuỗi`,
  moonnight: 'quẻ chung cho cả phòng · thả tim để trăng lên nhanh gấp đôi',
  final: 'đến hết màn: phe góp nhiều ánh sao nhất được đội vương miện',
  chestrain: 'rương mở 3 lần liền — gõ “nhận” mỗi lần',
};

// --- weather: the act sets the mood of the sky. Đấu trường = embers rising from the arcs, Hội ngộ = hearts and sparkles
// drifting up. At most 26 specks, drawn behind the mascots, skipped with ?lite=1.
let weather = [];
function drawWeather(t, dt) {
  const act = S.cosmos?.act?.id;
  if (lite || !act) { weather.length = 0; return; }
  const arena = act === 'arena';
  if (weather.length < 26 && Math.random() < .4 * dt) {
    weather.push({ x: rnd(70, 1010), y: rnd(WHEEL_T + 360, LAYOUT.wheelB - 20), vy: -rnd(.7, 1.7), vx: rnd(-.3, .3), life: rnd(100, 180), r: arena ? rnd(1.6, 3.6) : rnd(5, 10), ph: rnd(0, 6), kind: arena ? 0 : Math.random() < .55 ? 1 : 2 });
  }
  weather = weather.filter(p => (p.life -= dt) > 0);
  for (const p of weather) {
    p.x += (p.vx + Math.sin(t / 600 + p.ph) * .35) * dt; p.y += p.vy * dt;
    fx.globalAlpha = Math.min(1, p.life / 40) * (arena ? .85 : .7);
    if (p.kind === 0) { fx.fillStyle = p.r > 2.6 ? '#ffd45e' : '#ff8a3d'; fx.beginPath(); fx.arc(p.x, p.y, p.r, 0, 7); fx.fill(); }
    else if (p.kind === 1) { fx.fillStyle = '#F2A7C3'; heartShape(p.x, p.y, p.r); fx.fill(); }
    else { fx.fillStyle = C.gold; starPath(p.x, p.y, p.r, p.r * .42, t / 1500 + p.ph); fx.fill(); }
  }
  fx.globalAlpha = 1;
}

const SHOW_LABEL = { starcall: 'điểm danh sao', meteor: 'mưa sao băng' };


let lastFrame = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - lastFrame < 1000 / FPS - 2) return;
  const dt = Math.min(3, (t - lastFrame) / (1000 / 60));
  lastFrame = t;
  fx.clearRect(0, 0, 1080, FRAME_HEIGHT);

  for (const s of twinkles) { s.p += 0.05 * dt; fx.globalAlpha = .25 + .75 * Math.abs(Math.sin(s.p)); fx.fillStyle = C.paper; fx.fillRect(s.x, s.y, 2.2, 2.2); }
  fx.globalAlpha = 1;
  drawCommunitySky(t, dt);
  safe('act clock', () => drawHourFx(t));
  safe('weather', () => drawWeather(t, dt));
  drawVisitors(t);

  // viewers stand on their team's arc (up to CROWD_PER_TEAM per team): their mascot (bigger, with a halo, as it levels
  // up), their own TikTok avatar on its shoulder, and the newest arrival's name
  orbitSpots.clear();
  const now = Date.now();
  for (const id of IDS) {
    const placed = crowd[id], newest = placed.reduce((m, o) => Math.max(m, o?.order ?? 0), 0);
    placed.forEach((o, slot) => {
      if (!o) return;
      const v = o.v, i = slot;
      const dance = (dancing.get(v.userId) ?? 0) > now || S.hud?.moon.partyMs > 0;
      const bob = Math.sin(t / (dance ? 120 : 600) + i * 1.7) * (dance ? 10 : 4);
      const [sx, sy, ang] = crowdSpot(id, slot), x = sx, y = sy + bob;
      orbitSpots.set(v.userId, [x, y - 20]);
      const lv = v.level ?? 1, k = (1 + 0.08 * (lv - 1)) * Z, w = 58 * k, h = 85 * k;
      if (v.aura > now) { // a recent gift: a slow golden ring of sparkles round the giver's mascot
        for (let k = 0; k < 6; k++) { const q = t / 700 + k * 1.047; fx.globalAlpha = .55 + .45 * Math.sin(t / 200 + k); fx.fillStyle = FAN_GOLD; fx.beginPath(); fx.arc(x + Math.cos(q) * 40 * Z, y + Math.sin(q) * 46 * Z, 3.5, 0, 7); fx.fill(); }
        fx.globalAlpha = 1;
      }
      if (lv > 1 && LEVEL_COLOR[lv]) {
        const g = fx.createRadialGradient(x, y, 6, x, y, 30 + lv * 7);
        g.addColorStop(0, LEVEL_COLOR[lv]); g.addColorStop(1, 'rgba(0,0,0,0)');
        fx.globalAlpha = .55 + .2 * Math.sin(t / 400 + i); fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, 30 + lv * 7, 0, 7); fx.fill(); fx.globalAlpha = 1;
      }
      const sp = sprites[v.team];
      if (sp) {
        if (dance) { fx.save(); fx.translate(x, y); fx.rotate(Math.sin(t / 140 + i) * .18); fx.drawImage(sp, -w / 2, -h / 2, w, h); fx.restore(); }
        else fx.drawImage(sp, x - w / 2, y - h / 2, w, h);
      }
      drawAvatar(v, x + w / 2 - 6, y - h / 2 + 8, v.fan || v.sub ? 20 : 17, v.fan || v.sub ? FAN_GOLD : color(v.team), lv, v.fan ? `♥${v.fan}` : v.sub ? 'SUB' : '', v.frame ? FRAME_COLOR[v.frame] : null);
      if (o.order === newest || v.aura > now) { // names: the newest of the team, and anyone with a gift halo
        const lb = label(v.nickname, 15, v.title === 'Tân Tinh' ? C.paper : '#F2C45C');
        drawLabel(lb, x, Math.sin(ang) < 0 ? y - h / 2 - 28 : y + h / 2 + 2); // names go on the outer side, away from the centre
      }
    });
  }

  // comets: shared light flowing from a lit team's arc to a dark one, along the wheel
  comets = comets.filter(c => c.t < 1);
  for (const c of comets) {
    c.t += 0.022 * dt;
    const e = c.t < .5 ? 2 * c.t * c.t : 1 - (-2 * c.t + 2) ** 2 / 2;
    const [x, y] = at(R + Math.sin(c.t * Math.PI) * -70, c.a0 + (c.a1 - c.a0) * e);
    c.trail.push([x, y]); if (c.trail.length > 14) c.trail.shift();
    c.trail.forEach(([px, py], i) => { fx.globalAlpha = i / c.trail.length * .8; fx.fillStyle = c.c; fx.beginPath(); fx.arc(px, py, 3 + i * .5, 0, 7); fx.fill(); });
    fx.globalAlpha = 1; fx.fillStyle = C.paper; fx.beginPath(); fx.arc(x, y, 9, 0, 7); fx.fill();
    if (c.t >= 1) { const [nx, ny] = at(R, c.a1); burst(nx, ny, [c.c2, C.paper], 18, 5); }
  }

  parts = parts.filter(p => (p.life -= dt) > 0);
  for (const p of parts) {
    p.vx *= .97; p.vy = p.vy * .97 + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    fx.globalAlpha = Math.min(1, p.life / 25); fx.fillStyle = p.c;
    if (p.heart) { heartShape(p.x, p.y, p.r); fx.fill(); }
    else fx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }
  fx.globalAlpha = 1;

  meteors = meteors.filter(m => m.y < 2000);
  fx.lineWidth = 4;
  for (const m of meteors) {
    if ((m.delay -= dt) > 0) continue;
    m.x -= m.v * .55 * dt; m.y += m.v * dt;
    const g = fx.createLinearGradient(m.x, m.y, m.x + m.len * .55, m.y - m.len);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,211,107,0)');
    fx.strokeStyle = g; fx.beginPath(); fx.moveTo(m.x, m.y); fx.lineTo(m.x + m.len * .55, m.y - m.len); fx.stroke();
  }

  // the boss's strikes: a beam from the comet to the team it hits (or a shield ring that stops it)
  beams = beams.filter(b => b.t < 1);
  for (const b of beams) {
    b.t += dt / 40;
    fx.globalAlpha = 1 - b.t;
    if (b.blocked) { fx.strokeStyle = b.c; fx.lineWidth = 14 * (1 - b.t) + 2; fx.beginPath(); fx.arc(CX, CY, (300 + b.t * 40) * Z, 0, 7); fx.stroke(); }
    else {
      fx.strokeStyle = b.c; fx.lineWidth = 22 * (1 - b.t) + 3; fx.lineCap = 'round';
      fx.beginPath(); fx.moveTo(CX, CY - 60 * Z); fx.lineTo(b.x, b.y); fx.stroke();
      fx.strokeStyle = '#ffffff'; fx.lineWidth = 5 * (1 - b.t) + 1; fx.beginPath(); fx.moveTo(CX, CY - 60 * Z); fx.lineTo(b.x, b.y); fx.stroke();
    }
  }
  fx.globalAlpha = 1;

  shots = shots.filter(s => s.t < 1);
  for (const s of shots) {
    s.t += 0.045 * dt;
    const e = s.t * s.t, x = s.x0 + (CX - s.x0) * e, y = s.y0 + (CY - 40 * Z - s.y0) * e;
    fx.fillStyle = s.c; fx.beginPath(); fx.arc(x, y, s.ult ? 20 : s.crit ? 14 : 9, 0, 7); fx.fill();
    fx.fillStyle = C.paper; fx.beginPath(); fx.arc(x, y, s.crit ? 6 : 4, 0, 7); fx.fill();
    if (s.t >= 1) {
      burst(CX, CY - 40 * Z, [s.c, C.paper, s.crit ? C.accent : C.gold], s.crit ? 40 : 14, s.crit ? 10 : 6);
      floats.push({ x: CX + rnd(-140, 140) * Z, y: CY - 90 * Z + rnd(-30, 30), t: 0, text: `-${fmt(s.dmg)}${s.ult ? ' TUYỆT KỸ' : s.crit ? ' CHÍ MẠNG' : ''}`, col: s.ult ? C.gold : s.crit ? C.accent : '#ffffff' });
      bossShake();
    }
  }
  floats = floats.filter(f => f.t < 1);
  for (const f of floats.slice(-8)) {
    f.t += dt / 50;
    fx.globalAlpha = 1 - f.t;
    const lb = label(f.text, 26, f.col);
    fx.drawImage(lb, f.x - lb.lw / 2, f.y - f.t * 60, lb.lw, lb.lh);
  }
  fx.globalAlpha = 1;
}
requestAnimationFrame(frame);

// --- the event lane: ONE thing is announced at a time (see lane.js) -------------------------------------
//   level 0  small card in the centre of the wheel      level 1  announcement strip (#event)
//   level 2  reading / quiz / poll (modals)             level 3  celebration over the whole wheel (#hero)
const lane = createLane({ breath: 1400 }); // a 1.4s pause after each celebration lets cards and modals through
setInterval(() => lane.tick(), 100);
const LV = { TICK: 0, CARD: 1, MODAL: 2, BIG: 3 };
const go = ev => { lane.submit(ev); lane.tick(); };

let centerUntil = 0, attractI = 0;
const paintCenter = html => { const c = $('center'); c.innerHTML = `<div class="slide">${html}</div>`; c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); };

// level 0: someone joined, a small gift…
function spotlight(html, ms = 1800, key = 'spot') {
  go({ key, level: LV.TICK, ms, show: () => { paintCenter(html); centerUntil = Date.now() + ms + 400; } });
}
// The centre is the main stage. While the lane is free it never shows filler: it turns between the night's journey
// (the chapter in progress, so a newcomer sees at once what the room is doing), what comes on the stage next, the
// four teams' race, and — when a team is still empty — an invitation to take its seat.
function journeyCard(j) {
  const pct = Math.round(100 * j.got / j.need);
  const dots = Array.from({ length: j.of }, (_, i) => `<i class="${i < j.no - 1 || j.done ? 'done' : i === j.no - 1 ? 'now' : ''}"></i>`).join('');
  return `<div class="kick">Hành trình đêm · chặng ${j.no}/${j.of}</div><div class="ico-g">${j.icon}</div><div class="cap">${esc(j.label)}</div>`
    + `<div class="sub">${j.done ? 'cả hành trình đã trọn vẹn 👑' : `${j.got}/${j.need} ${esc(j.goal)}`}</div><div class="jbar"><i style="width:${j.done ? 100 : pct}%"></i></div><div class="jdots">${dots}</div>`;
}
// The four teams' race for the night: one bar per team, the leader marked.
function teamsCard(r) {
  const light = r.light ?? {}, max = Math.max(1, ...Object.values(light));
  return `<div class="kick">Đua phe đêm nay</div><div class="elrace">${TEAMS.map(t => `<div class="el${t.id === r.lead ? ' lead' : ''}" style="--c:${t.color}"><span><img class="ti" src="/art/team-${t.id}.svg" alt=""> ${esc(t.label)}</span><b><i style="width:${Math.round(100 * (light[t.id] ?? 0) / max)}%"></i></b><em>${fmt(light[t.id] ?? 0)}</em></div>`).join('')}</div>`
    + `<div class="sub">${r.lead ? `Phe ${esc(tm(r.lead).label)} đang dẫn đầu` : 'gõ 1–4 để đổi phe'}</div>`;
}
setInterval(() => {
  const t = Date.now();
  if (!lane.idle() || t < centerUntil || !S.sky) return;
  const c = S.cosmos, j = c?.journey, act = c?.act, slot = attractI++ % 4;
  if (j && slot % 2 === 0) { paintCenter(journeyCard(j)); centerUntil = t + 5200; return; }
  if (slot === 1 && act?.headLabel && act.headInMs > 0) {
    paintCenter(`<div class="kick">Sắp diễn ra</div><div class="ico-g">★</div><div class="cap">${esc(act.headLabel)}</div><div class="sub">sau ${mmss(act.headInMs)} · ở lại để cùng chơi!</div>`);
    centerUntil = t + 4200;
    return;
  }
  if (slot === 3 && j?.teams?.lead) { paintCenter(teamsCard(j.teams)); centerUntil = t + 4800; return; }
  // an invitation to the team with the fewest people on stage
  const count = id => S.stage.filter(v => v.team === id).length, id = [...IDS].sort((a, b) => count(a) - count(b))[0];
  if (!id) { if (j) { paintCenter(journeyCard(j)); centerUntil = t + 4000; } return; }
  const s = tm(id);
  paintCenter(`<img src="${mascot(id, 'hype')}" alt=""><div class="cap">Phe ${esc(s.label)}</div><div class="sub">đang ít người nhất · gõ “${esc(s.label)}” hoặc 1–4 để đổi phe ✨</div>`);
  centerUntil = t + 3500;
}, 250);

// Giờ sinh tử: the last ten seconds of a fight (boss, tug of war) or a short game count down in red over the centre.
let doomAt = 0, doomShown = 0;
setInterval(() => {
  const el = $('doom'), left = doomAt - Date.now(), sec = Math.ceil(left / 1000);
  if (!(left > 0 && left <= 10000)) { if (doomShown) { el.className = ''; el.textContent = ''; doomShown = 0; } return; }
  if (sec === doomShown) return;
  doomShown = sec;
  el.className = 'on';
  el.innerHTML = `<b>${sec}</b><span>giây sinh tử!</span>`;
  sfx('quizTick');
}, 100);

// level 1: one announcement strip with an icon, a title and an optional line under it, plus a countdown bar
const eventEl = $('event');
function card({ key, icon = '✨', title, sub = '', color: ec = C.gold, ms = 2800, kind = '', ttl }) {
  go({
    key, level: LV.CARD, ms, minShow: 1400, ...(ttl && { ttl }),
    show: () => { eventEl.innerHTML = `<div class="ev${kind ? ' ' + kind : ''}" style="--ec:${ec};--ms:${ms}ms"><div class="ic">${icon}</div><div class="tx"><div class="tt">${title}</div>${sub ? `<div class="ss">${sub}</div>` : ''}</div><i class="pg"></i></div>`; },
    hide: () => { eventEl.innerHTML = ''; },
  });
}

// A gift gets its own golden card: the gift picture bouncing, the gift as the headline, the sender's face
// and name under it, a combo bubble for repeats, and a shower of coins out of the card when it lands.
const giftPic = e => (e.giftImage ? `<img src="${esc(e.giftImage)}" alt="">` : ICON.gift);
function giftCard(e, team) {
  const ms = e.count >= 5 ? 4200 : 3400;
  go({
    key: 'gift', level: LV.CARD, ms, minShow: 1800,
    show: () => {
      eventEl.innerHTML = `<div class="ev gift" style="--ms:${ms}ms"><div class="ic">${giftPic(e)}</div><div class="tx"><div class="tt">${esc(e.giftName ?? 'Quà tặng')}</div>`
        + `<div class="ss">${e.avatar ? `<img src="${esc(e.avatar)}" alt="">` : ''}<span><b>${esc(e.nickname)}</b> · ${gain(e, team)}</span></div></div>`
        + `${e.count > 1 ? `<div class="combo"><b>x${e.count}</b><small>${e.count >= 5 ? 'COMBO' : 'QUÀ'}</small></div>` : ''}<i class="pg"></i></div>`;
      for (let i = 0; i < 3; i++) setTimeout(() => burst(rnd(120, 960), CY + 40, [gold, '#FFE7A1', C.paper, team ? color(team) : C.accent], 26, 9), i * 180);
    },
    hide: () => { eventEl.innerHTML = ''; },
  });
}

// A gift ability (a gift lands in the fight that is on) gets a big banner of its own, level 1 like the gift card: the ability's
// text exactly as the server words it, the giver's face and name. It never says what to do to get it.
const ABILITY_ICON = { ultimate: '⚡', thaw: '🔥', yank: '💪', boost: '🚀', advance: '🌟', 'extra-chest': '🎁', 'golden-chest': '🏆', bless: '🙏', gild: '✨', 'full-moon': '🌕', ticket: '🎟️', pick: '🎯', respin: '🎡', progress: '🧭', complete: '🏁' };
function abilityBanner(e) {
  if (!e.text) return;
  const col = e.team ? color(e.team) : C.gold, ms = e.tier === 'big' ? 4600 : 3800;
  go({
    key: 'ability', level: LV.CARD, ms, minShow: 2200, ttl: 12000,
    show: () => {
      eventEl.classList.add('big');
      eventEl.innerHTML = `<div class="ev ability" style="--ec:${col};--ms:${ms}ms"><div class="ic">${ABILITY_ICON[e.ability] ?? '✨'}</div><div class="tx"><div class="tt">${esc(e.text)}</div>`
        + `<div class="ss">${e.avatar ? `<img src="${esc(e.avatar)}" alt="">` : ''}<span><b>${esc(e.nickname)}</b>${e.team ? ` · phe ${esc(tm(e.team).label)}` : ''}</span></div></div>${e.team ? `<img class="tm" src="/art/team-${e.team}.svg" alt="">` : ''}<i class="pg"></i></div>`;
      const [x, y] = e.team ? nodePos(e.team) : [CX, CY];
      burst(x, y, [col, C.gold, C.paper], e.tier === 'big' ? 90 : 50, e.tier === 'big' ? 12 : 9);
    },
    hide: () => { eventEl.classList.remove('big'); eventEl.innerHTML = ''; },
  });
}

// level 3: the big moments take over the wheel area
const heroEl = $('hero');
function celebrate({ key, badge = '', icon = '', glyphs = '', mascotSign = null, mood = 'win', title, sub = '', extra = '', color: hc = C.gold, ms = 3200, compact = false }) {
  // while the boss, a tug of war or a short game is on the arena stays in view: other celebrations shrink to the announcement strip
  // (the strip keeps the celebration's picture — a gift, the chest, an avatar — as its icon)
  const arena = S.cosmos?.boss ? 'boss' : S.cosmos?.tug ? 'tug' : S.cosmos?.mystery ? 'mystery' : S.cosmos?.starcatch ? 'starcatch' : S.cosmos?.roast ? 'roast' : null; // these keep the centre in view
  if (arena && key !== arena) return card({ key, icon: icon || extra.match(/<img[^>]*>|<span class="av[^"]*"[^>]*>[^<]*<\/span>/)?.[0] || '✨', title: `${badge ? `${badge} · ` : ''}${title}`, sub, color: hc, ms: Math.min(ms, 3200) });
  go({
    key, level: LV.BIG, ms,
    show: () => {
      heroEl.style.setProperty('--hc', hc);
      heroEl.className = `on${compact ? ' compact' : ''}`;
      heroEl.innerHTML = `${badge ? `<div class="badge">${badge}</div>` : ''}${extra || (mascotSign ? `<img src="${mascot(mascotSign, mood)}" alt="">` : icon ? `<div class="big">${icon}</div>` : '')}${glyphs ? `<div class="glyphs gf">${glyphs}</div>` : ''}<div class="cap">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    },
    hide: () => { heroEl.className = ''; heroEl.innerHTML = ''; },
  });
}

// --- part renderers (called only when a part changed) ----------------------------------------------------
function renderSky(sky) {
  for (const s of sky.sky ?? []) {
    const n = nodes[s.id];
    if (!n) continue;
    n.f.style.strokeDasharray = `${Math.min(1, s.progress).toFixed(3)} 1`; // the arc fills with the team's light…
    n.f.style.opacity = (.45 + .55 * Math.min(1, s.progress)).toFixed(2); // …and brightens as it does
    if (n.lit !== s.lit) { n.el.classList.toggle('lit', s.lit); n.g.classList.toggle('lit', s.lit); n.lit = s.lit; } // full: glows
  }
  renderCall();
}

function renderStage(list) {
  placeCrowd(list);
  const counts = {};
  for (const v of list) counts[v.team] = (counts[v.team] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  for (const id of IDS) {
    const n = nodes[id];
    if (!n) continue;
    const count = counts[id] ?? 0;
    n.el.style.setProperty('--fill', `${max ? count / max * 100 : 0}%`);
    n.more.classList.toggle('on', count > 0);
    if (count > 0) n.more.textContent = String(count);
    n.el.classList.toggle('waiting', !count); // an empty team stays empty: no mascot, dashed badge
  }
}

// Nhiệm vụ giờ: the room's goal for this hour (taking part, never gifts) on the top card's last line.
function renderQuest(q) {
  const el = $('quest');
  el.style.display = q ? '' : 'none';
  if (!q) return;
  el.style.setProperty('--qc', q.color);
  el.classList.toggle('done', q.done);
  $('qtitle').textContent = `${q.glyph} Nhiệm vụ giờ`;
  $('qfill').style.transform = `scaleX(${Math.min(1, q.got / q.goal).toFixed(3)})`;
  $('qnums').textContent = q.done ? '✓ xong!' : `${fmt(q.got)}/${fmt(q.goal)} ${q.unit}`;
  $('qrew').textContent = `→ ${q.reward.split(' · ')[0]}`;
}

let shownOccasion = false, shownFortune = null, quizReveal = 0, lastQuizTick = 0, pollReveal = 0;
function renderHud(h) {
  if (!S.cosmos?.act) $('kicker').textContent = `Đêm ${h.night.no} · ${h.occasion ? h.occasion.name : `${fmt(h.night.visitors)} người ghé thăm`}`;
  if (h.occasion && !shownOccasion) { shownOccasion = true; celebrate({ key: 'occasion', badge: 'HÔM NAY', icon: '🎉', title: esc(h.occasion.name), sub: esc(h.occasion.greeting), ms: 5000, compact: true }); }
  const party = h.moon.partyMs > 0, pct = party ? 1 : h.moon.light / h.moon.goal;
  $('moonRect').setAttribute('y', String(120 - 120 * pct));
  $('moon').classList.toggle('party', party);
  $('moonPct').textContent = party ? `${Math.ceil(h.moon.partyMs / 1000)}s` : `${Math.floor(pct * 100)}%`;
  $('moonSub').textContent = party ? 'trăng rằm · x2' : 'thả tim để trăng lên';
  const lucky = h.lucky?.team ?? null;
  if (lucky !== S.lucky) {
    if (S.lucky) nodes[S.lucky]?.el.classList.remove('lucky');
    if (lucky) nodes[lucky]?.el.classList.add('lucky');
    S.lucky = lucky;
  }
  renderCall();
  safe('fortune', () => renderFortune(h.fortune));
  safe('quiz', () => renderQuiz(h.quiz));
  safe('poll', () => renderPoll(h.poll));
  music.setMood(party || S.stage.length >= 8 ? 'upbeat' : 'calm');
}

function renderRace(r) {
  const top = Math.max(1, r.order?.[0]?.given ?? 0);
  for (const x of r.order ?? []) {
    const c = chips[x.id], lead = x.rank === 1 && x.given > 0;
    if (!c) continue;
    c.el.style.setProperty('--o', x.rank);
    c.el.style.setProperty('--p', (x.given / top).toFixed(3));
    c.rk.textContent = lead ? '👑' : x.rank;
    c.v.textContent = fmt(x.given);
    c.el.classList.toggle('lead', lead);
    if (c.crowns !== x.crowns) { c.crowns = x.crowns; c.nm.textContent = tm(x.id).label + (x.crowns ? ` 🏆${x.crowns}` : ''); }
    nodes[x.id]?.el.classList.toggle('lead', r.leader === x.id);
  }
}

// One line under the progress dots: the lucky star while it lasts, otherwise who is still waiting.
let lastCall = '';
function renderCall() {
  const h = S.hud, sky = S.sky;
  if (!h || !sky) return;
  let html, kind = '';
  const cz = S.cosmos;
  if (cz?.boss) { kind = 'boss'; html = '☄ <b>Đánh Sao Chổi Đen!</b> comment · thả tim — mỗi phe một vai'; }
  else if (!S.stage.length && !h.lucky) html = 'Chào mừng! Vào là có phe ngay · gõ <b>1–4</b> để đổi phe ✨';
  else if (cz?.predict?.open) { kind = 'boss'; const [A, B] = cz.predict.options ?? []; html = `🔮 <b>${esc(cz.predict.q ?? '')}</b> · gõ “đoán A” ${esc(A?.label ?? '')} (${A?.n ?? 0}) / “đoán B” ${esc(B?.label ?? '')} (${B?.n ?? 0}) · ${Math.ceil((cz.predict.closesInMs ?? 0) / 1000)}s`; }
  else if (cz?.roast) { kind = 'boss'; html = cz.roast.spinning ? '🎡 <b>Vòng quay may mắn</b> đang quay…' : `🎡 <b>Vòng quay may mắn: ${esc(cz.roast.nickname)}</b> · gõ “oan” ${cz.roast.protests}/${cz.roast.need} · “chuẩn” ${cz.roast.agree} · ${Math.ceil(cz.roast.remainingMs / 1000)}s`; }
  else if (cz?.tug) { kind = 'boss'; html = `🪢 <b>Kéo co 2 phe</b> · ${esc(tm(cz.tug.a).label)} và ${esc(tm(cz.tug.b).label)} đang đấu`; }
  else if (cz?.mystery) { kind = 'boss'; html = `🕵️ <b>Đoán vật</b> · gõ đáp án bạn đoán · gợi ý ${cz.mystery.clues.length}/${cz.mystery.of}`; }
  else if (cz?.starcatch) { kind = 'boss'; html = `🌠 <b>Hứng sao băng</b> · sao ${cz.starcatch.round}/${cz.starcatch.of} · gõ “${esc(cz.starcatch.word ?? '')}”`; }
  else if (cz?.head) html = `★ <b>${esc(cz.head.label)}</b> đang diễn ra · ${mmss(Math.max(0, S.headEnd - Date.now()))}`;
  else if (h.lucky) html = `⭐ <b>Phe may mắn: ${esc(tm(h.lucky.team).label)}</b> · ánh sao x${h.lucky.multiplier} · ${Math.ceil(h.lucky.remainingMs / 1000)}s`;
  else if (cz?.act && cz.act.phase === 'play' && S.headAt - Date.now() < 300000) html = `${cz.act.glyph} sắp tới: <b>★ ${esc(cz.act.headLabel)}</b> sau ${mmss(Math.max(0, S.headAt - Date.now()))}`;
  else {
    // the boss countdown takes over from the lucky team's once it is under two minutes away
    const next = cz?.bossInMs != null && cz.bossInMs < 120000 ? ` · ☄ <b>Sao Chổi Đen sau ${clock(cz.bossInMs)}</b>` : h.luckyInMs > 0 ? ` · ⭐ phe may mắn sau ${clock(Math.ceil(h.luckyInMs / 10000) * 10000)}` : '';
    html = sky.litCount < IDS.length ? `Đang sáng ${sky.litCount}/${IDS.length} phe · còn chờ ${(sky.waiting ?? []).slice(0, 2).map(id => `<b>${esc(tm(id).label)}</b>`).join(', ')}${next}` : 'Cả bốn phe đã sáng!';
  }
  if (html !== lastCall) { lastCall = html; $('call').innerHTML = html; $('call').className = `call${kind ? ' ' + kind : ''}`; }
}

// --- the real sky, Thủy Nghịch, the boss and the star chest -----------------------------------------------
// Kho tài nguyên: how each resource looks, and where a drop came from.
const RES = {
  dust: { label: 'điểm sáng', img: '/art/dust.svg', color: C.gold },
  moon: { label: 'mảnh trăng', img: '/art/moon-shard.svg', color: '#FFE7A1' },
};
const NEED_FOR = { fortune: 'gõ “xin quẻ”', chest: 'gõ “nhận” khi rương mở', upgrade: 'gõ “nâng cấp”', call: 'gõ “gọi sao”' };
for (const t of TEAMS) RES[t.id] = { label: `Ngọc ${t.label}`, img: `/art/gem-${t.id}.svg`, color: t.color }; // gem keys are team ids: the picture is one gem tinted in the team's colour
const HEAT = [
  { name: 'Yên ả', color: '#8EC0B9' }, { name: 'Ấm lên', color: '#F2C45C' }, { name: 'Nóng', color: '#ff9f43' },
  { name: 'Bùng cháy', color: '#ff6b3d' }, { name: 'Siêu tân tinh', color: '#ff3d7f' },
];

// The fan club members on stage right now, with their level (bottom-right of the wheel).
let fanKey = '';
function renderFans(c) {
  const key = `${c.fanCount}|${c.fans.map(f => f.nickname + f.level).join(',')}`;
  if (key === fanKey) return;
  fanKey = key;
  $('fanbox').classList.toggle('on', c.fanCount > 0);
  $('fanbox').innerHTML = c.fanCount ? `<b>♥ Fanclub có mặt · ${c.fanCount}</b><div>${c.fans.map(f => `${avatarHtml(f, 'av fanring')}<span>${esc(f.nickname)}${f.level ? ` <em>Lv${f.level}</em>` : ''}</span>`).join('')}</div>` : '';
}

// A quiet room: one of the house mascots shows a command. Always labelled as a mascot, with "(mẫu)" on what it
// makes, so nobody mistakes it for a viewer; it is there to teach, not to fake a crowd.
const DEMO = {
  join: ['Vào là có phe', 'ai ghé phòng cũng được xếp phe ngay · gõ 1–4 để đổi phe'],
  wish: ['Gõ “ước …”', 'thả đèn ước mang lời ước lên trời, cả phòng gõ “chúc”'],
  fortune: ['Gõ “xin quẻ”', 'nhận quẻ may mắn riêng của bạn hôm nay'],
  upgrade: ['Gõ “nâng cấp”', 'dùng điểm sáng + ngọc màu phe để linh vật lớn lên, có hào quang'],
  bless: ['Gõ “chúc”', 'chúc phúc điều ước của người khác, nhận điểm sáng'],
  chest: ['Gõ “nhận”', 'khi rương sao mở (góc trên) để nhận điểm sáng'],
  switch: ['Gõ “đổi” + tên màu', 'chọn nhầm phe? đổi sang phe khác, 30 giây một lần'],
};
const SAMPLE_WISHES = ['cả nhà luôn bình an', 'tháng này đủ tiền tiêu', 'gặp người thương mình thật lòng', 'thi đâu đỗ đó'];
function demo(e) {
  const [cmd, what] = DEMO[e.demo] ?? DEMO.join, s = tm(e.team);
  spotlight(`<div class="demo-tag">🎓 linh vật dẫn chơi</div><img src="${mascot(e.team, 'hype')}" alt=""><div class="cap">${esc(cmd)}</div><div class="sub">${esc(what)}</div>`, 4200, 'demo');
  if (e.demo === 'wish') releaseLantern({ id: `demo-${Date.now()}`, nickname: `Linh vật ${s.label}`, avatar: '', demo: true, text: SAMPLE_WISHES[Math.floor(Math.random() * SAMPLE_WISHES.length)] });
}

const LOOT_WHY = { welcome: 'được cả phòng chào đón', fortune: 'quẻ được khen chuẩn', pass: 'Sổ mùa', quest: 'nhiệm vụ', mystery: 'đoán trúng vật bí ẩn', catch: 'hứng sao băng', boss: 'chiến lợi phẩm Sao Chổi', chest: 'từ rương sao', quiz: 'trả lời đúng câu đố', moon: 'có mặt lúc trăng rằm', wish: 'điều ước được chúc phúc', mvp: 'MVP', tug: 'kéo co', roast: 'vòng quay may mắn' };
const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const POWER_NEED = { 'no-fight': 'ngọc chỉ dùng khi đang đánh boss hoặc kéo co', 'no-gem': 'chưa có ngọc: đánh boss, mở rương, trả lời đúng để nhận', 'no-moon': 'chưa có mảnh trăng: có mặt lúc trăng rằm, ước được chúc phúc' };

// --- kho (the unified bag) and hồ sơ (profile): level-2 cards over the wheel, a few seconds each ----------------------------
const ROLE_ICON = { fighter: '⚔️', guard: '🛡️', cheer: '📣' };
const resChip = (k, n, label) => `<span class="rchip" style="--el:${RES[k].color}"><img class="resimg" src="${RES[k].img}" alt=""><b>${fmt(Math.floor(n))}</b><small>${esc(label ?? RES[k].label)}</small></span>`;
const questRows = list => (list?.length ? `<div class="qrows">${list.map(q => {
  const got = Math.min(q.got, q.goal);
  return `<div class="qrow${q.done ? ' done' : ''}"><span>${q.done ? '✓' : '○'} ${esc(q.label)}</span><b>${got}/${q.goal}</b><i><u style="width:${Math.round(100 * got / q.goal)}%"></u></i></div>`;
}).join('')}</div>` : '<div class="qrows"><div class="qrow"><span>Chưa có nhiệm vụ nào cho bạn tối nay</span></div></div>');
const personHead = (e, line1, line2) => `<div class="phead" style="--el:${e.team ? color(e.team) : C.gold}">${avatarHtml(e, 'av big')}${e.team ? `<img class="pm" src="${mascot(e.team, 'win')}" alt="">` : ''}<div><b>${esc(e.nickname)}</b><span>${line1}</span>${line2 ? `<span>${line2}</span>` : ''}</div></div>`;
// panel: one level-2 card (the modal's own element), gone after ms; a quiz or poll that is on waits its turn
function panel(id, html, ms = 7000) {
  const m = $(id);
  go({
    key: id, level: LV.MODAL, ms, minShow: 2500,
    show: () => { m.innerHTML = html; m.classList.add('on'); syncScrim(); },
    hide: () => { m.classList.remove('on'); syncScrim(); },
  });
}
function showKho(e) {
  const bag = e.bag ?? {}, lab = k => e.labels?.[k] ?? RES[k]?.label;
  const gems = e.team ? [e.team, ...IDS.filter(id => id !== e.team && bag[id] > 0)] : IDS.filter(id => bag[id] > 0);
  const chips = [resChip('dust', bag.dust ?? 0, lab('dust')), ...gems.map(k => resChip(k, bag[k] ?? 0, lab(k))), resChip('moon', bag.moon ?? 0, lab('moon'))].join('');
  const nx = e.next, need = (have, n, name) => `<span class="${have >= n ? 'ok' : 'no'}">${fmt(Math.floor(have))}/${n} ${esc(name)}</span>`;
  const next = nx
    ? `<div class="vnext"><b>Lên Lv${e.level + 1}</b> ${[need(bag.dust ?? 0, nx.dust, lab('dust')), need(bag[nx.gem] ?? 0, nx.gems, lab(nx.gem)), ...(nx.moon ? [need(bag.moon ?? 0, nx.moon, lab('moon'))] : [])].join(' · ')} <em>→ gõ “nâng cấp”</em></div>`
    : '<div class="vnext"><b>Linh vật đã đạt cấp cao nhất</b> 👑</div>';
  const p = e.pass;
  const pass = p ? `<div class="vpass"><b>📒 Sổ mùa Lv${p.level}/${p.max}</b><span class="pbar"><i style="width:${Math.round(100 * Math.min(1, p.xp / Math.max(1, p.need)))}%"></i></span><em>${fmt(p.xp)}/${fmt(p.need)}</em>${p.next ? `<small>tiếp theo: ${esc(p.next)}</small>` : ''}</div>` : '';
  panel('kho', `<div class="k">🎒 Kho của bạn</div>${personHead(e, `<b class="lv">Lv${e.level}${e.level >= 5 ? ' 👑' : ''}</b> ${esc(e.title ?? '')}${e.team ? ` · phe ${esc(tm(e.team).label)}` : ''}`, e.role ? `${esc(e.role)}` : '')}
    <div class="vres">${chips}</div>${next}${pass}<h3 class="qh">Nhiệm vụ tối nay</h3>${questRows(e.quests)}`, 7500);
}
function showProfile(e) {
  const titles = (e.titles ?? []).slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('');
  panel('profile', `<div class="k">🪪 Hồ sơ</div>${personHead(e, `<b class="lv">Lv${e.level}</b>${e.team ? ` · phe ${esc(tm(e.team).label)}` : ''}`, `${e.role ? `${ROLE_ICON[e.role] ?? ''} ${esc(e.roleLabel ?? '')}` : ''}${e.streak > 1 ? `${e.role ? ' · ' : ''}🔥 chuỗi ${e.streak} đêm` : ''}`)}
    ${titles ? `<div class="ptitles">${titles}</div>` : ''}<h3 class="qh">Nhiệm vụ tối nay</h3>${questRows(e.quests)}`, 7000);
}
// "tung ngọc" / "thắp trăng": a resource spent in the room's event, shown where it lands
function power(e) {
  const r = RES[e.res];
  if (e.kind === 'moon') {
    const m = $('moon').getBoundingClientRect(), st = stage.getBoundingClientRect(), k = st.width / 1080;
    burst((m.left + m.width / 2 - st.left) / k, (m.top + m.height / 2 - st.top) / k, ['#FFE7A1', C.gold, '#fff'], 60, 8);
    card({ key: 'power', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `<b>${esc(e.nickname)}</b> thắp trăng!`, sub: 'một mảnh trăng · trăng sáng thêm 20% 🌕', color: r.color, ms: 2600 });
    return;
  }
  const where = e.target === 'boss' ? [CX, CY] : spotOf(e.userId, e.team);
  burst(where[0], where[1], [r.color, C.gold, '#fff'], 110, 13);
  card({ key: 'power', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `<b>${esc(e.nickname)}</b> tung ${esc(r.label)}! 💥`, sub: e.target === 'tug' ? 'cú kéo cực mạnh cho phe mình' : 'đòn mạnh dành cho Boss · gõ “tung ngọc” khi có ngọc', color: r.color, ms: 2600 });
}

function renderCosmos(c) {
  S.cosmos = c;
  // the fight that ends soonest sets the "giờ sinh tử" countdown
  const ends = [c.boss?.remainingMs, c.tug && !c.tug.warmupMs ? c.tug.remainingMs : null, c.mystery?.remainingMs].filter(ms => ms > 0);
  doomAt = ends.length ? Date.now() + Math.min(...ends) : 0;
  safe('wishes', () => renderWishes(c.wishes ?? []));
  safe('fans', () => renderFans(c));
  safe('join', () => renderJoin());
  // the chest: a countdown, wobbling in the last minute, then OPEN
  const ch = c.chest, chest = $('chest');
  chest.style.display = ch.open || ch.inMs != null ? '' : 'none';
  chest.classList.toggle('open', ch.open);
  chest.classList.toggle('gold', Boolean(ch.open && ch.gold));
  chest.classList.toggle('soon', !ch.open && ch.inMs != null && ch.inMs < 60000);
  $('chestT').textContent = ch.open ? `MỞ · ${Math.ceil(ch.remainingMs / 1000)}s` : ch.inMs != null ? mmss(ch.inMs) : '';
  $('chestS').textContent = ch.open ? (ch.gold ? 'rương vàng · gõ “nhận”' : 'gõ “nhận”') : 'tới rương sao';
  for (const id of IDS) nodes[id].el.classList.toggle('frozen', c.boss?.frozen?.team === id);
  safe('arena', () => renderArena(c));
  safe('quest', () => renderQuest(c.quest));
  renderCall();
  S.headAt = c.act ? Date.now() + c.act.headInMs : 0;
  S.headEnd = c.head ? Date.now() + c.head.remainingMs : 0;
  showAt = c.show ? Date.now() + c.show.inMs : 0;
  showKind = c.show?.kind ?? '';
  renderShow();
}

// The next big moment, counted down in the top card so a newcomer always has something a minute away.
let showAt = 0, showKind = '';
function renderShow() {
  const el = $('show');
  el.style.display = showAt && S.stage.length ? '' : 'none';
  if (!showAt) return;
  const ms = showAt - Date.now(), busy = S.cosmos?.boss;
  $('showT').textContent = busy ? '…' : ms > 1000 ? mmss(ms) : 'ngay!';
  $('showS').textContent = SHOW_LABEL[showKind] ?? 'màn lớn';
  el.classList.toggle('soon', !busy && ms < 10000);
  el.classList.toggle('now', !busy && ms <= 1000);
  renderHourline();
}
setInterval(renderShow, 250);

// The act on the top card's first line ("★ Màn Đấu trường · 3:10"), its colour on the sky.
let hourKey = '';
function renderHourline() {
  const h = S.cosmos?.act;
  if (!h) return;
  const left = Math.max(0, h.endsAt - Date.now());
  $('kicker').innerHTML = `<span class="hk" style="color:${h.color}">${h.glyph} Màn ${esc(h.label)}</span> · ${mmss(left)}`;
  if (hourKey !== h.id) { hourKey = h.id; stage.style.setProperty('--hour', h.color); stage.classList.add('hourly'); }
  renderCall(); // the headliner countdown in the hint line
}

// The top-bar wish wall: the latest wishes, their words, who made them and how many blessed them.
let wishKey = '';
function renderWishes(list) {
  const key = list.map(w => `${w.id}|${w.blessings}|${w.blessed}|${w.open}`).join(',');
  if (key === wishKey) return;
  wishKey = key;
  $('wishwall').innerHTML = list.length
    ? list.slice(0, 2).map(w => `<div class="ww${w.blessed ? ' done' : w.open ? ' open' : ''}">${avatarHtml(w)}<div><b>${w.text ? `“${esc(w.text)}”` : 'điều ước bí mật ✨'}</b><span>${esc(w.nickname)} · ${w.blessed ? '⭐ cả phòng đã chúc phúc' : w.open ? `gõ “chúc” · ${w.blessings}/${S.cosmos?.blessNeed ?? 3}` : `${w.blessings} lời chúc`}</span></div></div>`).join('')
    : '<span class="empty">Gõ “ước …” để thả đèn ước — cả phòng sẽ chúc phúc cho bạn 🏮</span>';
}

// The arena covers the centre circle while the boss, a tug of war, a short game, the lucky wheel or the chest is up.
let arenaMode = '', claimKey = '', roleKey = '';
function renderArena(c) {
  const a = $('arena'), mode = c.boss ? 'boss' : c.roast ? 'roast' : c.mystery ? 'mystery' : c.starcatch ? 'starcatch' : c.tug ? 'tug' : c.chest.open ? 'chest' : '';
  if (mode === 'tug' || arenaMode === 'tug') { if (renderTug(a, c.tug, mode !== arenaMode)) { arenaMode = mode; stage.classList.toggle('arena-live', Boolean(mode)); return; } }
  if (mode === 'roast' || arenaMode === 'roast') { if (renderRoast(a, c.roast, mode !== arenaMode)) { arenaMode = mode; stage.classList.toggle('arena-live', Boolean(mode)); return; } }
  for (const game of ['mystery', 'starcatch']) if (mode === game || arenaMode === game) { if (renderMini(a, game, c[game], mode !== arenaMode)) { arenaMode = mode; stage.classList.toggle('arena-live', Boolean(mode)); return; } }
  stage.classList.toggle('arena-live', Boolean(mode));
  if (mode !== arenaMode) {
    arenaMode = mode;
    a.className = mode ? `on ${mode}mode` : '';
    claimKey = '';
    roleKey = '';
    a.innerHTML = mode === 'boss'
      ? `<div class="ak">☄ Sao Chổi Đen ☄</div><div class="boss" id="bossFig"><img src="/art/boss.svg" alt=""><i class="rage-tag">NỔI GIẬN</i></div><div class="hp"><i></i><b></b></div><div class="meta"></div><div class="st"></div>`
        + '<div class="roles"></div>'
      : mode === 'chest' ? '<div class="ak"></div><img class="chestimg" src="/art/chest-open.svg" alt=""><div class="cap"></div><div class="claims"></div><div class="sub"></div>' : '';
  }
  if (mode === 'boss') {
    const b = c.boss;
    if (!roleKey) {
      roleKey = 'roles';
      a.querySelector('.roles').innerHTML = TEAMS.map(t => `<div class="role" data-team="${t.id}" style="--el:${t.color}"><img src="/art/team-${t.id}.svg" alt=""><div class="rt"><b>${esc(t.label)}</b><span>${esc(roleText(t.id))}</span></div><em>0</em></div>`).join('');
    }
    a.querySelector('.hp i').style.transform = `scaleX(${(b.hp / b.max).toFixed(3)})`;
    a.querySelector('.hp b').textContent = `${fmt(b.hp)} / ${fmt(b.max)}`;
    a.classList.toggle('rage', b.rage);
    a.querySelector('.meta').innerHTML = `<span class="t">⏱ ${mmss(b.remainingMs)}</span><span class="sh">🛡 ${b.shield}/${b.shieldMax}</span>${b.combo > 1 ? `<span class="cb">Khí combo x${b.combo}</span>` : ''}`;
    const st = a.querySelector('.st'), fz = b.frozen;
    st.classList.toggle('ice', Boolean(fz));
    st.innerHTML = fz
      ? `❄ <b>${esc(tm(fz.team).label)}</b> bị đóng băng! Cả phe ${esc(tm(fz.team).label)} comment để phá băng ${fz.got}/${fz.need} · ${Math.ceil(fz.remainingMs / 1000)}s`
      : b.top?.length ? `Mạnh nhất: ${b.top.map(x => `<b>${esc(x.nickname)}</b> ${fmt(x.dmg)}`).join(' · ')}` : 'Comment, thả tim để tấn công!';
    for (const el of a.querySelectorAll('.role')) {
      el.querySelector('em').textContent = fmt(b.byTeam?.[el.dataset.team] ?? 0);
      el.classList.toggle('frozen', fz?.team === el.dataset.team);
    }
  } else if (mode === 'chest') {
    const ch = c.chest, gold = Boolean(ch.gold);
    a.classList.toggle('gold', gold);
    a.querySelector('.ak').textContent = gold ? '✦ Rương vàng ✦' : '✦ Rương sao đã mở ✦';
    a.querySelector('.cap').innerHTML = `Gõ <b>“nhận”</b> · ${Math.ceil(ch.remainingMs / 1000)}s`;
    a.querySelector('.sub').textContent = ch.claims ? `${fmt(ch.claims)} người đã nhận` : gold ? 'phần lớn hơn: điểm sáng và ngọc màu phe bạn' : 'mỗi người một phần điểm sáng';
    const key = ch.recent.map(r => r.nickname).join('|');
    if (key !== claimKey) { claimKey = key; a.querySelector('.claims').innerHTML = ch.recent.slice(0, 4).map(r => `<span class="zn">${esc(r.nickname)} +${r.dust}</span>`).join(''); }
  }
}
// Đoán vật and Hứng sao băng in the centre circle: the clues so far (or the falling word), the winners, a timer.
// Returns false when the game just ended (the normal arena takes over again).
function renderMini(a, game, g, fresh) {
  if (!g) { if (fresh) { a.className = ''; a.innerHTML = ''; } return false; }
  if (fresh) {
    a.className = `on ${game}mode`;
    a.innerHTML = game === 'mystery'
      ? '<div class="ak">🕵️ Đoán vật</div><div class="mq">?</div><ol class="clues"></ol><div class="mbar"><i></i></div><div class="sub mw"></div><div class="sub mt"></div>'
      : '<div class="ak">🌠 Hứng sao băng</div><div class="word"></div><div class="sub cw"></div><div class="sub ct"></div>';
  }
  if (game === 'mystery') {
    const ol = a.querySelector('.clues');
    if (ol.children.length !== g.clues.length) { ol.innerHTML = g.clues.map(c => `<li>${esc(c)}</li>`).join(''); ol.lastElementChild?.classList.add('new'); }
    a.querySelector('.mw').innerHTML = g.winners.length ? g.winners.map(w => `${['🥇', '🥈', '🥉'][w.rank - 1] ?? '⭐'} <b>${esc(w.nickname)}</b>`).join(' · ') : 'gõ đáp án bạn đoán · 3 người đúng đầu tiên nhận ngọc';
    const span = (S.config.mysteryClueSeconds ?? 20) * 1000, last = (S.config.mysteryLastSeconds ?? 20) * 1000;
    a.querySelector('.mbar i').style.transform = `scaleX(${Math.max(0, Math.min(1, g.remainingMs != null ? g.remainingMs / last : g.nextInMs / span)).toFixed(3)})`;
    a.querySelector('.mt').textContent = g.remainingMs != null ? `gợi ý cuối · còn ${Math.ceil(g.remainingMs / 1000)}s` : `gợi ý ${g.clues.length}/${g.of} · gợi ý mới sau ${Math.ceil(g.nextInMs / 1000)}s`;
  } else {
    const w = a.querySelector('.word');
    if (w.textContent !== g.word) { w.textContent = g.word ?? ''; w.classList.remove('drop'); void w.offsetWidth; w.classList.add('drop'); meteorShower(3); }
    a.querySelector('.cw').innerHTML = `gõ đúng chữ này · <b>${g.caught}/${g.need}</b> người đã hứng · sao ${g.round}/${g.of}`;
    a.querySelector('.ct').innerHTML = g.top.length ? `hứng nhiều nhất: ${g.top.map(x => `<b>${esc(x.nickname)}</b> ${x.catches}`).join(' · ')}` : `sao kế tiếp sau ${Math.ceil(g.nextInMs / 1000)}s`;
  }
  return true;
}

// Kéo co 2 phe: two teams, a rope across the centre, the knot sliding toward whoever pulls harder; a team that is boosted
// (a gift ability, 60s) gets a glowing tag.
function renderTug(a, g, fresh) {
  if (!g) { if (fresh) { a.className = ''; a.innerHTML = ''; } return false; }
  if (fresh) {
    a.className = 'on tugmode';
    a.innerHTML = `<div class="ak">🪢 Kéo co 2 phe</div><div class="teams"><b style="--el:${color(g.a)}">${teamChip(g.a)}</b><span>vs</span><b style="--el:${color(g.b)}">${teamChip(g.b)}</b></div>`
      + `<div class="rope" style="--ca:${color(g.a)};--cb:${color(g.b)}"><i class="knot"></i></div><div class="boost"></div><div class="sub ts"></div><div class="sub tp"></div>`;
  }
  const value = Number.isFinite(g.value) ? g.value : g.pos ?? 0; // −100 (team a wins) … +100 (team b wins)
  a.querySelector('.knot').style.left = `${50 + Math.max(-100, Math.min(100, value)) / 2}%`;
  const bo = a.querySelector('.boost');
  bo.classList.toggle('on', Boolean(g.boost));
  if (g.boost) { bo.style.setProperty('--el', color(g.boost.team)); bo.innerHTML = `🚀 <b>${esc(tm(g.boost.team).label)}</b> tăng tốc x2 · ${Math.ceil(g.boost.remainingMs / 1000)}s`; }
  a.querySelector('.ts').innerHTML = g.warmupMs > 0 ? `đoán trước: gõ <b>“đoán A”</b> hoặc <b>“đoán B”</b> · ${Math.ceil(g.warmupMs / 1000)}s` : `hai phe comment · thả tim để kéo · ${mmss(g.remainingMs)}`;
  a.querySelector('.tp').textContent = g.warmupMs > 0 ? '' : `${g.pullersA} người kéo · ${g.pullersB} người kéo`;
  return true;
}

// Vòng quay may mắn: the wheel (a disc of faces from the stage) spins and lands on ONE person under the pointer; then the
// person's card shows the tease and the room's "oan" / "chuẩn" count. A respin and the giver's pick are told on the card.
function roastSegments(r) {
  const pool = S.stage.filter(v => v.userId !== r.userId).sort((x, y) => slotHash(x.userId + r.userId) - slotHash(y.userId + r.userId));
  const chosen = S.stage.find(v => v.userId === r.userId) ?? r;
  const n = Math.max(6, Math.min(10, pool.length + 1));
  const segs = [];
  for (let i = 0; i < n - 1; i++) segs.push(pool.length ? pool[i % pool.length] : { userId: `?${i}`, nickname: '?', avatar: '', team: IDS[i % IDS.length] });
  const k = slotHash(r.userId) % n;
  segs.splice(k, 0, chosen);
  return { segs, k };
}
let roastKey = '';
function renderRoast(a, r, fresh) {
  if (!r) { if (fresh) { a.className = ''; a.innerHTML = ''; } roastKey = ''; return false; }
  const key = `${r.userId}|${r.again ? 1 : 0}`;
  if (fresh || key !== roastKey) {
    roastKey = key;
    a.className = 'on roastmode';
    const { segs, k } = roastSegments(r), seg = 360 / segs.length;
    const stops = segs.map((v, i) => `${i % 2 ? `color-mix(in srgb, ${color(v.team)} 70%, #fff)` : color(v.team)} ${(i * seg).toFixed(2)}deg ${((i + 1) * seg).toFixed(2)}deg`).join(',');
    a.innerHTML = `<div class="ak"></div>`
      + `<div class="rwheel"><div class="rdisc" style="background:conic-gradient(${stops})">${segs.map((v, i) => `<span style="transform:rotate(${((i + .5) * seg).toFixed(2)}deg) translateY(-150px)">${avatarHtml(v, 'av')}</span>`).join('')}</div><i class="rptr">▼</i></div>`
      + `<div class="rcard" style="--el:${color(r.team)}"><div class="rwho">${avatarHtml(r, 'av big')}<img class="rmas" src="${mascot(r.team, 'hype')}" alt=""></div><div class="rname">${esc(r.nickname)}</div>`
      + `<div class="rteam">${teamChip(r.team)}</div><div class="rline">“${esc(r.line ?? '')}”</div><div class="rcount"></div></div><div class="sub rs"></div>`;
    const disc = a.querySelector('.rdisc'), final = 360 * 5 - (k + .5) * seg, left = r.spinning ? r.spinLeftMs ?? r.spinMs ?? 4000 : 0;
    if (left > 200) {
      disc.style.transform = 'rotate(0deg)';
      void disc.offsetWidth;
      disc.style.transition = `transform ${left}ms cubic-bezier(.12,.6,.08,1)`;
      disc.style.transform = `rotate(${final}deg)`;
    } else disc.style.transform = `rotate(${final}deg)`;
    burst(CX, CY, ['#ff7a45', C.gold, C.paper], 50, 9);
  }
  a.classList.toggle('spun', !r.spinning);
  a.querySelector('.ak').textContent = r.again ? '🎡 Quay lại cả vòng!' : '🎡 Vòng quay may mắn';
  a.querySelector('.rcount').innerHTML = `<span class="oan">“oan” <b>${r.protests}/${r.need}</b></span><span class="chuan">“chuẩn” <b>${r.agree}</b></span><span class="tl">${Math.ceil(r.remainingMs / 1000)}s</span>`;
  a.querySelector('.rs').innerHTML = r.spinning ? 'vòng quay đang chọn một người…'
    : r.pick ? `🎯 <b>${esc(r.pick.nickname || 'Bạn')}</b> đang chọn phe quay trúng: gõ tên màu · ${Math.ceil(r.pick.remainingMs / 1000)}s`
    : `phe ${esc(tm(r.team).label)} gõ “oan” để minh oan · mọi người gõ “chuẩn” nếu thấy đúng`;
  return true;
}
const teamChip = id => `<img class="ti" src="/art/team-${id}.svg" alt=""> ${esc(tm(id).label)}`;
// the boss's role line for a team, as the server words it (meta.roles)
const roleText = id => { const t = String(S.roles?.[id] ?? '').replace(/^Quà\s+/i, ''); return t.charAt(0).toUpperCase() + t.slice(1); };


function bossShake() { const b = $('bossFig'); if (!b) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
// The whole frame jolts when the boss strikes.
function quake() { stage.classList.remove('quake'); void stage.offsetWidth; stage.classList.add('quake'); }

// Readings, quizzes and polls are level-2 events: they stay for as long as the game says (holdWhile),
// a celebration can interrupt them, and they come back afterwards if the game still wants them.
const syncScrim = () => $('scrim').classList.toggle('on', ['fortune', 'quiz', 'poll', 'kho', 'profile'].some(id => $(id).classList.contains('on')));
const modal = (id, holdWhile) => ({
  key: id, level: LV.MODAL, holdWhile, minShow: 3500, // long enough to read the first line
  show: () => { $(id).classList.add('on'); syncScrim(); },
  hide: () => { $(id).classList.remove('on'); syncScrim(); },
  done: () => { $(id).dataset.q = ''; },
});

// Bình chọn: four numbered options, "1"–"4" to vote; the bars fill live. A "which team…?" poll offers four teams (with their
// icons); a "next headliner" poll lets the room choose what the next act plays.
function renderPoll(p) {
  if (Date.now() < pollReveal || !p) return;
  const m = $('poll');
  if (m.dataset.q !== p.q) {
    m.dataset.q = p.q;
    m.innerHTML = `<div class="k">🗳 ${p.kind === 'next' ? 'Cả phòng chọn màn tiếp theo' : 'Bình chọn vui'}</div><h2>${esc(p.q)}</h2><div class="bars"></div><p class="hint">Comment <b style="color:var(--accent)">1, 2, 3 hoặc 4</b> để bình chọn!</p>`;
    go(modal('poll', () => Boolean(S.hud?.poll) || Date.now() < pollReveal));
  }
  const top = Math.max(1, ...p.options.map(o => o.n));
  m.querySelector('.bars').innerHTML = p.options.map((o, i) => {
    const col = o.team ? color(o.team) : ['#E97A66', '#F2C45C', '#8EC0B9', '#B48CF2'][i];
    const name = o.team ? `<img class="ti" src="/art/team-${o.team}.svg" alt=""> ${esc(o.label)}` : `${HEAD_ICON[o.head] ?? ''} ${esc(o.label)}`;
    return `<div class="bar" style="--el:${col}"><i style="transform:scaleX(${(o.n / top).toFixed(2)})"></i><span><b class="no">${i + 1}</b> ${name}</span><b>${o.n}</b></div>`;
  }).join('');
}
function revealPoll(e) {
  const m = $('poll');
  if (e.winner == null || !m.dataset.q) { pollReveal = 0; return; }
  const what = e.kind === 'next' ? `lượt sau chơi <b>${esc(e.option.label)}</b>` : `<b>${esc(e.option.label)}</b> được chọn nhiều nhất`;
  m.querySelector('.hint').innerHTML = `🎉 ${what} · ${e.votes}/${e.total} phiếu`;
  m.querySelectorAll('.bar')[e.winner]?.classList.add('win');
  pollReveal = Date.now() + 3000;
  const [x, y] = e.team ? nodePos(e.team) : [CX, CY];
  burst(x, y, [e.team ? color(e.team) : C.accent, C.gold, C.paper], 60, 9);
}

// Quẻ may mắn: the bamboo tube shakes for a moment, then the stick lands and the reading opens. A topic ("xin quẻ tình
// duyên") leads with that topic and two more lines on it. A viewer's reading carries their name and team (the team can be
// missing); the room's own reading ("quẻ chung") has none. Under the reading the room's answer counts up live:
// "chuẩn" for any reading, "xin vía" on a Thượng / Đại Cát one.
const TOPIC = { love: ['❤️', 'Tình duyên'], work: ['💼', 'Công việc'], money: ['💰', 'Tiền bạc'], luck: ['🍀', 'May mắn'] };
let fortuneOpen = 0;
function fortuneRoom(f) {
  const el = $('fortune').querySelector('.room');
  if (!el || !f.userId) return;
  el.innerHTML = `<span>🙏 <b>${f.agree}</b> người thấy chuẩn · gõ “chuẩn”</span>${f.lucky ? `<span>✨ <b>${f.vias}</b> người xin vía · gõ “xin vía”</span>` : ''}`;
}
function renderFortune(f) {
  if (!f) { if (shownFortune) { sfx('fortuneEnd'); shownFortune = null; } return; }
  const key = `${f.userId}|${f.team}|${f.endsAt}`;
  if (key === shownFortune) return fortuneRoom(f);
  shownFortune = key;
  sfx('fortune');
  const m = $('fortune'), t = f.team ? tm(f.team) : null, topic = TOPIC[f.topic];
  const rest = (f.order ?? Object.keys(TOPIC)).filter(k => TOPIC[k] && !(f.focus && k === f.topic));
  m.innerHTML = `<div class="k">🎋 Quẻ may mắn hôm nay${topic ? ` · ${topic[1]}` : ''}</div>
    <div class="who">${t ? `<img src="${mascot(f.team, 'hype')}" alt="">` : '<span class="ro">✨</span>'}<span>${f.nickname ? `${esc(f.nickname)}${t ? ' · ' : ''}` : 'Quẻ chung cho cả phòng'}${t ? `<span class="tchip" style="--el:${t.color}"><img class="ti" src="/art/team-${f.team}.svg" alt=""> ${esc(t.label)}</span>` : ''}</span></div>
    <div class="shake">🎋</div>
    <div class="reveal">
      <div class="lvl">${esc(f.level)}</div>
      ${f.focus && topic ? `<div class="focus"><b>${topic[0]} ${topic[1]}</b><p>${esc(f[f.topic])}</p>${f.focus.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      <div class="lines">${rest.map(k => `<p>${TOPIC[k][0]} ${esc(f[k])}</p>`).join('')}</div>
      <div class="lucky"><span>Màu: ${esc(f.color)}</span><span>Số: ${f.number}</span>${f.hour ? `<span>Giờ vàng: ${esc(f.hour)}</span>` : ''}</div>
      ${f.userId ? '<div class="room"></div>' : ''}
      <div class="fine">${f.note ? `“${esc(f.note)}” · ` : ''}chỉ mang tính giải trí</div>
    </div>`;
  m.classList.remove('opened');
  go(modal('fortune', () => Boolean(S.hud?.fortune)));
  fortuneRoom(f);
  clearTimeout(fortuneOpen);
  fortuneOpen = setTimeout(() => {
    m.classList.add('opened');
    const [x, y] = f.team ? nodePos(f.team) : [CX, CY];
    burst(x, y, f.lucky ? [C.gold, '#fff', '#ff6b3d'] : [C.gold, C.paper, f.team ? color(f.team) : C.accent], f.lucky ? 90 : 40, f.lucky ? 11 : 7);
  }, 1200);
  speak(`${f.nickname ? f.nickname : 'Quẻ chung cho cả phòng'}, quẻ hôm nay: ${f.level}. ${f.topic ? f[f.topic] : f.love} ${f.luck}`);
}

function renderQuiz(q) {
  if (Date.now() < quizReveal || !q) return;
  const m = $('quiz');
  if (m.dataset.q !== q.q) {
    m.dataset.q = q.q;
    m.innerHTML = `<div class="k">✦ Câu đố vũ trụ ✦</div><h2>${esc(q.q)}</h2>
      <div class="opts">${q.options.map((o, i) => `<div class="opt"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></div>`).join('')}</div>
      <div class="qbar"><i></i></div><p class="hint">Comment <b style="color:var(--accent)">A, B hoặc C</b> — 3 người đúng đầu tiên thắng!</p><div class="win"></div>`;
    go(modal('quiz', () => Boolean(S.hud?.quiz) || Date.now() < quizReveal));
    sfx('quizStart');
  }
  const sec = Math.ceil(q.remainingMs / 1000);
  if (sec <= 3 && sec !== lastQuizTick) { lastQuizTick = sec; sfx('quizTick'); }
  m.querySelector('.qbar i').style.transform = `scaleX(${(q.remainingMs / (S.config.quizSeconds * 1000)).toFixed(3)})`;
  m.querySelector('.win').textContent = q.winners.length ? `✓ ${q.winners.map(w => w.nickname).join(', ')}` : q.tries ? `${q.tries} người đã trả lời…` : '';
}
function revealQuiz(e) {
  const m = $('quiz'), i = 'ABCD'.indexOf(e.answer);
  if (!m.dataset.q) return;
  m.querySelectorAll('.opt').forEach((el, k) => el.classList.add(k === i ? 'right' : 'wrong'));
  m.querySelector('.win').textContent = e.winners.length ? `🎉 ${e.winners.map(w => w.nickname).join(' · ')}` : `Đáp án ${e.answer}: ${e.answerText}`;
  quizReveal = Date.now() + 3000;
}

const voiceOn = params.get('voice') === '1' && 'speechSynthesis' in window;
function speak(text) {
  if (!voiceOn || speechSynthesis.pending) return; // never pile up a backlog of speech
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  u.voice = speechSynthesis.getVoices().find(v => v.lang?.startsWith('vi')) ?? null;
  speechSynthesis.speak(u);
}

// --- effects ---------------------------------------------------------------------------------------------
const teamOf = userId => S.stage.find(v => v.userId === userId)?.team;
const stars = e => Math.round(e.diamonds * (S.config.lightPerDiamond ?? 5));
const gain = (e, team) => (team ? `+${fmt(stars(e))} ánh sao cho ${esc(tm(team).label)}` : 'comment để vào phe nhận ánh sao');
let lastFlowNote = 0;
let lastLikeNote = 0;

// Sound for each effect (the same effects the director already rate-limits).
const sfx = createSfx(params.has('sfx') ? Number(params.get('sfx')) : 0.3);
const music = createMusic({ volume: params.has('music') ? Number(params.get('music')) : 0.22, onBlocked: () => { if (params.has('soundbtn')) $('sound').classList.add('on'); } }); // viewers cannot click the stream: the button is only for testing in a normal browser (?soundbtn=1)
addEventListener('pointerdown', () => music.resume(), { once: true }); // a normal browser tab still starts the music on the first click
$('sound').onclick = () => { music.resume(); sfx('welcome'); $('sound').classList.remove('on'); };
const SOUND = { 'gift-goal': 'meteor', wish: 'wish', lit: 'lit', 'wheel-complete': 'wheel', 'moon-full': 'moon', 'moon-end': 'moonEnd', 'lucky-start': 'lucky', 'lucky-end': 'luckyEnd', overtake: 'overtake', 'quiz-end': 'quiz', 'poll-start': 'pollStart', 'poll-end': 'poll', milestone: 'milestone', 'night-start': 'night', 'need-team': 'boop', flows: 'flow', 'title-up': 'title', streak: 'streak',
  'boss-hits': 'bossHit', 'boss-start': 'bossStart', 'boss-freeze': 'boop', 'boss-rescue': 'lit', 'boss-blocked': 'follow', 'boss-heal': 'luckyEnd', 'boss-defeated': 'wheel', 'boss-escaped': 'moonEnd',
  'chest-open': 'chestOpen', chapter: 'wheel', 'journey-done': 'moon', 'team-lead': 'overtake', 'tug-flip': 'overtake', vault: 'title', profile: 'title', mvp: 'title', power: 'meteor', 'fortune-luck': 'sparkle',
  'wish-bless': 'sparkle', 'wish-blessed': 'lit', 'welcome-done': 'lit', loots: 'sparkle', 'level-up': 'title', 'upgrade-need': 'boop',
  fans: 'milestone', 'fan-call': 'lucky', 'heat-up': 'overtake', demo: 'boop', 'switch-wait': 'boop', 'team-balance': 'boop', 'gift-ability': 'boon', 'my-quest-done': 'cleared',
  'star-born': 'starFly', showtime: 'milestone',
  'act-open': 'actOpen', 'head-start': 'headStart', 'head-end': 'actClose', 'act-close': 'actClose',
  'mystery-start': 'headStart', 'mystery-clue': 'boop', 'mystery-win': 'quiz', 'mystery-end': 'cleared', 'catch-star': 'starFly', catch: 'sparkle', 'catch-end': 'cleared',
  'roast-start': 'spin', 'quest-done': 'cleared', 'tug-start': 'headStart', 'tug-yank': 'runHit', 'tug-end': 'cleared', 'predict-open': 'pollStart', 'predict-end': 'poll',
  'pass-up': 'boon' };
const BIG = new Set(['meteor', 'wheel', 'moon', 'milestone', 'night', 'firework', 'hourStart', 'headStart', 'bossStart', 'fall', 'revive']); // the music ducks under these
const gold = C.gold;
function onFx(e) {
  let sound = e.type === 'gift' ? e.tier : SOUND[e.type], arg;
  if (e.type === 'joins') { sound = 'join'; arg = IDS.indexOf(e.people.at(-1).team); }
  else if (e.type === 'hearts') sound = 'heart';
  else if (e.type === 'bells') sound = e.people[0].kind === 'share' ? 'share' : 'follow';
  else if (e.type === 'milestone' && e.count === 1) sound = 'welcome';
  if (e.type === 'gift' && e.count >= 5) sfx('combo', e.count);
  const MINOR = { flows: 'flow', 'title-up': 'title', streak: 'streak', overtake: 'overtake', wish: 'wish', hearts: 'hearts' };
  if (MINOR[e.type] && !on(MINOR[e.type])) sound = null;
  if (e.type === 'milestone' && ![1, 100].includes(e.count) && (!on('milestone') || e.count < 100)) sound = null;
  if (sound) { sfx(sound, arg); if (BIG.has(sound)) music.duck(); }
  switch (e.type) {
    case 'greeting': releaseGreeting(e); break;
    case 'welcome-hi': greetStar(e); break;
    case 'welcome-done': greetStar(e, true); break;
    case 'joins': {
      const p = e.people.at(-1);
      // a switch is always shown (the viewer is waiting to see it worked); plain joins follow the panel's switch
      if (p.from) spotlight(`<div class="duo"><img src="${mascot(p.team, 'hype')}" alt="">${avatarHtml(p, 'av big')}</div><div class="cap">${esc(p.nickname)}</div><div class="sub">đổi phe ${teamChip(p.from)} → ${teamChip(p.team)} ✓</div>`, 2200, 'join');
      else if (on('join')) spotlight(`<div class="duo"><img src="${mascot(p.team, 'hype')}" alt="">${avatarHtml(p, 'av big')}</div><div class="cap">${esc(p.nickname)}</div><div class="sub">vào phe ${teamChip(p.team)} ✨${e.more ? ` · +${e.more} người` : ''}<br><small>nhầm? gõ “đổi” + tên màu</small></div>`, 1800, 'join');
      for (const q of e.people) { const [x, y] = nodePos(q.team); burst(x, y, [color(q.team), C.paper], 16, 5); }
      break;
    }
    case 'hearts': {
      for (const h of e.from) { const [x, y] = spotOf(h.userId, teamOf(h.userId)); hearts(x, y, 1 + (h.count / 15 | 0)); }
      if (on('hearts')) {
        const m = $('moon'), r = m.getBoundingClientRect(), st = stage.getBoundingClientRect(), k = st.width / 1080;
        m.classList.remove('beat'); void m.offsetWidth; m.classList.add('beat');
        hearts((r.left + r.width / 2 - st.left) / k, (r.top - st.top) / k + 20, 3);
      }
      break;
    }
    case 'likes': {
      if (!e.count || Date.now() - lastLikeNote < 5000) break;
      lastLikeNote = Date.now();
      card({ key: 'likes', icon: '❤️', title: 'Cả nhà đang thả tim!', sub: `+${fmt(e.count)} lượt thích`, color: C.accent, ms: 2400 });
      break;
    }
    case 'wish':
      releaseLantern(e);
      if (on('wish')) card({ key: 'wish', icon: '🏮', title: `<b>${esc(e.nickname)}</b> thả đèn ước`, sub: `${e.text ? `“${esc(e.text)}” · ` : ''}cả nhà gõ “chúc” để chúc phúc 🙏`, color: e.team ? color(e.team) : C.gold, ms: 4200 });
      speak(e.text ? `${e.nickname} ước: ${e.text}` : `${e.nickname} thả một điều ước bí mật`);
      break;
    case 'wish-bless': blessLantern(e); break;
    case 'wish-blessed': {
      blessLantern(e, true);
      meteorShower(10);
      celebrate({ key: 'wish', badge: e.gift ? '🏮 ĐÈN HÓA SAO VÀNG' : '🏮 ĐIỀU ƯỚC THÀNH SAO', extra: `<div class="wishstar">${avatarHtml(e, 'av big')}<b>${e.text ? `“${esc(e.text)}”` : 'điều ước bí mật ✨'}</b></div>`, title: esc(e.nickname), sub: `được ${e.count} lời chúc${e.blessers.length ? `: ${e.blessers.map(esc).join(', ')}` : ''} · +1 mảnh trăng 🌙`, color: '#FFE7A1', ms: 4400, compact: true });
      break;
    }
    // --- the bag: resources and levels ---
    case 'loots': {
      const l = e.loot[0], r = RES[l.res];
      if (!r) break;
      if (l.why === 'moon' && e.loot.length + e.more > 1) card({ key: 'loot', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `Cả sân nhận ${r.label}!`, sub: `${e.loot.length + e.more} người có mặt lúc trăng rằm · dùng để nâng cấp linh vật`, color: '#FFE7A1' });
      else card({ key: 'loot', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `<b>${esc(l.nickname)}</b> nhận ${l.n} ${r.label}`, sub: `${LOOT_WHY[l.why] ?? ''}${e.loot.length + e.more > 1 ? ` · +${e.loot.length + e.more - 1} người nữa` : ''} · gõ “kho” để xem`, color: r.color, ms: 2600 });
      break;
    }
    // --- hành trình đêm, đua phe, đảo chiều ---
    case 'chapter':
      meteorShower(e.next ? 10 : 30);
      celebrate({ key: 'chapter', badge: `${e.icon} CHẶNG ${e.no}/${e.of} HOÀN THÀNH`, icon: e.icon, title: esc(e.label), sub: `cả sân +${e.dust} điểm sáng (${e.people} người)${e.next ? ` · chặng tiếp: ${e.next.icon} ${esc(e.next.label)}: ${e.next.need} ${esc(e.next.goal)}` : ''}`, color: C.gold, ms: 4200, compact: true });
      break;
    case 'journey-done':
      celebrate({ key: 'chapter', badge: '👑 TRỌN HÀNH TRÌNH ĐÊM NAY', icon: '🌌', title: `Cả phòng đã đi hết ${S.cosmos?.journey?.of ?? 5} chặng!`, sub: `${e.people} người trên sân nhận 1 mảnh trăng 🌙 · cảm ơn cả nhà`, color: '#FFE7A1', ms: 5200, compact: true });
      break;
    case 'team-lead': {
      const [x, y] = nodePos(e.team);
      if (e.prev && e.prev !== e.team) comet(e.prev, e.team);
      burst(x, y, [color(e.team), C.gold, C.paper], 60, 9);
      card({ key: 'lead', icon: `<img class="ti" src="/art/team-${e.team}.svg" alt="">`, title: `Đảo chiều! Phe <b>${esc(tm(e.team).label)}</b> dẫn đầu`, sub: `vượt phe ${esc(tm(e.prev).label)}${e.gap ? ` ${fmt(e.gap)} ánh sao` : ''} · gỡ lại nào!`, color: color(e.team), ms: 3000 });
      break;
    }
    case 'tug-flip': {
      burst(CX, CY, [color(e.lead), C.gold, '#fff'], 70, 10);
      card({ key: 'flip', icon: '🪢', title: `Đảo chiều! <b>${esc(tm(e.lead).label)}</b> lật thế`, sub: `fan ${esc(tm(e.other).label)} ơi, kéo lại!`, color: color(e.lead), ms: 2400 });
      break;
    }
    case 'level-up': {
      const [x, y] = spotOf(e.userId, e.team);
      burst(x, y, [LEVEL_COLOR[e.level], C.gold, C.paper], 90, 12);
      celebrate({ key: 'level', badge: `⬆ LÊN CẤP ${e.level}`, extra: `<div class="duo">${`<img src="${mascot(e.team, 'win')}" alt="">`}${avatarHtml(e, 'av big')}</div>`, title: esc(e.nickname), sub: `linh vật ${esc(tm(e.team).label)} Lv${e.level} · +${Math.round((S.config.levelBonus ?? 0.06) * (e.level - 1) * 100)}% ánh sao cho mọi hành động`, color: LEVEL_COLOR[e.level], ms: 3800, compact: true });
      break;
    }
    case 'upgrade-need':
      spotlight(`<div class="duo"><img src="${mascot(e.team, 'panic')}" alt="">${avatarHtml(e, 'av big')}</div><div class="cap">${esc(e.nickname)} · Lv${e.level}</div><div class="sub">còn thiếu ${Object.entries(e.missing).map(([k, n]) => `${n} ${RES[k].label}`).join(', ')}</div>`, 2600, 'need');
      break;
    case 'vault': showKho(e); break;
    case 'profile': showProfile(e); break;
    case 'mvp':
      burst(...spotOf(e.userId, e.team), [FAN_GOLD, C.paper, e.team ? color(e.team) : C.gold], 40, 8);
      card({ key: 'mvp', icon: avatarHtml(e, 'av'), title: `<b>${esc(e.nickname)}</b> · MVP ${esc(e.label)}`, sub: `${esc(e.title)}${e.count > 1 ? ` · lần thứ ${e.count}` : ''}`, color: e.team ? color(e.team) : C.gold, ms: 3600, ttl: 14000 });
      break;
    case 'my-quest-done': {
      const rw = e.reward ?? {}, what = rw.kind === 'gem' && e.team ? RES[e.team].label : rw.kind === 'moon' ? RES.moon.label : RES.dust.label;
      burst(...spotOf(e.userId, e.team), [C.gold, C.paper], 24, 6);
      card({ key: 'myquest', icon: avatarHtml(e, 'av'), title: `<b>${esc(e.nickname)}</b> xong nhiệm vụ!`, sub: `${esc(e.label)} · +${rw.n ?? 1} ${esc(what)}`, color: e.team ? color(e.team) : C.gold, ms: 2800, ttl: 9000 });
      break;
    }
    case 'team-balance':
      card({ key: 'balance', icon: `<img class="ti" src="/art/team-${e.team}.svg" alt="">`, title: `<b>${esc(e.nickname)}</b>: phe ${esc(tm(e.wanted).label)} đã đủ đông`, sub: `mời bạn sang phe ${esc(tm(e.team).label)} cho cân sân nhé ✨`, color: color(e.team), ms: 3600, ttl: 9000 });
      if (e.team) { const [x, y] = nodePos(e.team); burst(x, y, [color(e.team), C.paper], 16, 5); }
      break;
    case 'gift-ability': abilityBanner(e); break;
    case 'power': power(e); break;
    case 'power-need': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">${POWER_NEED[e.why] ?? ''}</div>`, 2400, 'need'); break;
    case 'fortune-agree': {
      const ft = S.hud?.fortune?.team, [x, y] = ft ? nodePos(ft) : [CX, CY];
      burst(x, y, [C.gold, C.paper], 10, 4);
      break;
    }
    case 'fortune-luck':
      card({ key: 'luck', icon: '✨', title: `<b>${esc(e.nickname)}</b> xin vía ${esc(e.owner)}`, sub: `quẻ ${esc(e.level)} · cả hai nhận bụi sao`, color: C.gold, ms: 2200 });
      break;
    case 'gift': {
      const team = e.team ?? teamOf(e.userId), [x, y] = spotOf(e.userId, team), col = team ? color(team) : gold;
      const what = esc(e.giftName ?? 'quà'), who = esc(e.nickname), quiet = S.abilityUsers?.has(e.userId); // the ability banner is the one announcement
      // The gift is the headline, the sender is the credit line — a gift should never read as a quiet note.
      // Bigger gifts show the gift, the sender's face and the count over the whole wheel.
      const extra = `<div class="gimg">${giftPic(e)}</div>${e.count > 1 ? `<div class="x">x${e.count}</div>` : ''}<div class="giver">${e.avatar ? `<img src="${esc(e.avatar)}" alt="">` : ''}<span>${who}</span></div>`;
      if (e.tier === 'sparkle') {
        burst(x, y, [col, gold, C.paper], 30, 7);
        if (!quiet) giftCard(e, team);
      } else if (e.tier === 'firework') {
        for (let i = 0; i < 4; i++) setTimeout(() => burst(rnd(180, 900), rnd(440, 1000), [col, gold, C.paper, C.accent], 80, 12), i * 260);
        dancing.set(e.userId, Date.now() + 4000);
        if (!quiet) celebrate({ key: 'firework', badge: '🎁 QUÀ TẶNG', extra, title: what, sub: gain(e, team), color: col, ms: 3600, compact: true });
      } else {
        meteorShower();
        dancing.set(e.userId, Date.now() + 5000);
        if (!quiet) celebrate({ key: 'meteor', badge: '☄ MƯA SAO BĂNG', extra, title: what, sub: gain(e, team), color: col, ms: 4200 });
        speak(`Cảm ơn ${e.nickname} đã gọi mưa sao băng`);
      }
      break;
    }
    case 'flows':
      for (const f of e.flows.slice(0, 4)) comet(f.from, f.to);
      if (on('flow') && Date.now() - lastFlowNote > 7000) { lastFlowNote = Date.now(); const f = e.flows[0]; spotlight(`<div class="cap">${teamChip(f.from)} → ${teamChip(f.to)}</div><div class="sub">${esc(tm(f.from).label)} đã sáng, ánh sao dư chảy sang ${esc(tm(f.to).label)} 💫</div>`, 2200, 'flow'); }
      break;
    case 'lit': {
      const [x, y] = nodePos(e.team);
      burst(x, y, [color(e.team), gold, C.paper], 90, 12);
      card({ key: `lit-${e.team}`, icon: `<img class="ti" src="/art/team-${e.team}.svg" alt="">`, title: `Phe <b>${esc(tm(e.team).label)}</b> đã sáng!`, sub: e.by !== e.team ? `nhờ ánh sao từ phe ${esc(tm(e.by).label)} 💫` : 'rực rỡ nhờ chính các bạn', color: color(e.team), ms: 3000 });
      break;
    }
    case 'wheel-complete': {
      const podium = (e.podium ?? []).slice(0, 3).filter(r => r?.id && TEAM[r.id]);
      const [w, ...others] = podium;
      celebrate({ key: 'wheel', badge: `VÒNG ${e.no}`, mascotSign: e.winner ?? w?.id ?? 'red', glyphs: IDS.map(id => tm(id).glyph).join(' '), title: 'VÒNG SÁNG ĐÃ TRỌN!', sub: `${w ? `👑 phe ${esc(tm(w.id).label)} rực rỡ nhất` : 'cả bốn phe cùng sáng'}${others.map((r, i) => ` · ${i + 2}. ${esc(tm(r.id).label)}`).join('')}${e.crowned ? ` · ${e.crowned} fan nhận huy hiệu` : ''}`, ms: 5200 });
      meteorShower(30);
      for (let i = 0; i < 8; i++) setTimeout(() => burst(rnd(150, 930), rnd(400, 1000), [gold, C.paper, C.accent, C.teal], 90, 13), i * 280);
      speak('Vòng sáng đã trọn, cảm ơn cả nhà');
      break;
    }
    case 'title-up': if (on('title')) card({ key: 'title', icon: '🌟', title: `<b>${esc(e.nickname)}</b> lên hạng!`, sub: `danh hiệu mới: ${esc(e.title)}`, color: color(e.team) }); break;
    case 'bells': {
      burst(CX, CY, [gold, C.paper], 30, 7);
      const share = e.people[0].kind === 'share';
      card({ key: 'bell', icon: share ? ICON.share : ICON.follow, title: `<b>${esc(e.people[0].nickname)}</b> ${share ? 'chia sẻ' : 'theo dõi'}!`, sub: `${e.more ? `+${e.more} người nữa · ` : ''}cảm ơn bạn · +${share ? S.config.shareLight : S.config.followLight} ánh sao`, color: C.accent });
      break;
    }
    case 'gift-goal':
      meteorShower(36);
      for (let i = 0; i < 6; i++) setTimeout(() => burst(rnd(150, 930), rnd(420, 1100), [gold, C.paper, C.accent, C.teal], 90, 13), i * 240);
      celebrate({ key: 'giftgoal', badge: '🎁 QUÀ CHUNG ĐẦY!', icon: '☄️', title: 'Mưa sao băng cho cả phòng!', sub: `${esc(e.nickname)} góp món quà cuối · mục tiêu ${fmt(e.goal)} xu${e.no > 0 ? ` · mốc tiếp theo cao hơn` : ''}`, color: gold, ms: 4600 });
      speak('Cả phòng đã gom đủ quà, mưa sao băng nào');
      break;
    case 'moon-full':
      celebrate({ key: 'moon', badge: 'TRĂNG RẰM', icon: '🌕', title: `Ánh sao x${e.multiplier} trong ${e.seconds} giây!`, sub: 'cả vòng cùng quẩy 🎶', color: '#FFE7A1', ms: 3400, compact: true });
      meteorShower(14);
      speak('Trăng rằm rồi, cả nhà cùng quẩy');
      break;
    case 'need-team':
      spotlight(`<div class="duo"><img src="${mascot('red', 'idle')}" alt="">${avatarHtml(e, 'av big')}</div><div class="cap">${esc(e.nickname)}</div><div class="sub">vào phe trước đã: gõ 1–4 hoặc tên màu, rồi ${NEED_FOR[e.for] ?? 'gõ lại lệnh'} nhé!</div>`, 2400, 'need');
      break;
    case 'switch-wait': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">${e.frozen ? `phe ${esc(tm(e.team).label)} đang bị đóng băng — phá băng xong mới đổi phe được` : `vừa đổi phe rồi — ${e.seconds} giây nữa mới đổi sang ${esc(tm(e.to).label)} được nhé`}</div>`, 2200, 'need'); break;
    case 'fan-call-wait': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">đang có sao may mắn — ${e.seconds} giây nữa gõ lại “gọi sao” nhé ♥</div>`, 2200, 'need'); break;
    // --- fan club ---
    case 'fans': {
      const f = e.fans[0];
      burst(CX, 420, [FAN_GOLD, '#c43c6a', C.paper], 60, 10);
      celebrate({ key: 'fan', badge: f.level ? `♥ FANCLUB${f.club ? ` ${esc(f.club.toUpperCase())}` : ''} · LV ${f.level}` : '★ NGƯỜI ĐĂNG KÝ', extra: `<div class="duo">${f.team ? `<img src="${mascot(f.team, 'hype')}" alt="">` : ''}${avatarHtml(f, 'av big fanring')}</div>`, title: `${esc(f.nickname)} đã đến!`, sub: `${e.fans.length + e.more > 1 ? `cùng ${e.fans.length + e.more - 1} thành viên nữa · ` : ''}thành viên được +ánh sao và “gọi sao” 1 lần mỗi đêm`, color: FAN_GOLD, ms: 3400, compact: true });
      break;
    }
    case 'fan-call': {
      const [x, y] = nodePos(e.team);
      beam(e.team, FAN_GOLD);
      burst(x, y, [FAN_GOLD, C.paper], 80, 11);
      card({ key: 'fan-call', icon: avatarHtml(e, 'av'), title: `<b>${esc(e.nickname)}</b> gọi sao may mắn!`, sub: `đặc quyền fanclub · ${esc(tm(e.team).label)} được ánh sao x2`, color: FAN_GOLD, ms: 3200 });
      break;
    }
    case 'fan-only': spotlight(`<div class="cap">“gọi sao”</div><div class="sub">là đặc quyền của thành viên fanclub · tham gia fanclub của kênh để dùng nhé ♥</div>`, 2400, 'need'); break;
    // --- Nhiệt phòng ---
    case 'heat-up': {
      const h = HEAT[e.level];
      for (let i = 0; i < e.level + 1; i++) setTimeout(() => burst(rnd(150, 930), rnd(500, 1200), ['#ff8a3d', '#ffd45e', C.paper], 70, 12), i * 220);
      card({ key: 'heat', icon: '🔥', title: `Phòng ${h.name.toLowerCase()}!`, sub: `mọi ánh sao x${e.multiplier} · giữ nhịp chat · tim nhé`, color: h.color, ms: 3000, kind: 'heat' });
      break;
    }
    // --- the house mascots show how to play (clearly mascots, never posing as viewers) ---
    case 'demo': demo(e); break;
    case 'overtake': {
      const [x, y] = nodePos(e.team);
      burst(x, y, [color(e.team), gold], 30, 7);
      if (on('overtake')) card({ key: 'overtake', icon: '🚀', title: `<b>${esc(tm(e.team).label)}</b> vượt lên hạng 1!`, sub: `vượt phe ${esc(tm(e.from).label)}`, color: color(e.team) });
      break;
    }
    case 'lucky-start': {
      const [x, y] = nodePos(e.team);
      burst(x, y, [gold, C.paper], 40, 8);
      celebrate({ key: 'lucky', badge: 'SAO MAY MẮN', icon: '⭐', title: `${esc(tm(e.team).label)} · ánh sao x${e.multiplier}`, sub: `trong ${e.seconds} giây — comment ngay!`, color: gold, ms: 3000, compact: true });
      speak(`Sao may mắn: ${tm(e.team).label}`);
      break;
    }
    case 'streak': if (on('streak')) card({ key: 'streak', icon: '🔥', title: `<b>${esc(e.nickname)}</b> trở lại!`, sub: `chuỗi ${e.streak} đêm · +${e.amount} ánh sao`, color: color(e.team) }); break;
    case 'quiz-end': revealQuiz(e); break;
    case 'poll-end': revealPoll(e); break;
    case 'milestone':
      if (e.count !== 1 && (e.count < 100 || !on('milestone'))) break; // 10, 25, 50 visitors are not worth stopping the show for
      burst(CX, CY, [gold, C.paper, C.accent, C.teal], 80, 11);
      celebrate(e.count === 1
        ? { key: 'milestone', badge: 'NGƯỜI ĐẦU TIÊN', icon: '🌟', title: esc(e.nickname), sub: 'là người đầu tiên của đêm nay — chào mừng!', compact: true }
        : { key: 'milestone', badge: 'MỐC NGƯỜI XEM', icon: '🎉', title: `Người thứ ${fmt(e.count)}!`, sub: 'ghé thăm đêm hội — cảm ơn cả nhà', compact: true });
      break;
    case 'night-start': celebrate({ key: 'night', badge: 'ĐÊM HỘI', icon: '✦', title: `Đêm hội thứ ${e.no} bắt đầu`, sub: 'chào mừng cả nhà trở lại', ms: 3000, compact: true }); break;
    // --- Sao Chổi Đen ---
    case 'boss-start':
      quake();
      celebrate({ key: 'boss', badge: '☄ BOSS XUẤT HIỆN', extra: '<img class="bossimg" src="/art/boss.svg" alt="">', title: 'SAO CHỔI ĐEN!', sub: `${fmt(e.hp)} máu · ${e.seconds} giây · mỗi phe một vai: ${TEAMS.map(t => `${t.label} ${roleText(t.id).toLowerCase()}`).join(' · ')}`, color: '#E97A66', ms: 4600 });
      speak('Sao chổi đen xuất hiện! Cả nhà cùng đánh');
      break;
    case 'boss-hits':
      for (const [team, dmg] of Object.entries(e.byTeam).slice(0, 6)) shoot(team, dmg, e.hits.some(h => h.team === team && h.crit), e.hits.some(h => h.team === team && h.ultimate));
      break;
    case 'boss-freeze': {
      const [x, y] = nodePos(e.team);
      beam(e.team, '#9fd3ff');
      quake();
      burst(x, y, ['#9fd3ff', '#ffffff'], 50, 8);
      card({ key: 'boss-freeze', icon: '❄️', title: `Phe <b>${esc(tm(e.team).label)}</b> bị đóng băng!`, sub: `cả phe ${esc(tm(e.team).label)} comment ngay để phá băng (cần ${e.need}) · ${e.seconds}s`, color: '#9fd3ff', ms: 3400 });
      break;
    }
    case 'boss-rescue': {
      const [x, y] = nodePos(e.team);
      burst(x, y, [color(e.team), C.gold, C.paper], e.gift ? 90 : 60, 10);
      card({ key: 'boss-freeze', icon: '🔥', title: `<b>${esc(e.nickname)}</b> phá băng!`, sub: `phe ${esc(tm(e.team).label)} chiến đấu tiếp`, color: color(e.team) });
      break;
    }
    case 'boss-blocked': beam(e.team, '#F2C45C', true); card({ key: 'boss-freeze', icon: '🛡️', title: 'Khiên chặn đòn!', sub: `Sao Chổi nhắm vào phe ${esc(tm(e.team).label)} nhưng hụt`, color: '#F2C45C' }); break;
    case 'boss-heal': card({ key: 'boss-freeze', icon: '💜', title: 'Sao Chổi hồi máu…', sub: `+${fmt(e.heal)} vì phe ${esc(tm(e.team).label)} chưa phá được băng`, color: '#B48CF2' }); break;
    case 'boss-defeated': {
      meteorShower(30);
      for (let i = 0; i < 8; i++) setTimeout(() => burst(rnd(150, 930), rnd(400, 1100), [gold, C.paper, C.accent, C.teal], 90, 13), i * 260);
      const mvps = TEAMS.filter(t => e.mvps?.[t.id]).map(t => `${t.label}: ${esc(e.mvps[t.id].nickname)}`).join(' · ');
      const fin = e.finisher, how = fin?.ability === 'ultimate' ? ' bằng Đòn tuyệt kỹ' : fin?.ability === 'thaw' ? ' sau khi phá băng' : '';
      celebrate({ key: 'boss', badge: '🏆 HẠ SAO CHỔI ĐEN', mascotSign: e.mvp?.team ?? 'red', title: e.mvp ? `MVP: ${esc(e.mvp.nickname)}` : 'Cả phòng chiến thắng!', sub: `${e.fighters} người góp sức trong ${e.seconds}s${mvps ? ` · MVP từng phe — ${mvps}` : ''} · ai cũng được +${e.reward} ánh sao${fin ? `<br>cú kết liễu: ${esc(fin.nickname)}${how}` : ''}`, ms: 5600 });
      speak(e.mvp ? `Hạ sao chổi đen! MVP là ${e.mvp.nickname}` : 'Hạ sao chổi đen!');
      break;
    }
    case 'boss-escaped': celebrate({ key: 'boss', badge: 'SAO CHỔI TRỐN THOÁT', icon: '💨', title: 'Nó sẽ quay lại…', sub: `còn ${Math.round(e.hpShare * 100)}% máu — lần sau cả nhà gọi thêm đồng đội nhé`, color: '#B48CF2', ms: 3400, compact: true }); break;
    // --- the star chest ---
    case 'chest-open':
      celebrate({ key: 'chest', badge: e.gold ? '🏆 RƯƠNG VÀNG' : '🎁 RƯƠNG SAO', extra: '<img class="chestimg big" src="/art/chest-open.svg" alt="">', title: e.gold ? 'Rương vàng đã mở!' : 'Rương sao đã mở!', sub: e.gold ? `gõ “nhận” trong ${e.seconds} giây — phần lớn hơn cho mọi người: điểm sáng và ngọc màu phe` : `gõ “nhận” trong ${e.seconds} giây — mỗi người một phần điểm sáng`, color: e.gold ? '#FFD45E' : gold, ms: 3000, compact: true });
      break;
    // --- the named stars and the big moment every ~75 s ---
    case 'star-born': {
      fly(e.userId, spotOf(e.userId, e.team), starPoint(e), color(e.team), e.nickname, 0.6);
      card({ key: 'star', icon: '⭐', title: `<b>${esc(e.nickname)}</b> có ngôi sao riêng!`, sub: 'sao mang tên bạn ở bầu trời cộng đồng phía dưới · quay lại là sao sáng lên ✨', color: color(e.team), ms: 3200 });
      break;
    }
    case 'showtime':
      if (e.kind === 'starcall') {
        // no celebration here: the named stars themselves fly across the wheel, and a card would only hide them
        e.people.forEach((p, i) => fly(p.userId, [rnd(140, 940), WHEEL_T + 40], starPoint(p), color(p.team), p.nickname, i * 0.3));
        meteorShower(8);
        card({ key: 'show', icon: '🌟', title: `Điểm danh sao · <b>${e.people.length}</b> ngôi sao đang sáng`, sub: `${e.people.slice(0, 5).map(p => esc(p.nickname)).join(' · ')}${e.people.length > 5 ? ` · +${e.people.length - 5}` : ''} · vào phòng là có sao, có phe ngay`, color: gold, ms: 4800 });
      } else {
        meteorShower(30);
        celebrate({ key: 'show', badge: '☄ MƯA SAO BĂNG', icon: '🌠', title: 'Mưa sao định kỳ!', sub: 'cả nhà cùng ngắm và thả tim nhé ✨', color: gold, ms: 3800, compact: true });
      }
      break;
    // --- Màn: the 5-minute acts and their headliners ---
    case 'act-open':
      card({ key: 'act', icon: `<span class="gf">${e.glyph}</span>`, title: `Màn ${esc(e.label)}`, sub: `★ ${esc(e.headLabel)} sau ${mmss(e.headInMs)}`, color: e.color, ms: 4200 });
      break;
    case 'head-start':
      if (['elite', 'tug', 'roast', 'guessobject', 'starcatch'].includes(e.id)) break; // these announce themselves
      celebrate({ key: 'head', badge: '★ SỰ KIỆN CHÍNH', icon: HEAD_ICON[e.id] ?? '★', title: esc(e.label), sub: HEAD_HOW[e.id] ?? '', color: S.cosmos?.act?.color ?? gold, ms: 4200, compact: true });
      break;
    case 'head-end':
      if (e.id === 'final' && e.winner) {
        const [x, y] = nodePos(e.winner);
        burst(x, y, [gold, C.paper, color(e.winner)], 90, 12);
        const rest = (e.podium ?? []).slice(1, 3).filter(r => TEAM[r.id]).map((r, i) => ` · ${i + 2}. ${esc(tm(r.id).label)}`).join('');
        celebrate({ key: 'head', badge: '👑 CHUNG KẾT ĐUA PHE', mascotSign: e.winner, title: `Phe ${esc(tm(e.winner).label)} đội vương miện!`, sub: `góp nhiều ánh sao nhất trong chung kết${rest}${e.fans ? ` · ${e.fans} fan có mặt nhận huy hiệu 👑` : ''}`, color: color(e.winner), ms: 4800 });
      } else if (e.id === 'quizchain' && e.best) card({ key: 'head', icon: '🧠', title: `<b>${esc(e.best.nickname)}</b> đúng ${e.best.streak} câu liền!`, sub: 'vua đố nhanh của màn · +2 ngọc', color: '#B48CF2', ms: 3600 });
      break;
    case 'act-close': {
      if (!e.top.length) break;
      const m = e.top[0];
      celebrate({ key: 'act', badge: '🎬 KẾT MÀN', extra: `<div class="duo">${m.team ? `<img src="${mascot(m.team, 'win')}" alt="">` : ''}${avatarHtml(m, 'av big')}</div>`, title: `MVP: ${esc(m.nickname)}`, sub: `+${fmt(m.light)} ánh sao trong màn${e.top[1] ? ` · 2. ${esc(e.top[1].nickname)}` : ''}${e.top[2] ? ` · 3. ${esc(e.top[2].nickname)}` : ''}<br>tiếp theo: ${e.next.glyph} Màn ${esc(e.next.label)} · ${esc(e.next.head)}`, color: S.cosmos?.act?.color ?? gold, ms: 4600, compact: true });
      break;
    }
    // --- kéo co, dự đoán, sổ mùa ---
    case 'tug-start':
      celebrate({ key: 'tug', badge: '🪢 KÉO CO 2 PHE', icon: '🪢', title: `${esc(tm(e.a).label)} ⟷ ${esc(tm(e.b).label)}`, sub: `hai phe comment · thả tim để kéo · ai cũng đoán được: gõ “đoán A” / “đoán B”`, color: color(e.a), ms: 3600, compact: true });
      break;
    case 'tug-yank': {
      quake();
      const [x, y] = spotOf(e.userId, e.team);
      burst(x, y, [color(e.team), C.gold, C.paper], 60, 11);
      floats.push({ x: CX, y: CY + 150 * Z, t: 0, text: `${e.nickname} giật mạnh!`, col: C.gold });
      break;
    }
    case 'tug-end': {
      if (!e.winner) { card({ key: 'tug', icon: '🪢', title: 'Kéo co hoà!', sub: 'hai phe ngang sức ngang tài', color: C.teal }); break; }
      burst(CX, CY, [color(e.winner), C.gold, C.paper], 90, 12);
      const mv = e.winner === e.a ? e.mvpA : e.mvpB;
      celebrate({ key: 'tug', badge: e.early ? '🪢 KÉO SẬP DÂY!' : '🪢 THẮNG KÉO CO', mascotSign: e.winner, mood: 'win', title: `Phe ${esc(tm(e.winner).label)} thắng!`, sub: `${e.pullers} người cùng kéo${mv ? ` · lực sĩ: ${esc(mv.nickname)}` : ''} · +${S.config.tugWinLight ?? 20} ánh sao cho phe thắng`, color: color(e.winner), ms: 4200, compact: true });
      break;
    }
    case 'predict-open': card({ key: 'predict', icon: '🔮', title: esc(e.q), sub: `gõ “đoán A” (${esc(e.options[0])}) hoặc “đoán B” (${esc(e.options[1])}) · ${e.seconds}s · đoán đúng được điểm sáng`, color: '#B48CF2', ms: 4200 }); break;
    case 'predict-end':
      if (e.winner === null) break;
      card({ key: 'predict', icon: '🔮', title: `Đáp án: <b>${esc(e.answer)}</b>`, sub: `${e.right}/${e.guesses} người đoán trúng${e.top[0] ? ` · ${esc(e.top[0][0])} +${e.top[0][1]} điểm sáng` : ''}`, color: '#B48CF2', ms: 3600 });
      break;
    case 'pass-up':
      if (e.frame) celebrate({ key: 'pass', badge: `📒 SỔ MÙA CẤP ${e.level}`, extra: `<div class="duo">${avatarHtml(e, `av big frame-${e.frame}`)}</div>`, title: esc(e.nickname), sub: `nhận ${esc(e.reward)}`, color: FRAME_COLOR[e.frame], ms: 3600, compact: true });
      else if (on('title')) card({ key: 'pass', icon: '📒', title: `<b>${esc(e.nickname)}</b> lên Sổ mùa cấp ${e.level}`, sub: `nhận ${esc(e.reward)}`, color: e.team ? color(e.team) : C.gold, ms: 2400 });
      break;

    // --- vòng quay may mắn: the wheel itself lives in the arena (renderRoast); the result is a celebration ---
    case 'roast-start': {
      if (e.again) quake();
      const [x, y] = e.team ? nodePos(e.team) : [CX, CY];
      burst(x, y, ['#ff7a45', C.gold, C.paper], 24, 7);
      break;
    }
    case 'roast-end': {
      const s = tm(e.team), [x, y] = nodePos(e.team);
      const who = `${esc(e.nickname)} · phe ${esc(s.label)}`;
      if (e.cleared) {
        sfx('cleared'); burst(x, y, [color(e.team), C.gold, C.paper], 80, 11);
        celebrate({ key: 'roast', badge: '✅ MINH OAN THÀNH CÔNG', mascotSign: e.team, mood: 'win', title: `${esc(e.nickname)} trong sạch!`, sub: `${e.names.filter(Boolean).map(esc).join(', ')}${e.protests > e.names.length ? ` +${e.protests - e.names.length}` : ''} đã minh oan · +${S.config.roastClearLight ?? 15} ánh sao mỗi người<br>${who}`, color: color(e.team), ms: 3800, compact: true });
      } else {
        sfx('laugh');
        celebrate({ key: 'roast', badge: '😂 ĐÚNG LÀ VẬY!', mascotSign: e.team, mood: 'panic', title: `“${esc(e.line ?? '')}”`, sub: `${who}<br>${e.agree ? `${e.agree} người gõ “chuẩn” · ` : ''}${e.consoled ? `an ủi: phe ${esc(s.label)} được sao may mắn x2 ✨` : 'lần sau nhớ gõ “oan” nhé'}`, color: color(e.team), ms: 3800, compact: true });
      }
      break;
    }
    case 'quest-done':
      meteorShower(24);
      for (let i = 0; i < 5; i++) setTimeout(() => burst(rnd(150, 930), rnd(WHEEL_T + 60, LAYOUT.wheelB - 60), [e.color, C.gold, C.paper], 80, 12), i * 240);
      celebrate({ key: 'quest', badge: `${e.glyph} NHIỆM VỤ GIỜ HOÀN THÀNH`, icon: '🏆', title: `Đủ ${fmt(e.goal)} ${esc(e.unit)}!`, sub: `${esc(e.reward)} · ${e.people} người có mặt`, color: e.color, ms: 4600 });
      speak('Nhiệm vụ giờ hoàn thành');
      break;
    // --- the two short games ---
    case 'mystery-start':
      celebrate({ key: 'mystery', badge: '🕵️ ĐOÁN VẬT', icon: '❓', title: 'Đoán xem là vật gì?', sub: `gợi ý 1: ${esc(e.clue)} · gõ đáp án bạn đoán · 3 người đúng đầu tiên nhận ngọc`, color: '#B48CF2', ms: 3400, compact: true });
      break;
    case 'mystery-clue': burst(CX, CY - 80 * Z, ['#B48CF2', C.gold], 20, 6); break;
    case 'mystery-win': {
      const [x, y] = spotOf(e.userId, e.team);
      burst(x, y, [C.gold, '#B48CF2', '#fff'], e.rank === 1 ? 70 : 30, 9);
      card({ key: 'mystery', icon: ['🥇', '🥈', '🥉'][e.rank - 1] ?? '⭐', title: `<b>${esc(e.nickname)}</b> đoán trúng!`, sub: `ngay ở gợi ý ${e.clue}${e.rank === 1 ? ' · +2 ngọc' : ' · +1 ngọc'}`, color: '#B48CF2', ms: 2400 });
      break;
    }
    case 'mystery-end': {
      burst(CX, CY, ['#B48CF2', C.gold, '#fff'], 80, 10);
      const ans = String(e.answer ?? '');
      celebrate({ key: 'mystery', badge: '🕵️ ĐÁP ÁN', icon: '💡', title: esc(ans.charAt(0).toUpperCase() + ans.slice(1)), sub: e.winners.length ? `đoán trúng: ${e.winners.map(w => esc(w.nickname)).join(', ')}` : 'chưa ai đoán ra — lần sau nhé!', color: '#B48CF2', ms: 3600, compact: true });
      break;
    }
    case 'catch': {
      const [x, y] = spotOf(e.userId, e.team);
      burst(x, y, [C.gold, '#fff'], 24, 6);
      floats.push({ x, y: y - 30, t: 0, text: `${e.nickname} hứng “${e.word}” ${['🥇', '🥈', '🥉'][e.rank - 1] ?? '⭐'}`, col: C.gold });
      break;
    }
    case 'catch-end':
      celebrate({ key: 'starcatch', badge: '🌠 HỨNG SAO BĂNG', icon: '🏆', title: e.top[0] ? esc(e.top[0].nickname) : 'Hết mưa sao', sub: e.top.length ? e.top.map(x => `${esc(x.nickname)} ${x.catches} sao`).join(' · ') + ' · hạng nhất +1 ngọc' : 'chưa ai hứng được — lần sau nhanh tay nhé!', color: C.gold, ms: 3600, compact: true });
      break;
  }
}

let offlineTimer = null;
subscribe({
  meta: m => {
    const first = !S.teams.length, list = m.teams?.length ? m.teams : TEAMS;
    for (const t of list) TEAM[t.id] = { ...TEAM[t.id], ...t };
    Object.assign(S, { teams: list, config: m.config ?? {}, roles: m.roles ?? {} });
    if (m.music) music.setLists(m.music);
    if (first) build();
  },
  cmd: c => { if (c.type === 'music-skip') music.skip(); else if (c.type === 'music-mute') music.toggleMute(); },
  frame: f => {
    if (!S.teams.length) return;
    const p = f.parts ?? {};
    if (p.sky) { S.sky = p.sky; safe('sky', () => renderSky(p.sky)); }
    if (p.stage) { S.stage = p.stage; hereIds = new Set(p.stage.map(v => v.userId)); safe('stage', () => renderStage(p.stage)); if (arenaMode === 'boss' && S.cosmos) safe('arena', () => renderArena(S.cosmos)); }
    if (p.stars) S.stars = p.stars;
    if (p.thanks) S.thanks = p.thanks;
    if (p.race) { S.race = p.race; safe('race', () => renderRace(p.race)); }
    if (p.hud) { S.hud = p.hud; safe('hud', () => renderHud(p.hud)); }
    if (p.cosmos) safe('cosmos', () => renderCosmos(p.cosmos));
    const fxs = f.fx ?? [];
    S.abilityUsers = new Set(fxs.filter(e => e?.type === 'gift-ability').map(e => e.userId)); // their gift cards stay quiet: the banner announces them
    for (const e of fxs) safe(`fx ${e?.type}`, () => onFx(e));
  },
}, ok => {
  clearTimeout(offlineTimer);
  if (ok) $('conn').classList.remove('on');
  else offlineTimer = setTimeout(() => $('conn').classList.add('on'), 4000);
});
