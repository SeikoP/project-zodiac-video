#!/usr/bin/env node
// Read-only re-orientation after context loss. Derives the first incomplete step from persisted state and
// prints the bounded plan for it. Never writes state, receipts or approvals.
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadStepContext} from './plan-step-context.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const done=new Set(['PASS','SKIPPED_REUSED']);
export async function resumeBrief(workspace){
 const statePath=path.join(path.resolve(workspace),'.authoring','pipeline-state.json');
 let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{throw Error('PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL');}
 const index=JSON.parse(await readFile(path.join(skill,'orchestration/phase-index.json'),'utf8'));
 const phaseIds=Object.keys(state.phases);
 const phase=phaseIds.find(id=>!done.has(state.phases[id].status)&&state.phases[id].status!=='LOCKED')??state.current_phase;
 const ps=state.phases[phase],entry=index.phases.find(x=>x.id===phase);if(!entry)throw Error('RESUME_PHASE_UNKNOWN '+phase);
 const manifest=JSON.parse(await readFile(path.join(skill,'orchestration',entry.manifest),'utf8'));
 const stepIds=manifest.steps.map(s=>s.id);
 const step=stepIds.find(id=>!done.has(ps.steps?.[id]?.status))??null;
 const base={format:'zodiac-resume-brief@1',run_id:state.run_id,run_mode:state.run_mode,phase,phase_status:ps.status,review_boundary:manifest.review_boundary,not_an_approval:true,
  pointer_warning:'A copied Studio step pointer is a hint only; this brief is derived from the persisted state.'};
 if(!step){const approved=(state.review_receipts??[]).some(r=>r.phase_id===phase&&r.status==='APPROVED');return {...base,step:null,next_action:ps.status==='IN_REVIEW'&&!approved?'WAIT_FOR_GENUINE_USER_REVIEW':'RUN_PHASE_GATE_PER_ROUTER',phase_guidance:'orchestration/'+entry.guide};}
 const plan=await loadStepContext(phase,step,state.flags??{},{run_mode:state.run_mode??'fresh',role:ps.steps[step]?.context_role??'draft',selected_asset_ids:state.selected_asset_ids??null,asset_needs:state.asset_needs??[],environment_mode:state.environment_mode??'canvas',meme_selected:state.flags?.meme_selected??false});
 const sizes=[];for(const ref of plan.required_references){try{sizes.push({ref,bytes:(await stat(path.join(skill,ref))).size});}catch{sizes.push({ref,bytes:null,missing:true});}}
 return {...base,step,step_status:ps.steps[step]?.status,remaining_steps:stepIds.slice(stepIds.indexOf(step)),
  read_now:sizes,host_guidance_references:plan.host_guidance_references,host_capability_notes:plan.host_capability_notes,
  required_entry_capabilities:plan.required_entry_capabilities,deferred_exit_capabilities:plan.deferred_exit_capabilities,required_outputs:plan.required_outputs,
  forbidden_context_categories:plan.forbidden_context_categories,phase_guidance:plan.phase_guidance,
  next_action:'Read read_now files, author outputs, run exit validators through run-validator-with-receipt.mjs, then commit the step.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const ws=process.argv[2];if(!ws)throw Error('Usage: node orchestration/resume-brief.mjs <workspace>');console.log(JSON.stringify(await resumeBrief(ws),null,2));}
 catch(e){console.error('RESUME_BLOCKED '+e.message);process.exitCode=2;}
}
