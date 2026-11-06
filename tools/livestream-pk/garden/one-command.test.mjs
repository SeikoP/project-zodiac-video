import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';
import { makeCtx, addUser } from './testkit.mjs';
import { ensureUser, seat, managePresence, isAwake } from './world.mjs';

function rig(config={}) {
  let t=1_800_000_000_000;const events=[];
  const g=createGarden({now:()=>t,rng:()=>.5,onEvent:e=>events.push(e),config:{bossChance:0,pestChancePerSec:0,weedChancePerSec:0,...config}});
  const say=(comment='chăm',id='a')=>g.chat({userId:id,nickname:id.toUpperCase(),comment});
  const plot=id=>Object.values(g.state.plots).find(p=>p.owner===(id??'a'));
  return {g,say,plot,events,step:(ms=1600)=>{t+=ms;g.tick();}};
}

test('chăm alone plants, cares, harvests exactly once, scores and replants',()=>{
  const k=rig();const first=k.say();assert.equal(first.ok,true);assert.equal(first.resolvedAction,'plant');
  const p=k.plot(),u=k.g.state.users.a;assert.equal(p.crop.type,'rau');assert.equal(u.gold,16);
  p.crop.pest=true;p.crop.weeds=true;
  k.step();assert.equal(k.say().resolvedAction,'pest');assert.equal(p.crop.pest,false);
  k.step();assert.equal(k.say('cham').resolvedAction,'weed');assert.equal(p.crop.weeds,false);
  k.step();assert.equal(k.say().resolvedAction,'water');assert.equal(u.gold,17);
  p.crop.progress=1;p.crop.ripeAt=k.g.ctx.now();p.crop.pest=true;
  k.step();const result=k.say();assert.equal(result.resolvedAction,'harvest');assert.equal(result.ok,true);assert.equal(p.crop,null);
  assert.equal(u.stats.harvest,1);assert.equal(u.career.harvests,1);assert.equal(u.xp,6);
  assert.equal(k.events.filter(e=>e.type==='harvest').length,1);
  assert.equal(k.say().reason,'cooldown');assert.equal(u.stats.harvest,1);
  k.step();assert.equal(k.say().resolvedAction,'plant');assert.ok(p.crop);
});

test('care auto-selection validates funds and honors free replant recovery',()=>{
  const k=rig();k.say('vườn');const u=k.g.state.users.a,p=k.plot();u.level=4;u.gold=20;
  assert.equal(k.say().crop,'nammay');assert.equal(u.gold,2);
  p.crop=null;k.step();assert.equal(k.say().reason,'gold');assert.equal(u.gold,2);
  p.replantCredit=true;k.step();assert.equal(k.say().crop,'rau');assert.equal(u.gold,2);assert.equal(p.replantCredit,false);
});

test('care mentions never plant or harvest another player crop',()=>{
  const k=rig();k.say();k.say('vườn','b');k.step();
  const gold=k.g.state.users.a.gold;
  assert.equal(k.say('chăm @b').reason,'no-crop');assert.equal(k.plot('b').crop,null);
  k.plot('b').crop={type:'rau',progress:1,ripeAt:k.g.ctx.now(),pest:true,weeds:false,stolen:0};
  k.step();assert.equal(k.say('chăm @b').resolvedAction,'pest');assert.ok(k.plot('b').crop);assert.equal(k.g.state.users.b.stats.harvest,0);
  assert.equal(k.g.state.users.a.gold,gold);
});

test('care joins the cooperative pest storm through the native pest action',()=>{
  const k=rig({stormShare:1});k.say();k.say('chăm','b');
  k.g.events.force('pests');k.g.events.present('pests');k.plot().crop.pest=false;
  k.step();assert.equal(k.say().resolvedAction,'pest');assert.equal(k.plot('b').crop.pest,false);
});

test('sparse pots stay visible and growing without comments until the session ends',()=>{
  const k=rig();k.say();const p=k.plot();
  for(let i=0;i<50;i++)k.step(10000);
  assert.equal(p.owner,'a');assert.equal(p.sleeping,false);assert.equal(isAwake(k.g.ctx,p),true);assert.ok(p.crop.progress>0);
  assert.equal(k.g.changes({}).plots[p.id].awake,true);
  k.g.competition.finish();k.step(8000);assert.equal(p.owner,null);assert.equal(p.crop,null);
});

test('near-full arrivals reclaim only one stale pot, preferring empty pots and keeping progression',()=>{
  const k=makeCtx();const entries=Array.from({length:35},(_,i)=>addUser(k.ctx,'u'+i,{gold:77,level:5}));
  for(const x of entries)x.plot.crop={type:'rau',progress:.5};
  k.advance(180001);managePresence(k.ctx);
  const arrival=id=>seat(k.ctx,ensureUser(k.ctx,{userId:id}));
  assert.ok(arrival('new-1'));assert.ok(entries[0].user.seat,'35/42 does not reclaim');
  entries[8].plot.crop=null;
  assert.equal(arrival('new-2').id,entries[8].plot.id);assert.equal(entries[8].user.seat,null);
  assert.deepEqual([entries[8].user.gold,entries[8].user.level],[77,5]);
  assert.equal(Object.values(k.ctx.state.plots).filter(p=>p.owner).length,36);
  assert.equal(arrival('new-3').id,entries[0].plot.id);
});

test('full rooms never take active empty pots and reuse stale crops only on demand',()=>{
  const k=makeCtx({cfg:{activeCapacity:2}});const a=addUser(k.ctx,'a'),b=addUser(k.ctx,'b');
  const late=ensureUser(k.ctx,{userId:'late'});assert.equal(seat(k.ctx,late),null);
  a.plot.crop={type:'rau',progress:.5};b.plot.crop={type:'rau',progress:.5};
  k.advance(180001);assert.deepEqual(managePresence(k.ctx),{sleeping:0,evicted:0});
  assert.ok(a.user.seat);assert.equal(seat(k.ctx,late).id,a.plot.id);assert.ok(b.user.seat);
});

test('loading a legacy sleeping pot restores growth and visibility without resetting its activity',()=>{
  const k=rig();k.say();const p=k.plot(),at=p.lastActive;p.sleeping=true;
  const g=createGarden({state:k.g.state,now:k.g.ctx.now,config:{bossChance:0}});
  assert.equal(p.sleeping,false);assert.equal(p.lastActive,at);assert.equal(g.changes({}).plots[p.id].awake,true);
});
