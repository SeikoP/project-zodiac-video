import test from 'node:test';import assert from 'node:assert/strict';
import {lintSceneEvents} from '../validate-authoring-scene-events.mjs';
const good={assets:{FX:{category:'effect'}},scenes:[{id:'s1',voice:'Ai vậy?',entities:[{id:'fx',kind:'object',initial_state:'off',states:{off:{asset:'FX',visible:false},on:{asset:'FX',visible:true}}}],events:[{id:'e1',target:'fx',action:'show',state_before:'off',state_after:'on',motion:{preset:'pop-in',duration_frames:7},trigger:{type:'voice_anchor',text:'Ai'}},{id:'e2',target:'fx',action:'hide',state_before:'on',state_after:'off',motion:{preset:'fade-out',duration_frames:9},trigger:{type:'voice_anchor',text:'vậy'}}]}]};
test('semantic events embedded in scene pass',()=>assert.equal(lintSceneEvents(good).status,'PASS'));
test('events solely in sidecar do not pass',()=>{const x=structuredClone(good);delete x.scenes[0].events;assert.ok(lintSceneEvents(x).errors.some(e=>e.problem==='SCENE_EVENTS_MISSING'))});
test('effect lifecycle requires release',()=>{const x=structuredClone(good);x.scenes[0].events.pop();assert.ok(lintSceneEvents(x).errors.some(e=>e.problem.startsWith('EFFECT_MISSING_RELEASE')))});
test('no fabricated voice anchor accepted',()=>{const x=structuredClone(good);x.scenes[0].events[0].trigger.text='wrong';assert.ok(lintSceneEvents(x).errors.some(e=>e.problem.startsWith('VOICE_ANCHOR_MISSING')))});

// Regression: native endpoint-pair previews can PASS even when the initial
// runtime state is already the event's *after* state.
test('first actor event must start from its initial state',()=>{const x=structuredClone(good);x.scenes[0].entities[0].initial_state='on';assert.ok(lintSceneEvents(x).errors.some(e=>e.problem.includes('EVENT_STATE_CHAIN_INITIAL')))});
test('consecutive actor events must form a continuous state chain',()=>{const x=structuredClone(good);x.scenes[0].events[1].state_before='off';assert.ok(lintSceneEvents(x).errors.some(e=>e.problem.includes('EVENT_STATE_CHAIN_DISCONNECTED')))});
