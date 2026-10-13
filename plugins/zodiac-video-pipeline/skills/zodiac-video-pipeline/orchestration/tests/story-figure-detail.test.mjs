import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateHumanStroke} from '../../references/asset-library-v4/validation/validate-human-stroke.mjs';
import {buildCurrentAssetReview} from '../../features/asset-selection/build-current-asset-review.mjs';
test('balance figure has intrinsic emphasis in each narrative state and preserves channel token',async()=>{
 for(const state of ['balanced','tilt_left','tilt_right']){
  const raw=await readFile(new URL('../../references/asset-library-v4/visual-metaphors/balance-scale/'+state+'.svg',import.meta.url),'utf8');
  assert.ok(raw.includes('id="balance_pivot"'));
  assert.ok(raw.includes('id="balance_base"'));
  assert.ok(raw.includes('id="pan_material"'));
  assert.equal(raw.includes('asset_role=meme-effect'),false);
  assert.ok(validateHumanStroke(raw,'focal').curves>=4);
 }
});
test('native catalog names this a story figure and provides enough space for state comparisons',async()=>{
 const r=await buildCurrentAssetReview({selected_ids:['balance-scale']});
 assert.ok(r.html.includes('Hình tượng kể chuyện'));
 assert.equal(r.html.includes('>Biểu tượng</option>'),false);
 assert.ok(r.html.includes('.card[data-group="story_object"]'));
});
