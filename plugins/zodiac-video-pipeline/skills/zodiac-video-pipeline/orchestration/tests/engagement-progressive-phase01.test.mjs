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

test('adding a separate mock ad preserves base story design lineage while story edits still invalidate it',()=>{
 const revised={...structuredClone(plan),mock_ad:{text:'Quảng cáo hư cấu'}};
 assert.equal(assertEngagementDesign(design,{plan:revised,selectedCandidate:candidate}),design);
 revised.beats[0].semantic_delta='A different story';
 assert.throws(()=>assertEngagementDesign(design,{plan:revised,selectedCandidate:candidate}),/source_lineage/);
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


test('engagement design compiles an implicit narrative archetype',()=>{
 const withMode=structuredClone(design);
 withMode.narrative_archetype={
  format:'zodiac-narrative-archetype@1',
  mode_id:'detective_case',
  selection_basis:'hybrid',
  behavior_mechanics:[
   'Notices a mismatch and treats it as a clue worth holding.',
   'Compares details before accepting the ordinary explanation.'
  ],
  visual_grammar:['clue emphasis','case-file progression','case-closed callback'],
  viewer_inference:{
   target_label:'thám tử',
   aliases:['detective'],
   explicitness:'implicit',
   comment_affordance:'Leave the role unnamed so viewers can identify and name it themselves.'
  },
  audience_evidence:{
   source_kind:'user_reported_viewer_feedback',
   normalized_mode_id:'detective_case',
   signal_strength:'qualitative',
   not_zodiac_claim_evidence:true
  },
  recent_mode_ids:[]
 };
 assert.equal(assertEngagementDesign(withMode,{plan,selectedCandidate:candidate}),withMode);
 const compiled=compileEngagementDirection(withMode);
 assert.equal(compiled.narrative_mode.mode_id,'detective_case');
 assert.equal(compiled.narrative_mode.viewer_inference_target,'thám tử');
 assert.equal(compiled.narrative_mode.audience_resonance_used,true);
 assert.equal('audience_evidence' in compiled.narrative_mode,false);
});

const interaction={
 comment_move:'Ask which kind of Cancer the viewer lives with: the one who remembers or the one who withdraws.',
 share_target:'Send this to the Cancer who remembers your order but never says why.',
 quotable_line:'Họ không bớt quan tâm, họ chỉ đổi người được quan tâm.',
 replay_seam:'The last line returns to the remembered drink from the opening with a new meaning.'
};
const narrationRaw2='Cự Giải nhớ ly ít đá của bạn. Họ không bớt quan tâm, họ chỉ đổi người được quan tâm. Bạn là kiểu nào, nhớ hay lùi? Gửi cho người nhớ ly ít đá của bạn.';
const mkReview=(over={})=>({
 format:'zodiac-engagement-review@1',
 source:{design_sha256:hash(JSON.stringify(design2)),plan_sha256:hash(JSON.stringify(plan)),narration_sha256:hash(narrationRaw2)},
 criteria:Object.fromEntries(['hook_strength','early_value','curiosity_continuity','recognition_density','reframe_strength','payoff_satisfaction'].map(k=>[k,{result:'PASS',note:'The narration performs this engagement job with a grounded spoken move.',evidence_excerpt:'Cự Giải nhớ ly ít đá của bạn'}])),
 pull_chain:[{beat_id:'B1',result:'PASS',reason_to_continue:'The remembered detail creates an unresolved meaning.',evidence_excerpt:'Cự Giải nhớ ly ít đá của bạn'},{beat_id:'B2',result:'PASS',reason_to_continue:'The quotable reframe turns the detail into a boundary.',evidence_excerpt:'Họ không bớt quan tâm, họ chỉ đổi người được quan tâm'}],
 consecutive_explanation_risk:{result:'PASS',note:'Adjacent beats add a reframe and a viewer move, not repeated explanation.'},
 interaction_check:{
  comment_move:{result:'PASS',evidence_excerpt:'Bạn là kiểu nào, nhớ hay lùi'},
  share_target:{result:'PASS',evidence_excerpt:'Gửi cho người nhớ ly ít đá của bạn'},
  quotable_line:{result:'PASS',evidence_excerpt:'Họ không bớt quan tâm, họ chỉ đổi người được quan tâm'},
  replay_seam:{result:'PASS',evidence_excerpt:'nhớ ly ít đá của bạn'}
 },
 decision:'PASS',revision_targets:[],...over
});
const design2={...structuredClone(design),format:'zodiac-engagement-design@2',interaction};

test('design@2 requires interaction and legacy @1 stays valid without it',()=>{
 assert.equal(assertEngagementDesign(design,{plan,selectedCandidate:candidate}),design);
 const noInteraction={...structuredClone(design),format:'zodiac-engagement-design@2'};
 assert.throws(()=>assertEngagementDesign(noInteraction,{plan,selectedCandidate:candidate}),/interaction/);
 const longLine={...structuredClone(design2),interaction:{...interaction,quotable_line:'Quantrongnhatlahieu'}};
 assert.throws(()=>assertEngagementDesign(longLine,{plan,selectedCandidate:candidate}),/quotable_line_length/);
 assert.equal(assertEngagementDesign(design2,{plan,selectedCandidate:candidate}),design2);
});

test('interaction compiles into the writer direction and is checked against the spoken text',()=>{
 assert.equal(compileEngagementDirection(design2).interaction.quotable_line,interaction.quotable_line);
 assert.equal('interaction' in compileEngagementDirection(design),false);
 assert.doesNotThrow(()=>assertEngagementReview(mkReview(),{design:design2,plan,narrationRaw:narrationRaw2}));
 assert.throws(()=>assertEngagementReview(mkReview({interaction_check:undefined}),{design:design2,plan,narrationRaw:narrationRaw2}),/interaction_check/);
 const paraphrased='Cự Giải nhớ ly ít đá của bạn. Họ quan tâm theo cách khác. Bạn là kiểu nào, nhớ hay lùi? Gửi cho người nhớ ly ít đá của bạn.';
 const r=mkReview();r.source.narration_sha256=hash(paraphrased);
 assert.throws(()=>assertEngagementReview(r,{design:design2,plan,narrationRaw:paraphrased}),/quotable_line|excerpt/);
});
