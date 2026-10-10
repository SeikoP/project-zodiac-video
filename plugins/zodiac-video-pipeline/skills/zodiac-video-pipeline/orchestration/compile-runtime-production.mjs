#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fail=m=>{throw new Error('RUNTIME_PRODUCTION_COMPILE_INVALID: '+m);};
const clone=x=>JSON.parse(JSON.stringify(x));
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const allowedLineageModes=new Set(['direct_copy','derived_copy','semantic_variant','composite']);
const allowedSourceLibraries=new Set(['zodiac-visual-grammar-v4']);
const demoFontStack=['Patrick Hand','Segoe Print','cursive'];
const demoCssFontFamily='"Patrick Hand", "Segoe Print", cursive';
const canonicalBrandOverlay={
  enabled:true,
  text:'✦ bungmoto',
  symbol:'✦',
  brand:'bungmoto',
  anchor:'top-left',
  offset_px:{x:68,y:40},
  font_family:'Patrick Hand',
  font_stack:demoFontStack,
  css_font_family:demoCssFontFamily,
  font_size_px:29,
  font_weight:800,
  symbol_scale:0.82,
  gap_px:18,
  opacity:0.45,
  tone:'ink',
  paper_halo:true,
  layer:30,
  subtitle_layer:40
};

const styleTokenFromMarkdown=markdown=>{
  const m=String(markdown).match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);
  if(!m)fail('design.md is missing STYLE_TOKEN block');
  let token;
  try{token=JSON.parse(m[1]);}catch(e){fail('invalid STYLE_TOKEN JSON: '+e.message);}
  for(const k of ['id','version','style_family','handmade_profile','hard_style_lock','palette_roles','character_construction','shape_language','caption_emphasis','safe_zone','caption_overlay','motion_grammar','asset_style_contract'])if(!(k in token))fail('STYLE_TOKEN missing '+k);
  if(token.id!=='zodiac-paper-doodle-meme-v4'||token.version!=='4.0'||token.style_family!=='paper-doodle-chibi-meme'||token.handmade_profile!=='human-stroke-v2'||token.hard_style_lock!==true)fail('STYLE_DRIFT: Handoff requires zodiac-paper-doodle-meme-v4/4.0 with human-stroke-v2 and hard_style_lock=true');
  const cc=token.character_construction??{},asc=token.asset_style_contract??{};
  if(cc.handmade_profile!=='human-stroke-v2'||typeof cc.identity_rule!=='string'||!cc.identity_rule.trim()||cc.body_variation!=='authored_geometry_not_scale_transform')fail('STYLE_DRIFT: invalid v4 character_construction');
  if(asc.style_token!==token.id||asc.handmade_profile!=='human-stroke-v2'||asc.legacy_v3_direct_copy!==false)fail('STYLE_DRIFT: invalid v4 asset_style_contract');
  if(token.caption_overlay?.mode!=='collision_aware')fail('STYLE_DRIFT: caption_overlay.mode must be collision_aware');
  const source_hash=createHash('sha256').update(JSON.stringify(token),'utf8').digest('hex');
  return {token,source_hash};
};

const refIndex=production=>{
  const map=new Map();
  for(const scene of production.scenes??[])
    for(const entity of scene.entities??[])
      for(const [stateId,state] of Object.entries(entity.states??{}))
        if(state?.asset&&!map.has(state.asset))map.set(state.asset,{entity_id:entity.id,kind:entity.kind,state_id:stateId});
  return map;
};

const cleanLineage=(assetId,entry)=>{
  const old=entry.lineage;
  if(!isObj(old))fail(`asset ${assetId} requires explicit lineage; Handoff may not fabricate provenance`);
  if(!allowedLineageModes.has(old.mode))fail(`asset ${assetId} lineage.mode invalid`);
  if(!allowedSourceLibraries.has(old.source_library))fail(`asset ${assetId} lineage.source_library invalid`);
  const sourceMaster=old.source_master;
  if(!(typeof sourceMaster==='string'&&sourceMaster.trim())&&!(Array.isArray(sourceMaster)&&sourceMaster.length&&sourceMaster.every(x=>typeof x==='string'&&x.trim())))fail(`asset ${assetId} lineage.source_master is required`);
  if(typeof old.semantic_intent!=='string'||!old.semantic_intent.trim())fail(`asset ${assetId} lineage.semantic_intent is required`);
  return {
    mode:old.mode,
    source_library:old.source_library,
    source_master:clone(sourceMaster),
    semantic_intent:old.semantic_intent,
    ...(Array.isArray(old.mutated_groups)?{mutated_groups:clone(old.mutated_groups)}:{}),
    ...(Array.isArray(old.preserved_groups)?{preserved_groups:clone(old.preserved_groups)}:{})
  };
};

