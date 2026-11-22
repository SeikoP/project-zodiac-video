import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpath,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {renderEpisode,renderPreview,previewRuntime,quality} from '../tools/studio_project/visual_preview.mjs';
import {buildEpisode} from '../tools/studio_project/visual_compiler.mjs';
import {prepareExport} from '../tools/studio_project/visual_export.mjs';
import {digest} from '../tools/studio_project/visual_candidates.mjs';
import {makeFixture,syntheticTiming} from './studio_p34_fixture.mjs';

async function play(html){
 const sdk=await realpath(path.resolve('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js'));
 const {document}=createRequire(sdk)('linkedom').parseHTML(html);let at=0,update;
 const timeline={time:()=>at,to:()=>timeline,seek(t){at=t;update();return timeline;},pause:()=>timeline};
 vm.runInNewContext([...document.querySelectorAll('script')].at(-1).textContent,{document,window:{},parent:{postMessage(){}},addEventListener(){},gsap:{timeline(options){update=options.onUpdate;return timeline;}}});
 return {document,seek:t=>timeline.seek(t)};
}

test('whole-episode composition reuses the preview painter, measured captions and acting',async()=>{
 const runtime=await previewRuntime(path.resolve('.'));
 const scene={id:'s01',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:200,y:300,width:300,height:400}},react:{asset:'a',transform:{x:200,y:300,width:300,height:400}}}}]};
 const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0H20V20Z"/></svg>',source_sha256:'a'.repeat(64)}};
 const time={scene_id:'s01',startMs:0,endMs:1000,measured:true,words:[{text:'Xin',startMs:0,endMs:400}],events:[{id:'react',target:'actor',state_before:'idle',state_after:'react',at:.3,preview_motion:'small-bounce',preview_duration:.4}]};
 const before=JSON.stringify({scene,time,assets});
 const single=renderPreview(scene,assets,time,'indigo-noir',runtime.gsap,runtime.font);
 const full=renderEpisode([{scene,time}],assets,'indigo-noir',30,runtime);
 assert.ok(full.html.includes('data-composition-id="episode"'));
 assert.ok(full.html.includes('data-duration="1"')&&full.html.includes('data-fps="30"'));
 assert.ok(full.html.includes('small-bounce')&&full.html.includes('Xin'));
 assert.equal(full.duration_seconds,1);assert.equal(full.frames,30);
 assert.deepEqual(full.source_map,single.source_map);
 assert.equal(JSON.stringify({scene,time,assets}),before);
 assert.ok(single.html.includes('top:740px')&&full.html.includes('top:740px'));
});

test('caption occlusion QA follows the shared central caption lane',()=>{
 const scene=y=>({entities:[{id:'foreground',states:{shown:{visible:true,layer:1000,transform:{x:200,y,width:200,height:100}}}}]});
 assert.equal(quality(scene(780),'light').issues[0].code,'CAPTION_OCCLUSION');
 assert.equal(quality(scene(300),'light').status,'PASS');
 assert.equal(quality(scene(1600),'light').status,'PASS');
});

test('cutout state swaps never crossfade duplicate limbs in preview or export',async()=>{
 const runtime=await previewRuntime(path.resolve('.'));
 const scene={id:'s01',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:0,y:0,width:300,height:400}},react:{asset:'a',transform:{x:0,y:0,width:300,height:400}}}}]};
 const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',source_sha256:'a'.repeat(64)}};
 const time={startMs:0,endMs:1000,words:[],events:[{id:'swap',target:'actor',state_before:'idle',state_after:'react',at:.2,preview_motion:'state_swap',preview_duration:.4}]};
 for(const html of [renderPreview(scene,assets,time,'light',runtime.gsap,runtime.font).html,renderEpisode([{scene,time}],assets,'light',30,runtime).html]){
  const played=await play(html);played.seek(.3);
  const visible=[...played.document.querySelectorAll('[data-entity-id]')].filter(el=>el.style.visibility==='visible');
  assert.equal(visible.length,1);assert.equal(visible[0].dataset.stateId,'react');
 }
});

test('export preparation rejects altered production, scene HTML and SVG bytes',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hf-export-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const narration='Song Tử hỏi thêm câu 1.',intent=makeFixture(narration,1),timing=syntheticTiming(narration);
 intent.scenes[0].events.at(-1).motion={preset:'state_swap',duration_frames:6,duration_override:true};
 const output=path.join(root,'build'),manifest=await buildEpisode({intent,narration,timing,workspace:root,cache:path.join(root,'cache'),output,revision:1,theme:'light'});
 const input={build_root:output,manifest_sha256:digest(await readFile(path.join(output,'manifest.json'))),source_sha256:manifest.source_sha256,voice_sha256:manifest.voice_sha256,source_root:path.resolve('.'),output:path.join(root,'export')};
 const prepared=await prepareExport(input);
 assert.equal(prepared.renderer,'hyperframes@0.9.63');
 const captions=await readFile(path.join(input.output,'captions.srt'),'utf8');
 assert.match(captions,/1\n00:00:00,000 --> 00:00:01,500\nSong Tử hỏi thêm câu 1\./u);
 assert.equal(prepared.captions_sha256,digest(captions));
 const files=['production.json',manifest.scenes[0].preview_file,'assets/'+manifest.assets.phone.sha256+'.svg'];
 for(const relative of files){
  const file=path.join(output,relative),before=await readFile(file);
  try{await writeFile(file,'tampered');await assert.rejects(prepareExport(input),/EXPORT_BUILD_DRIFT/u);}
  finally{await writeFile(file,before);}
 }
});

test('subtitle cues retain Vietnamese source and global timing across scenes',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hf-captions-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const narration='Nhân Mã hỏi thêm câu 1.\nHội bạn hỏi thêm câu 2.',intent=makeFixture(narration,2),timing=syntheticTiming(narration);
 for(const scene of intent.scenes)scene.events=[];
 const output=path.join(root,'build'),manifest=await buildEpisode({intent,narration,timing,workspace:root,cache:path.join(root,'cache'),output,revision:1,theme:'light'});
 const input={build_root:output,manifest_sha256:digest(await readFile(path.join(output,'manifest.json'))),source_sha256:manifest.source_sha256,voice_sha256:manifest.voice_sha256,source_root:path.resolve('.'),output:path.join(root,'export')};
 const receipt=await prepareExport(input),captions=await readFile(path.join(input.output,'captions.srt'),'utf8');
 assert.equal(captions,'1\n00:00:00,000 --> 00:00:01,500\nNhân Mã hỏi thêm câu 1.\n\n2\n00:00:01,500 --> 00:00:03,000\nHội bạn hỏi thêm câu 2.\n');
 assert.equal(receipt.captions_sha256,digest(captions));
});
