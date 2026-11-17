import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildSourceBoundReviewReceipt} from '../../core/evidence/approval-source-hashes.mjs';
const proof={kind:'user_message',ref:'test:user-chot',text:'chốt'};
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'review-validation-'));await mkdir(path.join(root,'.authoring'));
 const scope={format:'zodiac-episode-scope@1',episode_id:'review-test',episode_format:'single_sign',member_ids:['capricorn'],title_working:'Ma Kết nhận giúp đỡ',topic_question:'Ai được làm phần việc chung?',selection_reason:'A concrete responsibility story.'};
 const voice={format:'zodiac-voice-profile@1',reference_present:false,narrator_relationship:'Người quen kể chuyện',affection_model:'Cà khịa nhẹ nhàng',attack_style:'Chỉ ra nghịch lý',language_register:'Khẩu ngữ tự nhiên',warmth_rule:'Giữ chất thân quen',comic_engine:[],contradiction_engine:[],sentence_music:[],emotional_movement:[],internal_voice:[],forbidden_drift:[],source_refs:[],firewall:{style_only:true,may_transfer:[],must_not_transfer:['claim','exact sentence','exact joke']}};
 const plan={version:'2.1',story_visual_decision:{mode:'omitted',reason:'The offered hand and physical bag show the ownership change.'},beats:[{id:'B1',voice_anchor:'Một câu đã duyệt.',performance:{delivery:'observational',energy:.4,emotion:'amused',pace:'medium',emphasis:[],reason:'Keep the short setup clear.'}}]};
 for(const [rel,value] of Object.entries({'narration.txt':'Một câu đã duyệt.','.authoring/narrative-plan.json':plan,'.authoring/episode-scope.json':scope,'.authoring/phase3-writer-brief.json':{creative_direction:{tone:'Conversational and dry'}},'.authoring/voice-profile.json':voice}))await writeFile(path.join(root,rel),typeof value==='string'?value:JSON.stringify(value));
 return {root,plan};
}
test('chốt cannot approve Phase 1 while a required visual decision is missing',async()=>{const {root,plan}=await fixture();try{delete plan.story_visual_decision;await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify(plan));await assert.rejects(()=>buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof}),/STORY_VISUAL_PHASE1_DECISION_REQUIRED/);}finally{await rm(root,{recursive:true,force:true});}});
test('chốt cannot approve missing source files',async()=>{const {root}=await fixture();try{await rm(path.join(root,'.authoring/voice-profile.json'));await assert.rejects(()=>buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof}),/REVIEW_INPUTS_REQUIRED voice/);}finally{await rm(root,{recursive:true,force:true});}});
test('valid Phase-1 inputs produce a source-bound approval after validation',async()=>{const {root}=await fixture();try{const r=await buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof});assert.equal(r.status,'APPROVED');assert.equal(r.source_hashes.plan.length,64);}finally{await rm(root,{recursive:true,force:true});}});
test('chốt cannot approve Phase 2 with incomplete steps',async()=>{const {root}=await fixture();try{await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({current_phase:'02-visual-production',phases:{'02-visual-production':{status:'READY'}}}));await assert.rejects(()=>buildSourceBoundReviewReceipt(root,{phase_id:'02-visual-production',proof}),/REVIEW_PHASE_NOT_READY/);}finally{await rm(root,{recursive:true,force:true});}});

test('an IN_REVIEW label cannot hide incomplete Phase-2 steps after chốt',async()=>{
 const {root}=await fixture();try{
  const {readFile}=await import('node:fs/promises'),state=JSON.parse(await readFile(new URL('../pipeline-state.template.json',import.meta.url),'utf8'));
  state.current_phase='02-visual-production';state.phases['01-content'].status='PASS';state.phases['01-content'].current_step='narration';for(const step of Object.values(state.phases['01-content'].steps))step.status='PASS';
  state.review_receipts=[await buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof})];state.phases['02-visual-production'].status='IN_REVIEW';state.phases['02-visual-production'].steps.visual_compile.status='READY';
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await assert.rejects(()=>buildSourceBoundReviewReceipt(root,{phase_id:'02-visual-production',proof}),/PHASE_NOT_COMPLETE/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('empty JSON files do not satisfy required semantic inputs',async()=>{const {root}=await fixture();try{await writeFile(path.join(root,'.authoring/voice-profile.json'),'{}');await assert.rejects(()=>buildSourceBoundReviewReceipt(root,{phase_id:'01-content',proof}),/VOICE_PROFILE_INVALID/);}finally{await rm(root,{recursive:true,force:true});}});
