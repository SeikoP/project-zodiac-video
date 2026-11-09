#!/usr/bin/env node
// Supply current, exact reference bytes in one bounded context bundle.
// Explicit delta mode is advisory only: never evidence of a completed read/validation/approval.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadStepContext} from '../../orchestration/plan-step-context.mjs';
import {loadCurrentPolicy} from '../policy/current-policy.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const tokens=async text=>(await import('gpt-tokenizer/encoding/o200k_base')).countTokens(text);

export async function encodeContextData(value,{loadToon=()=>import('@toon-format/toon')}={}){
 const json=JSON.stringify(value),json_tokens=await tokens(json);
 let content=json,format='json',decoded=value;
 try{const {encode,decode}=await loadToon();
  const candidate=encode(value),restored=decode(candidate);
  if(isDeepStrictEqual(restored,value)&&await tokens(candidate)<json_tokens){content=candidate;format='toon';decoded=restored;}
 }catch{/* Compact JSON remains the lossless fallback for unsupported values. */}
 return {content,format,tokens:await tokens(content),json_tokens,decoded};
}

export function repairContext(receipt,sourceHashes){
 const keys=['narration.txt','.authoring/visual-intent.json','design.md','.authoring/narrative-plan.json','production.json'];
 if(!keys.every(k=>Object.hasOwn(receipt.repair_source_hashes??{},k)&&receipt.repair_source_hashes[k]===sourceHashes[k]))return {status:'STALE_OR_UNBOUND',fetch:'Rerun the owning native check against current sources; do not repair from old errors.'};
 return {status:'CURRENT',issues:receipt.issues??[],repair_plan:receipt.repair_plan??null,groups:receipt.fast_repair_groups??null,affected_nodes:receipt.semantic_dirty??[],failed_steps:(receipt.steps??[]).filter(s=>['FAIL','BLOCKED'].includes(s.status)).map(s=>({id:s.id,status:s.status,reason:s.reason??null,input_hash:s.input_hash??null})),not_an_approval:true};
}

export async function deliverContextBlocks(blocks,{workspace,policy,prior=null,reuseId=null,tokenBudget=16000,requestedPaths=[]}={}){
 if(!Number.isSafeInteger(tokenBudget)||tokenBudget<1)throw Error('CONTEXT_BUDGET_INVALID');
 if(new Set(blocks.map(b=>b.key)).size!==blocks.length)throw Error('CONTEXT_BLOCK_DUPLICATE');
 for(const key of requestedPaths)if(!blocks.some(b=>b.key===key))throw Error('CONTEXT_REFERENCE_NOT_SELECTED '+key);
 const manifest=blocks.map(b=>({key:b.key,sha256:sha(b.content),format:b.format??'text',required:b.required!==false,protected:!!b.protected}));
 const id=sha(JSON.stringify({workspace,policy,manifest}));
 const acknowledged=!!prior&&reuseId===prior.id&&prior.workspace===workspace&&prior.policy===policy&&prior.id===sha(JSON.stringify({workspace:prior.workspace,policy:prior.policy,manifest:prior.manifest}));
 const held=new Set(acknowledged?(prior.blocks??[]).filter(b=>['INLINE_CURRENT','CALLER_HELD_IDENTICAL'].includes(b.delivery)&&prior.manifest.some(m=>m.key===b.key&&m.sha256===b.sha256)&&(b.delivery!=='INLINE_CURRENT'||sha(b.content)===b.sha256)).map(b=>b.key+'|'+b.sha256):[]);
 const output=[];
 for(const [i,b] of blocks.entries()){
  const meta=manifest[i],reuse=!meta.protected&&!requestedPaths.includes(b.key)&&held.has(b.key+'|'+meta.sha256);
  output.push({...meta,delivery:reuse?'CALLER_HELD_IDENTICAL':meta.protected||requestedPaths.includes(b.key)?'INLINE_CURRENT':'FETCH_REQUIRED',...(meta.protected||requestedPaths.includes(b.key)?{content:b.content}:{})});
 }
 const result={format:'zodiac-context-delivery@1',id,workspace,policy,manifest,mode:acknowledged?'explicit_delta':'full',blocks:output,not_an_approval:true};
 // Budget the entire transport envelope; never cut a required block to make it fit.
 for(const [i,b] of blocks.entries())if(output[i].delivery==='FETCH_REQUIRED'){
  output[i]={...output[i],delivery:'INLINE_CURRENT',content:b.content};
  if(await tokens(JSON.stringify(result))>tokenBudget){delete output[i].content;output[i].delivery='FETCH_REQUIRED';}
 }
 const delivered=await tokens(JSON.stringify(result)),full=await tokens(JSON.stringify({...result,mode:'full',blocks:manifest.map((m,i)=>({...m,delivery:'INLINE_CURRENT',content:blocks[i].content}))}));
 return {...result,pending_references:output.filter(b=>b.required&&b.delivery==='FETCH_REQUIRED').map(b=>b.key),budget:{encoding:'o200k_base',host_token_count:false,limit:tokenBudget,transport_tokens_before_accounting:delivered,full_transport_tokens_before_accounting:full,status:delivered>tokenBudget?'OVER_BUDGET_REQUIRED':output.some(b=>b.required&&b.delivery==='FETCH_REQUIRED')?'NEEDS_REFERENCES':'READY',rule:'Fetch pending required references before their capability is used. Over-budget protected context is preserved; this is not a phase gate.'}};
}

