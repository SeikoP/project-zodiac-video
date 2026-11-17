import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {resumeBrief} from '../resume-brief.mjs';
import {loadStepContext} from '../plan-step-context.mjs';

const skill=fileURLToPath(new URL('../../',import.meta.url));
const template=async()=>JSON.parse(await readFile(path.join(skill,'orchestration/pipeline-state.template.json'),'utf8'));
async function workspace(state){const root=await mkdtemp(path.join(tmpdir(),'resume-'));await mkdir(path.join(root,'.authoring'));await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify(state));return root;}
const steps=[['01-content','evidence'],['01-content','voice'],['01-content','concept'],['01-content','narrative_design'],['01-content','narration'],['02-visual-production','visual_compile'],['02-visual-production','assets'],['02-visual-production','publish_prep'],['03-handoff','assemble'],['03-handoff','validate'],['03-handoff','export']];

test('every step plan resolves selected local references to files on disk',async()=>{
 const flags=(await template()).flags;
 for(const [p,s] of steps){const plan=await loadStepContext(p,s,flags);
  for(const ref of plan.required_references){assert.ok(!/^[a-z]+:\/\//i.test(ref),`${p}/${s} lists host URI ${ref}`);assert.ok(existsSync(path.join(skill,ref)),`${p}/${s} missing ${ref}`);}
  assert.ok(existsSync(path.join(skill,plan.phase_guidance)),plan.phase_guidance);
 }
});

test('Web evidence context carries creative guidance without native provider-routing receipts',async()=>{
 const plan=await loadStepContext('01-content','evidence',(await template()).flags);
 assert.deepEqual(plan.host_capability_notes,[]);
 assert.ok(plan.required_references.length>0);
 assert.equal(plan.phase_guidance,'orchestration/phases/01-content.md');
});

test('fresh workspace resumes at the first incomplete creative step from persisted state',async()=>{
 const root=await workspace(await template());
 try{
  const b=await resumeBrief(root);
  assert.equal(b.phase,'01-content');assert.equal(b.step,'evidence');assert.equal(b.not_an_approval,true);
  assert.ok(b.read_now.length>0&&b.read_now.every(r=>!r.missing));
  assert.deepEqual(b.remaining_steps,['evidence','voice','concept','narrative_design','narration']);
 } finally{await rm(root,{recursive:true,force:true});}
});

test('missing state blocks without auto approval',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'resume-'));
 try{await assert.rejects(()=>resumeBrief(root),/PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL/);}finally{await rm(root,{recursive:true,force:true});}
});
