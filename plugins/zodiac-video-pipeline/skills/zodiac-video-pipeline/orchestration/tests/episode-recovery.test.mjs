import test from 'node:test';import assert from 'node:assert/strict';import {loadStepContext} from '../plan-step-context.mjs';import {preparePhase01StepCommit} from '../commit-phase01-step.mjs';import {readFile} from 'node:fs/promises';
test('episode routing carries durable scope and keeps research pool outside narration draft',async()=>{
 const template=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url))),flags={...template.flags,episode_selected:true};
 const c=await loadStepContext('01-content','concept',flags);assert.ok(c.required_outputs.includes('episode-scope.json'));assert.ok(c.deferred_exit_capabilities.includes('episode_scope_validation'));
 const e=await loadStepContext('01-content','evidence',flags);assert.ok(e.required_outputs.includes('research-scope.json'));
 const d=await loadStepContext('01-content','narration',flags,{role:'draft'});assert.ok(d.allowed_context_categories.includes('episode_scope'));assert.ok(d.forbidden_context_categories.includes('research_pool'));
});
test('missing durable scope cannot commit a scoped concept despite prior PASS claims',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../phases/01-content.json',import.meta.url)));
 const template=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url)));
 const state={run_mode:'fresh',flags:{...template.flags,episode_selected:true},operations:[],phases:{'01-content':{status:'IN_PROGRESS',current_step:'concept',steps:{concept:{status:'READY'},narration:{status:'NOT_STARTED'}}}}};
 const s=manifest.steps.find(x=>x.id==='concept');const outputs=[...s.required_outputs,...s.conditional_outputs.filter(o=>o.when==='fresh').map(o=>o.name)];
 assert.throws(()=>preparePhase01StepCommit({state,manifest,evidence:{step_id:'concept',capability_receipts:[{proof:{}}],gate_results:Object.fromEntries(s.gate_checks.map(g=>[g,'PASS'])),outputs},files:[]}),/STEP_OUTPUT_MISSING episode-scope/);
});
