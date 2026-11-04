#!/usr/bin/env node
// Fail-closed authoring completeness gate before native Phase 2 compilation.
// This proves required authoring structure exists; it is not Visual Review.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const used=(layer,id)=>layer?.decision==='use'&&Array.isArray(layer.entity_ids)&&layer.entity_ids.includes(id);
export function validatePhase02AuthoringCompleteness({run_mode,intent,production,art,director,character}={}){
 const issues=[],add=(code,scene_id,detail)=>issues.push({code,...(scene_id?{scene_id}:{}),...(detail?{detail}:{})});
 if(run_mode!=='fresh')return {format:'zodiac-phase02-authoring-completeness@1',status:'NOT_APPLICABLE',issues,not_an_approval:true};
 const scenes=production?.scenes??[],ids=scenes.map(s=>s.id);
 if(!intent)add('PHASE02_VISUAL_INTENT_REQUIRED');
 const plan=intent?.scene_plan;
 if(!plan||!Array.isArray(plan.scenes)||plan.scenes.length!==ids.length||plan.scenes.some((s,i)=>s.id!==ids[i]))add('PHASE02_SCENE_PLAN_REQUIRED');
 if(intent?.story_object_plan)add('PHASE02_LEGACY_STORY_OBJECT_FORBIDDEN');
 for(const s of intent?.scenes??[])if(s?.grammar?.environment?.scene_set_id)add('PHASE02_LEGACY_SCENE_SET_FORBIDDEN',s.id);
 const directorScenes=new Set((director?.beats??[]).map(b=>b.scene_id).filter(Boolean));
 const charIds=new Set((character?.characters??[]).map(c=>c.entity_id).filter(Boolean));
 for(const scene of scenes){
  const sceneArt=art?.scenes?.find(s=>s.id===scene.id);
  if(!sceneArt?.visual_coverage?.beats?.length)add('PHASE02_VISUAL_COVERAGE_REQUIRED',scene.id);
  if(!directorScenes.has(scene.id))add('PHASE02_DIRECTOR_PLAN_REQUIRED',scene.id);
  for(const actor of (scene.entities??[]).filter(e=>e.kind==='character'))if(!charIds.has(actor.id))add('PHASE02_CHARACTER_ASSEMBLY_REQUIRED',scene.id,actor.id);
  if(!scene.environment)add('PHASE02_CONTEXT_DECISION_REQUIRED',scene.id);
  const events=scene.events??[],beats=sceneArt?.visual_coverage?.beats??[];
  for(const prop of (scene.entities??[]).filter(e=>e.visual_role==='interactive_prop')){
   if(!beats.some(b=>used(b.layers?.props,prop.id)))add('PHASE02_PROP_COVERAGE_REQUIRED',scene.id,prop.id);
   if(!events.some(e=>e.target===prop.id))add('PHASE02_PROP_EVENT_REQUIRED',scene.id,prop.id);
  }
  const visuals=(scene.entities??[]).filter(e=>e.kind==='narrative_visual'||e.visual_role==='story_object');
  const narrativeRequired=intent?.narrative_visual_decision?.mode==='required'||visuals.length>0;
  if(narrativeRequired){
   if(!visuals.length)add('PHASE02_NARRATIVE_VISUAL_REQUIRED',scene.id);
   for(const visual of visuals){
    if(!beats.some(b=>used(b.layers?.narrative_visual,visual.id)||used(b.layers?.story_object,visual.id)))add('PHASE02_NARRATIVE_VISUAL_COVERAGE_REQUIRED',scene.id,visual.id);
    if(!events.some(e=>e.target===visual.id&&e.state_before!==e.state_after))add('PHASE02_NARRATIVE_VISUAL_EVENT_REQUIRED',scene.id,visual.id);
   }
  }
 }
 return {format:'zodiac-phase02-authoring-completeness@1',status:issues.length?'BLOCKED':'PASS',issues,not_an_approval:true};
}
export async function validatePhase02AuthoringCompletenessWorkspace(root){
 root=path.resolve(root);
 const load=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
 const optional=async rel=>load(rel).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
 const [state,intent,production,art,director,character]=await Promise.all([
  load('.authoring/pipeline-state.json'),optional('.authoring/visual-intent.json'),load('production.json'),
  optional('.authoring/scene-art-direction.json'),optional('.authoring/director-plan.json'),optional('.authoring/character-assembly-plan.json')
 ]);
 return validatePhase02AuthoringCompleteness({run_mode:state.run_mode,intent,production,art,director,character});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-phase02-authoring-completeness.mjs <workspace>');process.exit(2)}
 try{const r=await validatePhase02AuthoringCompletenessWorkspace(root);console.log(JSON.stringify(r,null,2));if(r.status==='BLOCKED')process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
