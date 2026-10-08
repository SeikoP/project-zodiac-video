import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = async (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("renderer 2 composition consumes resolved frame ranges directly", async () => {
  const source = await read("../src/ZodiacRenderPlan.tsx");
  assert.match(source, /event\.start_frame/);
  assert.match(source, /event\.end_frame\s*-\s*event\.start_frame/);
  for (const forbidden of [
    "voice_anchor",
    "max_drift_frames",
    "merge_policy",
    "materializeProductionDefaults",
    "resolveProductionEvents",
    "validatePerformanceTiming",
    "scheduleTarget",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("renderer 2 root registers only executable-plan composition", async () => {
  const source = await read("../src/Root.tsx");
  assert.match(source, /id="ZodiacRenderPlan"/);
  assert.doesNotMatch(source, /production\.ir/);
  assert.doesNotMatch(source, /design\.md/);
});

test("renderer 2 types require resolved asset ids", async () => {
  const source = await read("../src/types.ts");
  assert.match(source, /asset_before:\s*string/);
  assert.match(source, /asset_after:\s*string/);
});
