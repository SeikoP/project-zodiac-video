import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSceneExperience} from '../../features/visual-composition/validate-scene-experience.mjs';

const char={id:'lead',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true}}};
const friend={id:'friend',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true}}};
const accent={id:'lamp',kind:'scene_accent',visual_role:'background',initial_state:'on',states:{on:{visible:true}}};
const prop={id:'cup',kind:'object',visual_role:'interactive_prop',initial_state:'held',states:{held:{visible:true}}};
function intent(scene){return {format:'zodiac-visual-intent@1',scenes:[scene]};}
const focus=(goal,support=['cup'])=>({goal,focal_entity_id:'lead',supporting_entity_ids:support,links:support.map(id=>({from:'lead',to:id,relation:'uses the supporting entity as visible evidence',purpose:'Turns the narrated behavior into one readable visual relationship.'}))});

test('behavior scene with only passive actor and passive accent is REVIEW',()=>{
 const goal='Remember a drink preference';
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:goal,experience_profile:{story_mode:'behavior'},entities:[char,accent],events:[],art_direction:{scene_experience:{environment_specificity:'Home cue supports the behavior.'}}}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='PASSIVE_STORYTELLING'));assert.ok(r.scenes[0].issues.some(x=>x.code==='STORY_FOCUS_MISSING'));
});

test('an action alone no longer proves focused storytelling',()=>{
 const goal='Remember a drink preference';
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:goal,experience_profile:{story_mode:'behavior'},entities:[char,prop],events:[{id:'E1',target:'cup',action:'raise',state_before:'held',state_after:'held'}],art_direction:{scene_experience:{environment_specificity:'Minimal counter.'}}}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='STORY_FOCUS_MISSING'));
});

test('meaningful physical action plus a goal-bound relation chain satisfies behavior storytelling',()=>{
 const goal='Remember a drink preference';
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:goal,experience_profile:{story_mode:'behavior',story_focus:focus(goal)},entities:[char,prop],events:[{id:'E1',target:'cup',action:'raise',state_before:'held',state_after:'held'}],spatial_bindings:[{entity:'cup',anchor:'lead',relation:'held_by'}],art_direction:{scene_experience:{environment_specificity:'Intentionally minimal counter space.',visual_callback:'Cup is the remembered detail.'}}}));
 assert.equal(r.decision,'PASS');assert.equal(r.scenes[0].criteria.story_focus_alignment.result,'PASS');assert.equal(r.scenes[0].criteria.depth_separation.result,'PASS');
});

test('focus must bind to the exact semantic goal',()=>{
 const goal='Remember a drink preference';
 const bad=focus('Show that she is generally caring');
 const r=reviewSceneExperience(intent({id:'S01',semantic_goal:goal,experience_profile:{story_mode:'behavior',story_focus:bad},entities:[char,prop],events:[{id:'E1',target:'cup',action:'raise'}]}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='STORY_FOCUS_GOAL_MISMATCH'));
});

test('relationship co-actor must be connected to the focal entity',()=>{
 const goal='She watches the friend but avoids being watched back';
 const r=reviewSceneExperience(intent({id:'S02',semantic_goal:goal,experience_profile:{story_mode:'relationship',story_focus:{goal,focal_entity_id:'lead',supporting_entity_ids:[],links:[]}},entities:[char,friend],events:[{id:'E1',target:'lead',action:'look away'}]}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='STORY_ENTITY_UNLINKED'&&x.entity_id==='friend'));
});

test('intentional sparse reflection scene can pass with explicit omissions',()=>{
 const r=reviewSceneExperience(intent({id:'S05',semantic_goal:'Land the final reframe',experience_profile:{story_mode:'reflection',sparse_reason:'Payoff needs negative space around the shell reframe.'},entities:[char],events:[],art_direction:{scene_experience:{environment_specificity:'Omitted to preserve payoff focus.',physical_storytelling:'Omitted because no physical object is narrated.',visual_callback:'Final line itself closes the callback.'}}}));
 assert.equal(r.decision,'PASS');
});

