#!/usr/bin/env node
import {validateAnchorLanes} from '../../features/visual-composition/validate-anchor-lanes.mjs';
import {assertEpisodeIdentity} from '../../features/episode/episode-handoff.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRunnerMotionBoundary} from '../../features/visual-composition/validate-runner-motion-boundary.mjs';

import {resolveHandoffLayout,preflightHandoff} from './handoff-preflight.mjs';
const fail=m=>{throw new Error('JOB_V5_COMPILE_INVALID: '+m);};
const producerVersion=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../plugin.json'),'utf8')).version;
const clone=x=>JSON.parse(JSON.stringify(x));
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const ascii=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,m=>m==='đ'?'d':'D').toLowerCase();
const signSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'');
const conceptSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
const canonical=value=>Array.isArray(value)?value.map(canonical):isObj(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const contractHash=schema=>createHash('sha256').update(JSON.stringify(canonical(schema)),'utf8').digest('hex');

export function parseStyleToken(markdown){
  const m=String(markdown).match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);
  if(!m)fail('design.md is missing STYLE_TOKEN block');
  let token;try{token=JSON.parse(m[1]);}catch(e){fail('invalid STYLE_TOKEN JSON: '+e.message);}
  if(token?.id!=='zodiac-paper-doodle-meme-v4'||token?.version!=='4.0'||token?.style_family!=='paper-doodle-chibi-meme'||token?.handmade_profile!=='human-stroke-v2')fail('STYLE_DRIFT: expected Visual Grammar v4 / human-stroke-v2');
  return token;
}

const triggerToIr=(trigger,eventId)=>{
  if(!isObj(trigger))fail(`event ${eventId} requires an explicit trigger`);
  if(trigger.type==='scene_start'||trigger.source==='scene_start')return {type:'scene_start'};
  if(trigger.type==='voice_anchor'||trigger.source==='voice_anchor'){
    if(typeof trigger.text!=='string'||!trigger.text.trim())fail(`event ${eventId} voice_anchor requires text`);
    return {type:'voice_anchor',text:trigger.text.trim(),...(trigger.occurrence!==undefined?{occurrence:trigger.occurrence}:{})};
  }
  fail(`event ${eventId} has unsupported trigger`);
};

const schedulingToIr=(raw,eventId)=>{
  if(raw===undefined)return {max_drift_frames:8,merge_policy:'never'};
  if(!isObj(raw)||!Number.isInteger(raw.max_drift_frames)||raw.max_drift_frames<0||!['never','same_intent_same_state'].includes(raw.merge_policy))fail(`event ${eventId} scheduling must define max_drift_frames>=0 and supported merge_policy`);
  return {max_drift_frames:raw.max_drift_frames,merge_policy:raw.merge_policy};
};

// Segment before export: one semantic subtitle page is a phrase, never a
// measured word. Local TTS/alignment remains the sole timing authority.
export function captionSegmentsForScene(voice, supplied) {
  const words=String(voice).trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  if (Array.isArray(supplied) && supplied.length) {
    const flattened=supplied.map(x=>String(x.text??'').trim()).join(' ').split(/\s+/u).filter(Boolean);
    if (flattened.join(' ')!==words.join(' ')) fail('caption_segments must preserve narration word order');
    return clone(supplied);
  }
  const chunks=[],parts=[];
  for (let i=0;i<words.length;i++) {
    parts.push(words[i]);
    const natural=/[,;:.!?…]$/u.test(words[i]);
    const remaining=words.length-i-1;
    if ((parts.length>=4 && natural && (remaining===0||remaining>=3)) ||
        ((parts.length>=8 || parts.join(' ').length>=43) && (remaining===0||remaining>=3))) {
      chunks.push(parts.splice(0).join(' '));
    }
  }
  if(parts.length) {
    if(parts.length<3 && chunks.length) chunks[chunks.length-1]+=' '+parts.join(' ');
    else chunks.push(parts.join(' '));
  }
  let offset=0;
  return chunks.map(text=>{
    const count=text.split(/\s+/u).length;
    const start_ms=offset;
    offset+=Math.max(900,Math.round(count*310));
    return {text,start_ms,end_ms:offset,max_lines:2,preferred_breaks:[]};
  });
}

