import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("state transition renders only one complete SVG at a time", async () => {
  const src = await readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url), "utf8");
  assert.match(src, /state = entity\.states\[stateId\]/);
  assert.match(src, /data-entity-id=\{entity\.id\}/);
  assert.doesNotMatch(src, /data-transition-from/);
  assert.doesNotMatch(src, /blend!\.progress/);
  assert.match(src, /const structural = entity\.id\.startsWith\("env__"\)/);
  assert.match(src, /const idleY = character/);
  assert.match(src, /const effectPulse = role === "effect"/);
});
