#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEnvironmentFrame} from './environment-frame-v2.mjs';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
export async function validateWorkspace(root){
 const prod=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
 let checked=0,slots=0,contacts=0,occlusions=0;
 let requireFrame=false;
 try{
  const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));
  const m=/^(\d+)\.(\d+)\.(\d+)/.exec(String(state.plugin_version??''));
  requireFrame=state.run_mode==='fresh'&&m&&Number(m[1])===2&&Number(m[2])===4&&Number(m[3])>=7;
 }catch(e){if(e.code!=='ENOENT')throw e;}
 for(const scene of prod.scenes??[]){
  if(requireFrame&&scene.environment?.profile&&!scene.environment.frame&&(scene.entities??[]).some(e=>e.kind==='character'))
   throw Error(`FRAME_REQUIRED_FOR_ACTED_ENVIRONMENT scene=${scene.id}`);
  const v=validateEnvironmentFrame(scene,prod.assets,{styleToken:prod.visual_system?.style_token?.id});
  if(v.skipped)continue;
  checked++;slots+=v.slots;contacts+=v.contacts;occlusions+=v.occlusions;
  // Scene direction must be executed, never just declared and assumed.
  const receipt=JSON.parse(await readFile(path.join(root,'.authoring/scene-direction-compile-receipt.json'),'utf8'));
  if(!receipt.scenes.some(s=>s.scene_id===scene.id))throw Error(`FRAME_SCENE_DIRECTION_RECEIPT_MISSING scene=${scene.id}`);
 }
 return {status:'PASS',checked,slots,contacts,occlusions};
}
if(direct){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-environment-frame.mjs <workspace>');process.exit(2);}
 try{console.log('ENVIRONMENT_FRAME_PASS '+JSON.stringify(await validateWorkspace(path.resolve(root))));}
 catch(e){console.error('ENVIRONMENT_FRAME_BLOCKED '+e.message);process.exitCode=1;}
}
