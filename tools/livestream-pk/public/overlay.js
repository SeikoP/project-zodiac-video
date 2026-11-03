// Overlay for Đêm Hội Hoàng Đạo. Built to stay smooth in busy rooms:
//  • the server sends one small "frame" every 250ms (changed parts + a capped list of effects);
//  • DOM is touched only when a part changes, and only the bits that changed;
//  • everything that moves every frame (orbiting viewers, comets, particles, boss beams) is drawn
//    on one canvas from pre-rendered sprites, capped at ?fps= (default 30).
import { ELEMENT, mascot, fmt, esc, clock, subscribe } from '/shared.js';
import { SIGN_DATA, factCards } from '/signs.js';

import { ICON } from '/icons.js';
import { createSfx } from '/sfx.js';
import { createMusic } from '/music.js';
import { createLane } from '/lane.js';
import { EDITION, CARD_TOTAL } from '/cards.js';

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
const S = { signs: [], config: {}, hud: null, sky: null, stage: [], thanks: [], race: null, lucky: null, lobby: { total: 0, people: [], latest: null }, cosmos: null, planets: [], roles: {}, stars: [] };
const SIGN = {};
const color = id => ELEMENT[SIGN[id]?.element ?? 'air'].color;
const rnd = (a, b) => a + Math.random() * (b - a);

// --- wheel geometry ------------------------------------------------------------------
// Layout: one merged top card (title, moon, goal, top-3 ranking), then the wheel as a dial scaled (Z) to fit
// above the chat line, then the community sky. The wheel is built in its own 1016x1050 units (radii R, BAND…)
// and placed on the stage at WHEEL_L/WHEEL_T; at() and nodePos() return stage coordinates for the canvas.
// Planet markers sit at their true longitude; viewers' mascots stand just outside the dial.
const LAYOUT = phone ? { top: 345, wheelT: 662, wheelB: 1672, zone: 1700 } : { top: 20, wheelT: 330, wheelB: 1192, zone: 1210 };
const LOCAL_W = 1016, LOCAL_H = 1050, Z = Math.min(1, (LAYOUT.wheelB - LAYOUT.wheelT) / LOCAL_H);
const WHEEL_W = LOCAL_W * Z, WHEEL_H = LOCAL_H * Z, WHEEL_L = (1080 - WHEEL_W) / 2, WHEEL_T = LAYOUT.wheelT;
const CX = WHEEL_L + WHEEL_W / 2, CY = WHEEL_T + WHEEL_H / 2, R = 330, BAND = R + 70, PLANET_R = BAND + 44, STAND = R + 114;
for (const [k, v] of Object.entries({ top: LAYOUT.top, 'wheel-t': WHEEL_T, 'wheel-b': LAYOUT.wheelB, 'wheel-l': WHEEL_L, zone: LAYOUT.zone, cy: CY })) stage.style.setProperty(`--${k}`, `${v}px`);
stage.style.setProperty('--z', Z);
const on = key => S.config?.show?.[key] !== false;
const IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const angleOf = id => (-90 + IDS.indexOf(id) * 30) * Math.PI / 180;
const at = (r, a) => [CX + Z * r * Math.cos(a), CY + Z * r * Math.sin(a)]; // r in wheel units → stage point
const local = ([x, y]) => [(x - WHEEL_L) / Z, (y - WHEEL_T) / Z]; // stage point → wheel units (inside #wheel)
const nodePos = id => at(R, angleOf(id));

// --- one-time builds -------------------------------------------------------------------
const nodes = {};
function build() {
  const ring = $('ring');
  const lx = LOCAL_W / 2, ly = LOCAL_H / 2;
  ring.setAttribute('viewBox', `0 0 ${LOCAL_W} ${LOCAL_H}`);
  ring.innerHTML = `<circle cx="${lx}" cy="${ly}" r="${BAND}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="14"/>
    <circle id="missionProgress" cx="${lx}" cy="${ly}" r="${BAND}" fill="none" stroke="#F2C45C" stroke-width="14" stroke-linecap="round" pathLength="1" stroke-dasharray="0 1" transform="rotate(-90 ${lx} ${ly})"/>
    <circle cx="${lx}" cy="${ly}" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" stroke-dasharray="3 9"/><g id="planets"></g>`;
  for (const s of S.signs) {
    SIGN[s.id] = s;
    const [x, y] = local(nodePos(s.id)), el = document.createElement('div');
    el.className = 'node';
    el.style.cssText = `left:${x}px;top:${y}px;--el:${ELEMENT[s.element].color};--fill:0%`;
    el.innerHTML = `<span class="fill-clip" aria-hidden="true"><span></span></span><span class="g gf">${s.glyph}︎</span><span class="nm">${esc(s.label)}</span><span class="n">${IDS.indexOf(s.id) + 1}</span><span class="more"></span>`;
    $('wheel').append(el);
    nodes[s.id] = { el, more: el.querySelector('.more'), lit: false };
  }
  buildRace();
  drawBackground();
  loadSprites();
}

// Race chips are created once and only re-ordered / re-sized afterwards.
const chips = {};
function buildRace() {
  for (const id of IDS) {
    const el = document.createElement('div');
    el.className = 'rc';
    el.style.setProperty('--el', color(id));
    el.innerHTML = `<i></i><span class="rk"></span><span class="gf">${SIGN[id].glyph}\uFE0E</span><span class="nm">${esc(SIGN[id].label)}</span><span class="v">0</span>`;
    $('race').append(el);
    chips[id] = { el, rk: el.querySelector('.rk'), nm: el.querySelector('.nm'), v: el.querySelector('.v'), crowns: -1 };
  }
}
// "Cách tham gia" sits at the top: step 1 never changes (pick your sign); step 2 is the move that matters right now
// (fight the boss, claim the chest, fix Thủy Nghịch, bless a wish), otherwise it cycles through everything you can type.
// Icons are the same as the buttons on a viewer's own TikTok screen.
// Each line has to fit its half of the strip on a phone: a short command, then at most ~28 characters.
const TIPS = [
  [ICON.heart, 'Thả tim', 'trăng lên rằm'],
  [ICON.comment, '“xin quẻ”', 'quẻ riêng của bạn'],
  [ICON.comment, '“ước …”', 'thả đèn ước lên trời'],
  [ICON.gift, 'Tặng quà', 'ánh sao cho cung bạn'],
  [ICON.comment, '“nâng cấp”', 'linh vật lên cấp'],
  [ICON.comment, '“kho”', 'xem đồ bạn đã có'],
  [ICON.comment, '“đổi Sư Tử”', 'chọn nhầm? đổi cung'],
  [ICON.comment, '“khoe thẻ”', 'khoe bộ thẻ của bạn'],
  [ICON.follow, 'Fanclub: “gọi sao”', 'sao may mắn cho cung bạn'],
];
let tipI = 0, lastTip = '';
function renderJoin() {
  const c = S.cosmos, wish = c?.wishes?.find(w => w.open);
  const tip = c?.boss ? ['⚔️', 'Đánh Sao Chổi!', 'chat · thả tim = sát thương', 'hot']
    : c?.chest.open ? ['🎁', 'Gõ “nhận”', `lấy thẻ · còn ${Math.ceil(c.chest.remainingMs / 1000)}s`, 'hot']
    : c?.chaos ? ['☿', 'Gõ “thuận”', `sửa sóng · ${c.chaos.got}/${c.chaos.need} người`, 'hot']
    : wish ? ['🙏', 'Gõ “chúc”', `cho ${wish.nickname} · ${wish.blessings}/${c.blessNeed}`, 'hot']
    : TIPS[tipI % TIPS.length];
  const html = `<span class="ji">${tip[0]}</span><div><b>${esc(tip[1])}</b><span>${esc(tip[2])}</span></div>`;
  if (html === lastTip) return;
  lastTip = html;
  const el = $('jcmd');
  el.className = `j2${tip[3] ? ' hot' : ''}`;
  el.innerHTML = `<span class="jn">2</span>${html}`;
}
setInterval(() => { tipI++; if (S.signs.length) renderJoin(); }, 4500);

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
  for (const [a, x, y, r] of skyStars) { g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
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
// Boss fight: a bolt flies from a sign's node into the boss at the centre; a damage number pops where it lands.
let shots = [], floats = [];
function shoot(sign, dmg, crit = false) {
  if (shots.length >= 16) return;
  const [x, y] = nodePos(sign);
  shots.push({ x0: x, y0: y, t: 0, c: color(sign), dmg, crit });
}
let beams = [];
function beam(sign, c, blocked = false) { const [x, y] = nodePos(sign); beams.push({ x, y, c, blocked, t: 0 }); }

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
const GREETING_X = [70, 680, 360];
let greetingSlot = 0;
function releaseGreeting(e) {
  const box = $('lanterns');
  const old = [...box.querySelectorAll('.floating-greeting')];
  while (old.length >= 3) old.shift().remove();
  const el = document.createElement('div');
  el.className = 'floating-greeting';
  el.dataset.id = `g${e.id}`;
  el.style.left = `${GREETING_X[greetingSlot++ % GREETING_X.length] + rnd(-18, 18)}px`;
  el.style.setProperty('--sway', `${rnd(-40, 40)}px`);
  el.innerHTML = `<span class="fg-icon">👋</span><div><b>Chào ${esc(e.nickname)}!</b><span>Chúc bạn xem live thật vui ✨</span></div>${avatarHtml(e)}`;
  el.addEventListener('animationend', ev => { if (ev.animationName === 'rise-greeting') el.remove(); });
  box.append(el);
}
function blessLantern(e, done = false) {
  const el = $('lanterns').querySelector(`[data-id="${e.id}"]`);
  if (!el) return;
  const em = el.querySelector('.lbless em');
  if (em) em.textContent = e.count;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (done) { el.classList.add('blessed'); el.querySelector('.lbless').innerHTML = '⭐ cả phòng đã chúc phúc!'; }
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
function spotOf(userId, sign) { return orbitSpots.get(userId) ?? (sign ? nodePos(sign) : [CX, CY]); }

// --- the community sky (under the chat): a star for every viewer who ever picked a sign ---------------------
// Tonight's viewers shine gold with their name; the others stay dim. A new star flies down from its owner's
// mascot; the big "điểm danh" moment flies tonight's stars in from above. Positions come from the server (0..1).
const SKY_Y = LAYOUT.zone + 74, SKY_H = FRAME_HEIGHT - SKY_Y - 46;
const starPoint = s => [50 + s.x * 980, SKY_Y + s.y * SKY_H];
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
    fx.globalAlpha = (here || lit ? .22 : .08) + .08 * tw; fx.fillStyle = s.sign ? color(s.sign) : C.paper;
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

// --- vòng quay bóc phốt: the wheel itself spins — its 12 sign nodes turn round the centre and stop with the roasted
// sign under the pointer at the top; the centre circle reads the tease. A moment later the nodes jump back to their
// places (no state to unwind if anything goes wrong). Mascots step off the wheel while it turns.
let spinUntil = 0, roastHold = 0;
const holdCenter = () => Date.now() < roastHold;
function roastWheel(e) {
  const k = IDS.indexOf(e.sign), turn = -(360 * 4 + k * 30), s = SIGN[e.sign], back = e.spinMs + 2500;
  spinUntil = Date.now() + back;
  roastHold = Date.now() + e.spinMs + 12000;
  centerUntil = roastHold;
  const wheel = $('wheel');
  for (const id of IDS) {
    // each node turns about the wheel's centre: its transform origin is the centre, measured from the node's own box
    const el = nodes[id].el, [x, y] = local(nodePos(id));
    el.style.transformOrigin = `${LOCAL_W / 2 - x + 48}px ${LOCAL_H / 2 - y + 48}px`;
    el.style.transition = 'none';
    el.style.transform = 'rotate(0deg)';
  }
  wheel.classList.add('roasting');
  paintCenter('<div class="ico-g">🔥</div><div class="cap">Vòng quay bóc phốt</div><div class="sub">quay quay quay… cung nào dính phốt đây?</div>', true);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const id of IDS) { const el = nodes[id].el; el.style.transition = `transform ${e.spinMs - 300}ms cubic-bezier(.12,.62,.08,1)`; el.style.transform = `rotate(${turn}deg)`; }
  }));
  setTimeout(() => {
    sfx('roast');
    nodes[e.sign].el.classList.add('roasted');
    paintCenter(`<div class="ico-g gf roastglyph">${s.glyph}\uFE0E</div><div class="cap">Bóc phốt ${esc(s.label)}</div><div class="sub roastline">“${esc(e.line)}”</div><div class="sub" id="roastCount">fan ${esc(s.label)} gõ <b>“oan”</b> (cần ${e.need}) · cung khác gõ <b>“chuẩn”</b></div>`, true);
    burst(CX, CY, ['#ff7a45', C.gold, C.paper], 70, 11);
    speak(`Bóc phốt ${s.label}: ${e.line}`);
  }, e.spinMs);
  setTimeout(() => {
    for (const id of IDS) { const el = nodes[id].el; el.style.transition = 'none'; el.style.transform = ''; }
    requestAnimationFrame(() => { for (const id of IDS) nodes[id].el.style.transition = ''; });
    nodes[e.sign].el.classList.remove('roasted');
    wheel.classList.remove('roasting');
  }, back);
}

