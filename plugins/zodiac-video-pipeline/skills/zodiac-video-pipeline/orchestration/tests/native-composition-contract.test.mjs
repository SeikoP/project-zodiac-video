import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {materializeEnvironment} from '../../references/asset-library-v4/environments/compile-environment.mjs';
import {compileCharacterAssembly} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';

const source=()=>({version:'2.0',assets:{},scenes:[{id:'s',environment:{scene_set_id:'scene-set-classroom'},entities:[]}]});
test('retired environment profiles require a pinned recovery snapshot',()=>{const p=source();p.scenes[0].environment.profile='classroom-study';assert.throws(()=>materializeEnvironment(p),/RECOVERY_SNAPSHOT_REQUIRED/);});
test('character compiler supplies state metadata without overriding hidden state',async()=>{
 const p=source();p.scenes[0].entities=[{id:'hero',kind:'character',initial_state:'n',states:{n:{transform:{x:1,y:1,width:300,height:400}},hidden:{visible:false,layer:12,transform:{x:1,y:1,width:300,height:400}}}}];
 const plan={format:'zodiac-character-assembly-plan@1',characters:[{entity_id:'hero',body_profile:'standard_compact',hair_id:'low-ponytail',outfit_id:'plain-shirt',variant_seed:'x',states:{n:{pose_id:'neutral',expression_id:'neutral'},hidden:{pose_id:'neutral',expression_id:'neutral'}}}]};
 const out=await compileCharacterAssembly(p,plan),e=out.scenes[0].entities[0];assert.equal(e.visual_role,'character');assert.equal(e.states.n.layer,20);assert.equal(e.states.n.visible,true);assert.equal(e.states.hidden.visible,false);assert.equal(e.states.hidden.layer,12);
 p.scenes[0].entities[0].visual_role='background';await assert.rejects(()=>compileCharacterAssembly(p,plan),/ROLE_CONFLICT/);
});
