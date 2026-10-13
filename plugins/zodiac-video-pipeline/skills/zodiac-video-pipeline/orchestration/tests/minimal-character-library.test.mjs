import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCharacterSvg} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {buildCurrentAssetReview} from '../../features/asset-selection/build-current-asset-review.mjs';
const json=async rel=>JSON.parse(await readFile(new URL('../../references/asset-library-v4/'+rel,import.meta.url)));
test('current selection surface excludes face accessories and effects',async()=>{
 const r=await buildCurrentAssetReview();
 assert.ok(r.receipt.items.every(x=>!['face','accessory','effect'].includes(x.group)));
});
test('plain shirt keeps colored torso and expressive face without printed decoration',()=>{
 const out=compileCharacterSvg({entity_id:'lead',body_profile:'standard_compact',hair_id:'asym-bang',outfit_id:'plain-shirt',shirt_color_id:'coral'},{pose_id:'explain',expression_id:'smug'});
 assert.ok(out.svg.includes('id="face_eyes"'));
 assert.ok(out.svg.includes('id="face_mouth"'));
 assert.ok(out.svg.includes('shirt_color_id=coral'));
 assert.equal(out.svg.includes('outfit_decoration'),false);
 assert.equal(out.svg.includes('id="accessory_'),false);
});
test('removed face accessory and effect choices are not quietly accepted',async()=>{
 const {selectAssetGuidance}=await import('../../core/policy/select-asset-guidance.mjs');const policy=await json('selection-policy.json');
 for(const id of ['freckled','round-glasses','question-pop'])assert.throws(()=>selectAssetGuidance({selected_asset_ids:[id]},policy),/ASSET_RETIRED/);
 const catalog=await json('characters/components/catalog.json');assert.equal(catalog.face_profiles.length,1);assert.equal(catalog.accessories.length,0);assert.deepEqual(catalog.outfits.map(r=>r.id),['plain-shirt','zodiac-glyph-shirt']);
});