// --- the hour's look: its ruling planet rides the wheel's gold ring, and each planet brings its own weather ------
//   ♂ embers rising · ♀ hearts drifting down · ☿ quick sparks round the ring · ☽ slow mist · ☉ turning rays
//   ♃ gold glitter falling · ♄ a tilted ring round the centre and drifting dust
let weather = [], weatherOf = '', orbitA = -Math.PI / 2, orbitTrail = [];
const HEART = (x, y, r) => { fx.beginPath(); fx.moveTo(x, y + r * .9); fx.bezierCurveTo(x - r * 1.6, y - r * .2, x - r * .6, y - r * 1.4, x, y - r * .4); fx.bezierCurveTo(x + r * .6, y - r * 1.4, x + r * 1.6, y - r * .2, x, y + r * .9); fx.fill(); };
function spawnWeather(p) {
  const top = WHEEL_T, bot = LAYOUT.wheelB;
  if (p === 'mars') return { x: rnd(60, 1020), y: bot, vx: rnd(-.3, .3), vy: -rnd(1, 2.2), r: rnd(1.5, 3.5), life: 200, c: Math.random() < .5 ? '#ff8a3d' : '#E97A66' };
  if (p === 'venus') return { x: rnd(60, 1020), y: top, vx: 0, vy: rnd(.5, 1), r: rnd(5, 8), life: 260, c: Math.random() < .5 ? '#F2A7C3' : '#ffd1e3', heart: true, sway: rnd(0, 6) };
  if (p === 'mercury') { const [x, y] = at(BAND + rnd(-30, 60), rnd(0, 6.28)); return { x, y, vx: 0, vy: 0, r: rnd(10, 22), life: 14, c: '#d9c6ff', spark: true }; }
  if (p === 'moon') return { x: rnd(0, 1080), y: rnd(top, bot), vx: rnd(.15, .4), vy: 0, r: rnd(70, 140), life: 320, c: '#FFE7A1', mist: true };
  if (p === 'sun') return { x: rnd(60, 1020), y: bot, vx: 0, vy: -rnd(.4, .9), r: rnd(1.5, 3), life: 260, c: '#F2C45C' };
  if (p === 'jupiter') return { x: rnd(60, 1020), y: top, vx: rnd(-.2, .2), vy: rnd(1.2, 2.4), r: rnd(2, 4), life: 240, c: Math.random() < .5 ? '#F2C45C' : '#9CC67A', glint: true };
  return { x: rnd(0, 1080), y: rnd(top, bot), vx: rnd(-.5, -.2), vy: rnd(-.05, .05), r: rnd(1, 2.2), life: 300, c: '#8EC0B9' };
}
function drawHourFx(t, dt) {
  const h = S.cosmos?.hour;
  if (!h) return;
  const p = h.planet;
  if (p !== weatherOf) { weatherOf = p; weather = []; }
  // the fixed shapes of a few hours, behind everything else
  if (p === 'saturn') {
    fx.save(); fx.translate(CX, CY); fx.rotate(-0.32);
    fx.globalAlpha = .28; fx.strokeStyle = h.color; fx.lineWidth = 16 * Z; fx.beginPath(); fx.ellipse(0, 0, 360 * Z, 92 * Z, 0, 0, 7); fx.stroke();
    fx.globalAlpha = .5; fx.lineWidth = 3; fx.strokeStyle = '#fff'; fx.beginPath(); fx.ellipse(0, 0, 360 * Z, 92 * Z, 0, 0, 7); fx.stroke(); fx.restore();
  } else if (p === 'sun') {
    fx.save(); fx.translate(CX, CY); fx.rotate(t / 9000); fx.globalAlpha = .1; fx.fillStyle = h.color;
    for (let i = 0; i < 16; i++) { fx.rotate(Math.PI / 8); fx.beginPath(); fx.moveTo(-14 * Z, 270 * Z); fx.lineTo(14 * Z, 270 * Z); fx.lineTo(0, 470 * Z); fx.fill(); }
    fx.restore();
  }
  if (weather.length < (p === 'moon' ? 10 : 36) && Math.random() < (p === 'mercury' ? .5 : .25) * dt) weather.push(spawnWeather(p));
  weather = weather.filter(w => (w.life -= dt) > 0 && w.y > WHEEL_T - 20 && w.y < LAYOUT.wheelB + 20);
  for (const w of weather) {
    w.x += (w.vx + (w.heart ? Math.sin(t / 500 + w.sway) * .4 : 0)) * dt; w.y += w.vy * dt;
    fx.fillStyle = w.c; fx.strokeStyle = w.c;
    if (w.mist) { fx.globalAlpha = .045 * Math.min(1, w.life / 60); fx.beginPath(); fx.arc(w.x, w.y, w.r, 0, 7); fx.fill(); }
    else if (w.spark) { fx.globalAlpha = w.life / 14; fx.lineWidth = 2; fx.beginPath(); fx.moveTo(w.x, w.y); fx.lineTo(w.x + w.r * .4, w.y + w.r * .5); fx.lineTo(w.x - w.r * .2, w.y + w.r * .6); fx.lineTo(w.x + w.r * .3, w.y + w.r); fx.stroke(); }
    else if (w.heart) { fx.globalAlpha = .55 * Math.min(1, w.life / 50); HEART(w.x, w.y, w.r); }
    else if (w.glint) { fx.globalAlpha = .5 + .5 * Math.sin(t / 120 + w.x); fx.save(); fx.translate(w.x, w.y); fx.rotate(t / 300 + w.x); fx.fillRect(-w.r, -w.r, w.r * 2, w.r * 2); fx.restore(); }
    else { fx.globalAlpha = (.4 + .4 * Math.sin(t / 150 + w.x)) * Math.min(1, w.life / 40); fx.beginPath(); fx.arc(w.x, w.y, w.r, 0, 7); fx.fill(); }
  }
  // the ruling planet: a glowing sphere with its glyph, riding the gold ring with a tail of light
  orbitA += 0.0035 * dt;
  const [ox, oy] = at(BAND, orbitA), pr = 26 * Z;
  orbitTrail.push([ox, oy]); if (orbitTrail.length > 22) orbitTrail.shift();
  orbitTrail.forEach(([x, y], i) => { fx.globalAlpha = i / orbitTrail.length * .5; fx.fillStyle = h.color; fx.beginPath(); fx.arc(x, y, pr * (.3 + .5 * i / orbitTrail.length), 0, 7); fx.fill(); });
  const g = fx.createRadialGradient(ox - pr * .3, oy - pr * .3, 2, ox, oy, pr * 1.9);
  g.addColorStop(0, '#fff'); g.addColorStop(.45, h.color); g.addColorStop(1, 'rgba(0,0,0,0)');
  fx.globalAlpha = 1; fx.fillStyle = g; fx.beginPath(); fx.arc(ox, oy, pr * 1.9, 0, 7); fx.fill();
  fx.fillStyle = '#2F3C44'; fx.font = `400 ${Math.round(pr * 1.15)}px 'Segoe UI Symbol', sans-serif`; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText(h.glyph, ox, oy + 1);
  fx.globalAlpha = 1;
}

// --- giờ hành tinh and the run: how each headliner and door is played, in one line ---------------------
const HEAD_ICON = { elite: '☄️', tug: '🪢', matchmaking: '💞', roast: '🔥', quizchain: '🧠', chaos: '🌀', moonnight: '🌕', final: '👑', chestrain: '🎁', run: '🪐' };
const HEAD_HOW = {
  matchmaking: 'mỗi 25 giây ghép một đôi trên sân — comment để được gọi tên',
  quizchain: `${S.config?.quizChainLength ?? 5} câu liền · trả lời đúng liên tiếp để giữ chuỗi`,
  moonnight: 'quẻ chung + bầu trời ngày sinh · thả tim để trăng lên nhanh gấp đôi',
  final: 'đến hết màn: cung góp nhiều ánh sao nhất được đội vương miện',
  chestrain: 'rương mở 3 lần liền — gõ “nhận” mỗi lần',
};
const RUN_DOOR_HOW = { fight: 'comment · thả tim để đánh', elite: 'quái mạnh, thưởng ngọc', chest: 'ngọc cho cả đoàn + chọn ấn', event: 'gõ A hoặc B để quyết định', rest: 'hồi 30% máu', boss: 'trận cuối — dồn hết sức!' };

// --- bầu trời ngày sinh: that day's planets on a small chart, the viewer's face in the middle -----------
const SHOW_LABEL = { starcall: 'điểm danh sao', birth: 'bầu trời ngày sinh', meteor: 'mưa sao băng' };
function birthSky(e) {
  const deg = a => (a - 90) * Math.PI / 180, pt = (r, a) => [r * Math.cos(deg(a)), r * Math.sin(deg(a))];
  let svg = '<circle class="ring" r="172"/><circle class="ring" r="124"/>';
  IDS.forEach((id, i) => {
    const [x1, y1] = pt(124, i * 30), [x2, y2] = pt(172, i * 30), [gx, gy] = pt(149, i * 30 + 15);
    svg += `<line class="tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="sg${id === e.sun ? ' sun' : ''}" x="${gx}" y="${gy}">${SIGN[id].glyph}︎</text>`;
  });
  const used = {};
  e.planets.forEach((p, i) => {
    const n = used[p.sign] = (used[p.sign] ?? 0) + 1, r = n % 2 ? 96 : 64; // planets sharing a sign step inwards
    const [x, y] = pt(r, IDS.indexOf(p.sign) * 30 + (p.deg ?? 15) + (n - 1) * 6);
    svg += `<g class="pl ${p.id}" style="--dx:${x.toFixed(0)}px;--dy:${y.toFixed(0)}px;animation-delay:${(.3 + i * .18).toFixed(2)}s"><circle cx="${x}" cy="${y}" r="20"/><text x="${x}" y="${y + 1}">${PLANET(p.id).glyph}</text></g>`;
  });
  const chart = `<div class="bchart"><svg viewBox="-180 -180 360 360">${svg}</svg><div class="me">${avatarHtml(e, 'av')}</div></div>`;
  const lines = e.full
    ? e.lines.map(l => `<p><b>${PLANET(l.planet).glyph} ${esc(l.title)} · ${esc(SIGN[l.sign].label)}:</b> ${esc(l.text)}</p>`).join('')
    : `<p><b>☉ Mặt Trời ở ${esc(SIGN[e.sun].label)}</b> · ${esc(pickLine(e.sun))}</p><p class="hint">gõ thêm năm sinh, vd “12/8/1998”, để xem cả bầu trời ✨</p>`;
  celebrate({ key: 'birth', badge: '🌌 BẦU TRỜI NGÀY SINH', extra: chart, title: e.replay ? `Ngày ${esc(e.nickname)} chào đời…` : `${esc(e.nickname)} chào đời dưới bầu trời này`, sub: `<div class="blines">${lines}</div>`, color: color(e.sun), ms: e.full ? 8500 : 5200, compact: true });
  speak(e.full ? `Bầu trời ngày ${e.nickname} chào đời` : `${e.nickname}, Mặt Trời ở ${SIGN[e.sun].label}`);
}

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
  drawHourFx(t, dt);

  // viewers stand just outside the zodiac band by their sign (up to 2 per sign, the rest are "+n" on the node):
  // their mascot (bigger, with a halo, as it levels up), their own TikTok avatar on its shoulder, and their name
  orbitSpots.clear();
  const bySign = {};
  for (const v of S.stage) (bySign[v.sign] ??= []).push(v);
  const now = Date.now();
  for (const id of now < spinUntil ? [] : IDS) { // the mascots step off while the wheel spins for a roast
    const list = (bySign[id] ?? []).slice(-2), a = angleOf(id), dx = Math.cos(a), dy = Math.sin(a), [nx, ny] = nodePos(id);
    list.forEach((v, i) => {
      const off = (i - (list.length - 1) / 2) * 70, dance = (dancing.get(v.userId) ?? 0) > now || S.hud?.moon.partyMs > 0;
      const bob = Math.sin(t / (dance ? 120 : 600) + i * 1.7) * (dance ? 10 : 4);
      const x = nx + (dx * (STAND - R) - dy * off) * Z, y = ny + (dy * (STAND - R) + dx * off) * Z + bob;
      orbitSpots.set(v.userId, [x, y - 20]);
      const lv = v.level ?? 1, k = (1 + 0.08 * (lv - 1)) * Z, w = 58 * k, h = 85 * k;
      if (v.aura > now) { // a recent gift: a slow golden ring of sparkles round the giver's mascot
        for (let k = 0; k < 6; k++) { const q = t / 700 + k * 1.047; fx.globalAlpha = .55 + .45 * Math.sin(t / 200 + k); fx.fillStyle = FAN_GOLD; fx.beginPath(); fx.arc(x + Math.cos(q) * 40 * Z, y + Math.sin(q) * 46 * Z, 3.5, 0, 7); fx.fill(); }
        fx.globalAlpha = 1;
      }
      if (lv > 1) {
        const g = fx.createRadialGradient(x, y, 6, x, y, 30 + lv * 7);
        g.addColorStop(0, LEVEL_COLOR[lv]); g.addColorStop(1, 'rgba(0,0,0,0)');
        fx.globalAlpha = .55 + .2 * Math.sin(t / 400 + i); fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, 30 + lv * 7, 0, 7); fx.fill(); fx.globalAlpha = 1;
      }
      const sp = sprites[v.sign];
      if (sp) {
        if (dance) { fx.save(); fx.translate(x, y); fx.rotate(Math.sin(t / 140 + i) * .18); fx.drawImage(sp, -w / 2, -h / 2, w, h); fx.restore(); }
        else fx.drawImage(sp, x - w / 2, y - h / 2, w, h);
      }
      drawAvatar(v, x + w / 2 - 6, y - h / 2 + 8, v.fan || v.sub ? 20 : 17, v.fan || v.sub ? FAN_GOLD : color(v.sign), lv, v.fan ? `♥${v.fan}` : v.sub ? 'SUB' : '', v.frame ? FRAME_COLOR[v.frame] : null);
      const lb = label(v.nickname, 15, v.title === 'Tân Tinh' ? C.paper : '#F2C45C');
      drawLabel(lb, x, dy < -.5 ? y - h / 2 - 28 : y + h / 2 + 2); // names go on the far side of the mascot from the node
    });
  }

  // comets: shared light flowing from a lit constellation to a dark one, along the wheel
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
    if (p.heart) { const r = p.r; fx.beginPath(); fx.moveTo(p.x, p.y + r * .9); fx.bezierCurveTo(p.x - r * 1.6, p.y - r * .2, p.x - r * .6, p.y - r * 1.4, p.x, p.y - r * .4); fx.bezierCurveTo(p.x + r * .6, p.y - r * 1.4, p.x + r * 1.6, p.y - r * .2, p.x, p.y + r * .9); fx.fill(); }
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

  // the boss's strikes: a beam from the comet to the sign it hits (or a shield ring that stops it)
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
    fx.fillStyle = s.c; fx.beginPath(); fx.arc(x, y, s.crit ? 14 : 9, 0, 7); fx.fill();
    fx.fillStyle = C.paper; fx.beginPath(); fx.arc(x, y, s.crit ? 6 : 4, 0, 7); fx.fill();
    if (s.t >= 1) {
      burst(CX, CY - 40 * Z, [s.c, C.paper, s.crit ? C.accent : C.gold], s.crit ? 40 : 14, s.crit ? 10 : 6);
      floats.push({ x: CX + rnd(-140, 140) * Z, y: CY - 90 * Z + rnd(-30, 30), t: 0, text: `-${fmt(s.dmg)}${s.crit ? ' CHÍ MẠNG' : ''}`, col: s.crit ? C.accent : '#ffffff' });
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
// Idle cards rotate through the sign's one-liners and fact cards, so a sign's card changes every lap.
function pickLine(id) {
  const lap = Math.floor(attractI / 144);
  const pool = [...SIGN_DATA[id].lines, ...factCards(id, x => SIGN[x].label, x => SIGN[x].element, lap)];
  return pool[Math.floor(attractI / 12) % pool.length];
}
const paintCenter = (html, force = false) => { if (holdCenter() && !force) return; const c = $('center'); c.innerHTML = `<div class="slide">${html}</div>`; c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); };

