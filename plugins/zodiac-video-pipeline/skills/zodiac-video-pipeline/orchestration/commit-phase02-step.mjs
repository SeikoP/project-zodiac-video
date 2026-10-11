#!/usr/bin/env node
// Commit exactly one manifest step from real prior tool receipts and on-disk outputs.
// No synthetic approval or validator PASS is ever generated here.
import {readFile,writeFile,rename,mkdir,open,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const phaseId='02-visual-production';
const expected=['visual_compile','assets','publish_prep'];
export function preparePhase02StepCommit({state,manifest,evidence,files}){
 const step=evidence?.step_id;
 if(!expected.includes(step))throw new Error('PHASE02_STEP_UNKNOWN');
 const spec=manifest?.steps?.find(x=>x.id===step);
 if(!spec)throw new Error('PHASE02_MANIFEST_STEP_UNKNOWN');
 const phase=state?.phases?.[phaseId];
 if(!phase || !['READY','IN_PROGRESS'].includes(phase.status))throw new Error('PHASE02_STATE_NOT_ACTIVE');
 if(phase.current_step!==step)throw new Error('PHASE02_STEP_ORDER_INVALID');
 if(!['READY','IN_PROGRESS'].includes(phase.steps?.[step]?.status))throw new Error('PHASE02_STEP_ALREADY_CLOSED');
 if(!Array.isArray(evidence.capability_receipts)||!evidence.capability_receipts.length)throw new Error('REAL_CAPABILITY_RECEIPTS_REQUIRED');
 if(!evidence.gate_results||typeof evidence.gate_results!=='object')throw new Error('REAL_GATE_RESULTS_REQUIRED');
 if(!Array.isArray(evidence.outputs)||!evidence.outputs.length)throw new Error('REAL_OUTPUT_LIST_REQUIRED');
 const declared=new Set([...spec.required_outputs??[],...(spec.conditional_outputs??[]).map(x=>x.name)]);
 for(const output of evidence.outputs)if(!declared.has(output))throw new Error('UNDECLARED_STEP_OUTPUT '+output);
 const needs=new Set(spec.required_outputs??[]);
 for(const output of needs)if(!evidence.outputs.includes(output))throw new Error('STEP_OUTPUT_MISSING '+output);
 const permitted=new Set(spec.allowed_operations??[]);
 const writes=[];
 for(const item of files){
  if(!evidence.outputs.includes(item.path) && !evidence.outputs.some(s=>s.endsWith('/**')&&item.path.startsWith(s.slice(0,-2))))throw new Error('UNDECLARED_FILE '+item.path);
  if(!permitted.has(item.kind))throw new Error('STEP_OPERATION_NOT_ALLOWED '+item.kind);
  if(!/^[a-f0-9]{64}$/i.test(item.sha256))throw new Error('FILE_HASH_REQUIRED '+item.path);
  writes.push({phase_id:phaseId,step_id:step,kind:item.kind,path:item.path,sha256:item.sha256});
 }
 for(const output of needs){const present=writes.some(x=>x.path===output||x.path.endsWith('/'+output)||output.endsWith('/**')&&x.path.startsWith(output.slice(0,-3)+'/'));if(!present)throw new Error('OUTPUT_OPERATION_MISSING '+output);}
 const next=structuredClone(state);
 next.operations.push(...writes);
 const ss=next.phases[phaseId].steps[step];
 ss.capability_receipts=evidence.capability_receipts;
 ss.outputs=evidence.outputs;
 ss.gate_results=evidence.gate_results;
 ss.status='PASS';
 const index=expected.indexOf(step);
 if(index===expected.length-1)next.phases[phaseId].status='IN_REVIEW';
 else {next.phases[phaseId].current_step=expected[index+1];next.phases[phaseId].steps[expected[index+1]].status='READY';next.phases[phaseId].status='IN_PROGRESS';}
 return next;
}
export async function commitPhase02Step(workspace,evidenceFile){
 const root=path.resolve(workspace),dir=path.join(root,'.authoring');
 const lease=await open(path.join(dir,'.phase02-state-write.lock'),'wx').catch(e=>{throw new Error('STATE_WRITE_BUSY '+e.code)});
 try{
  const statePath=path.join(dir,'pipeline-state.json');
  const raw=await readFile(statePath);const state=JSON.parse(raw);
  const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const manifest=await read(path.join(skill,'orchestration/phases/02-visual-production.json'));
  const evidence=await read(evidenceFile);
  if(evidence.expected_state_sha256!==hash(raw))throw new Error('STATE_REVISION_CHANGED');
  const specs=[];
  for(const file of evidence.files??[]){
   const name=String(file.path??'');const abs=path.resolve(root,name);
   if(abs===root||!abs.startsWith(root+path.sep)||path.isAbsolute(name)||name.includes('..'))throw new Error('UNSAFE_OPERATION_PATH '+name);
   const st=await lstat(abs);
   if(!st.isFile()||st.isSymbolicLink())throw new Error('OPERATION_NOT_REGULAR_FILE '+name);
   specs.push({...file,sha256:hash(await readFile(abs))});
  }
  const result=preparePhase02StepCommit({state,manifest,evidence,files:specs});
  const temp=statePath+'.validate-'+process.pid;
  try{
   await writeFile(temp,JSON.stringify(result,null,2)+'\n');
   const {validatePipelineState}=await import('./validate-pipeline-state.mjs');
   await validatePipelineState(temp); // verifies real native validator receipts and all step gates
   if(hash(await readFile(statePath))!==hash(raw))throw new Error('STATE_CHANGED_CONCURRENTLY');
   await rename(temp,statePath);
  }finally{await rm(temp,{force:true});}
  return {status:'STATE_STEP_COMMITTED',step:evidence.step_id,phase_status:result.phases[phaseId].status};
 }finally{await lease.close();await rm(path.join(dir,'.phase02-state-write.lock'),{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [root,file]=process.argv.slice(2);
 if(!root||!file){console.error('Usage: node commit-phase02-step.mjs <workspace> <real-step-evidence.json>');process.exitCode=2;}
 else commitPhase02Step(root,file).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error('PHASE02_STEP_COMMIT_BLOCKED '+e.message);process.exitCode=2});
}