export async function compileTaskCapsule(workspace,{brief,prior=null,reuseId=null,tokenBudget=16000,requestedPaths=[]}={}){
 const task=brief?.next_task;if(!task?.id||!task.workspace_sha256)throw Error('CONTEXT_BOUND_TASK_REQUIRED');
 const root=await realpath(workspace);if(sha(root)!==task.workspace_sha256)throw Error('CONTEXT_WORKSPACE_CHANGED');
 const loaded={};
 const verify=async()=>{
  if(sha(await readFile(path.join(root,'.authoring/pipeline-state.json')))!==task.state_sha256)throw Error('CONTEXT_STATE_CHANGED');
  for(const [rel,expected] of Object.entries(task.source_hashes)){
   let raw=null;try{const file=await realpath(path.resolve(root,rel));if(!file.startsWith(root+path.sep))throw Error('CONTEXT_SOURCE_UNSAFE');raw=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
   if((raw===null?null:sha(raw))!==expected)throw Error('CONTEXT_SOURCE_CHANGED '+rel);
   loaded[rel]=raw;
  }
 };
 await verify();
 const json=rel=>loaded[rel]?JSON.parse(loaded[rel]):null;
 const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json')));
 const plan=json('.authoring/narrative-plan.json')??json('narrative-plan.json');
 const handoff={source_hashes:task.source_hashes,review_refs:(state.review_receipts??[]).map(r=>({phase:r.phase_id,status:r.status,proof:r.proof,source_hashes:r.source_hashes??null})),not_an_approval:true};
 if(task.phase!=='03-handoff')handoff.decisions={creative_direction:json('.authoring/phase3-writer-brief.json')?.creative_direction??null,episode_scope:json('.authoring/episode-scope.json')??plan?.episode_scope??null,story_spine:plan?.story_spine??null};
 if(task.phase==='02-visual-production'&&!task.scene_id&&['DESIGN_VISUAL','AUTHOR_STEP'].includes(task.kind)){
  handoff.narration=loaded['narration.txt']?.toString('utf8')??null;
  handoff.approved_plan=plan;
 }
 if(task.phase==='02-visual-production')try{handoff.repair=repairContext(JSON.parse(await readFile(path.join(root,'.authoring/phase02-execution-receipt.json'),'utf8')),task.source_hashes);}catch(e){if(e.code!=='ENOENT')throw e;}
 const encoded=await encodeContextData({task,handoff});
 const blocks=[{key:'task-and-handoff',content:encoded.content,format:encoded.format,protected:true}];
 let policy=task.contract_sha256,host_guidance_required=[],deferred_references=[],contextManifest=[];
 if(task.step&&!['ACTIVATE_PHASE','RESOLVE_BLOCKER','COMPLETE'].includes(task.kind)){
  const ps=state.phases[task.phase];
  const capsule=await compileStepCapsule({phase:task.phase,step:task.step,flags:state.flags??{},options:{run_mode:state.run_mode??'fresh',role:ps.steps[task.step]?.context_role??'draft',selected_asset_ids:state.selected_asset_ids??null,asset_needs:state.asset_needs??[],environment_mode:state.environment_mode??'canvas',meme_selected:state.flags?.meme_selected??false}});
  policy=capsule.policy_sha256;host_guidance_required=capsule.host_guidance_required;deferred_references=capsule.deferred_references;contextManifest=capsule.task_context_manifest;
  blocks.push({key:'active-policy',content:JSON.stringify({effective_policy:capsule.effective_policy,host_capability_notes:capsule.host_capability_notes,allowed_context_categories:capsule.allowed_context_categories,forbidden_context_categories:capsule.forbidden_context_categories,required_entry_capabilities:capsule.required_entry_capabilities,deferred_exit_capabilities:capsule.deferred_exit_capabilities}),format:'json',protected:true});
  blocks.push(...capsule.blocks.map(b=>({key:b.path,content:b.content,format:'text',required:true})));
 }else{
  const effective_policy=await loadCurrentPolicy(skill);policy=sha(JSON.stringify(effective_policy));
  blocks.push({key:'active-policy',content:JSON.stringify({effective_policy}),format:'json',protected:true});
  if(brief.phase_guidance){const file=await realpath(path.resolve(skill,brief.phase_guidance));if(!file.startsWith(await realpath(skill)+path.sep))throw Error('CONTEXT_GUIDE_UNSAFE');blocks.push({key:brief.phase_guidance,content:await readFile(file,'utf8'),required:true});}
 }
 await verify();
 const {bindTaskRevision}=await import('../workflow/task-coordinator.mjs');
 const index=JSON.parse(await readFile(path.join(skill,'orchestration/phase-index.json'),'utf8'));
 const manifests=await Promise.all(index.phases.map(async p=>JSON.parse(await readFile(path.join(skill,'orchestration',p.manifest),'utf8'))));
 const current=await bindTaskRevision({},{workspace,stateBytes:await readFile(path.join(root,'.authoring/pipeline-state.json')),manifests,contextManifest});
 if(current.contract_sha256!==task.contract_sha256||current.state_sha256!==task.state_sha256)throw Error('CONTEXT_TASK_CHANGED');
 const delivery=await deliverContextBlocks(blocks,{workspace:task.workspace_sha256,policy,prior,reuseId,tokenBudget,requestedPaths});
 return {...delivery,format:'zodiac-task-context@1',phase:task.phase,step:task.step,task_id:task.id,host_guidance_required,deferred_references,serialization:{selected:encoded.format,json_tokens:encoded.json_tokens,selected_tokens:encoded.tokens,lossless:true},history_policy:'Only selected current sources are delivered. Host chat history is not erased. Missing facts require source retrieval, not invention.'};
}
export async function compileStepCapsule({phase,step,flags={},options={},prior=null,explicitReuseId=null}){
 const plan=await loadStepContext(phase,step,flags,options);
 const task_context_manifest=[...plan.context_manifest];
 const referenceItems=[],payloads={},missing=[];
 const phaseGuide=plan.phase_guidance;if(phaseGuide&&!plan.context_manifest.some(e=>e.path===phaseGuide)){const abs=path.resolve(skill,phaseGuide);if(!abs.startsWith(skill+path.sep))throw Error('CAPSULE_PHASE_GUIDE_UNSAFE');const raw=await readFile(abs);plan.context_manifest.unshift({path:phaseGuide,bytes:raw.length,sha256:sha(raw)});}
 for(const entry of plan.context_manifest){
  if(entry.provider_required){missing.push(entry.path);referenceItems.push({path:entry.path,provider_required:true});continue;}
  const abs=path.resolve(skill,entry.path);if(!abs.startsWith(skill+path.sep))throw Error('CAPSULE_REFERENCE_UNSAFE');
  const raw=await readFile(abs);const digest=sha(raw);
  if(digest!==entry.sha256)throw Error('CAPSULE_REFERENCE_CHANGED_CONCURRENTLY '+entry.path);
  referenceItems.push({path:entry.path,sha256:digest,bytes:raw.length});
  payloads[digest]=raw.toString('utf8');
 }
 const manifest=referenceItems.map(x=>({path:x.path,sha256:x.sha256??null,provider_required:!!x.provider_required}));
 const policy_sha256=sha(JSON.stringify(plan.effective_policy??null));
 const selection_sha256=sha(JSON.stringify({selected_capabilities:plan.selected_capabilities,required_outputs:plan.required_outputs,flags,options,phase,step}));
 const id=sha(JSON.stringify({manifest,policy_sha256,selection_sha256}));
 const deltaEnabled=!!prior&&explicitReuseId===prior.id&&prior.phase===phase&&prior.step===step&&prior.policy_sha256===policy_sha256&&prior.selection_sha256===selection_sha256;
 const unchanged=deltaEnabled?new Set((prior.references??[]).filter(x=>x.sha256).map(x=>x.sha256)) : new Set();
 const blocks=[];for(const item of referenceItems){if(item.provider_required)continue;blocks.push({path:item.path,sha256:item.sha256,bytes:item.bytes,delivery:unchanged.has(item.sha256)?'CALLER_HELD_IDENTICAL':'INLINE_CURRENT',...(unchanged.has(item.sha256)?{}:{content:payloads[item.sha256]})});}
 return {format:'zodiac-step-context-capsule@1',task_context_manifest,id,phase,step,mode:deltaEnabled?'explicit_delta':'full',policy_sha256,selection_sha256,references:referenceItems,blocks,deferred_references:plan.deferred_references,host_guidance_required:missing,effective_policy:plan.effective_policy,host_capability_notes:plan.host_capability_notes,required_outputs:plan.required_outputs,required_entry_capabilities:plan.required_entry_capabilities,deferred_exit_capabilities:plan.deferred_exit_capabilities,allowed_context_categories:plan.allowed_context_categories,forbidden_context_categories:plan.forbidden_context_categories,not_an_approval:true,no_validation_changes:true};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 try{
  const a=process.argv.slice(2),get=k=>{const i=a.indexOf(k);return i<0?null:a[i+1]??null;};
  const phase=a[0],step=a[1];if(!phase||!step)throw Error('Usage: compile-step-capsule.mjs <phase> <step> [--flags <state.json>] [--out <file>] [--previous <file> --reuse-id <id>]');
  const f=get('--flags');const state=f?JSON.parse(await readFile(path.resolve(f),'utf8')):{};
  const options={run_mode:state.run_mode??'fresh',role:state.context_role??'draft',selected_asset_ids:state.selected_asset_ids??null,asset_needs:state.asset_needs??[],environment_mode:state.environment_mode??'canvas',meme_selected:state.flags?.meme_selected??false};
  const prev=get('--previous'),prior=prev?JSON.parse(await readFile(path.resolve(prev),'utf8')):null;
  const capsule=await compileStepCapsule({phase,step,flags:state.flags??{},options,prior,explicitReuseId:get('--reuse-id')});
  const dest=get('--out');if(dest){await mkdir(path.dirname(path.resolve(dest)),{recursive:true});await writeFile(path.resolve(dest),JSON.stringify(capsule,null,2)+'\n');}
  else console.log(JSON.stringify(capsule));
 }catch(e){console.error('FAST_CAPSULE_BLOCKED '+e.message);process.exitCode=2;}
}
