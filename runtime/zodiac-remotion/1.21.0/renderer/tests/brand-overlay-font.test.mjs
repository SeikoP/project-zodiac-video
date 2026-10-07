import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const renderer=path.resolve(here,"..");
const read=(rel)=>readFile(path.join(renderer,rel),"utf8");

test("Patrick Hand Vietnamese is bundled locally for captions and watermark",async()=>{
  const pkg=JSON.parse(await read("package.json"));
  const composition=await read("src/ZodiacComposition.tsx");
  const overlay=await read("src/BrandOverlay.tsx");
  assert.equal(pkg.dependencies["@fontsource/patrick-hand"],"5.3.0");
  assert.match(composition,/@fontsource\/patrick-hand\/vietnamese-400\.css/);
  assert.match(overlay,/@fontsource\/patrick-hand\/vietnamese-400\.css/);
});

test("runtime brand overlay is wired and keeps the demo font stack",async()=>{
  const root=await read("src/Root.tsx");
  const overlay=await read("src/BrandOverlay.tsx");
  assert.match(root,/BrandOverlay/);
  assert.match(root,/<BrandOverlay production=\{props\.production\}\/>/);
  assert.match(overlay,/"Patrick Hand", "Segoe Print", cursive/);
  assert.match(overlay,/overlay\.css_font_family/);
  assert.match(overlay,/zIndex:overlay\.layer/);
  assert.match(overlay,/symbol_scale/);
});
