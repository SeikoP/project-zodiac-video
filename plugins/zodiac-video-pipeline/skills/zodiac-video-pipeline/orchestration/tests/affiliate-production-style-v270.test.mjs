import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../../references/asset-library-v4/validation/validate-production-style.mjs',import.meta.url),'utf8').catch(()=> '');

test('production style validator recognizes provenance-bound commerce SVG transport before human-stroke checks',()=>{
  assert.match(src,/validateCommerceProductTransport/);
  assert.match(src,/a\.commerce\?\.format===['"]zodiac-product-media-ref@1['"]/);
  assert.match(src,/continue;/);
});
