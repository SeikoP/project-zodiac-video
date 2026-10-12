import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(testsDir,'..');
const skill=path.resolve(orchestration,'..');
const pluginRoot=path.resolve(skill,'../..');

async function exists(p){try{await access(p);return true;}catch{return false;}}

test('current effective policy is explicit and release-history is not active prompt policy',async()=>{
 const modulePath=path.join(orchestration,'current-policy.mjs');
 assert.equal(await exists(modulePath),true,'current-policy.mjs must exist');
 const {loadCurrentPolicy}=await import(pathToFileURL(modulePath));
 const policy=await loadCurrentPolicy();
 assert.deepEqual(policy,{
  format:'zodiac-current-policy@1',
  narrative:'2.1',
  story_object:'v2',
  visual_grammar:'v4',
  scene_system:'scene-set@1',
  character_assembly:'v2',
  handoff:'zodiac-job@5',
  renderer:'zodiac-renderer@2.0.1'
 });
 for(const rel of ['plugin.json','.codex-plugin/plugin.json']){
  const raw=await readFile(path.join(pluginRoot,rel),'utf8');
  const config=JSON.parse(raw);
  const prompt=config.interface?.defaultPrompt??config.extensions?.['com.openai']?.interface?.defaultPrompt??'';
  assert.ok(prompt.length>0,rel+' must expose an active defaultPrompt');
  assert.equal(/RELEASE\s+2\.4\./u.test(prompt),false,rel+' must not carry release-history clauses');
 }
});

test('fresh scene-set context exposes effective policy without compatibility environment guidance',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const result=await loadStepContext('02-visual-production','assets',state.flags,{
  selected_asset_ids:['scene-set-home'],
  environment_mode:'scene_set'
 });
 assert.equal(result.effective_policy?.scene_system,'scene-set@1');
 assert.equal(result.effective_policy?.renderer,'zodiac-renderer@2.0.1');
 assert.equal(result.required_references.some(ref=>ref.includes('compatibility/environment-profiles')),false);
});

test('loadStepContext materializes registry-selected capabilities into bounded references',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const result=await loadStepContext('02-visual-production','visual_compile',state.flags,{
  selected_asset_ids:['scene-set-classroom'],
  environment_mode:'scene_set'
 });
 assert.deepEqual(result.selected_capabilities,['scene_set','character_assembly','visual_metaphor']);
 assert.ok(result.required_references.includes('references/asset-library-v4/scene-set/index.json'));
 assert.ok(result.required_references.includes('references/story-object-composition-v2.md'));
 assert.equal(result.required_references.some(ref=>ref.includes('/compatibility/')),false);
});

test('loadStepContext resolves narrative asset needs without caller knowing asset ids',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const result=await loadStepContext('02-visual-production','visual_compile',state.flags,{
  asset_needs:['scene.classroom','cast.three_compare'],
  environment_mode:'scene_set'
 });
 assert.ok(result.resolved_asset_capabilities.some(row=>row.need_id==='scene.classroom'&&row.capability_id==='scene-set-classroom'));
 assert.ok(result.resolved_asset_capabilities.some(row=>row.need_id==='cast.three_compare'&&row.capability_id==='three-person-comparison'));
 assert.equal(result.required_references.some(ref=>ref.includes('/compatibility/')),false);
});