test('narrated physical object cannot be replaced only by narrative visual',()=>{
 const nv={id:'memory',kind:'narrative_visual',visual_role:'narrative_visual',initial_state:'on',states:{on:{visible:true}}};
 const goal='She remembers the cup';
 const r=reviewSceneExperience(intent({id:'S03',semantic_goal:goal,experience_profile:{story_mode:'behavior',required_physical_entities:['cup'],story_focus:{goal,focal_entity_id:'lead',supporting_entity_ids:['memory'],links:[{from:'lead',to:'memory',relation:'recalls the image',purpose:'Makes the memory visible while keeping the actor as the focal point.'}]}},entities:[char,nv],events:[{id:'E1',target:'memory',action:'reveal',state_before:'off',state_after:'on'}],art_direction:{scene_experience:{environment_specificity:'Memory space.',visual_callback:'Thread callback.'}}}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='PHYSICAL_STORY_ENTITY_MISSING'));
});

test('fresh scene without experience profile is REVIEW instead of silently passing',()=>{
 const r=reviewSceneExperience(intent({id:'S00',semantic_goal:'A behavior beat',entities:[char,accent],events:[]}));
 assert.equal(r.decision,'REVIEW');assert.ok(r.scenes[0].issues.some(x=>x.code==='EXPERIENCE_PROFILE_MISSING'));
});


test('relationship scene with tiny accent and flat repeated geometry is REVIEW',()=>{
 const goal='One partner keeps taking over while the other gets pushed out';
 const lead={id:'lead',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true,layer:20,transform:{x:141,y:450,width:328,height:480}}}};
 const peer={id:'friend',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true,layer:20,transform:{x:611,y:450,width:328,height:480}}}};
 const cue={id:'cue',kind:'scene_accent',visual_role:'background',initial_state:'on',states:{on:{visible:true,layer:5,transform:{x:70,y:100,width:300,height:190}}}};
 const r=reviewSceneExperience(intent({id:'S02',semantic_goal:goal,layout_contract:{canvas:{width:1080,height:1920},caption_safe_zone:{x:100,y:1450,width:880,height:360}},experience_profile:{story_mode:'relationship',story_focus:{goal,focal_entity_id:'lead',supporting_entity_ids:['friend'],links:[{from:'lead',to:'friend',relation:'takes over the shared task',purpose:'Shows the relational imbalance directly in the two-person beat.'}]}},entities:[lead,peer,cue],events:[{id:'E1',target:'lead',action:'take over'},{id:'E2',target:'friend',action:'step back'}],art_direction:{scene_experience:{environment_specificity:'Small context cue.'}}}));
 assert.equal(r.decision,'REVIEW');
 assert.ok(r.scenes[0].issues.some(x=>x.code==='ENVIRONMENT_VISUAL_UNDERDEVELOPED'));
 assert.ok(r.scenes[0].issues.some(x=>x.code==='VISUAL_DEPTH_UNDERDEVELOPED'));
 assert.ok(r.scenes[0].issues.some(x=>x.code==='FRAME_OCCUPANCY_LOW'));
});

test('relationship scene passes geometry criteria with real depth and stronger occupancy',()=>{
 const goal='One partner finally shares the task';
 const lead={id:'lead',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true,layer:20,transform:{x:85,y:466,width:430,height:629}}}};
 const peer={id:'friend',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{visible:true,layer:20,transform:{x:565,y:466,width:430,height:629}}}};
 const depth={id:'depth__S06__rear',kind:'object',visual_role:'background',initial_state:'visible',states:{visible:{visible:true,layer:-12,transform:{x:170,y:160,width:740,height:430}}}};
 const r=reviewSceneExperience(intent({id:'S06',semantic_goal:goal,layout_contract:{canvas:{width:1080,height:1920},caption_safe_zone:{x:100,y:1450,width:880,height:360}},experience_profile:{story_mode:'relationship',story_focus:{goal,focal_entity_id:'lead',supporting_entity_ids:['friend'],links:[{from:'lead',to:'friend',relation:'shares the task',purpose:'Makes the payoff readable through a clear relationship change.'}]}},entities:[lead,peer,depth],events:[{id:'E1',target:'lead',action:'accept help'},{id:'E2',target:'friend',action:'step in'}],art_direction:{scene_experience:{environment_specificity:'Abstract depth frame supports the handoff.'}}}));
 assert.equal(r.decision,'PASS');
 assert.equal(r.scenes[0].criteria.environment_specificity.result,'PASS');
 assert.equal(r.scenes[0].criteria.depth_separation.result,'PASS');
 assert.equal(r.scenes[0].criteria.frame_occupancy.result,'PASS');
});
