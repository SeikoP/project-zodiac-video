#!/usr/bin/env node
// Read-only re-orientation after context loss. Derives the first incomplete step from persisted state and
// prints the bounded plan for it. Never writes state, receipts or approvals.
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadStepContext,workUnitForTask} from './plan-step-context.mjs';
import {resolveNextTask,bindTaskRevision,buildWorkflowGraph,queryWorkflowGraph} from '../core/workflow/task-coordinator.mjs';
import {validatePipelineState} from '../core/state/validate-pipeline-state.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const done=new Set(['PASS','SKIPPED_REUSED']);
export async function resumeBrief(workspace,{query=null,context=false,prior=null,reuseId=null,tokenBudget=16000,requestedPaths=[]}={}){
 if(context){const {compileTaskCapsule}=await import('../core/performance/compile-step-capsule.mjs');return compileTaskCapsule(workspace,{brief:await resumeBrief(workspace),prior,reuseId,tokenBudget,requestedPaths});}
 const statePath=path.join(path.resolve(workspace),'.authoring','pipeline-state.json');
 let state,stateBytes;try{stateBytes=await readFile(statePath);state=JSON.parse(stateBytes);}catch{throw Error('PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL');}
 const index=JSON.parse(await readFile(path.join(skill,'orchestration/phase-index.json'),'utf8'));
 const manifests=await Promise.all(index.phases.map(async entry=>JSON.parse(await readFile(path.join(skill,'orchestration',entry.manifest),'utf8'))));
 if(query!==null)return queryWorkflowGraph(buildWorkflowGraph(manifests,state),query);
 try{await validatePipelineState(statePath);}catch(e){const next_task=await bindTaskRevision({format:'zodiac-next-task@1',engine:'xstate',kind:'RESOLVE_BLOCKER',phase:state.current_phase,step:null,allowed_writes:[],issues:[{code:e.message}],not_an_approval:true},{workspace,stateBytes,manifests});return {format:'zodiac-resume-brief@1',phase:state.current_phase,step:null,phase_status:'BLOCKED',read_now:[],next_action:'RESOLVE_BLOCKER',state_sha256:next_task.state_sha256,next_task,not_an_approval:true};}
 let visualIntent=null,narration='',creativeDirection=null,episodeScope=null,storySpine=null;
 if(state.current_phase==='02-visual-production'){
  try{visualIntent=JSON.parse(await readFile(path.join(workspace,'.authoring/visual-intent.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  try{narration=await readFile(path.join(workspace,'narration.txt'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const optional=async rel=>{try{return JSON.parse(await readFile(path.join(workspace,rel),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
  const brief=await optional('.authoring/phase3-writer-brief.json'),narrative=await optional('.authoring/narrative-plan.json')??await optional('narrative-plan.json');
  creativeDirection=brief?.creative_direction??null;episodeScope=await optional('.authoring/episode-scope.json')??narrative?.episode_scope??null;storySpine=narrative?.story_spine??null;
 }
 const phaseIds=index.phases.map(p=>p.id);
 const phase=phaseIds.find(id=>!done.has(state.phases[id].status))??state.current_phase;
 const ps=state.phases[phase],entry=index.phases.find(x=>x.id===phase);if(!entry)throw Error('RESUME_PHASE_UNKNOWN '+phase);
 const manifest=JSON.parse(await readFile(path.join(skill,'orchestration',entry.manifest),'utf8'));
 const stepIds=manifest.steps.map(s=>s.id);
 const step=stepIds.find(id=>!done.has(ps.steps?.[id]?.status))??null;
 const pointer=resolveNextTask({state,manifests,visualIntent,narration,creativeDirection,episodeScope,storySpine});
 const base={format:'zodiac-resume-brief@1',run_id:state.run_id,run_mode:state.run_mode,phase,phase_status:ps.status,review_boundary:manifest.review_boundary,not_an_approval:true,
  pointer_warning:'A copied Studio step pointer is a hint only; this brief is derived from the persisted state.'};
 if(!step||['ACTIVATE_PHASE','RESOLVE_BLOCKER'].includes(pointer.kind)){const next_task=await bindTaskRevision(pointer,{workspace,stateBytes,manifests});return {...base,step:step??null,next_action:next_task.kind,phase_guidance:'orchestration/'+entry.guide,state_sha256:next_task.state_sha256,next_task};}
 let contextWorkUnit=workUnitForTask(pointer);
 let plan=await loadStepContext(phase,step,state.flags??{},{run_mode:state.run_mode??'fresh',role:ps.steps[step]?.context_role??'draft',work_unit:contextWorkUnit,selected_asset_ids:state.selected_asset_ids??null,asset_needs:state.asset_needs??[],environment_mode:state.environment_mode??'canvas',meme_selected:state.flags?.meme_selected??false});
 const present=await Promise.all(plan.required_outputs.map(async rel=>{if(rel.includes('*'))return false;for(const file of [rel,...(rel.startsWith('.authoring/')?[]:['.authoring/'+rel])])try{if((await stat(path.join(workspace,file))).isFile())return true;}catch(e){if(e.code!=='ENOENT')throw e;}return false;}));
 const resolvedTask=resolveNextTask({state,manifests,visualIntent,narration,creativeDirection,episodeScope,storySpine,outputsReady:present.every(Boolean)});
 const finalWorkUnit=workUnitForTask(resolvedTask);
 if(finalWorkUnit!==contextWorkUnit){contextWorkUnit=finalWorkUnit;plan=await loadStepContext(phase,step,state.flags??{},{run_mode:state.run_mode??'fresh',role:ps.steps[step]?.context_role??'draft',work_unit:contextWorkUnit,selected_asset_ids:state.selected_asset_ids??null,asset_needs:state.asset_needs??[],environment_mode:state.environment_mode??'canvas',meme_selected:state.flags?.meme_selected??false});}
 const sizes=[];for(const ref of new Set([plan.phase_guidance,...plan.required_references])){try{sizes.push({ref,bytes:(await stat(path.join(skill,ref))).size});}catch{sizes.push({ref,bytes:null,missing:true});}}
 const next_task=await bindTaskRevision(resolvedTask,{workspace,stateBytes,manifests,contextManifest:plan.context_manifest});
 if(!(await readFile(statePath)).equals(stateBytes))throw Error('TASK_STATE_CHANGED_CONCURRENTLY');
 return {...base,step,step_status:ps.steps[step]?.status,remaining_steps:stepIds.slice(stepIds.indexOf(step)),
  read_now:sizes,deferred_references:plan.deferred_references,host_guidance_references:plan.host_guidance_references,host_capability_notes:plan.host_capability_notes,
  required_entry_capabilities:plan.required_entry_capabilities,deferred_exit_capabilities:plan.deferred_exit_capabilities,required_outputs:plan.required_outputs,
  forbidden_context_categories:plan.forbidden_context_categories,work_unit:contextWorkUnit,phase_guidance:plan.phase_guidance,
  next_action:next_task.kind,state_sha256:next_task.state_sha256,next_task};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const ws=process.argv[2],args=process.argv.slice(3),get=k=>{const i=args.indexOf(k);if(i<0)return null;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('RESUME_ARGUMENT_MISSING '+k);return args[i+1];};
  if(!ws)throw Error('Usage: resume-brief.mjs <workspace> [--context --token-budget 16000 --previous <capsule.json> --reuse-id <id> --fetch-ref <selected-path>] [--query <capability>]');
  const previous=get('--previous');
  const result=await resumeBrief(ws,{query:get('--query'),context:args.includes('--context'),tokenBudget:get('--token-budget')===null?16000:Number(get('--token-budget')),prior:previous?JSON.parse(await readFile(path.resolve(previous),'utf8')):null,reuseId:get('--reuse-id'),requestedPaths:get('--fetch-ref')?[get('--fetch-ref')]:[]});
  console.log(JSON.stringify(result));
 }
 catch(e){console.error('RESUME_BLOCKED '+e.message);process.exitCode=2;}
}
