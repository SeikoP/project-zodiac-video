import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const skill=new URL('../../',import.meta.url);
const json=async rel=>JSON.parse(await readFile(new URL(rel,skill),'utf8'));

test('entry prompt is compact and defers step details to persisted state',async()=>{
 const plugin=await json('../../plugin.json'),prompt=plugin.extensions['com.openai'].interface.defaultPrompt;
 assert.ok(Buffer.byteLength(prompt)<1500);
 assert.match(prompt,/resume-brief/);assert.doesNotMatch(prompt,/Thêm quảng cáo Affiliate|Fresh 2\.|Kalodata/);
 const entry=await readFile(new URL('SKILL.md',skill),'utf8');assert.ok(Buffer.byteLength(entry)<5000);assert.ok(entry.split(/\r?\n/).length<=80);
});

test('fresh defaults use one fictional ad without affiliate provider dependencies',async()=>{
 const state=await json('orchestration/pipeline-state.template.json');
 assert.equal(state.flags.affiliate_enabled,false);assert.equal(state.flags.mock_ad_enabled,true);
 const cap=await json('bootstrap/capabilities.json'),mock=cap.capabilities.find(x=>x.id==='mock_advertisement');
 assert.ok(mock);assert.ok(mock.refs.includes('references/affiliate-commerce.md'));
 for(const phase of ['01-content','02-visual-production']){
  const m=await json(`orchestration/phases/${phase}.json`);
  assert.doesNotMatch(JSON.stringify(m),/kalodata-client|product-media-adapter|flag:affiliate_enabled/);
  assert.equal(m.steps.flatMap(s=>s.conditional_outputs??[]).filter(o=>o.name.includes('/commerce/')).length,0);
  assert.ok(m.steps.some(s=>s.conditional_capabilities?.some(c=>c.when==='flag:mock_ad_enabled'&&c.kind==='internal_validator')));
 }
});

test('fictional ad guidance reuses creative structure inside the canonical narrative plan',async()=>{
 const doc=await readFile(new URL('references/affiliate-commerce.md',skill),'utf8');
 for(const phrase of ['mock_ad','topology','treatment','5–18','narrative-plan.json','visual-intent.json','Quảng cáo hư cấu'])assert.ok(doc.includes(phrase),phrase);
 const extension=await readFile(new URL('../zodiac-affiliate-commerce/SKILL.md',skill),'utf8');
 assert.match(extension,/paused/i);assert.doesNotMatch(extension,/ask exactly|KALODATA_API_KEY is required/);
});

test('pre-feature states keep mock advertising off and active affiliate states require explicit migration',async()=>{
 const {conditionApplies}=await import('../../core/policy/resolve-capability-route.mjs');
 assert.equal(conditionApplies('flag:mock_ad_enabled',{run_mode:'fresh',flags:{}}),false);
 const {loadStepContext}=await import('../plan-step-context.mjs');const state=await json('orchestration/pipeline-state.template.json');
 await assert.rejects(()=>loadStepContext('01-content','narration',{...state.flags,affiliate_enabled:true}),/AFFILIATE_PAUSED/);
});
