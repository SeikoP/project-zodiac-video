// Overlay for Đêm Hội Hoàng Đạo. Built to stay smooth in busy rooms:
//  • the server sends one small "frame" every 250ms (changed parts + a capped list of effects);
//  • DOM is touched only when a part changes, and only the bits that changed;
//  • everything that moves every frame (orbiting viewers, comets, particles, lanterns) is drawn
//    on one canvas from pre-rendered sprites, capped at ?fps= (default 30).
import { ELEMENT, mascot, fmt, esc, clock, subscribe } from '/shared.js';
import { SIGN_DATA, factCards } from '/signs.js';
import { CONSTELLATIONS } from '/constellations.js';
import { ICON } from '/icons.js';
import { createSfx } from '/sfx.js';
import { createMusic } from '/music.js';
import { createLane } from '/lane.js';

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
const S = { signs: [], config: {}, hud: null, sky: null, stage: [], thanks: [], race: null, lucky: null, lobby: { total: 0, people: [], latest: null } };
const SIGN = {};
const color = id => ELEMENT[SIGN[id]?.element ?? 'air'].color;
const rnd = (a, b) => a + Math.random() * (b - a);

// --- wheel geometry (stage coordinates) ----------------------------------------------
// Layout: one merged top card (title, moon, goal, top-3 ranking), then the wheel as a full-width dial.
const WHEEL_L = 32, WHEEL_T = 330, WHEEL_W = 1016, WHEEL_H = 1070;
const CX = WHEEL_L + WHEEL_W / 2, CY = WHEEL_T + WHEEL_H / 2, R = 380;
const on = key => S.config?.show?.[key] !== false;
const IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const angleOf = id => (-90 + IDS.indexOf(id) * 30) * Math.PI / 180;
const at = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const nodePos = id => at(R, angleOf(id));

