#!/usr/bin/env node
// Deterministic, bounded index of authored scene decisions; no creative generation.
// Source production/plans remain canonical; the index is a read-only context view.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEpisodeCast} from '../../orchestration/episode-handoff.mjs';
import {designToken,compositionHash} from './phase02-composition.mjs';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs=[['production','production.json'],['visual_grammar','visual-grammar-plan.json'],['character_assembly','.authoring/character-assembly-plan.json'],['story_object','.authoring/story-object-plan.json'],['depth','.authoring/depth-composition-plan.json'],['composition','.authoring/scene-art-direction.json'],['resolved','.authoring/scene-composition-resolved.json'],['narrative','.authoring/narrative-plan.json'],['episode_cast','.authoring/episode-cast-plan.json'],['director','.authoring/director-plan.json'],['choreography','.authoring/story-beat-choreography.json']];
const idOf=o=>String(o?.scene_id??o?.id??'');
const ids=a=>(a??[]).map(x=>String(x?.id??x?.entity_id??'')).filter(Boolean);
const unique=(items,code)=>{const seen=new Set();for(const item of items){if(seen.has(item))throw new Error(`${code} ${item}`);seen.add(item);}return seen;};
export function deriveSceneContext(docs,sceneId,{budget=12,detail='bounded'}={}){
 if(!['bounded','full'].includes(detail))throw new Error('SCENE_CONTEXT_DETAIL_INVALID');
 if(!Number.isInteger(budget)||budget<1||budget>50)throw new Error('SCENE_CONTEXT_BUDGET_INVALID');
 const prod=docs.production;if(!Array.isArray(prod?.scenes)||!prod.scenes.length)throw new Error('SCENE_CONTEXT_PRODUCTION_MISSING');
 unique(ids(prod.scenes),'SCENE_CONTEXT_DUPLICATE_SCENE');
 const source=prod.scenes.find(s=>s.id===sceneId);
 if(!source)throw new Error('SCENE_CONTEXT_SCENE_UNKNOWN '+sceneId);
 const plans={};
 for(const key of ['visual_grammar','story_object','depth']){
  const doc=docs[key];if(!doc)continue;
  if(key==='story_object'&&Array.isArray(doc.beats)){unique(doc.beats.map(b=>b.beat_id),'SCENE_CONTEXT_DUPLICATE_BEAT');for(const b of doc.beats)if(!prod.scenes.some(s=>s.id===b.scene_id))throw new Error('SCENE_CONTEXT_PLAN_ORPHAN story_object '+b.scene_id);const beats=doc.beats.filter(b=>b.scene_id===sceneId);if(beats.length)plans.story_object={beat_ids:beats.map(b=>b.beat_id),...(doc.format==='zodiac-story-object-plan@2'?{metaphor_id:doc.central_metaphor?.id,sign_contradiction:doc.central_metaphor?.sign_contradiction,removal_test:doc.central_metaphor?.removal_test,beats:beats.slice(0,budget).map(b=>({beat_id:b.beat_id,object_entity:b.object_entity,added_meaning:b.semantic_delta?.added_meaning,relation_transformation:b.relation_transformation??null})),truncated_beats:Math.max(0,beats.length-budget)}:{})};continue;}
  if(!Array.isArray(doc.scenes))throw new Error('SCENE_CONTEXT_PLAN_INVALID '+key);
  unique(doc.scenes.map(idOf),'SCENE_CONTEXT_DUPLICATE_PLAN_SCENE');
  for(const plan of doc.scenes)if(!prod.scenes.some(s=>s.id===idOf(plan)))throw new Error('SCENE_CONTEXT_PLAN_ORPHAN '+key+' '+idOf(plan));
  const item=doc.scenes.find(p=>idOf(p)===sceneId);
  if(item)plans[key]=item;
 }
 const cast=docs.character_assembly?.characters??[];
 if(docs.character_assembly&&!Array.isArray(cast))throw new Error('SCENE_CONTEXT_CAST_INVALID');
 const characters=(source.entities??[]).filter(e=>e.kind==='character').map(e=>e.id);
 const castItems=cast.filter(c=>characters.includes(c.entity_id));
 const missing=characters.filter(id=>!castItems.some(c=>c.entity_id===id));
 const events=source.events??[];
 const objectIds=(source.entities??[]).filter(e=>['object','prop','interactive_prop'].includes(e.kind)&&!/^env__|^depth__|^decor_/u.test(e.id)).map(e=>e.id);
 const authored=docs.composition?.scenes?.find(s=>s.id===sceneId),diagnostics=[];
 if(docs.resolved&&docs.resolved.source_sha256!==compositionHash(prod))diagnostics.push({code:'SCENE_CONTEXT_RESOLVED_STALE'});
 const concise={format:'zodiac-scene-context@1',scene_id:sceneId,source_is_authoritative:true,
  voice_ref:{file:'production.json',scene_id:sceneId,characters:String(source.voice??'').length},
  character_ids:characters,story_object_ids:objectIds,
  event_ids:ids(events),event_count:events.length,
  decisions:{
   visual_grammar:plans.visual_grammar?{frame_id:plans.visual_grammar.frame_id??null,mechanic_id:plans.visual_grammar.mechanic_id??null,ref:`visual-grammar-plan.json#${sceneId}`} : null,
   story_object:plans.story_object?{ref:`.authoring/story-object-plan.json#${sceneId}`,...(plans.story_object.beat_ids?{...plans.story_object}:{})} : null,
   depth:plans.depth?{profile:plans.depth.profile??plans.depth.environment_profile??null,palette:plans.depth.palette??plans.depth.palette_id??null,ref:`.authoring/depth-composition-plan.json#${sceneId}`} : null,
   cast:castItems.map(c=>({entity_id:c.entity_id,design_intent_ref:`.authoring/character-assembly-plan.json#${c.entity_id}`}))
  },
  missing_cast_decisions:missing,
  token_ref:'design.md',design_token_sha256:docs.design_token?compositionHash(docs.design_token):docs.composition?.design_token_sha256??null,
  components:(authored?.components??[]).slice(0,budget).map(c=>({id:c.id,reason:String(c.reason??'').slice(0,360),voice_anchor:String(c.voice_anchor??'').slice(0,120),visual_role:c.visual_role,native_locator:c.ownership?.locator??null,ref:'.authoring/scene-art-direction.json#'+sceneId+'/'+c.id})),
  component_count:authored?.components?.length??0,truncated_components:Math.max(0,(authored?.components?.length??0)-budget),
  speech_performance:source.performance_context?Object.fromEntries(['delivery','energy','emotion','pace','emphasis'].filter(k=>k in source.performance_context).map(k=>[k,source.performance_context[k]])):null,
  performance_refs:{director:'.authoring/director-plan.json',choreography:'.authoring/story-beat-choreography.json',narrative:'.authoring/narrative-plan.json'},
  spatial_bindings:source.spatial_bindings??[],occlusion_relations:source.occlusion_relations??[],
  asset_reuse:(source.entities??[]).slice(0,budget).map(e=>({entity_id:e.id,state_keys:Object.keys(e.states??{}),unique_asset_count:new Set(Object.values(e.states??{}).map(s=>s.asset).filter(Boolean)).size})),
  diagnostics,
  event_preview:events.slice(0,budget).map(e=>({id:e.id,target:e.target,motion:e.motion??e.desired_motion??null,anchor_type:e.trigger?.type??e.trigger?.source??null})),
  truncated_events:Math.max(0,events.length-budget),
  note:'This index references existing authored decisions. It cannot replace plans, validation, receipts, or human visual approval.'};
 if(docs.narrative?.version==='2.1'){validateEpisodeCast(docs.episode_cast,docs.narrative.episode_scope,prod);const bindings=docs.episode_cast.bindings.filter(b=>b.scene_ids.includes(sceneId)),members=[...new Set(bindings.map(b=>b.member_id))];concise.episode={episode_id:docs.narrative.episode_scope.episode_id,episode_format:docs.narrative.episode_scope.episode_format,scope_sha256:compositionHash(docs.narrative.episode_scope),member_ids:members,bindings,lenses:docs.narrative.member_lenses.filter(l=>members.includes(l.member_id)).map(l=>({member_id:l.member_id,identity_mechanism:l.identity_mechanism,misread_vs_reframe:l.misread_vs_reframe,ref:'.authoring/narrative-plan.json#'+l.member_id}))};}
 if(detail==='full'){concise.design_token=docs.design_token??null;concise.scene=source;concise.art_direction=authored??null;}
 return concise;
}
export async function sceneContextWorkspace(workspace,sceneId,opts={}){
 const root=path.resolve(workspace),docs={},sources={};
 for(const [key,relative] of inputs){try{const raw=await readFile(path.join(root,relative));sources[relative]=digest(raw);docs[key]=JSON.parse(raw.toString('utf8'));}catch(e){if(e.code==='ENOENT'&&key!=='production')continue;throw e;}}
 try{const raw=await readFile(path.join(root,'design.md'));sources['design.md']=digest(raw);docs.design_token=designToken(raw.toString('utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const result={...deriveSceneContext(docs,sceneId,opts),source_sha256:sources};
 for(const [file,expected] of Object.entries(opts.expectedSourceSha256??{}))if(sources[file]!==expected)result.diagnostics.push({code:'SCENE_CONTEXT_SOURCE_STALE',file});
 result.context_status=result.diagnostics.length?'STALE':'SOURCE_READ';return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),root=args[0],sceneId=args[1],budgetIndex=args.indexOf('--budget');
 try{if(!root||!sceneId)throw new Error('Usage: node derive-scene-context.mjs <workspace> <scene_id> [--budget 12]');
  const budget=budgetIndex>=0?Number(args[budgetIndex+1]):12;
  console.log(JSON.stringify(await sceneContextWorkspace(root,sceneId,{budget,detail:args.includes('--full')?'full':'bounded'}),null,2));
 }catch(e){console.error('SCENE_CONTEXT_BLOCKED '+e.message);process.exitCode=2;}
}
