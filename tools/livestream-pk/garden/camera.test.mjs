import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from './camera.mjs';
import { gardenConfig } from './config.mjs';

const cfg=gardenConfig();
function rig(plots=[]){let t=1_000_000;const cam=createCamera({cfg,now:()=>t,getPlots:()=>plots});return{cam,advance:ms=>{t+=ms;}};}
const gift=(tier,plotId='cloud-1:3')=>({type:'gift',tier,plotId,total:1,nickname:'Mai'});

test('overview is stable home state',()=>{
 const r=rig([{tier:'cloud-1',slot:0,owner:'a'}]);
 assert.equal(r.cam.tick().kind,'overview');
 r.advance(60_000);
 assert.equal(r.cam.tick(),null);
});

test('join never moves the camera',()=>{
 const r=rig();
 r.cam.push({type:'joined',plotId:'cloud-1:2'});
 assert.equal(r.cam.state().queue.length,0);
});

test('stable reading time starts after travel finishes',()=>{
 const r=rig();
 r.cam.push(gift('dew'));
 const s=r.cam.tick();
 assert.equal(s.kind,'gift');
 assert.equal(s.travelMs,cfg.camera.easeMs);
 assert.ok(s.stableMs>=cfg.camera.stableMinMs);
 r.advance(s.travelMs+s.stableMs-1);
 assert.equal(r.cam.tick(),null);
 r.advance(2);
 assert.equal(r.cam.tick().kind,'overview');
});

test('queued beats cannot interrupt the current readable window',()=>{
 const r=rig();
 r.cam.push(gift('dew','cloud-1:1'));
 const first=r.cam.tick();
 r.cam.push({type:'steal',plotId:'cloud-1:2',thiefPlotId:'cloud-1:7'});
 r.advance(first.travelMs+first.stableMs-1);
 assert.equal(r.cam.tick(),null);
 r.advance(2);
 assert.equal(r.cam.tick().kind,'steal');
});

test('queue is capped at seven meaningful beats',()=>{
 const r=rig();
 for(let i=0;i<20;i++)r.cam.push({type:'steal',plotId:`cloud-1:${i%20}`,thiefPlotId:`cloud-1:${(i+1)%20}`});
 assert.equal(r.cam.state().queue.length,cfg.camera.queueMax);
 assert.equal(cfg.camera.queueMax,7);
});

test('event has first priority',()=>{
 const r=rig();
 r.cam.push(gift('dew'));
 r.cam.push({type:'event-start',kind:'rain'});
 assert.equal(r.cam.tick().kind,'event');
});

test('same-pot gift packets coalesce',()=>{
 const r=rig();
 r.cam.push(gift('dew','cloud-1:1'));
 r.advance(300);r.cam.push(gift('star','cloud-1:1'));
 assert.equal(r.cam.state().queue.length,1);
 assert.equal(r.cam.state().queue[0].giftKind,'star');
});

test('locking clears pending beats',()=>{
 const r=rig();r.cam.push(gift('tree'));r.cam.setLock(true);
 assert.equal(r.cam.state().queue.length,0);assert.equal(r.cam.tick(),null);
});
