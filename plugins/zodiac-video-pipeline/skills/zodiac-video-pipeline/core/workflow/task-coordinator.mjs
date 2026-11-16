let createMachine=null,getInitialSnapshot=null;
try{({createMachine,getInitialSnapshot}=await import('xstate'));}catch{}
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {conditionApplies} from '../policy/resolve-capability-route.mjs';

const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const done=s=>['PASS','SKIPPED_REUSED'].includes(s);
const genuine=r=>r?.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof.ref==='string'&&r.proof.ref.trim()&&!r.proof.ref.includes('<');
const kinds=['COMPLETE','RESOLVE_BLOCKER','WAIT_FOR_GENUINE_USER_REVIEW','RUN_PHASE_GATE_PER_ROUTER','ACTIVATE_PHASE','DESIGN_VISUAL','REPROJECT_VISUAL_INTENT','REPAIR_VISUAL_INTENT','AUTHOR_VISUAL_ASSETS','DESIGN_SCENE_BEATS','AUTHOR_STEP','VALIDATE_AND_COMMIT_STEP'];
// Recomputed from authoritative persisted state; no second persisted state machine.
const machineSpec={id:'zodiac-task-router',context:({input})=>input,initial:'select',states:{
 select:{always:[
  {guard:({context:c})=>c.complete,target:'COMPLETE'},
  {guard:({context:c})=>c.blocked,target:'RESOLVE_BLOCKER'},
  {guard:({context:c})=>c.review&&!c.approved,target:'WAIT_FOR_GENUINE_USER_REVIEW'},
  {guard:({context:c})=>c.review||!c.step,target:'RUN_PHASE_GATE_PER_ROUTER'},
  {guard:({context:c})=>c.locked,target:'ACTIVATE_PHASE'},
  {guard:({context:c})=>c.visual&&!c.intent,target:'DESIGN_VISUAL'},
  {guard:({context:c})=>c.reprojectVisual,target:'REPROJECT_VISUAL_INTENT'},
  {guard:({context:c})=>c.visualRepair,target:'REPAIR_VISUAL_INTENT'},
  {guard:({context:c})=>c.assetRepair,target:'AUTHOR_VISUAL_ASSETS'},
  {guard:({context:c})=>c.thinScene,target:'DESIGN_SCENE_BEATS'},
  {guard:({context:c})=>c.needsAuthoring,target:'AUTHOR_STEP'},
  {target:'VALIDATE_AND_COMMIT_STEP'}
 ]},...Object.fromEntries(kinds.map(k=>[k,{type:'final'}]))
}};
export const taskMachine=createMachine?createMachine(machineSpec):machineSpec;
const fallbackTaskValue=c=>c.complete?'COMPLETE':c.blocked?'RESOLVE_BLOCKER':c.review&&!c.approved?'WAIT_FOR_GENUINE_USER_REVIEW':c.review||!c.step?'RUN_PHASE_GATE_PER_ROUTER':c.locked?'ACTIVATE_PHASE':c.visual&&!c.intent?'DESIGN_VISUAL':c.reprojectVisual?'REPROJECT_VISUAL_INTENT':c.visualRepair?'REPAIR_VISUAL_INTENT':c.assetRepair?'AUTHOR_VISUAL_ASSETS':c.thinScene?'DESIGN_SCENE_BEATS':c.needsAuthoring?'AUTHOR_STEP':'VALIDATE_AND_COMMIT_STEP';

