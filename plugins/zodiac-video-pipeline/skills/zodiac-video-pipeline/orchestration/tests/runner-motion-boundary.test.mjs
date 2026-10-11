import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRunnerMotionBoundary} from '../validate-runner-motion-boundary.mjs';
const ir=(motion)=>({scenes:[{id:'S01',events:[{id:'E01',desired_motion:motion}]}]});
test('accept only supported canonical motions',()=>assert.equal(validateRunnerMotionBoundary(ir('state_swap')).ok,true));
test('reject legacy alias rather than silently dropping event duration',()=>{
 const result=validateRunnerMotionBoundary(ir('state_swap_8f'));
 assert.equal(result.ok,false);assert.equal(result.issues[0].code,'RUNNER_MOTION_ALIAS_UNSUPPORTED');
});
test('reject unknown names',()=>assert.equal(validateRunnerMotionBoundary(ir('spin')).issues[0].code,'UNSUPPORTED_MOTION'));
test('fail closed on runner capability mismatch',()=>assert.throws(()=>validateRunnerMotionBoundary(ir('hold'),{runnerMotions:['hold']}),/MOTION_REGISTRY_RUNNER_MISMATCH/));
