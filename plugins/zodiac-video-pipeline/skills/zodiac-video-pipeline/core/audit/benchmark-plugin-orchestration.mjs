#!/usr/bin/env node
// Real installed SDKs and real plugin source; scene/context cases are synthetic fixtures.
import {readFile,readdir,stat,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {getInitialSnapshot} from 'xstate';
import {taskMachine,resolveNextTask,buildWorkflowGraph,queryWorkflowGraph} from '../workflow/task-coordinator.mjs';
import {buildCodeIndex,collectPluginCodeSources} from '../workflow/runtime-codegraph.mjs';
import {resumeBrief} from '../../orchestration/resume-brief.mjs';
import {compileStepCapsule,deliverContextBlocks,encodeContextData} from '../performance/compile-step-capsule.mjs';
import {signatureFiles} from '../../phases/phase02/phase02-selected-dependencies.mjs';
import {createHash} from 'node:crypto';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const round=n=>+n.toFixed(4);
function sample(fn,n){const times=[];for(let i=0;i<n;i++){const start=performance.now();fn();times.push(performance.now()-start);}return {iterations:n,median_ms:round(median(times)),p95_ms:round([...times].sort((a,b)=>a-b)[Math.floor(n*.95)])};}
async function directoryBytes(root){let bytes=0;for(const e of await readdir(root,{withFileTypes:true})){const p=path.join(root,e.name);if(e.isDirectory())bytes+=await directoryBytes(p);else if(e.isFile())bytes+=(await stat(p)).size;}return bytes;}
export async function benchmarkPluginOrchestration(){
 const manifests=await Promise.all(['01-content','02-visual-production','03-handoff'].map(async p=>JSON.parse(await readFile(path.join(skill,'orchestration/phases',p+'.json'),'utf8'))));
 const state=JSON.parse(await readFile(path.join(skill,'orchestration/pipeline-state.template.json'),'utf8'));
 const freshState=structuredClone(state);
 state.phases['01-content'].status='PASS';state.current_phase='02-visual-production';state.phases[state.current_phase].status='READY';state.phases[state.current_phase].steps.visual_compile.status='READY';
 const intent={format:'zodiac-visual-intent@1',cast:[],assets:{},video:{width:1080,height:1920},visual_system:{style:'locked'},scenes:Array.from({length:12},(_,i)=>({id:'s'+i,semantic_goal:'A distinct story decision in scene '+i,narration_range:[0,60],entities:[{id:'actor',kind:'character',states:{neutral:{asset:'actor-svg'}}}],events:[],director_beats:Array.from({length:i===5?3:5},(_,b)=>({id:'b'+b,voice_anchor:'Exact voice anchor '+b,action:'Meaningful action '+b,reaction:'Grounded response '+b,semantic_purpose:'A different interpretation '+b}))}))};
 const task=resolveNextTask({state,manifests,visualIntent:intent,narration:'Exact approved narration. '.repeat(20)});
 assert.equal(task.scene_id,'s5');assert.deepEqual(task.context.scene,intent.scenes[5]);
 const fullBytes=Buffer.byteLength(JSON.stringify(intent)),taskBytes=Buffer.byteLength(JSON.stringify(task.context));
 const graphStart=performance.now(),workflow=buildWorkflowGraph(manifests,state),graphBuild=performance.now()-graphStart;
 const facts={complete:false,blocked:false,review:false,approved:false,locked:false,visual:true,intent:true,thinScene:true,step:'visual_compile',needsAuthoring:false};
 const baseline=c=>c.complete?'COMPLETE':c.blocked?'RESOLVE_BLOCKER':c.review&&!c.approved?'WAIT_FOR_GENUINE_USER_REVIEW':c.review||!c.step?'RUN_PHASE_GATE_PER_ROUTER':c.locked?'ACTIVATE_PHASE':c.visual&&!c.intent?'DESIGN_VISUAL':c.thinScene?'DESIGN_SCENE_BEATS':c.needsAuthoring?'AUTHOR_STEP':'VALIDATE_AND_COMMIT_STEP';
 const cases=[facts,...['complete','blocked','review','locked','needsAuthoring'].map(k=>({...facts,thinScene:false,[k]:true}))];
 for(const c of cases)assert.equal(getInitialSnapshot(taskMachine,c).value,baseline(c));
 const codeFiles=await collectPluginCodeSources(manifests),start=performance.now();
 let index=await buildCodeIndex({files:codeFiles});const indexOpenMs=performance.now()-start;
 const indexInfo={files:index.file_count,source_bytes:index.source_bytes,index_cache_hit:index.index_result===null,open_or_build_ms:round(indexOpenMs),stats:index.stats};
 const queries=[];
 try{
  for(const query of ['resolveNextTask','planStepContext','createRepairPlan']){
   const spans=[];let result;
   for(let i=0;i<8;i++){const t=performance.now();result=await index.query(query);spans.push(performance.now()-t);}
   assert.ok(result.symbols.some(s=>s.name===query),'CodeGraph failed to retrieve '+query);
   const scanStart=performance.now(),matched=[];
   for(const file of codeFiles){const raw=await readFile(path.join(skill,file),'utf8');if(raw.includes(query))matched.push({file,bytes:Buffer.byteLength(raw)});}
   queries.push({query,median_query_ms:round(median(spans)),symbols:result.symbols.length,edges:result.edges.length,returned_source_bytes:result.source_bytes,omitted_symbols:result.omitted_symbols,baseline_full_file_scan_ms:round(performance.now()-scanStart),baseline_matching_file_bytes:matched.reduce((n,r)=>n+r.bytes,0)});
  }
 }finally{index.close();}
 const contextDelivery=[];let prior=null;
 for(const manifest of manifests)for(const step of manifest.steps){
  const started=performance.now(),capsule=await compileStepCapsule({phase:manifest.id,step:step.id,flags:freshState.flags}),blocks=capsule.blocks.map(b=>({key:b.path,content:b.content}));
  const delivered=await deliverContextBlocks(blocks,{workspace:'synthetic-benchmark-only',policy:capsule.policy_sha256,prior,reuseId:prior?.id,tokenBudget:100000});
  const budgeted=await deliverContextBlocks(blocks,{workspace:'synthetic-benchmark-only',policy:capsule.policy_sha256,tokenBudget:16000});
  assert.ok(!delivered.pending_references.length);
  contextDelivery.push({phase:manifest.id,step:step.id,full_tokens:delivered.budget.full_transport_tokens_before_accounting,delta_tokens:delivered.budget.transport_tokens_before_accounting,reused_blocks:delivered.blocks.filter(b=>b.delivery==='CALLER_HELD_IDENTICAL').length,pending_at_16k:budgeted.pending_references.length,elapsed_ms:round(performance.now()-started)});prior=delivered;
 }
 const encodedScene=await encodeContextData(task.context);
 const hashFiles=codeFiles.slice(0,64).map(p=>path.join(skill,p)),signatureTimes={sequential:[],bounded_parallel:[]};
 const digest=b=>createHash('sha256').update(b).digest('hex');
 for(let i=0;i<5;i++){
  let started=performance.now();const parts=[];for(const p of [...hashFiles].sort()){await stat(p);parts.push([p,digest(await readFile(p))]);}const expected=digest(JSON.stringify(parts));signatureTimes.sequential.push(performance.now()-started);
  started=performance.now();assert.equal(await signatureFiles(hashFiles),expected);signatureTimes.bounded_parallel.push(performance.now()-started);
 }
 const temporary=await mkdtemp(path.join(tmpdir(),'z-orchestration-benchmark-')),resumeTimes=[],contextTimes=[];
 try{await mkdir(path.join(temporary,'.authoring'));await writeFile(path.join(temporary,'.authoring/pipeline-state.json'),JSON.stringify(freshState));
  for(let i=0;i<10;i++){const started=performance.now(),brief=await resumeBrief(temporary);assert.equal(brief.next_task.kind,'AUTHOR_STEP');resumeTimes.push(performance.now()-started);}
  for(let i=0;i<5;i++){const started=performance.now(),capsule=await resumeBrief(temporary,{context:true});assert.equal(capsule.format,'zodiac-task-context@1');contextTimes.push(performance.now()-started);}
 }finally{await rm(temporary,{recursive:true,force:true});}
 return {format:'zodiac-orchestration-benchmark@1',node:process.version,platform:process.platform+'-'+process.arch,dependencies:{xstate:'5.33.3',codegraph:'1.6.2'},
  scope:'Local real SDK/source benchmark; synthetic 12-scene input, no LLM/API/render calls. Full-file scan is a diagnostic baseline, not equivalent to graph retrieval.',
  xstate_guard_dispatch:sample(()=>getInitialSnapshot(taskMachine,facts),1000),branch_guard_dispatch_baseline:sample(()=>baseline(facts),1000),full_task_resolution:sample(()=>resolveNextTask({state,manifests,visualIntent:intent}),200),resume_brief_with_io:{iterations:10,median_ms:round(median(resumeTimes)),includes:'state validation, reference/source hashing, filesystem reads and revision-bound task; warm in-process API'},
  scene_context:{fixture_scenes:12,full_intent_bytes:fullBytes,selected_context_bytes:taskBytes,reduction_percent:round((1-taskBytes/fullBytes)*100),all_selected_scene_fields_preserved:true},
  context_delivery:{scope:'Real required references in manifest step order; explicit immediate-prior acknowledgement, all blocks delivered with 100k diagnostic budget. Token counts exclude accounting fields and host history. No live phase approvals or LLM calls.',encoding:'o200k_base',steps:contextDelivery,scene_serialization:{selected:encodedScene.format,json_tokens:encodedScene.json_tokens,selected_tokens:encodedScene.tokens,lossless:true},resume_context_warm_median_ms:round(median(contextTimes))},
  native_signature_io:{files:hashFiles.length,iterations:5,sequential_median_ms:round(median(signatureTimes.sequential)),bounded_parallel_median_ms:round(median(signatureTimes.bounded_parallel)),identical_hashes:true},
  workflow_graph:{nodes:workflow.nodes.length,edges:workflow.edges.length,build_ms:round(graphBuild),lookup:sample(()=>queryWorkflowGraph(workflow,'character_assembly'),200)},
  codegraph:{...indexInfo,queries},installed_dependency_bytes:await directoryBytes(path.resolve(skill,'../../node_modules')),not_a_production_acceptance:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await benchmarkPluginOrchestration(),null,2));}catch(e){console.error(e);process.exitCode=1;}
}
