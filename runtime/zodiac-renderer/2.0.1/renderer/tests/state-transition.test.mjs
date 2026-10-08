import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {resolveSemanticMotion} from "../src/semantic-motion.mjs";
test("state transition uses one SVG entity, preserving authored transforms",async()=>{
 const src=await readFile(new URL("../src/ZodiacRenderPlan.tsx",import.meta.url),"utf8");
 assert.match(src,/state = entity\.states\[stateId\]/);
 assert.match(src,/data-entity-id=\{entity\.id\}/);
 assert.doesNotMatch(src,/data-transition-from/);
 assert.doesNotMatch(src,/blend!\.progress/);
 assert.match(src,/top: transform\.y \?\? 0/);
 assert.match(src,/resolved\.translateX/);
 assert.match(src,/resolved\.rotateDeg/);
 assert.doesNotMatch(src,/idleY|idleScale/);
});
test("hold keeps one complete SVG motionless; named motion can move it",()=>{
 const event={event_id:"pause",target:"gemini",state_before:"listen",state_after:"listen",motion:"hold",start_frame:10,end_frame:21};
 const actor={id:"gemini",states:{listen:{}}};
 const scene={entities:[actor],spatial_bindings:[]};
 const a=resolveSemanticMotion(event,scene,actor,15);
 assert.equal(a.translateY,0);assert.equal(a.scale,1);assert.equal(a.rotateDeg,0);
 const bounce=resolveSemanticMotion({...event,motion:"small-bounce"},scene,actor,15);
 assert.ok(bounce.translateY<-19);
});
