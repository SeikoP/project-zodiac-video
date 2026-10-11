import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const compiler=path.resolve(here,'../compile-visual-grammar.mjs');
const production=()=>({version:'2.0',scenes:[{id:'S01',entities:[{id:'hero',kind:'character'}]}]});
const plan=env=>({format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',frame_id:'single-character-focus',mechanic_id:'explain',bindings:{subject:'hero'},continuity_relation:'start',environment:env}]});
async function run(env){const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-bed-grammar-'));const pp=path.join(d,'production.json'),gp=path.join(d,'visual-grammar-plan.json');await writeFile(pp,JSON.stringify(production()));await writeFile(gp,JSON.stringify(plan(env)));const r=spawnSync(process.execPath,[compiler,pp,gp,'--write'],{encoding:'utf8'});let out=null;try{out=JSON.parse(await readFile(pp,'utf8'));}catch{}await rm(d,{recursive:true,force:true});return {r,out};}

test('Study Bedroom selection materializes authoring-only environment profile and clean modifier',async()=>{const {r,out}=await run({profile:'bedroom-study-base'});assert.equal(r.status,0,r.stderr);assert.deepEqual(out.scenes[0].environment,{mode:'micro_environment',profile:'bedroom-study-base',modifier:'clean'});});
test('cozy-depth modifier is accepted',async()=>{const {r,out}=await run({profile:'bedroom-study-base',modifier:'cozy-depth'});assert.equal(r.status,0,r.stderr);assert.equal(out.scenes[0].environment.modifier,'cozy-depth');});
test('unknown bedroom modifier is rejected',async()=>{const {r}=await run({profile:'bedroom-study-base',modifier:'wallpaper-chaos'});assert.notEqual(r.status,0);assert.match(r.stderr,/VISUAL_GRAMMAR_COMPILE_INVALID.*environment modifier/s);});
test('scene without bedroom selection stays environment-neutral',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-bed-grammar-none-'));const pp=path.join(d,'production.json'),gp=path.join(d,'visual-grammar-plan.json');const p=production(),q=plan(undefined);delete q.scenes[0].environment;await writeFile(pp,JSON.stringify(p));await writeFile(gp,JSON.stringify(q));const r=spawnSync(process.execPath,[compiler,pp,gp,'--write'],{encoding:'utf8'});let out=null;try{out=JSON.parse(await readFile(pp,'utf8'));}catch{}await rm(d,{recursive:true,force:true});assert.equal(r.status,0,r.stderr);assert.equal('environment' in out.scenes[0],false);});
