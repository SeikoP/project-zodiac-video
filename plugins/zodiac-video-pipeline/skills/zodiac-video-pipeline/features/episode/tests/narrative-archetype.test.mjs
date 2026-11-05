import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNarrativeArchetype,compileNarrativeArchetypeDirection,assertImplicitArchetypeLabel} from '../narrative-archetype.mjs';

const detective=()=>({
 format:'zodiac-narrative-archetype@1',
 mode_id:'detective_case',
 selection_basis:'hybrid',
 behavior_mechanics:[
  'Notices a mismatch between what was said yesterday and what appears today.',
  'Holds the question while comparing details before accepting an explanation.'
 ],
 visual_grammar:['case-file progression','clue emphasis','case-closed payoff'],
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
});

test('audience-emergent detective mode validates without fabricated counts',()=>{
 const a=detective();
 assert.equal(assertNarrativeArchetype(a),a);
 const d=compileNarrativeArchetypeDirection(a);
 assert.equal(d.mode_id,'detective_case');
 assert.equal(d.audience_resonance_used,true);
 assert.deepEqual(d.do_not_say_labels,['thám tử','detective']);
 assert.equal('audience_evidence' in d,false);
});

test('audience signal cannot replace story mechanics',()=>{
 const a=detective();a.behavior_mechanics=['Only one behavior'];
 assert.throws(()=>assertNarrativeArchetype(a),/behavior_mechanics/);
});

test('implicit viewer inference is required in v1',()=>{
 const a=detective();a.viewer_inference.explicitness='explicit';
 assert.throws(()=>assertNarrativeArchetype(a),/explicitness/);
});

test('recent mode repetition requires a reason',()=>{
 const a=detective();a.recent_mode_ids=['detective_case'];
 assert.throws(()=>assertNarrativeArchetype(a),/repeat_reason/);
 a.repeat_reason='The current story independently reproduces the clue-comparison mechanic and the audience signal is strong.';
 assert.equal(assertNarrativeArchetype(a),a);
});

test('raw audience comments and identity fields are forbidden',()=>{
 const a=detective();a.audience_evidence.raw_comments=['Scorpio is a detective'];
 assert.throws(()=>assertNarrativeArchetype(a),/raw audience feedback/);
});

test('implicit archetype label cannot leak into narration',()=>{
 const a=detective();
 assert.equal(assertImplicitArchetypeLabel(a,'Bọ Cạp nhìn cái ly, nhớ câu hôm qua rồi lặng lẽ đối chiếu từng chi tiết.'),true);
 assert.throws(()=>assertImplicitArchetypeLabel(a,'Bọ Cạp đúng là một thám tử trong tình huống này.'),/LABEL_LEAK/);
});
