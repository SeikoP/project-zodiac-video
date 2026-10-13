#!/usr/bin/env node
// Generic authoring-only gate; no sign-specific entity, shot quotas or forced story objects.
import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {hasPrimarySceneSet} from '../scene-set/scene-set-detection.mjs';
import {validateVisualCoverage} from './validate-visual-coverage.mjs';
const normalize=s=>String(s??'').normalize('NFC').replace(/\s+/gu,' ').trim();
const compact=s=>normalize(s).replace(/\s+/gu,'');
export function validatePhase02ArtDirection(production,plan,narration,palettes,environments,{requireCoverage=false}={}){
 const issues=[];const fail=(code,scene_id=null)=>issues.push({code,...(scene_id?{scene_id}:{})});
 if(plan?.format!=='zodiac-scene-art-direction@2')fail('FORMAT_INVALID');
 const scenes=production?.scenes??[],directed=plan?.scenes??[];
 if(scenes.length!==directed.length||!Array.isArray(directed))fail('ART_SCENE_COUNT_MISMATCH');
 const ids=new Set();
 for(let i=0;i<directed.length;i++){
  const d=directed[i],source=scenes[i],scene_id=String(d?.id??i);
  if(ids.has(scene_id))fail('ART_DUPLICATE_SCENE',scene_id);ids.add(scene_id);
  if(!source||source.id!==d?.id)fail('ART_SCENE_ORDER_MISMATCH',scene_id);
  if(normalize(source?.voice)!==normalize(d?.voice))fail('ART_VOICE_MISMATCH',scene_id);
  if(!Object.prototype.hasOwnProperty.call(palettes?.palettes??{},d?.palette_id))fail('PALETTE_UNKNOWN',scene_id);
  const archiveFrame=source?.environment?.mode==='archive_frame',primarySceneSet=hasPrimarySceneSet(source,production),sceneSetId=source?.environment?.scene_set_id??source?.environment?.scene_set?.id;
  if(primarySceneSet){
   const accents=source.environment.scene_accents??[];
   if(!Array.isArray(accents))fail('SCENE_ACCENT_SELECTION_INVALID',scene_id);
   else if(!accents.length&&!String(source.environment.scene_accent_omission_reason??'').trim())fail('SCENE_ACCENT_DECISION_MISSING',scene_id);
   if(!sceneSetId||d?.scene_set_id!==sceneSetId)fail('SCENE_SET_ID_MISMATCH',scene_id);
   if(d?.environment_profile!==undefined&&d?.environment_profile!==null)fail('LEGACY_ENVIRONMENT_PROFILE_ON_SCENE_SET',scene_id);
  }else if(!archiveFrame){
   if(!(environments?.profiles??[]).includes(d?.environment_profile))fail('ENVIRONMENT_UNKNOWN',scene_id);
   if(source?.environment?.profile!==d?.environment_profile)fail('ENVIRONMENT_PROFILE_MISMATCH',scene_id);
  }
  if(!String(d?.performer??'').trim()||!String(d?.action??'').trim()||!String(d?.semantic_goal??'').trim())fail('PERFORMANCE_INTENT_MISSING',scene_id);
  if(!String(d?.color_reason??'').trim()||!String(d?.environment_reason??'').trim())fail('ART_REASON_MISSING',scene_id);
  if(source)issues.push(...validateVisualCoverage(source,d,{required:requireCoverage}));
  const story=d?.story_object;
  if(story && (!['prop','symbolic','story_object'].includes(story.render_layer)||story.replaces_environment===true))fail('STORY_OBJECT_BACKGROUND_FORBIDDEN',scene_id);
  if(story && (!String(story.id??'').trim()||!String(story.voice_anchor??'').trim()||!String(d.voice??'').includes(story.voice_anchor)))fail('STORY_OBJECT_VOICE_ANCHOR_MISSING',scene_id);
 }
 if(compact(scenes.map(s=>s.voice).join(''))!==compact(narration))fail('APPROVED_NARRATION_MISMATCH');
 return {format:'zodiac-art-direction-qc@2',status:issues.length?'BLOCKED':'PASS',scenes:directed.length,issues};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const ws=process.argv[2];if(!ws){console.error('Usage: node validate-phase02-art-direction.mjs <workspace>');process.exit(2);}
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 try{const load=async f=>JSON.parse(await readFile(f,'utf8'));
 const [production,plan,narration,palettes,environments]=await Promise.all([
 load(path.join(ws,'production.json')),load(path.join(ws,'.authoring/scene-art-direction.json')),readFile(path.join(ws,'narration.txt'),'utf8'),load(path.join(root,'art-direction/palette-registry.json')),load(path.join(root,'art-direction/environment-registry.json'))]);
 const state=await load(path.join(ws,'.authoring/pipeline-state.json'));
 const result=validatePhase02ArtDirection(production,plan,narration,palettes,environments,{requireCoverage:state.run_mode==='fresh'});console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;}
 catch(e){console.error('ART_DIRECTION_PREFLIGHT_ERROR '+e.message);process.exitCode=2;}
}
