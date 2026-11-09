import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {unresolvedContextImports} from '../runtime-dependency-check.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../../..');
const plugin=path.resolve(skill,'../..');
const deps=['gpt-tokenizer/encoding/o200k_base'];
const optional=['@colbymchenry/codegraph','@toon-format/toon','xstate'];
const resolver=createRequire(path.join(plugin,'package.json'));

test('Phase 1 preflight blocks when native runtime dependencies are unresolved',async()=>{
 const ws=await mkdtemp(path.join(tmpdir(),'zodiac-phase01-preflight-'));
 try{
  await mkdir(path.join(ws,'.authoring'),{recursive:true});
  const template=JSON.parse(await readFile(path.join(skill,'orchestration/pipeline-state.template.json'),'utf8'));
  await writeFile(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify(template));
  const result=spawnSync(process.execPath,[path.join(skill,'phases/phase01/execution-preflight.mjs'),ws,'01-content'],{encoding:'utf8'});
  const report=JSON.parse(await readFile(path.join(ws,'.authoring/execution-preflight.json'),'utf8'));
  const missing=deps.filter(d=>{try{resolver.resolve(d);return false;}catch{return true;}});
  for(const d of missing)assert.ok(report.problems.includes('RUNTIME_DEPENDENCY_UNAVAILABLE:'+d),d);
  for(const d of optional)assert.equal(report.problems.includes('RUNTIME_DEPENDENCY_UNAVAILABLE:'+d),false,d+' must remain optional for Phase 1');
  if(missing.length){assert.equal(report.status,'BLOCKED');assert.notEqual(result.status,0);}
  else assert.equal(report.problems.some(p=>p.startsWith('RUNTIME_DEPENDENCY_UNAVAILABLE:')),false);
 }finally{await rm(ws,{recursive:true,force:true});}
});

test('dependency check detects missing tokenizer independently of the CI node_modules',()=>{
 assert.deepEqual(unresolvedContextImports(()=>{throw Error('MODULE_NOT_FOUND');}),['gpt-tokenizer/encoding/o200k_base']);
 assert.deepEqual(unresolvedContextImports(()=>'/verified/plugin/node_modules/gpt-tokenizer'),[]);
});
