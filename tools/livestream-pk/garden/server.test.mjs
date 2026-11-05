import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startGardenServer } from './server.mjs';

async function boot(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garden-srv-'));
  const s = await startGardenServer({ port: 0, dir, tiktok: false, simulator: true, log: () => {}, ...over });
  return { s, base: `http://127.0.0.1:${s.port}` };
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('simulator scenarios preserve a room snapshot and restore it without touching live mode',async()=>{
 const {s,base}=await boot({config:{garden:{bossChance:0}}});
 try{
  await post(base+'/api/sim-room',{action:'set',count:4});const gold=s.garden.state.users['sim:auto-0'].gold;
  const run=await post(base+'/api/sim-scenario',{scenario:'bossinterrupt'}).then(r=>r.json());assert.equal(run.ok,true);assert.equal(s.garden.state.boss.phase,'active');
  assert.equal((await post(base+'/api/sim-scenario',{scenario:'unknown'})).status,400);
  await post(base+'/api/sim-scenario',{scenario:'restore'});assert.equal(s.garden.state.users['sim:auto-0'].gold,gold);assert.notEqual(s.garden.state.boss?.phase,'active');
 }finally{await s.close();}
 const live=await boot({simulator:false});try{assert.equal((await post(live.base+'/api/sim-scenario',{scenario:'room48'})).status,403);}finally{await live.s.close();}
});
test('new subscribers recover gift receipts and display telemetry is local and ephemeral',async()=>{
 const {s,base}=await boot({config:{garden:{bossChance:0}}});
 try{
  await post(base+'/api/sim',{kind:'gift',user:{userId:'giver'},diamonds:50});
  const poll=await fetch(base+'/poll').then(r=>r.json());
  assert.ok(poll.msgs.find(m=>m.event==='receipts')?.data.length);
  assert.equal((await post(base+'/api/display-status',{clientId:'test',role:'live',idle:{waitMs:0,primary:0}})).status,200);
  const status=await fetch(base+'/api/status').then(r=>r.json());assert.equal(status.displays[0].clientId,'test');
  assert.equal(s.garden.state.displays,undefined);
 }finally{await s.close();}
});

test('simulator avatar and camera diagnostics reach status and the completed Top 5 snapshot',async()=>{
 const {s,base}=await boot({config:{garden:{bossChance:0}}});
 try{
  await post(base+'/api/sim-room',{action:'set',count:6});
  let status=await fetch(base+'/api/status').then(r=>r.json());
  assert.equal(status.diagnosticsVersion,1);assert.ok(Array.isArray(status.camera.queue));
  assert.ok(status.competition.standings.every(u=>/^\/garden\/assets\/avatar-[1-6]\.svg$/.test(u.avatar)));
  const finished=await post(base+'/api/session/finish',{}).then(r=>r.json());
  assert.equal(finished.result.standings.length,5);assert.equal(finished.result.podium.length,3);
  assert.ok(finished.result.standings.every(u=>u.avatar));
 }finally{await s.close();}
});

test('simulator handles all gift tiers, boss clock pause and blocks forced weather during combat',async()=>{
 let time=1_800_000_000_000;const {s,base}=await boot({now:()=>time,config:{garden:{bossChance:0}}});
 try{
  for(const id of ['giver','r1','r2','r3','r4'])await post(base+'/api/sim',{kind:'chat',user:{userId:id,nickname:id},comment:'trồng'});
  const gift=diamonds=>post(base+'/api/sim',{kind:'gift',user:{userId:'giver',nickname:'giver'},diamonds,count:1}).then(r=>r.json()).then(r=>r.result);
  assert.ok((await gift(50)).roulette);
  const meteor=await gift(500);assert.equal(meteor.impact.mode,'garden');assert.equal(meteor.impact.destroyed.length,1);
  const quake=await gift(1000);assert.equal(quake.impact.destroyed.length,3);
  await post(base+'/api/boss',{});const before=await fetch(base+'/api/status').then(r=>r.json());assert.ok(before.competition.session.pausedAt);
  assert.equal((await post(base+'/api/event',{type:'rain'})).status,409);
  time+=10000;const hit=await gift(1000);assert.equal(hit.impact.mode,'boss');
  await post(base+'/api/sim',{kind:'like',user:{userId:'giver'},count:10000});
  const after=await fetch(base+'/api/status').then(r=>r.json());assert.equal(after.competition.session.pausedAt,null);
  assert.equal(after.competition.session.endsAt-before.competition.session.endsAt,10000);
 }finally{await s.close();}
});

test('autoplay cycles through roulette and destructive gifts using the native gift path',async()=>{
 let time=1_800_000_000_000;const {s,base}=await boot({now:()=>time,config:{garden:{bossChance:0}}});
 try{
  await post(base+'/api/sim-room',{action:'set',count:12,profile:'stress'});
  const events=[];const emit=s.garden.ctx.emit;s.garden.ctx.emit=e=>{events.push(e);emit(e);};
  for(let i=0;i<36;i++){time+=2000;await post(base+'/api/sim-room',{action:'burst'});}
  const gifts=events.filter(e=>e.type==='gift');
  for(const tier of ['roulette','meteor','cataclysm'])assert.ok(gifts.some(e=>e.tier===tier),tier);
 }finally{await s.close();}
});

test('simulator bots replant using the same automatic level selection as viewers',async()=>{
 let time=1_800_000_000_000;const {s,base}=await boot({now:()=>time});
 try{
  await post(base+'/api/sim-room',{action:'set',count:1});
  const user=s.garden.state.users['sim:auto-0'],plot=s.garden.state.plots[`${user.seat.tier}:${user.seat.slot}`];
  Object.assign(user,{level:4,gold:20});plot.crop=null;time+=2000;
  await post(base+'/api/sim-room',{action:'burst'});
  assert.equal(plot.crop.type,'nammay');
 }finally{await s.close();}
});

test('boss simulator hearts retain viewer identity and the debug boss route is simulator-only',async()=>{
 const {s,base}=await boot();
 try{
  const user={userId:'boss-fan',nickname:'An'};
  await post(base+'/api/sim',{kind:'chat',user,comment:'chào'});
  const forced=await (await post(base+'/api/boss',{})).json();assert.equal(forced.result.boss.phase,'active');
  const hit=await (await post(base+'/api/sim',{kind:'like',user,count:50})).json();assert.equal(hit.result.damage,50);
  assert.equal(s.garden.state.boss.contributors['sim:boss-fan'].damage,50);
 }finally{await s.close();}
 const live=await boot({simulator:false});
 try{assert.equal((await post(live.base+'/api/boss',{})).status,403);}finally{await live.s.close();}
});

test('native comment API explains blocked commands and persists timed session rollover',async()=>{
 let time=1_800_000_000_000;
 const {s,base}=await boot({now:()=>time,config:{garden:{sleepAfterMs:1e9,evictAfterMs:1e9}}});
 try{
  const chat=comment=>post(base+'/api/sim',{kind:'chat',user:{userId:'a',nickname:'An'},comment}).then(r=>r.json());
  assert.equal((await chat('trồng rau')).result.ok,true);
  const blocked=(await chat('tưới')).result;assert.equal(blocked.ok,false);assert.equal(blocked.retryAfterMs,1500);assert.match(blocked.message,/giây/);
  time+=600001;s.garden.tick();assert.equal(s.garden.state.session.phase,'awards');
  assert.equal((await chat('tưới')).result.reason,'awards');
  time+=8000;s.garden.tick();assert.equal(s.garden.state.session.no,2);
  const status=await (await fetch(base+'/api/status')).json();assert.equal(status.competition.session.no,2);
  assert.equal(status.competition.session.endsAt-status.competition.session.startedAt,600000);
  assert.equal(s.garden.state.users['sim:a'].gold,20);assert.equal(s.garden.state.users['sim:a'].seat,null);
 }finally{await s.close();}
});

test('the page is served and a simulated viewer shows up in the first poll', async () => {
  const { s, base } = await boot();
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Vườn Mây/);
    const control = await fetch(base + '/control');
    assert.equal(control.status, 200);
    assert.match(await control.text(), /Bàn điều khiển/);
    const r = await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'chào' });
    assert.equal(r.status, 200);
    const first = await (await fetch(base + '/poll')).json();
    const events = first.msgs.map(m => m.event);
    assert.ok(events.includes('meta') && events.includes('frame'));
    const frame = first.msgs.find(m => m.event === 'frame').data;
    const plots = Object.values(frame.parts.plots);
    assert.equal(plots.length, 1);
    assert.equal(plots[0].owner.nickname, 'Xuân');
  } finally { await s.close(); }
});

