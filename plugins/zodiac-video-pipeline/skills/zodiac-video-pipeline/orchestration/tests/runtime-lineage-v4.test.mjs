import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'../..');

test('runtime projection preserves explicit v4 source-library provenance instead of rewriting it to v3',async()=>{const src=await readFile(path.join(skill,'compat/production-v1/compile-runtime-production.mjs'),'utf8');assert.match(src,/source_library:\s*old\.source_library\s*,/);});
test('runtime and handoff accept only V4-owned asset provenance',async()=>{const runtime=await readFile(path.join(skill,'compat/production-v1/compile-runtime-production.mjs'),'utf8'),handoff=await readFile(path.join(skill,'compat/production-v1/validate-handoff-workspace.mjs'),'utf8');for(const src of [runtime,handoff]){assert.match(src,/allowedSourceLibraries=new Set\(\['zodiac-visual-grammar-v4'\]\)/);assert.doesNotMatch(src,/allowedSourceLibraries=new Set\(\[[^\]]*asset-library-v3/);}});
