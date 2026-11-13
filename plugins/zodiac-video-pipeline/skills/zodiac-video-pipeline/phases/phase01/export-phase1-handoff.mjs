#!/usr/bin/env node
import {conceptContext} from '../../features/episode/concept-context.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortableZip} from '../../core/portable/zip-primitives.mjs';
import {buildInventory,formatSha256Sums,PHASE1_HANDOFF_FORMAT,PHASE1_HANDOFF_MAJOR,PHASE1_HANDOFF_REQUIRED,sha256,validateHandoffManifest} from '../../contracts/phase1-handoff.mjs';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pluginRoot=path.resolve(skill,'../..');
const map=[
 ['narration.txt',['narration.txt']],
 ['narrative-plan.json',['.authoring/narrative-plan.json','narrative-plan.json']],
 ['episode-scope.json',['.authoring/episode-scope.json','episode-scope.json']],
 ['writer-brief.json',['.authoring/phase3-writer-brief.json','.authoring/writer-brief.json','writer-brief.json']],
 ['voice-profile.json',['.authoring/voice-profile.json','voice-profile.json']],
 ['content-review-receipt.json',['.authoring/content-review-receipt.json','content-review-receipt.json']]
];

async function firstFile(root,candidates){
 for(const rel of candidates)try{return {rel,data:await readFile(path.join(root,rel))}}catch(e){if(e.code!=='ENOENT')throw e}
 return null;
}

export async function buildPhase1HandoffManifest(workspace){
 const root=path.resolve(workspace),payload=[];
 for(const [target,candidates] of map){
  const found=await firstFile(root,candidates);
  if(!found)throw Error('PHASE1_HANDOFF_REQUIRED_MISSING '+target);
  payload.push({rel:target,data:found.data});
 }
 const review=JSON.parse(payload.find(x=>x.rel==='content-review-receipt.json').data);
 if(review.status!=='APPROVED'||review.phase_id!=='01-content'||review.proof?.kind!=='user_message'||!String(review.proof?.ref??'').trim())throw Error('PHASE1_HANDOFF_CONTENT_REVIEW_INVALID');
 if(typeof review.proof.text!=='string')throw Error('PHASE1_HANDOFF_CONTENT_REVIEW_TEXT_REQUIRED');
 const scope=JSON.parse(payload.find(x=>x.rel==='episode-scope.json').data);
 const plan=JSON.parse(payload.find(x=>x.rel==='narrative-plan.json').data);
 const runId=String(review.run_id??scope.run_id??scope.episode_id??'').trim();
 if(!runId)throw Error('PHASE1_HANDOFF_RUN_ID_MISSING');
 const plugin=JSON.parse(await readFile(path.join(pluginRoot,'plugin.json'),'utf8'));
 const inventory=buildInventory(payload);
 const context=conceptContext(plan,scope);
 const manifest=validateHandoffManifest({
  format:PHASE1_HANDOFF_FORMAT,contract_major:PHASE1_HANDOFF_MAJOR,run_id:runId,
  plugin_version:plugin.version,phase:'01-content',phase_status:'PASS',
  sign:scope.sign??scope.member_ids??null,concept:context?.premise??scope.concept??scope.title_working??scope.title??null,
  ...(context?{concept_context:context}:{}),
  content_review:review,inventory,not_an_approval:true
 });
 return {manifest,payload,inventory};
}

export async function exportPhase1Handoff(workspace,outputPath){
 const {manifest,payload,inventory}=await buildPhase1HandoffManifest(workspace);
 for(const required of PHASE1_HANDOFF_REQUIRED)if(!payload.some(x=>x.rel===required))throw Error('PHASE1_HANDOFF_REQUIRED_MISSING '+required);
 const entries=[
  {rel:'HANDOFF.json',data:Buffer.from(JSON.stringify(manifest,null,2)+'\n')},
  ...payload,
  {rel:'SHA256SUMS',data:Buffer.from(formatSha256Sums(inventory))}
 ];
 const zip=buildPortableZip(entries);
 const out=path.resolve(outputPath);await mkdir(path.dirname(out),{recursive:true});
 await writeFile(out,zip,{flag:'wx'});
 return {format:PHASE1_HANDOFF_FORMAT,run_id:manifest.run_id,path:out,sha256:sha256(zip),bytes:zip.length,entries:entries.length,not_an_approval:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [workspace,output]=process.argv.slice(2);
 if(!workspace||!output){console.error('Usage: export-phase1-handoff.mjs <workspace> <output.zip>');process.exitCode=2}
 else exportPhase1Handoff(workspace,output).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('PHASE1_HANDOFF_EXPORT_BLOCKED '+e.message);process.exitCode=2});
}
