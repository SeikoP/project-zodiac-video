import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("renderer 2.0.2 resolves effect visibility at enter/release boundaries",async()=>{
 const s=await readFile(new URL("../src/ZodiacRenderPlan.tsx",import.meta.url),"utf8");
 assert.match(s,/const entering = before\?\.visible === false/);
 assert.match(s,/frame >= event\.start_frame/);
 assert.match(s,/stateId = entering/);
 assert.match(s,/semanticMotionAtFrame\(active, frame/);
 assert.doesNotMatch(s,/blend!\.progress/);
 assert.match(s,/left: transform\.x \?\? 0/);
 assert.match(s,/top: transform\.y \?\? 0/);
});
