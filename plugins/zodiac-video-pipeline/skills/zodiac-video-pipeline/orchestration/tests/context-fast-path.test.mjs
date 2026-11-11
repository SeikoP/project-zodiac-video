import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadStepContext} from '../plan-step-context.mjs';
import {compileStepCapsule} from '../../core/performance/compile-step-capsule.mjs';

const flags=JSON.parse(readFileSync(new URL('../pipeline-state.template.json',import.meta.url),'utf8')).flags;

test('Phase 2 draft context defers exit-only capability references',async()=>{
 const plan=await loadStepContext('02-visual-production','visual_compile',flags, {run_mode:'fresh',role:'draft',environment_mode:'canvas'});
 assert.ok(plan.deferred_exit_capabilities.length>0);
 assert.ok(plan.deferred_references.length>0);
 const required=new Set(plan.required_references);
 for(const ref of plan.deferred_references)assert.equal(required.has(ref),false,'deferred ref leaked into default authoring context: '+ref);
});

test('compiled step capsule matches the current source-verified resume scope',async()=>{
 const plan=await loadStepContext('02-visual-production','visual_compile',flags, {run_mode:'fresh',role:'draft',environment_mode:'canvas'});
 const capsule=await compileStepCapsule({phase:'02-visual-production',step:'visual_compile',flags,options:{run_mode:'fresh',role:'draft',environment_mode:'canvas'}});
 assert.equal(capsule.phase,'02-visual-production');
 assert.equal(capsule.step,'visual_compile');
 assert.deepEqual(capsule.deferred_references,plan.deferred_references);
 assert.equal(capsule.not_an_approval,true);
});


test('review context restores exit guidance deferred during draft',async()=>{
 const draft=await loadStepContext('02-visual-production','visual_compile',flags, {run_mode:'fresh',role:'draft',environment_mode:'canvas'});
 const review=await loadStepContext('02-visual-production','visual_compile',flags, {run_mode:'fresh',role:'review',environment_mode:'canvas'});
 const reviewRefs=new Set(review.required_references);
 assert.ok(draft.deferred_references.some(ref=>reviewRefs.has(ref)),'review should restore at least one exit-only reference');
});