// level 0: someone joined, a small gift…
function spotlight(html, ms = 1800, key = 'spot') {
  go({ key, level: LV.TICK, ms, show: () => { paintCenter(html); centerUntil = Date.now() + ms + 400; } });
}
// while the lane is free the centre introduces a sign or invites the signs still waiting
setInterval(() => {
  const t = Date.now();
  if (!lane.idle() || t < centerUntil || !S.sky) return;
  // now and then the centre explains the wheel itself
  if (attractI % 20 === 10) {
    attractI++;
    paintCenter(`<div class="ico-g">🌌</div><div class="cap">Vòng hoàng đạo</div><div class="sub">mỗi cung một cung tròn ngoài, sáng dần theo ánh sao cả đội góp · chấm tròn là hành tinh thật đang đứng lúc này</div>`);
    centerUntil = t + 5000;
    return;
  }
  // every third card explains one planet of the real sky: where it stands right now and what it gives that sign's fans
  const planets = S.cosmos?.sky?.planets;
  if (planets && S.cosmos.boons && attractI % 3 === 2) {
    const p = planets[(attractI / 3 | 0) % planets.length], d = PLANET(p.id), s = SIGN[p.sign];
    attractI++;
    paintCenter(`<div class="ico-g gf">${d.glyph}</div><div class="cap">${esc(d.label)} ở ${esc(s.label)}</div><div class="sub">${p.retro ? '℞ đang nghịch hành · ' : ''}fan ${esc(s.label)}: ${esc(d.boon)} x${d.mult}<br>trời thật lúc này ✨</div>`);
    centerUntil = t + 4000;
    return;
  }
  const waiting = S.sky.waiting, id = attractI % 2 === 0 && waiting.length ? waiting[(attractI / 2) % waiting.length | 0] : IDS[attractI % 12];
  const s = SIGN[id], empty = !S.stage.some(v => v.sign === id);
  attractI++;
  // a sign's mascot only shows once somebody has picked it; an empty seat shows just its glyph
  paintCenter(`${empty ? `<div class="ico-g gf">${s.glyph}︎</div>` : `<img src="${mascot(id, 'idle')}" alt="">`}<div class="cap">${esc(s.label)}</div><div class="sub">${empty ? `Comment “${IDS.indexOf(id) + 1}” để giữ chỗ ✨` : esc(pickLine(id))}</div>`);
  centerUntil = t + 3500;
}, 250);

// level 1: one announcement strip with an icon, a title and an optional line under it, plus a countdown bar
const eventEl = $('event');
function card({ key, icon = '✨', title, sub = '', color: ec = C.gold, ms = 2800, kind = '' }) {
  go({
    key, level: LV.CARD, ms, minShow: 1400,
    show: () => { eventEl.innerHTML = `<div class="ev${kind ? ' ' + kind : ''}" style="--ec:${ec};--ms:${ms}ms"><div class="ic">${icon}</div><div class="tx"><div class="tt">${title}</div>${sub ? `<div class="ss">${sub}</div>` : ''}</div><i class="pg"></i></div>`; },
    hide: () => { eventEl.innerHTML = ''; },
  });
}

// A gift gets its own golden card: the gift picture bouncing, the gift as the headline, the sender's face
// and name under it, a combo bubble for repeats, and a shower of coins out of the card when it lands.
const giftPic = e => (e.giftImage ? `<img src="${esc(e.giftImage)}" alt="">` : ICON.gift);
function giftCard(e, sign) {
  const ms = e.count >= 5 ? 4200 : 3400;
  go({
    key: 'gift', level: LV.CARD, ms, minShow: 1800,
    show: () => {
      eventEl.innerHTML = `<div class="ev gift" style="--ms:${ms}ms"><div class="ic">${giftPic(e)}</div><div class="tx"><div class="tt">${esc(e.giftName ?? 'Quà tặng')}</div>`
        + `<div class="ss">${e.avatar ? `<img src="${esc(e.avatar)}" alt="">` : ''}<span><b>${esc(e.nickname)}</b> · ${gain(e, sign)}</span></div></div>`
        + `${e.count > 1 ? `<div class="combo"><b>x${e.count}</b><small>${e.count >= 5 ? 'COMBO' : 'QUÀ'}</small></div>` : ''}<i class="pg"></i></div>`;
      for (let i = 0; i < 3; i++) setTimeout(() => burst(rnd(120, 960), CY + 40, [gold, '#FFE7A1', C.paper, sign ? color(sign) : C.accent], 26, 9), i * 180);
    },
    hide: () => { eventEl.innerHTML = ''; },
  });
}

// level 3: the big moments take over the wheel area
const heroEl = $('hero');
function celebrate({ key, badge = '', icon = '', glyphs = '', mascotSign = null, mood = 'win', title, sub = '', extra = '', color: hc = C.gold, ms = 3200, compact = false }) {
  // while the boss, a tug of war or a run is on the arena stays in view: other celebrations shrink to the announcement strip
  // (the strip keeps the celebration's picture — a gift, the chest, an avatar — as its icon)
  const arena = S.cosmos?.boss ? 'boss' : S.cosmos?.tug ? 'tug' : S.cosmos?.run ? 'run' : null; // these keep the centre in view
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
  $('wheelTitle').textContent = `Vòng hoàng đạo thứ ${sky.wheel}`;
  $('wheelCount').textContent = `🎯 Thắp sáng 12 cung · ${sky.litCount}/12`;
  $('missionProgress').setAttribute('stroke-dasharray', `${(sky.sky.reduce((sum, s) => sum + s.progress, 0) / 12).toFixed(3)} 1`);
  for (const s of sky.sky) {
    const n = nodes[s.id];
    if (n.lit !== s.lit) { n.el.classList.toggle('lit', s.lit); n.lit = s.lit; }
  }
  renderCall();
}

function renderStage(list) {
  const counts = {};
  for (const v of list) counts[v.sign] = (counts[v.sign] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  for (const id of IDS) {
    const count = counts[id] ?? 0, extra = count - 2;
    nodes[id].el.style.setProperty('--fill', `${max ? count / max * 100 : 0}%`);
    nodes[id].more.classList.toggle('on', extra > 0);
    if (extra > 0) nodes[id].more.textContent = `+${extra}`;
    nodes[id].el.classList.toggle('waiting', !counts[id]); // empty signs stay empty: no mascot, dashed node
  }
  // nobody on stage → the queue replaces the wheel entirely (no mascots, no centre card behind it)
  $('waiting').classList.toggle('on', !list.length);
  $('wheel').classList.toggle('empty', !list.length);
}

// The line: first come first served, up to eight viewers. The newest arrival is greeted by name for a few seconds.
let greetedKey = '', greetTimer = 0;
const GREET = { title: 'Chào mừng cả nhà đến Đêm Hội!', sub: 'Comment <em>số 1–12</em> hoặc <em>tên cung</em> để vào vòng ✨' };
function renderLobby(l) {
  const people = (l.people ?? []).slice(0, 8);
  $('wqueue').classList.toggle('on', people.length > 0);
  $('wql').innerHTML = people.map((p, i) =>
    `<div class="wp${i === 0 ? ' first' : ''}"><span class="pos">${i + 1}</span>${avatarHtml(p)}<div class="who"><b>${esc(p.nickname)}</b><span>${i === 0 ? 'kế tiếp · gõ số 1–12 nhé!' : 'đang chọn cung…'}</span></div></div>`).join('');
  $('wqn').textContent = l.total ? `${l.total} người đang chờ${l.total > 8 ? ` · +${l.total - 8} nữa` : ''}` : 'chưa có ai — bạn là người đầu tiên!';
  const key = l.latest ? l.latest.nickname + l.total : '';
  if (l.latest && key !== greetedKey) {
    $('wgTitle').textContent = `Chào ${l.latest.nickname}!`;
    $('wgSub').innerHTML = 'Gõ <em>số 1–12</em> hoặc <em>tên cung</em> để bước vào vòng ✨';
    $('wwave').innerHTML = avatarHtml(l.latest, 'wav'); // the newcomer's own face where the waving hand was
    $('wgTitle').classList.remove('hi'); void $('wgTitle').offsetWidth; $('wgTitle').classList.add('hi');
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => { $('wgTitle').textContent = GREET.title; $('wgSub').innerHTML = GREET.sub; $('wwave').textContent = '👋'; }, 7000);
  }
  greetedKey = key;
}

// The gift board: progress to the room's shared goal, the night's totals and who gave most (each gift itself
// already gets its own card when it lands).
function renderGifts() {}

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
  $('wvis').textContent = fmt(h.night.visitors);
  if (!S.cosmos?.hour) $('kicker').textContent = `Đêm ${h.night.no} · ${h.occasion ? h.occasion.name : `${fmt(h.night.visitors)} người ghé thăm`}`;
  if (h.occasion && !shownOccasion) { shownOccasion = true; celebrate({ key: 'occasion', badge: 'HÔM NAY', icon: '🎉', title: esc(h.occasion.name), sub: esc(h.occasion.greeting), ms: 5000, compact: true }); }
  const party = h.moon.partyMs > 0, pct = party ? 1 : h.moon.light / h.moon.goal;
  $('moonRect').setAttribute('y', String(120 - 120 * pct));
  $('moon').classList.toggle('party', party);
  $('moonPct').textContent = party ? `${Math.ceil(h.moon.partyMs / 1000)}s` : `${Math.floor(pct * 100)}%`;
  $('moonSub').textContent = party ? 'trăng rằm · x2' : 'thả tim để trăng lên';
  const lucky = h.lucky?.sign ?? null;
  if (lucky !== S.lucky) {
    if (S.lucky) nodes[S.lucky].el.classList.remove('lucky');
    if (lucky) nodes[lucky].el.classList.add('lucky');
    S.lucky = lucky;
  }
  renderCall();
  renderFortune(h.fortune);
  renderQuiz(h.quiz);
  renderPoll(h.poll);
  music.setMood(party || S.stage.length >= 8 ? 'upbeat' : 'calm');
}

function renderRace(r) {
  const top = Math.max(1, r.order[0].given);
  for (const x of r.order) {
    const c = chips[x.id], lead = x.rank === 1 && x.given > 0;
    c.el.style.setProperty('--o', x.rank);
    c.el.style.setProperty('--p', (x.given / top).toFixed(3));
    c.el.classList.toggle('off', x.rank > 3); // only the top three fit the top card
    c.rk.textContent = lead ? '👑' : x.rank;
    c.v.textContent = fmt(x.given);
    c.el.classList.toggle('lead', lead);
    if (c.crowns !== x.crowns) { c.crowns = x.crowns; c.nm.textContent = SIGN[x.id].label + (x.crowns ? ` 🏆${x.crowns}` : ''); }
    nodes[x.id].el.classList.toggle('lead', r.leader === x.id);
  }
}

// One line under the progress dots: the lucky star while it lasts, otherwise who is still waiting.
let lastCall = '';
function renderCall() {
  const h = S.hud, sky = S.sky;
  if (!h || !sky) return;
  let html, kind = '';
  const cz = S.cosmos;
  if (cz?.chaos) { kind = 'chaos'; html = `☿ <b>THỦY NGHỊCH</b> · ánh sao lạc sang đối cung · gõ <b>“thuận”</b> ${cz.chaos.got}/${cz.chaos.need} · ${Math.ceil(cz.chaos.remainingMs / 1000)}s`; }
  else if (cz?.boss) { kind = 'boss'; html = `☄ <b>Đánh Sao Chổi Đen!</b> comment · thả tim — mỗi nguyên tố một vai`; }
  else if (!S.stage.length && !h.lucky) html = 'Chào mừng! Comment <b>số 1–12</b> hoặc tên cung để bay vào vòng ✨';
  else if (cz?.predict?.open) { kind = 'boss'; const [A, B] = cz.predict.options; html = `🔮 <b>${esc(cz.predict.q)}</b> · gõ “đoán A” ${esc(A.label)} (${A.n}) / “đoán B” ${esc(B.label)} (${B.n}) · ${Math.ceil(cz.predict.closesInMs / 1000)}s`; }
  else if (cz?.roast && !cz.roast.spinning) { kind = 'boss'; html = `🔥 <b>Bóc phốt ${esc(SIGN[cz.roast.sign].label)}</b> · fan gõ “oan” ${cz.roast.protests}/${cz.roast.need} · “chuẩn” ${cz.roast.agree} · ${Math.ceil(cz.roast.remainingMs / 1000)}s`; }
  else if (cz?.run) { kind = 'boss'; html = `🪐 <b>Hành trình Tầng Trời</b> · tầng ${cz.run.floor}/${cz.run.of} · ${cz.run.vote ? 'gõ <b>A/B/C</b> để chọn' : cz.run.down ? 'gõ <b>“hồi sinh”</b>!' : 'comment · thả tim để đánh'}`; }
  else if (cz?.head) html = `★ <b>${esc(cz.head.label)}</b> đang diễn ra · ${mmss(Math.max(0, S.headEnd - Date.now()))}`;
  else if (h.lucky) html = `⭐ <b>Sao may mắn: ${esc(SIGN[h.lucky.sign].label)}</b> · ánh sao x${h.lucky.multiplier} · ${Math.ceil(h.lucky.remainingMs / 1000)}s`;
  else if (cz?.act && cz.hour && cz.act.phase === 'play' && S.headAt - Date.now() < 300000) html = `${cz.hour.glyph} sắp tới: <b>★ ${esc(cz.hour.head)}</b> sau ${mmss(Math.max(0, S.headAt - Date.now()))} · ${esc(cz.hour.rule)}`;
  else {
    // the boss countdown takes over from the lucky star's once it is under two minutes away
    const next = cz?.bossInMs != null && cz.bossInMs < 120000 ? ` · ☄ <b>Sao Chổi Đen sau ${clock(cz.bossInMs)}</b>` : h.luckyInMs > 0 ? ` · ⭐ sao may mắn sau ${clock(Math.ceil(h.luckyInMs / 10000) * 10000)}` : '';
    html = sky.litCount < 12 ? `Còn chờ ${sky.waiting.slice(0, 2).map(id => `<b>${esc(SIGN[id].label)} (${IDS.indexOf(id) + 1})</b>`).join(', ')}${next}${S.lobby.total ? ` · 👋 ${S.lobby.total} bạn đang chờ chọn cung` : ''}` : 'Cả 12 chòm đã sáng!';
  }
  if (html !== lastCall) { lastCall = html; $('call').innerHTML = html; $('call').className = `call${kind ? ' ' + kind : ''}`; }
}

