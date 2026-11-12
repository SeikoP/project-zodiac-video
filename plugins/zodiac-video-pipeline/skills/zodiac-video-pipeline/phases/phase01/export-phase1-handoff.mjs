#!/usr/bin/env node
import {conceptContext} from '../../features/episode/concept-context.mjs';
import {mkdir,readFile,readdir,lstat,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortableZip} from '../../core/archive/zip-primitives.mjs';
import {assertContentApprovalSources,approvalSourceHashes} from '../../core/evidence/approval-source-hashes.mjs';
import {buildInventory,formatSha256Sums,PHASE1_HANDOFF_FORMAT,PHASE1_HANDOFF_MAJOR,PHASE1_HANDOFF_REQUIRED,sha256,validateHandoffManifest} from '../../contracts/phase1-handoff.mjs';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pluginRoot=path.resolve(skill,'../..');
const map=[
 ['narration.txt',['narration.txt']],
 ['narrative-plan.json',['.authoring/narrative-plan.json','narrative-plan.json']],
 ['episode-scope.json',['.authoring/episode-scope.json']],
 ['writer-brief.json',['.authoring/phase3-writer-brief.json','.authoring/writer-brief.json','.authoring/narration-writer-brief.json']],
 ['pipeline-state.json',['.authoring/pipeline-state.json']],
 ['content-review-receipt.json',['.authoring/content-review-receipt.json']],
 ['plugin-use-decisions.json',['.authoring/plugin-use-decisions.json']]
];

async function firstFile(root,candidates){
 for(const rel of candidates)try{return {rel,data:await readFile(path.join(root,rel))}}catch(e){if(e.code!=='ENOENT')throw e}
 return null;
}

async function validatorEntries(root){
 const dir=path.join(root,'.authoring','validator-receipts');let names=[];
 try{names=(await readdir(dir)).filter(n=>n.endsWith('.json')).sort()}catch(e){if(e.code!=='ENOENT')throw e}
 const out=[];
 for(const name of names){
  const file=path.join(dir,name),st=await lstat(file);
  if(st.isSymbolicLink()||!st.isFile())throw Error('PHASE1_HANDOFF_RECEIPT_UNSAFE '+name);
  out.push({rel:'validator-receipts/'+name,data:await readFile(file)});
 }
 return out;
}

function runEntryGate(root){
 const gate=path.join(skill,'phases','phase02','phase02-transition-gate.mjs');
 const proc=spawnSync(process.execPath,[gate,'--workspace',root,'--entry-only'],{encoding:'utf8'});
 let report;try{report=JSON.parse(proc.stdout)}catch{throw Error('PHASE1_HANDOFF_ENTRY_GATE_UNREADABLE '+String(proc.stderr||proc.stdout).trim())}
 if(proc.status!==0||report.status!=='ENTRY_READY'||report.entry_ready!==true)throw Error('PHASE1_HANDOFF_ENTRY_NOT_READY '+JSON.stringify(report.issues??[]));
 return report;
}

export async function buildPhase1HandoffManifest(workspace){
 const root=path.resolve(workspace);
 const stateFile=await firstFile(root,['.authoring/pipeline-state.json']);
 if(!stateFile)throw Error('PHASE1_HANDOFF_STATE_MISSING');
 const state=JSON.parse(stateFile.data);
 if(state.current_phase==='02-visual-production'||state.phases?.['02-visual-production']?.status!=='LOCKED')throw Error('PHASE1_HANDOFF_PHASE2_ALREADY_ACTIVE');
 if(state.current_phase!=='01-content'||state.phases?.['01-content']?.status!=='PASS')throw Error('PHASE1_HANDOFF_PHASE1_NOT_PASS');
 await assertContentApprovalSources(root,state);
 const review=state.review_receipts?.find(r=>r.phase_id==='01-content'&&r.status==='APPROVED');
 if(review?.proof?.kind!=='user_message'||!review.proof.ref?.trim()||review.proof.ref.includes('<'))throw Error('PHASE1_HANDOFF_CONTENT_REVIEW_INVALID');
 const plugin=JSON.parse(await readFile(path.join(pluginRoot,'plugin.json'),'utf8'));
 if(state.plugin_version!==plugin.version)throw Error('PHASE1_HANDOFF_VERSION_MISMATCH');
 runEntryGate(root);
 const payload=[];
 for(const [target,candidates] of map){
  const found=await firstFile(root,candidates);
  if(!found)throw Error('PHASE1_HANDOFF_REQUIRED_MISSING '+target);
  payload.push({rel:target,data:found.data});
 }
 payload.push(...await validatorEntries(root));
 const currentHashes=await approvalSourceHashes(root);
 const receiptFile=payload.find(x=>x.rel==='content-review-receipt.json');
 const receipt=JSON.parse(receiptFile.data);
 if(receipt.status!=='APPROVED'||receipt.phase_id!=='01-content')throw Error('PHASE1_HANDOFF_RECEIPT_INVALID');
 const stateReceipt=review;
 if(JSON.stringify(receipt.source_hashes??null)!==JSON.stringify(stateReceipt.source_hashes??null))throw Error('PHASE1_HANDOFF_REVIEW_RECEIPT_MISMATCH');
 const inventory=buildInventory(payload);
 const scope=JSON.parse(payload.find(x=>x.rel==='episode-scope.json').data);
 const context=conceptContext(JSON.parse(payload.find(x=>x.rel==='narrative-plan.json').data),scope);
 const manifest=validateHandoffManifest({
  format:PHASE1_HANDOFF_FORMAT,contract_major:PHASE1_HANDOFF_MAJOR,run_id:state.run_id,
  plugin_version:plugin.version,phase:'01-content',phase_status:'PASS',
  sign:scope.sign??scope.member_ids??null,concept:context?.premise??scope.concept??scope.title_working??scope.title??null,
  ...(context?{concept_context:context}:{}),
  source_hashes:currentHashes,content_review:stateReceipt,inventory,not_an_approval:true
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