// Match Renderer 2.0.1 prepare.mjs visualRoleSizeLimit() at the Job@5
// producer boundary. This rejects every undersized visible effect/prop
// BEFORE writing an importable ZIP, rather than failing scene by scene.
export function assertJob5VisualRoleSizes(ir){
 const issues=[];
 for(const scene of ir?.scenes??[]){
  if(!scene.layout_contract)continue;
  for(const entity of scene.entities??[]){
   for(const [stateId,state] of Object.entries(entity.states??{})){
    if(state?.visible===false)continue;
    const asset=ir.assets?.[state.asset]??{};
    const category=asset.category??(String(asset.path??'').includes('/effects/')?'effect':String(asset.path??'').includes('/props/')?'prop':null);
    if(category!=='effect'&&category!=='prop')continue;
    const rawPath=String(asset.path??'').replaceAll('\\','/').toLowerCase();
    const master=String(asset.lineage?.source_master??'').replaceAll('\\','/').toLowerCase();
    const nativePen=category==='prop'&&/(^|\/)props\/pen\.svg$/.test(rawPath)&&/(^|\/)props\/pen\.svg$/.test(master);
    const limit=nativePen?{area:24000,short:110,long:200}: {area:category==='effect'?30000:43000,short:110,long:0};
    const t=state.transform??{};const scale=Math.abs(Number(t.scale??1));
    const w=Number(t.width??0)*scale,h=Number(t.height??0)*scale;
    if(!Number.isFinite(w)||!Number.isFinite(h)||!Number.isFinite(scale)||
       w*h<limit.area||Math.min(w,h)<limit.short||Math.max(w,h)<limit.long){
       issues.push(`VISUAL_ROLE_TOO_SMALL scene=${scene.id} entity=${entity.id} state=${stateId} actual=${Math.round(w)}x${Math.round(h)} minimum_area=${limit.area} profile=${nativePen?'writing-pen':category==='effect'?'effect':'standard-prop'}`);
    }
   }
  }
 }
 if(issues.length){const e=new Error('JOB_V5_COMPILE_INVALID: '+issues.join('; '));e.diagnostics=issues;throw e;}
 return {status:'PASS',scenes:(ir.scenes??[]).length};
}

