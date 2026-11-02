import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveSemanticMotion} from '../src/semantic-motion.mjs';
import {resolveDisplayedEntityState} from '../src/spatial-layout.mjs';
import {resolvePreviewEventPairs,findPreviewClipPair} from '../scripts/preview.mjs';
const pen={id:'pen',initial_state:'visible',states:{visible:{transform:{x:620,y:745,width:220,height:115}}}};
const notebook={id:'notebook',initial_state:'visible',states:{visible:{transform:{x:280,y:356,width:520,height:488}}}};
const scene={id:'s07',start_frame:0,duration_frames:40,spatial_bindings:[{entity:'pen',anchor:'notebook',relation:'points_to'}],entities:[pen,notebook]};
const event=motion=>({event_id:'s07_e01',state_before:'visible',state_after:'visible',asset_before:'PROP_PEN',asset_after:'PROP_PEN',motion,target:'pen',start_frame:10,end_frame:21});
test('slide peak moves pen tip to notebook mark',()=>{const m=resolveSemanticMotion(event('slide'),scene,pen,15);assert.ok(m.peak>.99);assert.ok(m.translateY<-150);assert.ok(m.translateX<-30);const tip={x:620+220*18/320+m.translateX,y:745+115*151/160+m.translateY};assert.ok(Math.abs(tip.x-(280+520*.60))<1);assert.ok(Math.abs(tip.y-(356+488*.64))<1);});
test('subtle tilt and bounce are visible only within event',()=>{const actor={id:'gemini',states:{visible:{}}};assert.ok(resolveSemanticMotion(event('subtle-tilt'),scene,actor,15).rotateDeg>=3.4);assert.ok(resolveSemanticMotion(event('small-bounce'),scene,actor,15).translateY<=-19);assert.equal(resolveSemanticMotion(event('small-bounce'),scene,actor,9).translateY,0);});
test('hold does not animate or count as motion only',()=>{const m=resolveSemanticMotion(event('hold'),scene,pen,15);assert.equal(m.translateY,0);assert.equal(m.rotateDeg,0);const p=resolvePreviewEventPairs({...scene,events:[event('hold')]})[0];assert.equal(p.static_hold,true);assert.equal(p.motion_only,false);assert.equal(p.second_role,'after');});
test('identical state_swap is rejected in preview',()=>{assert.throws(()=>resolvePreviewEventPairs({...scene,events:[event('state_swap')]}),/PREVIEW_NOOP_STATE_SWAP/);});
test('slide requires points_to anchor, no fallback',()=>{assert.throws(()=>resolveSemanticMotion(event('slide'),{entities:[pen]},pen,15),/SLIDE_CONTACT_BINDING_REQUIRED/);});
test('active motions are sampled at during frame',()=>{const p=resolvePreviewEventPairs({...scene,events:[event('slide')]})[0];assert.equal(p.second_role,'during');assert.equal(p.second_frame,15);});

const departingFriend={id:'friend',initial_state:'wait',states:{wait:{transform:{x:625,y:500,width:300,height:420}},withdraw:{transform:{x:775,y:500,width:300,height:420}}}};
const door={id:'door',initial_state:'bolted',states:{bolted:{transform:{x:420,y:320,width:280,height:610}}}};
const s05={id:'S05',start_frame:0,duration_frames:50,entities:[departingFriend,door],spatial_bindings:[{entity:'friend',anchor:'door',relation:'near',max_distance_px:850}],events:[{event_id:'S05_friend_leaves',target:'friend',state_before:'wait',state_after:'withdraw',motion:'slide',start_frame:20,end_frame:32}]};
test('author-approved S05 slide uses 150px smooth state-to-state movement',()=>{
 const ev=s05.events[0];
 assert.equal(resolveSemanticMotion(ev,s05,departingFriend,19).translateX,0);
 assert.equal(resolveSemanticMotion(ev,s05,departingFriend,20).translateX,0);
 const mid=resolveSemanticMotion(ev,s05,departingFriend,25).translateX;
 assert.ok(mid>40&&mid<100);
 assert.equal(resolveSemanticMotion(ev,s05,departingFriend,31).translateX,150);
 assert.equal(resolveSemanticMotion(ev,s05,departingFriend,32).translateX,0);
});
test('state slide requires an authored near anchor and bounded state transforms',()=>{
 const ev=s05.events[0];
 assert.throws(()=>resolveSemanticMotion(ev,{...s05,spatial_bindings:[]},departingFriend,25),/SLIDE_CONTACT_BINDING_REQUIRED/);
 const bad=structuredClone(departingFriend);bad.states.withdraw.transform.x=1500;
 assert.throws(()=>resolveSemanticMotion(ev,s05,bad,25),/SLIDE_CONTACT_OUT_OF_BOUNDS/);
});
test('state slide is selected for a Remotion animation clip even when not motion-only',()=>{
 const pair=resolvePreviewEventPairs(s05)[0];
 assert.equal(pair.motion_only,false);
 assert.equal(pair.second_role,'after');
 assert.equal(findPreviewClipPair({event_pairs:[{...pair,scene_id:'S05'}]},{scenes:[s05]}).event_id,'S05_friend_leaves');
});


test('fade-in/pop-in animate hidden-to-visible objects without duplicating SVG actors',()=>{
 const object={id:'thought',initial_state:'hidden',states:{hidden:{asset:'a',visible:false},shown:{asset:'b',visible:true}}};
 const action={event_id:'enter',target:'thought',state_before:'hidden',state_after:'shown',motion:'fade-in',start_frame:10,end_frame:21};
 const sc={id:'s',entities:[object],events:[action]};
 assert.equal(resolveDisplayedEntityState(sc,object,9).visible,false);
 assert.equal(resolveDisplayedEntityState(sc,object,10).asset,'b');
 assert.equal(resolveSemanticMotion(action,sc,object,10).opacity,0);
 assert.ok(resolveSemanticMotion(action,sc,object,15).opacity>0.49);
 assert.equal(resolveSemanticMotion(action,sc,object,20).opacity,1);
 assert.equal(resolveDisplayedEntityState(sc,object,21).asset,'b');
 const pop={...action,motion:'pop-in'};
 assert.equal(resolveSemanticMotion(pop,sc,object,10).scale,0.82);
 assert.equal(resolveSemanticMotion(pop,sc,object,20).scale,1);
});
test('fade-out fades to transparent before state changes to hidden',()=>{
 const obj={id:'effect',initial_state:'on',states:{on:{asset:'a',visible:true},off:{asset:'a',visible:false}}};
 const action={event_id:'exit',target:'effect',state_before:'on',state_after:'off',motion:'fade-out',start_frame:10,end_frame:21};
 const sc={id:'s',entities:[obj],events:[action]};
 assert.equal(resolveDisplayedEntityState(sc,obj,15).visible,true);
 assert.ok(resolveSemanticMotion(action,sc,obj,15).opacity<0.51);
 assert.equal(resolveSemanticMotion(action,sc,obj,20).opacity,0);
 assert.equal(resolveDisplayedEntityState(sc,obj,21).visible,false);
});
