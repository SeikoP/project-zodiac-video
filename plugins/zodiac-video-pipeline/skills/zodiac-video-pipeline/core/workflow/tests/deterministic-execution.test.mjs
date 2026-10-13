import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStepGraph,executionTrace} from '../deterministic-execution.mjs';
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
