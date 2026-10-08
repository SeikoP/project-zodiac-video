import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

// Source-level regression: the real visual proof remains Remotion event-frame review.
test("state transition blends bounded frames without introducing extra authored assets", async () => {
  const src = await readFile(new URL("../src/ZodiacRenderPlan.tsx", import.meta.url), "utf8");
  assert.match(src, /Math\.min\(5, Math\.max\(1, event\.end_frame - event\.start_frame\)\)/);
  assert.match(src, /data-transition-from/);
  assert.match(src, /style=\{\{\.\.\.style, opacity: \(1 - blend!\.progress\) \* revealOpacity\}\}/);
  assert.match(src, /state = entity\.states\[stateId\]/);
  assert.doesNotMatch(src, /transitionDuration > 0\s*&& resolvedAfterAsset/);
});
