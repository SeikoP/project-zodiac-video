import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parsePortableZip} from '../../core/portable/zip-primitives.mjs';
import {buildSourceBoundReviewReceipt} from '../../core/evidence/approval-source-hashes.mjs';
import {exportPhase1Handoff} from '../../phases/phase01/export-phase1-handoff.mjs';

const stateTemplate=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url),'utf8'));

async function fixture(){
  const root=await mkdtemp(path.join(tmpdir(),'zodiac-phase1-handoff-'));
  await mkdir(path.join(root,'.authoring','validator-receipts'),{recursive:true});
  await writeFile(path.join(root,'narration.txt'),'Approved narration\n');
  await writeFile(path.join(root,'.authoring','narrative-plan.json'),JSON.stringify({format:'zodiac-narrative-plan@1',sign:'Song Tá»­',story_spine:{premise:'attention can be misread as commitment'}}));
  await writeFile(path.join(root,'.authoring','episode-scope.json'),JSON.stringify({sign:'Song Tá»­',concept:'Sự quan tâm bị hiểu nhầm'}));
  await writeFile(path.join(root,'.authoring','phase3-writer-brief.json'),JSON.stringify({creative_direction:{tone:'bình thường ↔ gắt'}}));
  await writeFile(path.join(root,'.authoring','plugin-use-decisions.json'),JSON.stringify({format:'zodiac-plugin-use-decisions@1',replaces_zodiac:false,decisions:[],not_an_approval:true}));
  await writeFile(path.join(root,'.authoring','validator-receipts','narrative.json'),JSON.stringify({format:'zodiac-validator-receipt@1',capability_id:'narrative',status:'PASS',exit_code:0,executed_at:'2026-11-08T00:00:00Z',validator_sha256:'a'.repeat(64)}));
  const state=structuredClone(stateTemplate);
  state.run_id='handoff-test-run';
  state.current_phase='01-content';
  state.phases['01-content'].status='PASS';
  state.phases['01-content'].current_step='narration';
  for(const step of Object.values(state.phases['01-content'].steps))step.status='PASS';
  const receipt=await buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof:{kind:'user_message',ref:'conversation:user:test:approved'}});
  state.review_receipts=[receipt];
  await writeFile(path.join(root,'.authoring','pipeline-state.json'),JSON.stringify(state,null,2));
  await writeFile(path.join(root,'.authoring','content-review-receipt.json'),JSON.stringify(receipt,null,2));
  return root;
}

test('exports deterministic phase1 handoff with source-bound inventory',async()=>{
  const root=await fixture();
  try{
    const a=path.join(root,'a.zip'),b=path.join(root,'b.zip');
    const one=await exportPhase1Handoff(root,a),two=await exportPhase1Handoff(root,b);
    assert.equal(one.sha256,two.sha256);
    const entries=parsePortableZip(await readFile(a));
    const names=entries.map(x=>x.rel);
    for(const required of ['HANDOFF.json','SHA256SUMS','narration.txt','narrative-plan.json','episode-scope.json','writer-brief.json','pipeline-state.json','content-review-receipt.json','plugin-use-decisions.json'])assert.ok(names.includes(required),required);
    const handoff=JSON.parse(entries.find(x=>x.rel==='HANDOFF.json').data);
    assert.equal(handoff.format,'zodiac-phase1-handoff@1');
    assert.equal(handoff.run_id,'handoff-test-run');
    assert.equal(handoff.not_an_approval,true);
    assert.equal(handoff.content_review.status,'APPROVED');
  }finally{await rm(root,{recursive:true,force:true})}
});

test('Web handoff carries the selected concept for downstream local runner',async()=>{
 const root=await fixture();try{
 const zip=path.join(root,'handoff-concept.zip');await exportPhase1Handoff(root,zip);
 const entries=parsePortableZip(await readFile(zip));const handoff=JSON.parse(entries.find(e=>e.rel==='HANDOFF.json').data);
 assert.equal(handoff.concept,'attention can be misread as commitment');
 assert.equal(handoff.concept_context.premise,handoff.concept);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('rejects export after phase2 activation',async()=>{
  const root=await fixture();
  try{
    const p=path.join(root,'.authoring','pipeline-state.json');
    const state=JSON.parse(await readFile(p,'utf8'));
    state.current_phase='02-visual-production';state.phases['02-visual-production'].status='READY';state.phases['02-visual-production'].steps.visual_compile.status='READY';
    await writeFile(p,JSON.stringify(state));
    await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'x.zip')),/PHASE1_HANDOFF_PHASE2_ALREADY_ACTIVE/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('rejects approval source drift',async()=>{
  const root=await fixture();
  try{
    await writeFile(path.join(root,'narration.txt'),'Changed after approval\n');
    await assert.rejects(()=>exportPhase1Handoff(root,path.join(root,'x.zip')),/CONTENT_APPROVAL_SOURCE_DRIFT/);
  }finally{await rm(root,{recursive:true,force:true})}
});
