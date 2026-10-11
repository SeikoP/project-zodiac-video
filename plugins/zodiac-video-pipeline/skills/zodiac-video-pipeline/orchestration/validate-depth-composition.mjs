#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeLayer} from './compile-depth-composition.mjs';
export async function validateDepth(root){
 const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const catalog=JSON.parse(await readFile(path.join(skill,'references/depth-catalog.json'),'utf8'));
 const plan=JSON.parse(await readFile(path.join(root,'.authoring/depth-composition-plan.json'),'utf8'));
 const output=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
 // Independently validate actual derived entries and exact materialized bytes.
 const issues=[];
 for(const spec of plan.scenes??[]){
  const scene=(output.scenes??[]).find(s=>s.id===spec.scene_id);
  if(!scene){issues.push('SCENE_NOT_FOUND '+spec.scene_id);continue;}
  for(const role of spec.layers??[]){
   const entity=(scene.entities??[]).find(e=>e.id==='depth__'+String(spec.scene_id).replace(/[^a-z0-9_-]/gi,'_')+'__'+role);
   if(!entity){issues.push('DEPTH_ENTITY_MISSING '+spec.scene_id+'/'+role);continue;}
   const asset=output.assets?.[entity.states?.visible?.asset];
   if(!asset){issues.push('DEPTH_ASSET_MISSING '+entity.id);continue;}
   const svg=await readFile(path.join(root,asset.path),'utf8').catch(()=>null);
   if(!svg)issues.push('DEPTH_SVG_MISSING '+entity.id);
   else if(svg!==makeLayer(spec.profile,catalog.palettes[spec.palette],role,spec.scene_id))issues.push('DEPTH_SVG_DRIFT '+entity.id);
   const box=entity.states.visible.transform;
   if(box.y+box.height>1400)issues.push('CAPTION_SEPARATION_RISK '+entity.id);
   if(role==='front' && entity.states.visible.layer!==15)issues.push('FOREGROUND_LAYER_INVALID '+entity.id);
  }
 }
 if(issues.length)throw new Error('DEPTH_VALIDATION_FAILED '+issues.join('; '));
 return {status:'DEPTH_VALIDATED_CONTRACT_ONLY',scene_count:plan.scenes.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=process.argv[2];if(!root){console.error('Usage: node validate-depth-composition.mjs <workspace>');process.exitCode=2;}else try{console.log(JSON.stringify(await validateDepth(path.resolve(root))));}catch(e){console.error(e.message);process.exitCode=2;}}
