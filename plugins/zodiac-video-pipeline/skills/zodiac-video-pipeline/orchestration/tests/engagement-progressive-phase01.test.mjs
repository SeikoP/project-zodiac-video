import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertEngagementDesign,assertEngagementReview,compileEngagementDirection} from '../../features/episode/engagement-contract.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const candidate={id:'C1',premise:'Cancer turns remembered details into belonging.'};
const plan={version:'2.1',selected_concept_id:'C1',beats:[{id:'B1'},{id:'B2'}]};
const design={
 format:'zodiac-engagement-design@1',
 selected_concept_id:'C1',
 source:{plan_sha256:hash(JSON.stringify(plan)),candidate_sha256:hash(JSON.stringify(candidate))},
 entry_hook:{intent:'Open with one concrete remembered detail.',mechanism:'Recognition before explanation.'},
 open_question:'Why do small remembered details matter so much here?',
 recognition_loop:['Remembered drink preference','Remembered food preference'],
 reframe_points:['Care becomes belonging','Distance can be a boundary rather than indifference'],
 payoff_callback:'The shell exists because closeness created something worth protecting.',
 beat_pull:[
  {beat_id:'B1',question_created:'Why remember this detail?',reason_to_continue:'The behavior has not been interpreted yet.',new_information:'Small care can signal belonging.',payoff_promised:'Belonging will later explain the shell.'},
  {beat_id:'B2',question_created:'Why pull back after becoming close?',reason_to_continue:'The apparent contradiction still needs resolving.',new_information:'A boundary can protect closeness.',payoff_promised:'The ending reconnects boundary and belonging.'}
 ]
};

test('engagement design validates and compiles minimized direction',()=>{
 assert.equal(assertEngagementDesign(design,{plan,selectedCandidate:candidate}),design);
 const d=compileEngagementDirection(design);
 assert.equal(d.entry_hook,design.entry_hook.intent);
 assert.equal(d.recognition_cues.length,2);
});

test('engagement design fails when beat pull coverage is incomplete',()=>{
 const bad=structuredClone(design);bad.beat_pull.pop();
 assert.throws(()=>assertEngagementDesign(bad,{plan,selectedCandidate:candidate}),/beat_pull_length/);
});

test('engagement review blocks unresolved pull or explanation risk',()=>{
 const narrationRaw='Cự Giải nhớ ly ít đá của bạn. Nhưng càng gần, họ càng có thứ cần bảo vệ.';
 const review={
  format:'zodiac-engagement-review@1',
  source:{
   design_sha256:hash(JSON.stringify(design)),
   plan_sha256:hash(JSON.stringify(plan)),
   narration_sha256:hash(narrationRaw)
  },
  criteria:Object.fromEntries(['hook_strength','early_value','curiosity_continuity','recognition_density','reframe_strength','payoff_satisfaction'].map(k=>[k,{result:'PASS',note:'The narration performs this engagement job with a grounded spoken move.',evidence_excerpt:'Cự Giải nhớ ly ít đá của bạn'}])),
  pull_chain:[
   {beat_id:'B1',result:'PASS',reason_to_continue:'The remembered detail creates an unresolved meaning.',evidence_excerpt:'Cự Giải nhớ ly ít đá của bạn'},
   {beat_id:'B2',result:'REVIEW',reason_to_continue:'The second beat repeats explanation without adding enough new movement.',evidence_excerpt:'càng gần, họ càng có thứ cần bảo vệ'}
  ],
  consecutive_explanation_risk:{result:'REVIEW',note:'Two adjacent semantic jobs are explanation-heavy and need a concrete move between them.'},
  decision:'REVIEW',
  revision_targets:['Add a concrete manifestation before the final reframe.']
 };
 assert.throws(()=>assertEngagementReview(review,{design,plan,narrationRaw}),/Content Review blocked by engagement REVIEW/);
});