const defaultMotion=()=>({
  keyframes:[
    {frame:0,x:0,y:0,rotate_deg:0,scale:0.985,opacity:1},
    {frame:'duration_frames',x:0,y:0,rotate_deg:0,scale:1,opacity:1}
  ],
  easing:'ease_out'
});

const frameCount=(fps,seconds,min,max)=>Math.max(min,Math.min(max,Math.round(Math.max(1,Number(fps)||24)*seconds)));
const chooseMotionPreset=(event,motionPresets,phase)=>{
  const keys=Object.keys(motionPresets??{});
  if(!keys.length)fail('runtime projection requires at least one motion preset');
  const lowered=keys.map(key=>[key,key.toLocaleLowerCase('en-US')]);
  const groups=event.target==='camera'
    ? [['camera','focus','zoom','pan'],['nudge','state','swap']]
    : phase==='reaction'
      ? [['reaction','recoil','pop','nudge'],['state','swap','peel']]
      : [['state','swap','nudge','peel'],['reaction','pop']];
  for(const needles of groups){const match=lowered.find(([,key])=>needles.some(needle=>key.includes(needle)));if(match)return match[0];}
  return keys[0];
};
const materializeEventRuntimeDefaults=(event,motionPresets,fps)=>{
  const incoming=isObj(event.performance)?event.performance:{};
  const phase=incoming.phase??(incoming.cause_event_id?'reaction':'action');
  const energy=Number.isFinite(incoming.energy)?Number(incoming.energy):phase==='reaction'?0.68:phase==='hold'?0.28:0.5;
  const performance={
    intent:String(incoming.intent??event.action??'state change').trim()||'state change',
    phase,
    energy,
    anticipation_frames:Number.isInteger(incoming.anticipation_frames)?incoming.anticipation_frames:phase==='reaction'?frameCount(fps,0.07,1,4):frameCount(fps,0.12,2,6),
    hold_frames:Number.isInteger(incoming.hold_frames)?incoming.hold_frames:phase==='hold'?frameCount(fps,0.28,4,12):frameCount(fps,0.12,2,7),
    settle_frames:Number.isInteger(incoming.settle_frames)?incoming.settle_frames:frameCount(fps,phase==='reaction'?0.24:0.2,4,10),
    ...(incoming.focus?{focus:incoming.focus}:{}),
    ...(incoming.cause_event_id?{cause_event_id:incoming.cause_event_id}:{})
  };
  const motion=isObj(event.motion)?clone(event.motion):{
    preset:chooseMotionPreset(event,motionPresets,phase),
    duration_frames:frameCount(fps,phase==='reaction'?0.30:0.36,8,14)
  };
  return {...event,motion,performance};
};

const MAX_VISUAL_GAP_WORDS=10;
const normalizeWords=value=>String(value).normalize('NFC').toLocaleLowerCase('vi-VN').replace(/[\p{P}\p{S}]/gu,' ').trim().replace(/\s+/gu,' ').split(' ').filter(Boolean);
const resolveAnchorWord=(voice,trigger)=>{
  if(trigger?.source==='scene_start')return 0;
  if(trigger?.source!=='voice_anchor')fail('unsupported event trigger source');
  const words=normalizeWords(voice),anchor=normalizeWords(trigger.text);
  if(!anchor.length)fail('empty voice anchor');
  const matches=[];
  for(let i=0;i<=words.length-anchor.length;i++)if(anchor.every((w,j)=>words[i+j]===w))matches.push(i);
  if(!matches.length)fail('voice anchor not found: '+trigger.text);
  if(trigger.occurrence===undefined){if(matches.length>1)fail('voice anchor is ambiguous; occurrence required: '+trigger.text);return matches[0];}
  if(!Number.isInteger(trigger.occurrence)||trigger.occurrence<1||trigger.occurrence>matches.length)fail('voice anchor occurrence out of range: '+trigger.text);
  return matches[trigger.occurrence-1];
};
const validateProgressionDensity=(scene,events)=>{
  const wordCount=normalizeWords(scene.voice).length,positions=[];
  for(const ev of events){
    if(ev.target==='camera'||ev.state_before===ev.state_after)continue;
    positions.push(resolveAnchorWord(scene.voice,ev.trigger));
  }
  const uniq=[...new Set(positions)].sort((a,b)=>a-b);
  if(!uniq.length)fail(`VISUAL_PROGRESSION_DENSITY: ${scene.id} has no meaningful visual change`);
  const checkpoints=[0,...uniq,wordCount];
  let maxGap=0;
  for(let i=1;i<checkpoints.length;i++)maxGap=Math.max(maxGap,checkpoints[i]-checkpoints[i-1]);
  if(maxGap>MAX_VISUAL_GAP_WORDS)fail(`VISUAL_PROGRESSION_DENSITY: ${scene.id} has ${maxGap} words without a meaningful visual change; max ${MAX_VISUAL_GAP_WORDS}`);
};

