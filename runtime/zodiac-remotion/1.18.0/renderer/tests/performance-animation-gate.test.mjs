import test from "node:test";
import assert from "node:assert/strict";
import {materializeProductionDefaults,performanceMotionValues,validatePerformanceAnimation,validatePerformanceTiming} from "../src/performance-animation.mjs";
const perf=(o={})=>({intent:"notice",phase:"action",energy:0.6,focus:"other",anticipation_frames:6,hold_frames:8,settle_frames:10,...o});
const scene=()=>({id:"S01",entities:[{id:"hero",initial_state:"a",states:{a:{},b:{},c:{}}},{id:"other",initial_state:"a",states:{a:{}}}],events:[{id:"E1",target:"hero",state_before:"a",state_after:"b",performance:perf()}]});
test("story-changing events require acting timing",()=>{const s=scene();Object.assign(s.events[0].performance,{anticipation_frames:0,hold_frames:0,settle_frames:0});assert.throws(()=>validatePerformanceAnimation(s),/needs anticipation, hold, or settle/);});
test("reaction references an earlier cause",()=>{const s=scene();s.events.push({id:"E2",target:"hero",state_before:"b",state_after:"c",performance:perf({phase:"reaction",cause_event_id:"E1"})});assert.doesNotThrow(()=>validatePerformanceAnimation(s));s.events[1].performance.cause_event_id="MISSING";assert.throws(()=>validatePerformanceAnimation(s),/earlier event/);});
test("focus must resolve",()=>{const s=scene();s.events[0].performance.focus="missing";assert.throws(()=>validatePerformanceAnimation(s),/focus target/);});
test("reaction timing follows cause",()=>{const s=scene();s.events.push({id:"E2",target:"hero",state_before:"b",state_after:"c",performance:perf({phase:"reaction",cause_event_id:"E1"})});assert.throws(()=>validatePerformanceTiming(s,{E1:20,E2:20}),/after its cause/);assert.doesNotThrow(()=>validatePerformanceTiming(s,{E1:20,E2:24}));});
test("anticipation moves before action while hold is still",()=>{const p=perf();assert.notEqual(performanceMotionValues(-3,12,p,1).x,0);assert.deepEqual(performanceMotionValues(14,12,p,1),{x:0,y:0,rotate_deg:0,scale:1,opacity:1});});
test("settle decays instead of looping",()=>{const p=perf({hold_frames:0,settle_frames:12});assert.notEqual(performanceMotionValues(15,12,p,1).rotate_deg,0);assert.deepEqual(performanceMotionValues(30,12,p,1),{x:0,y:0,rotate_deg:0,scale:1,opacity:1});});

test("runtime materializes deterministic motion and acting timing",()=>{
  const production={video:{fps:30},visual_system:{motion_presets:{paper_nudge:{}}},scenes:[{id:"S01",events:[{id:"E1",target:"hero",action:"notice_change",state_before:"a",state_after:"b",trigger:{source:"scene_start"}}]}]};
  const out=materializeProductionDefaults(production);
  const event=out.scenes[0].events[0];
  assert.equal(event.motion.preset,"paper_nudge");
  assert.ok(event.motion.duration_frames>=5);
  assert.equal(event.performance.phase,"action");
  assert.ok(event.performance.anticipation_frames>0);
  assert.ok(event.performance.hold_frames>0);
  assert.ok(event.performance.settle_frames>0);
});
test("runtime preserves authored semantic performance overrides",()=>{
  const production={video:{fps:30},visual_system:{motion_presets:{paper_nudge:{}}},scenes:[{id:"S01",events:[{id:"E1",target:"hero",action:"react",state_before:"a",state_after:"b",trigger:{source:"scene_start"},performance:{phase:"reaction",intent:"catches it",cause_event_id:"CAUSE",focus:"other"}}]}]};
  const event=materializeProductionDefaults(production).scenes[0].events[0];
  assert.equal(event.performance.phase,"reaction");
  assert.equal(event.performance.intent,"catches it");
  assert.equal(event.performance.cause_event_id,"CAUSE");
  assert.ok(Number.isFinite(event.performance.energy));
});
