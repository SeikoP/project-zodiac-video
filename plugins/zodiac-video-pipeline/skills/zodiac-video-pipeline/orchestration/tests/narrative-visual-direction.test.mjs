import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNarrativeVisualDirection} from '../../references/validate-narrative-visual-direction.mjs';

const candidate={id:'C1',evidence_refs:['E1','E2']};
const plan=()=>({
 version:'2.0',
 selected_concept_id:'C1',
 beats:[{id:'B1',evidence_refs:['E1']},{id:'B2',evidence_refs:['E2']}],
 narrative_visuals:[{
  id:'NV1',
  beat_ids:['B1','B2'],
  evidence_refs:['E1'],
  trait_basis:'Thiên Bình có xu hướng cân nhắc nhiều phía trước khi chốt.',
  story_tension:'Muốn giữ hòa khí nhưng càng cân nhắc càng mắc kẹt giữa hai lựa chọn.',
  claim:'Cố làm ai cũng hài lòng khiến chính nhân vật bị kẹt ở giữa.',
  concept_fit:'Hình ảnh biến mâu thuẫn trung tâm của concept thành một hành động có thể nhìn thấy.',
  concept_candidates:{
   literal:'Nhân vật quay qua quay lại giữa hai người đang chờ câu trả lời.',
   metaphor:'Một cán cân nội tâm biến thành cuộc tranh luận mini ngay trên đầu nhân vật.',
   exaggeration:'Cả một phiên tòa tí hon trong đầu, nơi mọi vai đều do chính nhân vật đóng.'
  },
  selected_concept:'metaphor',
  selection_reason:'Cán cân tranh luận giữ chất Thiên Bình nhưng có diễn biến và dễ tạo callback.',
  humor_mechanism:'Sự lịch sự bị phóng đại thành một phiên tranh luận nội tâm quá nghiêm túc.',
  payoff_image:'Nhân vật chốt một câu mềm nhưng dứt khoát, hai phía im lại và cán cân đứng yên.'
 }]
});

test('accepts trait-first Narrative Visual direction tied to concept beats',()=>{
 assert.equal(validateNarrativeVisualDirection(plan(),{selectedCandidate:candidate}).status,'PASS');
});
test('requires Narrative Visual direction for new fresh planning gate',()=>{
 const p=plan();delete p.narrative_visuals;
 assert.match(JSON.stringify(validateNarrativeVisualDirection(p,{selectedCandidate:candidate}).issues),/NARRATIVE_VISUAL_DIRECTION_REQUIRED/);
});
test('rejects missing concept ladder and unknown beat',()=>{
 const p=plan();delete p.narrative_visuals[0].concept_candidates.literal;p.narrative_visuals[0].beat_ids=['NOPE'];
 const issues=JSON.stringify(validateNarrativeVisualDirection(p,{selectedCandidate:candidate}).issues);
 assert.match(issues,/NARRATIVE_VISUAL_CONCEPT_CANDIDATE_REQUIRED/);
 assert.match(issues,/NARRATIVE_VISUAL_BEAT_UNKNOWN/);
});
test('rejects visual evidence outside selected concept and plan evidence',()=>{
 const p=plan();p.narrative_visuals[0].evidence_refs=['E9'];
 assert.match(JSON.stringify(validateNarrativeVisualDirection(p,{selectedCandidate:candidate}).issues),/NARRATIVE_VISUAL_EVIDENCE_UNKNOWN/);
});
