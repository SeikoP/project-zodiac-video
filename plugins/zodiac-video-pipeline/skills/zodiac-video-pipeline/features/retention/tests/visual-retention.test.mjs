import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeVisualRetention} from '../visual-retention.mjs';
const ev=(n,hold=false)=>Array.from({length:n},(_,i)=>({id:'E'+i,state_before:'a'+i,state_after:hold?'a'+i:'b'+i,desired_motion:hold?'hold':'state_swap'}));
const scene=(id,seconds,n)=>({id,duration_hint_frames:Math.round(seconds*24),events:ev(n)});
test('Scorpio-like rhythm passes',()=>{const r=analyzeVisualRetention({fps:24,scenes:[scene('S1',10.33,2),scene('S2',11.67,4),scene('S3',14.67,2),scene('S4',21,4),scene('S5',11.33,4),scene('S6',13.67,4)]});assert.equal(r.status,'PASS');assert.ok(r.metrics.overall_event_interval_sec<8);});
test('Cancer-like long visual dead zones review',()=>{const r=analyzeVisualRetention({fps:24,scenes:[scene('S1',21.33,2),scene('S2',20.67,2),scene('S3',22.67,3),scene('S4',40.67,1),scene('S5',26.67,1)]});assert.equal(r.status,'REVIEW');assert.ok(r.issues.some(x=>x.code==='OVERALL_EVENT_DENSITY_LOW'));assert.ok(r.issues.some(x=>x.scene_id==='S4'&&x.code==='SCENE_EVENT_DENSITY_LOW'));});
test('hold-only event does not inflate meaningful event count',()=>{const s=scene('S1',24,1);s.events=ev(1,true);const r=analyzeVisualRetention({fps:24,scenes:[s]});assert.equal(r.scenes[0].meaningful_events,0);assert.equal(r.status,'REVIEW');});
