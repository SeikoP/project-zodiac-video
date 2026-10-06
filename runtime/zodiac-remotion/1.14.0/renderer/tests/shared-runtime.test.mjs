import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=(p)=>readFile(new URL(p,import.meta.url),"utf8");
test("job data is props, not renderer-relative imports",async()=>{const a=await read("../src/Root.tsx"),b=await read("../src/ZodiacComposition.tsx"),c=await read("../src/ZodiacCover.tsx");assert.doesNotMatch(a,/\.\.\/\.\.\/production\.json/);assert.doesNotMatch(b,/\.\.\/\.\.\/production\.json/);assert.doesNotMatch(c,/production\.json|publish\/publish\.json/);assert.match(a,/RenderProps/);assert.match(b,/props\.production/);});
test("runtime uses fixed Vietnamese overlay and job public dir",async()=>{const a=await read("../src/ZodiacComposition.tsx"),b=await read("../scripts/render.mjs");assert.match(a,/patrick-hand\/vietnamese-400/);assert.match(a,/captionOverlayTop/);assert.match(a,/\.runtime\/sfx/);assert.match(b,/ZODIAC_PACKAGE_ROOT/);assert.match(b,/--public-dir=/);assert.match(b,/--studio/);});
