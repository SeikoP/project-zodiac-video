#!/usr/bin/env node
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProduction} from './compile-scene-direction.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const profile=JSON.parse(await readFile(path.join(here,'compiler-profile.json'),'utf8'));
const fail=m=>{throw new Error('SCENE_DIRECTION_COMPILE_INVALID: '+m);};
const arg=process.argv[2];if(!arg){console.error('Usage: node validate-scene-direction-compile.mjs <package-root|production.json>');process.exit(2);}let s;try{s=await stat(arg);}catch{fail('input not found');}const root=s.isDirectory()?arg:path.dirname(arg),productionPath=s.isDirectory()?path.join(arg,'production.json'):arg;
const production=JSON.parse(await readFile(productionPath,'utf8'));const expected=await compileProduction(production,{root,profile});
const receiptPath=path.join(root,profile.policy.receipt_path);let receipt;try{receipt=JSON.parse(await readFile(receiptPath,'utf8'));}catch{fail('missing/invalid compile receipt '+profile.policy.receipt_path);}
if(receipt.format!=='zodiac-scene-direction-compile-receipt@1'||receipt.compiler_version!==profile.version)fail('receipt format/version');
if(receipt.signature!==expected.receipt.signature)fail('receipt signature does not match materialized production');
const key=t=>JSON.stringify({x:t?.x,y:t?.y,width:t?.width,height:t?.height});
let compiled=0;
for(let i=0;i<(production.scenes??[]).length;i++){
 const actualScene=production.scenes[i],expectedScene=expected.production.scenes[i],receiptScene=receipt.scenes?.[i];if(receiptScene?.scene_id!==actualScene.id)fail(`receipt scene mismatch at ${i+1}`);
 for(const role of expected.receipt.scenes[i].roles){const ae=(actualScene.entities??[]).find(e=>e.id===role.entity_id),ee=(expectedScene.entities??[]).find(e=>e.id===role.entity_id);if(!ae||!ee)fail(`${actualScene.id} missing compiled entity ${role.entity_id}`);for(const [stateId,es] of Object.entries(ee.states??{})){const as=ae.states?.[stateId];if(key(as?.transform)!==key(es?.transform))fail(`${actualScene.id}/${role.entity_id}/${stateId} transform does not match compiler profile`);}compiled++;}
}
// Runtime-facing regression: whenever the same entity is focal across two different shots, its initial-state geometry must materially differ.
const seen=new Map();let differentiated=0;
for(const scene of production.scenes??[]){const r=receipt.scenes.find(x=>x.scene_id===scene.id);for(const role of r.roles??[]){if(!['subject','focus','focus_prop'].includes(role.role))continue;const sig=key(role.transform);const prev=seen.get(role.entity_id);if(prev&&prev.shot!==r.shot){const a=prev.transform,b=role.transform;const delta=Math.max(Math.abs((a?.x??0)-(b?.x??0)),Math.abs((a?.y??0)-(b?.y??0)),Math.abs((a?.width??0)-(b?.width??0)),Math.abs((a?.height??0)-(b?.height??0)));if(delta<profile.regression.material_difference_px){if(scene.environment?.frame)console.warn(`AUTHORED_FRAME_CONTINUITY_REVIEW: ${role.entity_id} keeps authored geometry across ${prev.shot}/${r.shot}`);else fail(`${role.entity_id} different shots ${prev.shot}/${r.shot} are not materially different`);}differentiated++;}seen.set(role.entity_id,{shot:r.shot,transform:role.transform,sig});}}
console.log(`SCENE_DIRECTION_COMPILE_VALIDATION_PASS: compiled_roles=${compiled} differentiated_pairs=${differentiated}`);
