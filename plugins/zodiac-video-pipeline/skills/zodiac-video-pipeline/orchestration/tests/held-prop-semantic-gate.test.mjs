import test from 'node:test';
import assert from 'node:assert/strict';
import {lintSemanticAnimation} from '../validate-animation-semantics.mjs';
const states={neutral:{asset:'HERO_NEUTRAL',visible:true},raise:{asset:'HERO_RAISE',visible:true}};
function story({heroEvent=true,mapStates=1,relation='held_by'}={}){
 const map={annotated:{asset:'MAP',visible:true}};
 if(mapStates>1)map.revealed={asset:'MAP',visible:true};
 return {assets:{HERO_NEUTRAL:{category:'character',path:'assets/characters/neutral.svg'},HERO_RAISE:{category:'character',path:'assets/characters/raise.svg'},MAP:{category:'prop',path:'assets/props/map.svg'}},scenes:[{id:'S06',entities:[{id:'hero',initial_state:'neutral',states},{id:'paper_map',initial_state:'annotated',states:map}],events:heroEvent?[{id:'E06',target:'hero',intent:'raise_map',state_before:'neutral',state_after:'raise',desired_motion:'state_swap',trigger:{type:'voice_anchor',text:'nâng bản đồ'}}]:[],spatial_bindings:[{entity:'paper_map',anchor:'hero',relation,max_distance_px:400}]}]};
}
test('approved stationary prop held by a character with a real gesture is P2, not an invented P1',()=>{
 const d=lintSemanticAnimation(story());assert.equal(d.filter(x=>x.severity==='P1').length,0,JSON.stringify(d));assert.ok(d.some(x=>x.code==='STATIC_HELD_PROP_OWNER_GESTURE'&&x.severity==='P2'));
});
test('held prop without owner gesture remains blocking P1',()=>{
 const d=lintSemanticAnimation(story({heroEvent:false}));assert.ok(d.some(x=>x.code==='INTERACTIVE_PROP_UNSCHEDULED'&&x.severity==='P1'));
});
test('multi-state held prop without its own event remains blocking P1',()=>{
 const d=lintSemanticAnimation(story({mapStates:2}));assert.ok(d.some(x=>x.code==='INTERACTIVE_PROP_UNSCHEDULED'&&x.severity==='P1'));
});
test('points_to prop does not inherit static held-by exception',()=>{
 const d=lintSemanticAnimation(story({relation:'points_to'}));assert.ok(d.some(x=>x.code==='INTERACTIVE_PROP_UNSCHEDULED'&&x.severity==='P1'));
});
