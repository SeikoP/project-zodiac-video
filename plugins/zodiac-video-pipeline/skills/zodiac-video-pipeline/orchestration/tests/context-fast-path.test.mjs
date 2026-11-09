import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStepContext} from '../plan-step-context.mjs';
import {compileStepCapsule} from '../../core/performance/compile-step-capsule.mjs';

test('Phase 2 draft context defers exit-only capability references',async()=>{
 const plan=await loadStepContext('02-visual-production','visual_compile',{}, {run_mode:'fresh',role:'draft',environment_mode:'canvas'});
 assert.ok(plan.deferred_exit_capabilities.length>0);
 assert.ok(plan.deferred_references.length>0);
 const required=new Set(plan.required_references);
 for(const ref of plan.deferred_references)assert.equal(required.has(ref),false,'deferred ref leaked into default authoring context: '+ref);
});

test('compiled step capsule accepts the already verified resume plan',async()=>{
 const plan=await loadStepContext('02-visual-production','visual_compile',{}, {run_mode:'fresh',role:'draft',environment_mode:'canvas'});
 const capsule=await compileStepCapsule({phase:'02-visual-production',step:'visual_compile',preparedPlan:plan});
 assert.equal(capsule.phase,'02-visual-production');
 assert.equal(capsule.step,'visual_compile');
 assert.deepEqual(capsule.deferred_references,plan.deferred_references);
 assert.equal(capsule.not_an_approval,true);
});
