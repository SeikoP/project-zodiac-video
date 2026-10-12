#!/usr/bin/env node
// Reopen an unapproved Phase 02 after a plugin/source contract update.
// Preserves Phase 01 approval; removes only Phase 02 step evidence/operations so they can be revalidated.
import {readFile,writeFile,rename,open,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function reopenPhase02(workspace){
 const root=path.resolve(workspace),dir=path.join(root,'.authoring'),statePath=path.join(dir,'pipeline-state.json');
 const lock=await open(path.join(dir,'.phase02-revalidate.lock'),'wx').catch(e=>{throw Error('STATE_WRITE_BUSY '+e.code)});
 try{
  const raw=await readFile(statePath),state=JSON.parse(raw);
  if(state.current_phase!=='02-visual-production'||state.phases?.['02-visual-production']?.status!=='IN_REVIEW')throw Error('PHASE02_NOT_IN_REVIEW');
  if((state.review_receipts??[]).some(r=>r.phase_id==='02-visual-production'))throw Error('VISUAL_APPROVAL_ALREADY_EXISTS');
  const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const plugin=JSON.parse(await readFile(path.resolve(skill,'../../plugin.json'),'utf8'));
  const previous=state.plugin_version;
  if(previous===plugin.version)throw Error('PLUGIN_VERSION_UNCHANGED');
  if(!state.review_receipts?.some(r=>r.phase_id==='01-content'&&r.status==='APPROVED'&&r.proof?.kind==='user_message'))throw Error('CONTENT_APPROVAL_MISSING');
  const next=structuredClone(state),p=next.phases['02-visual-production'];
  next.plugin_version=plugin.version;
  next.current_phase='02-visual-production';
  p.status='READY';p.current_step='visual_compile';
  for(const [id,step] of Object.entries(p.steps)){step.status=id==='visual_compile'?'READY':'LOCKED';step.capability_receipts=[];step.outputs=[];step.gate_results={};}
  next.operations=(next.operations??[]).filter(op=>op.phase_id!=='02-visual-production');
  const temp=statePath+'.revalidate-'+process.pid;
  try{
   await writeFile(temp,JSON.stringify(next,null,2)+'\n');
   const {validatePipelineState}=await import('../../core/state/validate-pipeline-state.mjs');
   await validatePipelineState(temp);
   if(sha(await readFile(statePath))!==sha(raw))throw Error('STATE_CHANGED_CONCURRENTLY');
   await rename(temp,statePath);
  }finally{await rm(temp,{force:true})}
  const receipt={format:'zodiac-phase02-source-revalidation@1',status:'REOPENED',from_plugin_version:previous,to_plugin_version:plugin.version,source_state_sha256:sha(raw),resulting_state_sha256:sha(await readFile(statePath)),phase01_approval_preserved:true,phase02_approval_present:false,phase02_operations_cleared:true,not_a_phase_pass:true};
  await writeFile(path.join(dir,'phase02-source-revalidation-'+plugin.version+'.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
 }finally{await lock.close();await rm(path.join(dir,'.phase02-revalidate.lock'),{force:true})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=process.argv[2];if(!root){console.error('Usage: node reopen-phase02-for-source-update.mjs <workspace>');process.exit(2)}reopenPhase02(root).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('PHASE02_REVALIDATION_BLOCKED '+e.message);process.exitCode=2});}