// --- one-time builds -------------------------------------------------------------------
const nodes = {};
function build() {
  const ring = $('ring');
  const ticks = Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180, r0 = R + 44, r1 = i % 6 ? R + 50 : R + 56; return `M${CX + r0 * Math.cos(a)} ${CY + r0 * Math.sin(a)}L${CX + r1 * Math.cos(a)} ${CY + r1 * Math.sin(a)}`; }).join('');
  let dots = '';
  for (const id of IDS) {
    const n = CONSTELLATIONS[id].stars.length, a0 = angleOf(id);
    for (let k = 0; k < n; k++) {
      const a = a0 + Math.PI + (k - (n - 1) / 2) * 0.11; // a small arc of stars on the inner side of each node
      const x = CX + R * Math.cos(a0) + 70 * Math.cos(a), y = CY + R * Math.sin(a0) + 70 * Math.sin(a);
      dots += `<circle id="d-${id}-${k}" cx="${x}" cy="${y}" r="4" fill="rgba(255,255,255,.22)"/>`;
    }
  }
  ring.setAttribute('viewBox', `${WHEEL_L} ${WHEEL_T} ${WHEEL_W} ${WHEEL_H}`);
  ring.innerHTML = `<g class="spin"><circle cx="${CX}" cy="${CY}" r="${R + 50}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2"/><path d="${ticks}" stroke="rgba(255,255,255,.35)" stroke-width="2"/></g>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2" stroke-dasharray="3 9"/>${dots}`;
  for (const s of S.signs) {
    SIGN[s.id] = s;
    const [x, y] = nodePos(s.id), el = document.createElement('div');
    el.className = 'node';
    el.style.cssText = `left:${x - WHEEL_L}px;top:${y - WHEEL_T}px;--el:${ELEMENT[s.element].color}`;
    el.innerHTML = `<span class="g gf">${s.glyph}︎</span><span class="nm">${esc(s.label)}</span><span class="n">${IDS.indexOf(s.id) + 1}</span><span class="more"></span>`;
    $('wheel').append(el);
    nodes[s.id] = { el, more: el.querySelector('.more'), lit: false, stars: -1 };
  }
  $('dots').innerHTML = IDS.map(id => `<i id="q-${id}" style="--el:${color(id)}"><b></b></i>`).join('');
  buildRace();
  buildHow();
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
// Instructions use the same icons as the buttons on a viewer's own TikTok screen.
function buildHow() {
  const rows = [
    [ICON.comment, 'Tên cung · 1–12', 'vào đội'],
    [ICON.heart, 'Thả tim', 'trăng lên rằm'],
    [ICON.gift, 'Tặng quà', '1 xu = 5 sao'],
    [ICON.follow, 'Theo dõi · Chia sẻ', '+20 ánh sao'],
    [ICON.comment, 'xin quẻ · ước · nhảy', 'gõ thử!'],
  ];
  $('how').innerHTML = rows.map(([ic, text, hint]) => `<p><b>${ic}${text}</b><span>${hint}</span></p>`).join('');
}

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
let parts = [], comets = [], meteors = [], lanterns = [];
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
function lantern(sign) {
  if (lanterns.length >= 4) lanterns.shift();
  const [x, y] = sign ? nodePos(sign) : [CX, CY];
  lanterns.push({ x, y, t: 0 });
}

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

  // viewers stand just outside their sign's node (up to 2 per sign, the rest are "+n" on the node), so the node's name stays readable
  orbitSpots.clear();
  const bySign = {};
  for (const v of S.stage) (bySign[v.sign] ??= []).push(v);
  const now = Date.now();
  for (const id of IDS) {
    const list = (bySign[id] ?? []).slice(-2), a = angleOf(id), dx = Math.cos(a), dy = Math.sin(a), [nx, ny] = nodePos(id);
    list.forEach((v, i) => {
      const off = (i - (list.length - 1) / 2) * 64, dance = (dancing.get(v.userId) ?? 0) > now || S.hud?.moon.partyMs > 0;
      const bob = Math.sin(t / (dance ? 120 : 600) + i * 1.7) * (dance ? 10 : 4);
      const x = nx + dx * 96 - dy * off, y = ny + dy * 96 + dx * off + bob;
      orbitSpots.set(v.userId, [x, y - 20]);
      const sp = sprites[v.sign];
      if (sp) {
        if (dance) { fx.save(); fx.translate(x, y); fx.rotate(Math.sin(t / 140 + i) * .18); fx.drawImage(sp, -29, -42, 58, 85); fx.restore(); }
        else fx.drawImage(sp, x - 29, y - 42, 58, 85);
      }
      const lb = label(v.nickname, 14, v.title === 'Tân Tinh' ? C.paper : '#F2C45C');
      drawLabel(lb, x, dy < -.5 ? y - 70 : y + 45); // names go on the far side of the mascot from the node
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

  lanterns = lanterns.filter(l => l.t < 1);
  for (const l of lanterns) {
    l.t += dt / (60 * 6);
    const y = l.y - l.t * 700, x = l.x + Math.sin(l.t * 9) * 18;
    fx.globalAlpha = l.t < .08 ? l.t / .08 : l.t > .85 ? (1 - l.t) / .15 : 1;
    const g = fx.createRadialGradient(x, y, 4, x, y, 46);
    g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(.35, 'rgba(255,170,70,.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    fx.fillStyle = g; fx.beginPath(); fx.arc(x, y, 46, 0, 7); fx.fill();
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
    const n = nodes[s.id];
    if (n.stars !== s.stars) {
      for (let k = 0; k < CONSTELLATIONS[s.id].stars.length; k++) $(`d-${s.id}-${k}`).setAttribute('fill', k < s.stars ? color(s.id) : 'rgba(255,255,255,.22)');
      n.stars = s.stars;
    }
    if (n.lit !== s.lit) { n.el.classList.toggle('lit', s.lit); n.lit = s.lit; }
    $(`q-${s.id}`).style.setProperty('--p', s.progress.toFixed(3));
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
    ? `<div class="wp${i === 0 ? ' first' : ''}"><span class="pos">${i + 1}</span><img src="${esc(p.avatar || mascot('leo', 'idle'))}" alt=""><div class="who"><b>${esc(p.nickname)}</b><span>${i === 0 ? 'kế tiếp · gõ số 1–12 nhé!' : 'đang chọn cung…'}</span></div></div>`
    : `<div class="wp open"><span class="pos">${i + 1}</span><div class="who"><b>Chỗ trống</b></div></div>`).join('');
  $('wqn').textContent = l.total ? `${l.total} người đang chờ${l.total > 8 ? ` · +${l.total - 8} nữa` : ''}` : 'chưa có ai — bạn là người đầu tiên!';
  const key = l.latest ? l.latest.nickname + l.total : '';
  if (l.latest && key !== greetedKey) {
    $('wgTitle').textContent = `Chào ${l.latest.nickname}!`;
    $('wgSub').innerHTML = 'Gõ <em>số 1–12</em> hoặc <em>tên cung</em> để bước vào vòng ✨';
    $('wgTitle').classList.remove('hi'); void $('wgTitle').offsetWidth; $('wgTitle').classList.add('hi');
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => { $('wgTitle').textContent = GREET.title; $('wgSub').innerHTML = GREET.sub; }, 7000);
  }
  greetedKey = key;
}

// The gift board: progress to the room's shared goal, the night's totals, who gave most, and the last gifts as chips.
let lastGiftKey = '';
function renderGifts(g) {
  $('gnums').textContent = `${fmt(g.goal.sum)}/${fmt(g.goal.goal)} xu`;
  $('gfill').style.transform = `scaleX(${Math.min(1, g.goal.sum / g.goal.goal).toFixed(3)})`;
  $('gstat').innerHTML = `<b>${fmt(g.count)}</b> quà đêm nay · <b>${fmt(g.diamonds)}</b> xu`;
  $('gtop').innerHTML = g.top ? `👑 tặng nhiều nhất: <b>${esc(g.top.nickname)}</b> (${fmt(g.top.diamonds)} xu)` : 'tặng quà để mở màn nhé 🎁';
  const key = g.recent.map(r => r.nickname + r.giftName + r.count).join('|');
  $('thanks').innerHTML = g.recent.length
    ? g.recent.slice(0, 3).map((r, i) => `<div class="gc${i === 0 && key !== lastGiftKey ? ' fresh' : ''}"><div class="gi">${r.giftImage ? `<img src="${esc(r.giftImage)}" alt="">` : ICON.gift}</div><div class="gt"><b>${esc(r.giftName || 'Quà')}${r.count > 1 ? ` x${r.count}` : ''}</b><span>${esc(r.nickname)}</span></div></div>`).join('')
    : '<span class="empty">Chưa có quà — món quà đầu tiên sẽ lên đây! 🎁</span>';
  lastGiftKey = key;
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
  let html;
  if (!S.stage.length && !h.lucky) html = 'Chào mừng! Comment <b>số 1–12</b> hoặc tên cung để bay vào vòng ✨';
  else if (h.lucky) html = `⭐ <b>Sao may mắn: ${esc(SIGN[h.lucky.sign].label)}</b> · ánh sao x${h.lucky.multiplier} · ${Math.ceil(h.lucky.remainingMs / 1000)}s`;
  else {
    const next = h.luckyInMs > 0 ? ` · ⭐ sao may mắn sau ${clock(Math.ceil(h.luckyInMs / 10000) * 10000)}` : '';
    html = sky.litCount < 12 ? `Còn chờ ${sky.waiting.slice(0, 2).map(id => `<b>${esc(SIGN[id].label)} (${IDS.indexOf(id) + 1})</b>`).join(', ')}${next}${S.lobby.total ? ` · 👋 ${S.lobby.total} bạn đang chờ chọn cung` : ''}` : 'Cả 12 chòm đã sáng!';
  }
  if (html !== lastCall) { lastCall = html; $('call').innerHTML = html; }
}

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
const SOUND = { 'gift-goal': 'meteor', wish: 'wish', lit: 'lit', 'wheel-complete': 'wheel', 'moon-full': 'moon', 'moon-end': 'moonEnd', 'lucky-start': 'lucky', 'lucky-end': 'luckyEnd', overtake: 'overtake', 'quiz-end': 'quiz', 'poll-start': 'pollStart', 'poll-end': 'poll', milestone: 'milestone', 'night-start': 'night', 'need-sign': 'boop', flows: 'flow', 'title-up': 'title', streak: 'streak', dance: 'dance' };
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
      if (on('join')) spotlight(`<img src="${mascot(p.sign, 'hype')}" alt=""><div class="cap">${esc(p.nickname)}</div><div class="sub">vào đội ${G(p.sign)} ${esc(SIGN[p.sign].label)} ✨${e.more ? ` · +${e.more} người` : ''}</div>`, 1600, 'join');
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
      lantern(e.sign);
      if (on('wish')) card({ key: 'wish', icon: '🏮', title: `<b>${esc(e.nickname)}</b> thả đèn ước`, sub: e.text ? `“${esc(e.text)}”` : 'một điều ước bí mật ✨', color: e.sign ? color(e.sign) : C.gold, ms: 3800 });
      break;
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
      spotlight(`<img src="${mascot('leo', 'idle')}" alt=""><div class="cap">${esc(e.nickname)}</div><div class="sub">comment tên cung trước rồi “xin quẻ” nhé!</div>`, 2200, 'need');
      break;
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
  }
}

let offlineTimer = null;
subscribe({
  meta: m => { const first = !S.signs.length; Object.assign(S, { signs: m.signs, config: m.config }); if (m.music) music.setLists(m.music); if (first) build(); },
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
    for (const e of f.fx) onFx(e);
  },
}, ok => {
  clearTimeout(offlineTimer);
  if (ok) $('conn').classList.remove('on');
  else offlineTimer = setTimeout(() => $('conn').classList.add('on'), 4000);
});
