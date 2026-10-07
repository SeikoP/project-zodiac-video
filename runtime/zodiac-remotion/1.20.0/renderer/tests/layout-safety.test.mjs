import assert from "node:assert/strict";
import test from "node:test";
import {effectiveZIndex,overlapRatio,sceneStateSnapshots,validateSceneLayerSafety} from "../src/layout-safety.mjs";
const state=(x,layer,visible=true)=>({visible,layer,transform:{x,y:0,width:100,height:100},asset:"a"});
const scene=(a,b,events=[])=>({id:"S",entities:[
  {id:"hero",kind:"character",initial_state:"n",states:{n:a,n2:{...a}}},
  {id:"prop",kind:"object",initial_state:"n",states:{n:b,n2:{...b}}},
],events});
test("overlap ratio uses smaller box as denominator",()=>assert.equal(overlapRatio(state(0,1).transform,state(50,2).transform),0.5));
test("same-layer overlap is blocked",()=>assert.throws(()=>validateSceneLayerSafety(scene(state(0,3),state(50,3))),/LAYER_AMBIGUITY/));
test("explicit front/back overlap is allowed",()=>assert.doesNotThrow(()=>validateSceneLayerSafety(scene(state(0,3),state(50,4)))));
test("same layer without material overlap is allowed",()=>assert.doesNotThrow(()=>validateSceneLayerSafety(scene(state(0,3),state(96,3)))));
test("snapshots follow declared event state changes",()=>{const s=scene(state(0,3),state(200,3),[{id:"E",target:"prop",state_before:"n",state_after:"n2"}]);s.entities[1].states.n2=state(40,3);assert.equal(sceneStateSnapshots(s).length,2);assert.throws(()=>validateSceneLayerSafety(s),/after:E/);});
test("z-index tie break is deterministic without changing layer order",()=>{assert.ok(effectiveZIndex(4,0)>effectiveZIndex(3,99));assert.ok(effectiveZIndex(4,2)>effectiveZIndex(4,1));});