const needsSceneBeats=scene=>{
 const beats=scene.director_beats??[],covered=new Set(beats.flatMap(b=>b.event_ids??[]));
 return !beats.length||(scene.events??[]).some(event=>!covered.has(event.id));
};
const repairAssetPaths=issues=>[...new Set((issues??[]).flatMap(issue=>{
 const rel=issue?.code==='AUTHORED_SVG_READ'?issue.path:issue?.code==='PHASE02_BACKGROUND_ASSET_MISSING_OR_UNSAFE'?issue.asset:null;
 if(typeof rel!=='string')return [];
 const normalized=rel.replaceAll('\\','/');
 if(!normalized.startsWith('assets/')||normalized.split('/').includes('..')||!normalized.toLowerCase().endsWith('.svg'))return [];
 return [normalized];
}))].sort();
const needsVisualIntentReprojection=issues=>(issues??[]).some(issue=>issue?.code==='NARRATION_PERFORMANCE_INVALID'&&/\bSOURCE_PERFORMANCE_DRIFT\b/u.test(String(issue.detail??issue.error??'')));
const visualIntentRepairOwner=issues=>{
 if((issues??[]).some(issue=>issue?.code==='EPISODE_HANDOFF_INVALID'&&/\bCAST_SCOPE\b/u.test(String(issue.detail??issue.error??''))))return 'visual_intent.episode_cast_plan';
 if((issues??[]).some(issue=>issue?.code==='COMPOSITION_NARRATIVE_REASON_MISSING'))return 'visual_intent.scenes.narrative_intent';
 if((issues??[]).some(issue=>issue?.code==='PHASE02_ENTRY_CHECK_FAILED'&&issue?.step==='scene_direction'&&/bad continuity_relation/u.test(String(issue.stderr??issue.detail??''))))return 'visual_intent.scenes.grammar.continuity_relation';
 if((issues??[]).some(issue=>issue?.code==='PHASE02_ENTRY_CHECK_FAILED'&&issue?.step==='scene_direction'&&/(?:shot streak|same shot\/focus\/placement streak|need >=\d+ shot profiles)/u.test(String(issue.stderr??issue.detail??''))))return 'visual_intent.scenes.grammar.framing';
 return null;
};
export function resolveNextTask({state,manifests,visualIntent=null,narration='',outputsReady=false,creativeDirection=null,episodeScope=null,storySpine=null,repairIssues=[]}={}){
 if(!state||!Array.isArray(manifests)||!manifests.length)throw Error('TASK_STATE_REQUIRED');
 const phase=manifests.find(m=>!done(state.phases?.[m.id]?.status))??manifests.at(-1);
 const ps=state.phases?.[phase.id];if(!ps)throw Error('TASK_PHASE_MISSING '+phase.id);
 const step=phase.steps.find(s=>!done(ps.steps?.[s.id]?.status));
 const visual=phase.id==='02-visual-production'&&step?.id==='visual_compile';
 const thinScene=visual?(visualIntent?.scenes??[]).find(needsSceneBeats):null,assetRepairPaths=visual&&visualIntent?repairAssetPaths(repairIssues):[],reprojectVisual=visual&&visualIntent&&needsVisualIntentReprojection(repairIssues),visualRepairOwner=visual&&visualIntent?visualIntentRepairOwner(repairIssues):null;
 const facts={complete:manifests.every(m=>done(state.phases?.[m.id]?.status)),blocked:ps.status==='BLOCKED'||ps.steps?.[step?.id]?.status==='BLOCKED',review:ps.status==='IN_REVIEW',approved:state.review_receipts?.some(r=>r.phase_id===phase.id&&genuine(r)),locked:ps.status==='LOCKED',visual,intent:visualIntent,reprojectVisual,visualRepair:Boolean(visualRepairOwner),assetRepair:assetRepairPaths.length>0,thinScene,step:step?.id,needsAuthoring:!visual&&!outputsReady&&(step?.authoring_sources??[]).length>0};
 const kind=createMachine&&getInitialSnapshot?getInitialSnapshot(taskMachine,facts).value:fallbackTaskValue(facts);
 const applicable=x=>conditionApplies(x.when,{run_mode:state.run_mode,flags:state.flags??{}});
 const caps=[...(step?.required_capabilities??[]),...(step?.conditional_capabilities??[])].filter(applicable);
 const authoring=step?.authoring_sources??[];
 const writable=['AUTHOR_STEP','DESIGN_VISUAL','REPROJECT_VISUAL_INTENT','REPAIR_VISUAL_INTENT','DESIGN_SCENE_BEATS','AUTHOR_VISUAL_ASSETS'].includes(kind);
 const allowedWrites=kind==='AUTHOR_VISUAL_ASSETS'?assetRepairPaths:['REPROJECT_VISUAL_INTENT','REPAIR_VISUAL_INTENT'].includes(kind)?['.authoring/visual-intent.json']:writable?authoring:[];
 const task={format:'zodiac-next-task@1',engine:createMachine?'xstate':'builtin-fsm',kind,phase:phase.id,step:step?.id??null,role:ps.steps?.[step?.id]?.context_role??'draft',allowed_writes:allowedWrites,
  required_outputs:[...(step?.required_outputs??[]),...(step?.conditional_outputs??[]).filter(applicable).map(x=>x.name)],
  required_gates:[...(step?.gate_checks??[]),...(step?.conditional_gate_checks??[]).filter(applicable).map(x=>x.name)],
  required_capabilities:caps.map(c=>({id:c.id,kind:c.kind,stage:c.stage,tool_locator:c.tool_locator??null,guidance_uri:c.guidance_uri??null,required_arg_suffixes:c.required_arg_suffixes??[]})),
  completion_rule:'Run required native checks, verify current source/evidence and commit through the owning step. This task never grants PASS or approval.',not_an_approval:true};
 if(kind==='REPROJECT_VISUAL_INTENT')Object.assign(task,{repair_owner:'visual_intent.projections',constraints:['Keep the canonical Visual Intent byte-for-byte equivalent in meaning; this task exists only to regenerate derived projections against the current approved Narrative Plan.','Run write-phase02-authoring with --revise; do not edit production.json or performance_context directly.','Preserve approved narration, Narrative Plan, episode scope and all authored scene semantics.']});
 if(kind==='REPAIR_VISUAL_INTENT')Object.assign(task,{repair_owner:visualRepairOwner,constraints:visualRepairOwner==='visual_intent.scenes.narrative_intent'?['Repair only narrative_intent reason/voice_anchor fields on affected Visual Intent scene entities so each anchor exists in that scene voice.','Do not edit generated scene-art-direction.json or production.json directly; regenerate projections through write-phase02-authoring.','Preserve approved narration, Narrative Plan, episode scope, scene meaning and entity identity.']:visualRepairOwner==='visual_intent.scenes.grammar.continuity_relation'?['Repair only invalid scene grammar.continuity_relation values using the canonical scene-direction vocabulary.','Do not edit generated production.json or scene-direction projections directly; regenerate them through write-phase02-authoring.','Preserve approved narration, Narrative Plan, scene semantics, entities and events.']:visualRepairOwner==='visual_intent.scenes.grammar.framing'?['Repair only frame_id/mechanic_id/bindings needed to resolve canonical shot repetition while preserving each scene semantic goal.','Choose framing by story function rather than random variety; preserve entities, events, narration and approved performance beats.','Regenerate production/scene-direction projections only through write-phase02-authoring --revise.']:['Repair only the canonical Visual Intent source field responsible for the current CAST_SCOPE failure.','Do not edit generated episode-cast-plan.json directly; regenerate projections through write-phase02-authoring.','Preserve approved narration, Narrative Plan and episode scope.']});
 if(kind==='AUTHOR_VISUAL_ASSETS')Object.assign(task,{asset_paths:assetRepairPaths,constraints:['Write only the exact missing SVG paths reported by the current Phase-2 execution receipt.','Preserve approved narration, Narrative Plan, Visual Intent and generated projections; asset repair cannot change creative meaning.','After materializing the missing SVGs, rerun Phase-2 preflight before any commit or review.']});
 if(thinScene&&kind==='DESIGN_SCENE_BEATS'){
  const i=visualIntent.scenes.indexOf(thinScene),actors=new Set((thinScene.entities??[]).filter(e=>e.kind==='character').map(e=>e.id));
  const neighbor=s=>s?{id:s.id,semantic_goal:s.semantic_goal,director_beats:s.director_beats??[]}:null;
  const refs=new Set((thinScene.entities??[]).flatMap(e=>Object.values(e.states??{}).map(s=>s.asset).filter(Boolean)));
  const range=thinScene.narration_range;
  const rawVoice=Buffer.from(narration);
  if(range&&narration&&(!Array.isArray(range)||range.length!==2||!range.every(Number.isInteger)||range[0]<0||range[1]<=range[0]||range[1]>rawVoice.length))throw Error('TASK_NARRATION_RANGE_INVALID '+thinScene.id);
  const voice=range&&narration?rawVoice.subarray(range[0],range[1]).toString('utf8'):thinScene.voice??null;
  const related=[...new Set([...(thinScene.experience_profile?.depends_on_scene_ids??[]),...(thinScene.experience_profile?.callback_scene_ids??[])])];
  if(related.some(id=>!visualIntent.scenes.some(s=>s.id===id)))throw Error('TASK_SCENE_DEPENDENCY_MISSING');
  Object.assign(task,{scene_id:thinScene.id,allowed_writes:['.authoring/visual-intent.json'],context:{scene:thinScene,voice,voice_ref:{path:'narration.txt',range},creative_direction:creativeDirection,episode_scope:episodeScope,story_spine:storySpine,cast:(visualIntent.cast??[]).filter(c=>actors.has(c.entity_id)),assets:Object.fromEntries(Object.entries(visualIntent.assets??{}).filter(([id])=>refs.has(id))),video:visualIntent.video,visual_system:visualIntent.visual_system,previous_scene:neighbor(visualIntent.scenes[i-1]),next_scene:neighbor(visualIntent.scenes[i+1]),related_scenes:visualIntent.scenes.filter(s=>related.includes(s.id)).map(neighbor)},
   constraints:['Keep every existing beat/entity/event; cover every authored event in director event_ids. Do not add decorative beats to meet a count.','Change only this scene inside Visual Intent; preserve cast/style, all other scenes and approved narration.','Use as many beats as the narrated story changes require. Native narration coverage, director semantics and grounded review remain required.']});
 }
 return task;
}

