import test from "node:test";
import assert from "node:assert/strict";
import {validateSemanticAnimation} from "../src/semantic-animation.mjs";

const scene=()=>({id:"S01",entities:[
  {id:"safe",states:{closed:{},open:{}}},
  {id:"safe-door",states:{closed:{},open:{}}}
],events:[]});

test("mechanical events require a mechanism",()=>{const s=scene();s.events=[{id:"e1",target:"safe",action:"open_safe",state_before:"closed",state_after:"open"}];assert.throws(()=>validateSemanticAnimation(s),/requires mechanism declaration/);});
test("child entity mechanisms resolve to scene entities",()=>{const s=scene();s.events=[{id:"e1",target:"safe",action:"open_safe",state_before:"closed",state_after:"open",mechanism:{mode:"child_entities",parts:["safe-door"]}}];assert.doesNotThrow(()=>validateSemanticAnimation(s));s.events[0].mechanism.parts=["missing"];assert.throws(()=>validateSemanticAnimation(s),/mechanism part is not a scene entity/);});
test("strong articulation rejects whole-asset swaps",()=>{const s=scene();s.events=[{id:"e1",target:"safe",action:"open_safe",state_before:"closed",state_after:"open",mechanism:{mode:"whole_asset",justification:"Replace the whole object because this is intentionally rigid."}}];assert.throws(()=>validateSemanticAnimation(s),/cannot use whole_asset/);});
test("soft mechanical changes allow justified whole-asset mode",()=>{const s=scene();s.events=[{id:"e1",target:"safe",action:"screen_change",state_before:"closed",state_after:"open",mechanism:{mode:"whole_asset",justification:"The information surface is rigid and has no useful articulated child geometry."}}];assert.doesNotThrow(()=>validateSemanticAnimation(s));});