test('simulator sets room size and realism profile instead of accumulating bots', async () => {
  const { s, base } = await boot();
  try {
    const set6 = await (await post(base + '/api/sim-room', { action:'set', count:6, profile:'normal' })).json();
    assert.deepEqual(set6.result, { running:false, bots:6, profile:'normal', target:6 });

    const set3 = await (await post(base + '/api/sim-room', { action:'set', count:3, profile:'busy' })).json();
    assert.deepEqual(set3.result, { running:false, bots:3, profile:'busy', target:3 });

    const started = await (await post(base + '/api/sim-room', { action:'start', profile:'busy' })).json();
    assert.deepEqual(started.result, { running:true, bots:3, profile:'busy', target:3 });
    const status = await (await fetch(base + '/api/status')).json();
    assert.deepEqual(status.autoplay, { running:true, bots:3, profile:'busy', target:3 });

    const stopped = await (await post(base + '/api/sim-room', { action:'stop' })).json();
    assert.deepEqual(stopped.result, { running:false, bots:3, profile:'busy', target:3 });
  } finally { await s.close(); }
});

test('a simulated gift is queued behind the current camera shot instead of interrupting it', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/sim', { kind: 'chat', user: { userId: 'x', nickname: 'Xuân' }, comment: 'chào' });
    await new Promise(r => setTimeout(r, 220));
    await post(base + '/api/sim', { kind: 'gift', user: { userId: 'x', nickname: 'Xuân' }, diamonds: 100, count: 1 });
    const status = await (await fetch(base + '/api/status')).json();
    assert.ok(status.camera.pending >= 1, 'gift waits instead of cutting the welcome shot');
  } finally { await s.close(); }
});

test('Garden runs the overlay, control and poll through one port', async () => {
  const { s, base } = await boot();
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/control')).status, 200);
    assert.equal((await fetch(base + '/poll')).status, 200);
    assert.equal(s.sharePort, undefined);
  } finally { await s.close(); }
});

test('the camera can be locked from the host panel', async () => {
  const { s, base } = await boot();
  try {
    await post(base + '/api/camera-lock', { on: true });
    assert.equal(s.camera.state().locked, true);
  } finally { await s.close(); }
});

test('static files cannot escape the public folder', async () => {
  const { s, base } = await boot();
  try {
    const r = await fetch(base + '/..%2f..%2fpackage.json');
    assert.notEqual(r.status, 200);
  } finally { await s.close(); }
});