export function compileJobV5(source,designMarkdown,{sign,concept,episodeIdentity,revision='1.0',contractSchema}={}){
  if(!isObj(source)||source.version!=='2.0')fail('source production.version must be 2.0');
  const video=source.video??{};
  if(video.width!==1080||video.height!==1920||![24,30].includes(video.fps))fail('authoring video must be 1080x1920 at supported 24 or 30fps');
  // The local Job@5 runtime is 24fps; Phase 02 may author at canonical 30fps.
  const toRuntimeFrames=(frames,min=1)=>Math.max(min,Math.round(frames*24/video.fps));
  if(!Array.isArray(source.scenes)||!source.scenes.length)fail('source must contain scenes');
  if(!isObj(source.assets))fail('source assets must be an object');
  if(!isObj(contractSchema))fail('canonical authoring IR schema is required');
  const token=parseStyleToken(designMarkdown);
  const motionDefaults={};
  const scenes=source.scenes.map((scene,index)=>{
    if(!isObj(scene)||typeof scene.id!=='string'||!scene.id||typeof scene.voice!=='string')fail(`scene ${index+1} id/voice invalid`);
    const entities=(scene.entities??[]).map(entity=>{
      if(!isObj(entity)||typeof entity.id!=='string'||!isObj(entity.states)||!Object.keys(entity.states).length)fail(`scene ${scene.id} invalid entity`);
      return {id:entity.id,...Object.fromEntries(['kind','visual_role','role','layer'].filter(k=>k in entity).map(k=>[k,clone(entity[k])])),...(typeof entity.initial_state==='string'?{initial_state:entity.initial_state}:{}),states:clone(entity.states)};
    });
    const events=(scene.events??[]).map(event=>{
      const id=String(event?.id??'');if(!id)fail(`scene ${scene.id} has event without id`);
      const motion=event.motion;
      if(!isObj(motion)||typeof motion.preset!=='string'||!motion.preset||!Number.isInteger(motion.duration_frames)||motion.duration_frames<1)fail(`event ${id} requires explicit motion.preset + duration_frames; runtime defaults are forbidden in job@5`);
      const runtimeDuration=toRuntimeFrames(motion.duration_frames);
      const motionId=motion.duration_override===true&&motion.preset==='state_swap'?`state_swap_${runtimeDuration}f`:motion.preset;
      const prior=motionDefaults[motionId];
      if(prior&&prior.duration_frames!==runtimeDuration)fail(`motion preset ${motion.preset} has conflicting duration_frames; use distinct motion ids`);
      motionDefaults[motionId]={duration_frames:runtimeDuration};
      const intent=event.action??event.intent;
      if(typeof intent!=='string'||!intent.trim())fail(`event ${id} requires semantic action/intent`);
      for(const key of ['target','state_before','state_after'])if(typeof event[key]!=='string'||!event[key])fail(`event ${id} missing ${key}`);
      return {
        id,
        target:event.target,
        intent:intent.trim(),
        trigger:triggerToIr(event.trigger,id),
        state_before:event.state_before,
        state_after:event.state_after,
        desired_motion:motionId,
        scheduling:(()=>{const r=schedulingToIr(event.scheduling,id);return event.scheduling===undefined?r:{...r,max_drift_frames:toRuntimeFrames(r.max_drift_frames,0)};})()
      };
    });
    const spatial_bindings=Array.isArray(scene.spatial_bindings)?clone(scene.spatial_bindings):[];
    const ids=new Set(entities.map(e=>e.id));
    const unique=new Set();
    for(const binding of spatial_bindings){
      if(!binding||!ids.has(binding.entity)||!ids.has(binding.anchor)||binding.entity===binding.anchor)fail(`scene ${scene.id} spatial binding has missing or self anchor`);
      if(unique.has(binding.entity))fail(`scene ${scene.id} has duplicate spatial binding ${binding.entity}`);
      unique.add(binding.entity);
      if(!["near","held_by","on_surface","emitted_by","points_to"].includes(binding.relation))fail(`scene ${scene.id} unsupported spatial relation`);
      if(!Number.isFinite(binding.max_distance_px)||binding.max_distance_px<=0||binding.max_distance_px>1200)fail(`scene ${scene.id} spatial max_distance_px must be explicit`);
    }
    const caption_segments=captionSegmentsForScene(scene.voice,scene.caption_segments);
    if(scene.voice.trim()&&!caption_segments.length)fail(`scene ${scene.id} is missing captions`);
    const sceneExtras={
      ...(scene.occlusion_relations?{occlusion_relations:clone(scene.occlusion_relations)}:{}),
      ...(scene.performance_context?{performance_context:clone(scene.performance_context)}:{}),
      ...(spatial_bindings.length?{spatial_bindings}:{}),
      ...(caption_segments.length?{caption_segments,caption_timing_status:'estimated_not_audio_aligned'}:{}),
      ...{layout_contract:resolveHandoffLayout(scene.layout_contract)},
      ...{render_density_budget:clone(scene.render_density_budget??{max_characters:3,max_prominent_props:2,max_prominent_effects:2})}
    };
    return {id:scene.id,voice:scene.voice,duration_hint_frames:Number.isInteger(scene.duration_hint_frames)&&scene.duration_hint_frames>1?toRuntimeFrames(scene.duration_hint_frames):Math.max(24,Math.round(scene.voice.trim().split(/\s+/u).length*8)),entities,events,...sceneExtras};
  });
  const ir={format:'zodiac-authoring-ir@1',fps:24,video:{width:1080,height:1920},assets:clone(source.assets),scenes};
  assertJob5VisualRoleSizes(ir);const preflight=preflightHandoff(ir);if(preflight.status==='BLOCKED')fail('HANDOFF_PREFLIGHT '+JSON.stringify(preflight.issues));
  // Plugin owns branding/caption intent. Renderer only materializes the font.
  // Explicit contradictory brand configuration is not silently overwritten.
  const designToken={...clone(token),
    caption_emphasis:{...(isObj(token.caption_emphasis)?token.caption_emphasis:{}),font_family:'Patrick Hand'},
    brand_overlay:token.brand_overlay??{enabled:true,text:'✦ bungmoto',anchor:'top-left',offset_px:{x:68,y:40},font_family:'Patrick Hand',font_size_px:29,font_weight:400,opacity:0.45,layer:100},
    motion_defaults:motionDefaults};
  const anchorLanes=validateAnchorLanes(ir,designToken);
  if(anchorLanes.status!=='PASS')fail('JOB_V5_ANCHOR_LANE_CONFLICT: '+JSON.stringify(anchorLanes.issues));
  const identity=episodeIdentity?assertEpisodeIdentity(episodeIdentity):null;
  const s=signSlug(sign),c=conceptSlug(concept);if(!identity&&(!s||!c))fail('sign and concept are required for stable job identity');
  const jobId=identity?.job_id??`${s}-${c}`;
  if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(jobId))fail('stable job id is invalid/too long');
  const manifest={format:'zodiac-job@5',job:{id:jobId,revision:String(revision)},contract:{id:'zodiac-authoring-ir',version:'1.0.0',sha256:contractHash(contractSchema)},renderer:{id:'zodiac-renderer',version:'2.0.1'},producer:{plugin:'zodiac-video-pipeline',version:producerVersion}};
  return {ir,designToken,manifest};
}

