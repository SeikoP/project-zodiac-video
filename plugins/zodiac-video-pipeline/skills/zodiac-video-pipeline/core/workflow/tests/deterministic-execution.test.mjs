import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStepGraph,executionTrace,transitionStepState,createRepairPlan} from '../deterministic-execution.mjs';
const step=id=>({id,src:id+'.mjs',args:[],required:[]});
test('dependency ordering is deterministic and fail closed',()=>{
 assert.equal(validateStepGraph([step('character_components'),step('character_plan'),step('character_write')]).status,'PASS');
 const bad=validateStepGraph([step('character_write'),step('character_plan')]);
 assert.ok(bad.issues.some(i=>i.code==='WORKFLOW_DEPENDENCY_ORDER_INVALID'));
});
test('duplicate steps cannot run',()=>{
 assert.ok(validateStepGraph([step('environment'),step('environment')]).issues.some(i=>i.code==='WORKFLOW_STEP_DUPLICATE_OR_INVALID'));
});
test('trace preserves provenance without converting missing approvals into passes',()=>{
 const r=executionTrace({run_id:'r1',status:'BLOCKED',source:{fingerprint:'abc'},steps:[{id:'character_plan',status:'FAIL',exit_code:2}],issues:[{code:'BAD_INPUT'}]});
 assert.equal(r.status,'BLOCKED');
 assert.deepEqual(r.steps.map(x=>x.exit_code),[2]);
 assert.equal(r.issues[0].code,'BAD_INPUT');
});

test('state transitions reject gate bypass and fabricated approvals',()=>{
 assert.equal(transitionStepState('READY','RUNNING'),'RUNNING');
 assert.throws(()=>transitionStepState('PENDING','PASS'),/WORKFLOW_TRANSITION_INVALID/);
 assert.throws(()=>transitionStepState('READY','RUNNING',{approval:true}),/WORKFLOW_APPROVAL_FORBIDDEN/);
});
test('retry budget is finite, creative and environment faults escalate',()=>{
 assert.equal(createRepairPlan([{code:'CONTRACT_MISMATCH'}],{attempt:0,maxAttempts:1}).decision,'REPAIR_THEN_RETRY');
 assert.equal(createRepairPlan([{code:'CONTRACT_MISMATCH'}],{attempt:1,maxAttempts:1}).decision,'ESCALATE');
 assert.equal(createRepairPlan([{code:'CREATIVE_REVIEW_MISSING'}],{attempt:0,maxAttempts:1}).decision,'ESCALATE');
 assert.throws(()=>createRepairPlan([],{attempt:-1,maxAttempts:1}),/WORKFLOW_RETRY_BUDGET_INVALID/);
});

test('strict execution rejects omitted mandatory dependency',()=>{
 const result=validateStepGraph([step('character_plan')],undefined,{strictMissing:true});
 assert.ok(result.issues.some(i=>i.code==='WORKFLOW_DEPENDENCY_MISSING'&&i.dependency==='character_components'));
 assert.equal(result.status,'BLOCKED');
});
