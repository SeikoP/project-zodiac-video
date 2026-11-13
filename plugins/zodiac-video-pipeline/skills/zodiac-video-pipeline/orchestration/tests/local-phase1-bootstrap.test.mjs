import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,utimes,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildPortableZip,parsePortableZip} from '../../core/portable/zip-primitives.mjs';
import {buildInventory} from '../../contracts/phase1-handoff.mjs';
import {exportPhase1Handoff} from '../../phases/phase01/export-phase1-handoff.mjs';
import {bootstrapLocal} from '../../phases/local/local-bootstrap.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');

async function approvedWorkspace(runId){
 const root=await mkdtemp(path.join(tmpdir(),'z-local-src-'));await mkdir(path.join(root,'.authoring'),{recursive:true});
 const narration=Buffer.from('Approved narration '+runId+'\n');
 const plan=Buffer.from(JSON.stringify({format:'zodiac-narrative-plan@1',sign:'Song Tử',story_spine:{premise:'p'}}));
 const scope=Buffer.from(JSON.stringify({episode_id:runId,sign:'Song Tử',concept:runId}));
 const brief=Buffer.from(JSON.stringify({creative_direction:{tone:'normal'}}));
 const voice=Buffer.from(JSON.stringify({format:'zodiac-voice-profile@1',narrator_vibe:'normal ↔ sharp'}));
 await writeFile(path.join(root,'narration.txt'),narration);
 await writeFile(path.join(root,'.authoring','narrative-plan.json'),plan);
 await writeFile(path.join(root,'.authoring','episode-scope.json'),scope);
 await writeFile(path.join(root,'.authoring','phase3-writer-brief.json'),brief);
 await writeFile(path.join(root,'.authoring','voice-profile.json'),voice);
 const receipt={
  format:'zodiac-content-review@2',phase_id:'01-content',status:'APPROVED',run_id:runId,
  proof:{kind:'user_message',ref:'user-message-sha256:'+runId,text:'chốt'},
  source_hashes:{narration:hash(narration),plan:hash(plan),scope:hash(scope),brief:hash(brief),voice:hash(voice)}
 };
 await writeFile(path.join(root,'.authoring','content-review-receipt.json'),JSON.stringify(receipt,null,2));
 return root;
}

async function capsule(inbox,runId,name=runId+'.zip'){
 const source=await approvedWorkspace(runId);const file=path.join(inbox,name);
 try{await exportPhase1Handoff(source,file);return file}finally{await rm(source,{recursive:true,force:true})}
}

test('handoff inventory order is locale-independent',()=>{
 const rows=buildInventory([
  {rel:'voice-profile.json',data:Buffer.from('voice')},
  {rel:'writer-brief.json',data:Buffer.from('brief')}
 ]);
 assert.deepEqual(rows.map(x=>x.path),['voice-profile.json','writer-brief.json']);
});

test('bootstrap imports v2, synthesizes state, activates phase2, and supports explicit run selection',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-local-'));try{
  const inbox=path.join(root,'phase1-done');await mkdir(inbox,{recursive:true});
  const older=await capsule(inbox,'run-old','old.zip'),newer=await capsule(inbox,'run-new','new.zip');
  await utimes(older,new Date(1000),new Date(1000));await utimes(newer,new Date(2000),new Date(2000));
  const first=await bootstrapLocal(root);
  assert.equal(first.status,'PHASE2_LOCAL_READY');assert.equal(first.run_id,'run-old');assert.equal(first.phase,'02-visual-production');
  const ws=path.join(root,'processing','run-old','workspace');
  const state=JSON.parse(await readFile(path.join(ws,'.authoring','pipeline-state.json'),'utf8'));
  assert.equal(state.current_phase,'02-visual-production');
  assert.equal(state.phases['01-content'].status,'PASS');
  assert.equal(state.phases['02-visual-production'].steps.visual_compile.status,'READY');
  assert.ok(await readFile(path.join(ws,'.authoring','voice-profile.json'),'utf8'));
  assert.deepEqual((await readdir(inbox)).sort(),['new.zip']);
  const second=await bootstrapLocal(root);assert.equal(second.status,'PHASE2_LOCAL_READY');assert.equal(second.run_id,'run-new');assert.equal(second.resumed,false);
  assert.equal((await readdir(path.join(root,'processing'))).length,2);
  const ambiguous=await bootstrapLocal(root);assert.equal(ambiguous.status,'LOCAL_MULTIPLE_ACTIVE_EPISODES');
  const selected=await bootstrapLocal(root,{runId:'run-new'});assert.equal(selected.status,'PHASE2_LOCAL_READY');assert.equal(selected.run_id,'run-new');assert.equal(selected.resumed,true);
  const blocked=path.join(root,'blocked','blocked-run');await mkdir(blocked,{recursive:true});
  await writeFile(path.join(blocked,'import-receipt.json'),JSON.stringify({status:'BLOCKED'}));
  assert.equal((await bootstrapLocal(root)).status,'LOCAL_BLOCKED_HANDOFFS_PRESENT');
  assert.deepEqual(await readdir(inbox),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('tampered payload is blocked before a processing workspace is created',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-local-'));try{
  const inbox=path.join(root,'phase1-done');await mkdir(inbox,{recursive:true});const file=await capsule(inbox,'run-bad');
  const entries=parsePortableZip(await readFile(file));const target=entries.find(x=>x.rel==='narration.txt');target.data=Buffer.from('tampered\n');
  await writeFile(file,buildPortableZip(entries.map(({rel,data})=>({rel,data}))));
  const r=await bootstrapLocal(root);assert.equal(r.status,'PHASE1_HANDOFF_BLOCKED');assert.match(r.error,/INVENTORY|SHA|HASH/);
  const processing=path.join(root,'processing');assert.deepEqual(await readdir(processing).catch(()=>[]),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('approval drift is rejected even if capsule inventory is recomputed',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-local-'));try{
  const inbox=path.join(root,'phase1-done');await mkdir(inbox,{recursive:true});const file=await capsule(inbox,'run-drift');
  const entries=parsePortableZip(await readFile(file)),payload=entries.filter(x=>!['HANDOFF.json','SHA256SUMS'].includes(x.rel));
  payload.find(x=>x.rel==='narrative-plan.json').data=Buffer.from(JSON.stringify({format:'zodiac-narrative-plan@1',sign:'Song Tử',story_spine:{premise:'changed'}}));
  const {buildInventory,formatSha256Sums}=await import('../../contracts/phase1-handoff.mjs');const inventory=buildInventory(payload);
  const handoff=JSON.parse(entries.find(x=>x.rel==='HANDOFF.json').data);handoff.inventory=inventory;
  await writeFile(file,buildPortableZip([{rel:'HANDOFF.json',data:Buffer.from(JSON.stringify(handoff,null,2)+'\n')},...payload.map(x=>({rel:x.rel,data:x.data})),{rel:'SHA256SUMS',data:Buffer.from(formatSha256Sums(inventory))}]));
  const r=await bootstrapLocal(root);assert.equal(r.status,'PHASE1_HANDOFF_BLOCKED');assert.match(r.error,/CONTENT_APPROVAL_SOURCE_DRIFT/);
 }finally{await rm(root,{recursive:true,force:true})}
});
