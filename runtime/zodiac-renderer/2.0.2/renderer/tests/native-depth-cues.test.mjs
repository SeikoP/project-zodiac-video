import test from 'node:test';
import assert from 'node:assert/strict';
import {auditNativeDepthEntities} from '../src/spatial-layout.mjs';
const fixture=()=>{
 const assets={};
 const entities=['rear','divider','front'].map(role=>{
   const id='depth__s01__'+role,asset='DEPTH_S01_'+role.toUpperCase();
   assets[asset]={category:'environment',path:'assets/environment/depth-s01-'+role+'.svg'};
   return {id,kind:'object',initial_state:'visible',states:{visible:{asset,visible:true,layer:{rear:-12,divider:-7,front:15}[role],transform:{x:190,y:role==='front'?1130:220,width:700,height:240}}}};
 });
 return {scene:{id:'s01',entities,events:[]},assets};
};
test('three independent depth layers retain canonical order and caption-safe bounds',()=>{const {scene,assets}=fixture();assert.deepEqual(auditNativeDepthEntities(scene,assets),{count:3,roles:['rear','divider','front']});});
test('depth front is blocked from covering caption and face area',()=>{const {scene,assets}=fixture();scene.entities[2].states.visible.transform.y=1300;assert.throws(()=>auditNativeDepthEntities(scene,assets),/DEPTH_CAPTION_OR_CANVAS_INVALID/);});
test('background cannot masquerade as story prop or reuse absent assets',()=>{const {scene,assets}=fixture();assets.DEPTH_S01_DIVIDER.category='prop';assert.throws(()=>auditNativeDepthEntities(scene,assets),/DEPTH_ASSET_INVALID/);});
test('duplicate rear is blocked instead of implicitly flattening z layers',()=>{const {scene,assets}=fixture();scene.entities.push({...scene.entities[0],id:'depth__s01__rear'});assert.throws(()=>auditNativeDepthEntities(scene,assets),/DEPTH_DENSITY_INVALID|DEPTH_ROLE_INVALID/);});
