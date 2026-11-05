import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from './camera.mjs';
import { gardenConfig } from './config.mjs';

const cfg=gardenConfig();
function rig(plots=[],idle=true){let t=1_000_000;const cam=createCamera({cfg,now:()=>t,getPlots:()=>plots});if(idle)t+=cfg.camera.idleMs;return{cam,advance:ms=>{t+=ms;}};}
const gift=(tier,plotId='cloud-1:3')=>({type:'gift',tier,plotId,total:1,nickname:'Mai'});

test('large gifts stay in overview without a redundant giver close-up',()=>{
 const r=rig();r.cam.push({...gift('rain'),affected:12,effects:[{plotId:'cloud-1:3',from:.1,to:.2}]});
 const wide=r.cam.tick();assert.equal(wide.giftWide,true);assert.ok(wide.zoom<1.25);assert.equal(wide.affected,12);
 r.advance(wide.holdMs+1);const close=r.cam.tick();
 assert.equal(close.kind,'overview');assert.ok(close.zoom<1.25);
});

test('a large gift without a seat still gets the garden-wide presentation',()=>{
 const r=rig();r.cam.push({...gift('rain',null),affected:48,effects:[]});
 const shot=r.cam.tick();assert.equal(shot.giftWide,true);assert.ok(shot.zoom<1.25);
 r.advance(shot.holdMs+1);assert.equal(r.cam.tick().kind,'overview');
});

test('gift bursts retain the strongest tier and aggregate real progress without double counting a pot',()=>{
 const r=rig();
 r.cam.push({...gift('star'),total:5,affected:1,effects:[{plotId:'cloud-1:3',from:.1,to:.55}]});
 r.advance(200);r.cam.push({...gift('dew'),total:1,affected:1,effects:[{plotId:'cloud-1:3',from:.55,to:.65}]});
 const shot=r.cam.tick();assert.equal(shot.giftKind,'star');assert.equal(shot.total,6);assert.equal(shot.affected,1);
 assert.deepEqual(shot.effects,[{plotId:'cloud-1:3',from:.1,to:.65}]);
});

test('rack uses the bottom of the frame while leaving the expanded header clear',()=>{
 const shot=rig().cam.tick();const sy=y=>(y-shot.y)*shot.zoom+960;
 assert.ok(sy(cfg.zoneMarginY-132)>=345);
 assert.ok(sy(cfg.zoneMarginY+7*cfg.shelfSpacingY+110)>=1840);
 assert.ok(sy(cfg.zoneMarginY+7*cfg.shelfSpacingY+110)<=1910);
 assert.ok(100*cfg.potScale*shot.zoom>=125);
});

test('close shot enlarges the plant and reserves space beside it for its card',()=>{
 const r=rig();r.cam.push({type:'levelup',plotId:'cloud-1:3'});const shot=r.cam.tick();
 const pos={x:cfg.zoneMarginX,y:cfg.zoneMarginY+cfg.shelfSpacingY};
 const x=(pos.x-shot.x)*shot.zoom+540;
 assert.ok(shot.zoom>=2.2);assert.ok(x>=300&&x<=400);
});

test('garden cards and basic feedback never move the camera',()=>{
 const r=rig();r.cam.push({type:'action-feedback',plotId:'cloud-1:3',ok:false,reason:'cooldown',message:'Đợi 2 giây'});
 assert.equal(r.cam.state().queue.length,0);
 r.cam.push({type:'card',plotId:'cloud-1:3'});assert.equal(r.cam.tick().kind,'overview');
 const s=rig();s.cam.push({type:'action-feedback',plotId:'cloud-1:3',ok:true,action:'pest',message:'Đã sạch sâu'});
 s.cam.push({type:'action-feedback',plotId:'cloud-1:4',ok:true,action:'water'});
 assert.equal(s.cam.state().queue.length,0);assert.equal(s.cam.tick().kind,'overview');
});

test('ripe crops and harvests never zoom even on the first occurrence',()=>{
 const r=rig();
 for(const type of ['water','ripe','harvest'])for(const first of [true,false])r.cam.push({type,plotId:'cloud-1:3',first});
 assert.equal(r.cam.state().queue.length,0);assert.equal(r.cam.tick().kind,'overview');
});

test('event opens in overview then visits a relevant growing plot',()=>{
 const r=rig([{id:'cloud-1:3',tier:'cloud-1',slot:3,owner:'a',crop:{type:'rau',progress:.5}}]);
 r.cam.push({type:'event-start',kind:'rain'});const opening=r.cam.tick();assert.equal(opening.kind,'event');
 r.cam.push({type:'event-active',kind:'rain'});r.advance(opening.holdMs+cfg.camera.idleMs+1);
 const close=r.cam.tick();assert.equal(close.kind,'event-focus');assert.equal(close.plotId,'cloud-1:3');
 assert.equal(close.eventKind,'rain');assert.ok(close.zoom>=2.2);
});

test('ending an event removes its queued close-up instead of showing a stale event',()=>{
 const r=rig([{id:'cloud-1:3',crop:{progress:.5},owner:'a'}]);
 r.cam.push({type:'event-start',kind:'rain'});r.cam.tick();
 r.cam.push({type:'event-active',kind:'rain'});
 r.cam.push({type:'event-end',kind:'rain'});
 assert.equal(r.cam.state().queue.length,0);assert.equal(r.cam.tick().kind,'overview');
});

test('theft and catch keep the same clear space beside the victim as gift close-ups',()=>{
 for(const type of ['steal','catch']){
  const r=rig();r.cam.push({type,plotId:'cloud-1:3',thiefPlotId:'cloud-1:4'});const shot=r.cam.tick();
  assert.equal(shot.zoom,cfg.camera.zoomClose);
  const x=(cfg.zoneMarginX-shot.x)*shot.zoom+540;assert.ok(x>=300&&x<=400);
 }
});

