import test from 'node:test';
import assert from 'node:assert/strict';
import {planCharacterStateAssets} from '../compile-character-assembly.mjs';

const make=()=>{
 const production={version:'2.0',assets:{},scenes:[{id:'S01',voice:'Bọ Cạp nhìn qua mắt thần, rồi khép cửa.',entities:[{id:'scorpio',kind:'character',initial_state:'observe',states:{observe:{},shut:{}}}]}]};
 const intent={role:'lead',identity_tension:'Quan sát người khác rất kỹ nhưng giữ kín tâm trạng của chính mình.',audience_read:'Vừa tỉnh táo soi xét vừa tự khóa cửa khi ai hỏi ngược lại.',
  selection_basis:'story_first',decision_reasons:{body_profile:'Dáng gọn tạo cảm giác giữ khoảng cách khi đứng bên cánh cửa.',hair_id:'Tóc lệch và đường mái che một bên mắt thể hiện tính kín đáo.',face_profile_id:'Đôi mắt hẹp vừa đủ giữ vẻ dò xét thay vì hung dữ.',outfit_id:'Trang phục gọn màu tối tạo đối trọng với chiếc chốt khóa.',shirt_color_id:'Màu xanh ngọc tách nhân vật chính khỏi nhân vật bạn đứng ngoài cửa.'},
  rejected_alternative:{choice:'round_soft',reason:'Dáng tròn tạo cảm giác thân thiện quá mức với cảnh đối đầu.'},
  scene_anchor:{scene_id:'S01',excerpt:'nhìn qua mắt thần',meaning:'Phải thể hiện chủ động quan sát qua mắt thần.'},
  state_purposes:{observe:'Chủ động soi qua mắt thần khi nhận ra bạn không ổn.',shut:'Khép cửa và giữ bí mật khi bị hỏi ngược lại.'},reuse_strategy:'native_assembly_after_story'};
 const plan={format:'zodiac-character-assembly-plan@2',characters:[{entity_id:'scorpio',body_profile:'lean_tall',hair_id:'side-part',face_profile_id:'balanced',outfit_id:'scorpio-basic-clean',shirt_color_id:'teal',states:{observe:{pose_id:'neutral',expression_id:'deadpan'},shut:{pose_id:'facepalm',expression_id:'exasperated'}},design_intent:intent}]};
 return {production,plan};
};
test('v2 requires story-first design intent before planning assets',()=>{const {production,plan}=make();assert.equal(planCharacterStateAssets(production,plan).characters.length,1);delete plan.characters[0].design_intent;assert.throws(()=>planCharacterStateAssets(production,plan),/CHARACTER_INTENT_MISSING/);});
test('v2 rejects catalog-first motivations',()=>{const {production,plan}=make();plan.characters[0].design_intent.selection_basis='catalog_first';assert.throws(()=>planCharacterStateAssets(production,plan),/CHARACTER_INTENT_STORY_FIRST_REQUIRED/);});
test('v2 anchors must match actual scene voice',()=>{const {production,plan}=make();plan.characters[0].design_intent.scene_anchor.excerpt='không tồn tại trong câu';assert.throws(()=>planCharacterStateAssets(production,plan),/CHARACTER_INTENT_VOICE_ANCHOR_INVALID/);});
test('v2 design every planned state with behavioral purpose',()=>{const {production,plan}=make();delete plan.characters[0].design_intent.state_purposes.shut;assert.throws(()=>planCharacterStateAssets(production,plan),/CHARACTER_INTENT_STATE_PURPOSE_MISSING/);});
test('v2 rejects auto-shirt assignment for lead',()=>{const {production,plan}=make();delete plan.characters[0].shirt_color_id;assert.throws(()=>planCharacterStateAssets(production,plan),/CHARACTER_INTENT_SHIRT_CHOICE_REQUIRED/);});
test('legacy v1 plan remains accepted for legacy packages',()=>{const {production,plan}=make();plan.format='zodiac-character-assembly-plan@1';delete plan.characters[0].design_intent;assert.equal(planCharacterStateAssets(production,plan).characters.length,1);});