const normalizeBrandOverlay=raw=>{
  const source=isObj(raw)?raw:{};
  const out={...clone(canonicalBrandOverlay),...clone(source)};
  out.offset_px={...canonicalBrandOverlay.offset_px,...(isObj(source.offset_px)?clone(source.offset_px):{})};
  out.font_stack=Array.isArray(source.font_stack)&&source.font_stack.length?clone(source.font_stack):clone(demoFontStack);
  out.css_font_family=typeof source.css_font_family==='string'&&source.css_font_family.trim()?source.css_font_family:demoCssFontFamily;
  return out;
};

export function projectProduction(source,designMarkdown){
  if(!isObj(source)||source.version!=='2.0')fail('source production.version must be 2.0');
  if(source.video!==undefined&&(!isObj(source.video)||source.video.width!==1080||source.video.height!==1920||source.video.fps!==24))fail('authoring video must already be canonical 1080x1920 at 24fps');

  const {token,source_hash}=styleTokenFromMarkdown(designMarkdown);
  const palette=clone(token.palette_roles);
  const caption=token.caption_emphasis??{};
  const safe=clone(token.safe_zone);
  const currentVisual=isObj(source.visual_system)?source.visual_system:{};
  const motion=isObj(currentVisual.motion_presets)&&Object.keys(currentVisual.motion_presets).length?clone(currentVisual.motion_presets):{state_swap:defaultMotion()};
  const transitions=isObj(currentVisual.transition_presets)&&Object.keys(currentVisual.transition_presets).length?clone(currentVisual.transition_presets):{cut:{renderer:'instant_cut'}};
  const existingPrimitives=isObj(source.primitives)?clone(source.primitives):{};
  if(!existingPrimitives.PAPER_BACKGROUND)existingPrimitives.PAPER_BACKGROUND={kind:'svg_elements',viewBox:'0 0 1080 1920',elements:[{tag:'rect',attributes:{x:0,y:0,width:1080,height:1920,fill:palette.paper}}]};
  const background=currentVisual.background_primitive&&existingPrimitives[currentVisual.background_primitive]?currentVisual.background_primitive:'PAPER_BACKGROUND';
  const brandOverlay=normalizeBrandOverlay(token.brand_overlay??currentVisual.brand_overlay);
  const visual_system={
    palette:isObj(currentVisual.palette)&&Object.keys(currentVisual.palette).length?clone(currentVisual.palette):palette,
    background_primitive:background,
    primitive_renderer:isObj(currentVisual.primitive_renderer)&&Array.isArray(currentVisual.primitive_renderer.allowed_tags)?clone(currentVisual.primitive_renderer):{allowed_tags:['path','rect','circle','ellipse','line','polyline','polygon','g']},
    motion_presets:motion,
    transition_presets:transitions,
    sfx_profiles:isObj(currentVisual.sfx_profiles)?clone(currentVisual.sfx_profiles):{},
    brand_overlay:brandOverlay,
    style_token:{...clone(token),source_hash}
  };
  const roleColor=role=>palette[role]??role;
  const caption_style={
    font_family:caption.font_family??'Patrick Hand',
    font_stack:Array.isArray(caption.font_stack)&&caption.font_stack.length?clone(caption.font_stack):clone(demoFontStack),
    css_font_family:typeof caption.css_font_family==='string'&&caption.css_font_family.trim()?caption.css_font_family:demoCssFontFamily,
    font_size_px:caption.font_size_px,
    min_font_size_px:caption.min_font_size_px,
    font_weight:caption.font_weight,
    color:roleColor(caption.color_role),
    highlight_color:roleColor(caption.highlight_role),
    background:caption.ghost_frame===true?'transparent':roleColor(caption.background_role),
    safe_area:safe,
    max_lines:caption.max_lines
  };

  const refs=refIndex(source),assets={};
  for(const [id,entry] of Object.entries(source.assets??{})){
    if(!isObj(entry)||typeof entry.path!=='string')fail('asset '+id+' missing path');
    if(entry.style_id!==undefined&&entry.style_id!==token.id)fail(`asset ${id} style_id ${entry.style_id} does not match design token ${token.id}`);
    const meta=refs.get(id);
    const category=entry.category??(meta?.kind==='character'?'character':entry.path.replaceAll('\\','/').includes('/characters/')?'character':'prop');
    const pose=entry.pose??meta?.state_id??(id.includes('_')?id.split('_').slice(1).join('_').toLowerCase():'default');
    assets[id]={
      kind:'svg',
      category,
      ...(category==='character'?{character_id:entry.character_id??meta?.entity_id??id.split('_')[0].toLowerCase()}:{}),
      pose,
      path:entry.path,
      format:'image/svg+xml',
      ...Object.fromEntries(['visual_role','role','intrinsic_size','visual_bounds'].filter(k=>k in entry).map(k=>[k,clone(entry[k])])),
      style_id:token.id,
      lineage:cleanLineage(id,entry)
    };
  }

  const scenes=(source.scenes??[]).map((scene,index)=>{
    if(!isObj(scene))fail('scene '+(index+1)+' must be object');
    const entities=(scene.entities??[]).map(entity=>({
      id:entity.id,
      kind:entity.kind,
      ...Object.fromEntries(['visual_role','role','layer'].filter(k=>k in entity).map(k=>[k,clone(entity[k])])),
      initial_state:entity.initial_state,
      states:Object.fromEntries(Object.entries(entity.states??{}).map(([stateId,state])=>{
        const clean=Object.fromEntries(['asset','primitive','transform','layer','visible'].filter(k=>k in (state??{})).map(k=>[k,clone(state[k])]));
        if(typeof clean.visible!=='boolean')clean.visible=true;
        return [stateId,clean];
      }))
    }));
    const events=(scene.events??[]).map(event=>{
      const clean=Object.fromEntries(['id','target','action','state_before','state_after','trigger','motion','sfx','mechanism','performance'].filter(k=>k in event).map(k=>[k,clone(event[k])]));
      return materializeEventRuntimeDefaults(clean,motion,24);
    });
    validateProgressionDensity(scene,events);
    const captions=Object.fromEntries(['source','segmentation','max_lines','page_target_words','max_words'].filter(k=>k in (scene.captions??{})).map(k=>[k,clone(scene.captions[k])]));
    let transition;
    if(scene.transition===undefined||scene.transition===null){
      transition={type:'cut',duration_frames:0};
    }else{
      if(!isObj(scene.transition)||typeof scene.transition.type!=='string'||!scene.transition.type.trim())fail(`scene ${scene.id??index+1} transition.type is required`);
      if(!transitions[scene.transition.type])fail(`scene ${scene.id??index+1} unknown transition ${scene.transition.type}`);
      if(!Number.isInteger(scene.transition.duration_frames)||scene.transition.duration_frames<0)fail(`scene ${scene.id??index+1} transition.duration_frames must be a non-negative integer`);
      transition={type:scene.transition.type,duration_frames:scene.transition.duration_frames};
    }
    return {...Object.fromEntries(['occlusion_relations','spatial_bindings','layout_contract','render_density_budget','performance_context'].filter(k=>k in scene).map(k=>[k,clone(scene[k])])),id:scene.id,voice:scene.voice,timing:{mode:'from_voice'},entities,events,transition,captions};
  });

  return {version:'2.0',video:{width:1080,height:1920,fps:24},visual_system,caption_style,primitives:existingPrimitives,assets,scenes};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2];
  if(!root){console.error('Usage: node compile-runtime-production.mjs <package-root> --write');process.exit(2);}
  const source=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
  const design=await readFile(path.join(root,'design.md'),'utf8');
  const projected=projectProduction(source,design);
  if(process.argv.includes('--write')){
    await writeFile(path.join(root,'production.json'),JSON.stringify(projected,null,2)+'\n');
    console.log(`RUNTIME_PRODUCTION_COMPILE_PASS: scenes=${projected.scenes.length} assets=${Object.keys(projected.assets).length} fps=${projected.video.fps} brand=${projected.visual_system.brand_overlay.text}`);
  }else console.log(JSON.stringify(projected,null,2));
}
