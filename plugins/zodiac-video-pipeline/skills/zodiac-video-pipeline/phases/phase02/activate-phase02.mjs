#!/usr/bin/env node
// Activate Phase 02 only after the read-only transition gate reports AUTHORING_READY.
// This mutates orchestration state only; it never creates approvals or validator PASS receipts.
import {readFile,writeFile,rename,open,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const hash=b=>createHash('sha256').update(b).digest('hex');
export async function activatePhase02(workspace){
  const root=path.resolve(workspace), dir=path.join(root,'.authoring');
  const statePath=path.join(dir,'pipeline-state.json');
  const lease=await open(path.join(dir,'.phase02-activation.lock'),'wx').catch(e=>{throw new Error('STATE_WRITE_BUSY '+e.code)});
  try{
    const raw=await readFile(statePath), state=JSON.parse(raw);
    if(state.current_phase==='02-visual-production' && ['READY','IN_PROGRESS','IN_REVIEW','PASS'].includes(state.phases?.['02-visual-production']?.status))
      return {status:'PHASE02_ALREADY_ACTIVE',state_sha256:hash(raw)};
    if(state.current_phase!=='01-content'||state.phases?.['01-content']?.status!=='PASS')
      throw new Error('PHASE01_NOT_PASS');
    const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    const manifest=JSON.parse(await readFile(path.resolve(skill,'../../plugin.json'),'utf8'));
    if(state.plugin_version!==manifest.version)throw new Error('VERSION_MISMATCH');
    const gate=path.join(path.dirname(fileURLToPath(import.meta.url)),'phase02-transition-gate.mjs');
    const proc=spawnSync(process.execPath,[gate,'--workspace',root],{encoding:'utf8'});
    let report;try{report=JSON.parse(proc.stdout)}catch{throw new Error('TRANSITION_GATE_UNREADABLE '+String(proc.stderr||proc.stdout).trim())}
    if(proc.status!==0||report.status!=='AUTHORING_READY'||report.authoring_ready!==true)
      throw new Error('PHASE02_NOT_AUTHORING_READY '+JSON.stringify(report.issues??[]));
    const next=structuredClone(state), p=next.phases['02-visual-production'];
    if(p.status!=='LOCKED'||p.current_step!=='visual_compile'||p.steps?.visual_compile?.status!=='LOCKED')
      throw new Error('PHASE02_ACTIVATION_STATE_INVALID');
    next.current_phase='02-visual-production';
    p.status='READY';
    p.steps.visual_compile.status='READY';
    next.operations=Array.isArray(next.operations)?next.operations:[];
    const temp=statePath+'.activate-'+process.pid;
    try{
      await writeFile(temp,JSON.stringify(next,null,2)+'\n');
      const {validatePipelineState}=await import('../../core/state/validate-pipeline-state.mjs');
      await validatePipelineState(temp);
      if(hash(await readFile(statePath))!==hash(raw))throw new Error('STATE_CHANGED_CONCURRENTLY');
      await rename(temp,statePath);
    }finally{await rm(temp,{force:true})}
    const receipt={
      format:'zodiac-phase02-activation@1',
      status:'ACTIVATED',
      source_state_sha256:hash(raw),
      resulting_state_sha256:hash(await readFile(statePath)),
      transition_status:report.status,
      source_version:manifest.version,
      content_review_preserved:true,
      approvals_created:false,
      not_a_phase_pass:true
    };
    await writeFile(path.join(dir,'phase02-activation-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    return receipt;
  }finally{await lease.close();await rm(path.join(dir,'.phase02-activation.lock'),{force:true})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];
 if(!root){console.error('Usage: node activate-phase02.mjs <workspace>');process.exitCode=2}
 else activatePhase02(root).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('PHASE02_ACTIVATION_BLOCKED '+e.message);process.exitCode=2});
}
