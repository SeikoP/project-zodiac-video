import test from 'node:test';import assert from 'node:assert/strict';
import {planStepContext} from '../plan-step-context.mjs';
const manifest={id:'01-content',steps:[{id:'evidence',required_capabilities:[{id:'discovery',when:'fresh',stage:'entry',guidance_uri:'research.md'}],conditional_capabilities:[{id:'extra',when:'flag:extra',stage:'entry',guidance_uri:'extra.md'}]}]};
test('continuity omits fresh capabilities and fresh resolves both required and conditional conditions',()=>{assert.deepEqual(planStepContext(manifest,'evidence',{extra:false},{run_mode:'continuity'}).required_references,[]);assert.deepEqual(planStepContext(manifest,'evidence',{extra:true},{run_mode:'fresh'}).required_references,['research.md','extra.md']);});
test('unknown required condition and invalid mode reject',()=>{const m=structuredClone(manifest);m.steps[0].required_capabilities[0].when='imaginary';assert.throws(()=>planStepContext(m,'evidence',{extra:false}),/CONDITION_UNSUPPORTED/);assert.throws(()=>planStepContext(manifest,'evidence',{extra:false},{run_mode:'invented'}),/RUN_MODE/);});
test('provider resolver picks observed Tavily fallback without claiming execution',async()=>{const {resolveCapabilityRoute}=await import('../../core/policy/resolve-capability-route.mjs');const cap={id:'parallel_verify',provider:'parallel',when:'fresh',unavailable_policy:'fallback',fallback_providers:['tavily','built_in']};const r=resolveCapabilityRoute(cap,[{id:'tavily',tool_locator:'actual.tavily.search'}],{run_mode:'fresh',flags:{}});assert.equal(r.status,'FALLBACK_AVAILABLE');assert.equal(r.selected_provider,'tavily');assert.equal(r.tool_locator,'actual.tavily.search');assert.equal(r.execution_verified,false);assert.equal(resolveCapabilityRoute(cap,[],{run_mode:'fresh',flags:{}}).status,'BLOCKED');});
test('draft keeps narrative plan out while review can inspect it',()=>{const m={id:'01-content',steps:[{id:'narration',allowed_context_categories:['phase3_writer_brief'],forbidden_context_categories:['narrative_plan'],context_scopes:{review:{allowed_context_categories:['narrative_plan','actual_narration'],forbidden_context_categories:['memory']}}}]};assert.ok(planStepContext(m,'narration',{}, {role:'draft'}).forbidden_context_categories.includes('narrative_plan'));assert.ok(planStepContext(m,'narration',{}, {role:'review'}).allowed_context_categories.includes('narrative_plan'));assert.throws(()=>planStepContext(m,'narration',{}, {role:'anything'}),/ROLE_INVALID/);});

test('narration draft loads writing guidance without review catalogs; exit gates are unchanged',async()=>{
 const {readFile}=await import('node:fs/promises'),{loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url),'utf8'));
 const draft=await loadStepContext('01-content','narration',state.flags,{role:'draft'}),review=await loadStepContext('01-content','narration',state.flags,{role:'review'});
 assert.ok(draft.required_references.length<=4,draft.required_references.join('\n'));
 assert.ok(draft.required_references.includes('references/narration-writer-brief.md'));
 assert.ok(draft.required_references.includes('references/voice-benchmark.md'));
 assert.ok(!draft.required_references.includes('references/content-quality-engine.md'));
 assert.ok(review.required_references.includes('references/content-quality-engine.md'));
 assert.deepEqual(draft.required_outputs,review.required_outputs);
 assert.deepEqual(draft.deferred_exit_capabilities,review.deferred_exit_capabilities);
 assert.ok(draft.context_manifest.reduce((n,x)=>n+x.bytes,0)<12000);
});
