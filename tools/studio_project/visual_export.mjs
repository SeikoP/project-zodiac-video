// Derived export only; preview and final capture share the same measured acting painter.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {digest,confined,safeSvg} from './visual_candidates.mjs';
import {renderPreview,renderEpisode,previewRuntime} from './visual_preview.mjs';
import {traceSceneStates} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/scene-state-trace.mjs';

export async function prepareExport(input){
 const read=async(rel,sha)=>{const bytes=await readFile(await confined(input.build_root,rel));if(!sha||digest(bytes)!==sha)throw Error('EXPORT_BUILD_DRIFT '+rel);return bytes;};
 const manifest=JSON.parse(await read('manifest.json',input.manifest_sha256));
 if(manifest.format!=='zodiac-episode-build@1'||manifest.source_sha256!==input.source_sha256||manifest.voice_sha256!==input.voice_sha256)throw Error('EXPORT_SOURCE_DRIFT');
 const production=JSON.parse(await read('production.json',manifest.production_sha256)),assets={},rows=[];
 if(production.scenes.length!==manifest.scenes.length)throw Error('EXPORT_SCENE_INVENTORY');
 for(const [id,asset]of Object.entries(manifest.assets)){
  const bytes=await read('assets/'+asset.sha256+'.svg',asset.sha256);
  assets[id]={svg:safeSvg(bytes),source_sha256:asset.sha256};
 }
 const runtime=await previewRuntime(input.source_root);
 for(const scene of production.scenes){
  const built=manifest.scenes.find(row=>row.id===scene.id),time=manifest.performance_graph.scenes.find(row=>row.scene_id===scene.id);
  if(!built||built.qa.status!=='PASS'||!time?.words?.length)throw Error('EXPORT_REBUILD_REQUIRED '+scene.id);
  await read(built.preview_file,built.preview_sha256);
  const preview=renderPreview(scene,assets,time,manifest.theme,runtime.gsap,runtime.font);
  if(digest(preview.html)!==built.preview_sha256)throw Error('EXPORT_PREVIEW_DRIFT '+scene.id);
  traceSceneStates({...scene,events:time.events});
  const ends=new Map();
  for(const event of time.events){
   if(event.at+event.preview_duration>(time.endMs-time.startMs)/1000+.001||event.at<(ends.get(event.target)??0))throw Error('EXPORT_ACTING_TIMING_INVALID '+scene.id+'/'+event.id);
   ends.set(event.target,event.at+event.preview_duration);
  }
  rows.push({scene,time});
 }
 const composition=renderEpisode(rows,assets,manifest.theme,production.video.fps,runtime);
 await mkdir(input.output,{recursive:true});await writeFile(path.join(input.output,'index.html'),composition.html);
 const stamp=ms=>new Date(Math.round(ms)).toISOString().slice(11,23).replace('.',',');
 const cues=[];
 for(const {time}of rows)for(let i=0;i<time.words.length;i+=6){
  const words=time.words.slice(i,i+6);
  cues.push(`${cues.length+1}\n${stamp(words[0].startMs)} --> ${stamp(words.at(-1).endMs)}\n${words.map(w=>w.text).join(' ')}`);
 }
 const captions=cues.join('\n\n')+'\n';
 await writeFile(path.join(input.output,'captions.srt'),captions);
 return {format:'zodiac-hyperframes-export@1',composition_sha256:digest(composition.html),source_sha256:manifest.source_sha256,
  captions_sha256:digest(captions),
  build_manifest_sha256:input.manifest_sha256,voice_sha256:input.voice_sha256,theme:manifest.theme,fps:production.video.fps,
  duration_seconds:composition.duration_seconds,frames:composition.frames,renderer:'hyperframes@0.9.63',human_review:'PENDING',approval_granted:false};
}
