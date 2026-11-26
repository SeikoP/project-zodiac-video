import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpath,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {renderEpisode,renderPreview,previewRuntime,quality} from '../tools/studio_project/visual_preview.mjs';
import {buildEpisode,validateIntent} from '../tools/studio_project/visual_compiler.mjs';
import {prepareExport} from '../tools/studio_project/visual_export.mjs';
import {zodiacGlyph} from '../tools/studio_project/visual_opening.mjs';
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
 assert.ok(single.html.includes('font-size:84px')&&full.html.includes('font-size:84px'));
 assert.ok(single.html.includes('data-watermark="brand"')&&full.html.includes('data-watermark="brand"'));
});

test('all zodiac covers use native vector glyphs, not arbitrary letter monograms',()=>{
 for(const name of ['Bạch Dương','Kim Ngưu','Song Tử','Cự Giải','Sư Tử','Xử Nữ',
                      'Thiên Bình','Bọ Cạp','Nhân Mã','Ma Kết','Bảo Bình','Song Ngư']){
  const svg=zodiacGlyph(name);
  assert.match(svg,/data-zodiac-glyph=/u);
  assert.match(svg,/<path /u);
  assert.doesNotMatch(svg,/<text\b|<span\b/u);
 }
 assert.match(zodiacGlyph('Nhân Mã'),/M20 81 L81 20/u);
});

