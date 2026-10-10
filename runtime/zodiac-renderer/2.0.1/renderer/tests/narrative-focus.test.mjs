import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {resolveSemanticMotion} from "../src/semantic-motion.mjs";
const source = () => readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url),"utf8");
const event={event_id:"focus",target:"gemini",state_before:"idle",state_after:"idle",motion:"focus-shift",start_frame:10,end_frame:21};
const scene={entities:[],spatial_bindings:[]},actor={id:"gemini",states:{idle:{}}};
test("authored x/y stay the baseline; animation is a temporary CSS transform",async()=>{
 const src=await source();assert.match(src,/left: transform\.x \?\? 0/);assert.match(src,/top: transform\.y \?\? 0/);assert.match(src,/resolveSemanticMotion\(active,scene,entity,frame\)/);assert.doesNotMatch(src,/idleY|idleScale/);
});
test("only explicitly targeted entities animate; no inherited generic jiggle",async()=>{
 const src=await source();assert.match(src,/item\.target\s*===\s*entityId/);
 assert.equal(resolveSemanticMotion(undefined,scene,actor,15).scale,1);
 assert.equal(resolveSemanticMotion(undefined,scene,actor,15).rotateDeg,0);
});
test("focus starts and settles at authored geometry with a measurable peak",()=>{
 assert.equal(resolveSemanticMotion(event,scene,actor,9).scale,1);
 assert.ok(resolveSemanticMotion(event,scene,actor,15).scale>1.05);
 assert.equal(resolveSemanticMotion(event,scene,actor,21).scale,1);
});
