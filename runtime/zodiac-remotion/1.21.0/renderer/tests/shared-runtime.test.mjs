import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(p,import.meta.url),"utf8");
test("shared renderer consumes job data through props",async()=>{const a=await read("../src/Root.tsx"),b=await read("../src/ZodiacComposition.tsx"),c=await read("../src/ZodiacCover.tsx");assert.doesNotMatch(a,/\.\.\/\.\.\/production\.json/);assert.doesNotMatch(b,/\.\.\/\.\.\/production\.json/);assert.doesNotMatch(c,/production\.json|publish\/publish\.json/);assert.match(a,/RenderProps/);assert.match(b,/props\.production/);});
test("runtime uses Vietnamese overlay and explicit public dir",async()=>{const a=await read("../src/ZodiacComposition.tsx"),b=await read("../scripts/render.mjs");assert.match(a,/patrick-hand\/vietnamese-400/);assert.match(a,/captionOverlayTop/);assert.match(a,/\.runtime\/sfx/);assert.match(b,/ZODIAC_PACKAGE_ROOT/);assert.match(b,/--public-dir=/);assert.match(b,/--studio/);assert.ok(b.indexOf("const cli=")<b.indexOf('process.argv.includes("--studio")'));});
test("schema and render path enforce semantic contracts",async()=>{const schema=JSON.parse(await read("../schemas/production.schema.json"));const render=await read("../scripts/render.mjs");const types=await read("../src/types.ts");assert.ok(schema.$defs.mechanism);assert.ok(schema.$defs.lineage);assert.match(render,/validateSemanticAnimation/);assert.match(types,/EventMechanism/);assert.match(types,/AssetLineage/);});

test("runtime 1.21 keeps visible pose swaps with active-state caption collision",async()=>{const schema=JSON.parse(await read("../schemas/production.schema.json"));const render=await read("../scripts/render.mjs");const composition=await read("../src/ZodiacComposition.tsx");assert.ok(schema.$defs.performance);assert.ok(!schema.$defs.event.required.includes("performance"));assert.ok(!schema.$defs.event.required.includes("motion"));assert.equal(schema.$defs.scene.properties.captions.properties.segmentation.const,"semantic");assert.match(render,/materializeProductionDefaults/);assert.match(render,/validatePerformanceAnimation/);assert.match(render,/validatePerformanceTiming/);assert.match(composition,/poseTransitionChoreographyValues/);assert.match(composition,/choreography\.pose === "after"/);assert.match(composition,/choreography=\{choreography\}/);assert.match(composition,/transitionProgress/);assert.match(composition,/activeSceneRects/);assert.doesNotMatch(composition,/Object\.values\(entity\.states\)/);assert.doesNotMatch(composition,/state=\{beforeState\} key=\{transition\.before\}/);assert.doesNotMatch(composition,/state=\{afterState\} key=\{transition\.after\}/);assert.doesNotMatch(composition,/targetWords:/);assert.doesNotMatch(composition,/maxWords:/);});

test("runtime 1.21 enforces deterministic scene layer safety",async()=>{const render=await read("../scripts/render.mjs");const composition=await read("../src/ZodiacComposition.tsx");assert.match(render,/validateSceneLayerSafety/);assert.match(composition,/effectiveZIndex/);assert.match(composition,/entityIndex/);});


test("runtime 1.21 schema accepts visual-grammar v4 lineage and caption font metadata",async()=>{
  const schema=JSON.parse(await read("../schemas/production.schema.json"));
  const types=await read("../src/types.ts");
  const caption=schema.properties.caption_style.properties;
  assert.ok(caption.font_stack);
  assert.ok(caption.css_font_family);
  assert.deepEqual(
    schema.$defs.lineage.properties.source_library.enum,
    ["zodiac-paper-doodle-asset-library-v3","zodiac-visual-grammar-v4"],
  );
  assert.match(types,/zodiac-visual-grammar-v4/);
  assert.match(types,/font_stack\?: string\[\]/);
  assert.match(types,/css_font_family\?: string/);
  const composition=await read("../src/ZodiacComposition.tsx");
  assert.match(composition,/style\.css_font_family \?\? style\.font_family/);
});


test("runtime 1.21 style token is native v4 and rejects direct v3 copying", async () => {
  const style = await read("../scripts/style-token.mjs");
  assert.match(style, /zodiac-paper-doodle-meme-v4/);
  assert.match(style, /CANONICAL_STYLE_VERSION = "4\.0"/);
  assert.match(style, /CANONICAL_HANDMADE_PROFILE = "human-stroke-v2"/);
  assert.match(style, /legacy_v3_direct_copy !== false/);
  assert.doesNotMatch(style, /hair_silhouette_catalog/);
  assert.doesNotMatch(style, /required_visual_cues/);
});
