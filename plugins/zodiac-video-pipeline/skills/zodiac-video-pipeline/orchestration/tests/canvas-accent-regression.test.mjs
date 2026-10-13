import test from 'node:test';import assert from 'node:assert/strict';
import {validateCanvasAccents,resolveCanvasAccentEntities} from '../../features/visual-composition/validate-canvas-accents.mjs';
const make=()=>{
 const accent=(id,x)=>({id,kind:'scene_accent',visual_role:'scene_accent',initial_state:'hidden',states:{
  hidden:{asset:id,visible:false,transform:{x,y:120,width:220,height:180}},
  shown:{asset:id,visible:true,transform:{x,y:120,width:220,height:180}}
 }});
 return {scene:{id:'S01',voice:'Cửa sổ hiện ra, thực đơn biến mất.',
  layout_contract:{caption_safe_zone:{x:80,y:1400,width:900,height:330}},
  entities:[accent('window',120),accent('menu',620)],
  events:[{id:'E1',target:'window',state_after:'shown',trigger:{type:'voice_anchor',text:'Cửa sổ'}},
          {id:'E2',target:'menu',state_after:'hidden',trigger:{type:'voice_anchor',text:'thực đơn'}}]},
 assets:{window:{category:'scene_accent',path:'assets/environment/window.svg'},
         menu:{category:'scene_accent',path:'assets/environment/menu.svg'}}};
};
test('cafe has optional accents without Scene Set',()=>{
 const {scene,assets}=make();assert.equal(validateCanvasAccents(scene,assets).status,'PASS');
 assert.equal(scene.environment?.scene_set_id,undefined);
});
test('accent with missing referenced asset is blocked',()=>{
 const {scene,assets}=make();delete assets.menu;assert.ok(validateCanvasAccents(scene,assets).issues.some(x=>x.code==='SCENE_ACCENT_ASSET_INVALID'));
});
test('accent heading into caption safe zone is blocked',()=>{
 const {scene,assets}=make();scene.entities[0].states.shown.transform.y=1440;
 assert.ok(validateCanvasAccents(scene,assets).issues.some(x=>x.code==='SCENE_ACCENT_CAPTION_COLLISION'));
});
test('accent visibility event cannot refer to missing state or narration',()=>{
 const {scene,assets}=make();scene.events[0].state_after='ghost';scene.events[1].trigger.text='không tồn tại';
 const codes=validateCanvasAccents(scene,assets).issues.map(x=>x.code);
 assert.ok(codes.includes('SCENE_ACCENT_EVENT_STATE_MISSING'));
 assert.ok(codes.includes('SCENE_ACCENT_EVENT_ANCHOR_MISSING'));
});
test('accent may be explicitly omitted',()=>{
 const {scene,assets}=make();scene.entities=[];scene.events=[];
 assert.equal(validateCanvasAccents(scene,assets).status,'PASS');
});

test('actor-relative accent resolves above head without moving actor or adding physical contact',()=>{
 const {scene,assets}=make();
 scene.entities.unshift({id:'hero',kind:'character',initial_state:'idle',
   states:{idle:{visible:true,transform:{x:450,y:650,width:300,height:550}}}});
 const original=structuredClone(scene.entities[0]);
 const accent=scene.entities.find(e=>e.id==='window');
 accent.anchor={type:'actor',actor_id:'hero',placement:'above_head',offset_px:{x:0,y:-16}};
 for(const state of Object.values(accent.states))state.transform={x:0,y:0,width:220,height:180};
 const resolved=resolveCanvasAccentEntities(scene.entities);
 assert.deepEqual(resolved[0],original,'actor position remains independently authored');
 const t=resolved.find(e=>e.id==='window').states.shown.transform;
 assert.deepEqual([t.x,t.y],[490,454]);
 assert.equal(validateCanvasAccents({...scene,entities:resolved},assets).status,'PASS');
 assert.deepEqual(scene.entities[1].states.shown.transform,{x:0,y:0,width:220,height:180},
  'authored intent remains untouched');
});
test('missing actor for relative accent fails before export',()=>{
 const {scene}=make();
 scene.entities[0].anchor={type:'actor',actor_id:'unknown'};
 assert.throws(()=>resolveCanvasAccentEntities(scene.entities),/SCENE_ACCENT_ACTOR_ANCHOR_INVALID/);
});