test('series-topic opening identifies zodiac and theme, begins at frame zero without delaying captions',async()=>{
 const opening={format:'zodiac-series-opening@1',series:'12 CUNG HOÀNG ĐẠO',sign:'Nhân Mã',
   topic:'Cách Nhân Mã yêu thật lòng',duration_frames:45,transition_frames:9};
 const runtime=await previewRuntime(path.resolve('.'));
 const scene={id:'intro',entities:[{id:'hero',kind:'character',initial_state:'idle',
   states:{idle:{asset:'actor',transform:{x:260,y:500,width:490,height:700}}}}],events:[]};
 const assets={actor:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',source_sha256:'a'.repeat(64)}};
 const time={fps:30,startMs:0,endMs:3000,measured:true,words:[{text:'Nhân',startMs:0,endMs:250},{text:'Mã',startMs:250,endMs:500}],events:[]};
 const preview=renderPreview(scene,assets,time,'light',runtime.gsap,runtime.font,{},opening);
 const full=renderEpisode([{scene,time}],assets,'light',30,runtime,{},opening);
 for(const html of [preview.html,full.html]){
  assert.match(html,/data-cover-opening="series-topic"/u);
  assert.match(html,/height:1470px/u);
  assert.match(html,/data-cover-design="zodiac-paper-doodle-meme-v4"/u);
  assert.match(html,/data-cover-native-actor="hero"/u);
  assert.match(html,/transform:rotate\(-2deg\)/u);
  assert.doesNotMatch(html,/background:linear-gradient\(/u);
  assert.match(html,/12 CUNG HOÀNG ĐẠO/u);
  assert.match(html,/Cách Nhân Mã yêu thật lòng/u);
  const played=await play(html);
  const overlay=played.document.querySelector('#series-opening');
  played.seek(0);assert.equal(overlay.style.opacity,'1');
  played.seek(1.4);assert.ok(Number(overlay.style.opacity)>0 && Number(overlay.style.opacity)<1);
  played.seek(1.55);assert.equal(overlay.style.opacity,'0');
 }
 assert.equal(full.frames,90);assert.equal(full.caption_cues[0].startMs,0);
});

test('opening rejects replacing series topic with arbitrary hook without sign',()=>{
 const narration='Nhân Mã vui vẻ.',intent=makeFixture(narration,1);
 intent.opening={format:'zodiac-series-opening@1',series:'12 CUNG HOÀNG ĐẠO',sign:'Nhân Mã',
  topic:'Bạn sẽ không tin chuyện này!',duration_frames:45,transition_frames:9};
 assert.throws(()=>validateIntent(intent,narration),/VISUAL_SERIES_OPENING_INVALID/u);
});

test('Remotion cover design without opening still cannot disappear silently',()=>{
 const narration='Song Tử vui vẻ.',intent=makeFixture(narration,1);
 intent.publish={cover:{hook:'Câu chuyện',identity:{label:'Song Tử'},visuals:[{entity_id:'gemini',state_id:'neutral'}]}};
 assert.throws(()=>validateIntent(intent,narration),/VISUAL_COVER_DESIGN_UNSUPPORTED/u);
});

test('legacy music/SFX payloads cannot silently become voice-only exports',()=>{
 const narration='Song Tử vui vẻ.',intent=makeFixture(narration,1);
 for(const payload of [{audio:{background_music:'bgm.wav'}},{music:'bgm.wav'},{sfx:[{at:200,path:'sound.wav'}]},{audio_mix:{tracks:[]}}]){
  const clone=structuredClone(intent);Object.assign(clone,payload);
  assert.throws(()=>validateIntent(clone,narration),/VISUAL_AUDIO_MIX_UNSUPPORTED/u);
 }
});

test('unmigrated legacy Remotion cover overlay is explicitly rejected',()=>{
 const narration='Song Tử vui vẻ.',intent=makeFixture(narration,1);
 intent.publish={cover:{opening:{enabled:true,duration_sec:1,transition_sec:.2}}};
 assert.throws(()=>validateIntent(intent,narration),/VISUAL_COVER_OPENING_UNSUPPORTED/u);
});

test('long scene with insufficient acting beats requires explicit creative review',()=>{
 const scene={id:'quiet',entities:[{id:'actor',kind:'character',initial_state:'idle',states:{idle:{asset:'a',visible:true,transform:{x:200,y:400,width:300,height:500}}}}],events:[]};
 const qa=quality(scene,'light',{fps:30,startMs:0,endMs:10000,events:[]});
 assert.equal(qa.status,'PASS');
 assert.equal(qa.human_review,'PENDING');
 assert.ok(qa.review_warnings.some(item=>item.code==='ACTING_BEATS_SPARSE'));
});

test('caption occlusion QA follows the native bottom caption lane',()=>{
 const scene=y=>({entities:[{id:'foreground',states:{shown:{visible:true,layer:1000,transform:{x:200,y,width:200,height:100}}}}]});
 assert.equal(quality(scene(780),'light').status,'PASS');
 assert.equal(quality(scene(300),'light').status,'PASS');
 assert.equal(quality(scene(1600),'light').issues[0].code,'CAPTION_OCCLUSION');
});

test('cutout state swaps never crossfade duplicate limbs in preview or export',async()=>{
 const runtime=await previewRuntime(path.resolve('.'));
 const scene={id:'s01',entities:[{id:'actor',initial_state:'idle',states:{idle:{asset:'a',transform:{x:0,y:0,width:300,height:400}},react:{asset:'a',transform:{x:0,y:0,width:300,height:400}}}}]};
 const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',source_sha256:'a'.repeat(64)}};
 const time={startMs:0,endMs:1000,words:[],events:[{id:'swap',target:'actor',state_before:'idle',state_after:'react',at:.2,preview_motion:'state_swap',preview_duration:.4}]};
 for(const html of [renderPreview(scene,assets,time,'light',runtime.gsap,runtime.font).html,renderEpisode([{scene,time}],assets,'light',30,runtime).html]){
  const played=await play(html);played.seek(.3);
  const visible=[...played.document.querySelectorAll('[data-entity-id]')].filter(el=>el.style.visibility==='visible');
  assert.equal(visible.length,1);assert.equal(visible[0].dataset.stateId,'idle');
  played.seek(.6);assert.equal([...played.document.querySelectorAll('[data-entity-id]')].find(el=>el.style.visibility==='visible').dataset.stateId,'react');
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
 assert.deepEqual(prepared.audio_contract,{mode:'approved-voice-only@1',voice_sha256:manifest.voice_sha256,music_tracks:0,sfx_tracks:0});
 assert.deepEqual(prepared.cover_contract,{mode:'first-encoded-video-frame@1'});
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

test('implicit legacy prop roles use identical metadata during build and HyperFrames export',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hf-legacy-role-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const narration='Song Tử cầm điện thoại rồi mỉm cười.',intent=makeFixture(narration,1),timing=syntheticTiming(narration);
 const phone=intent.scenes[0].entities.find(entity=>entity.id==='phone');
 delete phone.kind;delete phone.visual_role;
 intent.scenes[0].events=[];
 const output=path.join(root,'build');
 const manifest=await buildEpisode({intent,narration,timing,workspace:root,cache:path.join(root,'cache'),output,revision:1,theme:'light'});
 const preview=await readFile(path.join(output,manifest.scenes[0].preview_file),'utf8');
 assert.match(preview,/"visual_role":"interactive_prop"/u);
 const input={build_root:output,manifest_sha256:digest(await readFile(path.join(output,'manifest.json'))),source_sha256:manifest.source_sha256,voice_sha256:manifest.voice_sha256,source_root:path.resolve('.'),output:path.join(root,'export')};
 const result=await prepareExport(input);
 assert.ok(result.composition_sha256);
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

test('the opening title stays hidden when the playhead jumps past it without playing through it (scrubbing)',async()=>{
 const opening={format:'zodiac-series-opening@1',series:'12 CUNG HOÀNG ĐẠO',sign:'Nhân Mã',topic:'Cách Nhân Mã yêu thật lòng',duration_frames:45,transition_frames:9};
 const runtime=await previewRuntime(path.resolve('.'));
 const mk=id=>({id,entities:[{id:'hero',kind:'character',initial_state:'idle',states:{idle:{asset:'actor',transform:{x:260,y:500,width:490,height:700}}}}],events:[]});
 const assets={actor:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',source_sha256:'a'.repeat(64)}};
 const time=(s,e)=>({fps:30,startMs:s,endMs:e,measured:true,words:[{text:'Nhân',startMs:s,endMs:s+250}],events:[]});
 const full=renderEpisode([{scene:mk('s01'),time:time(0,3000)},{scene:mk('s02'),time:time(3000,6000)}],assets,'light',30,runtime,{},opening);
 const played=await play(full.html);
 const overlay=played.document.querySelector('#series-opening');
 played.seek(4.5);                                  // straight into the second scene: the first scene's painter never ran
 assert.equal(overlay.style.opacity,'0');
 played.seek(0);assert.equal(overlay.style.opacity,'1');   // and it comes back when scrubbing to the start
});
