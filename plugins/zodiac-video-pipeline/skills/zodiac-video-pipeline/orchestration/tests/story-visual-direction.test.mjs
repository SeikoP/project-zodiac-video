import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoryVisualDirection} from '../../references/validate-story-visual-direction.mjs';

const candidate={id:'C1',evidence_refs:['E1','E2']};
const visual=()=>({
 id:'NV1',beat_ids:['B1'],evidence_refs:['E1'],
 trait_basis:'Thiên Bình cân nhắc nhiều phía trước khi chốt một lựa chọn.',
 story_point:'Cố giữ cả hai phía hài lòng khiến nhân vật trì hoãn quyết định.',
 viewer_read:'Nhân vật đang tự làm quyết định nặng hơn vì cứ giữ cả hai lựa chọn.',
 visible_subject:'Nhân vật đứng giữa hai tấm thẻ lựa chọn',
 visible_action:'Nhân vật lần lượt đặt rồi nhấc hai thẻ khỏi một mặt bàn, không dám bỏ thẻ nào.',
 visual_idea:'Một bàn nhỏ giữa khung hình, hai thẻ lựa chọn ở hai bên, nhân vật liên tục đổi tay nhưng vẫn giữ cả hai.',
 concept_fit:'Hành động này biến premise do dự vì muốn giữ hòa khí thành một việc nhìn thấy được.',
 centrality_reason:'Đây là mâu thuẫn chính của beat và thay đổi cách người xem hiểu sự chần chừ.',
 contribution:'Nhịp đổi tay và việc không chịu bỏ thẻ tạo ra ý nghĩa mà một câu chữ ngắn khó diễn tả.',
 tone_fit:'Deadpan và hơi buồn cười vì hành động quá nghiêm túc cho một lựa chọn đời thường.',
 payoff_image:'Cuối beat nhân vật đặt hẳn một thẻ xuống và đẩy thẻ kia ra khỏi bàn.'
});
const plan=()=>({version:'2.0',selected_concept_id:'C1',beats:[{id:'B1',evidence_refs:['E1']},{id:'B2',evidence_refs:['E2']}],story_visuals:[visual()]});

test('missing directions are not an editorial omission decision',()=>{const p=plan();delete p.story_visuals;assert.equal(validateStoryVisualDirection(p,{selectedCandidate:candidate}).status,'BLOCKED');});

test('explicit Phase-1 omission is valid without a visual quota',()=>{const p=plan();p.story_visuals=[];p.story_visual_decision={mode:'omitted',reason:'The offered hand and physical bag already show the rejected help.'};assert.equal(validateStoryVisualDirection(p,{selectedCandidate:candidate}).status,'PASS');});

test('invalid plan version cannot pass through the empty-visual path',()=>{const p=plan();p.version='bad';p.story_visuals=[];assert.equal(validateStoryVisualDirection(p).status,'BLOCKED');});
test('accepts one concrete trait-first direction',()=>assert.equal(validateStoryVisualDirection(plan(),{selectedCandidate:candidate}).status,'PASS'));
test('rejects missing concrete visible action',()=>{const p=plan();p.story_visuals[0].visible_action='';assert.match(JSON.stringify(validateStoryVisualDirection(p,{selectedCandidate:candidate}).issues),/STORY_VISUAL_FIELD_REQUIRED/);});
test('rejects overlapping visual ownership of one beat',()=>{const p=plan();p.story_visuals.push({...visual(),id:'NV2'});assert.match(JSON.stringify(validateStoryVisualDirection(p,{selectedCandidate:candidate}).issues),/STORY_VISUAL_BEAT_OVERLAP/);});
test('rejects evidence outside concept/plan',()=>{const p=plan();p.story_visuals[0].evidence_refs=['E9'];assert.match(JSON.stringify(validateStoryVisualDirection(p,{selectedCandidate:candidate}).issues),/STORY_VISUAL_EVIDENCE_UNKNOWN/);});
