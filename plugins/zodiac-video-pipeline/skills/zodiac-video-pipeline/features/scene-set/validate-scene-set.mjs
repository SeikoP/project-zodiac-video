#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const registry=JSON.parse(await readFile(new URL('../../references/asset-library-v4/scene-set/index.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error('SCENE_SET_QC_BLOCKED '+s)};
const validRect=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;

export async function validateSceneSetWorkspace(root){
 const production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
 let checked=0;const palettes=new Set(),sets=new Set(),compiledHashes=new Set();
 for(const scene of production.scenes??[]){
  const env=scene.environment??{};if(env.mode==='archive_frame')continue;
  const id=env.scene_set_id??env.scene_set?.id;if(!id)continue;
  const master=registry.scene_sets.find(x=>x.id===id);if(!master)fail(scene.id+' unknown scene-set '+id);
  const set=env.scene_set;if(!set||set.format!=='zodiac-scene-set@1'||set.id!==id)fail(scene.id+' scene-set metadata');
  if(!set.entity_id||!set.asset||set.asset!==set.asset_id&&set.asset_id!==undefined)fail(scene.id+' scene-set asset identity');
  const entity=(scene.entities??[]).find(e=>e.id===set.entity_id);if(!entity)fail(scene.id+' scene-set entity missing');
  const st=entity.states?.[entity.initial_state];if(!st||st.visible!==true||st.asset!==set.asset)fail(scene.id+' scene-set state missing');
  if(st.layer!==master.layer||!isDeepStrictEqual(st.transform,master.transform)||!isDeepStrictEqual(set.transform,master.transform))fail(scene.id+' scene-set transform/layer drift');
  if(!isDeepStrictEqual(set.view_box,master.view_box))fail(scene.id+' scene-set viewBox drift');
  if(!validRect(set.wall_region)||set.wall_region.x<0||set.wall_region.y<0||set.wall_region.x+set.wall_region.width>1080||set.wall_region.y+set.wall_region.height>1920)fail(scene.id+' wall region invalid');
  const asset=production.assets?.[set.asset];if(!asset||asset.category!=='environment'||!asset.path)fail(scene.id+' scene-set asset registry');
  const lineage=asset.lineage??{};if(lineage.source_master!==id||lineage.source_sha256!==master.asset_sha256)fail(scene.id+' source lineage drift');
  if(lineage.background_palette_id!==env.background_palette_id||set.background_palette_id!==env.background_palette_id)fail(scene.id+' palette lineage drift');
  const bytes=await readFile(path.join(root,asset.path)),actual=sha(bytes);
  if(actual!==lineage.compiled_sha256||actual!==set.asset_sha256)fail(scene.id+' compiled hash drift');
  sets.add(id);palettes.add(env.background_palette_id);compiledHashes.add(actual);checked++;
 }
 if(!checked)fail('no scene sets');
 return {scenes:checked,scene_sets:sets.size,palettes:palettes.size,compiled_assets:compiledHashes.size};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const r=await validateSceneSetWorkspace(path.resolve(process.argv[2]||'.'));console.log('SCENE_SET_QC_PASS '+JSON.stringify(r));}catch(e){console.error(e.message);process.exitCode=1;}}
