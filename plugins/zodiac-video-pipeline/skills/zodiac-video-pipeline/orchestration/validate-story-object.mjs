#!/usr/bin/env node
// Static semantic QA: do actual native props/effects carry the story, or are
// they generic decorative reactions? This is NOT a Remotion temporal proof.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const TOKEN='zodiac-paper-doodle-meme-v4';
const ROLES=new Set(['setup','friction','payoff']);
const EFFECT_ROLES=new Set(['compare','block','reveal','pressure','split','highlight','callback','collapse']);
const normalized = s=>String(s??'').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/gu,' ').trim();
const meaningful = s=>typeof s==='string'&&s.trim().length>=10;
const issue=(issues,code,at='')=>issues.push({code,at});
const eventMotion =e=>typeof e.motion==='string'?e.motion:e.motion?.preset??e.desired_motion??'hold';
const hasMotion =(e,entity)=>{
 const motion=eventMotion(e);
 if(motion!=='hold'&&motion!=='state_swap')return true;
 const a=entity?.states?.[e.state_before],b=entity?.states?.[e.state_after];
 return !!a&&!!b&&!isDeepStrictEqual(a,b);
};

export function validateStoryObjectPlan(plan, production, narration){
 const issues=[];
 if(plan?.format!=='zodiac-story-object-plan@1')issue(issues,'FORMAT_INVALID');
 if(plan?.narration_sha256!==sha(narration))issue(issues,'NARRATION_HASH_MISMATCH');
 if(plan?.style_token!==TOKEN||production?.visual_system?.style_token?.id!==TOKEN)issue(issues,'STYLE_TOKEN_MISMATCH');
 const metaphor=plan?.central_metaphor;
 if(!metaphor?.id||!meaningful(metaphor.meaning)||!meaningful(metaphor.payoff_transformation))issue(issues,'STORY_METAPHOR_INVALID');
 const scenes=new Map((production?.scenes??[]).map(s=>[s.id,s]));
 const beats=Array.isArray(plan?.beats)?plan.beats:[];
 if(beats.length<3)issue(issues,'STORY_TURNS_INSUFFICIENT');
 const seen=new Set(),usedScenes=new Set(),visualChanges=new Set(),objectIdentities=new Set();const stages=[];
 for(const beat of beats){
  const key=String(beat?.beat_id??'?');
  if(seen.has(key)||!/^[-\w]{2,100}$/u.test(key))issue(issues,'BEAT_ID_INVALID',key);
  seen.add(key);
  if(!ROLES.has(beat?.role))issue(issues,'STORY_ROLE_INVALID',key);
  stages.push(beat.role);
  if(!meaningful(beat?.visual_change)||!meaningful(beat?.narrative_meaning))issue(issues,'DECORATIVE_SEMANTIC_BEAT',key);
  const change=normalized(beat?.visual_change);
  if(visualChanges.has(change))issue(issues,'STORY_VISUAL_REPETITION',key);
  visualChanges.add(change);
  const scene=scenes.get(beat?.scene_id);
  if(!scene){issue(issues,'SCENE_MISSING',key);continue;}
  usedScenes.add(scene.id);
  if(!normalized(beat.voice_anchor)||!normalized(scene.voice).includes(normalized(beat.voice_anchor)))issue(issues,'VOICE_ANCHOR_MISSING',key);
  const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
  const events=new Map((scene.events??[]).map(e=>[e.id,e]));
  objectIdentities.add(beat.object_entity);
  const object=entities.get(beat.object_entity);
  const objectStates=Object.values(object?.states??{});
  const objectAssets=objectStates.map(s=>({id:s.asset,meta:production?.assets?.[s.asset]}));
  if(!object||!['object','prop','interactive_prop'].includes(object.kind)||!objectAssets.length||objectAssets.some(a=>a.meta?.category!=='prop'))issue(issues,'OBJECT_ENTITY_INVALID',key);
  else if(objectAssets.some(a=>a.meta?.style_id!==TOKEN))issue(issues,'ASSET_STYLE_TOKEN_MISMATCH',key);
  if(!Array.isArray(beat.object_event_ids)||!beat.object_event_ids.length)issue(issues,'OBJECT_EVENT_MISSING',key);
  let material=false;
  for(const eventId of beat.object_event_ids??[]){
   const e=events.get(eventId);
   if(!e||e.target!==beat.object_entity)issue(issues,'OBJECT_EVENT_MISSING',`${key}/${eventId}`);
   else if(hasMotion(e,object))material=true;
  }
  if(!material && (beat.object_event_ids??[]).some(id=>events.get(id)?.target===beat.object_entity))issue(issues,'OBJECT_EVENT_DECORATIVE',key);
  if(beat.effect){
   const fx=beat.effect;
   if(!EFFECT_ROLES.has(fx.semantic_role)||![1,2,3].includes(fx.tier))issue(issues,'EFFECT_SEMANTICS_INVALID',key);
   const support=entities.get(fx.entity_id);
   const supportAssets=Object.values(support?.states??{}).map(s=>production?.assets?.[s.asset]);
   if(!support||supportAssets.length===0||supportAssets.some(a=>a?.category!=='effect'))issue(issues,'EFFECT_ENTITY_INVALID',key);
   else if(supportAssets.some(a=>a?.style_id!==TOKEN))issue(issues,'ASSET_STYLE_TOKEN_MISMATCH',key);
   if(!Array.isArray(fx.event_ids)||!fx.event_ids.length)issue(issues,'EFFECT_EVENT_MISSING',key);
   const transitions=[];
   for(const eventId of fx.event_ids??[]){const e=events.get(eventId);
    if(!e||e.target!==fx.entity_id)issue(issues,'EFFECT_EVENT_MISSING',`${key}/${eventId}`);
    else transitions.push(e.action);
   }
   if(transitions.length && (!transitions.includes('enter')||!transitions.includes('release')))issue(issues,'EFFECT_LIFECYCLE_INVALID',key);
   if(support && !(scene.spatial_bindings??[]).some(binding=>binding.entity===support.id && (binding.anchor===object?.id||entities.has(binding.anchor))))issue(issues,'EFFECT_CONTACT_MISSING',key);
  }else issue(issues,'EFFECT_SEMANTICS_INVALID',key);
 }
 if(usedScenes.size<2)issue(issues,'STORY_SCENE_REPETITION');
 if(objectIdentities.size>1)issue(issues,'OBJECT_METAPHOR_IDENTITY_DRIFT');
 if(stages[0]!=='setup'||stages.at(-1)!=='payoff'||!stages.includes('friction')||stages.indexOf('friction')<=0||stages.lastIndexOf('friction')>=stages.length-1)issue(issues,'STORY_PROGRESS_INVALID');
 const payoff=beats.at(-1);
 if(!payoff||payoff.role!=='payoff'||payoff.beat_id!==plan?.payoff_beat_id||payoff.effect?.semantic_role!=='callback')issue(issues,'PAYOFF_CALLBACK_INVALID');
 const setupTier=beats.find(x=>x.role==='setup')?.effect?.tier;
 const frictionTier=beats.find(x=>x.role==='friction')?.effect?.tier;
 const payoffTier=payoff?.effect?.tier;
 if(!(setupTier<frictionTier&&frictionTier<payoffTier))issue(issues,'EFFECT_ESCALATION_INVALID');
 const result={format:'zodiac-story-object-qc@1',status:issues.length?'BLOCKED':'PASS',beats:beats.length,scenes:usedScenes.size,metaphor:metaphor?.id??null,issues};
 return result;
}
const maybeRead=async p=>readFile(p).catch(e=>{if(e?.code==='ENOENT')return null;throw e;});
export async function validateStoryObjectWorkspace(root,{writeReceipt=false}={}){
 const base=path.resolve(root),dirname=path.join(base,'.authoring');
 const required=await maybeRead(path.join(dirname,'story-object-required.json'));
 const spec=await maybeRead(path.join(dirname,'story-object-plan.json'));
 const stateBytes=await maybeRead(path.join(dirname,'pipeline-state.json'));
 let mandatory=false;
 if(required){let entry;try{entry=JSON.parse(required)}catch{throw Error('STORY_OBJECT_REQUIRED_CONFIG_INVALID')};mandatory=entry?.required===true;}
 if(stateBytes){
  let state;try{state=JSON.parse(stateBytes)}catch{throw Error('STORY_OBJECT_STATE_INVALID')}
  const v=/^(\d+)\.(\d+)\.(\d+)(?:$|[-+])/.exec(String(state.plugin_version??''));
  const modern=v&&(Number(v[1])>2||Number(v[1])===2&&(Number(v[2])>4||Number(v[2])===4&&Number(v[3])>=4));
  if(state.flags?.story_object_required===true||(modern&&state.run_mode==='fresh'))mandatory=true;
 }
 if(!spec){if(mandatory)throw Error('STORY_OBJECT_PLAN_MISSING');return {format:'zodiac-story-object-qc@1',status:'LEGACY_NOT_APPLICABLE',beats:0,issues:[]};}
 let plan,production;
 try{plan=JSON.parse(spec);production=JSON.parse(await readFile(path.join(base,'production.json'),'utf8'));}catch(e){throw Error('STORY_OBJECT_INPUT_INVALID '+e.message)}
 const narration=await readFile(path.join(base,'narration.txt'));
 const result=validateStoryObjectPlan(plan,production,narration);
 if(writeReceipt)await writeFile(path.join(dirname,'story-object-qc.json'),JSON.stringify(result,null,2)+'\n');
 if(result.status!=='PASS')throw Error('STORY_OBJECT_QC_BLOCKED '+result.issues.map(x=>x.code+':'+x.at).join(','));
 return result;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-story-object.mjs <workspace> [--write]');process.exitCode=2;}else try{const report=await validateStoryObjectWorkspace(root,{writeReceipt:process.argv.includes('--write')});console.log(JSON.stringify(report));}catch(e){console.error(e.message);process.exitCode=1;}}
