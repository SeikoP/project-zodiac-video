#!/usr/bin/env node
// Plugin-owned Phase 03 production boundary, stored OUTSIDE the Job@5 ZIP.
// Only facts available before local TTS are required here.
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {validateProductionModel} from './production-model.mjs';
import {assessSemanticEvent} from './semantic-motion-qa.mjs';
import {projectLegacyIR,assertRoundTrip} from './project-legacy-ir.mjs';
import {compileJobV5} from './compile-job-v5.mjs';
import {fileURLToPath} from 'node:url';
import {migrateLegacyJob5} from './migrate-production-model.mjs';
import {validateStoryObjectWorkspace} from './validate-story-object.mjs';

const sha=buf=>createHash('sha256').update(buf).digest('hex');
const fail=(code,detail='')=>{throw new Error(code+(detail?' '+detail:''));};
const recordFor=(state,phase)=>state?.review_receipts?.find(r=>r.phase_id===phase&&r.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof?.ref==='string'&&r.proof.ref.trim()&&!r.proof.ref.includes('<'));
async function filesUnder(dir,relative=''){
 const result=[];
 for(const entry of await readdir(path.join(dir,relative),{withFileTypes:true})){
  if(entry.isSymbolicLink())fail('REVIEW_SOURCE_SYMLINK',entry.name);
  const rel=path.posix.join(relative,entry.name);
  if(entry.isDirectory())result.push(...await filesUnder(dir,rel));
  else if(entry.isFile())result.push(rel);
  else fail('REVIEW_SOURCE_NON_FILE',rel);
 }
 return result;
}
export async function sourceReviewFingerprint(root){
 const base=path.resolve(root),files=['production.json','design.md','narration.txt'];
 files.push(...(await filesUnder(base,'assets')));
 for(const rel of ['publish/publish.json','publish/publish-copy.txt']){
  try{await readFile(path.join(base,rel));files.push(rel);}catch(e){if(e?.code!=='ENOENT')throw e;}
 }
 for(const rel of ['.authoring/story-object-plan.json','.authoring/story-object-required.json']){
  try{await readFile(path.join(base,rel));files.push(rel);}catch(e){if(e?.code!=='ENOENT')throw e;}
 }
 files.sort();
 const digest=createHash('sha256');
 for(const rel of files){const bytes=await readFile(path.join(base,rel));digest.update(`${rel}\0${bytes.length}\0`);digest.update(bytes);digest.update('\0');}
 return {sha256:digest.digest('hex'),files:files.length,narration_sha256:sha(await readFile(path.join(base,'narration.txt')))};
}
export async function buildReviewLock(root,state){
 const content=recordFor(state,'01-content'),visual=recordFor(state,'02-visual-production');
 if(!content||!visual)fail('PHASE_APPROVAL_MISSING','require actual user_message receipts for 01 and 02');
 if(state.phases){for(const id of ['01-content','02-visual-production'])if(!['PASS','SKIPPED_REUSED'].includes(state.phases[id]?.status))fail('APPROVAL_PHASE_NOT_PASSED',id);}
 const source=await sourceReviewFingerprint(root);
 return {format:'zodiac-phase02-review-lock@1',source,approval:{content:content.proof.ref,visual:visual.proof.ref},run_id:String(state.run_id??'')};
}
export async function assertReviewLock(sourceRoot,lock){
 if(lock?.format!=='zodiac-phase02-review-lock@1'||!lock.approval?.content||!lock.approval?.visual||!/^[a-f0-9]{64}$/.test(lock.source?.sha256??''))fail('REVIEW_PROOF_INVALID');
 const current=await sourceReviewFingerprint(sourceRoot);
 if(current.sha256!==lock.source.sha256||current.narration_sha256!==lock.source.narration_sha256)fail('REVIEW_SOURCE_CHANGED',`approved=${lock.source.sha256} current=${current.sha256}`);
 return {ok:true,source:current};
}
export function assertBrandIntent(token){
 const brand=token?.brand_overlay,caption=token?.caption_emphasis;
 if(brand?.enabled!==true||brand.text!=='✦ bungmoto'||brand.font_family!=='Patrick Hand'||caption?.font_family!=='Patrick Hand')fail('BRAND_INTENT_INVALID','require ✦ bungmoto and Patrick Hand');
 return {ok:true};
}
export function assertProductionSemantics(ir){
 const issues=[];
 for(const scene of ir?.scenes??[]){
  const bindings=new Map((scene.spatial_bindings??[]).map(b=>[b.entity,b]));
  const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
  for(const event of scene.events??[]){
   if(event.desired_motion==='slide'){
    try{assessSemanticEvent(scene,event);}catch(e){issues.push(`SLIDE_MOTION_QA scene=${scene.id} event=${event.id} ${e.message}`);}
   }
  }
  for(const entity of scene.entities??[]){
   // Job@5 must be executable from the entity's true first state, not
   // merely contain valid endpoint states for native pair snapshots.
   let active=entity.initial_state;
   for(const ev of (scene.events??[]).filter(e=>e.target===entity.id)){
    if(ev.state_before!==active)issues.push(`EVENT_STATE_CHAIN_INVALID scene=${scene.id} entity=${entity.id} event=${ev.id} expected=${active} actual=${ev.state_before}`);
    active=ev.state_after;
   }
   const cats=new Set(Object.values(entity.states??{}).map(s=>ir.assets?.[s.asset]?.category));
   const isEffect=cats.has('effect'),isProp=cats.has('prop');
   if(!isEffect&&!isProp)continue;
   const events=(scene.events??[]).filter(e=>e.target===entity.id);
   const binding=bindings.get(entity.id);
   // `near` is a symmetric contact relation: hero-near-door already binds
   // the evented door to the authored stage. Do not require a redundant reverse
   // edge (which would rewrite an approved scene). Directed relations such as
   // held_by, on_surface, emitted_by and points_to remain one-way.
   const directlyAnchored=Boolean(binding&&entities.has(binding.anchor));
   const inverseNear=isProp&&(scene.spatial_bindings??[]).some(b=>b.anchor===entity.id&&b.relation==='near'&&entities.has(b.entity));
   if((isEffect||events.length)&&!directlyAnchored&&!inverseNear)issues.push(`SPATIAL_BINDING_REQUIRED scene=${scene.id} entity=${entity.id}`);
   if(isEffect){
    if(!events.length)issues.push(`EFFECT_UNSCHEDULED scene=${scene.id} entity=${entity.id}`);
    const initial=entity.states?.[entity.initial_state];
    if(initial?.visible!==false)issues.push(`EFFECT_INIT_NOT_HIDDEN scene=${scene.id} entity=${entity.id}`);
    if(!events.some(e=>entity.states?.[e.state_after]?.visible===false))issues.push(`EFFECT_RELEASE_REQUIRED scene=${scene.id} entity=${entity.id}`);
    if(!events.some(e=>entity.states?.[e.state_after]?.visible!==false))issues.push(`EFFECT_ENTER_REQUIRED scene=${scene.id} entity=${entity.id}`);
   }
  }
 }
 if(issues.length)fail('PRODUCTION_SEMANTICS_INVALID',issues.join('; '));
 return {ok:true,scenes:ir.scenes?.length??0};
}
// Refuse semantic edits made to a compiled Job@5 after the reviewed source was sealed.
// Runtime-owned measured fields are deliberately absent from this comparison.
export function assertAuthoringProjection(source,ir){
 const problems=[];
 if(!isDeepStrictEqual(source?.assets,ir?.assets))problems.push('assets');
 if(source?.scenes?.length!==ir?.scenes?.length)problems.push('scene_count');
 for(let i=0;i<(source?.scenes?.length??0);i++){
  const original=source.scenes[i],compiled=ir.scenes?.[i];
  if(!compiled||original.id!==compiled.id){problems.push(`scene_${i}_id`);continue;}
  if(String(original.voice).trimEnd()!==String(compiled.voice).trimEnd())problems.push(`${original.id}_voice`);
  const authoredEntities=(original.entities??[]).map(e=>({id:e.id,...(typeof e.initial_state==='string'?{initial_state:e.initial_state}:{}),states:e.states}));
  if(!isDeepStrictEqual(authoredEntities,compiled.entities))problems.push(`${original.id}_entities`);
  if(!isDeepStrictEqual(original.spatial_bindings??[],compiled.spatial_bindings??[]))problems.push(`${original.id}_spatial`);
  if((original.events??[]).length!==compiled.events?.length)problems.push(`${original.id}_event_count`);
  for(let j=0;j<(original.events??[]).length;j++){
   const before=original.events[j],after=compiled.events?.[j];
   if(!after||before.id!==after.id||before.target!==after.target||before.state_before!==after.state_before||before.state_after!==after.state_after||
      (before.action??before.intent)!==after.intent||before.motion?.preset!==after.desired_motion)problems.push(`${original.id}_event_${j}`);
   const trigger=before.trigger??{};
   const expectedTrigger=(trigger.type??trigger.source)==='scene_start'?{type:'scene_start'}:
      {type:'voice_anchor',text:String(trigger.text??'').trim(),...(trigger.occurrence!==undefined?{occurrence:trigger.occurrence}:{})};
   if(!isDeepStrictEqual(expectedTrigger,after?.trigger))problems.push(`${original.id}_trigger_${j}`);
   const sched=before.scheduling;
   const expectedScheduling=sched?{max_drift_frames:Math.max(0,Math.round(sched.max_drift_frames*24/(source.video?.fps??24))),merge_policy:sched.merge_policy}:{max_drift_frames:8,merge_policy:'never'};
   if(!isDeepStrictEqual(expectedScheduling,after?.scheduling))problems.push(`${original.id}_scheduling_${j}`);
  }
 }
 if(problems.length)fail('APPROVED_AUTHORING_DRIFT',problems.join(','));
 return {ok:true,scenes:ir.scenes.length};
}

