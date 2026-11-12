import {runNativeCommand} from './native-command.mjs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {runSafeParallel} from './safe-parallel-scheduler.mjs';
export async function runParallelNativePreflight(sourceRoot,workspace,{artDirectionRequired=false,fresh=false,maxConcurrency=5}={}){
 const fastStarted=performance.now();
 const validator=path.join(sourceRoot,'core/evidence/run-validator-with-receipt.mjs');
 const seamReceipt=path.join(workspace,'.authoring/native-validator-precompile_seam_validation.json');
 const artReceipt=path.join(workspace,'.authoring/native-validator-phase02_art_direction_validation.json');
 const progressiveReceipt=path.join(workspace,'.authoring/native-validator-phase02_progressive_preflight.json');
 const experienceReceipt=path.join(workspace,'.authoring/native-validator-scene_experience_review.json');
 const tasks=[
  {id:'seam',reads:['production.json','narration.txt','design.md'],writes:['.authoring/native-validator-precompile_seam_validation.json'],dependencies:[],
    file:validator,args:['precompile_seam_validation',seamReceipt,path.join(sourceRoot,'features/visual-composition/validate-phase02-precompile-boundary.mjs'),workspace]},
  {id:'character',reads:['production.json','.authoring/visual-intent.json'],writes:[],dependencies:[],
    file:path.join(sourceRoot,'features/visual-composition/validate-character-intent-preflight.mjs'),args:[workspace]}
 ];
 if(fresh){
  tasks.push(
   {id:'progressive',reads:['.authoring/visual-intent.json','production.json','design.md'],writes:['.authoring/native-validator-phase02_progressive_preflight.json'],dependencies:[],
    file:validator,args:['phase02_progressive_preflight',progressiveReceipt,path.join(sourceRoot,'features/visual-composition/validate-phase02-progressive-preflight.mjs'),workspace]},
   {id:'experience',reads:['.authoring/visual-intent.json'],writes:['.authoring/native-validator-scene_experience_review.json','.authoring/scene-experience-review.json'],dependencies:[],
    file:validator,args:['scene_experience_review',experienceReceipt,path.join(sourceRoot,'features/visual-composition/validate-scene-experience.mjs'),workspace,'--write']}
  );
 }
 if(artDirectionRequired)tasks.push({id:'art',reads:['production.json','.authoring/scene-art-direction.json'],writes:['.authoring/native-validator-phase02_art_direction_validation.json'],dependencies:[],file:validator,args:['phase02_art_direction_validation',artReceipt,path.join(sourceRoot,'features/visual-composition/validate-phase02-art-direction.mjs'),workspace]});
 const result=await runSafeParallel(tasks,{maxConcurrency,execute:async t=>runNativeCommand([t.file,...t.args])});
 const checks=Object.fromEntries(result.results.map(x=>[x.id,x.status==='PASS'?x.value:{status:'FAIL',reason:x.error}]));
 // A child may exit nonzero without rejecting. Validate its native exit status.
 const issues=Object.entries(checks).filter(([,v])=>v.status!=='PASS').flatMap(([id,v])=>[{id,code:'PHASE02_ENTRY_CHECK_FAILED',step:id,exit_code:v.exit_code??1,stderr:v.stderr??v.reason??''},...(v.issues??[]).map(issue=>({...issue,step:id}))]);
 return {status:issues.length?'BLOCKED':'PASS',wall_ms:+(performance.now()-fastStarted).toFixed(2),serial_equivalent_native_ms:+Object.values(checks).reduce((n,x)=>n+(x.elapsed_ms??0),0).toFixed(2),checks,issues,plan:result.plan,receipts:{seam:seamReceipt,...(fresh?{progressive:progressiveReceipt,experience:experienceReceipt}:{}),...(artDirectionRequired?{art:artReceipt}:{})},not_an_approval:true};
}
