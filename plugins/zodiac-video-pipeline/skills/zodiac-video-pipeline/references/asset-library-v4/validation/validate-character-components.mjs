#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const fail=m=>{throw new Error('CHARACTER_COMPONENTS_INVALID: '+m);};
export async function validateCharacterComponents(){
 const c=JSON.parse(await readFile(path.join(root,'characters/components/catalog.json'),'utf8'));
 if(c.format!=='zodiac-character-components@1')fail('format');if(c.style_token!=='zodiac-paper-doodle-meme-v4'||c.handmade_profile!=='human-stroke-v2')fail('style/profile');
 if(c.policy?.render_time_randomness!==false||c.policy?.runtime_output!=='one_baked_svg_per_planned_identity_state_asset'||c.policy?.default_unique_state_asset_budget_per_character!==null||c.policy?.state_budget_basis!=='authored performed actions before SVG compilation'||c.policy?.svg_content_dedupe!==false||c.policy?.body_variation!=='authored_geometry_not_scale_transform')fail('compile/runtime policy');
 if((c.policy?.identity_fields??[]).join('|')!=='body_profile|hair_id|face_profile_id|outfit_id|shirt_color_id|accessory_id')fail('identity fields');if((c.policy?.state_fields??[]).join('|')!=='pose_id|expression_id|crop_id')fail('state fields');
 const uniq=(rows,label)=>{const s=new Set();for(const x of rows??[]){if(!x.id||s.has(x.id))fail(`${label} duplicate/missing id ${x.id}`);s.add(x.id);}return s;};
 const bodies=uniq(c.body_profiles,'body'),hair=uniq(c.hair,'hair'),outfits=uniq(c.outfits,'outfit'),expressions=uniq(c.expressions,'expression'),poses=uniq(c.poses,'pose'),faces=uniq(c.face_profiles,'face profile'),accessories=uniq(c.accessories,'accessory');
 if(bodies.size<6)fail('need >=6 body profiles');if(hair.size<1)fail('need current hair components');if(expressions.size<6)fail('need >=6 expressions');if(poses.size<8)fail('need >=8 poses');if(faces.size<4)fail('need >=4 stable face profiles');if(accessories.size<2)fail('need >=2 identity accessories');
 const zodiac=(c.outfits??[]).filter(x=>x.kind==='zodiac'),generic=(c.outfits??[]).filter(x=>x.kind==='generic');if(zodiac.length!==12)fail('need exactly 12 zodiac outfits');if(generic.length<5)fail('need >=5 generic outfits');
 for(const b of c.body_profiles)if(!b.source_master||!b.silhouette_family)fail('body '+b.id+' missing source/silhouette');
 for(const f of c.face_profiles)if(!Number.isFinite(f.eye_scale_x)||!Number.isFinite(f.eye_scale_y)||!['none','freckles','brow_mark','beauty_mark','rosy_cheeks'].includes(f.mark_style))fail('face profile '+f.id+' has incomplete identity geometry');
 return {bodies:bodies.size,hair:hair.size,outfits:outfits.size,expressions:expressions.size,poses:poses.size,faces:faces.size,accessories:accessories.size};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(direct){const r=await validateCharacterComponents();console.log(`CHARACTER_COMPONENTS_PASS: bodies=${r.bodies} hair=${r.hair} faces=${r.faces} accessories=${r.accessories} outfits=${r.outfits} expressions=${r.expressions} poses=${r.poses}`);}