import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const skillRoot=path.resolve(here,'../..');
const pluginRoot=path.resolve(skillRoot,'../..');

test('plugin prompt makes the affiliate gate explicit and Kalodata canonical',async()=>{
  const plugin=JSON.parse(await readFile(path.join(pluginRoot,'plugin.json'),'utf8'));
  const prompt=plugin.extensions['com.openai'].interface.defaultPrompt;
  assert.match(prompt,/Thêm quảng cáo Affiliate\? YES\/NO/i);
  assert.match(prompt,/Kalodata/i);
  assert.match(prompt,/do not ask.*product link/i);
  assert.match(prompt,/zodiac-affiliate-commerce\/SKILL\.md/i);
  assert.equal(plugin.version,'2.7.2');
});

test('affiliate skill routes enabled commerce through discovery, integration, media and handoff',async()=>{
  const skill=await readFile(path.join(pluginRoot,'skills/zodiac-affiliate-commerce/SKILL.md'),'utf8');
  for(const phrase of ['Monetization gate','Kalodata','Product Media Adapter','affiliate-handoff','topology','treatment'])assert.match(skill,new RegExp(phrase,'i'),phrase);
  assert.match(skill,/YES.*NO/is);
  assert.match(skill,/do not ask.*product link|không.*link/is);
});

test('capability registry binds commerce to phase 01 narration and phase 02 visual work',async()=>{
  const cap=JSON.parse(await readFile(path.join(skillRoot,'bootstrap/capabilities.json'),'utf8'));
  const commerce=cap.capabilities.find(x=>x.id==='affiliate_commerce');
  assert.ok(commerce);
  assert.equal(commerce.fresh,true);
  assert.ok(commerce.refs.includes('references/affiliate-commerce.md'));
  const phases=new Set(commerce.bindings.map(x=>x.phase));
  assert.ok(phases.has('01-content'));
  assert.ok(phases.has('02-visual-production'));
});

test('affiliate reference fixes provider, duration range and SVG transport strategy',async()=>{
  const doc=await readFile(path.join(skillRoot,'references/affiliate-commerce.md'),'utf8');
  assert.match(doc,/Kalodata.*canonical/i);
  assert.match(doc,/5–18|5-18/);
  assert.match(doc,/SVG transport/i);
  assert.match(doc,/secret-key/i);
  assert.match(doc,/ACCOUNT_ATTACH_UNVERIFIED/);
});

test('pipeline state and phase manifests wire affiliate commerce fail closed',async()=>{
  const state=JSON.parse(await readFile(path.join(skillRoot,'orchestration/pipeline-state.template.json'),'utf8'));
  assert.equal(state.plugin_version,'2.7.2');assert.equal(state.flags.affiliate_enabled,false);
  const p1=JSON.parse(await readFile(path.join(skillRoot,'orchestration/phases/01-content.json'),'utf8'));
  const evidence=p1.steps.find(x=>x.id==='evidence'),narration=p1.steps.find(x=>x.id==='narration');
  assert.equal(evidence.required_capabilities.some(x=>x.id==='affiliate_monetization_decision_validation'),false);
  assert.ok(narration.conditional_capabilities.some(x=>x.id==='affiliate_integration_validation'&&x.when==='flag:affiliate_enabled'));
  const p2=JSON.parse(await readFile(path.join(skillRoot,'orchestration/phases/02-visual-production.json'),'utf8'));
  const assets=p2.steps.find(x=>x.id==='assets');
  for(const id of ['kalodata_product_detail','affiliate_product_media','affiliate_visual_validation'])assert.ok(assets.conditional_capabilities.some(x=>x.id===id&&x.when==='flag:affiliate_enabled'),id);
});

test('legacy fresh flags treat missing affiliate_enabled as commerce off',async()=>{
  const {conditionApplies}=await import('../../core/policy/resolve-capability-route.mjs');
  assert.equal(conditionApplies('flag:affiliate_enabled',{run_mode:'fresh',flags:{}}),false);
});
