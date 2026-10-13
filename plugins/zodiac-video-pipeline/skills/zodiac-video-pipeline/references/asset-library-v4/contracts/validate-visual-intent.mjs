import {readFile} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const fail=m=>{throw Error('VISUAL_INTENT_INVALID: '+m)};
const [x,catalog]=await Promise.all([read('visual-intent-contract.json'),read('../characters/components/catalog.json')]);
if(x.version!=='2.0-current-native')fail('current native version');
if(x.runtime_recipe_ids!==false)fail('runtime recipes must remain disabled');
if(x.precedence?.conflict_rule!=='visual_intent_wins_for_side_direction_locus_facial_origin')fail('precedence');
for(const [axis,required]of Object.entries({side:['left','right','center'],direction:['left','right','up','down'],z_order:['behind_character','character_plane','above_prop'],locus:['face','head','torso','contact_region']})){
 const values=x.semantic_axes?.[axis];if(!Array.isArray(values)||new Set(values).size!==values.length||required.some(id=>!values.includes(id)))fail('semantic axis '+axis);
}
for(const id of ['left_eye','right_eye','face_core','body_rear','reveal_right','trail_right']){const a=x.derived_semantic_anchors?.[id];if(!a?.source?.trim()||!a?.method?.trim())fail('derived anchor '+id);}
const actual=x.compatibility_matrix?.assets,expected=catalog.hair.map(h=>h.id);
if(!Array.isArray(actual)||new Set(actual).size!==actual.length||actual.length!==expected.length||expected.some(id=>!actual.includes(id)))fail('current hair catalog compatibility');
if(catalog.face_profiles?.length!==1||catalog.face_profiles[0].id!=='balanced'||catalog.outfits?.length!==2||!catalog.outfits.some(o=>o.id==='plain-shirt')||!catalog.outfits.some(o=>o.id==='zodiac-glyph-shirt')||catalog.accessories?.length!==0)fail('current fixed face/intrinsic glyph shirt/no accessory policy');
console.log('VISUAL_INTENT_PASS: current_native=true hair='+actual.length+' runtime_recipes=false fixed_face=true intrinsic_glyph_shirt=true');
