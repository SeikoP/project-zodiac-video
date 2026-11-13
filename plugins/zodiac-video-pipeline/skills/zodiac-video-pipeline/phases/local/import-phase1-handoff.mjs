import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePortableZip} from '../../core/portable/zip-primitives.mjs';
import {approvalSourceHashes,assertContentApprovalSources} from '../../core/evidence/approval-source-hashes.mjs';
import {buildInventory,formatSha256Sums,PHASE1_HANDOFF_REQUIRED,PHASE1_HANDOFF_REQUIRED_V1,requiredForHandoff,validateHandoffManifest} from '../../contracts/phase1-handoff.mjs';
import {validatePipelineState} from '../../core/state/validate-pipeline-state.mjs';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pluginRoot=path.resolve(skill,'../..');

const canonicalTarget=rel=>{
 if(rel==='narration.txt')return 'narration.txt';
 if(rel==='narrative-plan.json')return '.authoring/narrative-plan.json';
 if(rel==='episode-scope.json')return '.authoring/episode-scope.json';
 if(rel==='writer-brief.json')return '.authoring/phase3-writer-brief.json';
 if(rel==='voice-profile.json')return '.authoring/voice-profile.json';
 if(rel==='pipeline-state.json')return '.authoring/pipeline-state.json';
 if(rel==='content-review-receipt.json')return '.authoring/content-review-receipt.json';
 if(rel==='plugin-use-decisions.json')return '.authoring/plugin-use-decisions.json';
 if(rel.startsWith('validator-receipts/')&&rel.endsWith('.json'))return '.authoring/'+rel;
 return null;
};

export async function inspectPhase1Handoff(zipPath){
 const entries=parsePortableZip(await readFile(zipPath)),by=new Map(entries.map(x=>[x.rel,x]));
 if(!by.has('HANDOFF.json')||!by.has('SHA256SUMS'))throw Error('PHASE1_HANDOFF_REQUIRED_MISSING control files');
 let manifest;try{manifest=validateHandoffManifest(JSON.parse(by.get('HANDOFF.json').data.toString('utf8')))}catch(e){throw Error('PHASE1_HANDOFF_MANIFEST_INVALID '+e.message)}
 const required=requiredForHandoff(manifest);
 for(const name of required)if(!by.has(name))throw Error('PHASE1_HANDOFF_REQUIRED_MISSING '+name);
 const allowed=new Set(['HANDOFF.json','SHA256SUMS',...required]);
 const legacy=manifest.contract_major===1;
 for(const entry of entries){
  if(allowed.has(entry.rel))continue;
  if(legacy&&entry.rel.startsWith('validator-receipts/')&&entry.rel.endsWith('.json'))continue;
  throw Error('PHASE1_HANDOFF_UNEXPECTED_ENTRY '+entry.rel);
 }
 const payload=entries.filter(x=>!['HANDOFF.json','SHA256SUMS'].includes(x.rel));
 const inventory=buildInventory(payload);
 if(JSON.stringify(inventory)!==JSON.stringify(manifest.inventory))throw Error('PHASE1_HANDOFF_INVENTORY_HASH_MISMATCH');
 if(by.get('SHA256SUMS').data.toString('utf8')!==formatSha256Sums(inventory))throw Error('PHASE1_HANDOFF_SHA256SUMS_MISMATCH');
 return {manifest,entries,payload};
}

async function synthesizeV2State(root,manifest){
 const plugin=JSON.parse(await readFile(path.join(pluginRoot,'plugin.json'),'utf8'));
 const template=JSON.parse(await readFile(path.join(skill,'orchestration','pipeline-state.template.json'),'utf8'));
 const state=structuredClone(template);
 state.plugin_version=plugin.version;
 state.run_id=manifest.run_id;
 state.run_mode='fresh';
 state.current_phase='01-content';
 state.operations=[];
 state.review_receipts=[];
 const content=state.phases['01-content'];
 content.status='PASS';
 content.current_step='narration';
 for(const step of Object.values(content.steps))step.status='PASS';
 const source_hashes=await approvalSourceHashes(root);
 const receipt={phase_id:'01-content',status:'APPROVED',proof:manifest.content_review.proof,source_hashes};
 state.review_receipts=[receipt];
 await writeFile(path.join(root,'.authoring','pipeline-state.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
 return state;
}

export async function materializePhase1Handoff(zipPath,workspace){
 const inspected=await inspectPhase1Handoff(zipPath),root=path.resolve(workspace);
 await mkdir(path.join(root,'.authoring'),{recursive:true});
 for(const entry of inspected.payload){
  const target=canonicalTarget(entry.rel);if(!target)continue;
  const output=path.join(root,target);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,entry.data,{flag:'wx'});
 }
 let state;
 if(inspected.manifest.contract_major===2){
  const current=await approvalSourceHashes(root),approved=inspected.manifest.content_review?.source_hashes??{};
  for(const key of ['narration','plan','scope','brief','voice'])if(approved[key]!==current[key])throw Error('CONTENT_APPROVAL_SOURCE_DRIFT '+key);
  state=await synthesizeV2State(root,inspected.manifest);
 }else{
  await validatePipelineState(path.join(root,'.authoring','pipeline-state.json'));
  state=JSON.parse(await readFile(path.join(root,'.authoring','pipeline-state.json'),'utf8'));
 }
 await validatePipelineState(path.join(root,'.authoring','pipeline-state.json'));
 if(state.run_id!==inspected.manifest.run_id)throw Error('PHASE1_HANDOFF_RUN_ID_MISMATCH');
 if(state.current_phase!=='01-content'||state.phases?.['01-content']?.status!=='PASS'||state.phases?.['02-visual-production']?.status!=='LOCKED')throw Error('PHASE1_HANDOFF_STATE_BOUNDARY_INVALID');
 await assertContentApprovalSources(root,state);
 return {manifest:inspected.manifest,state,workspace:root};
}

export async function importPhase1Handoff(zipPath,processingRoot){
 const inspected=await inspectPhase1Handoff(zipPath);
 const runDir=path.join(path.resolve(processingRoot),inspected.manifest.run_id);
 await mkdir(runDir,{recursive:false});
 const workspace=path.join(runDir,'workspace');await mkdir(workspace);
 await materializePhase1Handoff(zipPath,workspace);
 return {status:'PHASE1_HANDOFF_IMPORTED',run_id:inspected.manifest.run_id,run_dir:runDir,workspace};
}