// --- the real sky, Thủy Nghịch, the boss and the star chest -----------------------------------------------
const PLANET = id => S.planets.find(p => p.id === id) ?? { glyph: '•', label: id, boon: '' };
const EL_NAME = { fire: 'Lửa', earth: 'Đất', air: 'Khí', water: 'Nước' };
// Kho tài nguyên: how each resource looks, and where a drop came from.
const RES = {
  dust: { label: 'bụi sao', img: '/art/dust.svg', color: C.gold },
  fire: { label: 'Hỏa ngọc', img: '/art/gem-fire.svg', color: '#E97A66' },
  earth: { label: 'Thổ ngọc', img: '/art/gem-earth.svg', color: '#9CC67A' },
  air: { label: 'Phong ngọc', img: '/art/gem-air.svg', color: '#B9D3E8' },
  water: { label: 'Thủy ngọc', img: '/art/gem-water.svg', color: '#6FA8DC' },
  moon: { label: 'mảnh trăng', img: '/art/moon-shard.svg', color: '#FFE7A1' },
};
const NEED_FOR = { fortune: 'gõ “xin quẻ”', chest: 'gõ “nhận” khi rương mở', upgrade: 'gõ “nâng cấp”', call: 'gõ “gọi sao”' };
const HEAT = [
  { name: 'Yên ả', color: '#8EC0B9' }, { name: 'Ấm lên', color: '#F2C45C' }, { name: 'Nóng', color: '#ff9f43' },
  { name: 'Bùng cháy', color: '#ff6b3d' }, { name: 'Siêu tân tinh', color: '#ff3d7f' },
];

// Nhiệt phòng (bottom-left of the wheel): the level, a bar to the next one, the bonus it gives.
function renderHeat(h) {
  if (!h) return;
  const lv = HEAT[h.level], lo = h.levels[h.level - 1] ?? 0, hi = h.levels[h.level];
  $('heat').style.setProperty('--hc', lv.color);
  $('heat').classList.toggle('hot', h.level >= 3);
  $('heatName').textContent = h.level ? `${lv.name} x${h.multiplier}` : lv.name;
  $('heatFill').style.transform = `scaleX(${hi ? Math.min(1, (h.score - lo) / (hi - lo)).toFixed(3) : 1})`;
  $('heatSub').textContent = hi ? `nhiệt phòng · còn ${Math.max(1, hi - h.score)} lượt nữa` : 'nóng nhất rồi, giữ lửa nào!';
}
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
  join: ['Comment “Sư Tử”', 'là vào đội Sư Tử, linh vật của bạn đứng lên vòng'],
  wish: ['“ước …”', 'thả đèn ước mang lời ước lên trời, cả phòng gõ “chúc”'],
  fortune: ['“xin quẻ”', 'nhận quẻ hoàng đạo riêng của bạn hôm nay'],
  upgrade: ['“nâng cấp”', 'dùng bụi sao + ngọc để linh vật lớn lên, có hào quang'],
  bless: ['“chúc”', 'chúc phúc điều ước của người khác, nhận bụi sao'],
  chest: ['“nhận”', 'khi rương sao mở (góc trên) để lấy thẻ hoàng đạo'],
  switch: ['“đổi Bảo Bình”', 'chọn nhầm cung? đổi sang cung khác'],
};
const SAMPLE_WISHES = ['cả nhà luôn bình an', 'tháng này đủ tiền tiêu', 'gặp người thương mình thật lòng', 'thi đâu đỗ đó'];
function demo(e) {
  const [cmd, what] = DEMO[e.demo] ?? DEMO.join, s = SIGN[e.sign];
  const host = { nickname: `Linh vật ${s.label}`, avatar: '' };
  // nobody on stage yet: the wheel is hidden behind the waiting layout, so the mascot takes the greeting box
  if ($('waiting').classList.contains('on')) {
    $('wwave').innerHTML = `<img class="wav" src="${mascot(e.sign, 'hype')}" alt="">`;
    $('wgTitle').textContent = `🎓 Linh vật ${s.label}: gõ ${cmd}`;
    $('wgSub').textContent = what;
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => { $('wgTitle').textContent = GREET.title; $('wgSub').innerHTML = GREET.sub; $('wwave').textContent = '👋'; }, 8000);
  } else spotlight(`<div class="demo-tag">🎓 linh vật dẫn chơi</div><img src="${mascot(e.sign, 'hype')}" alt=""><div class="cap">Gõ ${esc(cmd)}</div><div class="sub">${esc(what)}</div>`, 4200, 'demo');
  if (e.demo === 'wish') releaseLantern({ id: `demo-${Date.now()}`, ...host, demo: true, text: SAMPLE_WISHES[Math.floor(Math.random() * SAMPLE_WISHES.length)] });
}

const LOOT_WHY = { bingo: 'bingo!', pass: 'Sổ Sao', quest: 'nhiệm vụ giờ', run: 'Hành trình Tầng Trời', boss: 'chiến lợi phẩm Sao Chổi', chest: 'từ rương sao', quiz: 'trả lời đúng câu đố', chaos: 'sửa sóng Thủy Nghịch', moon: 'có mặt lúc trăng rằm', wish: 'điều ước được chúc phúc' };
const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
// One card of the collection: the sign's mascot on paper framed in the edition's colour.
function cardHtml(card, { big = false, name = '' } = {}) {
  const ed = EDITION[card.edition] ?? EDITION.base, s = SIGN[card.sign];
  return `<div class="zc${big ? ' big' : ''}${ed.foil ? ' foil' : ''}" style="--ed:${ed.color}"><span class="zg gf">${s.glyph}︎</span><img src="${mascot(card.sign, ed.rarity >= 3 ? 'hype' : 'idle')}" alt="">`
    + `${name ? `<span class="zn">${esc(name)}</span>` : ''}<span class="zl">${esc(ed.id === 'base' ? s.label : ed.label)}</span></div>`;
}

let skyKey = '';
function renderCosmos(c) {
  S.cosmos = c;
  // Keep the real planets on the wheel; their separate top-bar row is intentionally omitted.
  const key = c.sky ? JSON.stringify([c.sky.planets, c.sky.moon.phase]) : '';
  if (key !== skyKey) {
    skyKey = key;
    renderPlanets(c.sky);
  }
  renderWishes(c.wishes ?? []);
  renderHeat(c.heat);
  renderFans(c);
  renderJoin();
  // the chest: a countdown, wobbling in the last minute, then OPEN
  const ch = c.chest, chest = $('chest');
  chest.style.display = ch.open || ch.inMs != null ? '' : 'none';
  chest.classList.toggle('open', ch.open);
  chest.classList.toggle('soon', !ch.open && ch.inMs != null && ch.inMs < 60000);
  $('chestT').textContent = ch.open ? `MỞ · ${Math.ceil(ch.remainingMs / 1000)}s` : ch.inMs != null ? mmss(ch.inMs) : '';
  $('chestS').textContent = ch.open ? 'gõ “nhận”' : 'tới rương sao';
  stage.classList.toggle('retro', Boolean(c.chaos));
  for (const id of IDS) nodes[id].el.classList.toggle('frozen', c.boss?.frozen?.sign === id);
  renderArena(c);
  renderQuest(c.quest);
  const rc = $('roastCount');
  if (rc && c.roast) rc.innerHTML = `oan <b>${c.roast.protests}/${c.roast.need}</b> · chuẩn <b>${c.roast.agree}</b> · ${Math.ceil(c.roast.remainingMs / 1000)}s`;
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
  const ms = showAt - Date.now(), busy = S.cosmos?.boss || S.cosmos?.chaos;
  $('showT').textContent = busy ? '…' : ms > 1000 ? mmss(ms) : 'ngay!';
  $('showS').textContent = SHOW_LABEL[showKind] ?? 'màn lớn';
  el.classList.toggle('soon', !busy && ms < 10000);
  el.classList.toggle('now', !busy && ms <= 1000);
  renderHourline();
}
setInterval(renderShow, 250);

// The planetary hour on the top card's first line ("♀ GIỜ SAO KIM · CÒN 23:10 · MÀN 2/4"), its colour on the sky.
let hourKey = '';
function renderHourline() {
  const h = S.cosmos?.hour;
  if (!h) return;
  const a = S.cosmos.act, left = Math.max(0, h.endsAt - Date.now());
  $('kicker').innerHTML = `<span class="hk" style="color:${h.color}">${h.glyph} Giờ ${esc(h.label)}</span> · ${mmss(left)}${a ? ` · màn ${a.no}/${a.of}` : ''}`;
  if (hourKey !== h.planet) { hourKey = h.planet; stage.style.setProperty('--hour', h.color); stage.classList.add('hourly'); }
  renderCall(); // the headliner countdown in the hint line
}

