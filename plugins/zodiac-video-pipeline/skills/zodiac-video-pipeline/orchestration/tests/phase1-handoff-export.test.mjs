import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parsePortableZip} from '../../core/portable/zip-primitives.mjs';
import {exportPhase1Handoff} from '../../phases/phase01/export-phase1-handoff.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');

async function fixture(){
  const root=await mkdtemp(path.join(tmpdir(),'zodiac-phase1-handoff-'));
  await mkdir(path.join(root,'.authoring'),{recursive:true});
  const narration=Buffer.from('Approved narration\\n');
  const performance={delivery:'dry teasing',energy:.45,emotion:'amused',pace:'medium',emphasis:[],reason:'Carry the approved setup without changing meaning.'};
  const plan=Buffer.from(JSON.stringify({version:'2.1',story_visual_decision:{mode:'omitted',reason:'The offered hand and physical bag already show the rejected help.'},selected_concept_id:'C1',story_spine:{premise:'attention can be misread as commitment'},beats:[{id:'B1',voice_anchor:'Approved narration',performance}]}));
  const scope=Buffer.from(JSON.stringify({episode_id:'handoff-test-run',sign:'Song Tử',concept:'Sự quan tâm bị hiểu nhầm'}));
  const brief=Buffer.from(JSON.stringify({creative_direction:{tone:'bình thường ↔ gắt'}}));
  const voice=Buffer.from(JSON.stringify({format:'zodiac-voice-profile@1',narrator_vibe:'sharp but controlled'}));
  await writeFile(path.join(root,'narration.txt'),narration);
  await writeFile(path.join(root,'.authoring','narrative-plan.json'),plan);
  await writeFile(path.join(root,'.authoring','episode-scope.json'),scope);
  await writeFile(path.join(root,'.authoring','phase3-writer-brief.json'),brief);
  await writeFile(path.join(root,'.authoring','voice-profile.json'),voice);
  const review={
    format:'zodiac-content-review@2',phase_id:'01-content',status:'APPROVED',run_id:'handoff-test-run',
    proof:{kind:'user_message',ref:'user-message-sha256:test-approved',text:'chốt'},
    source_hashes:{narration:hash(narration),plan:hash(plan),scope:hash(scope),brief:hash(brief),voice:hash(voice)}
  };
  await writeFile(path.join(root,'.authoring','content-review-receipt.json'),JSON.stringify(review,null,2));
  return root;
}

test('export blocks handoff narrative plan missing version',async()=>{
 const root=await fixture();try{
  const planPath=path.join(root,'.authoring','narrative-plan.json');
  const plan=JSON.parse(await readFile(planPath,'utf8'));delete plan.version;
  const raw=Buffer.from(JSON.stringify(plan));await writeFile(planPath,raw);
  const receiptPath=path.join(root,'.authoring','content-review-receipt.json'),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
  receipt.source_hashes.plan=hash(raw);await writeFile(receiptPath,JSON.stringify(receipt,null,2));
  await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'missing-version.zip')),/PHASE1_HANDOFF_NARRATIVE_PLAN_INVALID VERSION/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('export blocks missing visual decision even with matching approval hashes',async()=>{
 const root=await fixture();try{
  const planPath=path.join(root,'.authoring/narrative-plan.json'),plan=JSON.parse(await readFile(planPath,'utf8'));delete plan.story_visual_decision;
  const raw=Buffer.from(JSON.stringify(plan));await writeFile(planPath,raw);
  const reviewPath=path.join(root,'.authoring/content-review-receipt.json'),review=JSON.parse(await readFile(reviewPath,'utf8'));
  review.source_hashes.plan=hash(raw);await writeFile(reviewPath,JSON.stringify(review));
  await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'missing-decision.zip')),/STORY_VISUAL_PHASE1_DECISION_REQUIRED/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('export blocks handoff narrative plan missing performance beats',async()=>{
 const root=await fixture();try{
  const planPath=path.join(root,'.authoring','narrative-plan.json');
  const plan=JSON.parse(await readFile(planPath,'utf8'));delete plan.beats;
  const raw=Buffer.from(JSON.stringify(plan));await writeFile(planPath,raw);
  const receiptPath=path.join(root,'.authoring','content-review-receipt.json'),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
  receipt.source_hashes.plan=hash(raw);await writeFile(receiptPath,JSON.stringify(receipt,null,2));
  await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'missing-beats.zip')),/PHASE1_HANDOFF_NARRATIVE_PLAN_INVALID BEATS/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('exports deterministic lightweight phase1 handoff with approval-bound inventory',async()=>{
  const root=await fixture();
  try{
    const a=path.join(root,'a.zip'),b=path.join(root,'b.zip');
    const one=await exportPhase1Handoff(root,a),two=await exportPhase1Handoff(root,b);
    assert.equal(one.sha256,two.sha256);
    const entries=parsePortableZip(await readFile(a));
    const names=entries.map(x=>x.rel);
    for(const required of ['HANDOFF.json','SHA256SUMS','narration.txt','narrative-plan.json','episode-scope.json','writer-brief.json','voice-profile.json','content-review-receipt.json'])assert.ok(names.includes(required),required);
    assert.ok(!names.includes('pipeline-state.json'));
    assert.ok(!names.includes('plugin-use-decisions.json'));
    assert.ok(!names.some(x=>x.startsWith('validator-receipts/')));
    const handoff=JSON.parse(entries.find(x=>x.rel==='HANDOFF.json').data);
    assert.equal(handoff.format,'zodiac-phase1-handoff@2');
    assert.equal(handoff.run_id,'handoff-test-run');
    assert.equal(handoff.content_review.status,'APPROVED');
    assert.equal(handoff.content_review.source_hashes.voice.length,64);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('Web handoff carries selected concept and Voice Profile',async()=>{
 const root=await fixture();try{
 const zip=path.join(root,'handoff-concept.zip');await exportPhase1Handoff(root,zip);
 const entries=parsePortableZip(await readFile(zip));const handoff=JSON.parse(entries.find(e=>e.rel==='HANDOFF.json').data);
 assert.equal(handoff.concept,'attention can be misread as commitment');
 assert.ok(entries.some(e=>e.rel==='voice-profile.json'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('export does not require Web pipeline state',async()=>{
 const root=await fixture();try{
  await assert.doesNotReject(()=>exportPhase1Handoff(root,path.join(root,'x.zip')));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('rejects content changed after approval',async()=>{
 const root=await fixture();try{
  await writeFile(path.join(root,'narration.txt'),'Changed after approval\n');
  await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'x.zip')),/CONTENT_APPROVAL_SOURCE_DRIFT narration/);
 }finally{await rm(root,{recursive:true,force:true});}
});
