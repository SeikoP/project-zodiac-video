import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source = () => readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url), "utf8");

test("authored positions remain fixed",async()=>{
  const src=await source();
  assert.match(src,/left: transform\.x \?\? 0/);
  assert.match(src,/top: transform\.y \?\? 0/);
  assert.doesNotMatch(src,/idleY|idleScale/);
});
test("only event-scoped authored entities are animated",async()=>{
  const src=await source();
  assert.match(src,/item\.anchor === entity\.id/);
  assert.match(src,/item\.relation === "held_by"/);
  assert.match(src,/item\.relation === "emitted_by"/);
  assert.match(src,/activeEvent/);
  assert.match(src,/role === "character"/);
  assert.match(src,/semanticMotionAtFrame\(active, frame/);
});
test("effects/props do not inherit unowned narrator gestures",async()=>{
 const src=await source();
 assert.match(src,/Effects and props react only to their own event/);
 assert.match(src,/active = role === "character"/);
});
