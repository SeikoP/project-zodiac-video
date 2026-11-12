import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {diagnoseWorkspace} from '../diagnose-phase02.mjs';
import {planBatchRepair} from '../batch-repair.mjs';

test('diagnosis reads current native preview metrics before legacy preview locations',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-diagnostics-'));
 try{
  await mkdir(path.join(root,'.authoring/preview-pairs'),{recursive:true});await mkdir(path.join(root,'preview'));
  await writeFile(path.join(root,'preview/preview-report.json'),JSON.stringify({cache:{rebuilt_scenes:['old'],reused_scenes:[]}}));
  assert.equal((await diagnoseWorkspace(root)).measured.preview_rebuilt_scenes,1);
  await writeFile(path.join(root,'.authoring/preview-pairs/preview-report.json'),JSON.stringify({cache:{rebuilt_scenes:['S01','S02'],reused_scenes:['S03']}}));
  const report=await diagnoseWorkspace(root);
  assert.equal(report.measured.preview_rebuilt_scenes,2);assert.equal(report.measured.preview_reused_scenes,1);
  assert.equal(report.not_an_approval,true);assert.ok(report.findings.some(i=>i.code==='END_TO_END_AUTHORING_TIME_UNMEASURED'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('lettering and meme repairs point to canonical scene sources without granting approval',()=>{
 const plan=planBatchRepair([{code:'STORY_TEXT_ANCHOR_INVALID',scene_id:'S01'},{code:'PHASE02_MEME_REACTION_REQUIRED',scene_id:'S05'}]);
 assert.deepEqual(plan.groups.map(g=>g.owner),['visual_intent.scenes.story_text','visual_intent.scenes.grammar.meme_composition']);
 assert.equal(plan.requires_revalidation,true);assert.equal(plan.no_automatic_approval,true);
});
