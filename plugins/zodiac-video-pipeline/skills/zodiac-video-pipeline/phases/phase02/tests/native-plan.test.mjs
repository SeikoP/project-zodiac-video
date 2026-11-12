import test from 'node:test';
import assert from 'node:assert/strict';
import {phase02NativeSteps} from '../phase02-native-plan.mjs';
import {validateStepGraph,PHASE02_DEPENDENCIES,LEGACY_PHASE02_DEPENDENCIES} from '../../../core/workflow/deterministic-execution.mjs';

test('all fresh and continuity native plans retain valid dependency order',()=>{
 for(const currentVisual of [false,true])for(const narrationPerformance of [false,true])for(const modernComposition of [false,true])for(const finalizeManifest of [false,true]){
  const steps=phase02NativeSteps('E:/test-workspace',{currentVisual,narrationPerformance,modernComposition,finalizeManifest});
  assert.equal(validateStepGraph(steps,currentVisual?PHASE02_DEPENDENCIES:LEGACY_PHASE02_DEPENDENCIES,{strictMissing:true}).status,'PASS');
  assert.equal(steps.some(s=>s.id==='narration_performance'),narrationPerformance);
  assert.equal(steps.some(s=>s.id==='scene_set_identity'),!currentVisual);
  assert.equal(steps.some(s=>s.id==='composition_resolved'),modernComposition);
  assert.equal(steps.some(s=>s.id==='director_final_review'),finalizeManifest);
 }
});

test('each plan is independent and narration validation precedes native asset writes',()=>{
 const plan=phase02NativeSteps('E:/workspace',{narrationPerformance:true});
 assert.equal(plan[0].id,'narration_performance');plan.pop();
 assert.equal(phase02NativeSteps('E:/workspace').at(-1).id,'publish_prep');
});
