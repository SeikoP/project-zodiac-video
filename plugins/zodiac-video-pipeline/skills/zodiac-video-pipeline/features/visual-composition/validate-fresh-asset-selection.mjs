import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const policyPath=new URL('../../references/asset-library-v4/selection-policy.json',import.meta.url);
const fail=(code,id)=>{throw Error('FRESH_ASSET_SELECTION_BLOCKED '+code+' '+id)};
export function validateFreshAssetSelection({intent,production,policy}){
 const retired=new Set([...(policy.compatibility_ids??[]),...(policy.retired_fresh_asset_ids??[])]),sets=new Set(['scene-set-home','scene-set-cafe','scene-set-classroom','scene-set-study','scene-set-street','scene-set-neutral']);
 for(const scene of intent?.scenes??[]){
  const env=scene.grammar?.environment??{};
  if(env.profile||scene.environment?.profile)fail('PROFILE_COMPATIBILITY',scene.id);
  if(!sets.has(env.scene_set_id))fail('SCENE_SET_REQUIRED',scene.id);
  if(scene.art_direction?.environment_profile)fail('STALE_ART_DIRECTION_PROFILE',scene.id);
  for(const a of env.scene_accents??[])if(retired.has(a.id))fail('RETIRED_ACCENT',a.id);
 }
 for(const [id,a]of Object.entries({...production?.assets,...intent?.assets})){
  const master=a.lineage?.source_master,p=String(a.path??'');
  if(retired.has(id)||retired.has(master)||/(?:^|\/)environments\/structural\//u.test(p)||/(?:^|\/)assets\/environment\/(?:bedroom-|cafe-window|cafe-table)/u.test(p))fail('RETIRED_SOURCE',id);
 }
 for(const c of intent?.cast??[]){if(c.hair_id==='lopsided-bob')fail('COMPATIBILITY_HAIR_NOT_ALLOWED',c.entity_id);}\n return {status:'PASS',checked_scenes:intent?.scenes?.length??0};
}
export async function validateFreshAssetWorkspace(root){const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json')));if(state.run_mode!=='fresh')return {status:'COMPATIBILITY_UNCHANGED'};const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'))),policy=JSON.parse(await readFile(policyPath));const production=await readFile(path.join(root,'production.json')).then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e});return validateFreshAssetSelection({intent,production,policy})}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))validateFreshAssetWorkspace(path.resolve(process.argv[2]??'.')).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
