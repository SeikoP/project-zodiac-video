import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve(import.meta.dirname,'../phase02-transition-gate.mjs');
const root=path.resolve(import.meta.dirname,'../../../..');
const manifest=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root,'plugin.json'),'utf8'));
async function fixture(inputs){const d=await mkdtemp(path.join(tmpdir(),'zodiac-gate-'));await mkdir(path.join(d,'.authoring'),{recursive:true});await writeFile(path.join(d,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:manifest.version,phases:{'01-content':{status:'PASS'}},review_receipts:[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'real-user-reference'}}]}));await writeFile(path.join(d,'narration.txt'),'Narration');if(inputs)for(const [name,value] of Object.entries({'production.json':{scenes:[{id:'s01'}]},'asset-plan.json':{},'visual-grammar-plan.json':{},'.authoring/character-assembly-plan.json':{}}))await writeFile(path.join(d,name),JSON.stringify(value));return d;}
function run(d){const r=spawnSync(process.execPath,[script,'--workspace',d],{encoding:'utf8'});return {code:r.status,report:JSON.parse(r.stdout)}}
test('missing authored plans is explicit, not a fabricated PASS',async()=>{const d=await fixture(false);try{const r=run(d);assert.equal(r.code,0);assert.equal(r.report.status,'AUTHORING_REQUIRED');assert.equal(r.report.authoring_ready,false);}finally{await rm(d,{recursive:true,force:true})}});
test('complete inputs only grant AUTHORING_READY',async()=>{const d=await fixture(true);try{const r=run(d);assert.equal(r.code,0);assert.equal(r.report.status,'AUTHORING_READY');assert.equal(Object.keys(r.report.hashes).length,5)}finally{await rm(d,{recursive:true,force:true})}});
test('missing user approval blocks even with phase PASS label',async()=>{const d=await fixture(true);try{const p=path.join(d,'.authoring/pipeline-state.json');const s=JSON.parse(await (await import('node:fs/promises')).readFile(p,'utf8'));s.review_receipts=[];await writeFile(p,JSON.stringify(s));const r=run(d);assert.equal(r.code,2);assert.equal(r.report.status,'BLOCKED');assert.ok(r.report.issues.some(i=>i.code==='CONTENT_APPROVAL_RECEIPT_MISSING'))}finally{await rm(d,{recursive:true,force:true})}});
