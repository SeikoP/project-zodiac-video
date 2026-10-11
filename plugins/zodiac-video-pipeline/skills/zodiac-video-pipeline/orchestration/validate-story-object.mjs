#!/usr/bin/env node
// Static semantic QA: do actual native symbolic/physical entities carry the story, or are
// they generic decorative reactions? This is NOT a Remotion temporal proof.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {traceSceneStates} from './scene-state-trace.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
import {newFresh} from './phase01-artifacts.mjs';
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

export function evaluateObjectProgression(plan,trace){const issues=[],decision=plan?.decision;if(decision&&(!['required','optional','omitted'].includes(decision.mode)||!decision.reason?.trim()||!decision.review_ref?.trim()))issues.push({code:'STORY_OBJECT_DECISION_INVALID'});
 if(decision?.mode==='omitted'&&!issues.length)return {structural_status:'OMITTED_EXPLICIT',review_required:true,issues};
 const ids=new Set((plan?.beats??[]).flatMap(b=>b.object_event_ids??[]));const changes=trace.filter(t=>ids.has(t.event_id)&&t.change==='visual_change');const deltas=new Set(changes.map(t=>JSON.stringify([t.resolved_before,t.resolved_after])));
 if(!plan?.beats?.length)issues.push({code:'STORY_OBJECT_PLAN_MISSING'});else if(deltas.size<2)issues.push({code:'STORY_OBJECT_REPEATED_REVEAL'});
 return {structural_status:issues.length?'NEEDS_REVISION':'PASS',review_required:true,issues};}

