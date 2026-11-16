#!/usr/bin/env node
// Phase 2 Hình kể chuyện readiness for one optional focal entity per scene.
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateNarrativeBrief} from './validate-narrative-brief.mjs';
import {validateStoryVisualLettering} from './validate-story-visual-lettering.mjs';
import {validateStoryVisualKit} from './validate-story-visual-kit.mjs';
import {reachableStates,classifyEventChange} from './scene-state-trace.mjs';
import {validateStoryVisualDecision} from '../../references/validate-story-visual-direction.mjs';

const safeRel=p=>typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!p.split(/[\\/]/u).includes('..')&&!p.includes('\\');
export async function validateStoryVisualPresence(workspace){
 const root=path.resolve(workspace),issues=[];
 const add=(code,scene_id,extra={})=>issues.push({code,...(scene_id?{scene_id}:{}),...extra});
 const load=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
 const state=await load('.authoring/pipeline-state.json');
 let intent;
 try{intent=await load('.authoring/visual-intent.json');}
 catch{if(state.run_mode!=='fresh')return {status:'NOT_APPLICABLE',issues,not_an_approval:true};add('STORY_VISUAL_INTENT_MISSING');return {status:'BLOCKED',issues,not_an_approval:true};}
 if(state.run_mode!=='fresh'&&intent?.format!=='zodiac-visual-intent@1')return {status:'NOT_APPLICABLE',issues,not_an_approval:true};
 const plan=await load('.authoring/narrative-plan.json').catch(()=>({}));
 if(state.run_mode==='fresh')issues.push(...validateStoryVisualDecision(plan));
 const directions=Array.isArray(plan.story_visuals)?plan.story_visuals:[];
 const directionIds=new Set(directions.map(x=>x.id));
 const expectedMode=directions.length?'required':'omitted';
 const decision=intent.taxonomy_version==='story_visual@1'?intent.story_visual_decision:null;
 if(!decision||!['required','omitted'].includes(decision.mode)||!String(decision.reason??'').trim())add('STORY_VISUAL_DECISION_MISSING');
 else if(state.run_mode==='fresh'&&decision.mode!==expectedMode)add('STORY_VISUAL_DECISION_DRIFT',null,{expected:expectedMode,actual:decision.mode});
 if(state.run_mode==='fresh'&&decision?.mode==='omitted'&&plan.story_visual_decision?.mode==='omitted'&&decision.reason!==plan.story_visual_decision.reason)add('STORY_VISUAL_PHASE1_OMISSION_DRIFT');

 const speech=await readFile(path.join(root,'narration.txt')),present=[],usedDirections=new Set();
 issues.push(...validateStoryVisualLettering(intent,{scenes:(intent.scenes??[]).map(scene=>({id:scene.id,voice:speech.subarray(...(scene.narration_range??[0,0])).toString('utf8')}))}));
 for(const scene of intent.scenes??[]){
  const voice=speech.subarray(...(scene.narration_range??[0,0])).toString('utf8');
  const entities=(scene.entities??[]).filter(e=>e.kind==='story_visual');
  if(entities.length>1)add('STORY_VISUAL_SCENE_DENSITY',scene.id,{count:entities.length});
  for(const beat of scene.art_direction?.visual_coverage?.beats??[])if(Object.hasOwn(beat.layers??{},'lettering'))add('STORY_VISUAL_COVERAGE_LAYER_INVALID',scene.id);
  for(const entity of scene.entities??[])if(['narrative_visual','story_text'].includes(entity.kind)||['narrative_visual','story_text'].includes(entity.visual_role))add('STORY_VISUAL_LEGACY_ENTITY_FORBIDDEN',scene.id,{entity_id:entity.id});
  for(const entity of entities){
   present.push({scene_id:scene.id,entity_id:entity.id});
   const coverage=scene.art_direction?.visual_coverage?.beats??[];
   if(!coverage.some(b=>b.layers?.story_visual?.decision==='use'&&b.layers.story_visual.entity_ids?.includes(entity.id)))add('STORY_VISUAL_COVERAGE_MISSING',scene.id,{entity_id:entity.id});
   const brief=scene.art_direction?.narrative_brief;
   for(const error of validateNarrativeBrief({...scene,voice},brief))add(error.code,scene.id,{entity_id:entity.id,...error});
   if(brief?.phase1_visual_id){
    if(!directionIds.has(brief.phase1_visual_id))add('STORY_VISUAL_PHASE1_DIRECTION_UNKNOWN',scene.id,{entity_id:entity.id,phase1_visual_id:brief.phase1_visual_id});
    else usedDirections.add(brief.phase1_visual_id);
   }
   if(!(scene.events??[]).some(e=>e.target===entity.id&&e.state_before!==e.state_after&&classifyEventChange(e,entity.states?.[e.state_before],entity.states?.[e.state_after])==='visual_change'))add('STORY_VISUAL_SEMANTIC_EVENT_MISSING',scene.id,{entity_id:entity.id});
   const visible=reachableStates(scene,entity).filter(st=>st.visible!==false);
   if(!visible.length)add('STORY_VISUAL_INVISIBLE',scene.id,{entity_id:entity.id});
   for(const st of visible){
    const asset=intent.assets?.[st.asset];
    if(asset?.category!=='story_visual'||!safeRel(asset.path)){add('STORY_VISUAL_ASSET_ROLE_INVALID',scene.id,{entity_id:entity.id,asset:st.asset});continue;}
    if(asset?.creative_origin?.mode!=='phase1_directed'||asset.creative_origin.phase1_visual_id!==brief?.phase1_visual_id)add('STORY_VISUAL_PHASE1_ORIGIN_REQUIRED',scene.id,{entity_id:entity.id,asset:st.asset});
    const filename=path.resolve(root,asset.path);
    if(!filename.startsWith(root+path.sep)){add('STORY_VISUAL_ASSET_PATH_UNSAFE',scene.id);continue;}
    let svg;try{await access(filename);svg=await readFile(filename,'utf8');}
    catch{add('STORY_VISUAL_ASSET_MISSING',scene.id,{asset:asset.path});continue;}
    for(const error of validateStoryVisualKit(svg,{canvas:intent.video,captionSafeZone:scene.layout_contract?.caption_safe_zone,rect:st.transform}))add(error.code,scene.id,{entity_id:entity.id,asset:asset.path});
   }
  }
 }
 if(decision?.mode==='omitted'&&present.length)add('STORY_VISUAL_OMITTED_BUT_PRESENT');
 if(decision?.mode==='required'&&!present.length)add('STORY_VISUAL_REQUIRED_BUT_ABSENT');
 for(const direction of directions)if(!usedDirections.has(direction.id))add('STORY_VISUAL_DIRECTION_NOT_EXECUTED',null,{phase1_visual_id:direction.id});
 return {format:'zodiac-story-visual-presence@2',status:issues.length?'BLOCKED':'PASS',decision:decision?.mode??null,authored_entities:present,issues,not_an_approval:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-story-visual-presence.mjs <workspace>');process.exit(2);}
 try{const result=await validateStoryVisualPresence(root);console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=1;}
 catch(e){console.error(e.stack);process.exitCode=2;}
}
