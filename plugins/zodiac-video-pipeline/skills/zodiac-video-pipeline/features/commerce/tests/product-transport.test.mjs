import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateCommerceProductTransport} from '../validate-product-transport.mjs';

const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQx8AAAAASUVORK5CYII=';
const png=Buffer.from(pngBase64,'base64');
const sourceSha=createHash('sha256').update(png).digest('hex');
const asset={path:'assets/product/123-hero.svg',category:'story_object',commerce:{format:'zodiac-product-media-ref@1',provider:'kalodata',product_id:'123',role:'hero',transport:'svg_raster_embed',source_mime:'image/png',source_width:1,source_height:1,source_sha256:sourceSha}};
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><image width="1" height="1" href="data:image/png;base64,'+pngBase64+'" preserveAspectRatio="xMidYMid meet"/></svg>';

test('accepts only provenance-bound local Kalodata SVG raster transport',()=>{
  assert.equal(validateCommerceProductTransport(asset,svg).status,'PASS');
  assert.throws(()=>validateCommerceProductTransport({...asset,path:'assets/other.svg'},svg),/COMMERCE_ASSET_PATH/);
  assert.throws(()=>validateCommerceProductTransport({...asset,commerce:{...asset.commerce,provider:'other'}},svg),/COMMERCE_PROVIDER/);
  assert.throws(()=>validateCommerceProductTransport(asset,svg.replace('<image','<script/><image')),/COMMERCE_SVG_UNSAFE/);
  assert.throws(()=>validateCommerceProductTransport(asset,svg.replace('data:image/png','https://remote.example')),/COMMERCE_EMBED_REQUIRED/);
});

test('embedded raster bytes must match provenance hash and dimensions',()=>{
  assert.throws(()=>validateCommerceProductTransport({...asset,commerce:{...asset.commerce,source_sha256:'b'.repeat(64)}},svg),/COMMERCE_SOURCE_HASH_MISMATCH/);
  assert.throws(()=>validateCommerceProductTransport({...asset,commerce:{...asset.commerce,source_width:2}},svg),/COMMERCE_SOURCE_DIMENSIONS_MISMATCH/);
});
