import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSceneSetWorkspace} from '../../references/asset-library-v4/scene-set/compile-scene-set.mjs';
const actor={id:'actor',kind:'character',initial_state:'a',states:{a:{asset:'actor-art',layer:20,visible:true,transform:{x:90,y:750,width:400,height:550}}}};
const production=(id,bindings=[])=>({version:'2.0',assets:{},scenes:[{id:'s',environment:{scene_set_id:id},entities:[structuredClone(actor)],spatial_bindings:bindings,events:[]}]});
test('backdrop variants preserve independent foreground character staging',async()=>{
 for(const id of ['scene-set-home','scene-set-cafe']){
  const r=await compileSceneSetWorkspace('.',{production:production(id),write:false});
  assert.deepEqual(r.production.scenes[0].entities.find(e=>e.id==='actor'),actor);
  assert.equal(r.production.scenes[0].environment.scene_set.presentation_role,'supporting_backdrop');
 }
});
test('character cannot use decorative scene-set as physical supporting surface',async()=>{
 await assert.rejects(()=>compileSceneSetWorkspace('.',{production:production('scene-set-home',[{entity:'actor',anchor:'env__scene-set-home',relation:'on_surface',max_distance_px:600}]),write:false}),/BACKDROP_PHYSICAL_SUPPORT/);
});
