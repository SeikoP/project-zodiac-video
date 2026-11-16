import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const api=await import('../../core/workflow/task-coordinator.mjs').catch(()=>({}));
const root=new URL('../../',import.meta.url);
const manifests=await Promise.all(['01-content','02-visual-production','03-handoff'].map(async id=>JSON.parse(await readFile(new URL('orchestration/phases/'+id+'.json',root),'utf8'))));
const template=JSON.parse(await readFile(new URL('orchestration/pipeline-state.template.json',root),'utf8'));
function visualState(){const s=structuredClone(template);s.phases['01-content'].status='PASS';s.current_phase='02-visual-production';const p=s.phases[s.current_phase];p.status='READY';p.steps.visual_compile.status='READY';return s;}
function scene(id,count){return {id,semantic_goal:'A distinct change in how the character responds',narration_range:[0,24],entities:[],events:[{id:id+'event'}],director_beats:Array.from({length:count},(_,i)=>({id:id+'b'+i,voice_anchor:'anchor '+i,semantic_delta:'A distinct story change '+i,event_ids:count>=4&&i===0?[id+'event']:[]}))};}

test('one complete director beat proceeds to native checks without a decorative quota',()=>{
 const s=scene('s1',1);s.events=[{id:'reaction'}];s.director_beats[0].event_ids=['reaction'];
 const task=api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}});
 assert.equal(task.kind,'VALIDATE_AND_COMMIT_STEP');assert.equal(task.beat_target,undefined);
 s.director_beats=[];assert.equal(api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}}).kind,'DESIGN_SCENE_BEATS');
});
test('many director beats cannot hide an uncovered event, even in a sparse scene',()=>{
 const s=scene('s1',5);s.events=[{id:'uncovered'}];s.experience_profile={story_mode:'reflection',sparse_reason:'Hold a long deliberate silence after the reveal.'};
 assert.equal(api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}}).kind,'DESIGN_SCENE_BEATS');
});

test('XState is inside the plugin and routes one task without changing state',()=>{
 assert.equal(api.taskMachine?.id,'zodiac-task-router');const state=structuredClone(template),before=JSON.stringify(state);
 const t=api.resolveNextTask({state,manifests});assert.equal(t.kind,'VALIDATE_AND_COMMIT_STEP');assert.deepEqual(t.allowed_writes,[]);assert.equal(t.phase,'01-content');assert.equal(t.step,'evidence');assert.equal(JSON.stringify(state),before);assert.equal(t.not_an_approval,true);
});
test('phase ordering follows manifests and a review boundary cannot be bypassed',()=>{
 const state=visualState();state.phases=Object.fromEntries(Object.entries(state.phases).reverse());
 const t=api.resolveNextTask({state,manifests});assert.equal(t.kind,'DESIGN_VISUAL');
 const p=state.phases['02-visual-production'];p.status='IN_REVIEW';for(const step of Object.values(p.steps))step.status='PASS';
 assert.equal(api.resolveNextTask({state,manifests}).kind,'WAIT_FOR_GENUINE_USER_REVIEW');
 state.review_receipts=[{phase_id:'02-visual-production',status:'APPROVED',proof:{kind:'self_asserted'}}];
 assert.equal(api.resolveNextTask({state,manifests}).kind,'WAIT_FOR_GENUINE_USER_REVIEW');
});
test('scene task keeps the full scene while repairing missing event coverage',()=>{
 const state=visualState(),intent={cast:[],video:{width:1080,height:1920},assets:{},scenes:[scene('s1',1),scene('s2',5)]};
 const t=api.resolveNextTask({state,manifests,visualIntent:intent,narration:'The exact approved words.'});
 assert.equal(t.kind,'DESIGN_SCENE_BEATS');assert.equal(t.scene_id,'s1');assert.deepEqual(t.context.scene,intent.scenes[0]);assert.equal(t.beat_target,undefined);assert.equal(t.context.next_scene.id,'s2');
 assert.deepEqual(t.allowed_writes,['.authoring/visual-intent.json']);
 assert.equal(api.resolveNextTask({state,manifests,visualIntent:{...intent,scenes:[scene('s1',4),scene('s2',5)]}}).kind,'VALIDATE_AND_COMMIT_STEP');
});
test('sparse scene justification does not waive event coverage',()=>{
 const s=scene('s1',1);s.experience_profile={story_mode:'behavior',sparse_reason:'A sufficiently concrete reason, but the mode is not a quiet hold.'};
 assert.equal(api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}}).kind,'DESIGN_SCENE_BEATS');
 s.experience_profile.story_mode='reflection';assert.equal(api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}}).kind,'DESIGN_SCENE_BEATS');
 s.director_beats[0].event_ids=['s1event'];assert.equal(api.resolveNextTask({state:visualState(),manifests,visualIntent:{scenes:[s]}}).kind,'VALIDATE_AND_COMMIT_STEP');
});
test('missing authored visual assets route to a scoped asset repair task before validation',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const repairIssues=[
  {code:'PHASE02_BACKGROUND_ASSET_MISSING_OR_UNSAFE',asset:'assets/environment/a.svg'},
  {code:'AUTHORED_SVG_READ',path:'assets/props/bag.svg'},
  {code:'AUTHORED_SVG_READ',path:'../escape.svg'}
 ];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues});
 assert.equal(task.kind,'AUTHOR_VISUAL_ASSETS');
 assert.deepEqual(task.allowed_writes,['assets/environment/a.svg','assets/props/bag.svg']);
 assert.deepEqual(task.asset_paths,task.allowed_writes);
});

