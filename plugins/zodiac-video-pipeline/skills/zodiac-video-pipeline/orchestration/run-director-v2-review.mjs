#!/usr/bin/env node
// Native Phase-02 post-compile Director QC. Does not approve Visual Review.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './director-v2-core.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const workspace=process.argv[2];
if(!workspace){console.error('Usage: node run-director-v2-review.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace);
const stages=[
 {id:'director_v2',script:'director-v2-gate.mjs',args:[root,'--write']},
 {id:'scene_direction_v2',script:'../references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs',args:[root],validator:true},
 {id:'environment_frame_v1',script:'../references/asset-library-v4/environments/validate-environment-frame.mjs',args:[root],validator:true},
 {id:'visual_quality_v2',script:'validate-visual-quality.mjs',args:[root],validator:true},
 {id:'authoring_scene_events_v2',script:'validate-authoring-scene-events.mjs',args:[root],validator:true},
 {id:'story_choreography_v2',script:'validate-story-beat-choreography.mjs',args:[root],validator:true},
 {id:'native_preview_build_v2',script:'build-native-preview-pairs.mjs',args:[root]},
 {id:'native_preview_validate_v2',script:'validate-native-preview-pairs.mjs',args:[root],validator:true}
];
// Only opt-in/required authoring runs are checked; legacy runs are labelled
// unsupported rather than receiving an invented Story Object PASS.
const objectFiles=['.authoring/story-object-plan.json','.authoring/story-object-required.json'];
let objectEnabled=(await Promise.all(objectFiles.map(rel=>access(path.join(root,rel)).then(()=>true).catch(()=>false)))).some(Boolean);
try { const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));
  const v=/^(\d+)\.(\d+)\.(\d+)/.exec(String(state.plugin_version??''));
  if(v && (Number(v[1])>2||(Number(v[1])===2&&(Number(v[2])>4||(Number(v[2])===4&&Number(v[3])>=44)))))stages.splice(1,0,{id:'scene_composition_v1',script:'phase02-composition.mjs',args:[root],validator:true});
  if(state.flags?.story_object_required===true || (v && Number(v[1])===2 && Number(v[2])===4 && Number(v[3])>=4 && state.run_mode==='fresh'))objectEnabled=true;
} catch(e) { if(e?.code!=='ENOENT')throw e; }
if(objectEnabled){
 const before=stages.findIndex(x=>x.id==='native_preview_build_v2');
 stages.splice(before,0,{id:'story_object_v1',script:'validate-story-object.mjs',args:[root,'--write'],validator:true},
  {id:'story_object_composition_v2',script:'validate-story-object-composition.mjs',args:[root,'--write'],validator:true}
 );
}
let status='READY_FOR_HUMAN_VISUAL_REVIEW';const rows=[];
const productionFile=path.join(root,'production.json');
// Full source rollback if any post-director check fails: do not leave partial
// geometry changes on the authoring workspace after BLOCKED QC.
const originalProduction=await readFile(productionFile);
const originalHash=sha256(originalProduction);
for(const stage of stages){
 const absolute=path.resolve(here,stage.script);
 const receiptPath=path.join(root,'.authoring',`director-v2-${stage.id}.receipt.json`);
 const cmd=stage.validator?path.resolve(here,'run-validator-with-receipt.mjs'):absolute;
 const args=stage.validator?[stage.id,receiptPath,absolute,...stage.args]:stage.args;
 const result=spawnSync(process.execPath,[cmd,...args],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:180000});
 const exit_code=result.status??1;
 rows.push({stage:stage.id,exit_code,stdout:(result.stdout||'').slice(-2500),stderr:(result.stderr||result.error?.message||'').slice(-2500),receipt:stage.validator?receiptPath:null});
 if(exit_code!==0){status='BLOCKED';break;}
}
let signature=null;
if(status==='BLOCKED'){
  const current=await readFile(productionFile);
  if(sha256(current)!==originalHash){
    const rollback=productionFile+'.director-review-rollback';
    await writeFile(rollback,originalProduction);await rename(rollback,productionFile);
  }
  // Gate receipt alone must never indicate an accepted review after later QC failed.
  const gateReceipt=path.join(root,'.authoring/director-v2-gate-receipt.json');
  try{
    const gate=JSON.parse(await readFile(gateReceipt,'utf8'));
    gate.status='BLOCKED';gate.review_rolled_back=true;
    gate.issues=[...(gate.issues??[]),{code:'DIRECTOR_REVIEW_DOWNSTREAM_BLOCKED',scope:'review',detail:rows.find(r=>r.exit_code!==0)?.stage??'unknown'}];
    await writeFile(gateReceipt,JSON.stringify(gate,null,2)+'\n');
  }catch{}
}
try{signature=sha256(await readFile(productionFile));}catch{}
const output={format:'zodiac-director-v2-review@1',status,source_hash:signature,original_source_hash:originalHash,stages:rows,explicit_user_approval_required:true,runner_temporal_qa_required:true};
await mkdir(path.join(root,'.authoring'),{recursive:true});
const report=path.join(root,'.authoring/director-v2-review-receipt.json');await writeFile(report,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status,stages:rows.map(r=>({id:r.stage,exit_code:r.exit_code})),receipt:report},null,2));
if(status==='BLOCKED')process.exitCode=1;
