import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSceneExperience} from '../../features/visual-composition/validate-scene-experience.mjs';

const char={id:'lead',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true}}};
const accent={id:'lamp',kind:'scene_accent',visual_role:'background',initial_state:'on',states:{on:{visible:true}}};
const prop={id:'cup',kind:'object',visual_role:'interactive_prop',initial_state:'held',states:{held:{visible:true}}};
function intent(scene){return {format:'zodiac-visual-intent@1',scenes:[scene]};}

test('behavior scene with only passive actor and passive accent is REVIEW',()=>{
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:'Remember a drink preference',experience_profile:{story_mode:'behavior'},entities:[char,accent],events:[],art_direction:{scene_experience:{environment_specificity:'Home cue supports the behavior.'}}}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='PASSIVE_STORYTELLING'));
});
test('meaningful physical action can satisfy behavior storytelling',()=>{
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:'Remember a drink preference',experience_profile:{story_mode:'behavior'},entities:[char,prop],events:[{id:'E1',target:'cup',action:'raise',state_before:'held',state_after:'held'}],spatial_bindings:[{entity:'cup',anchor:'lead',relation:'held_by'}],art_direction:{scene_experience:{environment_specificity:'Intentionally minimal counter space.',visual_callback:'Cup is the remembered detail.'}}}));
 assert.equal(r.decision,'PASS');
});
test('intentional sparse reflection scene can pass with explicit omissions',()=>{
 const r=reviewSceneExperience(intent({id:'S05',semantic_goal:'Land the final reframe',experience_profile:{story_mode:'reflection',sparse_reason:'Payoff needs negative space around the shell reframe.'},entities:[char],events:[],art_direction:{scene_experience:{environment_specificity:'Omitted to preserve payoff focus.',physical_storytelling:'Omitted because no physical object is narrated.',visual_callback:'Final line itself closes the callback.'}}}));
 assert.equal(r.decision,'PASS');
});
test('narrated physical object cannot be replaced only by narrative visual',()=>{
 const nv={id:'memory',kind:'narrative_visual',visual_role:'narrative_visual',initial_state:'on',states:{on:{visible:true}}};
 const r=reviewSceneExperience(intent({id:'S03',semantic_goal:'She remembers the cup',experience_profile:{story_mode:'behavior',required_physical_entities:['cup']},entities:[char,nv],events:[],art_direction:{scene_experience:{environment_specificity:'Memory space.',visual_callback:'Thread callback.'}}}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='PHYSICAL_STORY_ENTITY_MISSING'));
});
