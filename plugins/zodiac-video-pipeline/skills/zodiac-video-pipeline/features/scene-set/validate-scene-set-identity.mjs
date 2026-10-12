#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const registry=JSON.parse(await readFile(new URL('../../references/asset-library-v4/scene-set/index.json',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');

export async function validateSceneSetIdentityWorkspace(workspace){
 const production=JSON.parse(await readFile(path.join(workspace,'production.json'),'utf8'));
 const issues=[],seenCompiled=new Map();let checked=0;
 for(const scene of production.scenes??[]){
  const env=scene.environment??{},id=env.scene_set_id??env.scene_set?.id;if(!id||env.mode==='archive_frame')continue;
  checked++;const master=registry.scene_sets.find(x=>x.id===id);if(!master){issues.push({code:'SCENE_SET_ID_UNKNOWN',scene_id:scene.id,id});continue;}
  const set=env.scene_set,assetId=set?.asset??set?.asset_id,asset=production.assets?.[assetId];
  if(!set||set.format!=='zodiac-scene-set@1'||!asset?.path){issues.push({code:'SCENE_SET_ASSET_MISSING',scene_id:scene.id});continue;}
  let bytes;try{bytes=await readFile(path.join(workspace,asset.path));}catch{issues.push({code:'SCENE_SET_ASSET_MISSING',scene_id:scene.id,asset:assetId});continue;}
  const actual=sha(bytes),lineage=asset.lineage??{};
  if(lineage.source_master!==id||lineage.source_sha256!==master.asset_sha256)issues.push({code:'SCENE_SET_SOURCE_IDENTITY_DRIFT',scene_id:scene.id});
  if(actual!==lineage.compiled_sha256||actual!==set.asset_sha256)issues.push({code:'SCENE_SET_COMPILED_HASH_DRIFT',scene_id:scene.id});
  const prior=seenCompiled.get(actual);if(prior&&prior.id!==id)issues.push({code:'SCENE_SET_IDENTITY_COLLISION',scene_id:scene.id,other_scene:prior.scene_id,identities:[prior.id,id]});else if(!prior)seenCompiled.set(actual,{scene_id:scene.id,id});
 }
 if(!checked)issues.push({code:'SCENE_SET_MISSING_ALL'});
 return {format:'zodiac-scene-set-identity@3',status:issues.length?'BLOCKED':'PASS',checked,issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const r=await validateSceneSetIdentityWorkspace(path.resolve(process.argv[2]||'.'));console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
