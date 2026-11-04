#!/usr/bin/env node
// Phase 2 fail-closed presence gate. Structural readiness is NOT Visual Review.
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateNarrativeBrief} from './validate-narrative-brief.mjs';
import {validateNarrativeVisualKit} from './validate-narrative-visual-kit.mjs';

const safeRel=p=>typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!p.split(/[\\/]/u).includes('..')&&!p.includes('\\');
export async function validateNarrativeVisualPresence(workspace){
 const root=path.resolve(workspace),issues=[];
 const add=(code,scene_id,extra={})=>issues.push({code,...(scene_id?{scene_id}:{}),...extra});
 const load=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
 const state=await load('.authoring/pipeline-state.json');
 if(state.run_mode!=='fresh')return {status:'NOT_APPLICABLE',issues,not_an_approval:true};
 let intent;
 try{intent=await load('.authoring/visual-intent.json');}
 catch{add('NARRATIVE_VISUAL_INTENT_MISSING');return {status:'BLOCKED',issues,not_an_approval:true};}
 const decision=intent.taxonomy_version==='narrative_visual@1'?intent.narrative_visual_decision:null;
 if(!decision||!['required','optional','omitted'].includes(decision.mode)||!String(decision.reason??'').trim())add('NARRATIVE_VISUAL_DECISION_MISSING');
 const speech=await readFile(path.join(root,'narration.txt')),present=[];
 for(const scene of intent.scenes??[]){
  const voice=speech.subarray(...(scene.narration_range??[0,0])).toString('utf8');
  const entities=(scene.entities??[]).filter(e=>e.kind==='narrative_visual');
  if(entities.length>1)add('NARRATIVE_VISUAL_SCENE_DENSITY',scene.id,{count:entities.length});
  for(const entity of entities){
   present.push({scene_id:scene.id,entity_id:entity.id});
   const coverage=scene.art_direction?.visual_coverage?.beats??[];
   if(!coverage.some(b=>b.layers?.narrative_visual?.decision==='use'&&b.layers.narrative_visual.entity_ids?.includes(entity.id)))add('NARRATIVE_VISUAL_COVERAGE_MISSING',scene.id,{entity_id:entity.id});
   for(const error of validateNarrativeBrief({...scene,voice},scene.art_direction?.narrative_brief))add(error.code,scene.id,{entity_id:entity.id});
   if(!(scene.events??[]).some(e=>e.target===entity.id&&e.state_before!==e.state_after))add('NARRATIVE_VISUAL_SEMANTIC_EVENT_MISSING',scene.id,{entity_id:entity.id});
   const visible=Object.values(entity.states??{}).filter(st=>st.visible!==false);
   if(!visible.length)add('NARRATIVE_VISUAL_INVISIBLE',scene.id,{entity_id:entity.id});
   for(const st of visible){
    const asset=intent.assets?.[st.asset];
    if(asset?.category!=='narrative_visual'||!safeRel(asset.path)){add('NARRATIVE_VISUAL_ASSET_ROLE_INVALID',scene.id,{entity_id:entity.id,asset:st.asset});continue;}
    const filename=path.resolve(root,asset.path);
    if(!filename.startsWith(root+path.sep)){add('NARRATIVE_VISUAL_ASSET_PATH_UNSAFE',scene.id);continue;}
    let svg;try{await access(filename);svg=await readFile(filename,'utf8');}
    catch{add('NARRATIVE_VISUAL_ASSET_MISSING',scene.id,{asset:asset.path});continue;}
    for(const error of validateNarrativeVisualKit(svg,{canvas:intent.video,captionSafeZone:scene.layout_contract?.caption_safe_zone,rect:st.transform}))add(error.code,scene.id,{entity_id:entity.id,asset:asset.path});
   }
  }
 }
 if(decision?.mode==='required'&&!present.length)add('NARRATIVE_VISUAL_REQUIRED_BUT_ABSENT');
 if(decision?.mode==='omitted'&&present.length)add('NARRATIVE_VISUAL_OMITTED_BUT_PRESENT');
 if(decision?.mode==='required'&&!(intent.scenes??[]).some(s=>s.entities?.some(e=>e.kind==='narrative_visual'&&Object.values(e.states??{}).some(st=>st.visible!==false))))add('NARRATIVE_VISUAL_REQUIRED_BUT_INVISIBLE');
 return {format:'zodiac-narrative-visual-presence@1',status:issues.length?'BLOCKED':'PASS',decision:decision?.mode??null,authored_entities:present,issues,not_an_approval:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-narrative-visual-presence.mjs <workspace>');process.exit(2);}
 try{const result=await validateNarrativeVisualPresence(root);console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=1;}
 catch(e){console.error(e.stack);process.exitCode=2;}
}
