#!/usr/bin/env node
// Deterministic, bounded index of authored scene decisions; no creative generation.
// Source production/plans remain canonical; the index is a read-only context view.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs=[['production','production.json'],['visual_grammar','.authoring/visual-grammar-plan.json'],['character_assembly','.authoring/character-assembly-plan.json'],['story_object','.authoring/story-object-plan.json'],['depth','.authoring/depth-composition-plan.json']];
const idOf=o=>String(o?.scene_id??o?.id??'');
const ids=a=>(a??[]).map(x=>String(x?.id??x?.entity_id??'')).filter(Boolean);
const unique=(items,code)=>{const seen=new Set();for(const item of items){if(seen.has(item))throw new Error(`${code} ${item}`);seen.add(item);}return seen;};
export function deriveSceneContext(docs,sceneId,{budget=12}={}){
 if(!Number.isInteger(budget)||budget<1||budget>50)throw new Error('SCENE_CONTEXT_BUDGET_INVALID');
 const prod=docs.production;if(!Array.isArray(prod?.scenes)||!prod.scenes.length)throw new Error('SCENE_CONTEXT_PRODUCTION_MISSING');
 unique(ids(prod.scenes),'SCENE_CONTEXT_DUPLICATE_SCENE');
 const source=prod.scenes.find(s=>s.id===sceneId);
 if(!source)throw new Error('SCENE_CONTEXT_SCENE_UNKNOWN '+sceneId);
 const plans={};
 for(const key of ['visual_grammar','story_object','depth']){
  const doc=docs[key];if(!doc)continue;
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
 const objectIds=(source.entities??[]).filter(e=>e.kind==='object'&&!/^env__|^depth__|^decor_/u.test(e.id)).map(e=>e.id);
 const concise={format:'zodiac-scene-context@1',scene_id:sceneId,source_is_authoritative:true,
  voice_ref:{file:'production.json',scene_id:sceneId,characters:String(source.voice??'').length},
  character_ids:characters,story_object_ids:objectIds,
  event_ids:ids(events),event_count:events.length,
  decisions:{
   visual_grammar:plans.visual_grammar?{frame_id:plans.visual_grammar.frame_id??null,mechanic_id:plans.visual_grammar.mechanic_id??null,ref:`.authoring/visual-grammar-plan.json#${sceneId}`} : null,
   story_object:plans.story_object?{ref:`.authoring/story-object-plan.json#${sceneId}`} : null,
   depth:plans.depth?{profile:plans.depth.profile??plans.depth.environment_profile??null,palette:plans.depth.palette??plans.depth.palette_id??null,ref:`.authoring/depth-composition-plan.json#${sceneId}`} : null,
   cast:castItems.map(c=>({entity_id:c.entity_id,design_intent_ref:`.authoring/character-assembly-plan.json#${c.entity_id}`}))
  },
  missing_cast_decisions:missing,
  event_preview:events.slice(0,budget).map(e=>({id:e.id,target:e.target,motion:e.motion??e.desired_motion??null,anchor_type:e.trigger?.type??null})),
  truncated_events:Math.max(0,events.length-budget),
  note:'This index references existing authored decisions. It cannot replace plans, validation, receipts, or human visual approval.'};
 return concise;
}
export async function sceneContextWorkspace(workspace,sceneId,opts={}){
 const root=path.resolve(workspace),docs={},sources={};
 for(const [key,relative] of inputs){try{const raw=await readFile(path.join(root,relative));sources[relative]=digest(raw);docs[key]=JSON.parse(raw.toString('utf8'));}catch(e){if(e.code==='ENOENT'&&key!=='production')continue;throw e;}}
 return {...deriveSceneContext(docs,sceneId,opts),source_sha256:sources};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),root=args[0],sceneId=args[1],budgetIndex=args.indexOf('--budget');
 try{if(!root||!sceneId)throw new Error('Usage: node derive-scene-context.mjs <workspace> <scene_id> [--budget 12]');
  const budget=budgetIndex>=0?Number(args[budgetIndex+1]):12;
  console.log(JSON.stringify(await sceneContextWorkspace(root,sceneId,{budget}),null,2));
 }catch(e){console.error('SCENE_CONTEXT_BLOCKED '+e.message);process.exitCode=2;}
}
