import {createDisplays} from './displays.mjs';
import {createHash} from 'node:crypto';
import {createLimiter} from './commands.mjs';
// Vườn Mây server (npm run garden). Separate port and save file; TikTok events use the shared connector.
//   http://127.0.0.1:4858/   overlay for TikTok LIVE Studio (1080×1920) and the local host panel
// Every FRAME_MS each page gets the plots that changed since it last heard, the merged effects, and any new camera shot.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGarden } from './garden.mjs';
import { createCamera } from './camera.mjs';
import { createCoalescer } from './fx.mjs';
import { EVENT_TYPES } from './events.mjs';
import { createHub } from './hub.mjs';
import { createSaver, loadState, pruneUsers } from './store.mjs';
import { emptyGardenState, TIERS } from './world.mjs';
import { listMusic } from '../music.mjs';
import { potTierOf } from './progress.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(root, 'public');
const MUSIC_DIR = path.resolve(root, '../../assets/music');
const FRAME_MS = Number(process.env.PK_FRAME_MS) || 150;
const TYPES = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

const trusted = req => {
  const ip = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return false;
  if (req.headers.host && !LOCAL.test(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return LOCAL.test(new URL(origin).host); } catch { return false; }
};
const readBody = req => new Promise(resolve => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
});

export async function startGardenServer({ port = Number(process.env.PK_GARDEN_PORT || 4858), sharePort = null, dir = process.env.PK_DATA_DIR ?? path.join(root, 'data'), config, tiktok = !process.env.PK_NO_TIKTOK, tiktokBridge = null, simulator = false, now = Date.now, log = console.log } = {}) {
  const full = config ?? readJson(path.join(root, 'config.json'), {});
  const musicDir = MUSIC_DIR, musicRoot = fs.existsSync(MUSIC_DIR) ? fs.realpathSync(MUSIC_DIR) : MUSIC_DIR;
  const music = listMusic({ dir: musicDir, exclude: full.musicExclude, upbeat: full.musicUpbeat });
  const musicFiles = new Set([...music.calm, ...music.upbeat].map(track => track.file));
  const file = path.join(dir, 'garden-state.json');
  const state = loadState(file, now());
  pruneUsers(state, now());
  const hub = createHub();
  const displays=createDisplays({now,simulator}),receipts=[];
  const build=createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).update(fs.readFileSync(path.join(PUBLIC,'garden/garden.js'))).digest('hex').slice(0,12);let eventSeq=0;
  const recentReceipts=()=>{while(receipts.length&&(now()-receipts[0].receivedAt>120000||receipts.length>64))receipts.shift();return receipts;};
  let coalescer = createCoalescer({ now }), garden, camera, lastShot = null;
  const saver = createSaver({ file, getState: () => state });
  const onEvent = e => {
    const u = e.userId && state.users[e.userId];
    const out = u ? { ...e, plotId:e.plotId??(u.seat?`${u.seat.tier}:${u.seat.slot}`:null),nickname:e.nickname??u.nickname,avatar:u.avatar,level:e.level??u.level,potTier:potTierOf(u.level) } : e;
    out.eventId=`${build}:${++eventSeq}`;out.receivedAt=now();out.sessionNo=state.session?.no??null;
    if(out.type==='gift'){receipts.push(structuredClone(out));recentReceipts();}
    camera?.push(out);
    coalescer.push(out);
    saver.markDirty();
  };
  const newGarden = () => createGarden({ config: full.garden, state, now, onEvent, onStateChange: () => saver.markDirty() });
  garden = newGarden();
  camera = createCamera({ cfg: garden.cfg, now, isSecondaryReady:()=>displays.ready(), getPlots: () => Object.values(state.plots).filter(p => p.owner && now() - p.lastActive < garden.cfg.sleepAfterMs) });
  if(state.boss?.phase==='active')camera.push({type:'boss-start'});

  // Simulator room director: room-size profiles model a real LIVE instead of accumulating stress bots forever.
  const BOT_NAMES=['An','Bảo','Chi','Duy','Giang','Hà','Hải','Hân','Huy','Khanh','Lan','Linh','Mai','Minh','My','Nam','Nga','Ngân','Ngọc','Nhi','Phúc','Quân','Quỳnh','Sơn','Thảo','Trang','Trúc','Tuấn','Vy','Yến'];
  const AUTO_PROFILES={
    normal:{id:'normal',intervalMs:1200,actionsPerPulse:2,giftEvery:55,mediumGiftEvery:0,stealEvery:32},
    busy:{id:'busy',intervalMs:1000,actionsPerPulse:4,giftEvery:32,mediumGiftEvery:90,stealEvery:22},
    stress:{id:'stress',intervalMs:700,actionsPerPulse:8,giftEvery:12,mediumGiftEvery:45,stealEvery:12},
  };
  let autoTimer=null,autoSeq=0,autoCursor=0,autoPulse=0,autoProfile='normal',autoGift=0;
  const autoUsers=new Map();
  const autoStatus=()=>({running:Boolean(autoTimer),bots:autoUsers.size,profile:autoProfile,target:autoUsers.size});
  const autoUser=()=>{const n=autoSeq++;return{userId:`auto-${n}`,nickname:`${BOT_NAMES[n%BOT_NAMES.length]} ${Math.floor(n/BOT_NAMES.length)+1}`,avatar:`/garden/assets/avatar-${n%6+1}.svg`};};
  const addOneAuto=()=>{const user=autoUser();autoUsers.set(user.userId,user);garden.chat({...user,userId:'sim:'+user.userId,comment:'trồng'});return user;};
  const removeOneAuto=()=>{
    const entry=[...autoUsers.entries()].at(-1); if(!entry)return false;
    const [id,user]=entry,stored=state.users['sim:'+user.userId],seat=stored?.seat,plot=seat&&state.plots[`${seat.tier}:${seat.slot}`];
    if(plot){plot.owner=null;plot.crop=null;plot.sleeping=false;plot.deco=[];plot.ver=++state.ver;}
    if(stored)stored.seat=null;
    autoUsers.delete(id);return true;
  };
  const setAutoRoom=(count,profile=autoProfile)=>{
    if(!simulator)throw new Error('simulator-only');
    const target=Math.max(1,Math.min(garden.cfg.activeCapacity,Number(count)||24));
    if(AUTO_PROFILES[profile])autoProfile=profile;
    while(autoUsers.size<target)addOneAuto();
    while(autoUsers.size>target)removeOneAuto();
    saver.markDirty();
    return autoStatus();
  };
  const autoStep=()=>{
    if(!simulator||!autoUsers.size)return;
    const profile=AUTO_PROFILES[autoProfile]??AUTO_PROFILES.normal,users=[...autoUsers.values()];
    const batch=Math.min(users.length,profile.actionsPerPulse);
    for(let k=0;k<batch;k++){
      const user=users[autoCursor++%users.length],stored=state.users['sim:'+user.userId],seat=stored?.seat,plot=seat&&state.plots[`${seat.tier}:${seat.slot}`];
      let comment;
      if(!plot?.crop)comment='trồng';
      else if(plot.crop.progress>=1)comment='hái';
      else if(plot.crop.pest)comment='bắt sâu';
      else if(plot.crop.weeds)comment='nhổ cỏ';
      else if(!plot.crop.fertilized&&stored?.gold>=garden.cfg.fertilizeCost&&(autoCursor+k)%5===0)comment='bón phân';
      else if(profile.stealEvery&&autoPulse%profile.stealEvery===0&&k===0)comment='trộm';
      else comment=(autoCursor+k)%3===0?'vườn':'tưới';
      garden.chat({...user,userId:'sim:'+user.userId,comment});
    }
    autoPulse++;
    if(profile.giftEvery&&autoPulse%profile.giftEvery===0){
      const user=users[autoPulse%users.length],diamonds=[50,500,1000,100,5,1][autoGift++%6];garden.gift({...user,userId:'sim:'+user.userId,diamonds,count:1});
    }
    if(profile.mediumGiftEvery&&autoPulse%profile.mediumGiftEvery===0){
      const user=users[(autoPulse+3)%users.length];garden.gift({...user,userId:'sim:'+user.userId,diamonds:100,count:1});
    }
  };
  const restartAutoTimer=()=>{if(autoTimer)clearInterval(autoTimer);autoTimer=setInterval(autoStep,(AUTO_PROFILES[autoProfile]??AUTO_PROFILES.normal).intervalMs);};
  const startAuto=(profile=autoProfile)=>{if(!simulator)throw new Error('simulator-only');if(AUTO_PROFILES[profile])autoProfile=profile;if(!autoUsers.size)setAutoRoom(24,autoProfile);if(!autoTimer)restartAutoTimer();return autoStatus();};
  const stopAuto=()=>{if(autoTimer)clearInterval(autoTimer);autoTimer=null;return autoStatus();};
  let bridge = tiktokBridge;
  const tiktokStatus = () => bridge?.status?.() ?? { username:null,state:'off',detail:simulator?'Simulator không kết nối TikTok':'',viewers:0 };
  const meta = () => ({ ...garden.meta(), build,serverTime:now(),simulator,music: { calm: music.calm, upbeat: music.upbeat } });
  const status = () => {
    const plots = Object.values(state.plots), crops = plots.filter(p => p.owner && p.crop);
    const seated = Object.values(state.users).filter(u => u.seat);
    const players = seated.filter(u => {
      const p = state.plots[`${u.seat.tier}:${u.seat.slot}`];
      return p && now() - p.lastActive < garden.cfg.sleepAfterMs;
    });
    const cam = camera.state();
    return {
      simulator,
      build,displays:displays.list(),secondaryReady:displays.ready(),
      diagnosticsVersion:simulator?1:undefined,serverTime:now(),
      tiktok:tiktokStatus(),
      autoplay: autoStatus(),
      viewers: players.length,
      sleeping: seated.length - players.length,
      players: players.map(u => ({ userId:u.userId,nickname: u.nickname,avatar:u.avatar??'', level: u.level, tier: u.seat.tier })),
      planted: crops.length,
      ripe: crops.filter(p => p.crop.progress >= 1).length,
      event: state.event?.kind ?? null,
      camera: { locked: cam.locked, current: cam.current?.kind ?? null, pending: cam.queue.length,
        eventKind:cam.current?.eventKind??null,nickname:cam.current?.nickname??null,
        remainingMs:cam.current?.until===Infinity?0:Math.max(0,(cam.current?.until??now())-now()),idleWaitMs:cam.idleWaitMs,
        queue:simulator?cam.queue.map(q=>({kind:q.kind,eventKind:q.eventKind,nickname:q.nickname,plotId:q.plotId,priority:q.priority,ageMs:Math.max(0,now()-q.at)})):undefined },
      eventState:simulator&&state.event?{kind:state.event.kind,phase:state.event.phase,endsAt:state.event.endsAt}:null,
      competition: garden.competition.status(),boss:garden.boss.status(),
      tiers: TIERS.map(t => ({ id: t.id, label: t.label, viewers: plots.filter(p => p.tier === t.id && p.owner && now() - p.lastActive < garden.cfg.sleepAfterMs).length })),
    };
  };
  const publicStatus = () => {
    const s = status();
    return { build:s.build,serverTime:s.serverTime,viewers:s.viewers,planted:s.planted,ripe:s.ripe,event:s.event,competition:s.competition,boss:s.boss,tiers:s.tiers };
  };
  const reset = async () => {
    if (!simulator) throw new Error('reset-simulator-only');
    receipts.length=0;stopAuto(); autoUsers.clear(); autoSeq = autoCursor = autoPulse = autoGift = 0; autoProfile = 'normal';
    Object.assign(state, emptyGardenState(now()));
    coalescer = createCoalescer({ now });
    garden = newGarden();
    camera = createCamera({ cfg: garden.cfg, now, isSecondaryReady:()=>displays.ready(), getPlots: () => Object.values(state.plots).filter(p => p.owner && now() - p.lastActive < garden.cfg.sleepAfterMs) });
    lastShot = null;
    for (const c of hub.clients) c.seen = {};
    hub.broadcast('reset', { ok: true });
    saver.markDirty();
    await saver.flush();
    return status();
  };

  const frame = setInterval(() => {
    garden.tick();
    const shot = camera.tick();
    if (shot?.kind === 'event' && shot.eventKind) garden.events.present(shot.eventKind);
    if (shot) { lastShot = shot; hub.broadcast('shot', shot); }
    const fx = coalescer.flush();
    for (const c of hub.clients) {
      if (c.busy()) continue;
      const parts = garden.changes(c.seen);
      if (fx.length || Object.keys(parts).length) c.send('frame', { parts, fx });
    }
  }, FRAME_MS);

  // Behind a quick tunnel SSE does not stream, so pages can poll instead: first call opens a session, later calls drain it.
  const pollers = new Map();
  const reaper = setInterval(() => { for (const [id, c] of pollers) if (Date.now() - c.lastPoll > 15000) { pollers.delete(id); hub.remove(c); } }, 5000);

  let scenarioSnapshot=null;
  function restoreScenario(){
    if(!scenarioSnapshot)throw Object.assign(new Error('no-scenario-snapshot'),{status:409});
    stopAuto();const saved=structuredClone(scenarioSnapshot.state),delta=Math.max(0,now()-scenarioSnapshot.at);
    const rebase=value=>{for(const [key,v] of Object.entries(value??{})){if(v&&typeof v==='object')rebase(v);else if(Number.isFinite(v)&&v>1e11&&(/At$|Until$/.test(key)||['at','until'].includes(key)))value[key]=v+delta;}};rebase(saved);
    for(const key of Object.keys(state))if(!(key in saved))delete state[key];Object.assign(state,saved);
    autoUsers.clear();for(const [id,user] of scenarioSnapshot.auto)autoUsers.set(id,structuredClone(user));autoSeq=scenarioSnapshot.autoSeq;autoCursor=autoPulse=autoGift=0;
    garden=newGarden();camera=createCamera({cfg:garden.cfg,now,isSecondaryReady:()=>displays.ready(),getPlots:()=>Object.values(state.plots).filter(p=>p.owner)});
    coalescer=createCoalescer({now});receipts.length=0;lastShot=null;for(const c of hub.clients)c.seen={};hub.broadcast('reset',{ok:true});saver.markDirty();
    return {ok:true,label:'Phục hồi phòng',expected:'Đã giữ LV/vàng/cây trước lần thử; bot đang dừng'};
  }
  function runScenario(b){
    const kind=String(b.scenario??'');
    const kinds=['newcomer1','group4','room12','room24','room42','careburst42','room48','careburst48','cardspam100','giftburst30','bossinterrupt','shield','no-target','destruction','awardreload','audioquiet','audiobusy','restore'];
    if(!kinds.includes(kind))throw Object.assign(new Error('invalid-scenario'),{status:400});
    if(kind==='restore')return restoreScenario();
    if(!scenarioSnapshot)scenarioSnapshot={state:structuredClone(state),auto:[...autoUsers.entries()],autoSeq,at:now()};else restoreScenario();
    stopAuto();let seed=Number.isSafeInteger(b.seed)?b.seed:42;garden.ctx.rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const count=kind==='newcomer1'||kind==='no-target'||kind==='audioquiet'?1:kind==='group4'?4:/42|48|audiobusy/.test(kind)?garden.cfg.activeCapacity:/24/.test(kind)?24:12;
    setAutoRoom(count);garden.ctx.limiter=createLimiter(now);
    const people=[...autoUsers.values()].map(u=>({...u,userId:'sim:'+u.userId})),giver=people[0];
    const gift=(diamonds)=>garden.gift({...giver,diamonds,count:1});
    if(['careburst42','careburst48','audioquiet','audiobusy'].includes(kind))for(const u of people)garden.chat({...u,comment:'tưới'});
    if(kind==='cardspam100')for(let i=0;i<100;i++)garden.chat({...people[i%people.length],comment:'vườn'});
    if(kind==='giftburst30')for(let i=0;i<30;i++)gift(50);
    if(kind==='bossinterrupt'){for(let i=0;i<4;i++)gift(50);garden.boss.force();}
    if(['shield','no-target','destruction'].includes(kind)){
      for(const p of Object.values(state.plots))if(p.owner&&p.owner!==giver.userId){p.shieldUntil=p.blessingUntil=kind==='shield'?now()+60000:0;if(kind==='no-target')p.crop=null;p.ver=++state.ver;}
      gift(kind==='destruction'?1000:500);
    }
    if(kind==='awardreload')garden.competition.finish();
    saver.markDirty();return {ok:true,runId:`${build}:${eventSeq}`,label:kind,expected:kind==='bossinterrupt'?'Boss phải hiện; quà không che arena':kind==='giftburst30'?'Cảnh chờ dài ≤12s, ghi công đủ quà':kind==='cardspam100'?'Không modal/zoom; một yêu cầu hồ sơ mới nhất':kind==='shield'?'Khiên chặn phá':kind==='no-target'?'Kết quả không có mục tiêu, không phá nhầm':'Đối chiếu trạng thái native, cảnh, hàng đợi và âm trên nguồn phát',status:status()};
  }
  const API = {
    'display-status': b=>displays.update(b),
    'display-remove': b=>displays.remove(b.clientId),
    'audio-command': b=>displays.command(b.clientId,b.command),
    'tiktok/connect': async b=>{
      if(simulator)throw Object.assign(new Error('TikTok connection is disabled in the isolated simulator.'),{status:403});
      if(!bridge)throw Object.assign(new Error('TikTok connector is disabled for this server.'),{status:503});
      const username=String(b.username??'').replace(/^@/,'').trim();
      if(!/^[\w.]{2,24}$/.test(username))throw Object.assign(new Error('invalid-tiktok-username'),{status:400});
      await bridge.connect(username);return tiktokStatus();
    },
    'tiktok/disconnect': async ()=>{if(!bridge)return tiktokStatus();await bridge.disconnect();return tiktokStatus();},
    'sim-scenario': b=>runScenario(b),
    'camera-lock': b => { camera.setLock(Boolean(b.on)); return { locked: Boolean(b.on) }; },
    event: b => {
      if(state.boss?.phase==='active')throw Object.assign(new Error('boss-active'),{status:409});
      const type = String(b.type);
      if (!EVENT_TYPES.includes(type)) throw Object.assign(new Error('invalid-event-type'), { status: 400 });
      garden.events.force(type);
      return { event: type };
    },
    boss: () => garden.boss.force(),
    'session/finish': () => garden.competition.finish(),
    sim: b => {
      const id=String(b.user?.userId??'x').slice(0,48);
      const user = { userId: 'sim:' + id, nickname: String(b.user?.nickname ?? 'Người xem').slice(0, 32), avatar: `/garden/assets/avatar-${[...id].reduce((n,c)=>n+c.codePointAt(0),0)%6+1}.svg` };
      if (b.kind === 'like') return garden.like({ ...user, count: Number(b.count) || 1 });
      if (b.kind === 'gift') return garden.gift({ ...user, diamonds: Number(b.diamonds) || 1, count: Number(b.count) || 1 });
      return garden.chat({ ...user, comment: String(b.comment ?? '').slice(0, 120) });
    },
    'sim-room': b => {
      const action = String(b.action ?? 'status');
      if (action === 'add' || action === 'set') return setAutoRoom(b.count, String(b.profile ?? autoProfile));
      if (action === 'start') return startAuto(String(b.profile ?? autoProfile));
      if (action === 'stop') return stopAuto();
      if (action === 'burst') { autoStep(); return autoStatus(); }
      return autoStatus();
    },
    reset,
  };

  function serveFile(res, p) {
    const target = path.resolve(p);
    if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return void res.writeHead(404).end('not found');
    fs.readFile(target, (err, buf) => {
      if (err) return void res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(buf);
    });
  }

  function serveMusic(req, res, name) {
    const rel = String(name).replaceAll('\\', '/');
    const file = path.resolve(musicDir, ...rel.split('/'));
    if (!musicFiles.has(rel) || !file.startsWith(musicDir + path.sep)) return void res.writeHead(404).end('not found');
    let realFile, stat;
    try { realFile = fs.realpathSync(file); stat = fs.statSync(realFile); } catch { return void res.writeHead(404).end('not found'); }
    if (!realFile.startsWith(musicRoot + path.sep) || !stat.isFile()) return void res.writeHead(404).end('not found');
    const size = stat.size, type = AUDIO_TYPES[path.extname(realFile).toLowerCase()];
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!match) {
      res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'max-age=86400' });
      return void fs.createReadStream(realFile).pipe(res);
    }
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return void res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
    res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
    fs.createReadStream(realFile, { start, end }).pipe(res);
  }

  const HOST_ONLY = new Set(['/control','/control.html','/garden/control','/garden/control.html','/garden/control.js','/garden/control.css','/garden/audio-library.js']);
  const sharedReadable = p => p === '/' || p === '/events' || p === '/poll' || p === '/api/status' || p === '/music.js' || p === '/sfx.js' || p.startsWith('/garden/') || p.startsWith('/fonts/') || p.startsWith('/music/');
  const handler = shared => async (req, res) => {
    if (shared ? !['GET','HEAD'].includes(req.method) : !trusted(req)) return void res.writeHead(shared ? 405 : 403).end('forbidden');
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return void res.writeHead(400).end('bad request'); }
    if (shared && (!sharedReadable(url.pathname) || HOST_ONLY.has(url.pathname))) return void res.writeHead(404).end('not found');
    if (url.pathname === '/api/status' && req.method === 'GET') return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(shared ? publicStatus() : status()));
    if (url.pathname.startsWith('/music/')) {
      let name;
      try { name = decodeURIComponent(url.pathname.slice(7)); } catch { return void res.writeHead(400).end('bad request'); }
      return serveMusic(req, res, name);
    }
    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const c = { seen: {}, host: !shared, busy: () => res.writableNeedDrain, send: (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) };
      c.send('meta', meta());
      if(c.host)c.send('tiktok',tiktokStatus());
      c.send('frame', { parts: garden.changes(c.seen), fx: [] });
      c.send('receipts',recentReceipts());
      if (lastShot) c.send('shot', lastShot);
      hub.add(c);
      req.on('close', () => hub.remove(c));
      return;
    }
    if (url.pathname === '/poll') {
      let id = url.searchParams.get('id'), c = pollers.get(id);
      if (!c) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const queue = [];
        c = { seen: {}, host: !shared, lastPoll: Date.now(), queue, wake: null, busy: () => queue.length > 400,
          send: (event, data) => {
            const last = queue.at(-1);
            if (event === 'frame' && last?.event === 'frame') { Object.assign(last.data.parts, data.parts); last.data.fx = last.data.fx.concat(data.fx); } // a page that is behind gets one merged frame
            else queue.push({ event, data });
            c.wake?.();
          } };
        pollers.set(id, c);
        hub.add(c);
        c.send('meta', meta());
        if(c.host)c.send('tiktok',tiktokStatus());
        c.send('frame', { parts: garden.changes(c.seen), fx: [] });
        c.send('receipts',recentReceipts());
        if (lastShot) c.send('shot', lastShot);
      }
      c.lastPoll = Date.now();
      if (url.searchParams.has('wait') && !c.queue.length) {
        await new Promise(done => { const timer = setTimeout(done, 8000); c.wake = () => { clearTimeout(timer); done(); }; req.on('close', c.wake); });
        c.wake = null;
        c.lastPoll = Date.now();
      }
      return void res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ id, msgs: c.queue.splice(0) }));
    }
    const api = url.pathname.startsWith('/api/') && Object.hasOwn(API, url.pathname.slice(5)) && API[url.pathname.slice(5)];
    if (api && req.method === 'POST') {
      const route = url.pathname.slice(5);
      if (!simulator && ['sim', 'sim-room', 'reset', 'boss','sim-scenario'].includes(route)) return void res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'simulator-only' }));
      try {
        const result = await api(await readBody(req));
        saver.markDirty();
        return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, result: result ?? null }));
      }
      catch (e) { return void res.writeHead(e.status ?? 500, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: e?.message ?? String(e) })); }
    }
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { return void res.writeHead(400).end('bad request'); }
    serveFile(res, path.join(PUBLIC, p === '/' ? 'garden/index.html' : p === '/control' || p === '/garden/control' ? 'garden/control.html' : p));
  };

  const listen = (server, p) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(p, '127.0.0.1', () => resolve(server.address().port)); });
  const main = http.createServer(handler(false));
  const boundPort = await listen(main, port);
  let share = null, boundSharePort;
  if (!simulator && sharePort != null) {
    share = http.createServer(handler(true));
    try { boundSharePort = await listen(share, Number(sharePort)); }
    catch (e) { main.closeAllConnections?.(); await new Promise(r => main.close(r)); throw e; }
  }

  if (tiktok && !bridge) {
    const [{ createTikTokBridge }, { createDiagnostics }] = await Promise.all([import('../tiktok.mjs'), import('../diagnostics.mjs')]);
    const diag = createDiagnostics({ dir: process.env.PK_LOG_DIR ?? path.join(root, 'logs'), record: Boolean(full.recordEvents || process.env.PK_RECORD) });
    bridge = createTikTokBridge({ game: diag.wrap(garden), probe: diag.probe, onStatus: s => hub.broadcast('tiktok', s, true) });
  }
  if (bridge && full.tiktokUsername && !simulator) void bridge.connect(full.tiktokUsername);
  log(`Vườn Mây running:\n  overlay  http://127.0.0.1:${boundPort}/\n  control  http://127.0.0.1:${boundPort}/control${boundSharePort != null ? `\n  share (read-only)  http://127.0.0.1:${boundSharePort}/` : ''}`);

  return {
    port: boundPort, sharePort: boundSharePort, url: `http://127.0.0.1:${boundPort}/`, shareUrl: boundSharePort == null ? undefined : `http://127.0.0.1:${boundSharePort}/`, get garden(){return garden;},get camera(){return camera;},
    async close() {
      clearInterval(frame); clearInterval(reaper); stopAuto();
      await bridge?.disconnect?.();
      await saver.flush(); saver.stop();
      for (const c of hub.clients) c.wake?.();
      share?.closeAllConnections?.(); main.closeAllConnections?.();
      if (share) await new Promise(r => share.close(r));
      await new Promise(r => main.close(r));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const simulator = process.argv.includes('--simulator');
  const running = startGardenServer(simulator ? {
    simulator: true,
    dir: process.env.PK_GARDEN_SIM_DATA_DIR ?? path.join(root, 'data', 'garden-simulator'),
    tiktok: false,
  } : { sharePort: Number(process.env.PK_GARDEN_SHARE_PORT || 4859) });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void running.then(server => server.close()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  running.catch(e => { console.error(e); process.exit(1); });
}
