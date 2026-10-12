import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(testsDir,'..');
const skill=path.resolve(orchestration,'..');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

const coreOwners=[
 'core/policy/capability-registry.mjs',
 'core/policy/current-policy.mjs',
 'core/state/production-model.mjs',
 'core/evidence/episode-evidence.mjs',
 'core/schema/schema-lite.mjs',
 'core/release/validate-release-consistency.mjs',
];
const compatOwners=[
 'compat/production-v1/compile-runtime-production.mjs',
 'compat/production-v1/export-zodiac-job.mjs',
 'compat/production-v1/validate-handoff-workspace.mjs',
 'compat/production-v1/validate-zodiac-job-zip.mjs',
 'compat/production-v1/zip-core.mjs',
 'compat/migrations/migrate-production-model.mjs',
 'compat/migrations/migrate-state-v1-to-v2.mjs',
 'compat/migrations/project-legacy-ir.mjs',
];

test('core and compatibility implementation have explicit owners',async()=>{
 for(const rel of [...coreOwners,...compatOwners])assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');
 assert.equal(await exists(path.join(orchestration,'forward-cli.mjs')),true,'forward-cli helper missing');
});

test('current Job5 v2-named modules are not compatibility implementation',async()=>{
 for(const name of ['compile-job-v5.mjs','export-zodiac-job-v2.mjs','zip-core-v2.mjs','validate-handoff-workspace-v2.mjs','validate-zodiac-job-zip-v2.mjs']){
  const compatHits=[];
  for(const dir of ['compat/production-v1','compat/migrations']){
   if(await exists(path.join(skill,dir,name)))compatHits.push(dir);
  }
  assert.deepEqual(compatHits,[],name+' must stay on current path');
 }
});

test('moved orchestration compatibility paths are thin forwarders only',async()=>{
 for(const name of ['compile-runtime-production.mjs','export-zodiac-job.mjs','validate-handoff-workspace.mjs','validate-zodiac-job-zip.mjs']){
  const source=await readFile(path.join(orchestration,name),'utf8');
  assert.match(source,/export \* from/u,name+' must re-export owner');
  if(name!=='validate-handoff-workspace.mjs')assert.match(source,/forwardCliIfMain/u,name+' must forward guarded CLI');
  assert.doesNotMatch(source,/function\s+(projectProduction|exportZodiacJob|validateHandoff|validateZipFile)/u,name+' still contains implementation');
 }
});

const featureOwners=[
 'features/episode/episode-scope.mjs','features/narration-performance/compile-narration-performance.mjs','features/story-object/validate-story-object.mjs','features/scene-set/validate-scene-set.mjs','features/visual-composition/phase02-composition.mjs','features/cover/validate-cover-design.mjs','features/ending/validate-ending-payoff.mjs','features/meme/validate-meme-selection.mjs','features/publish/validate-publish-prep.mjs',
];
test('feature compiler and validator implementation has semantic owners',async()=>{for(const rel of featureOwners)assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');});
test('capability registry points at real feature owners',async()=>{const registry=JSON.parse(await readFile(path.join(skill,'bootstrap/capabilities.json'),'utf8'));const expected={scene_set:'features/scene-set/validate-scene-set.mjs',visual_metaphor:'features/visual-metaphor/validate-visual-metaphor.mjs',cover:'features/cover/validate-cover-design.mjs',narration_performance:'features/narration-performance/compile-narration-performance.mjs',character_assembly:'references/asset-library-v4/characters/compile-character-assembly.mjs'};for(const [id,owner] of Object.entries(expected)){const row=registry.capabilities.find(item=>item.id===id);assert.ok(row,id+' missing');assert.equal(row.owner,owner,id+' owner mismatch');assert.equal(await exists(path.join(skill,owner)),true,id+' owner path missing');}});
test('fresh feature owner modules never import compatibility implementation',async()=>{const root=path.join(skill,'features');const walk=async dir=>{const out=[];for(const ent of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else if(ent.isFile()&&p.endsWith('.mjs'))out.push(p);}return out;};for(const file of await walk(root)){const source=await readFile(file,'utf8');assert.doesNotMatch(source,/(?:from|import\s*\()\s*['"][^'"]*compat\//u,path.relative(skill,file)+' imports compat');}});

const phaseOwners=['phases/phase01/commit-phase01-step.mjs','phases/phase01/execution-preflight.mjs','phases/phase01/phase01-artifacts.mjs','phases/phase02/commit-phase02-step.mjs','phases/phase02/phase02-execute.mjs','phases/phase02/phase02-transition-gate.mjs','phases/phase03/compile-job-v5.mjs','phases/phase03/run-phase03-production.mjs','phases/phase03/validate-job5-import-gate.mjs'];
test('phase execution implementation has explicit owners',async()=>{for(const rel of phaseOwners)assert.equal(await exists(path.join(skill,rel)),true,rel+' missing');assert.equal(await exists(path.join(skill,'features/visual-composition/validate-scene-art-direction.mjs')),true);});
test('orchestration root contains routing or thin wrappers, not phase implementation',async()=>{const allowed=new Set(['forward-cli.mjs','plan-plugin-use.mjs','plan-step-context.mjs','verify-entry-freshness.mjs']);const found=[];for(const e of await readdir(orchestration,{withFileTypes:true})){if(!e.isFile()||!e.name.endsWith('.mjs'))continue;const s=await readFile(path.join(orchestration,e.name),'utf8');if(!/^export \* from ['"][^'"]+['"];\n(?:import \{forwardCliIfMain\} from '\.\/forward-cli\.mjs';\nforwardCliIfMain\([^\n]+\);\n)?$/u.test(s))found.push(e.name);}assert.deepEqual(found.sort(),[...allowed].sort());});
test('fresh phase owner modules never import compatibility implementation',async()=>{const walk=async d=>{const out=[];for(const e of await readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.isFile()&&p.endsWith('.mjs'))out.push(p);}return out;};for(const f of await walk(path.join(skill,'phases')))assert.doesNotMatch(await readFile(f,'utf8'),/(?:from|import\s*\()\s*['"][^'"]*compat\//u);});
test('current Job5 round-trip model utilities are core, not compatibility implementation',async()=>{for(const rel of ['core/model/migrate-production-model.mjs','core/model/project-legacy-ir.mjs'])assert.equal(await exists(path.join(skill,rel)),true);for(const rel of ['compat/migrations/migrate-production-model.mjs','compat/migrations/project-legacy-ir.mjs']){const s=await readFile(path.join(skill,rel),'utf8');assert.match(s,/^export \* from ['"][^'"]+core\/model\//u);}});
test('active phase manifests point migrated capabilities at canonical owner modules',async()=>{const allow=new Set(['orchestration/verify-entry-freshness.mjs','orchestration/plan-plugin-use.mjs']);for(const name of ['01-content.json','02-visual-production.json','03-handoff.json']){const m=JSON.parse(await readFile(path.join(orchestration,'phases',name),'utf8'));for(const step of m.steps??[])for(const cap of [...(step.required_capabilities??[]),...(step.conditional_capabilities??[])])if(typeof cap.tool_locator==='string'&&cap.tool_locator.startsWith('orchestration/'))assert.ok(allow.has(cap.tool_locator),name+':'+cap.id+' '+cap.tool_locator);}});