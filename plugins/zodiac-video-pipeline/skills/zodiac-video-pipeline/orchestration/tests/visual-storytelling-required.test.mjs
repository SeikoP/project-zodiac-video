import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhase02AuthoringCompleteness} from '../../features/visual-composition/validate-phase02-authoring-completeness.mjs';
import {validateNarrativeVisualPresence} from '../../features/visual-composition/validate-narrative-visual-presence.mjs';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const check=(entities,layers={})=>validatePhase02AuthoringCompleteness({run_mode:'fresh',intent:{format:'zodiac-visual-intent@1',scene_plan:{scenes:[{id:'scene'}]},narrative_visual_decision:{mode:'omitted'}},production:{scenes:[{id:'scene',environment:{mode:'canvas'},entities}]},art:{scenes:[{id:'scene',visual_coverage:{beats:[{layers}]}}]},director:{beats:[{scene_id:'scene'}]}}).issues.map(i=>i.code);
const context={id:'window',visual_role:'background',initial_state:'shown',states:{shown:{asset:'WINDOW',visible:true,transform:{x:50,y:50,width:300,height:250}}}};
const visual={id:'thread',visual_role:'story_object',initial_state:'joined',states:{joined:{asset:'THREAD',visible:true}}};
test('palette and actor-only episode fails both storytelling requirements',()=>{
 const codes=check([]);
 assert.ok(codes.includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
 assert.ok(codes.includes('PHASE02_NARRATIVE_VISUAL_REQUIRED'));
});
test('background requires actual visible entity and use coverage',()=>{
 assert.ok(check([context]).includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
 assert.ok(check([{...context,initial_state:'hidden',states:{hidden:{asset:'WINDOW',visible:false},shown:context.states.shown}}],{scene_accent:{decision:'use',entity_ids:['window']}}).includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
 assert.ok(!check([context],{scene_accent:{decision:'use',entity_ids:['window']}}).includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
});
test('off-canvas background cannot satisfy scene readiness',()=>{
 const entity=structuredClone(context);entity.states.shown.transform.x=2000;
 assert.ok(check([entity],{scene_accent:{decision:'use',entity_ids:['window']}}).includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
});
test('episode narrative visual is independent of background coverage',()=>{
 const codes=check([context,visual],{scene_accent:{decision:'use',entity_ids:['window']}});
 assert.ok(!codes.includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
 assert.ok(!codes.includes('PHASE02_NARRATIVE_VISUAL_REQUIRED'));
 assert.ok(codes.includes('PHASE02_NARRATIVE_VISUAL_EVENT_REQUIRED'));
});
test('legacy workspace without current Visual Intent retains compatibility',()=>{
 assert.equal(validatePhase02AuthoringCompleteness({run_mode:'resume'}).status,'NOT_APPLICABLE');
});
test('fresh episode-wide omission is blocked even with an editorial reason',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-visual-required-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({run_mode:'fresh'}));
  await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify({taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'omitted',reason:'Actor poses carry the story'},scenes:[]}));
  await writeFile(path.join(root,'narration.txt'),'Story');
  const result=await validateNarrativeVisualPresence(root);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_REQUIRED_FOR_FRESH'));
  assert.ok(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_REQUIRED_BUT_ABSENT'));
 }finally{await rm(root,{recursive:true,force:true});}
});
