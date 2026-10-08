import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("transition uses one complete SVG and retains authored geometry", async()=>{
 const src=await readFile(new URL("../src/ZodiacRenderPlan.tsx",import.meta.url),"utf8");
 assert.match(src,/state = entity\.states\[stateId\]/);
 assert.match(src,/data-entity-id=\{entity\.id\}/);
 assert.match(src,/stateId = entering/);
 assert.match(src,/lastResolvedAfterAsset = assets\[event\.asset_after\]/);
 assert.doesNotMatch(src,/data-transition-from|blend!\.progress/);
 assert.match(src,/top: transform\.y \?\? 0/);
 assert.doesNotMatch(src,/idleY|idleScale/);
});