export function validateStoryObjectPlan(plan, production, narration){
 const issues=[];
 const v2=plan?.format==='zodiac-story-object-plan@2';
 if(!v2&&plan?.format!=='zodiac-story-object-plan@1')issue(issues,'FORMAT_INVALID');
 if(plan?.narration_sha256!==sha(narration))issue(issues,'NARRATION_HASH_MISMATCH');
 if(plan?.style_token!==TOKEN||production?.visual_system?.style_token?.id!==TOKEN)issue(issues,'STYLE_TOKEN_MISMATCH');
 const metaphor=plan?.central_metaphor;const objectInstances=Array.isArray(plan?.object_instances)?plan.object_instances:[];
 if(!metaphor?.id||!meaningful(metaphor.meaning)||!meaningful(metaphor.payoff_transformation))issue(issues,'STORY_METAPHOR_INVALID');
 if(v2){
  for(const k of ['sign_contradiction','removal_test'])if(!meaningful(metaphor?.[k]))issue(issues,'STORY_OBJECT_VALUE_MISSING',k);
  const selection=plan.selection,candidates=Array.isArray(selection?.candidates)?selection.candidates:[],candidateIds=new Set(candidates.map(c=>c?.id));
  if(!meaningful(selection?.rationale)||selection?.selected_id!==metaphor?.id||!candidateIds.has(selection?.selected_id)||candidateIds.size!==candidates.length||(!candidates.length)||(candidates.length===1&&!meaningful(selection?.comparison_not_needed_reason)))issue(issues,'STORY_OBJECT_SELECTION_INVALID');
  for(const c of candidates){if(!c?.id||['object_idea','sign_specificity','removal_test'].some(k=>!meaningful(c?.[k]))||(c.id!==selection.selected_id&&!meaningful(c.rejected_reason)))issue(issues,'STORY_OBJECT_CANDIDATE_INVALID',c?.id);}
 }
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
  if(v2){const delta=beat.semantic_delta;if(!delta||['before_read','after_read','added_meaning'].some(k=>!meaningful(delta[k]))||normalized(delta.before_read)===normalized(delta.after_read))issue(issues,'STORY_OBJECT_ADDED_MEANING_MISSING',key);const instances=objectInstances.filter(x=>x?.scene_id===beat.scene_id&&x?.entity_id===beat.object_entity);if(instances.length!==1||instances[0].metaphor_id!==metaphor?.id)issue(issues,'OBJECT_INSTANCE_LINEAGE_INVALID',key);}
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
  const symbolicMode=beat.presentation_mode==='thought_metaphor'||beat.presentation_mode==='visual_cutaway';const allowedCategories=symbolicMode?new Set(['prop','effect']):new Set(['prop']);
  if(!object||!['object','prop','interactive_prop','effect'].includes(object.kind)||!objectAssets.length||objectAssets.some(a=>!allowedCategories.has(a.meta?.category)))issue(issues,'OBJECT_ENTITY_INVALID',key);
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
  }else if(!v2)issue(issues,'EFFECT_SEMANTICS_INVALID',key);
 }
 if(usedScenes.size<2)issue(issues,'STORY_SCENE_REPETITION');
 if(!v2&&objectIdentities.size>1)issue(issues,'OBJECT_METAPHOR_IDENTITY_DRIFT');
 if(stages[0]!=='setup'||stages.at(-1)!=='payoff'||!stages.includes('friction')||stages.indexOf('friction')<=0||stages.lastIndexOf('friction')>=stages.length-1)issue(issues,'STORY_PROGRESS_INVALID');
 const payoff=beats.at(-1);
 if(!payoff||payoff.role!=='payoff'||payoff.beat_id!==plan?.payoff_beat_id||(!v2&&payoff.effect?.semantic_role!=='callback'))issue(issues,'PAYOFF_CALLBACK_INVALID');
 const setupTier=beats.find(x=>x.role==='setup')?.effect?.tier;
 const frictionTier=beats.find(x=>x.role==='friction')?.effect?.tier;
 const payoffTier=payoff?.effect?.tier;
 if(!v2&&!(setupTier<frictionTier&&frictionTier<payoffTier))issue(issues,'EFFECT_ESCALATION_INVALID');
 if(v2){const relation=payoff?.relation_transformation;if(!relation||['from','to','meaning'].some(k=>!meaningful(relation[k]))||normalized(relation.from)===normalized(relation.to))issue(issues,'STORY_OBJECT_PAYOFF_RELATION_MISSING');const unique=new Set();for(const instance of objectInstances){if(!instance){issue(issues,'OBJECT_INSTANCE_LINEAGE_INVALID');continue;}const key=instance.scene_id+'/'+instance.entity_id;if(unique.has(key)||instance.metaphor_id!==metaphor?.id||!scenes.get(instance.scene_id)?.entities?.some(e=>e.id===instance.entity_id))issue(issues,'OBJECT_INSTANCE_LINEAGE_INVALID',key);unique.add(key);}}
 const result={creative_quality_verified:false,format:'zodiac-story-object-qc@1',status:issues.length?'BLOCKED':'PASS',beats:beats.length,scenes:usedScenes.size,metaphor:metaphor?.id??null,issues};
 return result;
}
const maybeRead=async p=>readFile(p).catch(e=>{if(e?.code==='ENOENT')return null;throw e;});
export async function validateStoryObjectWorkspace(root,{writeReceipt=false}={}){
 const base=path.resolve(root),dirname=path.join(base,'.authoring');
 const intentBytes=await maybeRead(path.join(dirname,'visual-intent.json'));
 const decision=intentBytes?JSON.parse(intentBytes).story_object_decision:null;
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
 if(decision){const ruling=evaluateObjectProgression({decision},[]);if(decision.mode==='omitted'){const state=stateBytes?JSON.parse(stateBytes):{};if(state.flags?.story_object_required===true||required&&JSON.parse(required).required===true)throw Error('STORY_OBJECT_DECISION_FLAG_CONFLICT');if(ruling.structural_status!=='OMITTED_EXPLICIT')throw Error('STORY_OBJECT_DECISION_INVALID');return {format:'zodiac-story-object-qc@1',status:'OMITTED_EXPLICIT',creative_quality_verified:false,issues:[]};}}
 if(!spec){if(mandatory)throw Error('STORY_OBJECT_PLAN_MISSING');return {format:'zodiac-story-object-qc@1',status:'LEGACY_NOT_APPLICABLE',beats:0,issues:[]};}
 let plan,production;
 try{plan=JSON.parse(spec);production=JSON.parse(await readFile(path.join(base,'production.json'),'utf8'));}catch(e){throw Error('STORY_OBJECT_INPUT_INVALID '+e.message)}
 const narration=await readFile(path.join(base,'narration.txt'));
 if(stateBytes&&newFresh(JSON.parse(stateBytes))&&plan.format!=='zodiac-story-object-plan@2')throw Error('STORY_OBJECT_V2_REQUIRED');
 const result=validateStoryObjectPlan(plan,production,narration);
 if(decision){const trace=production.scenes.flatMap(scene=>traceSceneStates(scene).map(t=>{const e=scene.entities.find(e=>e.id===scene.events.find(v=>v.id===t.event_id).target);return {...t,resolved_before:e.states[t.before[e.id]],resolved_after:e.states[t.after[e.id]]};}));const progress=evaluateObjectProgression({...plan,decision},trace);result.issues.push(...progress.issues);if(progress.structural_status==='NEEDS_REVISION')result.status='BLOCKED';}
 if(writeReceipt)await writeFile(path.join(dirname,'story-object-qc.json'),JSON.stringify(result,null,2)+'\n');
 if(result.status!=='PASS')throw Error('STORY_OBJECT_QC_BLOCKED '+result.issues.map(x=>x.code+':'+x.at).join(','));
 return result;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-story-object.mjs <workspace> [--write]');process.exitCode=2;}else try{const report=await validateStoryObjectWorkspace(root,{writeReceipt:process.argv.includes('--write')});console.log(JSON.stringify(report));}catch(e){console.error(e.message);process.exitCode=1;}}