export async function compileWorkspace(root,{sign,concept,episodeIdentity,revision='1.0',prune=false}={}){
  const here=path.dirname(fileURLToPath(import.meta.url));
  const schema=JSON.parse(await readFile(path.resolve(here,'../../references/contracts/authoring-ir-v1.schema.json'),'utf8'));
  const source=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
  const design=await readFile(path.join(root,'design.md'),'utf8');
  const {ir,designToken,manifest}=compileJobV5(source,design,{sign,concept,episodeIdentity,revision,contractSchema:schema});
  // Do not rewrite the approved narration for formatting differences at scene seams.
  // Preserve its bytes, and attach the additional separator newlines to IR scene voices.
  if(source.voice_partition==='utf8_ranges'){
    const narration=await readFile(path.join(root,'narration.txt'));if(!Buffer.from(ir.scenes.map(s=>s.voice).join(''),'utf8').equals(narration))fail('approved narration differs from UTF8 source ranges');
  }else{
  const narration=(await readFile(path.join(root,'narration.txt'),'utf8')).replace(/\r\n/g,'\n').replace(/\n$/,'');
  let pos=0;
  for (let i=0;i<ir.scenes.length;i++) {
    const scene=ir.scenes[i];
    if (!narration.startsWith(scene.voice,pos)) fail(`approved narration differs from scene ${scene.id}`);
    pos+=scene.voice.length;
    if (i<ir.scenes.length-1) {
      const sep=narration.slice(pos).match(/^\n+/u)?.[0];
      if(!sep)fail(`approved narration has no valid scene separator after ${scene.id}`);
      scene.voice+=sep.slice(0,-1); // join('\n') will restore the final newline
      pos+=sep.length;
    }
  }
  if(pos!==narration.length)fail('approved narration contains unaligned trailing content');
  if(ir.scenes.map(s=>s.voice).join('\n')!==narration)fail('approved narration differs after scene-boundary normalization');
  }
  const motionBoundary=validateRunnerMotionBoundary(ir);
  if(!motionBoundary.ok)fail('RUNNER_MOTION_BOUNDARY: '+JSON.stringify(motionBoundary.issues.slice(0,12)));
  await writeFile(path.join(root,'production.ir.json'),JSON.stringify(ir,null,2)+'\n');
  await writeFile(path.join(root,'design-token.json'),JSON.stringify(designToken,null,2)+'\n');
  await writeFile(path.join(root,'package-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const publishPath=path.join(root,'publish','publish.json');
  const publish=JSON.parse(await readFile(publishPath,'utf8'));
  publish.format='zodiac-publish@1';
  publish.source={...(isObj(publish.source)?publish.source:{}),narration:'narration.txt',production:'production.ir.json'};
  await writeFile(publishPath,JSON.stringify(publish,null,2)+'\n');
  if(prune){await rm(path.join(root,'production.json'),{force:true});await rm(path.join(root,'design.md'),{force:true});}
  return {ir,designToken,manifest,publish};
}

const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2],sign=arg('--sign'),concept=arg('--concept'),revision=arg('--revision')??'1.0';
  if(!root||sign===undefined||concept===undefined){console.error('Usage: node compile-job-v5.mjs <package-root> --sign <sign> --concept <concept> [--revision <revision>] [--write] [--prune]');process.exit(2);}
  try{const result=process.argv.includes('--write')?await compileWorkspace(path.resolve(root),{sign,concept,revision,prune:process.argv.includes('--prune')}):compileJobV5(JSON.parse(await readFile(path.join(root,'production.json'),'utf8')),await readFile(path.join(root,'design.md'),'utf8'),{sign,concept,revision,contractSchema:JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../references/contracts/authoring-ir-v1.schema.json'),'utf8'))});console.log(`JOB_V5_COMPILE_PASS: job=${result.manifest.job.id} revision=${result.manifest.job.revision} scenes=${result.ir.scenes.length} motions=${Object.keys(result.designToken.motion_defaults).length}`);}catch(e){console.error(e.message);process.exit(1);}
}
