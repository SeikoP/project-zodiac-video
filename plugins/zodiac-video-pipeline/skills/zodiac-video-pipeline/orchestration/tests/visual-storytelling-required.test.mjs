import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhase02AuthoringCompleteness} from '../../features/visual-composition/validate-phase02-authoring-completeness.mjs';
import {validateNarrativeVisualPresence} from '../../features/visual-composition/validate-narrative-visual-presence.mjs';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const check=(entities,layers={})=>validatePhase02AuthoringCompleteness({
 run_mode:'fresh',
 intent:{format:'zodiac-visual-intent@1',taxonomy_version:'narrative_visual@1',scene_plan:{scenes:[{id:'scene'}]},narrative_visual_decision:{mode:'omitted',reason:'Phase 1 selected no Narrative Visual.'}},
 production:{scenes:[{id:'scene',environment:{mode:'canvas'},entities}]},
 art:{scenes:[{id:'scene',visual_coverage:{beats:[{layers}]}}]},
 director:{beats:[{scene_id:'scene'}]}
}).issues.map(i=>i.code);
const context={id:'window',visual_role:'background',role:'scene_accent',initial_state:'shown',states:{shown:{asset:'WINDOW',visible:true,transform:{x:50,y:50,width:300,height:250}}}};

test('actor-only scene may omit Narrative Visual but still needs real context',()=>{
 const codes=check([]);
 assert.ok(codes.includes('PHASE02_SCENE_BACKGROUND_REQUIRED'));
 assert.equal(codes.includes('PHASE02_NARRATIVE_VISUAL_REQUIRED'),false);
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
test('fresh episode-wide Narrative Visual omission passes when Phase 1 has no direction',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-visual-optional-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({run_mode:'fresh'}));
  await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({version:'2.0',narrative_visuals:[]}));
  await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify({taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'omitted',reason:'Actor performance and Story Text are sufficient.'},scenes:[]}));
  await writeFile(path.join(root,'narration.txt'),'Story');
  const result=await validateNarrativeVisualPresence(root);
  assert.equal(result.status,'PASS');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('fresh intent cannot require a Narrative Visual that Phase 1 did not select',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-visual-drift-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),JSON.stringify({run_mode:'fresh'}));
  await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({version:'2.0',narrative_visuals:[]}));
  await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify({taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'required',reason:'Phase 2 tried to invent one.'},scenes:[]}));
  await writeFile(path.join(root,'narration.txt'),'Story');
  const result=await validateNarrativeVisualPresence(root);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.issues.some(i=>i.code==='NARRATIVE_VISUAL_DECISION_DRIFT'));
 }finally{await rm(root,{recursive:true,force:true});}
});
