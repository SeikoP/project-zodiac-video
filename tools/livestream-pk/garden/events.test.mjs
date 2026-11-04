import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, addUser } from './testkit.mjs';
import { createEvents, modifiers, EVENT_TYPES } from './events.mjs';
import { plant, catchPests, harvest } from './care.mjs';

const grow=plot=>{plot.crop={type:'rau',progress:.1,ripeAt:null,pest:false,stolen:0};};

test('an event is neutral while pending and starts its timer only when presented',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('rain');
 assert.equal(ev.current().phase,'pending');assert.equal(modifiers(k.ctx).grow,1);
 k.advance(5000);assert.equal(ev.current().endsAt,null);
 ev.present('rain');
 assert.equal(ev.current().phase,'active');assert.equal(modifiers(k.ctx).grow,2);
 assert.equal(ev.current().endsAt-k.ctx.now(),k.ctx.cfg.rainMs);
});

test('golden pays double only after presentation',()=>{
 const k=makeCtx();k.ctx.mods=()=>modifiers(k.ctx);
 const a=addUser(k.ctx,'a',{gold:20}),ev=createEvents(k.ctx);ev.force('golden');
 plant(k.ctx,a.user,'rau');a.plot.crop.progress=1;a.plot.crop.ripeAt=k.ctx.now();
 const normal=harvest(k.ctx,a.user).gold;assert.equal(normal,10);
 plant(k.ctx,a.user,'rau');a.plot.crop.progress=1;a.plot.crop.ripeAt=k.ctx.now();
 ev.present('golden');assert.equal(harvest(k.ctx,a.user).gold,20);
});

test('merchant selects its boosted crop when it becomes active',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('merchant');
 assert.equal(modifiers(k.ctx).boost,null);
 ev.present('merchant');
 const b=modifiers(k.ctx).boost;assert.equal(b.mult,2);assert.ok(['rau','huongduong','nammay'].includes(b.crop));
});

test('pest storm applies pests on presentation and rewards 80 percent clear',()=>{
 const k=makeCtx(),users=Array.from({length:10},(_,i)=>addUser(k.ctx,'u'+i));
 users.forEach(u=>grow(u.plot));const ev=createEvents(k.ctx);k.ctx.onPestCleared=id=>ev.notePestCleared(id);
 ev.force('pests');assert.equal(users.filter(u=>u.plot.crop.pest).length,0);
 ev.present('pests');const sick=users.filter(u=>u.plot.crop.pest);assert.equal(sick.length,5);
 for(const u of sick.slice(0,4))catchPests(k.ctx,u.user);
 k.advance(k.ctx.cfg.pestStormMs+1);ev.tick();
 assert.equal(sick[0].user.gold,5);assert.equal(sick[4].user.gold,0);
});

test('events remain pending indefinitely until the director presents them',()=>{
 const k=makeCtx(),ev=createEvents(k.ctx);ev.force('rain');k.advance(120000);ev.tick();
 assert.equal(ev.current().phase,'pending');assert.equal(ev.current().endsAt,null);
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