// Publish is authored upstream. Local runner exports cover pixels and copy files;
// it must not invent missing visual selections or the channel identity.
export function assertPublishIntent(pub,copy,ir){
 const cover=pub?.cover;
 const scene=ir?.scenes?.find(s=>s.id===cover?.source_scene_id);
 const ids=new Map((scene?.entities??[]).map(e=>[e.id,e]));
 const visuals=cover?.visuals;
 const bad=pub?.format!=='zodiac-publish@1'||!pub?.caption?.trim()||
   !Array.isArray(pub?.hashtags)||pub.hashtags.length===0||!pub.hashtags.every(t=>typeof t==='string'&&t.startsWith('#'))||
   !cover||cover.layout!=='tilted_top_hook'||!cover.hook?.trim()||!cover.identity?.label?.trim()||
   !scene||!Array.isArray(visuals)||visuals.length===0||!visuals.every(v=>ids.get(v.entity_id)?.states?.[v.state_id])||
   !['COVER IDENTITY:','HOOK:','TIKTOK CAPTION:','HASHTAGS:'].every(marker=>String(copy).includes(marker))||
   !String(copy).includes(cover.hook)||!String(copy).includes(cover.identity.label);
 if(bad)fail('PUBLISH_INTENT_INVALID','requires valid cover identity, source scene, visual states, hashtags and publish copy');
 return {ok:true};
}

