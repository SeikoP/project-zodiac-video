import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(testsDir,'..');
const skill=path.resolve(orchestration,'..');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const walk=async dir=>{const out=[];for(const ent of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else if(ent.isFile()&&p.endsWith('.mjs'))out.push(p);}return out;};

test('current core owners exist and compatibility source tree is absent',async()=>{
 for(const rel of ['core/policy/capability-registry.mjs','core/policy/current-policy.mjs','core/state/production-model.mjs','core/evidence/episode-evidence.mjs','core/release/validate-release-consistency.mjs','core/portable/zip-primitives.mjs'])assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');
 assert.equal(await exists(path.join(skill,'compat')),false,'compat source tree must stay deleted');
 assert.equal(await exists(path.join(skill,'features/story-object')),false);
 assert.equal(await exists(path.join(skill,'features/visual-metaphor')),false);
});

test('current feature owners exist without retired storytelling variants',async()=>{
 for(const rel of ['features/episode/episode-scope.mjs','features/narration-performance/compile-narration-performance.mjs','features/scene-set/validate-scene-set.mjs','features/visual-composition/phase02-composition.mjs','features/visual-composition/validate-narrative-visual-presence.mjs','features/cover/validate-cover-design.mjs','features/meme/validate-meme-selection.mjs','features/publish/validate-publish-prep.mjs'])assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');
});

test('capability registry points only at existing current owners',async()=>{
 const registry=JSON.parse(await readFile(path.join(skill,'bootstrap/capabilities.json'),'utf8'));
 assert.equal(registry.capabilities.some(x=>x.id==='visual_metaphor'),false);
 for(const row of registry.capabilities){
  if(typeof row.owner==='string')assert.equal(await exists(path.join(skill,row.owner)),true,row.id+' owner missing: '+row.owner);
 }
});

test('feature and phase modules never import deleted compatibility implementation',async()=>{
 for(const root of [path.join(skill,'features'),path.join(skill,'phases')])for(const file of await walk(root)){
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/(?:from|import\s*\()\s*['"][^'"]*compat\//u,path.relative(skill,file)+' imports compat');
  assert.doesNotMatch(source,/(?:from|import\s*\()\s*['"][^'"]*features\/(?:story-object|visual-metaphor)\//u,path.relative(skill,file)+' imports retired storytelling variant');
 }
});

test('phase execution owners remain explicit',async()=>{
 for(const rel of ['phases/phase01/commit-phase01-step.mjs','phases/phase01/execution-preflight.mjs','phases/phase02/commit-phase02-step.mjs','phases/phase02/phase02-execute.mjs','phases/phase03/compile-job-v5.mjs','phases/phase03/run-phase03-production.mjs','phases/phase03/validate-job5-import-gate.mjs'])assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');
});

test('orchestration root contains routing or thin wrappers, not phase implementation',async()=>{
 const allowed=new Set(['plan-plugin-use.mjs','plan-step-context.mjs','resume-brief.mjs','verify-entry-freshness.mjs']);
 const found=[];
 for(const e of await readdir(orchestration,{withFileTypes:true})){
  if(!e.isFile()||!e.name.endsWith('.mjs'))continue;
  const s=await readFile(path.join(orchestration,e.name),'utf8');
  if(!/^export \* from ['"][^'"]+['"];\n(?:import \{forwardCliIfMain\} from '\.\/forward-cli\.mjs';\nforwardCliIfMain\([^\n]+\);\n)?$/u.test(s))found.push(e.name);
 }
 assert.deepEqual(found.sort(),[...allowed].sort());
});

test('active phase manifests use canonical non-retired references',async()=>{
 const allow=new Set(['orchestration/verify-entry-freshness.mjs','orchestration/plan-plugin-use.mjs']);
 for(const name of ['01-content.json','02-visual-production.json','03-handoff.json']){
  const m=JSON.parse(await readFile(path.join(orchestration,'phases',name),'utf8'));
  const serialized=JSON.stringify(m);
  assert.doesNotMatch(serialized,/visual-metaphor|story-object-plan|narrative-visual-contract|narrative-visual-authoring/u,name);
  for(const step of m.steps??[])for(const cap of [...(step.required_capabilities??[]),...(step.conditional_capabilities??[])])if(typeof cap.tool_locator==='string'&&cap.tool_locator.startsWith('orchestration/'))assert.ok(allow.has(cap.tool_locator),name+':'+cap.id+' '+cap.tool_locator);
 }
});
