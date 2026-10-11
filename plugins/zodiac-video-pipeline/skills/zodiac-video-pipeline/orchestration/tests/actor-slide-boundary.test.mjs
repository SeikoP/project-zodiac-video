import test from 'node:test';
import assert from 'node:assert/strict';
import {assessSemanticEvent} from '../semantic-motion-qa.mjs';
// Geometry reproduces the approved S05 friend wait → withdraw transition.
const s05={id:'S05',entities:[
 {id:'friend',initial_state:'wait',states:{wait:{asset:'friend-wait',transform:{x:625,y:500,width:300,height:420},visible:true},withdraw:{asset:'friend-withdraw',transform:{x:775,y:500,width:300,height:420},visible:true}}},
 {id:'door',initial_state:'bolted',states:{bolted:{asset:'door',transform:{x:420,y:320,width:280,height:610},visible:true}}}
],spatial_bindings:[{entity:'friend',anchor:'door',relation:'near',max_distance_px:850}],events:[{id:'S05_friend_leaves',target:'friend',state_before:'wait',state_after:'withdraw',motion:{preset:'slide'}}]};
const actorEvent=s05.events[0];
test('S05 semantic slide requires actual actor contact and 150px state move',()=>{
 const r=assessSemanticEvent(s05,actorEvent);
 assert.equal(r.expected_motion.contact_profile,'actor-near-authored-state-v1');
 assert.equal(r.expected_motion.travel_px,150);
 assert.equal(r.runner_motion_check_required,true);
});
test('S05 slide must fail when actor loses authored contact',()=>{
 const s=structuredClone(s05);s.spatial_bindings=s.spatial_bindings.filter(x=>x.entity!=='friend');
 assert.throws(()=>assessSemanticEvent(s,s.events.find(e=>e.id==='S05_friend_leaves')),/SLIDE_CONTACT_BINDING_REQUIRED/);
});
test('S05 slide must fail when destination would leave canvas',()=>{
 const s=structuredClone(s05),f=s.entities.find(e=>e.id==='friend');
 f.states.withdraw.transform.x=1000;
 assert.throws(()=>assessSemanticEvent(s,s.events.find(e=>e.id==='S05_friend_leaves')),/SLIDE_/);
});
