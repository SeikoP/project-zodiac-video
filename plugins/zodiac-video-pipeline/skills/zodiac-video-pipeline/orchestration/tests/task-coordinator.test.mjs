import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
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
 const t=api.resolveNextTask({state,manifests});assert.equal(t.kind,'AUTHOR_STEP');assert.equal(t.phase,'01-content');assert.equal(t.step,'evidence');assert.equal(JSON.stringify(state),before);assert.equal(t.not_an_approval,true);
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
test('workflow graph links a capability to its phase, step and execution source',()=>{
 const graph=api.buildWorkflowGraph(manifests,template);const q=api.queryWorkflowGraph(graph,'character_assembly');
 assert.ok(q.matches.length>0);assert.ok(q.edges.some(e=>e.kind==='uses_source'));assert.ok(q.nodes.some(n=>n.kind==='step'));assert.equal(q.not_an_approval,true);
 assert.throws(()=>api.queryWorkflowGraph(graph,'',{}),/GRAPH_QUERY_REQUIRED/);
});
test('resume emits a revision-bound task and stale task IDs cannot authorize writes',async()=>{
 const w=await mkdtemp(path.join(tmpdir(),'z-task-'));
 try{await mkdir(path.join(w,'.authoring'));await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify(template));
 const {resumeBrief}=await import('../resume-brief.mjs');const b=await resumeBrief(w);
 assert.match(b.next_task.id,/^[a-f0-9]{64}$/);assert.equal(b.next_task.state_sha256,b.state_sha256);
 await api.assertTaskWrite(w,b.next_task.id,'.authoring/evidence-ledger.json');
 const clone=await mkdtemp(path.join(tmpdir(),'z-task-clone-'));try{await mkdir(path.join(clone,'.authoring'));await writeFile(path.join(clone,'.authoring/pipeline-state.json'),JSON.stringify(template));await assert.rejects(()=>api.assertTaskWrite(clone,b.next_task.id,'.authoring/evidence-ledger.json'),/TASK_REVISION_CHANGED/);}finally{await rm(clone,{recursive:true,force:true});}
 await assert.rejects(()=>api.assertTaskWrite(w,b.next_task.id,'narration.txt'),/TASK_WRITE_FORBIDDEN/);
 await writeFile(path.join(w,'.authoring/pipeline-state.json'),JSON.stringify({...template,run_id:'changed'}));
 await assert.rejects(()=>api.assertTaskWrite(w,b.next_task.id,'.authoring/evidence-ledger.json'),/TASK_REVISION_CHANGED/);
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
