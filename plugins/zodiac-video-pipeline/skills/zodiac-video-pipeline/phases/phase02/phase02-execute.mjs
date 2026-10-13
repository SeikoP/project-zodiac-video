#!/usr/bin/env node
// Native Phase 02 execution coordinator. Source/read/READY is not compiler PASS.
import {createHash} from 'node:crypto';
import {access,mkdir,readFile,writeFile,rename,lstat,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {acquireAuthoringLease} from '../../core/state/authoring-lease.mjs';
import {validateStepGraph,executionTrace,createRepairPlan} from '../../core/workflow/deterministic-execution.mjs';
import os from 'node:os';
import {finalizePhase02Workspace} from './finalize-phase02-workspace.mjs';
import {verifyIntentWorkspace} from '../../features/visual-composition/compile-visual-intent.mjs';
import {selectedPhase02Dependencies,selectedStepDependencyFiles} from './phase02-selected-dependencies.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);
const arg=k=>{const i=argv.indexOf(k);return i<0?null:argv[i+1]??null;};
const requestedWorkspace=arg('--workspace');
if(!requestedWorkspace){console.error('Usage: node phase02-execute.mjs --workspace <dir> [--source-root <plugin-root|skill-root>] [--snapshot <snapshot.json> --restore-target <plugin-root>] [--run] [--force]');process.exit(2);}
const workspace=path.resolve(requestedWorkspace);
const running=argv.includes('--run'),finalizeManifest=argv.includes('--finalize-manifest'),force=argv.includes('--force')||finalizeManifest;
if(finalizeManifest&&!running)throw Error('FINALIZE_MANIFEST_REQUIRES_RUN');
await verifyIntentWorkspace(workspace,{revalidateNativeOutput:finalizeManifest});
await mkdir(path.join(workspace,'.authoring'),{recursive:true});const nativeLease=running?await acquireAuthoringLease(path.join(workspace,'.authoring/.phase02-native.lock'),{run_id:'phase02-native',host_id:os.hostname()}):null;
const reportedAt=new Date().toISOString();
const exists=p=>access(p).then(()=>true).catch(()=>false);
const sha=b=>createHash('sha256').update(b).digest('hex');
// Publish Prep is a later Phase-02 step, not an entry requirement for native compilers.
const coreInputPaths=['production.json','narration.txt','.authoring/character-assembly-plan.json'];
const publishInputPaths=['publish/publish.json','publish/publish-copy.txt'];
const sourcePaths=[
 'features/episode/episode-handoff.mjs','features/episode/episode-scope.mjs',
 'orchestration/phase-index.json',
 'orchestration/pipeline-state.template.json',
 'core/state/validate-pipeline-state.mjs',
 'core/evidence/run-validator-with-receipt.mjs',
 'features/visual-composition/validate-authoring-scene-events.mjs',
 'features/visual-composition/validate-visual-quality.mjs',
 'features/visual-composition/validate-phase02-precompile-boundary.mjs',
 'features/visual-composition/phase02-composition.mjs',
 'core/ownership/generated-asset-ownership.mjs',
 'features/narration-performance/compile-narration-performance.mjs',
 'references/narration-rhythm.mjs',
 'features/visual-composition/resolve-scene-composition.mjs',
 'references/asset-library-v4/memes/compile-meme-props.mjs',
 'references/asset-library-v4/memes/effect-lifecycle.mjs',
 'references/design.md',
 'features/visual-composition/validate-phase02-art-direction.mjs',
 'features/scene-set/validate-scene-set-identity.mjs',
 'features/scene-set/scene-set-detection.mjs',
 'references/asset-library-v4/scene-set/index.json',
 'references/asset-library-v4/scene-set/compile-scene-set.mjs',
 'references/asset-library-v4/scene-set/accents/index.json',
 'phases/phase02/phase02-selected-dependencies.mjs',
 'features/visual-composition/validate-motion-consistency.mjs',
 'features/scene-set/validate-scene-set-accents.mjs',
 'art-direction/palette-registry.json',
 'art-direction/environment-registry.json',
 'features/publish/validate-publish-prep.mjs',
 'references/asset-library-v4/characters/compile-character-assembly.mjs',
 'references/asset-library-v4/characters/character-design-intent.mjs',
 'features/visual-composition/validate-character-intent-preflight.mjs',
 'references/asset-library-v4/characters/components/catalog.json',
 'references/asset-library-v4/validation/validate-character-assembly.mjs',
 'references/asset-library-v4/validation/validate-character-components.mjs',
 'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs',
 'references/asset-library-v4/environments/compile-environment.mjs',
 'references/asset-library-v4/environments/validate-environment-binding.mjs',
 'references/asset-library-v4/scene-set/index.json',
 'references/asset-library-v4/scene-direction/compile-scene-direction.mjs',
 'references/asset-library-v4/scene-direction/compiler-profile.json',
 'references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs',
];
const steps=[
 {id:'character_components',src:'references/asset-library-v4/validation/validate-character-components.mjs',args:[],required:[],validator:true},
 {id:'character_plan',src:'references/asset-library-v4/characters/compile-character-assembly.mjs',args:[path.join(workspace,'production.json'),path.join(workspace,'.authoring/character-assembly-plan.json'),'--plan-only'],required:['.authoring/character-state-asset-plan.json']},
 {id:'character_write',src:'references/asset-library-v4/characters/compile-character-assembly.mjs',args:[path.join(workspace,'production.json'),path.join(workspace,'.authoring/character-assembly-plan.json'),'--write'],required:['.authoring/character-state-asset-plan.json']},
 {id:'character_identity',src:'references/asset-library-v4/validation/validate-character-assembly.mjs',args:[workspace],required:[],validator:true},
 {id:'outfit_bake',src:'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs',args:[workspace],required:[],validator:true},
 {id:'environment',src:'references/asset-library-v4/environments/compile-environment.mjs',args:[workspace,'--write'],required:['.authoring/environment-compile-receipt.json']},
 {id:'environment_binding',src:'references/asset-library-v4/environments/validate-environment-binding.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_direction',src:'references/asset-library-v4/scene-direction/compile-scene-direction.mjs',args:[workspace,'--write'],required:['.authoring/scene-direction-compile-receipt.json']},
 {id:'scene_set_identity',src:'features/scene-set/validate-scene-set-identity.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_accent_containment',src:'features/scene-set/validate-scene-set-accents.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_direction_validation',src:'references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_events',src:'features/visual-composition/validate-authoring-scene-events.mjs',args:[workspace],required:[],validator:true},
 {id:'motion_consistency',src:'features/visual-composition/validate-motion-consistency.mjs',args:[workspace],required:[],validator:true},
 {id:'visual_quality',src:'features/visual-composition/validate-visual-quality.mjs',args:[workspace],required:[],validator:true},
 {id:'publish_prep',src:'features/publish/validate-publish-prep.mjs',args:[workspace],required:[],validator:true},
];
const report={run_id:createHash('sha256').update(workspace+'|'+reportedAt).digest('hex').slice(0,20),format:'zodiac-phase02-execution@1',phase:'02-visual-production',at:reportedAt,workspace,mode:running?'run':'inspect',status:'BLOCKED',source:{},issues:[],steps:[],checkpoint:'not_checked'};
const reportPath=path.join(workspace,'.authoring/phase02-execution-receipt.json');
const checkpointPath=path.join(workspace,'.authoring/phase02-native-checkpoints.json');
const writeJson=async(p,x)=>{await mkdir(path.dirname(p),{recursive:true});const tmp=p+'.tmp-'+process.pid;await writeFile(tmp,JSON.stringify(x,null,2)+'\n','utf8');await rename(tmp,p);};
const finish=async()=>{report.execution_trace=executionTrace(report);report.repair_plan=report.issues.length?createRepairPlan(report.issues,{attempt:0,maxAttempts:1}):null;if(running&&report.status==='NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED')report.finalizer=await finalizePhase02Workspace(workspace,{write:true});report.structural_status=report.status==='NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED'?'STRUCTURAL_PASS':report.status;report.creative_status='CREATIVE_REVIEW_REQUIRED';report.runtime_status='RUNTIME_QA_PENDING';if(running){try{report.compiled_production_sha256=sha(await readFile(path.join(workspace,'production.json')));report.projection_source_sha256=JSON.parse(await readFile(path.join(workspace,'.authoring/visual-intent-projection-receipt.json'))).source_sha256;}catch{}}if(nativeLease)await nativeLease.release();await writeJson(reportPath,report);console.log(JSON.stringify({status:report.status,phase:report.phase,issues:report.issues,steps:report.steps.map(s=>({id:s.id,status:s.status,exit_code:s.exit_code})),receipt:reportPath},null,2));process.exit(['PASS','READY','NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED'].includes(report.status)?0:2);};
const fail=(code,details={})=>{report.issues.push({code,...details});};
const resolveSource=async p=>{
 const src=path.resolve(p);
 if(await exists(path.join(src,'plugin.json')))return {pluginRoot:src,skillRoot:path.join(src,'skills/zodiac-video-pipeline')};
 if(await exists(path.join(src,'orchestration/phase-index.json')))return {pluginRoot:path.resolve(src,'../..'),skillRoot:src};
 return {pluginRoot:src,skillRoot:path.join(src,'skills/zodiac-video-pipeline')};
};
const nodeRun=(file,args)=>{
 const r=spawnSync(process.execPath,[file,...args],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:180000});
 const exit_code=r.status??(r.error?.code==='ETIMEDOUT'?124:1);
 return {status:exit_code===0?'PASS':'FAIL',exit_code,command:[process.execPath,file,...args],stdout:String(r.stdout??'').slice(-4500),stderr:String(r.stderr??r.error?.message??'').slice(-4500)};
};
// Native library assets are executable dependencies, not just authoring metadata.
// A changed SVG or environment cue must invalidate the corresponding cached native compilation.
const collectNativeDependencies=async(base)=>{
 const out=[];
 const walk=async dir=>{
  if(!await exists(dir))return;
  for(const e of await readdir(dir,{withFileTypes:true})){
   if(e.isSymbolicLink())continue;
   const full=path.join(dir,e.name);
   if(e.isDirectory()){if(e.name!=='tests')await walk(full);}
   else if(e.isFile()&&/\.(?:svg|json|mjs|md)$/u.test(e.name)&&!e.name.endsWith('.test.mjs'))out.push(full);
  }
 };
 await walk(path.join(base,'references/asset-library-v4'));
 for(const ownerRoot of ['core','features','phases','bootstrap','art-direction'])await walk(path.join(base,ownerRoot));
 await walk(path.join(base,'orchestration'));
 return out.sort();
};
const signature=async(files)=>{const parts=[];for(const rel of [...new Set(files)].sort()){const p=path.resolve(rel);try{const st=await lstat(p);if(!st.isFile()||st.isSymbolicLink())return null;parts.push([p,sha(await readFile(p))]);}catch{return null;}}return sha(JSON.stringify(parts));};
const workspaceAssetPaths=async(kind)=>{
 const production=JSON.parse(await readFile(path.join(workspace,'production.json'),'utf8'));
 const characterIds=new Set((production.scenes??[]).flatMap(s=>(s.entities??[]).filter(e=>e.kind==='character').flatMap(e=>Object.values(e.states??{}).map(s=>s.asset))));
 const memePropIds=new Set((production.scenes??[]).flatMap(s=>(s.visual_grammar?.meme_composition?.asset_requirements??[]).map(r=>r.asset_id)));
 return [...new Set(Object.entries(production.assets??{}).filter(([id,a])=>!kind||(kind==='character'?characterIds.has(id):kind==='meme_props'?memePropIds.has(id):a.category===kind)).map(([,a])=>a.path).filter(Boolean))].sort().map(p=>path.resolve(workspace,p));
};
const findNativeCharAssets=async()=>{
 let production;try{production=JSON.parse(await readFile(path.join(workspace,'production.json'),'utf8'));}catch{return {missing:['production.json unreadable']};}
 const missing=[];
 for(const scene of production.scenes??[])for(const e of scene.entities??[])if(e.kind==='character')for(const [stateName,state] of Object.entries(e.states??{})){
  const a=production.assets?.[state.asset];if(!state.asset||!a?.path||!(await exists(path.join(workspace,a.path))))missing.push(`${scene.id}/${e.id}/${stateName}`);
 }
 return {missing};
};
let sourceOption=arg('--source-root')??path.resolve(HERE,'../../../..');
const snapshot=arg('--snapshot');
if(snapshot){
 const target=arg('--restore-target');
 if(!target){fail('RESTORE_TARGET_REQUIRED');await finish();}else{
  const script=path.resolve(HERE,'../../core/release/restore-plugin-source.mjs');
  if(!(await exists(snapshot))||!(await exists(script))){fail('SOURCE_SNAPSHOT_OR_RESTORE_TOOL_MISSING',{snapshot,script});await finish();}
  else{
   const restored=nodeRun(script,['--source',path.resolve(snapshot),'--target',path.resolve(target)]);
   report.source.restore_result=restored;
   if(restored.status!=='PASS'){fail('SOURCE_RESTORE_FAILED',{exit_code:restored.exit_code});await finish();}
   else sourceOption=target;
  }
 }
}
const source=await resolveSource(sourceOption);
report.source.plugin_root=source.pluginRoot;report.source.skill_root=source.skillRoot;
let manifest=null,template=null;
try{manifest=JSON.parse(await readFile(path.join(source.pluginRoot,'plugin.json'),'utf8'));}catch{fail('PLUGIN_MANIFEST_MISSING');}
try{template=JSON.parse(await readFile(path.join(source.skillRoot,'orchestration/pipeline-state.template.json'),'utf8'));}catch{fail('SOURCE_TEMPLATE_MISSING');}
if(manifest&&manifest.name!=='zodiac-video-pipeline')fail('PLUGIN_IDENTITY_MISMATCH');
if(manifest&&template&&manifest.version!==template.plugin_version)fail('SOURCE_TEMPLATE_VERSION_MISMATCH',{plugin:manifest.version,template:template.plugin_version});
const missingSource=[];for(const rel of sourcePaths)if(!(await exists(path.join(source.skillRoot,rel))))missingSource.push(rel);
if(missingSource.length)fail('SOURCE_UNAVAILABLE',{missing:missingSource});
// Do not require a Publish Prep output before running earlier native compiler steps.
for(const p of coreInputPaths)if(!(await exists(path.join(workspace,p))))fail('WORKSPACE_INPUT_MISSING',{path:p});
const statePath=path.join(workspace,'.authoring/pipeline-state.json');
if(!(await exists(statePath)))fail('PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL');
else if(manifest){
 try{const state=JSON.parse(await readFile(statePath,'utf8'));if(state.plugin_version!==manifest.version)fail('PIPELINE_STATE_VERSION_REQUIRES_EVIDENCED_MIGRATION',{state:state.plugin_version,plugin:manifest.version});}catch(e){fail('PIPELINE_STATE_INVALID',{detail:e.message});}
}
const dependencySelection=manifest?.version&&missingSource.length===0?await selectedPhase02Dependencies(source.skillRoot,workspace):{mode:'legacy-full',files:[]};
const nativeDependencies=manifest?.version&&missingSource.length===0?(dependencySelection.mode==='selected'?dependencySelection.files:await collectNativeDependencies(source.skillRoot)):[];
const selectedIntent=dependencySelection.mode==='selected'?JSON.parse(await readFile(path.join(workspace,'.authoring/visual-intent.json'))):null;
const memeUsed=selectedIntent?.scenes?.some(s=>s.grammar?.meme_composition);
const activeSourcePaths=sourcePaths.filter(p=>dependencySelection.mode!=='selected'||memeUsed||!p.includes('/memes/'));
const stamp=manifest?.version&&missingSource.length===0?await signature([...new Set([path.join(source.pluginRoot,'plugin.json'),...activeSourcePaths.map(p=>path.join(source.skillRoot,p)),...nativeDependencies])]):null;
const releaseParts=String(manifest?.version??'0.0.0').split('.').map(Number);const modernComposition=releaseParts[0]>2||(releaseParts[0]===2&&(releaseParts[1]>4||(releaseParts[1]===4&&releaseParts[2]>=46)));
const rhythmRelease=releaseParts[0]>2||(releaseParts[0]===2&&(releaseParts[1]>4||(releaseParts[1]===4&&releaseParts[2]>=47)));
if(rhythmRelease&&await exists(statePath)){const selected=JSON.parse(await readFile(statePath,'utf8'));if(selected.run_mode==='fresh'){coreInputPaths.push(await exists(path.join(workspace,'.authoring/narrative-plan.json'))?'.authoring/narrative-plan.json':'narrative-plan.json');steps.unshift({id:'narration_performance',src:'features/narration-performance/compile-narration-performance.mjs',args:[workspace,'--write'],required:['.authoring/narration-performance-receipt.json']});}}
steps.splice(steps.findIndex(s=>s.id==='environment'),0,{id:'meme_props',src:'references/asset-library-v4/memes/compile-meme-props.mjs',args:[path.join(workspace,'production.json'),'--write'],required:['.authoring/meme-prop-compile-receipt.json','.authoring/generated-assets.json']});
if(modernComposition){steps.splice(steps.findIndex(s=>s.id==='scene_events'),0,{id:'composition_resolved',src:'features/visual-composition/resolve-scene-composition.mjs',args:[workspace,'--write'],required:['.authoring/scene-composition-resolved.json']});}
if(finalizeManifest)steps.push({id:'director_final_review',src:'features/visual-composition/run-director-v2-review.mjs',args:[workspace],required:['.authoring/director-v2-review-receipt.json']});
const graph=validateStepGraph(steps);
if(graph.status!=='PASS')report.issues.push(...graph.issues);
report.source.version=manifest?.version??null;report.source.fingerprint=stamp;report.source.native_dependency_count=nativeDependencies.length;report.source.native_dependency_mode=dependencySelection.mode;
if(running&&report.issues.length===0){
 const validity=nodeRun(path.join(source.skillRoot,'core/state/validate-pipeline-state.mjs'),[statePath]);
 report.state_validation=validity;
 if(validity.status!=='PASS')fail('PIPELINE_STATE_VALIDATION_FAILED',{exit_code:validity.exit_code,stderr:validity.stderr});
 if(validity.status==='PASS'){
  const receiptPath=path.join(workspace,'.authoring/native-validator-precompile_seam_validation.json');
  const seam=nodeRun(path.join(source.skillRoot,'core/evidence/run-validator-with-receipt.mjs'),[
   'precompile_seam_validation',receiptPath,path.join(source.skillRoot,'features/visual-composition/validate-phase02-precompile-boundary.mjs'),workspace
  ]);
  report.precompile_seam=seam;report.precompile_seam_receipt=receiptPath;
  if(seam.status!=='PASS')fail('PRECOMPILE_SEAM_BLOCKED',{exit_code:seam.exit_code,stdout:seam.stdout,stderr:seam.stderr});
 }
 if(validity.status==='PASS'&&report.issues.length===0){
  const state=JSON.parse(await readFile(statePath,'utf8'));
  if(state.flags?.art_direction_required===true){
   const artScript=path.join(source.skillRoot,'features/visual-composition/validate-phase02-art-direction.mjs');
   const receiptPath=path.join(workspace,'.authoring/native-validator-phase02_art_direction_validation.json');
   const art=nodeRun(path.join(source.skillRoot,'core/evidence/run-validator-with-receipt.mjs'),['phase02_art_direction_validation',receiptPath,artScript,workspace]);
   report.art_direction_preflight=art;report.art_direction_receipt=receiptPath;
   if(art.status!=='PASS')fail('ART_DIRECTION_PREFLIGHT_BLOCKED',{exit_code:art.exit_code,stdout:art.stdout,stderr:art.stderr});
  }
 }
 if(validity.status==='PASS'&&report.issues.length===0){
  const intent=nodeRun(path.join(source.skillRoot,'features/visual-composition/validate-character-intent-preflight.mjs'),[workspace]);
  report.character_intent_preflight=intent;
  if(intent.status!=='PASS')fail('CHARACTER_INTENT_PREFLIGHT_FAILED',{exit_code:intent.exit_code,stderr:intent.stderr});
 }
}
if(report.issues.length){report.status='BLOCKED';await finish();}
else if(!running){report.status='READY';await finish();}
else{
 let cache={format:'zodiac-phase02-native-checkpoints@1',version:manifest.version,source_fingerprint:stamp,steps:{}};
 try{const old=JSON.parse(await readFile(checkpointPath,'utf8'));if(old.format===cache.format&&old.version===manifest.version&&(old.source_fingerprint===stamp||dependencySelection.mode==='selected'))cache={...old,source_fingerprint:stamp};}catch{}
 report.checkpoint='checked';
 for(const step of steps){
  // Only Publish Prep tracks publish inputs; changing cover copy must not invalidate character/environment caches.
  const stepInputPaths=step.id==='publish_prep'?[...coreInputPaths,...publishInputPaths]:coreInputPaths;
  const missing=stepInputPaths.filter(p=>!requireExistsSync(p));
  if(missing.length){const issue={id:step.id,status:'BLOCKED',reason:'WORKSPACE_STEP_INPUT_MISSING',missing};report.steps.push(issue);fail('WORKSPACE_STEP_INPUT_MISSING',{step:step.id,missing});break;}
  const absolute=path.join(source.skillRoot,step.src);
  const args=[...step.args];
  const stepSourceFiles=dependencySelection.mode==='selected'?await selectedStepDependencyFiles(source.skillRoot,step.src,[...nativeDependencies,...activeSourcePaths.map(p=>path.join(source.skillRoot,p))],{stepId:step.id}):[];
  const relevant=[...stepSourceFiles,absolute,...(step.validator?[path.join(source.skillRoot,'core/evidence/run-validator-with-receipt.mjs')]:[]),...stepInputPaths.map(p=>path.join(workspace,p))];
  // These validators read workspace plans outside production.json. A cached
  // PASS must not survive changes to their actual authoring inputs.
  if(['composition_resolved','visual_quality','director_final_review'].includes(step.id))for(const rel of ['design.md','.authoring/scene-art-direction.json','.authoring/director-plan.json','.authoring/story-object-plan.json','.authoring/visual-metaphor-plan.json'])if(await exists(path.join(workspace,rel)))relevant.push(path.join(workspace,rel));
  if(!['character_components','character_plan','character_write','meme_props'].includes(step.id)){
   const generated=step.id==='environment'?await workspaceAssetPaths('environment'):[];
   const kind=['character_identity','outfit_bake'].includes(step.id)?'character':undefined;
   relevant.push(...(await workspaceAssetPaths(kind)).filter(p=>!generated.includes(p)));
  }
  if(step.id==='visual_quality')for(const rel of ['asset-plan.json','.authoring/asset-plan.json'])if(await exists(path.join(workspace,rel)))relevant.push(path.join(workspace,rel));
  const before=await signature(relevant);
  const required=step.required.map(p=>path.join(workspace,p));
  if(step.id==='character_write')required.push(...await workspaceAssetPaths('character'));
  if(step.id==='meme_props')required.push(...await workspaceAssetPaths('meme_props'));
  if(step.id==='environment')required.push(...await workspaceAssetPaths('environment'));
  if(step.validator)required.push(path.join(workspace,'.authoring/native-validator-'+step.id+'.json'));
  const cached=cache.steps?.[step.id];
  const outputsSig=required.length?await signature(required):sha('no-output-files');
  if(!force&&before!==null&&outputsSig!==null&&cached?.status==='PASS'&&cached.after_input_sha===before&&cached.output_sha===outputsSig){report.steps.push({id:step.id,status:'SKIPPED_REUSED',evidence:'verified_post_input_and_output_hash',previous_command:cached.command});continue;}
  if(before===null){const error={id:step.id,status:'BLOCKED',reason:'INPUT_UNREADABLE_OR_MISSING'};report.steps.push(error);fail('NATIVE_STEP_INPUT_MISSING',{step:step.id});break;}
  const receiptRel='.authoring/native-validator-'+step.id+'.json';
  const commandFile=step.validator?path.join(source.skillRoot,'core/evidence/run-validator-with-receipt.mjs'):absolute;
  const commandArgs=step.validator?[step.id,path.join(workspace,receiptRel),absolute,...args]:args;
  const result=nodeRun(commandFile,commandArgs);
  const extra={id:step.id,...result};
  if(result.status==='PASS'&&step.id==='character_write'){
   required.push(...await workspaceAssetPaths('character'));
   const check=await findNativeCharAssets();extra.missing_character_asset_refs=check.missing;
   if(check.missing.length){extra.status='FAIL';extra.reason='CHARACTER_ASSET_REFERENCES_UNRESOLVED';}
  }
  if(result.status==='PASS'&&step.id==='environment'){
   required.push(...await workspaceAssetPaths('environment'));
  }
  if(result.status==='PASS'&&step.id==='meme_props')required.push(...await workspaceAssetPaths('meme_props'));
  if(extra.status==='PASS'&&required.length&&await signature(required)===null){extra.status='FAIL';extra.reason='NATIVE_OUTPUT_RECEIPT_MISSING';}
  if(extra.status==='PASS'&&step.validator){
   try{const receipt=JSON.parse(await readFile(required[0],'utf8'));if(receipt.format!=='zodiac-validator-receipt@1'||receipt.status!=='PASS'||receipt.exit_code!==0)throw Error('not an executed validator PASS');}
   catch(e){extra.status='FAIL';extra.reason='VALIDATOR_RECEIPT_INVALID: '+e.message;}
  }
  if(extra.status==='PASS'){
   cache.steps[step.id]={status:'PASS',command:result.command,selected_source_files:stepSourceFiles.map(p=>path.relative(source.skillRoot,p)),after_input_sha:await signature(relevant),output_sha:required.length?await signature(required):sha('no-output-files'),at:new Date().toISOString()};
   await writeJson(checkpointPath,cache);
  }else {delete cache.steps[step.id];await writeJson(checkpointPath,cache);fail('NATIVE_STEP_FAILED',{step:step.id,reason:extra.reason??'NODE_EXIT_NONZERO',exit_code:extra.exit_code});}
  report.steps.push(extra);
  if(extra.status!=='PASS')break;
 }
 if(!report.issues.length&&report.steps.length===steps.length){
   report.status='NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED';
 }else report.status='BLOCKED';
 await finish();
}
// Synchronous input metadata check avoids reading bytes twice before per-step signature.
function requireExistsSync(rel){try{return Boolean(requireFileStatSync(path.join(workspace,rel)));}catch{return false;}}
function requireFileStatSync(p){return statSync(p).isFile();}
