import test from 'node:test';import assert from 'node:assert/strict';
import {createDisplays} from './displays.mjs';
test('source readiness never confuses preview, stale and a busy LIVE source',()=>{
 let time=1000;const d=createDisplays({now:()=>time,simulator:true});
 assert.equal(d.ready(),false);
 d.update({clientId:'preview',role:'preview',idle:{waitMs:0,primary:0}});assert.equal(d.ready(),true);
 d.update({clientId:'live',role:'live',idle:{waitMs:6000,primary:1}});assert.equal(d.ready(),false);
 d.update({clientId:'live',role:'live',idle:{waitMs:0,primary:0}});assert.equal(d.ready(),true);
 time+=3001;assert.equal(d.ready(),false);assert.equal(d.list()[0].stale,true);
 assert.throws(()=>d.update({clientId:'bad',role:'unknown'}));
 assert.throws(()=>d.update({clientId:'bad',role:'live',audio:{big:'x'.repeat(9000)}}));
 time+=30000;assert.deepEqual(d.list(),[]);
});

test('stale or mismatched LIVE build prevents idle camera but not native events',()=>{
 let time=1000;const d=createDisplays({now:()=>time,simulator:true,expectedBuild:'rev-2'});
 d.update({clientId:'live',role:'live',build:'rev-1',idle:{waitMs:0,primary:0}});
 assert.equal(d.ready(),false);
 d.update({clientId:'live',role:'live',build:'rev-2',idle:{waitMs:0,primary:0}});
 assert.equal(d.ready(),true);
 time+=3001;assert.equal(d.ready(),false);
});