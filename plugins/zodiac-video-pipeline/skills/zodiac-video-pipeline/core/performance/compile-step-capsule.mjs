#!/usr/bin/env node
// Supply current, exact reference bytes in one bounded context bundle.
// Explicit delta mode is advisory only: never evidence of a completed read/validation/approval.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadStepContext} from '../../orchestration/plan-step-context.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function compileStepCapsule({phase,step,flags={},options={},prior=null,explicitReuseId=null}){
 const plan=await loadStepContext(phase,step,flags,options);
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
 return {format:'zodiac-step-context-capsule@1',id,phase,step,mode:deltaEnabled?'explicit_delta':'full',policy_sha256,selection_sha256,references:referenceItems,blocks,host_guidance_required:missing,effective_policy:plan.effective_policy,host_capability_notes:plan.host_capability_notes,required_outputs:plan.required_outputs,required_entry_capabilities:plan.required_entry_capabilities,deferred_exit_capabilities:plan.deferred_exit_capabilities,allowed_context_categories:plan.allowed_context_categories,forbidden_context_categories:plan.forbidden_context_categories,not_an_approval:true,no_validation_changes:true};
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
