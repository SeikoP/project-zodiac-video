import assert from 'node:assert/strict';
import test from 'node:test';
import {lintSemanticAnimation} from '../validate-animation-semantics.mjs';
const source=()=>({assets:{a:{category:'character',path:'assets/characters/a.svg'},e:{category:'effect',path:'assets/effects/e.svg'}},scenes:[{id:'s',events:[],entities:[{id:'a',initial_state:'base',states:{base:{asset:'a',visible:true,transform:{x:0,y:0,width:100,height:100}}}},{id:'e',initial_state:'off',states:{off:{asset:'e',visible:false,transform:{x:0,y:0,width:10,height:10}},on:{asset:'e',visible:true,transform:{x:0,y:0,width:10,height:10}}}}],spatial_bindings:[{entity:'e',anchor:'a',relation:'emitted_by',max_distance_px:100}]}]});
test('fails missing effect events',()=>assert(lintSemanticAnimation(source()).some(x=>x.code==='EFFECT_UNSCHEDULED')));
test('passes complete effect lifecycle',()=>{const ir=source();ir.scenes[0].events=[{target:'e',state_after:'on'},{target:'e',state_after:'off'}];assert.equal(lintSemanticAnimation(ir).filter(x=>x.severity==='P1').length,0);});
test('fails mislabeled effect category',()=>{const ir=source();ir.assets.e.category='prop';assert(lintSemanticAnimation(ir).some(x=>x.code==='ASSET_CATEGORY_MISMATCH'));});
test('checks spatial at alternate state',()=>{const ir=source();ir.scenes[0].entities[1].states.on.transform.x=1000;assert(lintSemanticAnimation(ir).some(x=>x.code==='SPATIAL_BOUND_EXCEEDED'));});
