import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {prepareRendererProps, validateExecutablePlan} from "../scripts/prepare.mjs";

const minimalPlan = () => ({
  format: "zodiac-render-plan@1",
  fps: 24,
  video: {width: 1080, height: 1920},
  assets: {},
  scenes: [
    {
      id: "S01",
      start_frame: 0,
      duration_frames: 48,
      events: [
        {
          event_id: "E01",
          scene_id: "S01",
          target: "scorpio",
          start_frame: 8,
          end_frame: 16,
          state_before: "guarded",
          state_after: "open",
          motion: "reaction_pop",
        },
      ],
    },
  ],
});

test("prepare preserves resolved frame ranges exactly", async () => {
  const root = await mkdtemp(join(tmpdir(), "zodiac-renderer-v2-"));
  await mkdir(join(root, ".runtime"), {recursive: true});
  const plan = minimalPlan();
  await writeFile(join(root, ".runtime", "render-plan.json"), JSON.stringify(plan), "utf8");
  const {output} = await prepareRendererProps(root);
  const props = JSON.parse(await readFile(output, "utf8"));
  assert.equal(props.scenes[0].events[0].start_frame, 8);
  assert.equal(props.scenes[0].events[0].end_frame, 16);
});

test("invalid executable frame range is rejected", () => {
  const plan = minimalPlan();
  plan.scenes[0].events[0].end_frame = 8;
  assert.throws(() => validateExecutablePlan(plan), /invalid resolved frame range/);
});

test("renderer prepare source has no semantic scheduling hooks", async () => {
  const source = await readFile(new URL("../scripts/prepare.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    "materializeProductionDefaults",
    "resolveProductionEvents",
    "validatePerformanceTiming",
    "voice_anchor",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
