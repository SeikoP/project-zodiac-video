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
import { EDITION } from '/cards.js';

const $ = id => document.getElementById(id);
const C = { paper: '#F6F0E6', gold: '#F2C45C', accent: '#E97A66', teal: '#8EC0B9' };
const params = new URLSearchParams(location.search);
if (params.has('transparent')) document.body.classList.add('transparent');
const FPS = Math.min(60, Math.max(15, Number(params.get('fps')) || 30));

// The layout uses the whole live frame: TikTok's live chrome is mostly see-through, so there is no safe box.
const stage = $('stage');
if (params.has('audit')) import('/audit.js').then(m => m.startAudit());
let K = 1, canvasReady = false; // canvas pixels per stage pixel: 2 when the source is rendered at or above 1080 wide (or on a HiDPI screen)
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(innerWidth - 1080 * s) / 2}px`;
  const k = s * (devicePixelRatio || 1) > 0.75 ? 2 : 1; // supersample once the source is anywhere near full size
  if (k !== K) { K = k; if (canvasReady) resizeCanvases(); }
}
addEventListener('resize', fit);
fit();

// --- state ------------------------------------------------------------------------
const S = { signs: [], config: {}, hud: null, sky: null, stage: [], thanks: [], race: null, lucky: null, lobby: { total: 0, people: [], latest: null }, cosmos: null, planets: [], roles: {} };
const SIGN = {};
const color = id => ELEMENT[SIGN[id]?.element ?? 'air'].color;
const rnd = (a, b) => a + Math.random() * (b - a);

// --- wheel geometry (stage coordinates) ----------------------------------------------
// Layout: one merged top card (title, moon, goal, top-3 ranking), then the wheel as a full-width dial.
// The outer band (BAND) is the zodiac itself: each sign's arc fills as its constellation lights, and the real
// planets sit on it at their true longitude. Viewers' mascots stand just outside it.
const WHEEL_L = 32, WHEEL_T = 326, WHEEL_W = 1016, WHEEL_H = 1050;
const CX = WHEEL_L + WHEEL_W / 2, CY = WHEEL_T + WHEEL_H / 2, R = 360, BAND = R + 70, STAND = R + 114;
const on = key => S.config?.show?.[key] !== false;
const IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const angleOf = id => (-90 + IDS.indexOf(id) * 30) * Math.PI / 180;
const at = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const nodePos = id => at(R, angleOf(id));

// --- one-time builds -------------------------------------------------------------------
const nodes = {};
function build() {
  const ring = $('ring');
  // one arc per sign on the zodiac band, filled by its constellation's progress; the degree ticks turn slowly behind it
  const ticks = Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180, r0 = BAND + 14, r1 = i % 6 ? BAND + 18 : BAND + 24; return `M${CX + r0 * Math.cos(a)} ${CY + r0 * Math.sin(a)}L${CX + r1 * Math.cos(a)} ${CY + r1 * Math.sin(a)}`; }).join('');
  const arcPath = (r, a0, a1) => { const [x0, y0] = at(r, a0), [x1, y1] = at(r, a1); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  let arcs = '';
  for (const id of IDS) {
    const a = angleOf(id), d = arcPath(BAND, a - 0.235, a + 0.235);
    arcs += `<path d="${d}" stroke="rgba(255,255,255,.13)" stroke-width="16" fill="none" stroke-linecap="round"/>`
      + `<path id="arc-${id}" class="arc" d="${d}" pathLength="1" stroke="${color(id)}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="0 1"/>`;
  }
  ring.setAttribute('viewBox', `${WHEEL_L} ${WHEEL_T} ${WHEEL_W} ${WHEEL_H}`);
  ring.innerHTML = `<g class="spin"><path d="${ticks}" stroke="rgba(255,255,255,.3)" stroke-width="2"/></g>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" stroke-dasharray="3 9"/>${arcs}<g id="planets"></g>`;
  for (const s of S.signs) {
    SIGN[s.id] = s;
    const [x, y] = nodePos(s.id), el = document.createElement('div');
    el.className = 'node';
    el.style.cssText = `left:${x - WHEEL_L}px;top:${y - WHEEL_T}px;--el:${ELEMENT[s.element].color}`;
    el.innerHTML = `<span class="g gf">${s.glyph}︎</span><span class="nm">${esc(s.label)}</span><span class="n">${IDS.indexOf(s.id) + 1}</span><span class="more"></span>`;
    $('wheel').append(el);
    nodes[s.id] = { el, more: el.querySelector('.more'), lit: false };
  }
  buildRace();
  buildWaiting();
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
  const tip = c?.boss ? ['⚔️', 'Đánh Sao Chổi!', 'chat · tim · quà = sát thương', 'hot']
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

