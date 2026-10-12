import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(here,'..');
const skill=path.resolve(orchestration,'..');
const projector=path.join(skill,'compat/story-object/project-story-object-to-visual-metaphor.mjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

const legacy={
 format:'zodiac-story-object-plan@1',
 central_metaphor:{id:'balance',meaning:'cân nhắc hai hướng',payoff_transformation:'chọn hướng phù hợp'},
 beats:[
  {beat_id:'B1',scene_id:'S01',role:'setup',voice_anchor:'nghiêng trái',visual_change:'cán cân nghiêng trái',object_entity:'balance'},
  {beat_id:'B2',scene_id:'S02',role:'friction',voice_anchor:'đứng giữa',visual_change:'cán cân trở về giữa',object_entity:'balance'},
  {beat_id:'B3',scene_id:'S03',role:'payoff',voice_anchor:'nghiêng phải',visual_change:'cán cân nghiêng phải',object_entity:'balance'}
 ]
};

test('legacy Story Object projects in memory without rewriting approved source bytes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'zodiac-metaphor-compat-'));
 try{
  await mkdir(path.join(dir,'.authoring'));
  const p=path.join(dir,'.authoring/story-object-plan.json');
  const source=Buffer.from(JSON.stringify(legacy,null,2)+'\n');
  await writeFile(p,source);
  const before=sha(await readFile(p));
  const {projectLegacyStoryObjectFile}=await import(pathToFileURL(projector));
  const projected=await projectLegacyStoryObjectFile(p);
  const after=sha(await readFile(p));
  assert.equal(after,before);
  assert.equal(projected.format,'zodiac-visual-metaphor-plan@1');
  assert.equal(projected.compatibility?.source_format,'zodiac-story-object-plan@1');
  assert.equal(projected.metaphors[0].cues.length,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('fresh default context does not load legacy Story Object or full Visual Metaphor guidance',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const result=await loadStepContext('02-visual-production','visual_compile',state.flags,{environment_mode:'scene_set'});
 assert.equal(result.selected_capabilities.includes('visual_metaphor'),false);
 assert.equal(result.required_references.some(ref=>ref.includes('story-object')),false);
 assert.equal(result.required_references.some(ref=>ref.includes('visual-metaphor-contract')),false);
 const bytes=(result.context_manifest??[]).reduce((sum,row)=>sum+(row.bytes??0),0);
 assert.ok(bytes<=70000,'fresh default context is '+bytes+' bytes');
});

test('selected Visual Metaphor loads current guidance but never Story Object compatibility docs',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const state=JSON.parse(await readFile(path.join(orchestration,'pipeline-state.template.json'),'utf8'));
 const flags={...state.flags,visual_metaphor_selected:true};
 const result=await loadStepContext('02-visual-production','visual_compile',flags,{environment_mode:'scene_set'});
 assert.ok(result.selected_capabilities.includes('visual_metaphor'));
 assert.ok(result.required_references.includes('references/visual-metaphor-contract.md'));
 assert.ok(result.required_references.includes('references/visual-metaphor-composition.md'));
 assert.equal(result.required_references.some(ref=>ref.includes('story-object')),false);
});
