#!/usr/bin/env node
// Strict, read-only Phase02 checkpoint-to-state evidence audit.
// Never synthesizes approvals, capability receipts, operations or PASS status.
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const exists=p=>access(p).then(()=>true).catch(()=>false);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
export function assessPhase02Evidence({state,checkpoints,execution,workspaceFiles={}}){
 const issues=[];
 const add=(code,detail)=>issues.push({code,...detail});
 const phase=state?.phases?.['02-visual-production'];
 const steps=phase?.steps??{};
 if(!phase)add('PHASE02_STATE_MISSING',{});
 if(!Array.isArray(state?.operations)||!state.operations.length)add('OPERATIONS_MISSING',{});
 if(!Array.isArray(state?.review_receipts))add('REVIEW_RECEIPTS_MISSING',{});
 if(!checkpoints||checkpoints.format!=='zodiac-phase02-native-checkpoints@1')add('NATIVE_CHECKPOINTS_MISSING_OR_INVALID',{});
 else {
  if(checkpoints.version!==state?.plugin_version)add('CHECKPOINT_VERSION_DRIFT',{checkpoint:checkpoints.version,state:state?.plugin_version});
  for(const [name,data] of Object.entries(checkpoints.steps??{})){
   if(data?.status!=='PASS')add('NATIVE_STEP_UNVERIFIED',{step:name,status:data?.status??null});
   if(data?.status==='PASS'&&(!data.output_sha||!data.after_input_sha))add('NATIVE_STEP_HASH_MISSING',{step:name});
  }
  if(!Object.keys(checkpoints.steps??{}).length)add('NATIVE_CHECKPOINTS_EMPTY',{});
 }
 const expectedSteps=['visual_compile','assets','publish_prep'];
 for(const id of expectedSteps){
  const step=steps[id];
  if(!step)add('MANIFEST_STEP_MISSING',{step:id});
  else {
   if(!Array.isArray(step.capability_receipts)||step.capability_receipts.length===0)add('CAPABILITY_RECEIPT_MISSING',{step:id});
   if(!Array.isArray(step.outputs)||step.outputs.length===0)add('MANIFEST_OUTPUT_MISSING',{step:id});
   if(!step.gate_results||!Object.keys(step.gate_results).length)add('MANIFEST_GATE_MISSING',{step:id});
   if(!['PASS','DONE','SKIPPED_REUSED'].includes(step.status))add('MANIFEST_STEP_INCOMPLETE',{step:id,status:step.status});
  }
 }
 if(execution?.status!=='NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED')add('NATIVE_EXECUTION_NOT_CONFIRMED',{status:execution?.status??null});
 const approval=(state?.review_receipts??[]).some(r=>r.phase_id==='02-visual-production'&&r.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof?.ref==='string'&&!!r.proof.ref.trim()&&!r.proof.ref.includes('<'));
 if(!approval)add('VISUAL_APPROVAL_MISSING',{});
 for(const [name,present] of Object.entries(workspaceFiles))if(!present)add('AUTHORING_FILE_MISSING',{path:name});
 return {format:'zodiac-phase02-state-evidence@1',status:issues.length?'BLOCKED':'EVIDENCE_READY_FOR_STRICT_VALIDATOR',issues,checkpoint_count:Object.keys(checkpoints?.steps??{}).length,review_approved:approval,not_a_pass:true};
}
async function cli(){
 const args=process.argv.slice(2),idx=args.indexOf('--workspace');
 if(idx<0||!args[idx+1])throw new Error('Usage: node phase02-evidence-audit.mjs --workspace <dir>');
 const root=path.resolve(args[idx+1]);
 const paths={state:'.authoring/pipeline-state.json',checkpoints:'.authoring/phase02-native-checkpoints.json',execution:'.authoring/phase02-execution-receipt.json'};
 const data={};for(const [name,p] of Object.entries(paths)){try{data[name]=await read(path.join(root,p));}catch{data[name]=null;}}
 const files={};for(const p of ['production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json','publish/publish.json','publish/publish-copy.txt'])files[p]=await exists(path.join(root,p));
 const report=assessPhase02Evidence({...data,workspaceFiles:files});
 console.log(JSON.stringify(report,null,2));
 if(report.status==='BLOCKED')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 cli().catch(e=>{console.error(JSON.stringify({code:'PHASE02_EVIDENCE_AUDIT_ERROR',message:e.message}));process.exitCode=2});
}