export function assertPublishProjection(authored,compiled){
 const expected={...authored,format:'zodiac-publish@1',source:{...(authored.source??{}),narration:'narration.txt',production:'production.ir.json'}};
 if(!isDeepStrictEqual(expected,compiled))fail('APPROVED_PUBLISH_DRIFT');
 return {ok:true};
}

export async function validatePhase03Release(root,{sourceRoot,reviewLock}={}){
 if(!sourceRoot||!reviewLock)fail('APPROVAL_EVIDENCE_REQUIRED','--source-workspace and --review-lock required');
 await validateStoryObjectWorkspace(sourceRoot); // authoring meaning must match reviewed voice/events
 const lock=typeof reviewLock==='string'?JSON.parse(await readFile(reviewLock,'utf8')):reviewLock;
 const approved=await assertReviewLock(sourceRoot,lock);
 const state=JSON.parse(await readFile(path.join(sourceRoot,'.authoring','pipeline-state.json'),'utf8'));
 const sourceReceipts=await buildReviewLock(sourceRoot,state);
 if(sourceReceipts.approval.content!==lock.approval.content||sourceReceipts.approval.visual!==lock.approval.visual)fail('REVIEW_PROOF_MISMATCH');
 const ir=JSON.parse(await readFile(path.join(root,'production.ir.json'),'utf8'));
 const token=JSON.parse(await readFile(path.join(root,'design-token.json'),'utf8'));
 const reviewedSource=JSON.parse(await readFile(path.join(sourceRoot,'production.json'),'utf8'));
 assertAuthoringProjection(reviewedSource,ir);
 const sourceDesign=await readFile(path.join(sourceRoot,'design.md'),'utf8');
 const schemaPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../references/contracts/authoring-ir-v1.schema.json');
 const expectedCompiled=compileJobV5(reviewedSource,sourceDesign,{sign:'bocap',concept:'source-check',contractSchema:JSON.parse(await readFile(schemaPath,'utf8'))});
 if(!isDeepStrictEqual(expectedCompiled.designToken,token))fail('APPROVED_DESIGN_TOKEN_DRIFT');
 assertBrandIntent(token);assertProductionSemantics(ir);
 const pub=JSON.parse(await readFile(path.join(root,'publish','publish.json'),'utf8'));
 const copy=await readFile(path.join(root,'publish','publish-copy.txt'),'utf8');
 assertPublishIntent(pub,copy,ir);
 const reviewedPub=JSON.parse(await readFile(path.join(sourceRoot,'publish','publish.json'),'utf8'));
 assertPublishProjection(reviewedPub,pub);
 const reviewedCopy=await readFile(path.join(sourceRoot,'publish','publish-copy.txt'),'utf8');
 if(copy!==reviewedCopy)fail('APPROVED_PUBLISH_COPY_CHANGED');
 // Migrate without changing exported bytes: the plugin's canonical model must
 // round-trip to the exact existing Job@5 IR rather than fork authoring truth.
 const model=migrateLegacyJob5(root);
 const checked=validateProductionModel(model);
 if(model.source.narration_sha256!==sha(await readFile(path.join(root,'narration.txt'))))fail('MODEL_NARRATION_HASH_INVALID');
 if(!checked.ok)fail('PRODUCTION_MODEL_INVALID',checked.errors.join(','));
 assertRoundTrip(ir,projectLegacyIR(model));
 // Source authoring inputs are pinned to the reviewed fingerprint. All packaged
 // SVG bytes and approved narration must still match that reviewed source.
 const sourceAssets=path.join(path.resolve(sourceRoot),'assets');
 for(const asset of Object.values(ir.assets)){
  const rel=String(asset.path??'');
  if(!rel.startsWith('assets/'))fail('PRODUCTION_ASSET_UNSAFE',rel);
  const produced=await readFile(path.join(root,rel));
  const authored=await readFile(path.join(path.dirname(sourceAssets),rel));
  if(!produced.equals(authored))fail('PRODUCTION_ASSET_CHANGED',rel);
 }
 const producedVoice=await readFile(path.join(root,'narration.txt'));
 const sourceVoice=await readFile(path.join(sourceRoot,'narration.txt'));
 if(!producedVoice.equals(sourceVoice))fail('APPROVED_NARRATION_CHANGED');
 return {status:'PRODUCTION_READY_ZIP_STATIC',approved_source:approved.source.sha256,scenes:ir.scenes.length,assets:Object.keys(ir.assets).length};
}