test('canonical scene-direction preflight failure routes to Visual Intent grammar repair',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues:[{code:'PHASE02_ENTRY_CHECK_FAILED',step:'scene_direction',stderr:'SCENE_DIRECTION_INVALID: scene 2 bad continuity_relation'}]});
 assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
 assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
 assert.equal(task.repair_owner,'visual_intent.scenes.grammar.continuity_relation');
});

test('scene-direction shot repetition routes to Visual Intent framing repair, not continuity repair',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues:[{code:'PHASE02_ENTRY_CHECK_FAILED',step:'scene_direction',stderr:'SCENE_DIRECTION_INVALID: shot streak > 2 at scene 3'}]});
 assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
 assert.equal(task.repair_owner,'visual_intent.scenes.grammar.framing');
});

test('composition narrative anchor failure routes back to canonical Visual Intent',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues:[{code:'COMPOSITION_NARRATIVE_REASON_MISSING',scene_id:'s1',entity_id:'hero'}]});
 assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
 assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
 assert.equal(task.repair_owner,'visual_intent.scenes.narrative_intent');
});

test('performance projection drift routes to a source-preserving Visual Intent reprojection task',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues:[{code:'NARRATION_PERFORMANCE_INVALID',detail:'NARRATION_PERFORMANCE_INVALID SOURCE_PERFORMANCE_DRIFT'}]});
 assert.equal(task.kind,'REPROJECT_VISUAL_INTENT');
 assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
});

test('episode cast scope failure routes back to canonical Visual Intent instead of projection edits',()=>{
 const state=visualState(),s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
 const task=api.resolveNextTask({state,manifests,visualIntent:{scenes:[s]},repairIssues:[{code:'EPISODE_HANDOFF_INVALID',detail:'EPISODE_HANDOFF_INVALID CAST_SCOPE'}]});
 assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
 assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
});

