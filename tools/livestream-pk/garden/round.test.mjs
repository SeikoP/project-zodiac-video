import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';

function rig(rng=()=>.5){
 let time=1800000000000;const events=[];
 const g=createGarden({now:()=>time,rng,onEvent:e=>events.push(e),config:{sleepAfterMs:1e9,evictAfterMs:1e9,pestChancePerSec:0,weedChancePerSec:0}});
 const chat=(comment,id='a')=>g.chat({userId:id,nickname:id,comment});
 const plot=(id='a')=>Object.values(g.state.plots).find(p=>p.owner===id);
 return {g,events,chat,plot,step:ms=>{time+=ms;g.tick();}};
}

test('awards are idempotent and reset round resources after eight seconds, keeping progression',()=>{
 const k=rig();k.chat('trồng rau');const u=k.g.state.users.a,p=k.plot();
 u.xp=29;u.gold=80;p.shieldUntil=Infinity;
 const completed=k.g.competition.finish();
 assert.equal(k.g.competition.status().session.phase,'awards');assert.equal(u.xp,44);assert.equal(u.level,2);
 assert.equal(completed.podium[0].rewardXp,15);
 k.g.competition.finish();assert.equal(u.xp,44);assert.ok(p.crop);
 assert.equal(k.chat('tưới').reason,'awards');
 const queued=k.g.gift({userId:'a',nickname:'a',diamonds:5,count:1});assert.equal(queued.queued,true);
 k.step(7999);assert.equal(k.g.state.session.no,1);
 k.step(1);assert.equal(k.g.state.session.no,2);assert.equal(u.xp,44);assert.equal(u.gold,20);
 assert.equal(u.titles.podium1,1);assert.equal(k.plot().crop.type,'rau');assert.equal(k.plot().crop.progress,.2);assert.equal(k.plot().shieldUntil,0);
 assert.equal(Object.values(k.g.state.plots).filter(p=>p.crop).length,1);
 assert.equal(k.events.filter(e=>e.type==='gift').length,1);assert.equal(k.events.filter(e=>e.type==='round-start').length,1);
 assert.equal(k.g.state.users.a.stats.harvest,0);
});

test('watering and fertilizer change the actual growth rate and the public level meter',()=>{
 const k=rig();k.chat('trồng rau');k.step(1600);k.chat('tưới');
 let view=k.g.changes({}).plots[k.plot().id];assert.equal(view.growth.bonusPercent,25);
 const before=k.plot().crop.progress;k.step(1000);
 assert.ok(Math.abs(k.plot().crop.progress-before-1.25/180)<1e-9);
 k.step(600);k.chat('bón phân');view=k.g.changes({}).plots[k.plot().id];assert.equal(view.growth.bonusPercent,48);
 k.step(30001);view=k.g.changes({}).plots[k.plot().id];assert.equal(view.growth.bonusPercent,18);
});

test('roulette uses one server result, skips protected rivals and expires without destroying crops',()=>{
 const k=rig(()=>.99);k.chat('trồng rau');k.chat('trồng rau','b');const p=k.plot('b');
 const result=k.g.gift({userId:'a',nickname:'a',diamonds:50,count:1});
 assert.equal(result.tier,'roulette');assert.equal(result.roulette.targetId,'b');assert.equal(p.crop.weeds,true);
 assert.equal(k.events.findLast(e=>e.type==='gift').roulette.id,result.roulette.id);
 k.step(20001);assert.equal(p.crop.weeds,false);assert.ok(p.crop);
 p.shieldUntil=Infinity;
 const fallback=k.g.gift({userId:'a',nickname:'a',diamonds:99,count:1});assert.equal(fallback.roulette.targetId,'a');
});

test('all six wheel outcomes affect the selected plot and temporary effects expire',()=>{
 for(let i=0;i<6;i++){
  const k=rig(()=>i/6+.01);k.chat('trồng rau');k.chat('trồng rau','b');
  const p=k.plot(),rival=k.plot('b'),before=rival.crop.progress;
  const result=k.g.gift({userId:'a',nickname:'a',diamonds:50,count:1}).roulette;
  assert.equal(result.index,i);assert.equal(result.targetId,i<3?'a':'b');
  if(i===0)assert.equal(k.g.changes({}).plots[p.id].growth.bonusPercent,30);
  if(i===1)assert.equal(p.crop.fertilized,true);
  if(i===2)assert.ok(p.shieldUntil>0);
  if(i===3)assert.equal(k.g.changes({}).plots[rival.id].growth.bonusPercent,-25);
  if(i===4)assert.equal(rival.water,0);
  if(i===5)assert.equal(rival.crop.weeds,true);
  assert.ok(rival.crop.progress>=before);k.step(61000);
  assert.equal(rival.prank,null);assert.equal(rival.crop.weeds,false);assert.ok(rival.water>0);
  assert.equal(k.g.changes({}).plots[p.id].growth.bonusPercent,i===1?18:0);
 }
});

test('repairing wheel pranks prevents expiry from undoing the repair; shields handle empty pots',()=>{
 const k=rig(()=>.7);k.chat('trồng rau');k.chat('trồng rau','b');
 const b=k.plot('b');b.water=.1;k.g.gift({userId:'a',diamonds:50,count:1});assert.equal(b.prank.kind,'dry');
 k.step(1600);assert.equal(k.chat('tưới','b').ok,true);assert.equal(b.prank,null);k.step(20001);assert.ok(b.water>.9);
 k.g.ctx.rng=()=>.99;k.g.gift({userId:'a',diamonds:50,count:1});assert.equal(b.prank.kind,'weeds');
 k.chat('nhổ cỏ','b');assert.equal(b.prank,null);k.step(20001);assert.equal(b.crop.weeds,false);
 const empty=rig(()=>.9);empty.chat('chào');
 const r=empty.g.gift({userId:'a',diamonds:50,count:1});assert.equal(r.roulette.kind,'shield');assert.ok(empty.plot().shieldUntil>0);
});

test('saved award state resumes without paying twice, then replays queued gifts exactly once',()=>{
 const k=rig();k.chat('trồng rau');k.g.competition.finish();k.g.gift({userId:'a',diamonds:50,count:1});
 const state=JSON.parse(JSON.stringify(k.g.state)),xp=state.users.a.xp;let time=state.session.awardsUntil-1;const events=[];
 const resumed=createGarden({state,now:()=>time,onEvent:e=>events.push(e)});
 resumed.competition.finish();assert.equal(state.users.a.xp,xp);resumed.tick();assert.equal(state.session.phase,'awards');
 time++;resumed.tick();assert.equal(state.session.no,2);assert.equal(state.users.a.xp,xp);
 resumed.tick();assert.equal(events.filter(e=>e.type==='gift').length,1);assert.equal(state.users.a.gold,20);
 assert.equal(state.users.a.titles.podium1,1);
});

test('roulette never picks a weed or drought prank that would do nothing',()=>{
 const k=rig(()=>.99);k.chat('trồng rau');k.chat('trồng rau','b');
 k.plot('b').water=0;k.plot('b').crop.weeds=true;
 const result=k.g.gift({userId:'a',diamonds:50,count:1}).roulette;
 assert.equal(result.kind,'slow');assert.equal(result.targetId,'b');
});
