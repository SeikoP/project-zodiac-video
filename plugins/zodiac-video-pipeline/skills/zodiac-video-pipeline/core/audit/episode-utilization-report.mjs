#!/usr/bin/env node
// Per-episode, read-only observability. Missing measurements stay null.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeEpisodeSpans} from '../performance/episode-profiler.mjs';
import {diagnoseWorkspace} from '../performance/diagnose-phase02.mjs';
const load=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const safe=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:null;
const phaseIds=['01-content','02-visual-production','03-handoff'];
const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

export function summarizeUtilization({state=null,manifests=[],receipts=[],decisions=null}={}){
 const declared=new Map();
 for(const manifest of manifests)for(const step of manifest.steps??[])for(const cap of [...(step.required_capabilities??[]),...(step.conditional_capabilities??[])]){
  if(!cap.id)continue;
  const x=declared.get(cap.id)??{id:cap.id,kind:cap.kind??null,locator:cap.tool_locator??null,declared_at:[],observed_receipts:[]};
  x.declared_at.push({phase:manifest.id,step:step.id,condition:cap.when??'always'});
  declared.set(cap.id,x);
 }
 const unmapped=[];
 for(const receipt of receipts){
  if(!receipt.capability_id||receipt.status!=='PASS'||receipt.exit_code!==0||!receipt.executed_at||!(/^[a-f0-9]{64}$/u.test(receipt.validator_sha256??'')))continue;
  const target=declared.get(receipt.capability_id);
  if(!target){unmapped.push(receipt.capability_id);continue;}
  target.observed_receipts.push({status:'PASS',executed_at:receipt.executed_at,proof:'validator_execution_receipt'});
 }
 const leaf_skill_decisions=(decisions?.decisions??[]).map(d=>({id:d.id,skill:d.skill_id,trigger:d.trigger,status:d.status,has_application_proof:['APPLIED','REJECTED'].includes(d.status)&&!!d.guidance_uri&&!!d.skill_read_ref&&!!d.application_summary}));
 return {format:'zodiac-episode-capability-utilization@1',run_id:state?.run_id??null,phase:state?.current_phase??null,capabilities:[...declared.values()].map(x=>({...x,status:x.observed_receipts.length?'OBSERVED':'DECLARED_NOT_OBSERVED'})),leaf_skill_decisions,unmapped_receipts:[...new Set(unmapped)],evidence_rule:'Manifest declaration is not execution. Validator receipts prove local validator calls only, not external provider calls.',not_an_approval:true};
}

export function summarizeOptimization({diagnosis=null,profiler=null,context=null,revision=null,baseline=null}={}){
 const m=diagnosis?.measured??{};
 const measured={native_wall_ms:safe(m.native_reported_wall_ms),native_step_sum_ms:safe(m.native_step_elapsed_sum_ms),scene_compiled:safe(m.scene_direction_compiled),scene_reused:safe(m.scene_direction_reused),preview_rebuilt:safe(m.preview_rebuilt_scenes),preview_reused:safe(m.preview_reused_scenes),context_transport_tokens:safe(context?.budget?.transport_tokens_before_accounting),context_full_tokens:safe(context?.budget?.full_transport_tokens_before_accounting),semantic_rebuild_scenes:Array.isArray(revision?.scenes?.rebuild)?revision.scenes.rebuild.length:null,semantic_reuse_scenes:Array.isArray(revision?.scenes?.reuse)?revision.scenes.reuse.length:null,plugin_wall_clock_ms:safe(profiler?.plugin_wall_clock_ms)};
 const total=measured.scene_compiled!==null&&measured.scene_reused!==null?measured.scene_compiled+measured.scene_reused:null;
 const cache_reuse_ratio=total>0?+(measured.scene_reused/total).toFixed(4):null;
 const context_saving_ratio=measured.context_full_tokens>0&&measured.context_transport_tokens!==null?+(1-measured.context_transport_tokens/measured.context_full_tokens).toFixed(4):null;
 const comparison={status:'NO_COMPARABLE_BASELINE',native_wall_change_pct:null};
 if(baseline?.format==='zodiac-episode-optimization@1'&&context?.comparison_key&&baseline.comparison_key===context.comparison_key&&safe(baseline.measured?.native_wall_ms)>0&&measured.native_wall_ms!==null){
  comparison.status='COMPARABLE';comparison.native_wall_change_pct=+((measured.native_wall_ms/baseline.measured.native_wall_ms-1)*100).toFixed(2);
 }
 return {format:'zodiac-episode-optimization@1',comparison_key:context?.comparison_key??null,measured,cache_reuse_ratio,context_saving_ratio,comparison,measurement_limits:['Context tokens are delivered-transport estimates, not total model context.','Semantic dirty sets are not proof of render rebuilds.','Native wall time excludes agent authoring/review.','Missing readings remain null.'],not_an_approval:true};
}

export async function episodeObservability(workspace,{baselinePath=null}={}){
 const base=path.resolve(workspace),author=path.join(base,'.authoring');
 const [state,decisions,context,revision,diagnosis,profiler,baseline,...manifests]=await Promise.all([
  load(path.join(author,'pipeline-state.json')),load(path.join(author,'plugin-use-decisions.json')),
  load(path.join(author,'context-delivery-receipt.json')),load(path.join(author,'phase02-revision-guidance.json')),
  diagnoseWorkspace(base),summarizeEpisodeSpans(base),baselinePath?load(path.resolve(baselinePath)):Promise.resolve(null),
  ...phaseIds.map(id=>load(path.join(skillRoot,'orchestration/phases',id+'.json')))
 ]);
 let files=[];try{files=(await readdir(path.join(author,'validator-receipts'))).filter(x=>x.endsWith('.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const receipts=(await Promise.all(files.map(f=>load(path.join(author,'validator-receipts',f))))).filter(Boolean);
 return {format:'zodiac-episode-observability@1',workspace:base,capability_utilization:summarizeUtilization({state,manifests:manifests.filter(Boolean),receipts,decisions}),optimization:summarizeOptimization({diagnosis,profiler,context,revision,baseline}),not_an_approval:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const workspace=process.argv[2],baselinePath=process.argv[3]??null;
 if(!workspace){console.error('Usage: episode-utilization-report.mjs <workspace> [baseline-report.json]');process.exitCode=2;}
 else episodeObservability(workspace,{baselinePath}).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error('EPISODE_OBSERVABILITY_BLOCKED '+e.message);process.exitCode=2;});
}
