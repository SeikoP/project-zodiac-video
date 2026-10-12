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
  assert.equal(/RELEASE\s+2\.4\./u.test(config.api?.defaultPrompt??''),false,rel+' must not carry release-history clauses');
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