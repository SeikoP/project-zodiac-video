import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {resolveEntityState} from "../src/spatial-layout.mjs";

const read = async (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("renderer 2 composition consumes resolved frame ranges directly", async () => {
  const source = await read("../src/ZodiacRenderPlan.tsx") + await read("../src/spatial-layout.mjs") + await read("../src/semantic-motion.mjs");
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


test("renderer 2 draws the resolved asset_after directly", async () => {
  const source = await read("../src/ZodiacRenderPlan.tsx") + await read("../src/spatial-layout.mjs") + await read("../src/semantic-motion.mjs");
  assert.match(source, /<Img/);
  const entity = {id:"actor",initial_state:"before",states:{before:{asset:"before-asset"},after:{asset:"after-asset"}}};
  const scene = {events:[{target:"actor",end_frame:12,state_after:"after"}]};
  assert.equal(resolveEntityState(scene,entity,11).asset,"before-asset");
  assert.equal(resolveEntityState(scene,entity,12).asset,"after-asset");
});


test("renderer 2 persists entity state and renders executable presentation layers", async () => {
  const source = await read("../src/ZodiacRenderPlan.tsx") + await read("../src/spatial-layout.mjs") + await read("../src/semantic-motion.mjs");
  assert.match(source, /useCurrentFrame/);
  assert.match(source, /scene\.entities/);
  assert.match(source, /initial_state/);
  assert.match(source, /state_after/);
  assert.match(source, /transform/);
  assert.match(source, /scene\.captions/);
  assert.match(source, /presentation\.watermark/);
  assert.match(source, /presentation\.caption/);
  assert.doesNotMatch(source, /voice_anchor/);
  assert.doesNotMatch(source, /max_drift_frames/);
});

test("renderer 2 does not make event visibility end when an event interval ends", async () => {
  const source = await read("../src/ZodiacRenderPlan.tsx") + await read("../src/spatial-layout.mjs") + await read("../src/semantic-motion.mjs");
  assert.doesNotMatch(source, /durationInFrames=\{event\.end_frame\s*-\s*event\.start_frame\}/);
  assert.match(source, /frame\s*>=\s*event\.end_frame/);
});
