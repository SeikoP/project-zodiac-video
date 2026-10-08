import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const source = () => readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url), "utf8");

test("unfocused actors and props stay at explicitly authored coordinates", async () => {
  const src = await source();
  assert.match(src, /left: transform\.x \?\? 0/);
  assert.match(src, /top: transform\.y \?\? 0/);
  assert.doesNotMatch(src, /idleY|idleScale/);
});
test("event target and its explicit held-by or emitted-by actor drive focus", async () => {
  const src = await source();
  assert.match(src, /item\.anchor === entity\.id/);
  assert.match(src, /item\.relation === "held_by"/);
  assert.match(src, /item\.relation === "emitted_by"/);
  assert.match(src, /focusTargets\.has\(item\.target\)/);
  assert.match(src, /frame >= item\.start_frame && frame < item\.end_frame/);
});
test("small event-bounded motion cannot move authored coordinates", async () => {
  const src = await source();
  assert.match(src, /focusEnvelope = active \? Math\.sin\(Math\.PI \* phase\) \*\* 2 : 0/);
  assert.match(src, /1 \+ 0\.012 \* focusEnvelope/);
  assert.match(src, /1\.3 \* focusEnvelope/);
  assert.match(src, /data-narrative-focus/);
  assert.match(src, /transformOrigin: "center center"/);
});
