import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const source = () => readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url), "utf8");
test("authored positions stay fixed during narrative focus", async () => {
  const src = await source();
  assert.match(src, /left: transform\.x \?\? 0/);
  assert.match(src, /top: transform\.y \?\? 0/);
  assert.doesNotMatch(src, /idleY|idleScale/);
});
test("focus requires explicit event targets or semantic anchors", async () => {
  const src = await source();
  assert.match(src, /item\.anchor === entity\.id/);
  assert.match(src, /item\.relation === "held_by"/);
  assert.match(src, /item\.relation === "emitted_by"/);
  assert.match(src, /focusTargets\.has\(item\.target\)/);
});
test("focus pulse returns to zero and leaves coordinates unchanged", async () => {
  const src = await source();
  assert.match(src, /focusEnvelope = active \? Math\.sin\(Math\.PI \* phase\) \*\* 2 : 0/);
  assert.match(src, /1 \+ 0\.012 \* focusEnvelope/);
  assert.match(src, /1\.3 \* focusEnvelope/);
  assert.match(src, /data-narrative-focus/);
});
