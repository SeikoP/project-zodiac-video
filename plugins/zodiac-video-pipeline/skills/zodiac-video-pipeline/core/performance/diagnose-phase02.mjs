#!/usr/bin/env node
// Read-only performance diagnosis. Native wall-clock != time spent authoring in chat.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const load=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
export function analyzePhase02Performance({execution=null,preview=null,native=null,profile=null}={}){
 const steps=(execution?.steps??[]).map(s=>({id:s.id,status:s.status,elapsed_ms:finite(s.elapsed_ms)?s.elapsed_ms:null,cache_reason:s.cache_reason??null}));
 const known=steps.filter(s=>s.elapsed_ms!==null),sum=known.reduce((a,b)=>a+b.elapsed_ms,0);
 const ranked=[...known].sort((a,b)=>b.elapsed_ms-a.elapsed_ms);
 const sceneCompiled=native?.scenes?.filter(s=>s.action==='compile').length??null,sceneReused=native?.scenes?.filter(s=>s.action==='reuse').length??null;
 const pv=preview?.cache??{};
 const previewRebuilt=Array.isArray(pv.rebuilt_scenes)?pv.rebuilt_scenes.length:null;
 const previewReused=Array.isArray(pv.reused_scenes)?pv.reused_scenes.length:null;
 const findings=[];
 if(!execution)findings.push({code:'EXECUTION_RECEIPT_MISSING',note:'Cannot identify the overall native bottleneck without the execution receipt.'});
 if(steps.some(s=>s.status==='SKIPPED_REUSED'))findings.push({code:'NATIVE_STEP_REUSE_ACTIVE',count:steps.filter(s=>s.status==='SKIPPED_REUSED').length});
 if(native&&sceneCompiled===0&&sceneReused>0)findings.push({code:'SCENE_DIRECTION_FULL_REUSE',note:'Native scene-direction work was reused; long runs must be inspected elsewhere.'});
 if(preview&&previewRebuilt>0)findings.push({code:'PREVIEW_SCENES_REBUILT',count:previewRebuilt});
 if(ranked.length&&sum>0)findings.push({code:'HIGHEST_RECORDED_NATIVE_STEP',step:ranked[0].id,elapsed_ms:ranked[0].elapsed_ms,share_of_recorded_step_time:Number((ranked[0].elapsed_ms/sum).toFixed(3))});
 if(!finite(profile?.wall_clock_ms))findings.push({code:'END_TO_END_AUTHORING_TIME_UNMEASURED',note:'Native execution receipt cannot measure agent writing, planning or human Visual Review time.'});
 return {format:'zodiac-phase02-performance-diagnosis@1',status:'DIAGNOSTIC_ONLY',not_an_approval:true,measured:{native_reported_wall_ms:finite(profile?.wall_clock_ms)?profile.wall_clock_ms:null,native_step_elapsed_sum_ms:known.length?sum:null,steps_with_timing:known.length,step_count:steps.length,scene_direction_compiled:sceneCompiled,scene_direction_reused:sceneReused,scene_direction_wall_ms:finite(native?.compile_wall_ms)?native.compile_wall_ms:null,scene_execution_mode:native?.execution_mode??null,preview_rebuilt_scenes:previewRebuilt,preview_reused_scenes:previewReused},slowest_native_steps:ranked.slice(0,6),findings};
}
export async function diagnoseWorkspace(root){const base=path.resolve(root);const [execution,preview,native,profile]=await Promise.all([load(path.join(base,'.authoring/phase02-execution-receipt.json')),load(path.join(base,'preview/preview-report.json')),load(path.join(base,'.authoring/scene-native-receipt.json')),load(path.join(base,'.authoring/fast-pipeline-profile.json'))]);return analyzePhase02Performance({execution,preview,native,profile});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2]){console.error('Usage: diagnose-phase02.mjs <workspace>');process.exitCode=2;}
 else try{console.log(JSON.stringify(await diagnoseWorkspace(process.argv[2]),null,2));}catch(e){console.error('PHASE02_DIAGNOSIS_BLOCKED '+e.message);process.exitCode=2;}
}