// The waiting layout stands in for the wheel until somebody is actually on stage: a greeting, the line of
// viewers who have not picked a sign yet, and the 12 seats.
function buildWaiting() {
  $('wq').innerHTML = IDS.map(id => `<div class="ws" style="--el:${color(id)}"><b>${IDS.indexOf(id) + 1}</b><span class="gf">${SIGN[id].glyph}\uFE0E</span><i>${esc(SIGN[id].label)}</i></div>`).join('');
}

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
  if (!skyStars.length) for (let i = 0; i < 260; i++) skyStars.push([rnd(.2, .9), rnd(0, 1080), rnd(0, 1920), rnd(.4, 1.8)]);
  g.setTransform(K, 0, 0, K, 0, 0);
  g.clearRect(0, 0, 1080, 1920);
  g.fillStyle = C.paper;
  for (const [a, x, y, r] of skyStars) { g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

// --- canvas world ------------------------------------------------------------------------------
const fx = $('fx').getContext('2d');
// Both full-stage canvases are K times larger than the stage and drawn in stage units.
function resizeCanvases() {
  for (const id of ['bg', 'fx']) { $(id).width = 1080 * K; $(id).height = 1920 * K; }
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
  while (box.children.length >= 3) box.firstElementChild.remove();
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
function drawAvatar(v, x, y, r, ring, lv = 1, tag = '') {
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
  fx.lineWidth = lv > 1 ? 4 : 3; fx.strokeStyle = lv > 1 ? LEVEL_COLOR[lv] : ring; fx.stroke();
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

let lastFrame = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (t - lastFrame < 1000 / FPS - 2) return;
  const dt = Math.min(3, (t - lastFrame) / (1000 / 60));
  lastFrame = t;
  fx.clearRect(0, 0, 1080, 1920);

  for (const s of twinkles) { s.p += 0.05 * dt; fx.globalAlpha = .25 + .75 * Math.abs(Math.sin(s.p)); fx.fillStyle = C.paper; fx.fillRect(s.x, s.y, 2.2, 2.2); }
  fx.globalAlpha = 1;

  // viewers stand just outside the zodiac band by their sign (up to 2 per sign, the rest are "+n" on the node):
  // their mascot (bigger, with a halo, as it levels up), their own TikTok avatar on its shoulder, and their name
  orbitSpots.clear();
  const bySign = {};
  for (const v of S.stage) (bySign[v.sign] ??= []).push(v);
  const now = Date.now();
  for (const id of IDS) {
    const list = (bySign[id] ?? []).slice(-2), a = angleOf(id), dx = Math.cos(a), dy = Math.sin(a), [nx, ny] = nodePos(id);
    list.forEach((v, i) => {
      const off = (i - (list.length - 1) / 2) * 70, dance = (dancing.get(v.userId) ?? 0) > now || S.hud?.moon.partyMs > 0;
      const bob = Math.sin(t / (dance ? 120 : 600) + i * 1.7) * (dance ? 10 : 4);
      const x = nx + dx * (STAND - R) - dy * off, y = ny + dy * (STAND - R) + dx * off + bob;
      orbitSpots.set(v.userId, [x, y - 20]);
      const lv = v.level ?? 1, k = 1 + 0.08 * (lv - 1), w = 58 * k, h = 85 * k;
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
      drawAvatar(v, x + w / 2 - 6, y - h / 2 + 8, v.fan || v.sub ? 20 : 17, v.fan || v.sub ? FAN_GOLD : color(v.sign), lv, v.fan ? `♥${v.fan}` : v.sub ? 'SUB' : '');
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
    if (b.blocked) { fx.strokeStyle = b.c; fx.lineWidth = 14 * (1 - b.t) + 2; fx.beginPath(); fx.arc(CX, CY, 300 + b.t * 40, 0, 7); fx.stroke(); }
    else {
      fx.strokeStyle = b.c; fx.lineWidth = 22 * (1 - b.t) + 3; fx.lineCap = 'round';
      fx.beginPath(); fx.moveTo(CX, CY - 60); fx.lineTo(b.x, b.y); fx.stroke();
      fx.strokeStyle = '#ffffff'; fx.lineWidth = 5 * (1 - b.t) + 1; fx.beginPath(); fx.moveTo(CX, CY - 60); fx.lineTo(b.x, b.y); fx.stroke();
    }
  }
  fx.globalAlpha = 1;

  shots = shots.filter(s => s.t < 1);
  for (const s of shots) {
    s.t += 0.045 * dt;
    const e = s.t * s.t, x = s.x0 + (CX - s.x0) * e, y = s.y0 + (CY - 40 - s.y0) * e;
    fx.fillStyle = s.c; fx.beginPath(); fx.arc(x, y, s.crit ? 14 : 9, 0, 7); fx.fill();
    fx.fillStyle = C.paper; fx.beginPath(); fx.arc(x, y, s.crit ? 6 : 4, 0, 7); fx.fill();
    if (s.t >= 1) {
      burst(CX, CY - 40, [s.c, C.paper, s.crit ? C.accent : C.gold], s.crit ? 40 : 14, s.crit ? 10 : 6);
      floats.push({ x: CX + rnd(-140, 140), y: CY - 90 + rnd(-30, 30), t: 0, text: `-${fmt(s.dmg)}${s.crit ? ' CHÍ MẠNG' : ''}`, col: s.crit ? C.accent : '#ffffff' });
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
const paintCenter = html => { const c = $('center'); c.innerHTML = `<div class="slide">${html}</div>`; if (!html.includes('class="ico-g')) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); } };

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
      for (let i = 0; i < 3; i++) setTimeout(() => burst(rnd(120, 960), 1360, [gold, '#FFE7A1', C.paper, sign ? color(sign) : C.accent], 26, 9), i * 180);
    },
    hide: () => { eventEl.innerHTML = ''; },
  });
}

// level 3: the big moments take over the wheel area
const heroEl = $('hero');
function celebrate({ key, badge = '', icon = '', glyphs = '', mascotSign = null, mood = 'win', title, sub = '', extra = '', color: hc = C.gold, ms = 3200, compact = false }) {
  // while the boss is up the arena stays in view: other celebrations shrink to the announcement strip
  // (the strip keeps the celebration's picture — a gift, the chest, an avatar — as its icon)
  if (S.cosmos?.boss && key !== 'boss') return card({ key, icon: icon || extra.match(/<img[^>]*>|<span class="av[^"]*"[^>]*>[^<]*<\/span>/)?.[0] || '✨', title: `${badge ? `${badge} · ` : ''}${title}`, sub, color: hc, ms: Math.min(ms, 3200) });
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
  $('wheelCount').textContent = `${sky.litCount}/12 chòm đã sáng`;
  for (const s of sky.sky) {
    const n = nodes[s.id], arc = $(`arc-${s.id}`);
    arc.setAttribute('stroke-dasharray', `${s.progress.toFixed(3)} 1`);
    if (n.lit !== s.lit) { n.el.classList.toggle('lit', s.lit); arc.classList.toggle('lit', s.lit); n.lit = s.lit; }
  }
  renderCall();
}

function renderStage(list) {
  const counts = {};
  for (const v of list) counts[v.sign] = (counts[v.sign] ?? 0) + 1;
  for (const id of IDS) {
    const extra = (counts[id] ?? 0) - 2;
    nodes[id].more.classList.toggle('on', extra > 0);
    if (extra > 0) nodes[id].more.textContent = `+${extra}`;
    nodes[id].el.classList.toggle('waiting', !counts[id]); // empty signs stay empty: no mascot, dashed node
  }
  // nobody on stage → the queue replaces the wheel entirely (no mascots, no centre card behind it)
  $('waiting').classList.toggle('on', !list.length);
  $('wheel').classList.toggle('empty', !list.length);
}

// The line: first come first served, six slots (empty ones are dashed). The newest arrival is greeted by name for a few seconds.
let greetedKey = '', greetTimer = 0;
const GREET = { title: 'Chào mừng cả nhà đến Đêm Hội!', sub: 'Comment <em>số 1–12</em> hoặc <em>tên cung</em> để vào vòng ✨' };
function renderLobby(l) {
  const slots = Array.from({ length: 8 }, (_, i) => l.people[i]);
  $('wql').innerHTML = slots.map((p, i) => p
    ? `<div class="wp${i === 0 ? ' first' : ''}"><span class="pos">${i + 1}</span>${avatarHtml(p)}<div class="who"><b>${esc(p.nickname)}</b><span>${i === 0 ? 'kế tiếp · gõ số 1–12 nhé!' : 'đang chọn cung…'}</span></div></div>`
    : `<div class="wp open"><span class="pos">${i + 1}</span><div class="who"><b>Chỗ trống</b></div></div>`).join('');
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
function renderGifts(g) {
  $('gnums').textContent = `${fmt(g.goal.sum)}/${fmt(g.goal.goal)} xu`;
  $('gfill').style.transform = `scaleX(${Math.min(1, g.goal.sum / g.goal.goal).toFixed(3)})`;
  $('gstat').innerHTML = `<b>${fmt(g.count)}</b> quà đêm nay · <b>${fmt(g.diamonds)}</b> xu`;
  $('gtop').innerHTML = g.top ? `👑 tặng nhiều nhất: <b>${esc(g.top.nickname)}</b> (${fmt(g.top.diamonds)} xu)` : 'tặng quà để mở màn nhé 🎁';
}

let shownOccasion = false, shownFortune = null, quizReveal = 0, lastQuizTick = 0, pollReveal = 0;
function renderHud(h) {
  $('wvis').textContent = fmt(h.night.visitors);
  $('kicker').textContent = `Đêm ${h.night.no} · ${h.occasion ? h.occasion.name : `${fmt(h.night.visitors)} người ghé thăm`}`;
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
  else if (cz?.boss) { kind = 'boss'; html = `☄ <b>Đánh Sao Chổi Đen!</b> comment · thả tim · tặng quà — mỗi nguyên tố một vai`; }
  else if (!S.stage.length && !h.lucky) html = 'Chào mừng! Comment <b>số 1–12</b> hoặc tên cung để bay vào vòng ✨';
  else if (h.lucky) html = `⭐ <b>Sao may mắn: ${esc(SIGN[h.lucky.sign].label)}</b> · ánh sao x${h.lucky.multiplier} · ${Math.ceil(h.lucky.remainingMs / 1000)}s`;
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

const LOOT_WHY = { boss: 'chiến lợi phẩm Sao Chổi', chest: 'từ rương sao', quiz: 'trả lời đúng câu đố', chaos: 'sửa sóng Thủy Nghịch', moon: 'có mặt lúc trăng rằm', wish: 'điều ước được chúc phúc' };
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
  // the real sky: one chip per planet (its sign, ℞ when retrograde) and the moon phase; glyphs on the nodes too
  const key = c.sky ? JSON.stringify([c.sky.planets, c.sky.moon.phase]) : '';
  if (key !== skyKey) {
    skyKey = key;
    $('skyrow').style.display = c.sky ? '' : 'none';
    if (c.sky) {
      $('skyrow').innerHTML = c.sky.planets.map(p => `<div class="sp${p.retro ? ' retro' : ''}" style="--el:${color(p.sign)}"><span class="gl gf">${PLANET(p.id).glyph}</span><span class="nm">${esc(SIGN[p.sign].label)}</span>${p.retro ? '<span class="rx">℞</span>' : ''}</div>`).join('')
        + `<div class="sp moonph${c.sky.moon.full ? ' full' : ''}"><span class="nm">${c.sky.moon.icon} ${esc(c.sky.moon.short ?? c.sky.moon.phase)}</span></div>`;
    }
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
  renderCall();
}

// The real planets on the zodiac band, each at its true longitude (the sign's arc spans 30°); close neighbours
// step aside a little so their glyphs stay readable. Retrograde ones carry a ℞ and a violet rim.
function renderPlanets(sky) {
  const g = $('planets');
  if (!sky) { g.innerHTML = ''; return; }
  const placed = [];
  g.innerHTML = sky.planets.map(p => {
    let a = angleOf(p.sign) + (p.deg + 0.5 - 15) * Math.PI / 180;
    while (placed.some(b => Math.abs(b - a) < 0.085)) a += 0.085;
    placed.push(a);
    const [x, y] = at(BAND, a), d = PLANET(p.id);
    return `<g class="pt${p.retro ? ' retro' : ''}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 1}">${d.glyph}</text>${p.retro ? `<text class="rx" x="${x + 15}" y="${y - 14}">℞</text>` : ''}</g>`;
  }).join('');
}

// The wish wall in the base card: the latest wishes, their words, who made them and how many blessed them.
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
let arenaMode = '', claimKey = '';
function renderArena(c) {
  const a = $('arena'), mode = c.boss ? 'boss' : c.chaos ? 'chaos' : c.chest.open ? 'chest' : '';
  if (mode !== arenaMode) {
    arenaMode = mode;
    a.className = mode ? `on ${mode}mode` : '';
    claimKey = '';
    a.innerHTML = mode === 'boss'
      ? `<div class="ak">☄ Sao Chổi Đen ☄</div><div class="boss" id="bossFig"><img src="/art/boss.svg" alt=""><i class="rage-tag">NỔI GIẬN</i></div><div class="hp"><i></i><b></b></div><div class="meta"></div><div class="st"></div>`
        + `<div class="roles">${['fire', 'earth', 'air', 'water'].map(el => `<div class="role" style="--el:${ELEMENT[el].color}"><img src="/art/gem-${el}.svg" alt=""><b>${EL_NAME[el]}</b><span>${esc(S.roles[el] ?? '')}</span><em data-el="${el}">0</em></div>`).join('')}</div>`
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
    a.querySelector('.hp i').style.transform = `scaleX(${(b.hp / b.max).toFixed(3)})`;
    a.querySelector('.hp b').textContent = `${fmt(b.hp)} / ${fmt(b.max)}`;
    a.classList.toggle('rage', b.rage);
    a.querySelector('.meta').innerHTML = `<span class="t">⏱ ${mmss(b.remainingMs)}</span><span class="sh">🛡 ${b.shield}/${b.shieldMax}</span>${b.combo > 1 ? `<span class="cb">Khí combo x${b.combo}</span>` : ''}`;
    const st = a.querySelector('.st');
    st.classList.toggle('ice', Boolean(b.frozen));
    st.innerHTML = b.frozen
      ? `❄ <b>${esc(SIGN[b.frozen.sign].label)}</b> bị đóng băng! Fan ${esc(SIGN[b.frozen.sign].label)} comment để phá băng ${b.frozen.got}/${b.frozen.need} · ${Math.ceil(b.frozen.remainingMs / 1000)}s`
      : b.top.length ? `Mạnh nhất: ${b.top.map(x => `<b>${esc(x.nickname)}</b> ${fmt(x.dmg)}`).join(' · ')}` : 'Comment, thả tim, tặng quà để tấn công!';
    for (const em of a.querySelectorAll('.role em')) em.textContent = fmt(b.byElement[em.dataset.el]);
  } else if (mode === 'chest') {
    const ch = c.chest;
    a.querySelector('.cap').innerHTML = `Gõ <b>“nhận”</b> · ${Math.ceil(ch.remainingMs / 1000)}s`;
    a.querySelector('.sub').textContent = ch.claims ? `${fmt(ch.claims)} người đã nhận thẻ` : 'mỗi người một thẻ — có thẻ hiếm!';
    const key = ch.recent.map(r => r.nickname + r.card.sign + r.card.edition).join('|');
    if (key !== claimKey) { claimKey = key; a.querySelector('.claims').innerHTML = ch.recent.slice(0, 4).map(r => cardHtml(r.card, { name: r.nickname })).join(''); }
  }
}
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
function flash(id) { const el = nodes[id]?.el; if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
const stars = e => Math.round(e.diamonds * (S.config.lightPerDiamond ?? 5));
const gain = (e, sign) => (sign ? `+${fmt(stars(e))} ánh sao cho ${esc(SIGN[sign].label)}` : 'comment tên cung để nhận ánh sao');
let lastFlowNote = 0;
const G = id => `<span class="gf">${SIGN[id].glyph}︎</span>`;

// Sound for each effect (the same effects the director already rate-limits).
const sfx = createSfx(params.has('sfx') ? Number(params.get('sfx')) : 0.3);
const music = createMusic({ volume: params.has('music') ? Number(params.get('music')) : 0.22, onBlocked: () => { if (params.has('soundbtn')) $('sound').classList.add('on'); } }); // viewers cannot click the stream: the button is only for testing in a normal browser (?soundbtn=1)
addEventListener('pointerdown', () => music.resume(), { once: true }); // a normal browser tab still starts the music on the first click
$('sound').onclick = () => { music.resume(); sfx('welcome'); $('sound').classList.remove('on'); };
const SOUND = { 'gift-goal': 'meteor', wish: 'wish', lit: 'lit', 'wheel-complete': 'wheel', 'moon-full': 'moon', 'moon-end': 'moonEnd', 'lucky-start': 'lucky', 'lucky-end': 'luckyEnd', overtake: 'overtake', 'quiz-end': 'quiz', 'poll-start': 'pollStart', 'poll-end': 'poll', milestone: 'milestone', 'night-start': 'night', 'need-sign': 'boop', flows: 'flow', 'title-up': 'title', streak: 'streak', dance: 'dance',
  swaps: 'flow', 'boss-hits': 'sparkle', 'boss-start': 'night', 'boss-freeze': 'boop', 'boss-rescue': 'lit', 'boss-blocked': 'follow', 'boss-heal': 'luckyEnd', 'boss-defeated': 'wheel', 'boss-escaped': 'moonEnd',
  'chaos-start': 'meteor', 'chaos-fixed': 'moon', 'chaos-end': 'luckyEnd', 'chest-open': 'milestone', cards: 'sparkle', collection: 'title', 'set-complete': 'title',
  'wish-bless': 'sparkle', 'wish-blessed': 'lit', loots: 'sparkle', 'level-up': 'title', bag: 'boop', combine: 'lit', 'upgrade-need': 'boop',
  fans: 'milestone', 'fan-call': 'lucky', 'heat-up': 'overtake', demo: 'boop', 'switch-wait': 'boop' };
const BIG = new Set(['meteor', 'wheel', 'moon', 'milestone', 'night', 'firework']); // the music ducks under these
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
      flash(e.sign);
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
      card({ key: 'heat', icon: '🔥', title: `Phòng ${h.name.toLowerCase()}!`, sub: `mọi ánh sao x${e.multiplier} · giữ nhịp chat · tim · quà nhé`, color: h.color, ms: 3000, kind: 'heat' });
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
      celebrate({ key: 'boss', badge: '☄ BOSS XUẤT HIỆN', extra: '<img class="bossimg" src="/art/boss.svg" alt="">', title: 'SAO CHỔI ĐEN!', sub: `${fmt(e.hp)} máu · ${e.seconds} giây · Lửa: quà x2 · Đất: khiên · Khí: combo · Nước: tim x3`, color: '#E97A66', ms: 4200 });
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
      celebrate({ key: 'boss', badge: '🏆 HẠ SAO CHỔI ĐEN', mascotSign: e.mvp?.sign ?? 'leo', title: e.mvp ? `MVP: ${esc(e.mvp.nickname)}` : 'Cả phòng chiến thắng!', sub: `${e.fighters} người góp sức trong ${e.seconds}s · ${mvps} · ai cũng được +${e.reward} ánh sao và 1 thẻ`, ms: 5600 });
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
        celebrate({ key: 'card', badge: `THẺ ${ed.label.toUpperCase()}`, extra: `<div class="cards">${cardHtml(best.card, { big: true })}</div>`, title: esc(best.nickname), sub: `${best.isNew ? 'thẻ mới! · ' : ''}bộ sưu tập ${best.unique}/60`, color: ed.color, ms: 4200, compact: true });
      } else if (ed.rarity === 2 || !S.cosmos?.chest.open) {
        card({ key: 'card', icon: cardHtml(best.card), title: `<b>${esc(best.nickname)}</b> nhận thẻ ${esc(ed.label)}`, sub: `${esc(SIGN[best.card.sign].label)}${best.isNew ? ' · thẻ mới!' : ''} · bộ sưu tập ${best.unique}/60${e.more ? ` · +${e.more} người nữa` : ''}`, color: ed.color, ms: 3000 });
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
    if (p.stage) { S.stage = p.stage; renderStage(p.stage); }
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
