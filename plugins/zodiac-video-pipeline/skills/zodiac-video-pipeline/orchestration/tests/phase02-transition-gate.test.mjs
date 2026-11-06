import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve(import.meta.dirname,'../../phases/phase02/phase02-transition-gate.mjs');
const root=path.resolve(import.meta.dirname,'../../../..');
const manifest=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'plugin.json'),'utf8'));
async function fixture(inputs){const d=await mkdtemp(path.join(tmpdir(),'zodiac-gate-'));await mkdir(path.join(d,'.authoring'),{recursive:true});await writeFile(path.join(d,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:manifest.version,phases:{'01-content':{status:'PASS'}},review_receipts:[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'real-user-reference'}}]}));await writeFile(path.join(d,'narration.txt'),'Narration');if(inputs)for(const [name,value] of Object.entries({'production.json':{scenes:[{id:'s01'}]},'asset-plan.json':{},'visual-grammar-plan.json':{},'.authoring/character-assembly-plan.json':{}}))await writeFile(path.join(d,name),JSON.stringify(value));return d;}
function run(d){const r=spawnSync(process.execPath,[script,'--workspace',d],{encoding:'utf8'});return {code:r.status,report:JSON.parse(r.stdout)}}
test('missing authored plans is explicit, not a fabricated PASS',async()=>{const d=await fixture(false);try{const r=run(d);assert.equal(r.code,0);assert.equal(r.report.status,'AUTHORING_REQUIRED');assert.equal(r.report.authoring_ready,false);}finally{await rm(d,{recursive:true,force:true})}});
test('complete inputs only grant AUTHORING_READY',async()=>{const d=await fixture(true);try{const r=run(d);assert.equal(r.code,0);assert.equal(r.report.status,'AUTHORING_READY');assert.equal(Object.keys(r.report.hashes).length,5)}finally{await rm(d,{recursive:true,force:true})}});

test('entry-only gate opens authoring without demanding the plans Phase 2 will create',async()=>{const d=await fixture(false);try{const r=spawnSync(process.execPath,[script,'--workspace',d,'--entry-only'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.status,'ENTRY_READY');assert.equal(report.entry_ready,true);assert.equal(report.authoring_ready,false);await rm(path.join(d,'narration.txt'));const missing=spawnSync(process.execPath,[script,'--workspace',d,'--entry-only'],{encoding:'utf8'});assert.equal(missing.status,2);}finally{await rm(d,{recursive:true,force:true})}});
test('missing user approval blocks even with phase PASS label',async()=>{const d=await fixture(true);try{const p=path.join(d,'.authoring/pipeline-state.json');const s=JSON.parse(await (await import('node:fs/promises')).readFile(p,'utf8'));s.review_receipts=[];await writeFile(p,JSON.stringify(s));const r=run(d);assert.equal(r.code,2);assert.equal(r.report.status,'BLOCKED');assert.ok(r.report.issues.some(i=>i.code==='CONTENT_APPROVAL_RECEIPT_MISSING'))}finally{await rm(d,{recursive:true,force:true})}});

test('activation actually opens Phase 2 before visual plans exist and preserves the review',async()=>{
 const d=await fixture(false);
 try{const {readFile}=await import('node:fs/promises'),{activatePhase02}=await import('../../phases/phase02/activate-phase02.mjs');
  const state=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url),'utf8'));state.run_mode='continuity';const p=state.phases['01-content'];p.status='PASS';p.current_step='narration';for(const step of Object.values(p.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:approved-content';}
  state.review_receipts=[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'synthetic-fixture:content-review'}}];await writeFile(path.join(d,'.authoring/pipeline-state.json'),JSON.stringify(state));
  const r=await activatePhase02(d),next=JSON.parse(await readFile(path.join(d,'.authoring/pipeline-state.json'),'utf8'));assert.equal(r.status,'ACTIVATED');assert.equal(r.approvals_created,false);assert.deepEqual(next.review_receipts,state.review_receipts);assert.equal(next.phases['02-visual-production'].steps.visual_compile.status,'READY');await assert.rejects(()=>readFile(path.join(d,'production.json')),/ENOENT/);assert.equal((await activatePhase02(d)).status,'PHASE02_ALREADY_ACTIVE');
 }finally{await rm(d,{recursive:true,force:true});}
});
