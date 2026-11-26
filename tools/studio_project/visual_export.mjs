// Derived export only; preview and final capture share the same measured acting painter.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {digest,confined,safeSvg} from './visual_candidates.mjs';
import {renderPreview,renderEpisode,previewRuntime} from './visual_preview.mjs';
import {captionsToSrt} from './visual_captions.mjs';
import {traceSceneStates} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/scene-state-trace.mjs';

export async function prepareExport(input){
 const read=async(rel,sha)=>{const bytes=await readFile(await confined(input.build_root,rel));if(!sha||digest(bytes)!==sha)throw Error('EXPORT_BUILD_DRIFT '+rel);return bytes;};
 const manifest=JSON.parse(await read('manifest.json',input.manifest_sha256));
 if(manifest.format!=='zodiac-episode-build@1'||manifest.source_sha256!==input.source_sha256||manifest.voice_sha256!==input.voice_sha256)throw Error('EXPORT_SOURCE_DRIFT');
 const production=JSON.parse(await read('production.json',manifest.production_sha256)),assets={},rows=[];
 if(production.scenes.length!==manifest.scenes.length)throw Error('EXPORT_SCENE_INVENTORY');
 for(const [id,asset]of Object.entries(manifest.assets)){
  const bytes=await read('assets/'+asset.sha256+'.svg',asset.sha256);
  // Preserve the same asset role/category metadata used by the build preview.
  // Otherwise legacy entities without an explicit kind silently become overlays.
  assets[id]={svg:safeSvg(bytes),source_sha256:asset.sha256,metadata:production.assets[id]??{}};
 }
 const runtime=await previewRuntime(input.source_root);
 for(const scene of production.scenes){
  const built=manifest.scenes.find(row=>row.id===scene.id),time=manifest.performance_graph.scenes.find(row=>row.scene_id===scene.id);
  if(!built||built.qa.status!=='PASS'||!time?.words?.length)throw Error('EXPORT_REBUILD_REQUIRED '+scene.id);
  await read(built.preview_file,built.preview_sha256);
  const preview=renderPreview(scene,assets,time,manifest.theme,runtime.gsap,runtime.font,{},production.scenes[0].id===scene.id?production.opening??null:null);
  if(digest(preview.html)!==built.preview_sha256)throw Error('EXPORT_PREVIEW_DRIFT '+scene.id);
  traceSceneStates({...scene,events:time.events});
  const ends=new Map();
  for(const event of time.events){
   if(event.at+event.preview_duration>(time.endMs-time.startMs)/1000+.001||event.at<(ends.get(event.target)??0))throw Error('EXPORT_ACTING_TIMING_INVALID '+scene.id+'/'+event.id);
   ends.set(event.target,event.at+event.preview_duration);
  }
  rows.push({scene,time});
 }
 const composition=renderEpisode(rows,assets,manifest.theme,production.video.fps,runtime,{},production.opening??null);
 await mkdir(input.output,{recursive:true});await writeFile(path.join(input.output,'index.html'),composition.html);
 const captions=captionsToSrt(composition.caption_cues);
 await writeFile(path.join(input.output,'captions.srt'),captions);
 return {format:'zodiac-hyperframes-export@1',composition_sha256:digest(composition.html),source_sha256:manifest.source_sha256,
  captions_sha256:digest(captions),
  build_manifest_sha256:input.manifest_sha256,voice_sha256:input.voice_sha256,theme:manifest.theme,fps:production.video.fps,
  duration_seconds:composition.duration_seconds,frames:composition.frames,renderer:'hyperframes@0.9.63',
  audio_contract:{mode:'approved-voice-only@1',voice_sha256:input.voice_sha256,music_tracks:0,sfx_tracks:0},
  cover_contract:production.opening?{mode:'series-topic-opening@1',opening:production.opening}:{mode:'first-encoded-video-frame@1'},
  human_review:'PENDING',approval_granted:false};
}
