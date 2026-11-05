#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneGraph,assessSceneRevision} from './scene-graph.mjs';
import {reviewSceneContinuity} from './scene-continuity.mjs';
import {planSceneBatches} from './scene-scheduler.mjs';
import {reviewSceneExperience} from '../visual-composition/validate-scene-experience.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const safe=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
export function planSceneCheckpoints(intent,{previous=null,catalogFingerprint='',compilerFingerprint=''}={}){
 const graph=buildSceneGraph(intent,{catalogFingerprint,compilerFingerprint});
 const revision=assessSceneRevision(previous?.graph,graph);
 const experience=reviewSceneExperience(intent);
 const continuity=reviewSceneContinuity(intent,{graph});
 const schedule=graph.status==='PASS'?planSceneBatches(graph):null;
 const perScene=new Map(experience.scenes.map(s=>[s.scene_id,s]));
 const nodes=graph.nodes.map(n=>({scene_id:n.scene_id,source_fingerprint:n.source_fingerprint,dependencies:n.depends_on,story_focus:perScene.get(n.scene_id)?.criteria?.story_focus_alignment?.result??'REVIEW',qc:perScene.get(n.scene_id)?.decision??'REVIEW',issues:perScene.get(n.scene_id)?.issues??[],stage:perScene.get(n.scene_id)?.decision==='PASS'?'AUTHORING_QC_PASS':'DRAFT',native_compiled:false,preview_verified:false}));
 const status=graph.status==='PASS'&&continuity.decision==='PASS'&&experience.decision==='PASS'?'PASS':'BLOCKED';
 return {format:'zodiac-scene-checkpoints@1',status,graph,revision,schedule,continuity,nodes,not_an_approval:true,native_review_required:true};
}
export async function writeSceneCheckpoints(root,{catalogFingerprint='',compilerFingerprint=''}={}){
 const dir=path.join(root,'.authoring'),intent=await safe(path.join(dir,'visual-intent.json'));
 if(!intent)throw Error('VISUAL_INTENT_REQUIRED');
 const dest=path.join(dir,'scene-checkpoints.json'),previous=await safe(dest);
 const report=planSceneCheckpoints(intent,{previous,catalogFingerprint,compilerFingerprint});
 await mkdir(dir,{recursive:true});
 const data=JSON.stringify(report,null,2)+'\n',tmp=dest+'.'+process.pid+'.tmp';await writeFile(tmp,data);await rename(tmp,dest);
 return {status:report.status,scene_count:report.nodes.length,rebuild:report.revision.rebuild,revalidate:report.revision.revalidate,reuse:report.revision.reuse,issues:[...report.graph.issues,...report.continuity.issues,...report.nodes.flatMap(n=>n.issues.map(x=>({scene_id:n.scene_id,...x})))],receipt:dest,sha256:sha(data),not_an_approval:true};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node scene-checkpoints.mjs <workspace>');process.exit(2);}else try{const r=await writeSceneCheckpoints(path.resolve(root));console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;}catch(e){console.error('SCENE_CHECKPOINT_BLOCKED '+e.message);process.exitCode=2;}}
