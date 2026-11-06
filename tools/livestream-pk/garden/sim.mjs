// Rehearsal and load tool for Vườn Mây.
//   node garden/sim.mjs                         offline load run (no network): prints tick time, frame size, camera shots
//   node garden/sim.mjs --users 42 --url http://127.0.0.1:4858 [--seconds 120]
//                                               fake viewers talk to a running server through /api/sim
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createGarden } from './garden.mjs';
import { createCamera } from './camera.mjs';
import { createCoalescer } from './fx.mjs';

const ACTIONS = ['chăm'];
const GIFTS = [1, 1, 1, 1, 1, 5, 5, 10, 10, 30, 100, 1000]; // mostly small, like a real room

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const p95 = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] ?? 0; };

export function runLoad({ users = 24, seconds = 120, giftsPerMin = 2, seed = 1 } = {}) {
  const rng = mulberry(seed);
  let t = Date.UTC(2026, 10, 4, 12);
  const events = [];
  const garden = createGarden({ now: () => t, rng, onEvent: e => events.push(e) });
  const camera = createCamera({ cfg: garden.cfg, now: () => t, getPlots: () => Object.values(garden.state.plots).filter(p => p.owner) });
  const coalescer = createCoalescer({ now: () => t });
  const ids = Array.from({ length: users }, (_, i) => `u${i}`);
  ids.forEach((id, i) => garden.chat({ userId: id, nickname: `Người ${i}`, avatar: '', comment: 'chăm' }));

  const seen = {}, tickMs = [], frameBytes = [], shots = [], eventCounts = {}, shotKinds = {};
  garden.changes(seen);
  const FRAME = 150;
  for (let elapsed = 0; elapsed < seconds * 1000; elapsed += FRAME) {
    t += FRAME;
    const actions = Math.round(users * FRAME / 5000); // each viewer does something about every 5 seconds
    for (let k = 0; k < actions; k++) garden.chat({ userId: ids[Math.floor(rng() * users)], nickname: '', avatar: '', comment: ACTIONS[Math.floor(rng() * ACTIONS.length)] });
    if (rng() < giftsPerMin * FRAME / 60000) garden.gift({ userId: ids[Math.floor(rng() * users)], nickname: '', avatar: '', diamonds: GIFTS[Math.floor(rng() * GIFTS.length)], count: 1 });
    for (const e of events.splice(0)) { const key = e.type + (e.first ? '+first' : ''); eventCounts[key] = (eventCounts[key] ?? 0) + 1; camera.push(e); coalescer.push(e); }
    const a = performance.now();
    garden.tick();
    const shot = camera.tick();
    if (shot?.kind === 'event' && shot.eventKind) garden.events.present(shot.eventKind);
    tickMs.push(performance.now() - a);
    coalescer.flush();
    frameBytes.push(JSON.stringify(garden.changes(seen)).length);
    if (shot) shotKinds[`${shot.kind}:${shot.label}`] = (shotKinds[`${shot.kind}:${shot.label}`] ?? 0) + 1;
    if (shot && !['idle','gap','overview'].includes(shot.kind)) shots.push(shot);
  }
  const minutes = seconds / 60;
  return {
    tickMsP95: p95(tickMs), frameBytesP95: p95(frameBytes), shotsPerMin: Math.round(shots.length / minutes), nonGiftShots: shots.filter(s => s.label !== 'gift').length,
    seated: Object.values(garden.state.users).filter(u => u.seat).length, eventCounts, shotKinds, harvests: Object.values(garden.state.users).reduce((n, u) => n + u.stats.harvest, 0),
  };
}

async function live(url, users, seconds) {
  const post = body => fetch(`${url}/api/sim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  const mk = i => ({ userId: `rehearsal-${i}`, nickname: `Người ${i}` });
  for (let i = 0; i < users; i++) await post({ kind: 'chat', user: mk(i), comment: 'chăm' });
  console.log(`${users} viewers joined; acting for ${seconds}s`);
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const n = Math.max(1, Math.round(users / 5));
    await Promise.all(Array.from({ length: n }, () => post({ kind: 'chat', user: mk(Math.floor(Math.random() * users)), comment: ACTIONS[Math.floor(Math.random() * ACTIONS.length)] })));
    if (Math.random() < 0.15) await post({ kind: 'gift', user: mk(Math.floor(Math.random() * users)), diamonds: GIFTS[Math.floor(Math.random() * GIFTS.length)], count: 1 });
    await new Promise(r => setTimeout(r, 1000));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
  const users = Math.min(42, Number(arg('users', 24))), seconds = Number(arg('seconds', 120)), url = arg('url', '');
  if (url) await live(url, users, seconds);
  else console.log(runLoad({ users, seconds }));
}
