import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {materializeEnvironment} from '../../references/asset-library-v4/environments/compile-environment.mjs';
import {compileCharacterAssembly} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
const index=JSON.parse(await readFile(new URL('../../references/asset-library-v4/environments/composition-index.json',import.meta.url)));
const source=()=>({version:'2.0',assets:{},scenes:[{id:'s',environment:{profile:'classroom-study',modifier:'clean'},entities:[]}]});
test('native environment emits background roles and explicit states',()=>{const out=materializeEnvironment(source(),index);for(const e of out.scenes[0].entities){assert.equal(e.visual_role,'background');assert.equal(typeof e.states.visible.visible,'boolean');assert.ok(Number.isInteger(e.states.visible.layer));}});
test('environment refuses conflicting authored role on generated entity',()=>{const p=source();p.scenes[0].entities.push({id:'env__classroom-window',visual_role:'interactive_prop'});assert.throws(()=>materializeEnvironment(p,index),/ROLE_CONFLICT/);});
test('character compiler supplies state metadata without overriding hidden state',async()=>{
 const p=source();p.scenes[0].entities=[{id:'hero',kind:'character',initial_state:'n',states:{n:{transform:{x:1,y:1,width:300,height:400}},hidden:{visible:false,layer:12,transform:{x:1,y:1,width:300,height:400}}}}];
 const plan={format:'zodiac-character-assembly-plan@1',characters:[{entity_id:'hero',body_profile:'standard_compact',hair_id:'clean-bun',outfit_id:'virgo-basic-clean',variant_seed:'x',states:{n:{pose_id:'neutral',expression_id:'neutral'},hidden:{pose_id:'neutral',expression_id:'neutral'}}}]};
 const out=await compileCharacterAssembly(p,plan),e=out.scenes[0].entities[0];assert.equal(e.visual_role,'character');assert.equal(e.states.n.layer,20);assert.equal(e.states.n.visible,true);assert.equal(e.states.hidden.visible,false);assert.equal(e.states.hidden.layer,12);
 p.scenes[0].entities[0].visual_role='background';await assert.rejects(()=>compileCharacterAssembly(p,plan),/ROLE_CONFLICT/);
});
