import test from 'node:test';import assert from 'node:assert/strict';
import {validateAnchorLanes} from '../validate-anchor-lanes.mjs';
const token={motion_defaults:{bounce:{duration_frames:10}}};
const event=(id,target='friend',text='Rồi chỉ cần một người lên tiếng.')=>({id,target,intent:id,trigger:{type:'voice_anchor',text},state_before:'on',state_after:'on',desired_motion:'bounce',scheduling:{max_drift_frames:8,merge_policy:'never'}});
const ir=events=>({video:{fps:24},scenes:[{id:'S05',events}]});
test('same target and same anchor catches the Leo 10-frame versus 8-frame conflict',()=>{const r=validateAnchorLanes(ir([event('expression'),event('gaze')]),token);assert.equal(r.status,'BLOCKED');assert.equal(r.issues[0].required_drift_frames,10);});
test('gaze on the actual spoken compliment has a distinct scheduling anchor',()=>{assert.equal(validateAnchorLanes(ir([event('expression'),event('gaze','friend','Ê, hôm nay cậu chuẩn bị hết đống này à? Đỉnh thật!')]),token).status,'PASS');});
test('different actors may react together; ample explicit drift remains legal',()=>{assert.equal(validateAnchorLanes(ir([event('expression'),event('gaze','leo')]),token).status,'PASS');const b=event('gaze');b.scheduling.max_drift_frames=10;assert.equal(validateAnchorLanes(ir([event('expression'),b]),token).status,'PASS');});
test('same intent and state may merge only when explicit policy permits it',()=>{const a=event('expression'),b={...a,id:'gaze',scheduling:{max_drift_frames:0,merge_policy:'same_intent_same_state'}};assert.equal(validateAnchorLanes(ir([a,b]),token).status,'PASS');b.intent='different';assert.equal(validateAnchorLanes(ir([a,b]),token).status,'BLOCKED');});
