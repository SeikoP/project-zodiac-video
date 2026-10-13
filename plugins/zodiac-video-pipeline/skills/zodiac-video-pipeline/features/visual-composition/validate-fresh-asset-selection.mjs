import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zodiacGlyphPaths} from '../../references/asset-library-v4/characters/geometry/outfit-profiles.mjs';
const policyPath=new URL('../../references/asset-library-v4/selection-policy.json',import.meta.url);
const fail=(code,id)=>{throw Error('FRESH_ASSET_SELECTION_BLOCKED '+code+' '+id);};
export function validateFreshAssetSelection({intent,production,policy}){
 const retired=new Set(policy.retired_asset_ids??[]),hair=new Set(policy.retired_hair_ids??[]);
 const sets=new Set((policy.extensions??[]).filter(x=>x.kind==='scene_set').flatMap(x=>x.ids));
 for(const scene of intent?.scenes??[]){
  const env=scene.grammar?.environment??scene.environment??{};
  if(env.profile||scene.environment?.profile)fail('PROFILE_COMPATIBILITY',scene.id);
  // Fresh compositions are canvas-first. Legacy scene-set remains an optional compatibility reference.
  if(env.scene_set_id)fail('FRESH_SCENE_SET_RETIRED',scene.id);
  if(scene.art_direction?.environment_profile)fail('STALE_ART_DIRECTION_PROFILE',scene.id);
  for(const a of env.scene_accents??[])if(retired.has(a.id))fail('RETIRED_ACCENT',a.id);
 }
 for(const c of intent?.cast??[])if(hair.has(c.hair_id))fail('RETIRED_HAIR',c.entity_id);
 for(const [id,a] of [...Object.entries(production?.assets??{}),...Object.entries(intent?.assets??{})]){
  if(hair.has(a.character_blueprint?.hair_id))fail('RETIRED_HAIR',id);
  const bp=a.character_blueprint;if(bp&&(!['plain-shirt','zodiac-glyph-shirt'].includes(bp.outfit_id)||(bp.face_profile_id??'balanced')!=='balanced'||(bp.accessory_id??'none')!=='none'))fail('REMOVED_CHARACTER_FEATURE',id);
  if(bp?.outfit_id==='zodiac-glyph-shirt'&&!Object.hasOwn(zodiacGlyphPaths,bp.zodiac_sign_id))fail('ZODIAC_SIGN_INVALID',id);
  // Effects are optional emphasis, not mandatory and not forbidden for fresh work.
  const masters=[a.lineage?.source_master].flat(),p=String(a.path??'');
  if(retired.has(id)||masters.some(m=>retired.has(m))||/(?:^|\/)environments\/structural\//u.test(p)||/(?:^|\/)assets\/environment\/(?:bedroom-|cafe-window|cafe-table)/u.test(p))fail('RETIRED_SOURCE',id);
 }
 return {status:'PASS',checked_scenes:intent?.scenes?.length??0};
}
export async function validateFreshAssetWorkspace(root){
 const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json')));
 if(state.run_mode!=='fresh')return {status:'COMPATIBILITY_UNCHANGED'};
 const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'))),policy=JSON.parse(await readFile(policyPath));
 const production=await readFile(path.join(root,'production.json')).then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 const result=validateFreshAssetSelection({intent,production,policy});
 for(const [id,a] of [...Object.entries(production?.assets??{}),...Object.entries(intent.assets??{})]){
  if(!a.path?.endsWith('.svg'))continue;
  const abs=path.resolve(root,a.path);if(!abs.startsWith(path.resolve(root)+path.sep))fail('ASSET_PATH_UNSAFE',id);
  let raw;try{raw=await readFile(abs,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(raw.includes('outfit_decoration')||/<g[^>]*id=["']accessory_/u.test(raw))fail('REMOVED_CHARACTER_FEATURE',id);
  const hair=raw.match(/hair_id=([^;<\s]+)/u)?.[1];if(policy.retired_hair_ids.includes(hair))fail('RETIRED_HAIR',id);
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))validateFreshAssetWorkspace(path.resolve(process.argv[2]??'.')).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1;});
