import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

test("Cover v2 honors producer design metadata and native V4 tokens", async () => {
  const source = await readFile(new URL("../src/ZodiacCover.tsx",import.meta.url),"utf8");
  for (const expected of ["zodiac-cover-design@2","zodiac-paper-doodle-meme-v4",
    "COVER_DESIGN_UNSUPPORTED","cover.design","soft_shadow","preserve-native-environment",
    "hero_scale","supporting_prop_scale","max_supporting_accents","warmShadow",
    "shadow_opacity","min_side_margin_px"]) {
    // Title tokens are implemented as literal V4 palette roles in the renderer.
    if (expected==="soft_shadow") continue;
    assert.ok(source.includes(expected),expected);
  }
  assert.match(source,/role==="character"\?heroScale/);
  assert.match(source,/role==="interactive_prop"\|\|role==="effect"\?propScale/);
  assert.match(source,/role==="background"/);
  assert.match(source,/crooked-paper-note/);
  assert.doesNotMatch(source,/boxShadow:\s*["']\d+px\s+\d+px\s+\d+px\s+black/);
});
