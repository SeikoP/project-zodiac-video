import assert from "node:assert/strict";
import test from "node:test";
import {resolvePreviewEventPairs} from "../scripts/preview.mjs";

const scene = (events) => ({id:"s01",start_frame:120,duration_frames:90,events});

test("state/visibility change samples before and AFTER the resolved event",()=>{
  const out=resolvePreviewEventPairs(scene([{event_id:"E01",target:"prop",
    state_before:"hidden",state_after:"visible",asset_before:"A",asset_after:"A",
    start_frame:135,end_frame:144}]));
  assert.equal(out.length,1);
  assert.equal(out[0].before_frame,134);
  assert.equal(out[0].second_frame,148);
  assert.equal(out[0].second_role,"after");
  assert.equal(out[0].motion_only,false);
});

test("same-state motion samples BEFORE and DURING peak window",()=>{
  const out=resolvePreviewEventPairs(scene([{event_id:"E02",target:"actor",
    state_before:"idle",state_after:"idle",asset_before:"C",asset_after:"C",
    start_frame:150,end_frame:165}]));
  assert.equal(out[0].before_frame,149);
  assert.equal(out[0].second_frame,157);
  assert.equal(out[0].second_role,"during");
  assert.equal(out[0].motion_only,true);
});

test("last scene frame clamps an after sample",()=>{
  const out=resolvePreviewEventPairs(scene([{event_id:"E03",target:"effect",
    state_before:"hidden",state_after:"active",start_frame:200,end_frame:210}]));
  assert.equal(out[0].second_frame,209);
});

test("scenes with no animation still generate two scene-overview stills",()=>{
  const out=resolvePreviewEventPairs(scene([]));
  assert.equal(out.length,1);
  assert.equal(out[0].before_frame,120);
  assert.equal(out[0].second_frame,209);
  assert.equal(out[0].fallback,true);
});

test("invalid frame ranges and duplicate ids are rejected",()=>{
  assert.throws(()=>resolvePreviewEventPairs(scene([{event_id:"E1",start_frame:110,end_frame:130}])),/PREVIEW_EVENT_RANGE_INVALID/);
  assert.throws(()=>resolvePreviewEventPairs(scene([{event_id:"E1",start_frame:130,end_frame:134},{event_id:"E1",start_frame:142,end_frame:151}])),/PREVIEW_EVENT_ID_INVALID/);
});
