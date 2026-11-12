import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateHumanStroke} from '../../references/asset-library-v4/validation/validate-human-stroke.mjs';
import {buildCurrentAssetReview} from '../../features/asset-selection/build-current-asset-review.mjs';

test('compatibility balance figure preserves detailed narrative states and channel token',async()=>{
 for(const state of ['balanced','tilt_left','tilt_right']){
  const raw=await readFile(new URL('../../references/asset-library-v4/visual-metaphors/balance-scale/'+state+'.svg',import.meta.url),'utf8');
  assert.ok(raw.includes('id="balance_pivot"'));
  assert.ok(raw.includes('id="balance_base"'));
  assert.ok(raw.includes('id="pan_material"'));
  assert.equal(raw.includes('asset_role=meme-effect'),false);
  assert.ok(validateHumanStroke(raw,'focal').curves>=4);
 }
});

test('compatibility balance figure is not selectable from the fresh asset surface',async()=>{
 await assert.rejects(()=>buildCurrentAssetReview({selected_ids:['balance-scale']}),/ASSET_PREVIEW_UNSUPPORTED balance-scale/);
 const review=await buildCurrentAssetReview();
 assert.equal(review.receipt.items.some(item=>item.id==='balance-scale'),false);
 assert.equal(review.html.includes('Hình tượng kể chuyện'),false);
 assert.ok(review.html.includes('Narrative Visual · Hình ảnh kể chuyện'));
});
