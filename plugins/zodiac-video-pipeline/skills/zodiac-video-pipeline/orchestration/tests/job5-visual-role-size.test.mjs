import test from 'node:test';
import assert from 'node:assert/strict';
import {compileJobV5, assertJob5VisualRoleSizes} from '../compile-job-v5.mjs';

const makeIr=()=>({assets:{FX:{category:'effect',path:'assets/effects/x.svg'},PHONE:{category:'prop',path:'assets/props/phone.svg'}},scenes:[
  {id:'S02',layout_contract:{canvas:{width:1080,height:1920}},entities:[{id:'reaction',states:{off:{asset:'FX',visible:false,transform:{x:700,y:350,width:158,height:172}},on:{asset:'FX',visible:true,transform:{x:700,y:350,width:158,height:172}}}}]},
  {id:'S07',layout_contract:{canvas:{width:1080,height:1920}},entities:[{id:'storybeat-s07',states:{on:{asset:'FX',visible:true,transform:{x:375,y:405,width:154,height:175}}}}]},
  {id:'S13',layout_contract:{canvas:{width:1080,height:1920}},entities:[{id:'storybeat-s13',states:{on:{asset:'FX',visible:true,transform:{x:464,y:440,width:152,height:175}}}}]}
]});

test('pre-export visual-role gate reports all 3 renderer-invalid effects, not only S02',()=>{
  const ir=makeIr();
  assert.throws(()=>assertJob5VisualRoleSizes(ir),error=>
    /VISUAL_ROLE_TOO_SMALL/.test(error.message) &&
    ['S02','S07','S13'].every(id=>error.message.includes(id)) &&
    /minimum_area=30000/.test(error.message));
});
test('gate accepts effect areas above 30000 and rejects small scaled footprint',()=>{
  const ir=makeIr();
  for(const scene of ir.scenes)for(const entity of scene.entities)for(const state of Object.values(entity.states)){
    state.transform.width=180;state.transform.height=185;
  }
  assert.doesNotThrow(()=>assertJob5VisualRoleSizes(ir));
  ir.scenes[1].entities[0].states.on.transform.scale=0.7;
  assert.throws(()=>assertJob5VisualRoleSizes(ir),/S07/);
});
test('gate does not reject intentionally hidden effect but validates visible prop',()=>{
  const ir=makeIr(); ir.scenes= [{id:'S01',layout_contract:{canvas:{width:1080,height:1920}},entities:[{id:'phone',states:{off:{asset:'PHONE',visible:false,transform:{width:20,height:20}},on:{asset:'PHONE',visible:true,transform:{width:120,height:220}}}}]}];
  assert.throws(()=>assertJob5VisualRoleSizes(ir),/minimum_area=43000/);
  ir.scenes[0].entities[0].states.on.transform.width=220;
  assert.doesNotThrow(()=>assertJob5VisualRoleSizes(ir));
});
