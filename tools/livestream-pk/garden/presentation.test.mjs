import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresentationQueue,SCENE_MS} from '../public/garden/presentation.js';

test('gift moments own more stage time than routine profile comments',()=>{
 assert.ok(SCENE_MS.gift>SCENE_MS.profile);
 assert.ok(SCENE_MS.roulette>SCENE_MS.gift);
 assert.ok(SCENE_MS.impact>SCENE_MS.gift);
});
test('a gift burst has a bounded scene budget and boss takes the stage immediately',()=>{
 let time=0;const q=createPresentationQueue(()=>time);
 for(let i=0;i<30;i++)q.push({type:'gift',id:String(i),nickname:'Bạn '+i,roulette:{label:'Gió'}});
 assert.ok(q.snapshot().primaryBudgetMs<=12000);
 q.tick();assert.equal(q.tick({boss:true}),null);assert.equal(q.snapshot().primary,0);
 assert.ok(q.drainNotices().length>0);
});
test('checkpoint restores elapsed scene time without restarting a gift',()=>{
 let time=0;const q=createPresentationQueue(()=>time);q.push({type:'gift',id:'one',roulette:{}});q.tick();
 time=1000;const saved=q.checkpoint(50000),r=createPresentationQueue(()=>time);
 assert.equal(r.restore(saved,50500),true);assert.equal(r.tick().restored,true);
 assert.equal(Math.round(r.tick().until-time),2700);
});

test('gifts immediately preempt idle profiles and priority never cuts an unfinished gift',()=>{
 let time=0;const q=createPresentationQueue(()=>time);
 q.push({type:'card',userId:'a'});assert.equal(q.tick(),null);
 time=6000;assert.equal(q.tick().kind,'profile');
 q.push({type:'gift',id:'low'});assert.equal(q.tick().id,'low');
 q.push({type:'card',userId:'b'});q.push({type:'gift',id:'wheel',roulette:{}});q.push({type:'gift',id:'high',impact:{}});
 assert.equal(q.tick().id,'low');time+=2601;assert.equal(q.tick().id,'high');time+=3201;assert.equal(q.tick().id,'wheel');time+=4201;assert.equal(q.tick(),null);
 time+=6000;assert.equal(q.tick(),null,'gift-heavy sequences may expire stale profile requests instead of stealing stage time');
});

test('duplicate gift IDs do not repeat and only the newest profile request is kept',()=>{
 const q=createPresentationQueue(()=>0);q.push({type:'gift',id:'one'});q.push({type:'gift',id:'one'});
 for(let i=0;i<50;i++)q.push({type:'card',userId:String(i)});
 assert.equal(q.pending(),2);assert.equal(q.tick().id,'one');q.clear();assert.equal(q.tick(),null);
});

test('profile notices wait six seconds after the primary queue drains, including the active gift',()=>{
 let time=0;const q=createPresentationQueue(()=>time);
 q.push({type:'gift',id:'g'});q.push({type:'card',userId:'a'});assert.equal(q.tick().id,'g');
 time=2600;assert.equal(q.tick(),null);time=8599;assert.equal(q.tick(),null);
 time=8600;const a=q.tick();assert.equal(a.userId,'a');assert.equal(a.until,10400);
 q.push({type:'card',userId:'a'});assert.equal(q.pending(),0);
 q.push({type:'card',userId:'b'});time=10400;assert.equal(q.tick(),null);
 time=16599;assert.equal(q.tick(),null);time=16600;assert.equal(q.tick().userId,'b');
});

test('bosses and camera shots block secondary profiles and restart their quiet window',()=>{
 let time=0;const q=createPresentationQueue(()=>time);q.push({type:'card',userId:'a'});
 time=6000;assert.equal(q.tick({blocked:true}),null);time=11999;assert.equal(q.tick(),null);
 time=12000;assert.equal(q.tick().userId,'a');
 time=12100;assert.equal(q.tick({blocked:true}),null);
 q.push({type:'gift',id:'combat',impact:{}});assert.equal(q.tick({blocked:true}).id,'combat');
});
