#!/usr/bin/env node
// Fail-closed authoring completeness gate before native Phase 2 compilation.
// This proves required authoring structure exists; it is not Visual Review.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reachableStates,traceSceneStates} from './scene-state-trace.mjs';
import {validateStoryText} from './validate-story-text.mjs';
const used=(layer,id)=>layer?.decision==='use'&&Array.isArray(layer.entity_ids)&&layer.entity_ids.includes(id);
export function validatePhase02AuthoringCompleteness({run_mode,intent,production,art,director,character,episodeScope,episodeCast}={}){
 const issues=validateStoryText(intent,production),add=(code,scene_id,detail)=>issues.push({code,...(scene_id?{scene_id}:{}),...(detail?{detail}:{})});
 if(run_mode!=='fresh'&&intent?.format!=='zodiac-visual-intent@1')return {format:'zodiac-phase02-authoring-completeness@1',status:'NOT_APPLICABLE',issues,not_an_approval:true};
 const scenes=production?.scenes??[],ids=scenes.map(s=>s.id);
 if(!intent)add('PHASE02_VISUAL_INTENT_REQUIRED');
 const plan=intent?.scene_plan;
 if(!plan||!Array.isArray(plan.scenes)||plan.scenes.length!==ids.length||plan.scenes.some((s,i)=>s.id!==ids[i]))add('PHASE02_SCENE_PLAN_REQUIRED');
 if(intent?.story_object_plan)add('PHASE02_LEGACY_STORY_OBJECT_FORBIDDEN');
 for(const s of intent?.scenes??[])if(s?.grammar?.environment?.scene_set_id)add('PHASE02_LEGACY_SCENE_SET_FORBIDDEN',s.id);
 const allVisuals=scenes.flatMap(scene=>(scene.entities??[]).filter(e=>e.kind==='narrative_visual'||e.visual_role==='story_object'));
 if(!allVisuals.length)add('PHASE02_NARRATIVE_VISUAL_REQUIRED');
 const directorScenes=new Set((director?.beats??[]).map(b=>b.scene_id).filter(Boolean));
 const characterById=new Map((character?.characters??[]).map(c=>[c.entity_id,c]));
 const charIds=new Set(characterById.keys());
 if(Array.isArray(episodeCast?.bindings)){
  for(const binding of episodeCast.bindings){
   if(binding?.role!=='member')continue;
   const spec=characterById.get(binding.entity_id);
   if(!spec){
    add('PHASE02_ZODIAC_MEMBER_CHARACTER_REQUIRED',undefined,`${binding.entity_id}:${binding.member_id}`);
    continue;
   }
   if(spec.outfit_id!=='zodiac-glyph-shirt'){
    add('PHASE02_ZODIAC_MEMBER_GLYPH_REQUIRED',undefined,`${binding.entity_id}:${binding.member_id}`);
    continue;
   }
   if(spec.zodiac_sign_id!==binding.member_id){
    add('PHASE02_ZODIAC_MEMBER_GLYPH_MISMATCH',undefined,`${binding.entity_id}:${binding.member_id}->${spec.zodiac_sign_id??'missing'}`);
   }
  }
 }
 for(const scene of scenes){
  const sceneArt=art?.scenes?.find(s=>s.id===scene.id);
  if(!sceneArt?.visual_coverage?.beats?.length)add('PHASE02_VISUAL_COVERAGE_REQUIRED',scene.id);
  if(!directorScenes.has(scene.id))add('PHASE02_DIRECTOR_PLAN_REQUIRED',scene.id);
  for(const actor of (scene.entities??[]).filter(e=>e.kind==='character'))if(!charIds.has(actor.id))add('PHASE02_CHARACTER_ASSEMBLY_REQUIRED',scene.id,actor.id);
  if(!scene.environment)add('PHASE02_CONTEXT_DECISION_REQUIRED',scene.id);
  const events=scene.events??[],beats=sceneArt?.visual_coverage?.beats??[];
  const trace=run_mode==='fresh'?traceSceneStates(scene):[];
  if(run_mode==='fresh')for(const beat of beats){
   const authored=intent?.scenes?.find(s=>s.id===scene.id),request=authored?.grammar?.meme_composition;
   const reactions=Object.entries(request?.state_bindings??{}).flatMap(([role,state])=>{
    const id=request.bindings?.[role],actor=(scene.entities??[]).find(e=>e.id===id&&e.kind==='character');
    return events.filter((e,index)=>actor?.states?.[state]&&actor.initial_state!==state&&e.target===id&&e.state_after===state&&e.state_before!==state&&trace[index]?.before[id]===e.state_before&&actor.states[state].visible!==false&&e.trigger?.type==='voice_anchor'&&typeof e.trigger.text==='string'&&e.trigger.text.trim()&&scene.voice?.includes(e.trigger.text)&&beat.event_ids?.includes(e.id));
   });
   for(const layer of ['story_text','meme']){
    const decision=beat.layers?.[layer];
    if(!decision||!['use','omit'].includes(decision.decision)||typeof decision.reason!=='string'||!decision.reason.trim()){add('PHASE02_EDITORIAL_DECISION_REQUIRED',scene.id,layer);continue;}
    if(decision.decision==='omit'){
     if(decision.entity_ids?.length)add('PHASE02_EDITORIAL_OMISSION_HAS_ENTITIES',scene.id,layer);
     if(layer==='meme'&&reactions.length)add('PHASE02_MEME_COVERAGE_REQUIRED',scene.id,beat.id);
     continue;
    }
    const ids=decision.entity_ids;
    if(layer==='story_text'){
     if(!Array.isArray(ids)||!ids.length||ids.some(id=>!authored?.entities?.some(e=>e.id===id&&e.story_text&&e.kind==='object'&&e.visual_role==='overlay')))add('PHASE02_STORY_TEXT_SELECTION_REQUIRED',scene.id,beat.id);
    }else if(!request?.id||!Array.isArray(ids)||!ids.length||ids.some(id=>!reactions.some(e=>e.target===id))||reactions.some(e=>!ids.includes(e.target)))add('PHASE02_MEME_REACTION_REQUIRED',scene.id,beat.id);
   }
  }
  const backgrounds=(scene.entities??[]).filter(e=>e.kind==='scene_accent'||e.visual_role==='background'||e.visual_role==='scene_accent');
  const canvas=scene.layout_contract?.canvas??production.video??{width:1080,height:1920};
  if(!backgrounds.some(e=>reachableStates(scene,e).some(s=>{const t=s.transform;return s.visible!==false&&s.asset&&t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))&&t.width>0&&t.height>0&&t.x>=0&&t.y>=0&&t.x+t.width<=canvas.width&&t.y+t.height<=canvas.height;})&&beats.some(b=>used(b.layers?.scene_accent,e.id)||used(b.layers?.scene_set,e.id))))add('PHASE02_SCENE_BACKGROUND_REQUIRED',scene.id);
  for(const prop of (scene.entities??[]).filter(e=>e.visual_role==='interactive_prop')){
   if(!beats.some(b=>used(b.layers?.props,prop.id)))add('PHASE02_PROP_COVERAGE_REQUIRED',scene.id,prop.id);
   if(!events.some(e=>e.target===prop.id))add('PHASE02_PROP_EVENT_REQUIRED',scene.id,prop.id);
  }
  const visuals=(scene.entities??[]).filter(e=>e.kind==='narrative_visual'||e.visual_role==='story_object');
  if(visuals.length){
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
 const [state,intent,production,art,director,character,episodeScope,episodeCast]=await Promise.all([
  load('.authoring/pipeline-state.json'),optional('.authoring/visual-intent.json'),load('production.json'),
  optional('.authoring/scene-art-direction.json'),optional('.authoring/director-plan.json'),optional('.authoring/character-assembly-plan.json'),
  optional('.authoring/episode-scope.json'),optional('.authoring/episode-cast-plan.json')
 ]);
 const result=validatePhase02AuthoringCompleteness({run_mode:state.run_mode,intent,production,art,director,character,episodeScope,episodeCast});
 for(const scene of production.scenes??[])for(const entity of scene.entities??[]){
  if(!['background','scene_accent'].includes(entity.visual_role)&&entity.kind!=='scene_accent')continue;
  for(const st of reachableStates(scene,entity).filter(s=>s.visible!==false)){
   const rel=production.assets?.[st.asset]?.path,target=typeof rel==='string'?path.resolve(root,rel):null;
   if(!target||path.isAbsolute(rel)||rel.includes('..')||!target.startsWith(root+path.sep)){result.issues.push({code:'PHASE02_BACKGROUND_ASSET_PATH_INVALID',scene_id:scene.id,entity_id:entity.id});continue;}
   try{const svg=await readFile(target,'utf8');if(!/<svg[\s>]/iu.test(svg)||/<script\b|<foreignObject\b|\bon\w+\s*=/iu.test(svg))throw Error('unsafe SVG');}
   catch{result.issues.push({code:'PHASE02_BACKGROUND_ASSET_MISSING_OR_UNSAFE',scene_id:scene.id,entity_id:entity.id,asset:rel});}
  }
 }
 result.status=result.issues.length?'BLOCKED':result.status;return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-phase02-authoring-completeness.mjs <workspace>');process.exit(2)}
 try{const r=await validatePhase02AuthoringCompletenessWorkspace(root);console.log(JSON.stringify(r,null,2));if(r.status==='BLOCKED')process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
