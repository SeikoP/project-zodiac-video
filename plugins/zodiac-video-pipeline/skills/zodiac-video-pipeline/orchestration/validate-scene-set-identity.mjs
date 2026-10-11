#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {primarySceneSetEntities,sceneSetIdentity as inferIdentity,sceneSetRefFromEntity} from './scene-set-detection.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const sceneSetRef=(s,p)=>s?.environment?.scene_set?.asset??s?.environment?.scene_set?.asset_id??sceneSetRefFromEntity(primarySceneSetEntities(s,p)[0],p);
const sceneSetIdentity=(s,p)=>inferIdentity(s,p)??sceneSetRef(s,p);
export function validateSceneSetIdentity(production,assetText){
 const issues=[],seen=new Map();
 for(const scene of production?.scenes??[]){
  const profile=scene.environment?.profile,ref=sceneSetRef(scene,production);
  if(!ref)continue;
  const asset=production.assets?.[ref],src=asset?.path?assetText[asset.path]:undefined;
  if(typeof src!=='string'||!src.trim()){issues.push({code:'SCENE_SET_ASSET_MISSING',scene_id:scene.id,asset:ref});continue;}
  const fingerprint=sha(src),identity=sceneSetIdentity(scene,production),previous=seen.get(fingerprint);
  if(previous&&previous.identity!==identity)issues.push({code:'SCENE_SET_IDENTITY_COLLISION',scene_id:scene.id,other_scene:previous.scene_id,identities:[previous.identity,identity],profiles:[previous.profile,profile]});
  else if(!previous)seen.set(fingerprint,{scene_id:scene.id,profile,identity});
 }
 return {format:'zodiac-scene-set-identity@2',status:issues.length?'BLOCKED':'PASS',issues};
}
async function main(workspace){
 const production=JSON.parse(await readFile(path.join(workspace,'production.json'),'utf8'));
 const text={};for(const scene of production.scenes??[]){const key=sceneSetRef(scene,production),p=production.assets?.[key]?.path;if(!p)continue;try{text[p]=await readFile(path.join(workspace,p),'utf8')}catch{}}
 const report=validateSceneSetIdentity(production,text);console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(path.resolve(process.argv[2]||'.')).catch(e=>{console.error(e.message);process.exitCode=2});