test('resume brief loads a current blocked asset receipt into the scoped repair task',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-asset-repair-'));
 try{
  await mkdir(path.join(w,'.authoring'),{recursive:true});
  const state=visualState();state.run_id='repair-run';state.run_mode='continuity';
  const phase1=state.phases['01-content'];phase1.status='SKIPPED_REUSED';phase1.reuse_source='synthetic-fixture:phase1';
  for(const step of Object.values(phase1.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:phase1';}
  const s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
  const intent={format:'zodiac-visual-intent@1',scenes:[s]};
  const intentRaw=JSON.stringify(intent);
  await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await writeFile(path.join(w,'.authoring/visual-intent.json'),intentRaw);
  await writeFile(path.join(w,'narration.txt'),'The exact approved words.');
  await writeFile(path.join(w,'.authoring/phase02-execution-receipt.json'),JSON.stringify({
   status:'BLOCKED',
   repair_source_hashes:{'.authoring/visual-intent.json':createHash('sha256').update(intentRaw).digest('hex')},
   issues:[{code:'AUTHORED_SVG_READ',path:'assets/environment/context.svg'}]
  }));
  const {resumeBrief}=await import('../resume-brief.mjs');
  const task=(await resumeBrief(w)).next_task;
  assert.equal(task.kind,'AUTHOR_VISUAL_ASSETS');
  assert.deepEqual(task.allowed_writes,['assets/environment/context.svg']);
 }finally{await rm(w,{recursive:true,force:true})}
});

test('resume brief routes a current CAST_SCOPE receipt back to canonical Visual Intent',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-cast-repair-'));
 try{
  await mkdir(path.join(w,'.authoring'),{recursive:true});
  const state=visualState();state.run_id='cast-repair-run';state.run_mode='continuity';
  const phase1=state.phases['01-content'];phase1.status='SKIPPED_REUSED';phase1.reuse_source='synthetic-fixture:phase1';
  for(const step of Object.values(phase1.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:phase1';}
  const s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
  const intent={format:'zodiac-visual-intent@1',scenes:[s]},intentRaw=JSON.stringify(intent);
  await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await writeFile(path.join(w,'.authoring/visual-intent.json'),intentRaw);
  await writeFile(path.join(w,'narration.txt'),'The exact approved words.');
  await writeFile(path.join(w,'.authoring/phase02-execution-receipt.json'),JSON.stringify({
   status:'BLOCKED',
   repair_source_hashes:{'.authoring/visual-intent.json':createHash('sha256').update(intentRaw).digest('hex')},
   issues:[{code:'EPISODE_HANDOFF_INVALID',detail:'EPISODE_HANDOFF_INVALID CAST_SCOPE'}]
  }));
  const {resumeBrief}=await import('../resume-brief.mjs');
  const task=(await resumeBrief(w)).next_task;
  assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
  assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
 }finally{await rm(w,{recursive:true,force:true})}
});

test('resume brief routes current canonical scene-direction preflight failure to grammar repair',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-direction-repair-'));
 try{
  await mkdir(path.join(w,'.authoring'),{recursive:true});
  const state=visualState();state.run_id='direction-repair-run';state.run_mode='continuity';
  const phase1=state.phases['01-content'];phase1.status='SKIPPED_REUSED';phase1.reuse_source='synthetic-fixture:phase1';
  for(const step of Object.values(phase1.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:phase1';}
  const s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
  const intent={format:'zodiac-visual-intent@1',scenes:[s]},intentRaw=JSON.stringify(intent);
  await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await writeFile(path.join(w,'.authoring/visual-intent.json'),intentRaw);
  await writeFile(path.join(w,'narration.txt'),'The exact approved words.');
  await writeFile(path.join(w,'.authoring/phase02-execution-receipt.json'),JSON.stringify({
   status:'BLOCKED',
   repair_source_hashes:{'.authoring/visual-intent.json':createHash('sha256').update(intentRaw).digest('hex')},
   issues:[{code:'PHASE02_ENTRY_CHECK_FAILED',step:'scene_direction',stderr:'SCENE_DIRECTION_INVALID: scene 2 bad continuity_relation'}]
  }));
  const {resumeBrief}=await import('../resume-brief.mjs');
  const task=(await resumeBrief(w)).next_task;
  assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
  assert.equal(task.repair_owner,'visual_intent.scenes.grammar.continuity_relation');
 }finally{await rm(w,{recursive:true,force:true})}
});

test('resume brief routes current composition narrative anchor failures to Visual Intent repair',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-composition-repair-'));
 try{
  await mkdir(path.join(w,'.authoring'),{recursive:true});
  const state=visualState();state.run_id='composition-repair-run';state.run_mode='continuity';
  const phase1=state.phases['01-content'];phase1.status='SKIPPED_REUSED';phase1.reuse_source='synthetic-fixture:phase1';
  for(const step of Object.values(phase1.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:phase1';}
  const s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
  const intent={format:'zodiac-visual-intent@1',scenes:[s]},intentRaw=JSON.stringify(intent);
  await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await writeFile(path.join(w,'.authoring/visual-intent.json'),intentRaw);
  await writeFile(path.join(w,'narration.txt'),'The exact approved words.');
  await writeFile(path.join(w,'.authoring/phase02-execution-receipt.json'),JSON.stringify({
   status:'BLOCKED',
   repair_source_hashes:{'.authoring/visual-intent.json':createHash('sha256').update(intentRaw).digest('hex')},
   issues:[{code:'COMPOSITION_NARRATIVE_REASON_MISSING',scene_id:'s1',entity_id:'hero'}]
  }));
  const {resumeBrief}=await import('../resume-brief.mjs');
  const task=(await resumeBrief(w)).next_task;
  assert.equal(task.kind,'REPAIR_VISUAL_INTENT');
  assert.equal(task.repair_owner,'visual_intent.scenes.narrative_intent');
 }finally{await rm(w,{recursive:true,force:true})}
});

test('resume brief loads SOURCE_PERFORMANCE_DRIFT as a reprojection task',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-performance-reproject-'));
 try{
  await mkdir(path.join(w,'.authoring'),{recursive:true});
  const state=visualState();state.run_id='performance-reproject-run';state.run_mode='continuity';
  const phase1=state.phases['01-content'];phase1.status='SKIPPED_REUSED';phase1.reuse_source='synthetic-fixture:phase1';
  for(const step of Object.values(phase1.steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:phase1';}
  const s=scene('s1',1);s.director_beats[0].event_ids=['s1event'];
  const intent={format:'zodiac-visual-intent@1',scenes:[s]},intentRaw=JSON.stringify(intent);
  await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
  await writeFile(path.join(w,'.authoring/visual-intent.json'),intentRaw);
  await writeFile(path.join(w,'narration.txt'),'The exact approved words.');
  await writeFile(path.join(w,'.authoring/phase02-execution-receipt.json'),JSON.stringify({
   status:'BLOCKED',
   repair_source_hashes:{'.authoring/visual-intent.json':createHash('sha256').update(intentRaw).digest('hex')},
   issues:[{code:'NARRATION_PERFORMANCE_INVALID',detail:'NARRATION_PERFORMANCE_INVALID SOURCE_PERFORMANCE_DRIFT'}]
  }));
  const {resumeBrief}=await import('../resume-brief.mjs');
  const task=(await resumeBrief(w)).next_task;
  assert.equal(task.kind,'REPROJECT_VISUAL_INTENT');
  assert.deepEqual(task.allowed_writes,['.authoring/visual-intent.json']);
 }finally{await rm(w,{recursive:true,force:true})}
});

test('workflow graph links a capability to its phase, step and execution source',()=>{
 const graph=api.buildWorkflowGraph(manifests,template);const q=api.queryWorkflowGraph(graph,'character_assembly');
 assert.ok(q.matches.length>0);assert.ok(q.edges.some(e=>e.kind==='uses_source'));assert.ok(q.nodes.some(n=>n.kind==='step'));assert.equal(q.not_an_approval,true);
 assert.throws(()=>api.queryWorkflowGraph(graph,'',{}),/GRAPH_QUERY_REQUIRED/);
});
test('resume emits a revision-bound task and stale task IDs cannot authorize writes',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-'));
 const state=visualState();state.run_mode='continuity';state.phases['01-content'].current_step='narration';for(const step of Object.values(state.phases['01-content'].steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:content';}state.review_receipts=[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'synthetic-fixture:review'}}];
 try{await mkdir(path.join(w,'.authoring'));await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));
 const {resumeBrief}=await import('../resume-brief.mjs');const b=await resumeBrief(w);
 assert.match(b.next_task.id,/^[a-f0-9]{64}$/);assert.equal(b.next_task.state_sha256,b.state_sha256);
 await api.assertTaskWrite(w,b.next_task.id,'.authoring/visual-intent.json');
 const clone=await mkdtemp(path.join(tmpdir(),'z-task-clone-'));try{await mkdir(path.join(clone,'.authoring'));await writeFile(path.join(clone,'.authoring/pipeline-state.json'),JSON.stringify(state));await assert.rejects(()=>api.assertTaskWrite(clone,b.next_task.id,'.authoring/visual-intent.json'),/TASK_REVISION_CHANGED/);}finally{await rm(clone,{recursive:true,force:true});}
 await assert.rejects(()=>api.assertTaskWrite(w,b.next_task.id,'narration.txt'),/TASK_WRITE_FORBIDDEN/);
 await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify({...state,run_id:'changed'}));
 await assert.rejects(()=>api.assertTaskWrite(w,b.next_task.id,'.authoring/visual-intent.json'),/TASK_REVISION_CHANGED/);
 }finally{await rm(w,{recursive:true,force:true});}
});

test('a scene task refuses changes to the cast or another scene and expires after a source edit',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-scene-'));
 try{await mkdir(path.join(w,'.authoring'));const state=visualState();state.run_mode='continuity';state.phases['01-content'].current_step='narration';for(const step of Object.values(state.phases['01-content'].steps)){step.status='SKIPPED_REUSED';step.reuse_source='synthetic-fixture:content';}
 state.review_receipts=[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'synthetic-fixture:review'}}];
 const intent={format:'zodiac-visual-intent@1',cast:[],assets:{},scenes:[scene('s1',1),scene('s2',5)]};
 await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(state));await writeFile(path.join(w,'.authoring/visual-intent.json'),JSON.stringify(intent));await writeFile(path.join(w,'narration.txt'),'A source narration long enough.');
 const {resumeBrief}=await import('../resume-brief.mjs');const task=(await resumeBrief(w)).next_task;assert.equal(task.kind,'DESIGN_SCENE_BEATS');
 const allowed=structuredClone(intent);allowed.scenes[0]=scene('s1',5);await api.assertTaskWrite(w,task.id,'.authoring/visual-intent.json',{visualIntent:allowed});
 const other=structuredClone(allowed);other.scenes[1].semantic_goal='Different';await assert.rejects(()=>api.assertTaskWrite(w,task.id,'.authoring/visual-intent.json',{visualIntent:other}),/TASK_SCENE_SCOPE_VIOLATION/);
 await assert.rejects(()=>api.assertTaskWrite(w,task.id,'.authoring/visual-intent.json',{visualIntent:{...allowed,cast:[{entity_id:'intruder'}]}}),/TASK_SCENE_SCOPE_VIOLATION/);
 await writeFile(path.join(w,'.authoring/visual-intent.json'),JSON.stringify(allowed));await assert.rejects(()=>api.assertTaskWrite(w,task.id,'.authoring/visual-intent.json',{visualIntent:allowed}),/TASK_REVISION_CHANGED/);
 }finally{await rm(w,{recursive:true,force:true});}
});
