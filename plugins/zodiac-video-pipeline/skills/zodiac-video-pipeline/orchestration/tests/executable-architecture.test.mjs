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
