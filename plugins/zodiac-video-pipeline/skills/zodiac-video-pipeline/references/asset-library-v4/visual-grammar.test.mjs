import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const compiler=path.join(here,'compile-visual-grammar.mjs');
const manifestPath=path.join(here,'manifest.json');
const baseProduction=()=>({version:'2.0',scenes:[{id:'S01',entities:[{id:'hero',kind:'character'},{id:'friend',kind:'character'},{id:'phone',kind:'object'}]}]});
const basePlan=()=>({format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',frame_id:'two-person-offset',mechanic_id:'show-object',bindings:{speaker:'hero',listener:'friend',shared_prop:'phone'},continuity_relation:'start',composition_goal:'Hero shows the phone while the friend reacts.'}]});
async function run(production=baseProduction(),plan=basePlan()){
  const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-v4-grammar-'));
  const pp=path.join(d,'production.json'),gp=path.join(d,'visual-grammar-plan.json');
  await writeFile(pp,JSON.stringify(production));await writeFile(gp,JSON.stringify(plan));
  const r=spawnSync(process.execPath,[compiler,pp,gp,'--write'],{encoding:'utf8'});
  let out=null;try{out=JSON.parse(await readFile(pp,'utf8'));}catch{}
  await rm(d,{recursive:true,force:true});return {r,out};
}
test('v4 manifest is the canonical visual grammar library',async()=>{const m=JSON.parse(await readFile(manifestPath,'utf8'));assert.equal(m.library_id,'zodiac-visual-grammar-v4');assert.equal(m.version,'4.0');assert.equal(m.style_token,'zodiac-paper-doodle-meme-v4');assert.equal(m.handmade_profile,'human-stroke-v2');});
test('two-person frame + show-object mechanic compiles into existing scene_direction contract',async()=>{const {r,out}=await run();assert.equal(r.status,0,r.stderr);assert.deepEqual(out.scenes[0].scene_direction,{shot:'two-person',focus:'hero',subject_placement:'split',continuity_relation:'start',foreground_role:null,composition_goal:'Hero shows the phone while the friend reacts.',interaction_roles:{speaker:'hero',listener:'friend',shared_prop:'phone'}});});
test('missing required frame binding is rejected before geometry compile',async()=>{const p=basePlan();delete p.scenes[0].bindings.listener;const {r}=await run(baseProduction(),p);assert.notEqual(r.status,0);assert.match(r.stderr,/VISUAL_GRAMMAR_COMPILE_INVALID.*listener/s);});
test('binding to unknown entity is rejected',async()=>{const p=basePlan();p.scenes[0].bindings.listener='ghost';const {r}=await run(baseProduction(),p);assert.notEqual(r.status,0);assert.match(r.stderr,/VISUAL_GRAMMAR_COMPILE_INVALID.*ghost/s);});
test('mechanic requirements must be supported by bound frame slots',async()=>{const p=basePlan();p.scenes[0].frame_id='caption-payoff';p.scenes[0].bindings={subject:'hero'};const {r}=await run(baseProduction(),p);assert.notEqual(r.status,0);assert.match(r.stderr,/VISUAL_GRAMMAR_COMPILE_INVALID.*show-object/s);});
