import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { createEvents, modifiers, EVENT_TYPES } from './events.mjs';
import { plant, catchPests, harvest } from './care.mjs';

const grow=plot=>{plot.crop={type:'rau',progress:.1,ripeAt:null,pest:false,stolen:0};};

test('rain actually waters awake crops and merchant buys a crop present in the garden',()=>{
 const k=makeCtx(),a=addUser(k.ctx,'a');grow(a.plot);a.plot.water=0;
 const ev=createEvents(k.ctx);ev.force('rain');ev.present('rain');assert.equal(a.plot.water,1);
 ev.force('merchant');ev.present('merchant');assert.equal(ev.current().crop,'rau');
});

test('weather starts immediately without waiting for camera presentation',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('rain');
 assert.equal(ev.current().phase,'active');assert.equal(modifiers(k.ctx).grow,2);
 const end=ev.current().endsAt;k.advance(5000);assert.equal(ev.current().endsAt,end);
 ev.present('rain');
 assert.equal(ev.current().phase,'active');assert.equal(modifiers(k.ctx).grow,2);
 assert.equal(ev.current().endsAt-k.ctx.now(),k.ctx.cfg.rainMs-5000);
});

test('golden pays double independently of presentation',()=>{
 const k=makeCtx();k.ctx.mods=()=>modifiers(k.ctx);
 const a=addUser(k.ctx,'a',{gold:20}),ev=createEvents(k.ctx);ev.force('golden');
 plant(k.ctx,a.user,'rau');a.plot.crop.progress=1;a.plot.crop.ripeAt=k.ctx.now();
 const normal=harvest(k.ctx,a.user).gold;assert.equal(normal,20);
 plant(k.ctx,a.user,'rau');a.plot.crop.progress=1;a.plot.crop.ripeAt=k.ctx.now();
 ev.present('golden');assert.equal(harvest(k.ctx,a.user).gold,20);
});

test('merchant selects its boosted crop when it becomes active',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('merchant');
 assert.ok(modifiers(k.ctx).boost);
 ev.present('merchant');
 const b=modifiers(k.ctx).boost;assert.equal(b.mult,2);assert.ok(['rau','huongduong','nammay'].includes(b.crop));
});

test('pest storm applies pests on presentation and rewards 80 percent clear',()=>{
 const k=makeCtx(),users=Array.from({length:10},(_,i)=>addUser(k.ctx,'u'+i));
 users.forEach(u=>grow(u.plot));const ev=createEvents(k.ctx);k.ctx.onPestCleared=(id,plotId)=>ev.notePestCleared(id,plotId);
 ev.force('pests');assert.equal(users.filter(u=>u.plot.crop.pest).length,5);
 ev.present('pests');const sick=users.filter(u=>u.plot.crop.pest);assert.equal(sick.length,5);
 for(const u of sick.slice(0,4))catchPests(k.ctx,u.user);
 k.advance(k.ctx.cfg.pestStormMs+1);ev.tick();
 assert.equal(sick[0].user.gold,5);assert.equal(sick[4].user.gold,0);
});

test('storm assistance clears a neighbor and credits each affected plot once',()=>{
 const k=makeCtx(), users=Array.from({length:4},(_,i)=>addUser(k.ctx,'u'+i));
 users.forEach(u=>grow(u.plot));const ev=createEvents(k.ctx);
 k.ctx.onPestCleared=(id,plotId)=>ev.notePestCleared(id,plotId);
 ev.force('pests');ev.present('pests');
 const hit=users.filter(u=>u.plot.crop.pest),helper=users.find(u=>!u.plot.crop.pest);
 assert.equal(catchPests(k.ctx,helper.user,hit[0].user).ok,true);
 assert.equal(hit[0].plot.crop.pest,false);
 ev.notePestCleared(helper.user.userId,hit[0].plot.id);
 ev.notePestCleared(helper.user.userId,'cloud-1:999');
 assert.equal(ev.current().cleared,1);
 k.advance(k.ctx.cfg.pestStormMs);ev.tick();
 assert.equal(helper.user.gold,0,'below target pays nothing');
});

test('bare pest command helps storm targets when own crop is clean; success pays once',()=>{
 const k=makeCtx(),users=Array.from({length:4},(_,i)=>addUser(k.ctx,'u'+i));
 users.forEach(u=>grow(u.plot));const ev=createEvents(k.ctx);
 k.ctx.onPestCleared=(id,plotId)=>ev.notePestCleared(id,plotId);
 ev.force('pests');ev.present('pests');
 const helper=users.find(u=>!u.plot.crop.pest);
 assert.equal(catchPests(k.ctx,helper.user).ok,true);
 assert.equal(catchPests(k.ctx,helper.user).ok,true);
 assert.equal(ev.current().cleared,2);
 k.advance(k.ctx.cfg.pestStormMs);ev.tick();ev.tick();
 assert.equal(helper.user.gold,k.ctx.cfg.stormReward);
 assert.equal(k.events.at(-1).reward,k.ctx.cfg.stormReward);
});

test('a one-crop garden gets a playable storm and expired clears cannot earn credit',()=>{
 const k=makeCtx(),a=addUser(k.ctx,'a');grow(a.plot);const ev=createEvents(k.ctx);
 ev.force('pests');ev.present('pests');assert.equal(ev.current().total,1);
 k.advance(k.ctx.cfg.pestStormMs);ev.notePestCleared('a',a.plot.id);
 assert.equal(ev.current().cleared,0);
 ev.tick();assert.equal(a.user.gold,0);
 a.plot.crop=null;ev.force('pests');ev.present('pests');
 assert.equal(ev.current().total,0);
 k.advance(k.ctx.cfg.pestStormMs);ev.tick();assert.equal(a.user.gold,0);
});

test('weather advances without a director or overlay and never remains pending indefinitely',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('rain');k.advance(120000);ev.tick();
 assert.equal(ev.current(),null);
});

test('scheduled events still avoid immediate repeats',()=>{
 let r=0;const k=makeCtx({rng:()=>r}),ev=createEvents(k.ctx),kinds=[];
 for(let n=0;n<4;n++){
   r=n%2?.99:0;
   while(!ev.current()){k.advance(1000);ev.tick();}
   kinds.push(ev.current().kind);ev.present(ev.current().kind);
   k.advance(k.ctx.cfg[{rain:'rainMs',pests:'pestStormMs',merchant:'merchantMs',golden:'goldenMs'}[ev.current().kind]]+1);ev.tick();
 }
 for(let i=1;i<kinds.length;i++)assert.notEqual(kinds[i],kinds[i-1]);
 assert.ok(kinds.every(x=>EVENT_TYPES.includes(x)));
});
