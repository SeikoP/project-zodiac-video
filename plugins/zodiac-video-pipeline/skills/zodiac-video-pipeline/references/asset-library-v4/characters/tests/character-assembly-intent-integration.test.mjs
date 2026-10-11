import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {planCharacterStateAssets,compileCharacterAssembly} from '../compile-character-assembly.mjs';
import {validateCharacterAssembly} from '../../validation/validate-character-assembly.mjs';
test('v2 intent survives native plan, write and independent validation',async()=>{
 const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-v2-intent-'));
 try{
  await mkdir(path.join(d,'.authoring'));
  const production={version:'2.0',assets:{},scenes:[{id:'S01',voice:'Bọ Cạp soi người khác như thám tử.',entities:[{id:'scorpio',kind:'character',initial_state:'observe',states:{observe:{visible:true}}}]}]};
  const spec={entity_id:'scorpio',body_profile:'lanky_slouch',hair_id:'asym-bang',face_profile_id:'close-set',outfit_id:'scorpio-basic-clean',shirt_color_id:'slate',states:{observe:{pose_id:'inspect-prop',expression_id:'side-eye'}},design_intent:{role:'lead',selection_basis:'story_first',identity_tension:'Soi được người khác, tự khóa mình khi ai định hỏi ngược lại.',audience_read:'Ánh mắt tập trung còn cơ thể khép cửa để giữ những bí mật riêng tư.',decision_reasons:{body_profile:'Vai slouch phản ánh thói quen giữ khoảng cách khi bị hỏi.',hair_id:'Mái lệch che một phần trán để tạo cảm giác quan sát kín.',face_profile_id:'Đôi mắt thu gần để nhấn ánh nhìn tập trung vào chi tiết.',outfit_id:'Áo giản dị mang biểu tượng Bọ Cạp nhưng không tranh hiệu ứng.',shirt_color_id:'Sắc slate trầm đối lập nhân vật bạn sáng màu bên ngoài cửa.'},rejected_alternative:{choice:'round_soft',reason:'Dáng tròn quá vui khiến cảnh cài khóa mất độ căng.'},scene_anchor:{scene_id:'S01',excerpt:'soi người khác như thám tử',meaning:'Cần thể hiện cái nhìn soi xét khi mở cảnh.'},state_purposes:{observe:'Dùng tay và mắt nhìn qua mắt thần khi quan sát một người bạn.'},reuse_strategy:'native_assembly_after_story'}};
  const plan={format:'zodiac-character-assembly-plan@2',characters:[spec]};
  await writeFile(path.join(d,'.authoring/character-assembly-plan.json'),JSON.stringify(plan));
  await writeFile(path.join(d,'.authoring/character-state-asset-plan.json'),JSON.stringify(planCharacterStateAssets(production,plan)));
  const output=await compileCharacterAssembly(production,plan,{root:d,writeAssets:true});
  await writeFile(path.join(d,'production.json'),JSON.stringify(output));
  assert.deepEqual(await validateCharacterAssembly(d),{characters:1,states:1});
 }finally{await rm(d,{recursive:true,force:true});}
});