export function buildWorkflowGraph(manifests,state){
 const nodes=[],edges=[],seen=new Set();
 const add=(id,kind,label,extra={})=>{if(!seen.has(id)){seen.add(id);nodes.push({id,kind,label,...extra});}return id;};
 for(const [pi,m] of manifests.entries()){
  const phase=add(m.id,'phase',m.title??m.id);
  if(pi)edges.push({from:phase,to:manifests[pi-1].id,kind:'depends_on'});
  for(const [i,s] of m.steps.entries()){
   const step=add(m.id+'/'+s.id,'step',s.title??s.id,{phase:m.id});edges.push({from:phase,to:step,kind:'contains'});
   if(i)edges.push({from:step,to:m.id+'/'+m.steps[i-1].id,kind:'depends_on'});
   for(const c of [...s.required_capabilities??[],...s.conditional_capabilities??[]].filter(c=>conditionApplies(c.when,{run_mode:state.run_mode,flags:state.flags??{}}))){
    const id=add(step+'/'+c.id,'capability',c.id,{phase:m.id,step:s.id});edges.push({from:step,to:id,kind:'requires'});
    for(const source of [c.tool_locator,c.guidance_uri].filter(Boolean)){const file=add('source:'+source,'source',source);edges.push({from:id,to:file,kind:'uses_source'});}
   }
  }
 }
 return {format:'zodiac-workflow-graph@1',nodes,edges,not_an_approval:true};
}
export function queryWorkflowGraph(graph,query,{limit=8}={}){
 if(typeof query!=='string'||!query.trim())throw Error('GRAPH_QUERY_REQUIRED');
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('GRAPH_LIMIT_INVALID');
 const q=query.trim().toLowerCase(),matches=graph.nodes.filter(n=>(n.id+' '+n.label).toLowerCase().includes(q)).slice(0,limit),ids=new Set(matches.map(n=>n.id));
 const edges=graph.edges.filter(e=>ids.has(e.from)||ids.has(e.to));for(const e of edges){ids.add(e.from);ids.add(e.to);}
 return {format:'zodiac-workflow-query@1',query,matches,nodes:graph.nodes.filter(n=>ids.has(n.id)),edges,not_an_approval:true};
}