// The real planets outside the zodiac band, each at its true longitude (the sign's arc spans 30°); close neighbours
// step aside a little so their glyphs stay readable. Retrograde ones carry a ℞ and a violet rim.
function renderPlanets(sky) {
  const g = $('planets');
  // The markers stood on the mascots' orbit and told little at a glance; the centre's planet cards explain the real
  // sky instead, and the ruling planet of the hour rides the gold ring (drawHourFx). ?planets=1 brings them back.
  if (!sky || !params.has('planets')) { g.innerHTML = ''; return; }
  const placed = [];
  g.innerHTML = sky.planets.map(p => {
    let a = angleOf(p.sign) + (p.deg + 0.5 - 15) * Math.PI / 180;
    while (placed.some(b => Math.abs(b - a) < 0.085)) a += 0.085;
    placed.push(a);
    const [x, y] = local(at(PLANET_R, a)), d = PLANET(p.id);
    return `<g class="pt${p.retro ? ' retro' : ''}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 1}">${d.glyph}</text>${p.retro ? `<text class="rx" x="${x + 15}" y="${y - 14}">℞</text>` : ''}</g>`;
  }).join('');
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

// The arena covers the centre circle while the boss is up, Thủy Nghịch is on, or the chest is open.
let arenaMode = '', claimKey = '', roleKey = '';
function renderArena(c) {
  const a = $('arena'), mode = c.boss ? 'boss' : c.chaos ? 'chaos' : c.run ? 'run' : c.tug ? 'tug' : c.chest.open ? 'chest' : '';
  if (mode === 'tug' || arenaMode === 'tug') { if (renderTug(a, c.tug, mode !== arenaMode)) { arenaMode = mode; stage.classList.toggle('arena-live', Boolean(mode)); return; } }
  if (mode === 'run' || arenaMode === 'run') { if (renderRun(a, c.run, mode !== arenaMode)) { arenaMode = mode; stage.classList.toggle('arena-live', Boolean(mode)); return; } }
  stage.classList.toggle('arena-live', Boolean(mode));
  if (mode !== arenaMode) {
    arenaMode = mode;
    a.className = mode ? `on ${mode}mode` : '';
    claimKey = '';
    roleKey = '';
    a.innerHTML = mode === 'boss'
      ? `<div class="ak">☄ Sao Chổi Đen ☄</div><div class="boss" id="bossFig"><img src="/art/boss.svg" alt=""><i class="rage-tag">NỔI GIẬN</i></div><div class="hp"><i></i><b></b></div><div class="meta"></div><div class="st"></div>`
        + '<div class="roles"></div>'
      : mode === 'chaos' ? '<div class="ak">☿ Thủy Nghịch ☿</div><div class="merc gf">☿</div><div class="cap"></div><div class="fixbar"><i></i></div><div class="sub"></div>'
      : mode === 'chest' ? '<div class="ak">✦ Rương sao đã mở ✦</div><img class="chestimg" src="/art/chest-open.svg" alt=""><div class="cap"></div><div class="claims"></div><div class="sub"></div>' : '';
  }
  if (mode === 'chaos') {
    const z = c.chaos;
    a.querySelector('.cap').innerHTML = `Gõ <b>“thuận”</b> · ${Math.ceil(z.remainingMs / 1000)}s`;
    a.querySelector('.fixbar i').style.transform = `scaleX(${Math.min(1, z.got / z.need).toFixed(3)})`;
    a.querySelector('.sub').innerHTML = `${z.got}/${z.need} người đã sửa sóng${z.fixers.length ? ` · ${z.fixers.map(esc).join(', ')}` : ''}<br>ánh sao đang lạc sang cung đối diện!`;
  }
  if (mode === 'boss') {
    const b = c.boss;
    const activeElements = ['fire', 'earth', 'air', 'water'].filter(el => S.stage.some(v => SIGN[v.sign]?.element === el));
    const key = activeElements.join('|');
    if (key !== roleKey) {
      roleKey = key;
      a.querySelector('.roles').innerHTML = activeElements.map(el => `<div class="role" style="--el:${ELEMENT[el].color}"><img src="/art/gem-${el}.svg" alt=""><b>${EL_NAME[el]}</b><span>${esc(S.roles[el] ?? '')}</span><em data-el="${el}">0</em></div>`).join('');
    }
    a.querySelector('.hp i').style.transform = `scaleX(${(b.hp / b.max).toFixed(3)})`;
    a.querySelector('.hp b').textContent = `${fmt(b.hp)} / ${fmt(b.max)}`;
    a.classList.toggle('rage', b.rage);
    a.querySelector('.meta').innerHTML = `<span class="t">⏱ ${mmss(b.remainingMs)}</span><span class="sh">🛡 ${b.shield}/${b.shieldMax}</span>${b.combo > 1 ? `<span class="cb">Khí combo x${b.combo}</span>` : ''}`;
    const st = a.querySelector('.st');
    st.classList.toggle('ice', Boolean(b.frozen));
    st.innerHTML = b.frozen
      ? `❄ <b>${esc(SIGN[b.frozen.sign].label)}</b> bị đóng băng! Fan ${esc(SIGN[b.frozen.sign].label)} comment để phá băng ${b.frozen.got}/${b.frozen.need} · ${Math.ceil(b.frozen.remainingMs / 1000)}s`
      : b.top.length ? `Mạnh nhất: ${b.top.map(x => `<b>${esc(x.nickname)}</b> ${fmt(x.dmg)}`).join(' · ')}` : 'Comment, thả tim để tấn công!';
    for (const em of a.querySelectorAll('.role em')) em.textContent = fmt(b.byElement[em.dataset.el]);
  } else if (mode === 'chest') {
    const ch = c.chest;
    a.querySelector('.cap').innerHTML = `Gõ <b>“nhận”</b> · ${Math.ceil(ch.remainingMs / 1000)}s`;
    a.querySelector('.sub').textContent = ch.claims ? `${fmt(ch.claims)} người đã nhận thẻ` : 'mỗi người một thẻ — có thẻ hiếm!';
    const key = ch.recent.map(r => r.nickname + r.card.sign + r.card.edition).join('|');
    if (key !== claimKey) { claimKey = key; a.querySelector('.claims').innerHTML = ch.recent.slice(0, 4).map(r => cardHtml(r.card, { name: r.nickname })).join(''); }
  }
}
// Hành trình Tầng Trời in the centre circle: the floor, the party's health and ấn, then whatever this moment is —
// a vote (doors, ấn or a kỳ ngộ with live counts), the enemy's health, or the "hồi sinh" rally.
// Returns false when the run just ended (the normal arena takes over again).
let runKey = '';
function renderRun(a, r, fresh) {
  if (!r) { if (fresh) { a.className = ''; a.innerHTML = ''; runKey = ''; } return false; }
  if (fresh) { a.className = 'on runmode'; a.innerHTML = '<div class="ak"></div><div class="party"><div class="hp php"><i></i><b></b></div><div class="boons"></div></div><div class="stagebox"></div>'; runKey = ''; }
  a.querySelector('.ak').textContent = `♄ Tầng ${r.floor}/${r.of}${r.ascension ? ` · Thăng thiên ${r.ascension}` : ''}`;
  a.querySelector('.php i').style.transform = `scaleX(${Math.max(0, r.hp / r.max).toFixed(3)})`;
  a.querySelector('.php b').textContent = `Đoàn ❤ ${fmt(r.hp)}/${fmt(r.max)}${r.shield ? ` · 🛡${r.shield}` : ''}`;
  const boonKey = r.boons.map(b => b.id).join() + '|' + r.curses.map(x => x.id).join() + '|' + r.resonance.map(x => x.element).join();
  const bx = a.querySelector('.boons');
  if (bx.dataset.k !== boonKey) {
    bx.dataset.k = boonKey;
    bx.innerHTML = r.boons.map(b => `<span class="bn" style="--el:${color(b.id)}" title="${esc(b.text)}">${G(b.id)}</span>`).join('')
      + r.resonance.map(x => `<span class="rs" style="--el:${ELEMENT[x.element].color}">✦ ${esc(x.label)}</span>`).join('')
      + r.curses.map(x => `<span class="cs">☠ ${esc(x.label)}</span>`).join('');
  }
  const box = a.querySelector('.stagebox'), key = `${r.floor}|${r.phase}|${r.vote?.kind ?? ''}|${r.enemy?.name ?? ''}`;
  if (key !== runKey) {
    runKey = key;
    if (r.vote) box.innerHTML = `<div class="vt">${esc(r.vote.title ?? (r.vote.kind === 'door' ? 'Chọn cửa' : r.vote.kind === 'boon' ? 'Chọn ấn chòm sao' : 'Kỳ ngộ'))}</div><div class="doors ${r.vote.kind}">${r.vote.options.map(o => `<div class="door" data-k="${o.key}"${o.sign ? ` style="--el:${color(o.sign)}"` : ''}><b>${o.key}</b><span>${o.icon ? `${o.icon} ` : o.sign ? `${G(o.sign)} ` : ''}${esc(o.label)}${o.text ? `<small>${esc(o.text)}</small>` : ''}</span><em>0</em></div>`).join('')}</div><div class="sub vs"></div>`;
    else if (r.enemy) box.innerHTML = `<div class="foe">${r.enemy.door === 'boss' ? '<img src="/art/boss.svg" alt="">' : `<span>${r.enemy.icon}</span>`}</div><div class="fn">${esc(r.enemy.name)}</div><div class="hp ehp"><i></i><b></b></div><div class="sub es"></div>`;
    else if (r.down) box.innerHTML = '<div class="vt">💀 Đoàn gục ngã</div><div class="cap">Gõ “hồi sinh”</div><div class="sub ds"></div>';
    else box.innerHTML = `<div class="sub">${r.next ? `tầng kế: ${r.next.map(d => RUN_DOOR_ICON[d]).join(' ')}` : 'chuẩn bị…'}</div>`;
  }
  if (r.vote) {
    for (const o of r.vote.options) { const d = box.querySelector(`.door[data-k="${o.key}"]`); if (d) d.querySelector('em').textContent = o.votes; }
    const top = Math.max(...r.vote.options.map(o => o.votes));
    box.querySelectorAll('.door').forEach((d, i) => d.classList.toggle('lead', top > 0 && r.vote.options[i].votes === top));
    box.querySelector('.vs').textContent = `gõ ${r.vote.options.map(o => o.key).join(' / ')} · ${Math.ceil(r.vote.remainingMs / 1000)}s · ${r.vote.voters} phiếu`;
  } else if (r.enemy) {
    box.querySelector('.ehp i').style.transform = `scaleX(${(r.enemy.hp / r.enemy.max).toFixed(3)})`;
    box.querySelector('.ehp b').textContent = `${fmt(r.enemy.hp)} / ${fmt(r.enemy.max)}`;
    box.querySelector('.es').textContent = `⏱ ${mmss(r.enemy.remainingMs)}${r.enemy.combo > 1 ? ` · Khí combo x${r.enemy.combo}` : ''}${r.top[0] ? ` · mạnh nhất: ${r.top[0].nickname}` : ''}`;
    a.classList.toggle('rage', r.enemy.rage);
  } else if (r.down) box.querySelector('.ds').textContent = `${r.down.got}/${r.down.need} người · ${Math.ceil(r.down.remainingMs / 1000)}s`;
  if (!r.enemy) a.classList.remove('rage');
  return true;
}
// Kéo co cung: two teams, a rope across the centre, the knot sliding toward whoever pulls harder.
function renderTug(a, g, fresh) {
  if (!g) { if (fresh) { a.className = ''; a.innerHTML = ''; } return false; }
  if (fresh) {
    a.className = 'on tugmode';
    a.innerHTML = `<div class="ak">🪢 Kéo co cung</div><div class="teams"><b style="--el:${color(g.a)}">${G(g.a)} ${esc(SIGN[g.a].label)}</b><span>vs</span><b style="--el:${color(g.b)}">${G(g.b)} ${esc(SIGN[g.b].label)}</b></div>`
      + `<div class="rope" style="--ca:${color(g.a)};--cb:${color(g.b)}"><i class="knot"></i></div><div class="sub ts"></div><div class="sub tp"></div>`;
  }
  a.querySelector('.knot').style.left = `${50 + g.pos / 2}%`;
  a.querySelector('.ts').innerHTML = g.warmupMs > 0 ? `đoán trước: gõ <b>“đoán A”</b> hoặc <b>“đoán B”</b> · ${Math.ceil(g.warmupMs / 1000)}s` : `fan hai cung comment · thả tim để kéo · ${mmss(g.remainingMs)}`;
  a.querySelector('.tp').textContent = g.warmupMs > 0 ? '' : `${g.pullersA} người kéo · ${g.pullersB} người kéo`;
  return true;
}
// Bingo Hoàng Đạo: the 3×3 card, marked squares lit.
const bingoGrid = card => `<div class="bingo">${card.map(q => `<span class="${q.marked ? 'on' : ''}" title="${esc(q.label)}">${q.icon}</span>`).join('')}</div>`;

const RUN_DOOR_ICON = { fight: '⚔️', elite: '💀', chest: '🎁', event: '❓', rest: '🔥', boss: '🪐' };

function bossShake() { const b = $('bossFig'); if (!b) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
// The whole frame jolts when the boss strikes.
function quake() { stage.classList.remove('quake'); void stage.offsetWidth; stage.classList.add('quake'); }

// Readings, quizzes and polls are level-2 events: they stay for as long as the game says (holdWhile),
// a celebration can interrupt them, and they come back afterwards if the game still wants them.
const syncScrim = () => $('scrim').classList.toggle('on', ['fortune', 'quiz', 'poll'].some(id => $(id).classList.contains('on')));
const modal = (id, holdWhile) => ({
  key: id, level: LV.MODAL, holdWhile, minShow: 3500, // long enough to read the first line
  show: () => { $(id).classList.add('on'); syncScrim(); },
  hide: () => { $(id).classList.remove('on'); syncScrim(); },
  done: () => { $(id).dataset.q = ''; },
});

// Light poll: everyone names a sign; live bars show the top four.
function renderPoll(p) {
  if (Date.now() < pollReveal || !p) return;
  const m = $('poll');
  if (m.dataset.q !== p.q) {
    m.dataset.q = p.q;
    m.innerHTML = `<div class="k">🗳 Bình chọn vui</div><h2>${esc(p.q)}</h2><div class="bars"></div><p class="hint">Comment <b style="color:var(--accent)">tên cung</b> để bình chọn!</p>`;
    go(modal('poll', () => Boolean(S.hud?.poll) || Date.now() < pollReveal));
  }
  const rows = IDS.map(id => [id, p.votes[id]]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const top = Math.max(1, rows[0][1]);
  m.querySelector('.bars').innerHTML = rows.map(([id, n]) => `<div class="bar" style="--el:${color(id)}"><i style="transform:scaleX(${(n / top).toFixed(2)})"></i><span><span class="gf">${SIGN[id].glyph}\uFE0E</span> ${esc(SIGN[id].label)}</span><b>${n}</b></div>`).join('');
}
function revealPoll(e) {
  const m = $('poll');
  if (!e.winner || !m.dataset.q) { pollReveal = 0; return; }
  m.querySelector('.hint').innerHTML = `🎉 <b>${esc(SIGN[e.winner].label)}</b> được chọn nhiều nhất · ${e.votes}/${e.total} phiếu`;
  m.querySelector('.bars').firstElementChild?.classList.add('win');
  pollReveal = Date.now() + 3000;
  const [x, y] = nodePos(e.winner);
  burst(x, y, [color(e.winner), C.gold, C.paper], 60, 9);
}

function renderFortune(f) {
  if (!f) { if (shownFortune) { sfx('fortuneEnd'); shownFortune = null; } return; }
  const key = `${f.userId}|${f.sign}|${f.endsAt}`;
  if (key === shownFortune) return;
  shownFortune = key;
  sfx('fortune');
  const m = $('fortune'), s = SIGN[f.sign];
  m.innerHTML = `<div class="k">🎋 Quẻ hoàng đạo hôm nay</div>
    <div class="who"><img src="${mascot(f.sign, 'hype')}" alt=""><span>${f.nickname ? esc(f.nickname) + ' · ' : 'Quẻ chung cho '}<span class="gf">${s.glyph}\uFE0E</span> ${esc(s.label)}</span></div>
    <div class="lvl">${f.level}</div>
    <div class="lines"><p>❤️ ${esc(f.love)}</p><p>💼 ${esc(f.work)}</p><p>💰 ${esc(f.money)}</p><p>🍀 ${esc(f.luck)}</p></div>
    <div class="lucky"><span>Màu: ${esc(f.color)}</span><span>Số: ${f.number}</span>${f.hour ? `<span>Giờ vàng: ${esc(f.hour)}</span>` : ''}</div>
    <div class="fine">${f.tip ? `“${esc(f.tip)}” · ` : ''}chỉ mang tính giải trí</div>`;
  go(modal('fortune', () => Boolean(S.hud?.fortune)));
  const [x, y] = nodePos(f.sign);
  burst(x, y, [C.gold, C.paper, color(f.sign)], 40, 7);
  speak(`${f.nickname ? f.nickname : 'Cung ' + s.label}, quẻ hôm nay: ${f.level}. ${f.love} ${f.luck}`);
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
const signOf = userId => S.stage.find(v => v.userId === userId)?.sign;
const stars = e => Math.round(e.diamonds * (S.config.lightPerDiamond ?? 5));
const gain = (e, sign) => (sign ? `+${fmt(stars(e))} ánh sao cho ${esc(SIGN[sign].label)}` : 'comment tên cung để nhận ánh sao');
let lastFlowNote = 0;
let lastLikeNote = 0;
const G = id => `<span class="gf">${SIGN[id].glyph}︎</span>`;

// Sound for each effect (the same effects the director already rate-limits).
const sfx = createSfx(params.has('sfx') ? Number(params.get('sfx')) : 0.3);
const music = createMusic({ volume: params.has('music') ? Number(params.get('music')) : 0.22, onBlocked: () => { if (params.has('soundbtn')) $('sound').classList.add('on'); } }); // viewers cannot click the stream: the button is only for testing in a normal browser (?soundbtn=1)
addEventListener('pointerdown', () => music.resume(), { once: true }); // a normal browser tab still starts the music on the first click
$('sound').onclick = () => { music.resume(); sfx('welcome'); $('sound').classList.remove('on'); };
const SOUND = { 'gift-goal': 'meteor', wish: 'wish', lit: 'lit', 'wheel-complete': 'wheel', 'moon-full': 'moon', 'moon-end': 'moonEnd', 'lucky-start': 'lucky', 'lucky-end': 'luckyEnd', overtake: 'overtake', 'quiz-end': 'quiz', 'poll-start': 'pollStart', 'poll-end': 'poll', milestone: 'milestone', 'night-start': 'night', 'need-sign': 'boop', flows: 'flow', 'title-up': 'title', streak: 'streak', dance: 'dance',
  swaps: 'flow', 'boss-hits': 'bossHit', 'boss-start': 'bossStart', 'boss-freeze': 'boop', 'boss-rescue': 'lit', 'boss-blocked': 'follow', 'boss-heal': 'luckyEnd', 'boss-defeated': 'wheel', 'boss-escaped': 'moonEnd',
  'chaos-start': 'meteor', 'chaos-fixed': 'moon', 'chaos-end': 'luckyEnd', 'chest-open': 'chestOpen', cards: 'cardFlip', collection: 'title', 'set-complete': 'title',
  'wish-bless': 'sparkle', 'wish-blessed': 'lit', loots: 'sparkle', 'level-up': 'title', bag: 'boop', combine: 'lit', 'upgrade-need': 'boop',
  fans: 'milestone', 'fan-call': 'lucky', 'heat-up': 'overtake', demo: 'boop', 'switch-wait': 'boop',
  'birth-sky': 'lucky', 'star-born': 'starFly', showtime: 'milestone',
  'hour-start': 'hourStart', 'act-open': 'actOpen', 'head-start': 'headStart', 'head-end': 'actClose', 'act-close': 'actClose', pair: 'pair',
  'run-start': 'headStart', 'run-vote': 'boop', 'run-door': 'door', 'run-fight': 'bossStart', 'run-won': 'lit', 'run-boon': 'boon', 'run-attack': 'runHit',
  'run-down': 'fall', 'run-revive': 'revive', 'run-chest': 'chestOpen', 'run-rest': 'moon', 'run-event': 'sparkle', 'run-fled': 'moonEnd',
  'roast-start': 'spin', 'quest-done': 'cleared', 'tug-start': 'headStart', 'tug-yank': 'runHit', 'tug-end': 'cleared', 'predict-open': 'pollStart', 'predict-end': 'poll',
  bingo: 'cleared', 'bingo-card': 'cardFlip', 'pass-up': 'boon', 'pass-show': 'boop' };
const BIG = new Set(['meteor', 'wheel', 'moon', 'milestone', 'night', 'firework', 'hourStart', 'headStart', 'bossStart', 'fall', 'revive']); // the music ducks under these
const gold = C.gold;
function onFx(e) {
  let sound = e.type === 'gift' ? e.tier : SOUND[e.type], arg;
  if (e.type === 'joins') { sound = 'join'; arg = IDS.indexOf(e.people.at(-1).sign); }
  else if (e.type === 'hearts') sound = 'heart';
  else if (e.type === 'bells') sound = e.people[0].kind === 'share' ? 'share' : 'follow';
  else if (e.type === 'milestone' && e.count === 1) sound = 'welcome';
  if (e.type === 'gift' && e.count >= 5) sfx('combo', e.count);
  const MINOR = { dance: 'dance', flows: 'flow', 'title-up': 'title', streak: 'streak', overtake: 'overtake', wish: 'wish', hearts: 'hearts' };
  if (MINOR[e.type] && !on(MINOR[e.type])) sound = null;
  if (e.type === 'milestone' && ![1, 100].includes(e.count) && (!on('milestone') || e.count < 100)) sound = null;
  if (sound) { sfx(sound, arg); if (BIG.has(sound)) music.duck(); }
  switch (e.type) {
    case 'greeting': releaseGreeting(e); break;
    case 'joins': {
      const p = e.people.at(-1);
      // a switch is always shown (the viewer is waiting to see it worked); plain joins follow the panel's switch
      if (p.from) spotlight(`<div class="duo"><img src="${mascot(p.sign, 'hype')}" alt="">${avatarHtml(p, 'av big')}</div><div class="cap">${esc(p.nickname)}</div><div class="sub">đổi cung ${G(p.from)} ${esc(SIGN[p.from].label)} → ${G(p.sign)} ${esc(SIGN[p.sign].label)} ✓</div>`, 2200, 'join');
      else if (on('join')) spotlight(`<div class="duo"><img src="${mascot(p.sign, 'hype')}" alt="">${avatarHtml(p, 'av big')}</div><div class="cap">${esc(p.nickname)}</div><div class="sub">vào đội ${G(p.sign)} ${esc(SIGN[p.sign].label)} ✨${e.more ? ` · +${e.more} người` : ''}<br><small>nhầm? gõ “đổi” + tên cung</small></div>`, 1800, 'join');
      for (const q of e.people) { const [x, y] = nodePos(q.sign); burst(x, y, [color(q.sign), C.paper], 16, 5); }
      break;
    }
    case 'dance': {
      for (const id of e.userIds) dancing.set(id, Date.now() + 4000);
      const v = S.stage.find(x => x.userId === e.userIds[0]);
      if (v && on('dance')) spotlight(`<img src="${mascot(v.sign, 'hype')}" alt=""><div class="cap">${esc(v.nickname)}</div><div class="sub">💃 nhảy cùng cung ${esc(SIGN[v.sign].label)}${e.userIds.length > 1 ? ` · +${e.userIds.length - 1} người` : ''}</div>`, 1800, 'dance');
      break;
    }
    case 'hearts': {
      for (const h of e.from) { const [x, y] = spotOf(h.userId, signOf(h.userId)); hearts(x, y, 1 + (h.count / 15 | 0)); }
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
      if (on('wish')) card({ key: 'wish', icon: '🏮', title: `<b>${esc(e.nickname)}</b> thả đèn ước`, sub: `${e.text ? `“${esc(e.text)}” · ` : ''}cả nhà gõ “chúc” để chúc phúc 🙏`, color: e.sign ? color(e.sign) : C.gold, ms: 4200 });
      speak(e.text ? `${e.nickname} ước: ${e.text}` : `${e.nickname} thả một điều ước bí mật`);
      break;
    case 'wish-bless': blessLantern(e); break;
    case 'wish-blessed': {
      blessLantern(e, true);
      meteorShower(10);
      celebrate({ key: 'wish', badge: '🏮 ĐIỀU ƯỚC THÀNH SAO', extra: `<div class="wishstar">${avatarHtml(e, 'av big')}<b>${e.text ? `“${esc(e.text)}”` : 'điều ước bí mật ✨'}</b></div>`, title: esc(e.nickname), sub: `được ${e.count} người chúc phúc: ${e.blessers.map(esc).join(', ')} · +1 mảnh trăng 🌙`, color: '#FFE7A1', ms: 4400, compact: true });
      break;
    }
    // --- the bag: resources, levels, combining cards ---
    case 'loots': {
      const l = e.loot[0], r = RES[l.res];
      if (l.why === 'moon' && e.loot.length + e.more > 1) card({ key: 'loot', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `Cả sân nhận ${r.label}!`, sub: `${e.loot.length + e.more} người có mặt lúc trăng rằm · dùng để nâng cấp linh vật`, color: '#FFE7A1' });
      else card({ key: 'loot', icon: `<img class="resimg" src="${r.img}" alt="">`, title: `<b>${esc(l.nickname)}</b> nhận ${l.n} ${r.label}`, sub: `${LOOT_WHY[l.why] ?? ''}${e.loot.length + e.more > 1 ? ` · +${e.loot.length + e.more - 1} người nữa` : ''} · gõ “kho” để xem`, color: r.color, ms: 2600 });
      break;
    }
    case 'level-up': {
      const [x, y] = spotOf(e.userId, e.sign);
      burst(x, y, [LEVEL_COLOR[e.level], C.gold, C.paper], 90, 12);
      celebrate({ key: 'level', badge: `⬆ LÊN CẤP ${e.level}`, extra: `<div class="duo">${`<img src="${mascot(e.sign, 'win')}" alt="">`}${avatarHtml(e, 'av big')}</div>`, title: esc(e.nickname), sub: `linh vật ${esc(SIGN[e.sign].label)} Lv${e.level} · +${Math.round((S.config.levelBonus ?? 0.06) * (e.level - 1) * 100)}% ánh sao cho mọi hành động`, color: LEVEL_COLOR[e.level], ms: 3800, compact: true });
      break;
    }
    case 'upgrade-need':
      spotlight(`<div class="duo"><img src="${mascot(e.sign, 'panic')}" alt="">${avatarHtml(e, 'av big')}</div><div class="cap">${esc(e.nickname)} · Lv${e.level}</div><div class="sub">còn thiếu ${Object.entries(e.missing).map(([k, n]) => `${n} ${RES[k].label}`).join(', ')}</div>`, 2600, 'need');
      break;
    case 'bag':
      card({ key: 'bag', icon: avatarHtml(e, 'av'), title: `Kho của <b>${esc(e.nickname)}</b> · Lv${e.level}`, sub: `<span class="bagrow">${Object.entries(e.bag).filter(([, n]) => n).map(([k, n]) => `<img class="resimg sm" src="${RES[k].img}" alt="">${fmt(n)}`).join(' ') || 'trống'}</span>${e.next ? ` · lên Lv${e.level + 1}: ${e.next.dust} bụi, ${e.next.gems} ${RES[e.next.gem].label}${e.next.moon ? `, ${e.next.moon} mảnh trăng` : ''}` : e.level >= 5 ? ' · cấp tối đa 👑' : ' · chọn cung để nâng cấp'}`, color: C.gold, ms: 4200 });
      break;
    case 'combine':
      card({ key: 'card', icon: '🔮', title: `<b>${esc(e.nickname)}</b> ghép ${e.count} thẻ ${esc(SIGN[e.from].label)}`, sub: 'thành 1 thẻ Tinh Tú ✨', color: EDITION.star.color });
      break;
    case 'combine-need': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">cần ${e.need} thẻ Thường giống nhau để ghép — chờ rương sao nhé!</div>`, 2200, 'need'); break;
    case 'gift': {
      const sign = e.sign ?? signOf(e.userId), [x, y] = spotOf(e.userId, sign), col = sign ? color(sign) : gold;
      const what = esc(e.giftName ?? 'quà'), who = esc(e.nickname);
      // The gift is the headline, the sender is the credit line — a gift should never read as a quiet note.
      // Bigger gifts show the gift, the sender's face and the count over the whole wheel.
      const extra = `<div class="gimg">${giftPic(e)}</div>${e.count > 1 ? `<div class="x">x${e.count}</div>` : ''}<div class="giver">${e.avatar ? `<img src="${esc(e.avatar)}" alt="">` : ''}<span>${who}</span></div>`;
      if (e.tier === 'sparkle') {
        burst(x, y, [col, gold, C.paper], 30, 7);
        giftCard(e, sign);
      } else if (e.tier === 'firework') {
        for (let i = 0; i < 4; i++) setTimeout(() => burst(rnd(180, 900), rnd(440, 1000), [col, gold, C.paper, C.accent], 80, 12), i * 260);
        dancing.set(e.userId, Date.now() + 4000);
        celebrate({ key: 'firework', badge: '🎁 QUÀ TẶNG', extra, title: what, sub: gain(e, sign), color: col, ms: 3600, compact: true });
      } else {
        meteorShower();
        dancing.set(e.userId, Date.now() + 5000);
        celebrate({ key: 'meteor', badge: '☄ MƯA SAO BĂNG', extra, title: what, sub: gain(e, sign), color: col, ms: 4200 });
        speak(`Cảm ơn ${e.nickname} đã gọi mưa sao băng`);
      }
      break;
    }
    case 'flows':
      for (const f of e.flows.slice(0, 4)) comet(f.from, f.to);
      if (on('flow') && Date.now() - lastFlowNote > 7000) { lastFlowNote = Date.now(); const f = e.flows[0]; spotlight(`<div class="cap">${G(f.from)} → ${G(f.to)}</div><div class="sub">${esc(SIGN[f.from].label)} đã sáng, ánh sao dư chảy sang ${esc(SIGN[f.to].label)} 💫</div>`, 2200, 'flow'); }
      break;
    case 'lit': {
      const [x, y] = nodePos(e.sign);
      burst(x, y, [color(e.sign), gold, C.paper], 90, 12);
      card({ key: `lit-${e.sign}`, icon: `<span class="gf">${SIGN[e.sign].glyph}\uFE0E</span>`, title: `<b>${esc(SIGN[e.sign].label)}</b> đã sáng!`, sub: e.by !== e.sign ? `nhờ ánh sao từ ${G(e.by)} ${esc(SIGN[e.by].label)} 💫` : 'rực rỡ nhờ chính các bạn', color: color(e.sign), ms: 3000 });
      break;
    }
    case 'wheel-complete': {
      const [w, s2, s3] = e.podium.map(r => SIGN[r.id]);
      celebrate({ key: 'wheel', badge: `VÒNG ${e.no}`, mascotSign: e.winner ?? 'leo', glyphs: IDS.map(id => SIGN[id].glyph + '\uFE0E').join(''), title: 'VÒNG HOÀNG ĐẠO ĐÃ TRỌN!', sub: `👑 ${esc(w.label)} rực rỡ nhất · 2. ${esc(s2.label)} · 3. ${esc(s3.label)}${e.crowned ? ` · ${e.crowned} fan nhận huy hiệu` : ''}`, ms: 5200 });
      meteorShower(30);
      for (let i = 0; i < 8; i++) setTimeout(() => burst(rnd(150, 930), rnd(400, 1000), [gold, C.paper, C.accent, C.teal], 90, 13), i * 280);
      speak('Vòng hoàng đạo đã trọn, cảm ơn cả nhà');
      break;
    }
    case 'title-up': if (on('title')) card({ key: 'title', icon: '🌟', title: `<b>${esc(e.nickname)}</b> lên hạng!`, sub: `danh hiệu mới: ${esc(e.title)}`, color: color(e.sign) }); break;
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
    case 'need-sign':
      spotlight(`<div class="duo"><img src="${mascot('leo', 'idle')}" alt="">${avatarHtml(e, 'av big')}</div><div class="cap">${esc(e.nickname)}</div><div class="sub">chọn cung trước đã: comment tên cung hoặc ngày sinh, rồi ${NEED_FOR[e.for] ?? 'gõ lại lệnh'} nhé!</div>`, 2400, 'need');
      break;
    case 'switch-wait': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">${e.frozen ? `${esc(SIGN[e.sign].label)} đang bị đóng băng — phá băng xong mới đổi cung được` : `vừa đổi cung rồi — ${e.seconds} giây nữa mới đổi sang ${esc(SIGN[e.to].label)} được nhé`}</div>`, 2200, 'need'); break;
    case 'fan-call-wait': spotlight(`<div class="cap">${esc(e.nickname)}</div><div class="sub">đang có sao may mắn — ${e.seconds} giây nữa gõ lại “gọi sao” nhé ♥</div>`, 2200, 'need'); break;
    // --- fan club ---
    case 'fans': {
      const f = e.fans[0];
      burst(CX, 420, [FAN_GOLD, '#c43c6a', C.paper], 60, 10);
      celebrate({ key: 'fan', badge: f.level ? `♥ FANCLUB${f.club ? ` ${esc(f.club.toUpperCase())}` : ''} · LV ${f.level}` : '★ NGƯỜI ĐĂNG KÝ', extra: `<div class="duo">${f.sign ? `<img src="${mascot(f.sign, 'hype')}" alt="">` : ''}${avatarHtml(f, 'av big fanring')}</div>`, title: `${esc(f.nickname)} đã đến!`, sub: `${e.fans.length + e.more > 1 ? `cùng ${e.fans.length + e.more - 1} thành viên nữa · ` : ''}thành viên được +ánh sao và “gọi sao” 1 lần mỗi đêm`, color: FAN_GOLD, ms: 3400, compact: true });
      break;
    }
    case 'fan-call': {
      const [x, y] = nodePos(e.sign);
      beam(e.sign, FAN_GOLD);
      burst(x, y, [FAN_GOLD, C.paper], 80, 11);
      card({ key: 'fan-call', icon: avatarHtml(e, 'av'), title: `<b>${esc(e.nickname)}</b> gọi sao may mắn!`, sub: `đặc quyền fanclub · ${esc(SIGN[e.sign].label)} được ánh sao x2`, color: FAN_GOLD, ms: 3200 });
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
      const [x, y] = nodePos(e.sign);
      burst(x, y, [color(e.sign), gold], 30, 7);
      if (on('overtake')) card({ key: 'overtake', icon: '🚀', title: `<b>${esc(SIGN[e.sign].label)}</b> vượt lên hạng 1!`, sub: `vượt ${G(e.from)} ${esc(SIGN[e.from].label)}`, color: color(e.sign) });
      break;
    }
    case 'lucky-start': {
      const [x, y] = nodePos(e.sign);
      burst(x, y, [gold, C.paper], 40, 8);
      celebrate({ key: 'lucky', badge: 'SAO MAY MẮN', icon: '⭐', title: `${esc(SIGN[e.sign].label)} · ánh sao x${e.multiplier}`, sub: `trong ${e.seconds} giây — comment ngay!`, color: gold, ms: 3000, compact: true });
      speak(`Sao may mắn: ${SIGN[e.sign].label}`);
      break;
    }
    case 'streak': if (on('streak')) card({ key: 'streak', icon: '🔥', title: `<b>${esc(e.nickname)}</b> trở lại!`, sub: `chuỗi ${e.streak} đêm · +${e.amount} ánh sao`, color: color(e.sign) }); break;
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
    // --- Thủy Nghịch ---
    case 'chaos-start':
      celebrate({ key: 'chaos', badge: e.real ? '☿ SAO THỦY ĐANG NGHỊCH HÀNH THẬT' : '☿ THỦY NGHỊCH', icon: '🌀', title: 'Ánh sao đi lạc sang đối cung!', sub: `${e.need} người gõ “thuận” để sửa sóng · ${e.seconds} giây`, color: '#B48CF2', ms: 3800 });
      speak('Thủy nghịch! Gõ thuận để sửa sóng');
      break;
    case 'swaps': for (const s of e.swaps.slice(0, 4)) comet(s.from, s.to); break;
    case 'chaos-fixed':
      burst(CX, CY, ['#B48CF2', C.gold, C.paper], 90, 12);
      celebrate({ key: 'chaos', badge: 'ĐÃ SỬA SÓNG', icon: '✨', title: 'Thuận hành trở lại!', sub: `nhờ ${e.fixers.map(esc).join(', ')}${e.count > e.fixers.length ? ` và ${e.count - e.fixers.length} người nữa` : ''} · +${S.config.chaosFixLight} ánh sao mỗi người`, color: '#B48CF2', ms: 3200, compact: true });
      break;
    case 'chaos-end': card({ key: 'chaos', icon: '☿', title: 'Thủy Nghịch đã qua', sub: 'ánh sao về đúng cung của mình', color: '#B48CF2' }); break;
    // --- Sao Chổi Đen ---
    case 'boss-start':
      quake();
      celebrate({ key: 'boss', badge: '☄ BOSS XUẤT HIỆN', extra: '<img class="bossimg" src="/art/boss.svg" alt="">', title: 'SAO CHỔI ĐEN!', sub: `${fmt(e.hp)} máu · ${e.seconds} giây · Lửa: chí mạng · Đất: khiên · Khí: combo · Nước: tim x3`, color: '#E97A66', ms: 4200 });
      speak('Sao chổi đen xuất hiện! Cả nhà cùng đánh');
      break;
    case 'boss-hits':
      for (const [sign, dmg] of Object.entries(e.bySign).slice(0, 6)) shoot(sign, dmg, e.hits.some(h => h.sign === sign && h.crit));
      break;
    case 'boss-freeze': {
      const [x, y] = nodePos(e.sign);
      beam(e.sign, '#9fd3ff');
      quake();
      burst(x, y, ['#9fd3ff', '#ffffff'], 50, 8);
      card({ key: 'boss-freeze', icon: '❄️', title: `<b>${esc(SIGN[e.sign].label)}</b> bị đóng băng!`, sub: `fan ${esc(SIGN[e.sign].label)} comment ngay để phá băng (cần ${e.need}) · ${e.seconds}s`, color: '#9fd3ff', ms: 3400 });
      break;
    }
    case 'boss-rescue': {
      const [x, y] = nodePos(e.sign);
      burst(x, y, [color(e.sign), C.gold, C.paper], 60, 10);
      card({ key: 'boss-freeze', icon: '🔥', title: `<b>${esc(e.nickname)}</b> phá băng!`, sub: `${esc(SIGN[e.sign].label)} chiến đấu tiếp`, color: color(e.sign) });
      break;
    }
    case 'boss-blocked': beam(e.sign, ELEMENT.earth.color, true); card({ key: 'boss-freeze', icon: '🛡️', title: 'Khiên Đất chặn đòn!', sub: `Sao Chổi nhắm vào ${esc(SIGN[e.sign].label)} nhưng hụt`, color: ELEMENT.earth.color }); break;
    case 'boss-heal': card({ key: 'boss-freeze', icon: '💜', title: 'Sao Chổi hồi máu…', sub: `+${fmt(e.heal)} vì không ai phá băng cho ${esc(SIGN[e.sign].label)}`, color: '#B48CF2' }); break;
    case 'boss-defeated': {
      meteorShower(30);
      for (let i = 0; i < 8; i++) setTimeout(() => burst(rnd(150, 930), rnd(400, 1100), [gold, C.paper, C.accent, C.teal], 90, 13), i * 260);
      const mvps = ['fire', 'earth', 'air', 'water'].filter(el => e.mvps[el]).map(el => `${EL_NAME[el]}: ${esc(e.mvps[el].nickname)}`).join(' · ');
      celebrate({ key: 'boss', badge: '🏆 HẠ SAO CHỔI ĐEN', mascotSign: e.mvp?.sign ?? 'leo', title: e.mvp ? `MVP: ${esc(e.mvp.nickname)}` : 'Cả phòng chiến thắng!', sub: `${e.fighters} người góp sức trong ${e.seconds}s · ${mvps} · ai cũng được +${e.reward} ánh sao và 1 thẻ${e.finisher ? ` · cú kết liễu: ${esc(e.finisher.nickname)}` : ''}`, ms: 5600 });
      speak(e.mvp ? `Hạ sao chổi đen! MVP là ${e.mvp.nickname}` : 'Hạ sao chổi đen!');
      break;
    }
    case 'boss-escaped': celebrate({ key: 'boss', badge: 'SAO CHỔI TRỐN THOÁT', icon: '💨', title: 'Nó sẽ quay lại…', sub: `còn ${Math.round(e.hpShare * 100)}% máu — lần sau cả nhà gọi thêm đồng đội nhé`, color: '#B48CF2', ms: 3400, compact: true }); break;
    // --- the star chest and the cards ---
    case 'chest-open':
      celebrate({ key: 'chest', badge: '🎁 RƯƠNG SAO', extra: '<img class="chestimg big" src="/art/chest-open.svg" alt="">', title: 'Rương sao đã mở!', sub: `gõ “nhận” trong ${e.seconds} giây — mỗi người một thẻ, có thẻ hiếm`, color: gold, ms: 3000, compact: true });
      break;
    case 'cards': {
      // a foil card gets a celebration; a star card an announcement; plain ones just show in the open chest
      const best = e.cards.reduce((a, b) => (EDITION[b.card.edition].rarity > EDITION[a.card.edition].rarity ? b : a));
      const ed = EDITION[best.card.edition];
      if (ed.rarity >= 3) {
        meteorShower(12);
        celebrate({ key: 'card', badge: `THẺ ${ed.label.toUpperCase()}`, extra: `<div class="cards">${cardHtml(best.card, { big: true })}</div>`, title: esc(best.nickname), sub: `${best.isNew ? 'thẻ mới! · ' : ''}bộ sưu tập ${best.unique}/${CARD_TOTAL}`, color: ed.color, ms: 4200, compact: true });
      } else if (ed.rarity === 2 || !S.cosmos?.chest.open) {
        card({ key: 'card', icon: cardHtml(best.card), title: `<b>${esc(best.nickname)}</b> nhận thẻ ${esc(ed.label)}`, sub: `${esc(SIGN[best.card.sign].label)}${best.isNew ? ' · thẻ mới!' : ''} · bộ sưu tập ${best.unique}/${CARD_TOTAL}${best.why === 'chest' && best.pityLeft <= 3 ? ` · còn ${best.pityLeft} lần tới Hoàng Kim` : ''}${e.more ? ` · +${e.more} người nữa` : ''}`, color: ed.color, ms: 3000 });
      }
      break;
    }
    case 'collection': {
      const best = e.best && EDITION[e.best.edition];
      card({ key: 'collection', icon: e.best ? cardHtml(e.best) : '🃏', title: `Bộ thẻ của <b>${esc(e.nickname)}</b>: ${e.unique}/${e.total}`, sub: e.unique ? `hiếm nhất: ${esc(best.label)} · ${esc(SIGN[e.best.sign].label)}${e.setDone ? ' · đủ 12 cung 🏆' : ''}` : 'chưa có thẻ — chờ rương sao rồi gõ “nhận” nhé!', color: best?.color ?? C.teal, ms: 3600 });
      break;
    }
    case 'set-complete':
      celebrate({ key: 'card', badge: '🏆 ĐỦ 12 CUNG', icon: '🃏', title: esc(e.nickname), sub: 'đã gom đủ thẻ cả 12 cung hoàng đạo!', color: gold, ms: 4200, compact: true });
      break;
    // --- bầu trời ngày sinh, the named stars and the big moment every ~75 s ---
    case 'birth-sky': birthSky(e); break;
    case 'star-born': {
      fly(e.userId, spotOf(e.userId, e.sign), starPoint(e), color(e.sign), e.nickname, 0.6);
      card({ key: 'star', icon: '⭐', title: `<b>${esc(e.nickname)}</b> có ngôi sao riêng!`, sub: 'sao mang tên bạn ở bầu trời cộng đồng phía dưới · quay lại là sao sáng lên ✨', color: color(e.sign), ms: 3200 });
      break;
    }
    case 'showtime':
      if (e.kind === 'starcall') {
        // no celebration here: the named stars themselves fly across the wheel, and a card would only hide them
        e.people.forEach((p, i) => fly(p.userId, [rnd(140, 940), WHEEL_T + 40], starPoint(p), color(p.sign), p.nickname, i * 0.3));
        meteorShower(8);
        card({ key: 'show', icon: '🌟', title: `Điểm danh sao · <b>${e.people.length}</b> ngôi sao đang sáng`, sub: `${e.people.slice(0, 5).map(p => esc(p.nickname)).join(' · ')}${e.people.length > 5 ? ` · +${e.people.length - 5}` : ''} · chưa có sao? comment tên cung`, color: gold, ms: 4800 });
      } else {
        meteorShower(30);
        celebrate({ key: 'show', badge: '☄ MƯA SAO BĂNG', icon: '🌠', title: 'Mưa sao định kỳ!', sub: 'comment ngày sinh đủ năm, vd “12/8/1998”, để xem bầu trời ngày bạn chào đời', color: gold, ms: 3800, compact: true });
      }
      break;
    // --- giờ hành tinh: a new hour, the 15-minute acts, their headliners ---
    case 'hour-start':
      meteorShower(16);
      celebrate({ key: 'hour', badge: `${e.glyph} GIỜ ${e.label.toUpperCase()}`, icon: `<span class="gf">${e.glyph}</span>`, title: `Giờ ${esc(e.label)} · ${esc(e.theme)}`, sub: `${esc(e.rule)} · sự kiện chính: ${esc(e.head)}<br>tiếp theo: ${e.next.glyph} Giờ ${esc(e.next.label)} · ${esc(e.next.head)}`, color: e.color, ms: 5200 });
      speak(`Bắt đầu giờ ${e.label}`);
      break;
    case 'act-open':
      card({ key: 'act', icon: `<span class="gf">${e.hour.glyph}</span>`, title: `Màn ${e.no}/${e.of} · Giờ ${esc(e.hour.label)}`, sub: `★ ${esc(e.hour.head)} sau ${mmss(e.headInMs)} · ${esc(e.hour.rule)}`, color: e.hour.color, ms: 4200 });
      break;
    case 'head-start':
      if (['run', 'elite', 'tug', 'roast', 'chaos'].includes(e.id)) break; // these announce themselves
      celebrate({ key: 'head', badge: '★ SỰ KIỆN CHÍNH', icon: HEAD_ICON[e.id] ?? '★', title: esc(e.label), sub: HEAD_HOW[e.id] ?? '', color: S.cosmos?.hour?.color ?? gold, ms: 4200, compact: true });
      break;
    case 'head-end':
      if (e.id === 'final' && e.winner) {
        const [x, y] = nodePos(e.winner);
        burst(x, y, [gold, C.paper, color(e.winner)], 90, 12);
        celebrate({ key: 'head', badge: '👑 CHUNG KẾT ĐUA SAO', mascotSign: e.winner, title: `${esc(SIGN[e.winner].label)} đội vương miện!`, sub: `góp nhiều ánh sao nhất trong chung kết${e.fans ? ` · ${e.fans} fan có mặt nhận huy hiệu 👑` : ''}`, ms: 4800 });
      } else if (e.id === 'quizchain' && e.best) card({ key: 'head', icon: '🧠', title: `<b>${esc(e.best.nickname)}</b> đúng ${e.best.streak} câu liền!`, sub: 'vua đố nhanh của màn · +2 ngọc', color: '#B48CF2', ms: 3600 });
      break;
    case 'act-close': {
      if (!e.top.length) break;
      const m = e.top[0];
      celebrate({ key: 'act', badge: '🎬 KẾT MÀN', extra: `<div class="duo">${m.sign ? `<img src="${mascot(m.sign, 'win')}" alt="">` : ''}${avatarHtml(m, 'av big')}</div>`, title: `MVP: ${esc(m.nickname)}`, sub: `+${fmt(m.light)} ánh sao trong màn${e.top[1] ? ` · 2. ${esc(e.top[1].nickname)}` : ''}${e.top[2] ? ` · 3. ${esc(e.top[2].nickname)}` : ''}<br>tiếp theo: ${e.next.glyph} ${e.next.newHour ? `Giờ ${esc(e.next.label)} · ` : ''}${esc(e.next.head)}`, color: S.cosmos?.hour?.color ?? gold, ms: 4600, compact: true });
      break;
    }
    case 'pair': {
      const [ax, ay] = spotOf(e.a.userId, e.a.sign), [bx, by] = spotOf(e.b.userId, e.b.sign);
      hearts(ax, ay, 3); hearts(bx, by, 3);
      celebrate({ key: 'pair', badge: '💞 GHÉP ĐÔI ĐỊNH MỆNH', extra: `<div class="pairfx">${avatarHtml(e.a, 'av big')}<b>${e.score}%</b>${avatarHtml(e.b, 'av big')}</div>`, title: `${esc(e.a.nickname)} × ${esc(e.b.nickname)}`, sub: `${G(e.a.sign)} ${esc(SIGN[e.a.sign].label)} × ${G(e.b.sign)} ${esc(SIGN[e.b.sign].label)} · ${esc(e.line)}`, color: '#F2A7C3', ms: 4200, compact: true });
      break;
    }
    // --- kéo co, dự đoán, bingo, sổ sao ---
    case 'tug-start':
      celebrate({ key: 'tug', badge: '🪢 KÉO CO CUNG', icon: '🪢', title: `${esc(SIGN[e.a].label)} ⟷ ${esc(SIGN[e.b].label)}`, sub: `fan hai cung comment · thả tim để kéo · ai cũng đoán được: gõ “đoán A” / “đoán B”`, color: color(e.a), ms: 3600, compact: true });
      break;
    case 'tug-yank': {
      quake();
      const [x, y] = spotOf(e.userId, e.sign);
      burst(x, y, [color(e.sign), C.gold, C.paper], 60, 11);
      floats.push({ x: CX, y: CY + 150 * Z, t: 0, text: `${e.nickname} giật mạnh!`, col: C.gold });
      break;
    }
    case 'tug-end':
      if (!e.winner) { card({ key: 'tug', icon: '🪢', title: 'Kéo co hoà!', sub: 'hai cung ngang sức ngang tài', color: C.teal }); break; }
      burst(CX, CY, [color(e.winner), C.gold, C.paper], 90, 12);
      celebrate({ key: 'tug', badge: e.early ? '🪢 KÉO SẬP DÂY!' : '🪢 THẮNG KÉO CO', mascotSign: e.winner, mood: 'win', title: `${esc(SIGN[e.winner].label)} thắng!`, sub: `${e.pullers} người cùng kéo${(e.winner === e.a ? e.mvpA : e.mvpB) ? ` · lực sĩ: ${esc((e.winner === e.a ? e.mvpA : e.mvpB).nickname)}` : ''} · +${S.config.tugWinLight ?? 20} ánh sao cho đội thắng`, color: color(e.winner), ms: 4200, compact: true });
      break;
    case 'predict-open': card({ key: 'predict', icon: '🔮', title: esc(e.q), sub: `gõ “đoán A” (${esc(e.options[0])}) hoặc “đoán B” (${esc(e.options[1])}) · ${e.seconds}s · đoán đúng được bụi sao`, color: '#B48CF2', ms: 4200 }); break;
    case 'predict-end':
      if (e.winner === null) break;
      card({ key: 'predict', icon: '🔮', title: `Đáp án: <b>${esc(e.answer)}</b>`, sub: `${e.right}/${e.guesses} người đoán trúng${e.top[0] ? ` · ${esc(e.top[0][0])} +${e.top[0][1]} bụi sao` : ''}`, color: '#B48CF2', ms: 3600 });
      break;
    case 'bingo':
      burst(CX, CY, [C.gold, C.paper, color(e.sign)], 70, 11);
      celebrate({ key: 'bingo', badge: e.full ? '🎉 BINGO TRỌN THẺ!' : `🎉 BINGO${e.lines > 1 ? ` x${e.lines}` : ''}!`, extra: bingoGrid(e.card), title: esc(e.nickname), sub: e.full ? 'cả thẻ đã kín · +1 mảnh trăng' : '+1 ngọc · gõ “bingo” để xem thẻ của bạn', color: C.gold, ms: 3600, compact: true });
      break;
    case 'bingo-card': card({ key: 'bingo', icon: bingoGrid(e.card), title: `Thẻ bingo của <b>${esc(e.nickname)}</b>`, sub: `${e.marked}/9 ô${e.lines ? ` · ${e.lines} hàng` : ''} · ở lại để kín thẻ`, color: C.gold, ms: 4200, kind: 'bingocard' }); break;
    case 'pass-up':
      if (e.frame) celebrate({ key: 'pass', badge: `📒 SỔ SAO CẤP ${e.level}`, extra: `<div class="duo">${avatarHtml(e, `av big frame-${e.frame}`)}</div>`, title: esc(e.nickname), sub: `nhận ${esc(e.reward)}`, color: FRAME_COLOR[e.frame], ms: 3600, compact: true });
      else if (on('title')) card({ key: 'pass', icon: '📒', title: `<b>${esc(e.nickname)}</b> lên Sổ Sao cấp ${e.level}`, sub: `nhận ${esc(e.reward)}`, color: color(e.sign), ms: 2400 });
      break;
    case 'pass-show': card({ key: 'pass', icon: '📒', title: `Sổ Sao của <b>${esc(e.nickname)}</b>: cấp ${e.level}/${e.max}`, sub: `${e.xp}/${e.need} kinh nghiệm${e.next ? ` · cấp sau: ${esc(e.next)}` : ' · đã tối đa 👑'}`, color: C.gold, ms: 3600 }); break;
    // --- vòng quay bóc phốt and the hour's quest ---
    case 'roast-start': roastWheel(e); break;
    case 'roast-end': {
      const s = SIGN[e.sign], [x, y] = nodePos(e.sign);
      if (e.cleared) {
        sfx('cleared'); burst(x, y, [color(e.sign), C.gold, C.paper], 80, 11);
        celebrate({ key: 'roast', badge: '✅ MINH OAN THÀNH CÔNG', mascotSign: e.sign, mood: 'win', title: `${esc(s.label)} trong sạch!`, sub: `${e.names.map(esc).join(', ')}${e.protests > e.names.length ? ` +${e.protests - e.names.length}` : ''} đã minh oan · +${S.config.roastClearLight ?? 15} ánh sao mỗi người`, color: color(e.sign), ms: 3800, compact: true });
      } else {
        sfx('laugh');
        celebrate({ key: 'roast', badge: '😂 PHỐT ĐƯỢC XÁC NHẬN', mascotSign: e.sign, mood: 'panic', title: `${esc(s.label)}… đúng là vậy!`, sub: `${e.agree ? `${e.agree} người gõ “chuẩn” · ` : ''}${e.consoled ? `an ủi: ${esc(s.label)} được sao may mắn x2 ✨` : 'lần sau nhớ gõ “oan” nhé'}`, color: color(e.sign), ms: 3800, compact: true });
      }
      break;
    }
    case 'quest-done':
      meteorShower(24);
      for (let i = 0; i < 5; i++) setTimeout(() => burst(rnd(150, 930), rnd(WHEEL_T + 60, LAYOUT.wheelB - 60), [e.color, C.gold, C.paper], 80, 12), i * 240);
      celebrate({ key: 'quest', badge: `${e.glyph} NHIỆM VỤ GIỜ HOÀN THÀNH`, icon: '🏆', title: `Đủ ${fmt(e.goal)} ${esc(e.unit)}!`, sub: `${esc(e.reward)} · ${e.people} người có mặt`, color: e.color, ms: 4600 });
      speak('Nhiệm vụ giờ hoàn thành');
      break;
    // --- Hành trình Tầng Trời ---
    case 'run-start':
      celebrate({ key: 'run', badge: '♄ HÀNH TRÌNH TẦNG TRỜI', icon: '🪐', title: `Lượt ${e.no} · ${e.floors} tầng${e.ascension ? ` · Thăng thiên ${e.ascension}` : ''}`, sub: `cả phòng là một đoàn · gõ <b>A/B/C</b> để chọn cửa · comment, thả tim để đánh${e.best ? ` · kỷ lục kênh: tầng ${e.best}` : ''}`, color: '#8EC0B9', ms: 4600 });
      speak('Hành trình tầng trời bắt đầu');
      break;
    case 'run-door': card({ key: 'run', icon: e.icon, title: `Tầng ${e.floor}/${e.of}: <b>${esc(e.label)}</b>`, sub: RUN_DOOR_HOW[e.door] ?? '', color: '#8EC0B9', ms: 2600 }); break;
    case 'run-fight': quake(); card({ key: 'run', icon: e.door === 'boss' ? '🪐' : e.door === 'elite' ? '💀' : '⚔️', title: `<b>${esc(e.name)}</b> chặn đường!`, sub: `${fmt(e.hp)} máu · ${e.seconds} giây · comment · thả tim để đánh`, color: '#E97A66', ms: 3000 }); break;
    case 'run-won':
      burst(CX, CY, [gold, C.paper, C.teal], 70, 11);
      card({ key: 'run', icon: '⚔️', title: `Hạ <b>${esc(e.name)}</b>!`, sub: `${e.mvp ? `MVP ${esc(e.mvp.nickname)} · ${fmt(e.mvp.dmg)} sát thương` : 'cả đoàn cùng đánh'}${e.finisher ? ` · kết liễu: ${esc(e.finisher.nickname)}` : ''}`, color: gold, ms: 2800 });
      break;
    case 'run-boon':
      celebrate({ key: 'run', badge: 'ẤN CHÒM SAO', icon: `<span class="gf">${SIGN[e.sign].glyph}︎</span>`, title: esc(e.label), sub: `${esc(e.text)} · fan ${esc(SIGN[e.sign].label)} đánh +50%${e.resonance.length ? `<br>✦ ${e.resonance.map(r => `${esc(r.label)}: ${esc(r.text)}`).join(' · ')}` : ''}`, color: color(e.sign), ms: 3600, compact: true });
      break;
    case 'run-attack':
      if (e.dmg) { quake(); floats.push({ x: CX, y: CY + 120 * Z, t: 0, text: `Đoàn -${fmt(e.dmg)}`, col: C.accent }); }
      else floats.push({ x: CX, y: CY + 120 * Z, t: 0, text: e.blocked === 'capricorn' ? 'Ma Kết chặn đòn!' : 'Khiên Đất chặn đòn!', col: '#9fd3ff' });
      break;
    case 'run-crit': floats.push({ x: CX + rnd(-120, 120) * Z, y: CY - 60 * Z, t: 0, text: `${e.nickname} -${fmt(e.dmg)}!`, col: C.gold }); break;
    case 'run-down':
      celebrate({ key: 'run', badge: '💀 ĐOÀN GỤC NGÃ', icon: '🕯️', title: 'Gõ “hồi sinh”!', sub: `cần ${e.need} người trong ${e.seconds} giây — chỉ một lần mỗi hành trình`, color: '#B48CF2', ms: 3200, compact: true });
      break;
    case 'run-revive':
      burst(CX, CY, [C.gold, C.paper, '#B48CF2'], 90, 12);
      card({ key: 'run', icon: '✨', title: e.free ? 'Ấn Song Ngư hồi sinh cả đoàn!' : 'Cả đoàn đứng dậy!', sub: e.free ? `máu ${e.hp}/${e.max}` : `nhờ ${e.names.map(esc).join(', ')}${e.count > e.names.length ? ` +${e.count - e.names.length}` : ''}`, color: gold, ms: 3200 });
      break;
    case 'run-chest': card({ key: 'run', icon: '🎁', title: 'Rương tầng trời!', sub: `${e.people} lữ khách mỗi người +1 ngọc`, color: gold }); break;
    case 'run-rest': card({ key: 'run', icon: '🔥', title: `Đền nghỉ: hồi ${e.heal} máu`, sub: `đoàn còn ${e.hp}/${e.max}`, color: '#ff9f43' }); break;
    case 'run-fled': quake(); card({ key: 'run', icon: '💨', title: `<b>${esc(e.name)}</b> trốn thoát`, sub: `đoàn mất ${e.dmg} máu · còn ${e.hp}/${e.max}`, color: '#B48CF2' }); break;
    case 'run-event': card({ key: 'run', icon: '❓', title: esc(e.title ?? 'Kỳ ngộ'), sub: `${esc(e.choice)}${e.curse ? ` · mang ${esc(e.curse.label)}` : ''}`, color: e.curse ? '#B48CF2' : C.teal, ms: 3400 }); break;
    case 'run-end':
      sfx(e.cleared ? 'cleared' : 'fall');
      if (e.cleared) { meteorShower(34); for (let i = 0; i < 6; i++) setTimeout(() => burst(rnd(150, 930), rnd(WHEEL_T + 80, LAYOUT.wheelB - 80), [gold, C.paper, C.accent, C.teal], 90, 13), i * 260); }
      celebrate({ key: 'run', badge: e.cleared ? '🏆 CHINH PHỤC TẦNG TRỜI' : '🕳 HẾT HÀNH TRÌNH', mascotSign: e.mvp?.sign ?? 'capricorn', mood: e.cleared ? 'win' : 'panic',
        title: e.cleared ? `Thăng thiên ${e.ascension}!` : `Dừng ở tầng ${e.floor}/${e.of}`,
        sub: `${e.fighters} lữ khách${e.mvp ? ` · MVP ${esc(e.mvp.nickname)}` : ''} · kỷ lục kênh: tầng ${e.best}${e.reward ? ` · mỗi người +${e.reward} ánh sao` : ''}${e.unlocked ? `<br>🔓 mở khoá ${esc(e.unlocked.label)}: ${esc(e.unlocked.text)}` : ''}`, ms: 5600 });
      break;
  }
}

let offlineTimer = null;
subscribe({
  meta: m => { const first = !S.signs.length; Object.assign(S, { signs: m.signs, config: m.config, planets: m.planets ?? [], roles: m.roles ?? {} }); if (m.music) music.setLists(m.music); if (first) build(); },
  cmd: c => { if (c.type === 'music-skip') music.skip(); else if (c.type === 'music-mute') music.toggleMute(); },
  frame: f => {
    if (!S.signs.length) return;
    const p = f.parts;
    if (p.sky) { S.sky = p.sky; renderSky(p.sky); }
    if (p.stage) { S.stage = p.stage; hereIds = new Set(p.stage.map(v => v.userId)); renderStage(p.stage); if (arenaMode === 'boss' && S.cosmos) renderArena(S.cosmos); }
    if (p.stars) S.stars = p.stars;
    if (p.thanks) S.thanks = p.thanks;
    if (p.gifts) renderGifts(p.gifts);
    if (p.lobby) { S.lobby = p.lobby; renderLobby(p.lobby); renderCall(); }
    if (p.race) { S.race = p.race; renderRace(p.race); }
    if (p.hud) { S.hud = p.hud; renderHud(p.hud); }
    if (p.cosmos) renderCosmos(p.cosmos);
    for (const e of f.fx) onFx(e);
  },
}, ok => {
  clearTimeout(offlineTimer);
  if (ok) $('conn').classList.remove('on');
  else offlineTimer = setTimeout(() => $('conn').classList.add('on'), 4000);
});