test('overview is stable home state',()=>{
 const r=rig([{tier:'cloud-1',slot:0,owner:'a'}]);
 assert.equal(r.cam.tick().kind,'overview');
 r.advance(60_000);
 assert.equal(r.cam.tick(),null);
});

test('close-ups are brief and bursts leave a readable overview between them',()=>{
 const r=rig();r.cam.push({type:'levelup',plotId:'cloud-1:1'});
 const first=r.cam.tick();assert.ok(first.holdMs<=3500);
 r.cam.push({type:'steal',plotId:'cloud-1:2'});r.advance(first.holdMs+1);
 const wide=r.cam.tick();assert.equal(wide.kind,'overview');
 r.advance(cfg.camera.overviewEaseMs+cfg.camera.overviewHoldMs-1);assert.equal(r.cam.tick(),null);
 r.advance(2);assert.equal(r.cam.tick().kind,'steal');
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
 assert.equal(s.travelMs,cfg.camera.overviewEaseMs);
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
 assert.equal(r.cam.tick().kind,'overview');
 r.advance(cfg.camera.idleMs);assert.equal(r.cam.tick().kind,'steal');
});

test('secondary zoom waits six quiet seconds and a gift burst restarts the wait',()=>{
 const r=rig([],false);r.cam.push({type:'levelup',plotId:'cloud-1:1'});
 assert.equal(r.cam.tick().kind,'overview');r.advance(5999);assert.equal(r.cam.tick(),null);
 r.cam.push(gift('dew'));const first=r.cam.tick();assert.equal(first.kind,'gift');
 r.advance(first.holdMs+1);assert.equal(r.cam.tick().kind,'overview');
 r.advance(5998);assert.equal(r.cam.tick(),null);r.advance(2);assert.equal(r.cam.tick().kind,'levelup');
});

test('queue is capped at seven meaningful beats',()=>{
 const r=rig();
 for(let i=0;i<20;i++)r.cam.push({type:'steal',plotId:`cloud-1:${i%20}`,thiefPlotId:`cloud-1:${(i+1)%20}`});
 assert.equal(r.cam.state().queue.length,cfg.camera.queueMax);
 assert.equal(cfg.camera.queueMax,7);
});

test('gifts have priority over routine event presentation',()=>{
 const r=rig();
 r.cam.push(gift('dew'));
 r.cam.push({type:'event-start',kind:'rain'});
 assert.equal(r.cam.tick().kind,'gift');
});

test('a gift preempts a non-gift camera beat after 800ms, and keeps the camera in overview',()=>{
 const r=rig();r.cam.push({type:'steal',plotId:'cloud-1:2'});assert.equal(r.cam.tick().kind,'steal');
 r.cam.push(gift('meteor'));r.advance(801);const shot=r.cam.tick();assert.equal(shot.kind,'gift');assert.ok(shot.zoom<1.25);
});

test('boss entrance takes the stage and discards obsolete camera beats',()=>{
 const r=rig([{id:'cloud-1:3',crop:{progress:.3},owner:'a'}]);
 r.cam.push({type:'event-active',kind:'rain'});r.cam.push(gift('dew'));r.cam.push({type:'boss-start'});
 assert.equal(r.cam.state().queue.some(q=>q.kind==='event-focus'),false);assert.equal(r.cam.tick().kind,'boss');
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

test('overview fits the complete two-wing structure even with only one occupant', () => {
  const r = rig([{ tier: 'cloud-1', slot: 0, owner: 'a' }]);
  const shot = r.cam.tick();
  const firstY = cfg.zoneMarginY - 166;
  const lastY = cfg.zoneMarginY + (cfg.shelvesPerWing - 1) * cfg.shelfSpacingY + cfg.potBottomOffset + cfg.potShelfGap + 54;
  const screenY = world => (world - shot.y) * shot.zoom + 960;
  assert.ok(screenY(firstY) > 240, 'rack stays below top HUD');
  assert.ok(screenY(lastY) < 1910, 'rack uses the bottom of the frame');
  assert.equal(shot.zoom >= cfg.camera.zoomWorld, true);
});

test('portrait rack makes every pot readable while fitting all 48 seats',()=>{
 const shot=rig().cam.tick();
 assert.ok(100*cfg.potScale*shot.zoom>=115,'overview pots exceed 115px');
 assert.ok((cfg.shelvesPerWing-1)*cfg.shelfSpacingY*shot.zoom>1100,'shelves fill height');
});

test('overview spreads both visual rack wings across most of the portrait play area', () => {
  const plots = [{tier:'cloud-1',slot:0,owner:'a'},{tier:'cloud-1',slot:24,owner:'b'}];
  const r = rig(plots), shot = r.cam.tick();
  const left = { x: cfg.zoneMarginX, y: cfg.zoneMarginY };
  const right = { x: cfg.zoneMarginX + (cfg.potsPerShelf - 1) * cfg.potSpacingX + (cfg.rackWingGapX ?? 0), y: cfg.zoneMarginY };
  const bottomLeft = { x: left.x, y: cfg.zoneMarginY + 3 * cfg.shelfSpacingY };
  const sx = p => (p.x - shot.x) * shot.zoom + 540;
  const sy = p => (p.y - shot.y) * shot.zoom + 960;
  assert.ok(sx(right) - sx(left) > 420, 'left/right wings visibly separate');
  assert.ok(sy(bottomLeft) - sy(left) > 360, 'four enlarged shelves use substantial vertical space');
  assert.ok(shot.zoom >= .5, 'overview no longer shrinks into a thin tower');
});
