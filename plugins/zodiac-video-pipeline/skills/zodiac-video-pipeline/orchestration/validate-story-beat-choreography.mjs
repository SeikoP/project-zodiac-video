#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateEffectLifecycle} from '../references/asset-library-v4/memes/effect-lifecycle.mjs';
const workspace=process.argv[2];
if(!workspace){console.error('Usage: node validate-story-beat-choreography.mjs <workspace>');process.exit(2)}
const load=async p=>JSON.parse(await readFile(path.join(workspace,p),'utf8'));
try {
 const production=await load('production.json');const plan=await load('.authoring/story-beat-choreography.json');const problems=[];
 if(plan.format!=='zodiac-story-beat-choreography@1')problems.push('FORMAT_INVALID');
 for(const beat of plan.beats??[]){
  const scene=production.scenes?.find(s=>s.id===beat.scene_id);
  if(!scene){problems.push('SCENE_NOT_FOUND '+beat.scene_id);continue;}
  if(!['observation','noticing','barrier','subtext','contrast','distance','realization','payoff'].includes(beat.semantic_role))problems.push('ROLE_UNDEFINED '+beat.scene_id);
  if(!scene.voice.includes(beat.voice_anchor)||!scene.voice.includes(beat.release_anchor))problems.push('ANCHOR_MISSING '+beat.scene_id);
  const entity=scene.entities?.find(e=>e.id===beat.entity_id);
  if(!entity||entity.kind!=='effect')problems.push('EFFECT_ENTITY_MISSING '+beat.scene_id);
  try{validateEffectLifecycle(scene,beat,production.assets);}catch(e){problems.push(e.message+' '+beat.scene_id);}
  const ev=(scene.events??[]).filter(e=>e.target===beat.entity_id);
  if(ev.filter(e=>e.action==='enter').length!==1||ev.filter(e=>e.action==='release').length!==1)problems.push('LIFECYCLE_MISSING '+beat.scene_id);
  if(entity&&production.assets?.[entity.states?.on?.asset]?.category!=='effect')problems.push('NATIVE_ASSET_MISSING '+beat.scene_id);
  
 }
 const result={format:'zodiac-story-beat-qc@1',status:problems.length?'BLOCKED':'PASS',beats:plan.beats?.length??0,problems};
 console.log(JSON.stringify(result,null,2));process.exit(problems.length?1:0);
}catch(e){console.error(e.message);process.exit(2)}
