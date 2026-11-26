// One V4/V5 compiler owner for episode.build and scene.compile.
import {readFile,writeFile,mkdir,readdir,stat,statfs,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {compileVisualIntent} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/compile-visual-intent.mjs';
import {buildPhase02SemanticGraph} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/cache/phase02-semantic-cache.mjs';
import {evaluateCacheNode,recordCacheNode,putObject,readObject,sha256} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/cache/incremental-cache.mjs';
import {compileCharacterSvg,planCharacterStateAssets,resolveShirtColorAssignments} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';
import {runSafeParallel} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/performance/safe-parallel-scheduler.mjs';
import {compileMemeProps} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/memes/compile-meme-props.mjs';
import {traceSceneStates} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/scene-state-trace.mjs';
import {LIBRARY,digest,json,confined,safeSvg,describeAssets,findCandidates} from './visual_candidates.mjs';
import {describeGallery} from './visual_gallery.mjs';
import {THEMES,renderPreview,quality,previewRuntime} from './visual_preview.mjs';
import {validateSeriesOpening} from './visual_opening.mjs';
import {resolveVisualRole} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/visual-role.mjs';

import {validateActingEvent,validateCameraShots,ACTING} from './visual_acting.mjs';
import {validateTransition} from './visual_transitions.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const MOTION=await json(path.join(LIBRARY,'../../contracts/motion-registry-v1.json'));
const ID=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/u;
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>digest(JSON.stringify(stable(x)));

export function validateIntent(intent,narration){
  validateSeriesOpening(intent?.opening,intent?.video);
  // Legacy media structures cannot be dropped silently at the Remotion → HF boundary.
  // Visual Studio currently owns the approved voice track only; additional tracks
  // and authored cover designs need a separate, validated production contract.
  assert(intent?.publish?.cover?.opening?.enabled!==true,'VISUAL_COVER_OPENING_UNSUPPORTED');
  assert(!intent?.publish?.cover || Object.keys(intent.publish.cover).length===0,'VISUAL_COVER_DESIGN_UNSUPPORTED');
  const audioKeys=['audio','audio_mix','music','background_music','soundtrack','sfx'];
  assert(!audioKeys.some(key=>intent?.[key]!==undefined),'VISUAL_AUDIO_MIX_UNSUPPORTED');
  assert(intent?.video?.width===1080 && intent.video.height===1920 && [24,30].includes(intent.video.fps),'VISUAL_VIDEO_UNSUPPORTED');
  assert(Array.isArray(intent.scenes)&&intent.scenes.length>0&&intent.scenes.length<=100,'VISUAL_SCENE_INVENTORY_INVALID');
  assert(intent.cast?.length<=20 && Object.keys(intent.assets??{}).length<=2000,'VISUAL_INVENTORY_LIMIT');
  for(const scene of intent.scenes)try{
    assert(ID.test(scene.id)&&scene.entities?.length>0&&scene.entities.length<=100&&scene.events?.length<=100,'VISUAL_SCENE_INVALID');
    const entities=new Set();
    for(const entity of scene.entities){
      assert(ID.test(entity.id)&&!entities.has(entity.id),'VISUAL_ENTITY_ID_INVALID');entities.add(entity.id);
      assert(entity.states?.[entity.initial_state]&&Object.keys(entity.states).length<=50,'VISUAL_ENTITY_STATES_INVALID');
      for(const [id,s] of Object.entries(entity.states)){
        assert(ID.test(id),'VISUAL_STATE_ID_INVALID');
        const t=s.transform;assert(t&&['x','y','width','height'].every(k=>typeof t[k]==='number'&&Number.isFinite(t[k]))&&t.width>0&&t.height>0&&t.width<=4320&&t.height<=7680&&Math.abs(t.x)<=4320&&Math.abs(t.y)<=7680,'VISUAL_TRANSFORM_INVALID');
        if(t.rotation!==undefined)assert(Number.isFinite(t.rotation)&&Math.abs(t.rotation)<=360,'VISUAL_ROTATION_INVALID');
        if(t.scale!==undefined)assert(Number.isFinite(t.scale)&&t.scale>0&&t.scale<=8,'VISUAL_SCALE_INVALID');
        if(s.opacity!==undefined)assert(Number.isFinite(s.opacity)&&s.opacity>=0&&s.opacity<=1,'VISUAL_OPACITY_INVALID');
        if(s.layer!==undefined)assert(Number.isInteger(s.layer)&&s.layer>=0&&s.layer<=10000,'VISUAL_LAYER_INVALID');
      }
    }
    const eventIds=new Set();
    for(const event of scene.events){
      const entity=scene.entities.find(e=>e.id===event.target);
      assert(ID.test(event.id)&&!eventIds.has(event.id)&&entity?.states[event.state_before]&&entity.states[event.state_after],'VISUAL_EVENT_INVALID '+event.id+' target='+event.target+' '+event.state_before+'->'+event.state_after+' (entity states: '+Object.keys(entity?.states??{}).join(',')+')');eventIds.add(event.id);
      assert(['voice_anchor','scene_start','scene_end'].includes(event.trigger?.type),'VISUAL_EVENT_TRIGGER_UNSUPPORTED');
      if(event.trigger.type==='voice_anchor')assert(typeof event.trigger.text==='string'&&event.trigger.text.trim(),'VISUAL_EVENT_ANCHOR_REQUIRED');
      if(event.motion?.preset==='enter'){ // the entrance is authored without geometry: Core measures how far outside the canvas it must start
        assert(event.trigger.type==='scene_start','VISUAL_ENTER_TRIGGER');
        const box=entity.states[event.state_before].transform,p=event.motion.params=event.motion.params??{};
        if(p.from===undefined)p.from=box.x+box.width/2<540?'left':'right'; // decided default: the nearest horizontal edge
        const need={left:box.x+box.width,right:1080-box.x,top:box.y+box.height,bottom:1920-box.y}[p.from];
        if((p.distance===undefined||p.distance_auto===true)&&need!==undefined){p.distance=Math.ceil(need)+16;p.distance_auto=true;} // re-measured on every validation; an authored distance is kept
      }
      if(ACTING.motions[event.motion?.preset])validateActingEvent(event,scene,event.target);
    }
    if(scene.transition!==undefined)validateTransition(scene.transition);
    if(scene.camera!==undefined){
      validateCameraShots(scene.camera);
      for(const shot of scene.camera)if(shot.trigger.type==='voice_anchor')assert(typeof shot.trigger.text==='string'&&shot.trigger.text.trim(),'VISUAL_CAMERA_ANCHOR_REQUIRED');
    }
    traceSceneStates(scene);
  }catch(error){if(error&&typeof error.message==='string'&&!error.message.includes('[scene '))error.message+=` [scene ${scene?.id}]`;throw error;}
  const projections=compileVisualIntent(intent,{narration});
  for(const scene of projections.production.scenes)for(const entity of scene.entities)resolveVisualRole(entity,projections.production.assets);
  return projections;
}

function measuredScenes(intent,narration,timing){
  assert(timing?.format==='zodiac-speech-time-map@2'&&timing.source==='measured_asr'&&timing.narration_sha256===digest(narration)&&Array.isArray(timing.words)&&timing.words.length,'VISUAL_MEASURED_TIMING_REQUIRED');
  const bytes=Buffer.from(narration),words=[];
  for(const word of timing.words){
    const [a,b]=word.source_range??[];
    assert(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>a&&b<=bytes.length&&Number.isFinite(word.startMs)&&Number.isFinite(word.endMs)&&word.startMs>=0&&word.endMs>word.startMs,'VISUAL_MEASURED_WORD_INVALID');
    const previous=words.at(-1);
    if(previous&&previous.source_range[0]===a&&previous.source_range[1]===b)previous.endMs=word.endMs;
    else words.push({...word,text:bytes.subarray(a,b).toString('utf8'),source_range:[a,b]});
  }
  return intent.scenes.map((scene,index)=>{
    const [a,b]=scene.narration_range,selected=words.filter(w=>w.source_range[0]>=a&&w.source_range[1]<=b);
    assert(selected.length,'VISUAL_SCENE_TIMING_MISSING '+scene.id);
    const startMs=index===0?0:selected[0].startMs;
    const next=intent.scenes[index+1];
    const nextWord=next&&words.find(w=>w.source_range[0]>=next.narration_range[0]);
    const endMs=nextWord?.startMs??timing.duration_seconds*1000;
    assert(endMs>startMs&&selected.at(-1).endMs<=endMs+.1,'VISUAL_SCENE_TIMING_OVERLAP '+scene.id);
    const triggerAt=(event)=>{
      let at=0;
      if(event.trigger.type==='scene_end')at=(endMs-startMs)/1000;
      if(event.trigger.type==='voice_anchor'){
        const fragment=bytes.subarray(a,b).toString('utf8'),text=event.trigger.text;
        let offset=fragment.indexOf(text);
        assert(offset>=0,'VISUAL_VOICE_ANCHOR_NOT_IN_SOURCE '+event.id);
        const byteAt=a+Buffer.byteLength(fragment.slice(0,offset));
        const anchor=selected.find(w=>w.source_range[0]<=byteAt&&w.source_range[1]>byteAt);
        const covered=[...text.matchAll(/\S+/gu)].every(match=>{
          const left=byteAt+Buffer.byteLength(text.slice(0,match.index)),right=left+Buffer.byteLength(match[0]);
          return selected.some(w=>w.source_range[0]<=left&&w.source_range[1]>=right);
        });
        assert(anchor&&covered,'VISUAL_VOICE_ANCHOR_UNMEASURED '+event.id);at=(anchor.startMs-startMs)/1000;
      }
      return at;
    };
    const events=scene.events.map(event=>{
      const at=triggerAt(event);
      const preset=event.motion?.preset??'state_swap',acting=ACTING.motions[preset],motion=MOTION.motions[preset]??acting;
      assert(motion,'VISUAL_MOTION_UNSUPPORTED '+preset);
      const frames=event.motion?.duration_frames??motion.default_duration_frames;
      assert(Number.isInteger(frames)&&frames>=0&&frames<=300,'VISUAL_MOTION_DURATION_INVALID');
      assert(acting||frames===motion.default_duration_frames||event.motion?.duration_override===true,'VISUAL_MOTION_OVERRIDE_REQUIRED');
      return {...event,at,measured:true,preview_motion:preset,preview_duration:frames/intent.video.fps,preview_params:acting?{...(event.motion?.params??{})}:null};
    }).sort((x,y)=>x.at-y.at);
    const camera=(scene.camera??[]).map(shot=>({id:shot.id,at:triggerAt(shot),duration:(shot.duration_frames??0)/intent.video.fps,from:shot.from,to:shot.to,reason:shot.reason??null})).sort((x,y)=>x.at-y.at);
    return {scene_id:scene.id,fps:intent.video.fps,startMs,endMs,words:selected,events,camera,narration_range:[a,b],measured:true};
  });
}

async function compilerIdentity(){
  const files=[];
  async function walk(root){for(const row of await readdir(root,{withFileTypes:true})){if(row.isSymbolicLink())throw Error('VISUAL_COMPILER_SYMLINK');const file=path.join(root,row.name);if(row.isDirectory())await walk(file);else if(/\.(mjs|json|svg)$/u.test(row.name))files.push([path.relative(ROOT,file),digest(await readFile(file))]);}}
  await walk(LIBRARY);
  files.push(['caption-font',digest(await readFile(path.join(ROOT,'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf')))]);
  files.push(['caption-fontkit',digest(await readFile(path.join(ROOT,'apps/zodiac-studio/node_modules/fontkit/package.json')))]);
  for(const rel of ['features/visual-composition/compile-visual-intent.mjs','core/cache/incremental-cache.mjs','core/cache/phase02-semantic-cache.mjs','contracts/motion-registry-v1.json'])files.push([rel,digest(await readFile(path.join(LIBRARY,'../..',rel)))]);
  for(const file of ['visual_acting.mjs','acting_registry.json','visual_transitions.mjs','transitions.json','visual_compiler.mjs','visual_preview.mjs','visual_candidates.mjs','visual_themes.mjs','visual_presentation.mjs','visual_captions.mjs','visual_opening.mjs','visual_contract.json'])files.push([file,digest(await readFile(new URL(file,import.meta.url)))]);
  for(const file of ['spatial-layout.mjs','semantic-motion.mjs','visual-role.mjs','caption-layout.mjs','caption-karaoke.mjs'])files.push(['renderer/'+file,digest(await readFile(path.join(ROOT,'runtime/zodiac-renderer/2.0.2/renderer/src',file)))]);
  return hash(files.sort(([a],[b])=>a.localeCompare(b)));
}

export async function buildEpisode(input){
  const begun=performance.now(),usage=process.cpuUsage(),{intent,narration}=input;
  const projections=validateIntent(intent,narration);
  if(input.action==='validate_performance'){
    assert(intent.scenes.some(scene=>scene.id===input.scene_id),'VISUAL_SCENE_UNKNOWN');
    for(const scene of measuredScenes(intent,narration,input.timing)){
      if(scene.scene_id!==input.scene_id)continue;
      traceSceneStates({...intent.scenes.find(authored=>authored.id===scene.scene_id),events:scene.events});
      const ends=new Map(),duration=(scene.endMs-scene.startMs)/1000;
      for(const event of scene.events){
        assert(event.at+event.preview_duration<=duration+.001,'VISUAL_PERFORMANCE_OUTSIDE_SCENE '+event.id);
        assert(event.at>=(ends.get(event.target)??0),'VISUAL_PERFORMANCE_OVERLAP '+event.id);
        ends.set(event.target,event.at+event.preview_duration);
      }
    }
    return {status:'VALID',source_sha256:hash(intent),not_an_approval:true};
  }
  if(input.action==='validate_authoring')planCharacterStateAssets(projections.production,projections.character_assembly);
  if(['validate','validate_authoring'].includes(input.action))return {status:'VALID',source_sha256:hash(intent),scene_ids:intent.scenes.map(s=>s.id),projection_sha256:hash(projections),not_an_approval:true};
  const measured=measuredScenes(intent,narration,input.timing),theme=input.theme??'light';assert(THEMES[theme],'VISUAL_THEME_UNKNOWN');
  if(input.scene_id)assert(intent.scenes.some(s=>s.id===input.scene_id),'VISUAL_SCENE_UNKNOWN');
  const cache=path.resolve(input.cache),out=path.resolve(input.output);
  await mkdir(cache,{recursive:true});await mkdir(out,{recursive:true});
  const disk=await statfs(out);assert(Number(disk.bavail)*Number(disk.bsize)>128*1024*1024,'VISUAL_DISK_BUDGET_EXCEEDED');
  const compiler=await compilerIdentity(),events=[],dag={},values=new Map();let graphWrites=Promise.resolve();
  async function node(id,data,deps,compute){
    const dependencies=Object.fromEntries(deps.map(dep=>[dep,hash(values.get(dep))])),file='nodes/'+digest(id)+'.json';
    const check=await evaluateCacheNode(cache,{nodeId:id,input:data,compiler,dependencies,outputs:[file]});
    let value,objectDrift=false;
    if(check.hit){value=await json(path.join(cache,file));
      // Cached JSON can refer to content-addressed geometry objects; verify their bytes too.
      for(const entry of value.objects??[]){
        try{if(!await readObject(cache,entry.sha256)){value=null;objectDrift=true;break;}}
        catch(error){
          if(!String(error).includes('CACHE_OBJECT_TAMPERED'))throw error;
          const object=path.join(cache,'.authoring/cache/objects',entry.sha256);
          await rename(object,object+'.corrupt-'+Date.now());value=null;objectDrift=true;break;
        }
      }
    }
    if(!value){value=await compute();await mkdir(path.dirname(path.join(cache,file)),{recursive:true});await writeFile(path.join(cache,file),JSON.stringify(value));
      graphWrites=graphWrites.then(()=>recordCacheNode(cache,{nodeId:id,input:data,compiler,dependencies,outputs:[file]}));await graphWrites;}
    values.set(id,value);dag[id]={dependencies:deps,input_sha256:hash(data),output_sha256:hash(value)};
    events.push({node_id:id,hit:!!check.hit&&!objectDrift,reason:objectDrift?'MISS_OBJECT_DRIFT':check.reason});return value;
  }
  // Color resolution needs all co-visible actors, but each geometry key ignores scene placement/theme.
  const plan=projections.character_assembly,colors=resolveShirtColorAssignments(projections.production,plan);
  const statePlan=planCharacterStateAssets(projections.production,plan),assetMap={};
  const jobs=statePlan.characters.map(char=>({id:'geometry:character:'+char.entity_id,run:async()=>{
    const spec=plan.characters.find(c=>c.entity_id===char.entity_id),identity={...spec,variant_seed:spec.variant_seed??spec.entity_id,shirt_color_id:colors.get(char.entity_id)};
    return node('geometry:character:'+char.entity_id,{identity,groups:char.groups},[],async()=>{
      const rows=[],objects=[];
      for(const group of char.groups){const built=compileCharacterSvg(identity,spec.states[group.representative_state_id]);safeSvg(Buffer.from(built.svg));const object=await putObject(cache,built.svg);objects.push(object);
        rows.push({...group,sha256:object.sha256,identity_signature:built.identity_signature,sockets:built.sockets,
          blueprint:{identity_id:spec.identity_id??spec.entity_id,identity_signature:built.identity_signature,body_profile:spec.body_profile,hair_id:spec.hair_id,
            face_profile_id:built.face_profile_id,accessory_id:built.accessory_id,outfit_id:spec.outfit_id,zodiac_sign_id:spec.zodiac_sign_id??null,
            shirt_color_id:built.shirt_color_id,shirt_color:built.shirt_color,pose_id:built.pose_id,expression_id:built.expression_id,crop_id:built.crop_id}});}
      return {entity_id:char.entity_id,rows,objects};
    });
  }}));
  // Bounded ready queue: geometry nodes are independent; no unbounded per-scene process fan-out.
  const concurrency=os.freemem()<2*1024**3?1:Math.max(1,Math.min(2,os.availableParallelism?.()??os.cpus().length));
  const scheduled=await runSafeParallel(jobs.map(j=>({...j,reads:['v4-catalogs'],writes:[j.id],dependencies:[]})),{maxConcurrency:concurrency,execute:job=>job.run()});
  assert(scheduled.status==='PASS','VISUAL_GEOMETRY_BLOCKED '+JSON.stringify(scheduled.results.filter(r=>r.status!=='PASS')));
  for(const char of statePlan.characters){const result=values.get('geometry:character:'+char.entity_id);
    for(const row of result.rows){const bytes=await readObject(cache,row.sha256);assert(bytes,'VISUAL_CACHE_OBJECT_MISSING');assetMap[row.asset_id]={svg:bytes.toString('utf8'),source_sha256:row.sha256,identity_signature:row.identity_signature,sockets:row.sockets,geometry_node:'geometry:character:'+char.entity_id,
      metadata:{style_id:'zodiac-paper-doodle-meme-v4',category:'character',character_blueprint:row.blueprint,lineage:{mode:'composite',source_library:'zodiac-visual-grammar-v4',semantic_intent:char.entity_id}}};
      for(const scene of projections.production.scenes)for(const entity of scene.entities)if(entity.id===char.entity_id)for(const stateId of row.state_ids)if(entity.states[stateId])entity.states[stateId].asset=row.asset_id;
    }
  }
  const memeProduction=await compileMemeProps(projections.production,{root:out,writeAssets:false});
  projections.production=memeProduction;
  const memeSources=new Map();
  for(const scene of memeProduction.scenes)for(const req of scene.visual_grammar?.meme_composition?.asset_requirements??[]){
    const relative=path.relative(LIBRARY,path.resolve(LIBRARY,'memes',req.source_path)).split(path.sep).join('/');
    memeSources.set(req.asset_id,await confined(LIBRARY,relative));
  }
  const required=new Set(projections.production.scenes.flatMap(s=>s.entities.flatMap(e=>Object.values(e.states).map(v=>v.asset))));
  for(const id of required){if(assetMap[id])continue;const asset=projections.production.assets[id];assert(asset?.path,'VISUAL_ASSET_MISSING '+id);
    let file;
    if(memeSources.has(id))file=memeSources.get(id);
    else if(asset.path.startsWith('library:'))file=await confined(LIBRARY,asset.path.slice(8));
    else {try{file=await confined(input.workspace,asset.path);}catch(error){
      const normalized=asset.path.replace(/^assets\//u,'');
      try{file=await confined(LIBRARY,normalized);}catch{throw error;}
    }}
    const bytes=await readFile(file);assert(bytes.length<=2*1024*1024,'VISUAL_ASSET_TOO_LARGE');safeSvg(bytes);
    if(asset.source_sha256)assert(asset.source_sha256===digest(bytes),'VISUAL_ASSET_SOURCE_DRIFT '+id);
    const source=digest(bytes),result=await node('geometry:asset:'+id,{asset,source},[],async()=>{const object=await putObject(cache,bytes);return {objects:[object],source_sha256:source};});
    assetMap[id]={svg:(await readObject(cache,result.source_sha256)).toString('utf8'),source_sha256:source,geometry_node:'geometry:asset:'+id,
      metadata:asset};
  }
  const runtime=await previewRuntime(ROOT);
  assert(Object.values(assetMap).reduce((n,a)=>n+Buffer.byteLength(a.svg),0)<=32*1024*1024,'VISUAL_ASSET_MEMORY_BUDGET');
  const scenes=[];let previewBytes=0;
  for(const scene of projections.production.scenes){
    assert(scene.entities.reduce((n,e)=>n+Object.values(e.states).reduce((m,s)=>m+Buffer.byteLength(assetMap[s.asset].svg),0),0)<=4*1024*1024,'VISUAL_SCENE_PREVIEW_BUDGET '+scene.id);
    const time=measured.find(t=>t.scene_id===scene.id),deps=[...new Set(scene.entities.flatMap(e=>Object.values(e.states).map(s=>assetMap[s.asset].geometry_node)))];
    const geometry=await node('scene:'+scene.id,{scene,time},deps,async()=>({scene,time,asset_hashes:Object.fromEntries(scene.entities.flatMap(e=>Object.values(e.states).map(s=>[s.asset,assetMap[s.asset].source_sha256])))}));
    const sceneOpening=scene.id===projections.production.scenes[0].id?intent.opening??null:null;
    const appearance=await node('appearance:'+scene.id,{theme:THEMES[theme],font_sha256:runtime.font.sha256,gsap_sha256:digest(runtime.gsap),opening:sceneOpening},['scene:'+scene.id],async()=>renderPreview(geometry.scene,assetMap,geometry.time,theme,runtime.gsap,runtime.font,{},sceneOpening));
    previewBytes+=Buffer.byteLength(appearance.html);assert(previewBytes<=32*1024*1024,'VISUAL_EPISODE_PREVIEW_BUDGET');
    const file=scene.id+'.html';await writeFile(path.join(out,file),appearance.html);
    const required_nodes=scene.entities.flatMap(e=>Object.keys(e.states).map(s=>'state:'+e.id+':'+s)).concat(scene.events.map(e=>'event:'+e.id));
    const satisfied_nodes=appearance.source_map.map(m=>'state:'+m.entity_id+':'+m.state_id).concat(time.events.map(e=>'event:'+e.id));
    assert(required_nodes.every(id=>satisfied_nodes.includes(id)),'VISUAL_REQUIRED_COMPONENT_MISSING '+scene.id);
    scenes.push({id:scene.id,preview_file:file,preview_sha256:digest(appearance.html),source_map:appearance.source_map,
      required_nodes,satisfied_nodes,blocked_nodes:[],font_sha256:runtime.font.sha256,
      start_ms:time.startMs,end_ms:time.endMs,duration_seconds:appearance.duration_seconds,fidelity:appearance.fidelity,
      qa:quality(scene,theme,time),entity_count:scene.entities.length,event_count:scene.events.length,asset_ids:Object.keys(geometry.asset_hashes)});
    process.stderr.write(JSON.stringify({event:'scene.preview_ready',scene_id:scene.id,completed:scenes.length,total:intent.scenes.length})+'\n');
  }
  assert(scenes.length===intent.scenes.length,'VISUAL_BUILD_INCOMPLETE');
  const production={...projections.production,assets:Object.fromEntries(Object.entries(assetMap).map(([id,a])=>[id,{...projections.production.assets[id],...a.metadata,path:'assets/'+a.source_sha256+'.svg',sha256:a.source_sha256,identity_signature:a.identity_signature??null}]))};
  await mkdir(path.join(out,'assets'),{recursive:true});
  for(const a of Object.values(assetMap))await writeFile(path.join(out,'assets',a.source_sha256+'.svg'),a.svg);
  await writeFile(path.join(out,'production.json'),JSON.stringify(production,null,2));
  const manifest={format:'zodiac-episode-build@1',status:'TECHNICAL_VALID',revision:input.revision,source_sha256:hash(intent),narration_sha256:digest(narration),
    voice_sha256:input.timing.wav_sha256,timing_sha256:hash(input.timing),theme,compiler_sha256:compiler,scenes,dag,semantic_graph:buildPhase02SemanticGraph(intent),
    assets:Object.fromEntries(Object.entries(assetMap).map(([id,a])=>[id,{sha256:a.source_sha256,identity_signature:a.identity_signature??null}])),
    production_sha256:digest(await readFile(path.join(out,'production.json'))),
    performance_graph:{format:'zodiac-performance-graph@1',scenes:measured.map(t=>({scene_id:t.scene_id,fps:t.fps,source_range:t.narration_range,startMs:t.startMs,endMs:t.endMs,events:t.events,camera:t.camera,words:t.words,measured:true}))},
    contracts:{presentation_contract_sha256:digest(await readFile(new URL('./visual_contract.json',import.meta.url))),theme:'zodiac-visual-theme@1',performance:'zodiac-performance-graph@1',motion:MOTION.format,motion_registry_sha256:hash(MOTION),source_map:'zodiac-hyperframes-source-map@1',legacy:'V4_JOB5_DERIVED_PRODUCTION'},
    cache:{events,reused:events.filter(e=>e.hit).length,rebuilt:events.filter(e=>!e.hit).length,concurrency},
    resources:{wall_ms:Math.round(performance.now()-begun),cpu_microseconds:process.cpuUsage(usage),peak_rss_bytes:process.resourceUsage().maxRSS*1024,free_memory_bytes:os.freemem(),free_disk_bytes:Number(disk.bavail)*Number(disk.bsize),output_bytes:(await Promise.all(scenes.map(s=>stat(path.join(out,s.preview_file))))).reduce((n,s)=>n+s.size,0)},
    renderer:'hyperframes-sdk-preview',renderer_parity:'NOT_ASSERTED',human_visual_review:'PENDING',approval_granted:false};
  await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}

async function main(){const input=await json(process.argv[2]);let output;
  if(input.action==='assets')output=await describeAssets();
  else if(input.action==='export_prepare'){const {prepareExport}=await import('./visual_export.mjs');output=await prepareExport(input);}
  else if(input.action==='autofix_geometry'){const {autofixIntent}=await import('./visual_autofix.mjs');output=autofixIntent(input.intent,{theme:input.theme,sceneIds:input.scene_ids??null});}
  else if(input.action==='gallery')output=await describeGallery(input.usage);
  else if(input.action==='candidates')output=await findCandidates(input.intent,input.scene_id,input.requirement,input.usage);
  else output=await buildEpisode(input);
  await writeFile(process.argv[3],JSON.stringify(output));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stderr.write(String(error.stack??error)+'\n');process.exitCode=1;});
