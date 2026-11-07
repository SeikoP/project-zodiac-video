import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parsePortableZip} from '../../core/archive/zip-primitives.mjs';
import {buildInventory,formatSha256Sums,PHASE1_HANDOFF_REQUIRED,validateHandoffManifest} from '../../contracts/phase1-handoff.mjs';
import {assertContentApprovalSources} from '../../core/evidence/approval-source-hashes.mjs';
import {validatePipelineState} from '../../core/state/validate-pipeline-state.mjs';

const allowedRoot=new Set(['HANDOFF.json','SHA256SUMS',...PHASE1_HANDOFF_REQUIRED]);

const canonicalTarget=rel=>{
 if(rel==='narration.txt')return 'narration.txt';
 if(rel==='narrative-plan.json')return '.authoring/narrative-plan.json';
 if(rel==='episode-scope.json')return '.authoring/episode-scope.json';
 if(rel==='writer-brief.json')return '.authoring/phase3-writer-brief.json';
 if(rel==='pipeline-state.json')return '.authoring/pipeline-state.json';
 if(rel==='content-review-receipt.json')return '.authoring/content-review-receipt.json';
 if(rel==='plugin-use-decisions.json')return '.authoring/plugin-use-decisions.json';
 if(rel.startsWith('validator-receipts/')&&rel.endsWith('.json'))return '.authoring/'+rel;
 return null;
};

export async function inspectPhase1Handoff(zipPath){
 const entries=parsePortableZip(await readFile(zipPath)),by=new Map(entries.map(x=>[x.rel,x]));
 for(const required of ['HANDOFF.json','SHA256SUMS',...PHASE1_HANDOFF_REQUIRED])if(!by.has(required))throw Error('PHASE1_HANDOFF_REQUIRED_MISSING '+required);
 for(const entry of entries)if(!allowedRoot.has(entry.rel)&&!(entry.rel.startsWith('validator-receipts/')&&entry.rel.endsWith('.json')))throw Error('PHASE1_HANDOFF_UNEXPECTED_ENTRY '+entry.rel);
 let manifest;try{manifest=validateHandoffManifest(JSON.parse(by.get('HANDOFF.json').data.toString('utf8')))}catch(e){throw Error('PHASE1_HANDOFF_MANIFEST_INVALID '+e.message)}
 const payload=entries.filter(x=>!['HANDOFF.json','SHA256SUMS'].includes(x.rel));
 const inventory=buildInventory(payload);
 if(JSON.stringify(inventory)!==JSON.stringify(manifest.inventory))throw Error('PHASE1_HANDOFF_INVENTORY_HASH_MISMATCH');
 if(by.get('SHA256SUMS').data.toString('utf8')!==formatSha256Sums(inventory))throw Error('PHASE1_HANDOFF_SHA256SUMS_MISMATCH');
 return {manifest,entries,payload};
}

export async function materializePhase1Handoff(zipPath,workspace){
 const inspected=await inspectPhase1Handoff(zipPath),root=path.resolve(workspace);
 await mkdir(path.join(root,'.authoring'),{recursive:true});
 for(const entry of inspected.payload){
  const target=canonicalTarget(entry.rel);if(!target)continue;
  const output=path.join(root,target);await mkdir(path.dirname(output),{recursive:true});await writeFile(output,entry.data,{flag:'wx'});
 }
 await validatePipelineState(path.join(root,'.authoring','pipeline-state.json'));
 const state=JSON.parse(await readFile(path.join(root,'.authoring','pipeline-state.json'),'utf8'));
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
