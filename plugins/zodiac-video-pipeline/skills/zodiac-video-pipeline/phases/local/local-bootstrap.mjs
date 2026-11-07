#!/usr/bin/env node
import {mkdir,readdir,lstat,rename,rm,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectPhase1Handoff,materializePhase1Handoff} from './import-phase1-handoff.mjs';
import {activatePhase02} from '../phase02/activate-phase02.mjs';
import {resumeBrief} from '../../orchestration/resume-brief.mjs';

const safeName=s=>String(s).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'unknown';

async function dirs(root){
 try{return (await readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()&&!x.name.startsWith('.')).map(x=>x.name).sort()}catch(e){if(e.code==='ENOENT')return [];throw e}
}
async function inboxZips(root){
 let rows=[];try{for(const ent of await readdir(root,{withFileTypes:true})){if(!ent.isFile()||ent.name.startsWith('.')||path.extname(ent.name).toLowerCase()!=='.zip')continue;const p=path.join(root,ent.name),st=await lstat(p);if(st.isSymbolicLink())continue;rows.push({path:p,name:ent.name,mtime:st.mtimeMs});}}catch(e){if(e.code!=='ENOENT')throw e}
 return rows.sort((a,b)=>a.mtime-b.mtime||a.name.localeCompare(b.name));
}
async function resume(runDir){
 const workspace=path.join(runDir,'workspace'),state=JSON.parse(await readFile(path.join(workspace,'.authoring','pipeline-state.json'),'utf8'));
 const context=await resumeBrief(workspace,{context:true});
 return {status:'PHASE2_LOCAL_READY',run_id:state.run_id,workspace,phase:state.current_phase,resumed:true,next_task:context.next_task,context};
}
async function blockFile(zipPath,blockedRoot,id,error){
 const dir=path.join(blockedRoot,safeName(id));await mkdir(dir,{recursive:true});
 const target=path.join(dir,'capsule.zip');await rename(zipPath,target).catch(async e=>{if(e.code!=='ENOENT')throw e});
 await writeFile(path.join(dir,'import-receipt.json'),JSON.stringify({format:'zodiac-local-import@1',status:'BLOCKED',error:String(error?.message??error),not_an_approval:true},null,2)+'\n');
 return dir;
}

export async function bootstrapLocal(queueRoot=process.env.ZODIAC_QUEUE_ROOT||process.cwd()){
 const root=path.resolve(queueRoot),inbox=path.join(root,'phase1-done'),processing=path.join(root,'processing'),blocked=path.join(root,'blocked'),ready=path.join(root,'ready');
 for(const dir of [inbox,processing,blocked,ready])await mkdir(dir,{recursive:true});
 const active=await dirs(processing);
 if(active.length===1)return resume(path.join(processing,active[0]));
 if(active.length>1)return {status:'LOCAL_MULTIPLE_ACTIVE_EPISODES',candidates:active,not_an_approval:true};
 const pending=await inboxZips(inbox);
 if(!pending.length)return {status:'NO_PHASE1_HANDOFF_AVAILABLE',queue_root:root,not_an_approval:true};
 const selected=pending[0];let inspected;
 try{inspected=await inspectPhase1Handoff(selected.path)}catch(error){
  const id='invalid-'+createHash('sha256').update(selected.name).digest('hex').slice(0,12);await blockFile(selected.path,blocked,id,error);
  return {status:'PHASE1_HANDOFF_BLOCKED',error:String(error.message),blocked_id:id,not_an_approval:true};
 }
 const runId=inspected.manifest.run_id,finalDir=path.join(processing,runId),tempDir=path.join(processing,'.claim-'+safeName(runId)+'-'+process.pid);
 if((await dirs(processing)).includes(runId))return resume(finalDir);
 await mkdir(tempDir);const claimed=path.join(tempDir,'capsule.zip');
 try{
  await rename(selected.path,claimed);
  const workspace=path.join(tempDir,'workspace');await mkdir(workspace);
  await materializePhase1Handoff(claimed,workspace);
  const activation=await activatePhase02(workspace);
  if(!['ACTIVATED','PHASE02_ALREADY_ACTIVE'].includes(activation.status))throw Error('LOCAL_PHASE02_ACTIVATION_INVALID '+activation.status);
  await writeFile(path.join(tempDir,'import-receipt.json'),JSON.stringify({format:'zodiac-local-import@1',status:'IMPORTED',run_id:runId,source_capsule:selected.name,activation_status:activation.status,not_an_approval:true},null,2)+'\n');
  await rename(tempDir,finalDir);
  const result=await resume(finalDir);return {...result,resumed:false};
 }catch(error){
  const source=(await readFile(claimed).then(()=>claimed).catch(()=>null));
  const target=path.join(blocked,safeName(runId));await mkdir(target,{recursive:true});
  if(source)await rename(source,path.join(target,'capsule.zip')).catch(()=>{});
  await writeFile(path.join(target,'import-receipt.json'),JSON.stringify({format:'zodiac-local-import@1',status:'BLOCKED',run_id:runId,error:String(error.message),not_an_approval:true},null,2)+'\n');
  await rm(tempDir,{recursive:true,force:true});
  return {status:'PHASE1_HANDOFF_BLOCKED',run_id:runId,error:String(error.message),not_an_approval:true};
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2]??process.env.ZODIAC_QUEUE_ROOT??process.cwd();
 bootstrapLocal(root).then(x=>{console.log(JSON.stringify(x,null,2));if(['PHASE1_HANDOFF_BLOCKED','LOCAL_MULTIPLE_ACTIVE_EPISODES'].includes(x.status))process.exitCode=2}).catch(e=>{console.error('LOCAL_BOOTSTRAP_BLOCKED '+e.message);process.exitCode=2});
}
