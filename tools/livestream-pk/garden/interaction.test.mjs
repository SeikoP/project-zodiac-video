import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden } from './garden.mjs';
import { CROPS } from './crops.mjs';
import { makeCtx, addUser } from './testkit.mjs';
import { applyGift } from './gifts.mjs';
import { tickPlots } from './care.mjs';
import { createEvents } from './events.mjs';
import { managePresence } from './world.mjs';
import * as view from '../public/garden/view.js';

function rig(config={}) {
 let time=1_800_000_000_000;const events=[];
 const garden=createGarden({config,now:()=>time,rng:()=>.5,onEvent:e=>events.push(e)});
 const say=(comment,id='a')=>garden.chat({userId:id,nickname:id.toUpperCase(),comment});
 const plot=(id='a')=>Object.values(garden.state.plots).find(p=>p.owner===id);
 return {garden,events,say,plot,advance:ms=>{time+=ms;garden.tick();}};
}

test('short crop times and idle reclamation preserve the returning player progression',()=>{
 assert.deepEqual(Object.values(CROPS).map(c=>c.growMs),[180000,240000,300000]);
 const k=makeCtx(),a=addUser(k.ctx,'a',{gold:45,level:5});a.plot.crop={type:'rau',progress:.3};
 k.advance(180001);managePresence(k.ctx);
 assert.equal(a.user.seat,null);assert.deepEqual([a.user.gold,a.user.level],[45,5]);assert.equal(a.plot.crop,null);
});

test('failed comments emit actionable feedback with the actual remaining cooldown',()=>{
 const k=rig();k.say('trồng rau');const blocked=k.say('tưới');
 assert.equal(blocked.reason,'cooldown');assert.ok(blocked.retryAfterMs>0);
 const feedback=k.events.at(-1);assert.equal(feedback.type,'action-feedback');assert.equal(feedback.ok,false);
 assert.match(feedback.message,/chờ|Đợi/i);assert.ok(feedback.plotId);
 k.advance(1600);k.say('tưới');k.advance(1600);
 const again=k.say('tưới');assert.ok(again.retryAfterMs>10000&&again.retryAfterMs<15000);
 assert.match(again.message,/giây/);
});

test('chăm resolves pests and weeds before watering, without spending gold',()=>{
 const k=rig();k.say('trồng rau');const p=k.plot();p.crop.pest=true;p.crop.weeds=true;
 const gold=k.garden.state.users.a.gold;
 k.advance(1600);assert.equal(k.say('chăm').ok,true);assert.equal(p.crop.pest,false);assert.equal(p.crop.weeds,true);
 k.advance(1600);assert.equal(k.say('cham').ok,true);assert.equal(p.crop.weeds,false);
 p.water=.1;k.advance(1600);assert.equal(k.say('chăm').ok,true);assert.equal(p.water,1);
 assert.ok(k.garden.state.users.a.gold>=gold);
});

test('invalid seed names do not silently plant another crop; card requests have a plot address',()=>{
 const k=rig();const result=k.say('trồng chuối');assert.equal(result.reason,'unknown-crop');assert.equal(k.plot().crop,null);
 k.advance(1600);k.say('vườn');assert.ok(k.events.findLast(e=>e.type==='card').plotId);
});

test('ten-minute sessions celebrate once before a clean round; manual completion uses the same ceremony',()=>{
 const k=rig({sleepAfterMs:1e9,evictAfterMs:1e9});assert.equal(k.garden.state.session,null);
 k.say('trồng rau');const p=k.plot(),gold=k.garden.state.users.a.gold;
 const session=k.garden.competition.status().session;assert.equal(session.endsAt-session.startedAt,600000);
 k.advance(600001);assert.equal(k.garden.state.session.phase,'awards');assert.ok(p.crop);assert.equal(k.garden.state.users.a.gold,gold);
 k.advance(8000);assert.equal(k.garden.state.session.no,2);assert.equal(p.crop,null);assert.equal(p.owner,null);assert.equal(k.garden.state.users.a.gold,20);
 assert.equal(k.events.filter(e=>e.type==='session-end').length,1);
 k.advance(600001);assert.equal(k.garden.state.session.no,2,'empty rounds wait for participation');
 k.say('vườn');k.garden.competition.finish();assert.equal(k.garden.state.session.phase,'awards');k.advance(8000);assert.equal(k.garden.state.session.no,3);
});

test('gift roles include fertilizer, garden weeding and a temporary protection blessing',()=>{
 const k=makeCtx(),a=addUser(k.ctx,'a'),b=addUser(k.ctx,'b');
 for(const p of [a.plot,b.plot])p.crop={type:'rau',progress:.1,pest:false,weeds:true,fertilized:false,stolen:0};
 applyGift(k.ctx,a.user,{diamonds:5,count:1});assert.equal(a.plot.crop.fertilized,true);
 b.plot.water=.1;applyGift(k.ctx,a.user,{diamonds:100,count:1});assert.equal(b.plot.water,1);assert.equal(b.plot.crop.weeds,false);
 applyGift(k.ctx,a.user,{diamonds:1000,count:1});assert.ok(a.plot.blessingUntil>k.ctx.now());assert.equal(b.plot.crop,null);a.plot.crop.progress=.2;
 assert.equal(k.events.at(-1).impact.destroyed.length,1);
 const weather=createEvents(k.ctx);weather.force('pests');weather.present('pests');assert.equal(weather.current().total,0,'protected crops do not receive a fresh storm infestation');
 k.ctx.rng=()=>0;k.advance(1000);tickPlots(k.ctx);assert.equal(a.plot.crop.pest,false);
 k.advance(60001);tickPlots(k.ctx);assert.equal(a.plot.crop.pest,true,'blessing expires instead of permanent immunity');
 assert.equal(a.user.xp,0);assert.equal(b.user.gold,0);
});

test('a full room reports why it cannot seat a newcomer without retaining a ghost user',()=>{
 const k=rig({activeCapacity:1});k.say('trồng rau');
 const result=k.say('trồng rau','b');assert.equal(result.reason,'no-room');assert.match(result.message,/đầy/);
 assert.equal(k.garden.state.users.b,undefined);assert.equal(k.events.at(-1).type,'action-feedback');
});

test('problem overlays show an actionable command then pause before repeating',()=>{
 const p={crop:{pest:true},owner:{},awake:true,water:1,lastActive:1000};
 const problem=view.plotProblem(p,1000,{sleepAfterMs:90000});assert.equal(problem.command,'bắt sâu');
 const first=view.problemPresentation(null,problem,1000);assert.equal(first.until,5000);
 const quiet=view.problemPresentation(first,problem,7000);assert.ok(quiet.until<7000);assert.ok(quiet.nextAt>7000);
 const next=view.problemPresentation(quiet,problem,quiet.nextAt);assert.ok(next.until>quiet.nextAt);
 assert.equal(view.problemPresentation(first,null,2000),null);
});

test('blocked harvest and planting suggest an action that can actually resolve the problem',()=>{
 assert.equal(view.feedbackCommand({ok:false,action:'harvest',reason:'not-ripe'}),'chăm');
 assert.equal(view.feedbackCommand({ok:false,action:'plant',reason:'gold'}),'tưới @tên');
 assert.equal(view.feedbackCommand({ok:false,action:'water',reason:'no-crop'}),'trồng');
 assert.equal(view.feedbackCommand({ok:true,action:'harvest'}),'trồng');
});
