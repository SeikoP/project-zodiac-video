import test from 'node:test';import assert from 'node:assert/strict';
import {assessGardenPreflight} from './preflight.mjs';

const healthy={simulator:false,build:'rev-3',runtimeSourceChanged:false,diagnosticsVersion:2,
 tiktok:{state:'live'},displays:[{role:'live',clientId:'main',build:'rev-3',stale:false,visibility:'visible',fps:30,audio:{muted:false},camera:{serverSceneId:'rev-3:1',serverPhase:'hold'}}]};

test('offline preflight never claims TikTok Studio has been manually certified',()=>{
 const report=assessGardenPreflight(healthy,{mode:'live'});
 assert.equal(report.offlineReady,true);
 assert.equal(report.studioVerified,false);
 assert.equal(report.fullyReady,false);
 assert.ok(report.manualChecks.some(s=>/âm thanh/i.test(s)));
});

test('preflight rejects simulator accidentally used for live and stale or old build source',()=>{
 assert.equal(assessGardenPreflight({...healthy,simulator:true},{mode:'live'}).offlineReady,false);
 assert.equal(assessGardenPreflight({...healthy,displays:[{...healthy.displays[0],stale:true}]},{mode:'live'}).offlineReady,false);
 assert.equal(assessGardenPreflight({...healthy,displays:[{...healthy.displays[0],build:'rev-2'}]},{mode:'live'}).offlineReady,false);
 assert.equal(assessGardenPreflight({...healthy,runtimeSourceChanged:true},{mode:'live'}).offlineReady,false);
});

test('simulator preflight does not demand TikTok credentials or run the LIVE bridge',()=>{
 const result=assessGardenPreflight({...healthy,simulator:true,tiktok:{state:'off'},displays:[]},{mode:'sim'});
 assert.equal(result.offlineReady,true);
 assert.equal(result.fullyReady,false);
});