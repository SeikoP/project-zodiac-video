import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateStoryObjectComposition as check} from '../validate-story-object-composition.mjs';
const rect=(x,y,width,height)=>({x,y,width,height,rotation:0});
const make=()=>{
 const person={id:'libra',kind:'character',initial_state:'idle',states:{idle:{asset:'cast',visible:true,transform:rect(330,580,340,500)}}};
 const object={id:'scale',kind:'prop',initial_state:'idle',states:{idle:{asset:'scale',visible:true,transform:rect(260,190,530,320)},tilt:{asset:'scale',visible:true,transform:rect(250,190,540,320)}}};
 const s1={id:'S01',voice:'Tớ cân nhắc cả hai hướng.',entities:[person,object],environment:{mode:'minimal',roles:{}},spatial_bindings:[{entity:'scale',anchor:'libra',relation:'emitted_by',max_distance_px:700}]};
 const s2={id:'S02',voice:'Khi nhìn từ phía bạn ấy',entities:structuredClone(s1.entities),environment:{mode:'minimal',roles:{}},spatial_bindings:structuredClone(s1.spatial_bindings)};
 const s3={id:'S03',voice:'Cuối cùng tự chọn',entities:structuredClone(s1.entities),environment:{mode:'minimal',roles:{}},spatial_bindings:structuredClone(s1.spatial_bindings)};
 return {plan:{beats:[
  {beat_id:'B01',scene_id:'S01',object_entity:'scale',presentation_mode:'thought_metaphor'},
  {beat_id:'B02',scene_id:'S02',object_entity:'scale',presentation_mode:'thought_metaphor'},
  {beat_id:'B03',scene_id:'S03',object_entity:'scale',presentation_mode:'thought_metaphor'}]},production:{scenes:[s1,s2,s3]}};
};
const codes=(p,v)=>check(p,v).issues.map(x=>x.code);
test('Libra balanced thought metaphor: figure + scale on paper, without fake bedroom',()=>{
 const {plan,production}=make();assert.equal(check(plan,production).status,'PASS');
});
test('reject object repurposed into scene environment/background',()=>{
 const {plan,production}=make();production.scenes[0].environment.roles.rear=['scale'];
 assert.ok(codes(plan,production).includes('STORY_OBJECT_USED_AS_ENVIRONMENT'));
});
test('reject story object occupying most of the viewport as a background substitute',()=>{
 const {plan,production}=make();production.scenes[0].entities[1].states.idle.transform=rect(1,1,1060,1400);
 assert.ok(codes(plan,production).includes('STORY_OBJECT_BACKDROP_TAKEOVER'));
});
test('reject metaphor without actor and without meaningful spatial relation',()=>{
 const {plan,production}=make();production.scenes[0].entities.shift();
 const c=codes(plan,production);assert.ok(c.includes('STORY_OBJECT_ACTOR_MISSING'));assert.ok(c.includes('STORY_OBJECT_RELATION_MISSING'));
});
test('physical interaction allows contact with surface; still rejects character occlusion',()=>{
 const {plan,production}=make();const e=production.scenes[0];
 plan.beats[0].presentation_mode='physical_interaction';
 e.spatial_bindings=[{entity:'scale',anchor:'libra',relation:'held_by',max_distance_px:700}];
 assert.equal(check(plan,production).status,'PASS');
 e.entities[1].states.idle.transform=rect(260,580,480,450);
 assert.ok(codes(plan,production).includes('STORY_OBJECT_OCCLUDES_CHARACTER'));
});
test('cutaway may focus full-frame metaphor but must return to an actor scene',()=>{
 const {plan,production}=make();const beat=plan.beats[1];beat.presentation_mode='visual_cutaway';beat.cutaway_return_scene_id='S03';
 production.scenes[1].entities=[production.scenes[1].entities[1]];
 production.scenes[1].entities[0].states.idle.transform=rect(10,90,1060,1700);
 assert.equal(check(plan,production).status,'PASS');
 beat.cutaway_return_scene_id='S01';assert.ok(codes(plan,production).includes('STORY_OBJECT_CUTAWAY_RETURN_INVALID'));
});
test('older source plan can remain explicitly legacy; new plans require mode',()=>{
 const {plan,production}=make();delete plan.beats[0].presentation_mode;
 assert.ok(codes(plan,production).includes('STORY_OBJECT_PRESENTATION_MODE_MISSING'));
 assert.equal(check(plan,production,{required:false}).status,'PASS');
});
test('runtime remains stable: review and Phase03 both gate composition before preview/zip',async()=>{
 const here=new URL('../',import.meta.url);
 const review=await readFile(new URL('run-director-v2-review.mjs',here),'utf8');
 const release=await readFile(new URL('run-phase03-production.mjs',here),'utf8');
 assert.match(review,/story_object_composition_v2/);
 assert.match(review,/stages\.splice\(before,0,[\s\S]*story_object_composition_v2/);
 assert.match(release,/validateStoryObjectCompositionWorkspace\(approved\)/);
});
