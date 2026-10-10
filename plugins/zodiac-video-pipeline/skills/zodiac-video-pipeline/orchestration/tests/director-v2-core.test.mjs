import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDirectorPlan,validateDirectorCausality,compileDirectorBlocking,sha256} from '../director-v2-core.mjs';

const narration='Bạn tưởng nó im lặng. Nhưng hóa ra nó đã đọc hết.';
const ch=(id,x,y,w=300,h=400,kind='character',asset='CHAR')=>({id,kind,initial_state:'on',states:{on:{asset,visible:true,transform:{x,y,width:w,height:h}}}});
const prod=()=>({version:'2.0',assets:{CHAR:{category:'character'},FX:{category:'effect'},PHONE:{category:'prop'}},scenes:[{id:'S02',voice:narration,scene_direction:{shot:'two-person'},entities:[ch('hero',170,430),ch('friend',620,430),ch('reaction',540,200,155,170,'effect','FX')],events:[{id:'notice',target:'hero',trigger:{type:'voice_anchor',text:'Bạn tưởng'},state_before:'on',state_after:'on'},{id:'respond',target:'friend',trigger:{type:'voice_anchor',text:'Nhưng hóa ra'},state_before:'on',state_after:'on'}]}]});
const plan=()=>({format:'zodiac-director-plan@1',narration_sha256:sha256(narration),beats:[{scene_id:'S02',beat_id:'S02-B1',voice_anchor:'Bạn tưởng',semantic_purpose:'realization',performer:'hero',target:'friend',action:'look_up',reaction:'look_away',visual_payoff:'expose_truth',shot_reason:'two-person tension',supported_motion_or_state:'state_swap',asset_cost_reason:'reuse-native',cause_event_id:'notice',reaction_event_id:'respond'}]});

test('director plan checks narration hash, cast, action, reaction and semantic scene coverage',()=>{
 const x=validateDirectorPlan(plan(),prod(),narration);assert.equal(x.status,'PASS',JSON.stringify(x.issues));
 for(const mutate of [p=>p.narration_sha256='0'.repeat(64),p=>p.beats[0].target='ghost',p=>p.beats[0].reaction='',p=>p.beats[0].supported_motion_or_state='fly',p=>p.beats[0].voice_anchor='absent']){
  const p=plan();mutate(p);assert.equal(validateDirectorPlan(p,prod(),narration).status,'BLOCKED');
 }
});
test('causality forbids reaction before trigger of cause',()=>{
 const p=plan();assert.deepEqual(validateDirectorCausality(p,prod()),[]);
 const reversed=prod();reversed.scenes[0].events[0].trigger.text='Nhưng hóa ra';reversed.scenes[0].events[1].trigger.text='Bạn tưởng';
 assert.ok(validateDirectorCausality(p,reversed).some(x=>x.code==='REACTION_PRECEDES_CAUSE'));
});
test('semantic blocking moves ONLY explicitly relayoutable supporting entities, preserving all character transforms',()=>{
 const p=plan();p.beats[0].blocking=[{entity_id:'reaction',anchor:'friend',side:'above-left',relayout:true}];
 const source=prod();const hero=structuredClone(source.scenes[0].entities[0]);const res=compileDirectorBlocking(source,p);
 assert.equal(res.issues.length,0,JSON.stringify(res.issues));
 assert.equal(res.changes.length,1);
 assert.deepEqual(source.scenes[0].entities[0],hero);
 assert.deepEqual(res.production.scenes[0].entities[0],hero);
 assert.ok(res.production.scenes[0].entities[2].states.on.transform.width*res.production.scenes[0].entities[2].states.on.transform.height>=30000);
});
test('reject auto moving characters, unsafe bounds, and collision with caption zone',()=>{
 const p=plan();p.beats[0].blocking=[{entity_id:'hero',anchor:'friend',side:'left',relayout:true}];
 assert.ok(compileDirectorBlocking(prod(),p).issues.some(x=>x.code==='DIRECTOR_CHARACTER_RELAYOUT_FORBIDDEN'));
 p.beats[0].blocking=[{entity_id:'reaction',anchor:'hero',side:'above-left',relayout:true}];
 assert.ok(compileDirectorBlocking(prod(),p).issues.some(x=>x.code==='DIRECTOR_BLOCKING_OFF_CANVAS'));
});
test('static holds require explicit reason, and event references must exist',()=>{
 const p=plan();p.beats[0].supported_motion_or_state='hold';p.beats[0].event_ids=['missing'];
 const q=validateDirectorPlan(p,prod(),narration).issues;
 assert.ok(q.some(x=>x.code==='STATIC_HOLD_UNJUSTIFIED'));
 assert.ok(q.some(x=>x.code==='DIRECTOR_EVENT_MISSING'));
});

test('reject conflicting blocking of one entity across beats and missing between secondary anchor',()=>{
 const p=plan();
 p.beats[0].blocking=[{entity_id:'reaction',anchor:'hero',side:'between',relayout:true}];
 assert.ok(validateDirectorPlan(p,prod(),narration).issues.some(x=>x.code==='BLOCKING_SECONDARY_ANCHOR_INVALID'));
 p.beats[0].blocking=[{entity_id:'reaction',anchor:'hero',side:'above',relayout:true}];
 p.beats.push({...p.beats[0],beat_id:'S02-B2'});
 assert.ok(validateDirectorPlan(p,prod(),narration).issues.some(x=>x.code==='BLOCKING_MULTIPLE_BEATS_CONFLICT'));
});
test('reject unresolved trigger even when both events reference a non-occurring quote',()=>{
 const p=plan(),v=prod();
 v.scenes[0].events[0].trigger.text='Không có trong lời kể';
 assert.ok(validateDirectorCausality(p,v).some(x=>x.code==='CAUSE_REACTION_TRIGGER_UNRESOLVED'));
});