export async function bindTaskRevision(task,{workspace,stateBytes,manifests,contextManifest=[]}){
 const source_hashes={};
 for(const rel of ['narration.txt','.authoring/narration.txt','.authoring/narrative-plan.json','narrative-plan.json','.authoring/voice-profile.json','.authoring/narrative-design.json','.authoring/voice-fidelity-review.json','.authoring/phase3-writer-brief.json','.authoring/episode-scope.json','.authoring/visual-intent.json','design.md','production.json']){
  const file=path.resolve(workspace,rel);try{const real=await realpath(file);if(!real.startsWith(await realpath(workspace)+path.sep))throw Error('TASK_SOURCE_UNSAFE '+rel);source_hashes[rel]=hash(await readFile(real));}catch(e){if(e.code!=='ENOENT')throw e;source_hashes[rel]=null;}
 }
 const contract_sha256=hash({manifests,contextManifest,router:hash(await readFile(new URL('./task-coordinator.mjs',import.meta.url)))});
 const state_sha256=hash(stateBytes),workspace_sha256=hash(await realpath(workspace)),id=hash({task,workspace_sha256,state_sha256,source_hashes,contract_sha256});
 return {...task,id,workspace_sha256,state_sha256,source_hashes,contract_sha256};
}
export async function assertTaskWrite(workspace,taskId,rel,{visualIntent=null}={}){
 const {resumeBrief}=await import('../../orchestration/resume-brief.mjs');
 const task=(await resumeBrief(workspace)).next_task;
 if(!taskId||taskId!==task.id)throw Error('TASK_REVISION_CHANGED');
 const normalized=String(rel).replaceAll('\\','/'),root=await realpath(workspace),target=path.resolve(root,normalized);
 if(path.isAbsolute(normalized)||normalized.split('/').includes('..')||!target.startsWith(root+path.sep)||!task.allowed_writes.some(p=>p===normalized||p.endsWith('/**')&&normalized.startsWith(p.slice(0,-2))))throw Error('TASK_WRITE_FORBIDDEN '+rel);
 let parent=target;while(true){try{const resolved=await realpath(parent);if(resolved!==root&&!resolved.startsWith(root+path.sep))throw Error('TASK_WRITE_UNSAFE');break;}catch(e){if(e.code!=='ENOENT')throw e;parent=path.dirname(parent);}}
 if(task.scene_id&&visualIntent){
  const current=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'),'utf8'));
  const omitScene=v=>({...v,scenes:v.scenes.filter(s=>s.id!==task.scene_id)});
  if(hash(omitScene(current))!==hash(omitScene(visualIntent))||visualIntent.scenes.filter(s=>s.id===task.scene_id).length!==1||current.scenes.findIndex(s=>s.id===task.scene_id)!==visualIntent.scenes.findIndex(s=>s.id===task.scene_id))throw Error('TASK_SCENE_SCOPE_VIOLATION');
 }
 return task;
}
