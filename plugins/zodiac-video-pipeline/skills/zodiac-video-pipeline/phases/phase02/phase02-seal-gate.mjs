#!/usr/bin/env node
// Fail closed before Phase-02 review sealing; this does not issue approvals.
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assessPhase02Evidence} from '../../core/evidence/phase02-evidence-audit.mjs';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
export async function inspectPhase02Seal(root, {validateState=true}={}) {
 const dir=resolve(root), files={};
 try{const intent=await (await import('../../features/visual-composition/compile-visual-intent.mjs')).verifyIntentWorkspace(dir);if(intent.status!=='LEGACY'){const state=await read(join(dir,'.authoring/pipeline-state.json'));const binding=await (await import('../../core/evidence/approval-source-hashes.mjs')).assertContentApprovalSources(dir,state);if(binding.status!=='BOUND')throw Error('NEW_INTENT_REQUIRES_BOUND_CONTENT_REVIEW');}}catch(e){return {format:'zodiac-phase02-seal-gate@1',status:'BLOCKED',issues:[{code:'VISUAL_INTENT_DRIFT',detail:e.message}]};}
 for(const rel of ['production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json','publish/publish.json','publish/publish-copy.txt']){
  try{await readFile(join(dir,rel));files[rel]=true;}catch{files[rel]=false;}
 }
 let state=null,checkpoints=null,execution=null;
 try{state=await read(join(dir,'.authoring/pipeline-state.json'));}catch{}
 try{checkpoints=await read(join(dir,'.authoring/phase02-native-checkpoints.json'));}catch{}
 try{execution=await read(join(dir,'.authoring/phase02-execution-receipt.json'));}catch{}
 const report=assessPhase02Evidence({state,checkpoints,execution,workspaceFiles:files});
 const issues=[...report.issues];
 // Fresh visual production cannot seal without intentional scene boundaries.
 // Existing imported/sealed jobs are unaffected.
 if(state?.run_mode==='fresh'){
  try{
   const source=await read(join(dir,'production.json'));
   const {validateScenePlan}=await import('./scene-plan.mjs');
   const sceneReport=validateScenePlan(source,{required:true});
   issues.push(...sceneReport.issues);
  }catch(e){issues.push({code:'SCENE_PLAN_VALIDATION_FAILED',detail:e.message});}
 }

 const v=String(state?.plugin_version??'0.0.0').split('.').map(Number),modern=v[0]>2||(v[0]===2&&(v[1]>4||(v[1]===4&&v[2]>=46)));
 let intent=false;try{intent=(await read(join(dir,'.authoring/scene-art-direction.json'))).composition_stage==='intent';}catch{}
 if((modern&&state?.run_mode==='fresh')||intent){try{const checked=await (await import('../../features/visual-composition/resolve-scene-composition.mjs')).inspectResolvedWorkspace(dir);if(checked.status!=='PASS')issues.push(...checked.issues);}catch(e){issues.push({code:'COMPOSITION_RESOLVED_MISSING_OR_INVALID',detail:e.message});}}
 if(state?.run_mode==='fresh'&&(v[0]>2||(v[0]===2&&(v[1]>4||v[1]===4&&v[2]>=47)))){try{const checked=await (await import('../../features/narration-performance/compile-narration-performance.mjs')).compileNarrationPerformanceWorkspace(dir);if(!['2.0','2.1'].includes(checked.plan_version)||checked.status!=='PASS')issues.push({code:'NARRATION_PERFORMANCE_STALE'});}catch(e){issues.push({code:'NARRATION_PERFORMANCE_INVALID',detail:e.message});}}
 try{await (await import('../../features/episode/episode-handoff.mjs')).episodeHandoffWorkspace(dir,{cover:true});}catch(e){issues.push({code:'EPISODE_HANDOFF_INVALID',detail:e.message});}
 if(validateState && state){
  const script=fileURLToPath(new URL('../../core/state/validate-pipeline-state.mjs',import.meta.url));
  const run=spawnSync(process.execPath,[script,join(dir,'.authoring/pipeline-state.json')],{encoding:'utf8',timeout:60000});
  if(run.status!==0)issues.push({code:'STRICT_PIPELINE_STATE_INVALID',detail:(run.stderr||run.stdout||String(run.error)).slice(-1200)});
 }
 if(state?.phases?.['02-visual-production']?.status!=='PASS')issues.push({code:'VISUAL_PHASE_NOT_PASS'});
 if(state?.phases?.['01-content']?.status!=='PASS')issues.push({code:'CONTENT_PHASE_NOT_PASS'});
 return {format:'zodiac-phase02-seal-gate@1',status:issues.length?'BLOCKED':'SEAL_ELIGIBLE',issues,review_approved:report.review_approved,not_a_render_pass:true};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node phase02-seal-gate.mjs <workspace>');process.exitCode=2;}else inspectPhase02Seal(root).then(r=>{console.log(JSON.stringify(r,null,2));if(r.status==='BLOCKED')process.exitCode=2;}).catch(e=>{console.error(e.message);process.exitCode=2;});}
