import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {buildEpisode,validateIntent} from '../tools/studio_project/visual_compiler.mjs';
import {describeAssets,findCandidates,safeSvg,confined,digest as sha256} from '../tools/studio_project/visual_candidates.mjs';
import {makeFixture,syntheticTiming} from './studio_p34_fixture.mjs';
import {renderPreview,previewRuntime} from '../tools/studio_project/visual_preview.mjs';
import {resolveEntityState} from '../runtime/zodiac-renderer/2.0.1/renderer/src/spatial-layout.mjs';
import {compileCharacterSvg} from '../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';

const narration=Array.from({length:8},(_,i)=>`Song Tử hỏi thêm câu ${i+1}.`).join('\n');
async function setup(t){const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-p34-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,intent:makeFixture(narration),input:{action:'build',narration,timing:syntheticTiming(narration),workspace:root,cache:path.join(root,'cache'),output:path.join(root,'cold'),revision:1,theme:'light'}};}

test('proposal validation rejects character plans that would fail the real build',async t=>{
 const {intent,input}=await setup(t);
 intent.cast[0].design_intent.decision_reasons.hair_id='short';
 assert.doesNotThrow(()=>validateIntent(intent,narration));
 await assert.rejects(buildEpisode({...input,intent,action:'validate_authoring'}),/CHARACTER_INTENT_CHOICE_REASON_MISSING/);
});

test('source validation rejects grammar-slot names used as visual roles before saving',async t=>{
 const {intent}=await setup(t);intent.scenes[0].entities[0].visual_role='speaker';
 assert.throws(()=>validateIntent(intent,narration),/ROLE_RESOLUTION_INVALID/);
});

test('one verified eight-scene build reuses exact geometry, scene nodes and measured timing',async t=>{
  const {intent,input,root}=await setup(t),original=structuredClone(intent);input.intent=intent;
  const cold=await buildEpisode(input),warm=await buildEpisode({...input,output:path.join(root,'warm')});
  assert.equal(cold.scenes.length,8);assert.equal(cold.cache.rebuilt,18);assert.equal(warm.cache.rebuilt,0);
  assert.equal(Object.keys(cold.assets).length,4);assert.equal(Object.keys(cold.dag).filter(id=>id.startsWith('geometry:character:')).length,1);
  assert.ok(warm.cache.reused>0);assert.deepEqual(intent,original);assert.equal(cold.human_visual_review,'PENDING');assert.equal(cold.approval_granted,false);
  assert.ok(cold.resources.wall_ms>0&&cold.resources.peak_rss_bytes>0&&cold.resources.free_disk_bytes>0);
  for(const scene of cold.scenes)assert.equal(scene.source_map.length,4);
});

test('one-scene edit and theme-only edit reuse unaffected nodes and all source geometry',async t=>{
  const {intent,input,root}=await setup(t);input.intent=intent;const cold=await buildEpisode(input);
  const edited=structuredClone(intent);edited.scenes[2].entities[0].states.neutral.transform.x+=20;
  const scoped=await buildEpisode({...input,intent:edited,output:path.join(root,'scoped'),scene_id:'s03',revision:2});
  assert.deepEqual(scoped.cache.events.filter(e=>!e.hit).map(e=>e.node_id),['scene:s03','appearance:s03']);
  const dark=await buildEpisode({...input,intent:edited,output:path.join(root,'dark'),theme:'dark',revision:3});
  assert.equal(dark.cache.rebuilt,8);assert.ok(dark.cache.events.filter(e=>e.node_id.startsWith('geometry:')).every(e=>e.hit));
  assert.deepEqual(cold.assets,dark.assets);assert.equal(cold.voice_sha256,dark.voice_sha256);assert.equal(cold.timing_sha256,dark.timing_sha256);
  assert.notEqual(cold.scenes[0].preview_sha256,dark.scenes[0].preview_sha256);assert.ok(dark.scenes.every(s=>s.qa.caption_contrast>=4.5));
});

test('tampered object and scene cache rebuild only their dependent outputs',async t=>{
  const {intent,input,root}=await setup(t);input.intent=intent;const cold=await buildEpisode(input);
  const asset=Object.values(cold.assets)[0];await writeFile(path.join(input.cache,'.authoring/cache/objects',asset.sha256),'tampered');
  const recovered=await buildEpisode({...input,output:path.join(root,'recovered')});
  assert.ok(recovered.cache.events.some(e=>e.reason==='MISS_OBJECT_DRIFT'));assert.deepEqual(recovered.assets,cold.assets);
  const sceneNode=recovered.cache.events.find(e=>e.node_id==='scene:s01');assert.ok(sceneNode.hit);
});

test('missing timing, incomplete inventory, invalid state transitions and unsafe source fail closed',async t=>{
  const {intent,input}=await setup(t);input.intent=intent;
  await assert.rejects(buildEpisode({...input,timing:null}),/MEASURED_TIMING_REQUIRED/u);
  const incomplete=structuredClone(intent);incomplete.scenes.pop();assert.throws(()=>validateIntent(incomplete,narration),/NARRATION|VOICE_RANGE/u);
  const bad=structuredClone(intent);bad.scenes[0].events[0].state_before='realizing';assert.throws(()=>validateIntent(bad,narration),/STATE_BEFORE|TRACE/u);
  assert.throws(()=>safeSvg(Buffer.from('<svg><script>alert(1)</script></svg>')),/UNSAFE/u);
  assert.throws(()=>safeSvg(Buffer.from('<svg><image href="https://outside.invalid/a.svg"/></svg>')),/EXTERNAL/u);
  await assert.rejects(confined(input.workspace,'../outside'),/PATH/u);
});

test('phone compatibility distinguishes state from physical model and returns feasible scene bundles',async t=>{
  const {intent}=await setup(t),catalog=await describeAssets();
  const phones=catalog.items.filter(a=>a.identity.family_id==='phone'&&a.identity.compatibility==='V4_ADAPTER');assert.ok(phones.length>=5);
  assert.equal(new Set(phones.map(a=>a.identity.model_id)).size,1);
  const found=await findCandidates(intent,'s01',{family_id:'phone'});assert.equal(found.status,'CANDIDATES');assert.equal(found.bundles.length,3);
  assert.ok(found.bundles.every(b=>b.actors.some(a=>a.entity_id==='gemini')&&b.asset_source_sha256.length===64&&b.fit_reasons.length));
  const absent=await findCandidates(intent,'s01',{family_id:'never-in-this-catalog'});assert.equal(absent.status,'NO_FIT_ASSET');assert.ok(absent.new_asset_task);assert.equal(absent.bundles.length,0);
});

test('real HyperFrames SDK round-trip changes only the selected semantic element styles',async t=>{
  const {intent,input,root}=await setup(t);input.intent=intent;const build=await buildEpisode(input),scene=build.scenes[0];
  const sdkPath=path.resolve('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js'),{openComposition}=await import(pathToFileURL(sdkPath));
  const html=await readFile(path.join(root,'cold',scene.preview_file),'utf8'),composition=await openComposition(html,{overrides:{},history:false});
  t.after(()=>composition.dispose());const target=scene.source_map[0].hf_id,other=scene.source_map[1].hf_id;
  const before=composition.getElement(other).inlineStyles;
  assert.ok(composition.can({type:'setStyle',target,styles:{left:'300px'}}).ok);
  composition.setStyle(target,{left:'300px'});assert.equal(composition.getElement(target).inlineStyles.left,'300px');assert.deepEqual(composition.getElement(other).inlineStyles,before);
  assert.ok(composition.serialize().includes('300px'));assert.equal(intent.scenes[0].entities[0].states.neutral.transform.x,240);
});

test('existing Gemini Visual Intent remains a readable V4 source and retains all actor state identities',async()=>{
  const root=path.resolve('tests/fixtures/phase2-gemini'),intent=JSON.parse(await readFile(path.join(root,'visual-intent.json'),'utf8')),text=await readFile(path.join(root,'narration.txt'),'utf8');
  const out=validateIntent(intent,text);assert.equal(out.production.scenes.length,intent.scenes.length);assert.equal(out.character_assembly.characters.length,2);
  assert.deepEqual(out.character_assembly.characters.map(c=>Object.keys(c.states)),intent.cast.map(c=>Object.keys(c.states)));
});

test('an absent exact measured anchor never falls forward to a different word',async t=>{
  const {input,root}=await setup(t),text='Song Tử hỏi thêm câu này.';
  input.intent=makeFixture(text,1);input.narration=text;input.timing=syntheticTiming(text);
  input.timing.words=input.timing.words.filter(w=>w.text!=='Tử');
  await assert.rejects(buildEpisode({...input,output:path.join(root,'missing-anchor')}),/ANCHOR_UNMEASURED/u);
});

test('frame-owned contacts reject a different physical prop model',async t=>{
  const {intent}=await setup(t);
  intent.scenes[0].environment={frame:{contacts:[{entity:'phone',anchor:'gemini',relation:'near',max_distance_px:850}]}};
  const result=await findCandidates(intent,'s01',{asset_id:'notebook'});
  assert.equal(result.status,'NO_FIT_ASSET');assert.equal(result.bundles.length,0);
  assert.ok(result.rejected.some(r=>r.id==='notebook'&&r.reason==='CONTACT_MODEL_MISMATCH'));
});

async function runPreview(html){
  const sdk=await realpath(path.resolve('apps/zodiac-studio/node_modules/@hyperframes/sdk/dist/index.js'));
  const {parseHTML}=createRequire(sdk)('linkedom'),{document}=parseHTML(html),window={};let at=0,update;
  const timeline={time:()=>at,to:()=>timeline,seek(t){at=t;update();return timeline;},pause:()=>timeline};
  const context={document,window,parent:{postMessage(){}},addEventListener(){},gsap:{timeline(options){update=options.onUpdate;return timeline;}}};
  vm.runInNewContext([...document.querySelectorAll('script')].at(-1).textContent,context);
  return {document,seek:seconds=>timeline.seek(seconds)};
}

test('existing Gemini and Scorpio compiled SVG/state endpoints survive the preview adapter',async()=>{
  const runtime=await previewRuntime(path.resolve('.'));
  for(const [planPath,assetRoot]of [
    ['runtime/zodiac-renderer/2.0.1/renderer/tests/fixtures/songtu/render-plan.json','runtime/zodiac-renderer/2.0.1/renderer/tests/fixtures/songtu'],
    ['tests/fixtures/scorpio-two-versions/expected/render-plan.json','tests/fixtures/scorpio-two-versions/package'],
  ]){
    const plan=JSON.parse(await readFile(planPath,'utf8')),scene=structuredClone(plan.scenes[0]),assets={};
    for(const entity of scene.entities)for(const state of Object.values(entity.states)){
      state.transform={x:0,y:0,width:520,height:520,...state.transform};
      if(!assets[state.asset]){const bytes=await readFile(await confined(path.resolve(assetRoot),plan.assets[state.asset].path));safeSvg(bytes);assets[state.asset]={svg:bytes.toString('utf8'),source_sha256:sha256(bytes)};}
    }
    delete scene.captions; // This test isolates asset/state endpoints; real glyph layout has its own browser parity harness.
    const timing={fps:plan.fps,startMs:0,endMs:scene.duration_frames/plan.fps*1000,words:[],events:scene.events.map(e=>({...e,id:e.event_id,at:e.start_frame/plan.fps,preview_motion:typeof e.motion==='string'?e.motion:'state_swap',preview_duration:(e.end_frame-e.start_frame)/plan.fps}))};
    const preview=renderPreview(scene,assets,timing,'light',runtime.gsap,runtime.font),played=await runPreview(preview.html);
    for(const event of scene.events){played.seek(event.end_frame/plan.fps+.0001);const expected=resolveEntityState(scene,scene.entities.find(e=>e.id===event.target),event.end_frame);
      const visible=[...played.document.querySelectorAll('[data-entity-id]')].find(e=>e.dataset.entityId===event.target&&e.style.visibility==='visible');
      if(expected.visible!==false){assert.ok(visible);assert.equal(visible.dataset.stateId,event.state_after);}
    }
    for(const mapping of preview.source_map)assert.equal(mapping.source_sha256,assets[mapping.asset_id].source_sha256);
  }
});

test('real historical Libra balance SVG and current V4 actor preserve three-state geometry without granting artwork acceptance',async()=>{
  const scene={id:'libra',entities:[{id:'balance',initial_state:'center',states:Object.fromEntries([['center',0],['left',-12],['right',12]].map(([id,rotation])=>[id,{asset:'LEGACY_BALANCE',visible:true,transform:{x:370,y:260,width:340,height:220,rotation}}]))}],events:[
    {id:'tilt-left',target:'balance',state_before:'center',state_after:'left',start_frame:4,end_frame:7},
    {id:'tilt-right',target:'balance',state_before:'left',state_after:'right',start_frame:8,end_frame:11},
    {id:'center',target:'balance',state_before:'right',state_after:'center',start_frame:12,end_frame:15}]};
  const runtime=await previewRuntime(path.resolve('.')),root=path.resolve('tests/fixtures/studio-p34-legacy/libra'),provenance=JSON.parse(await readFile(path.join(root,'provenance.json'),'utf8'));
  for(const asset of provenance.assets){const bytes=await readFile(path.join(root,asset.file));assert.equal(sha256(bytes),asset.sha256);safeSvg(bytes);}
  const svg=await readFile(path.join(root,'balanced.svg'),'utf8'),actor=compileCharacterSvg({entity_id:'libra',body_profile:'standard_compact',hair_id:'short-curl',face_profile_id:'balanced',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'libra',shirt_color_id:'teal',accessory_id:'none',variant_seed:'p34-libra-regression'},{pose_id:'neutral',expression_id:'neutral'});
  assert.ok(actor.svg.includes('zodiac_sign_id=libra'));scene.entities.push({id:'libra',initial_state:'idle',states:{idle:{asset:'LIBRA_ACTOR',visible:true,transform:{x:340,y:610,width:400,height:550}}}});
  const preview=renderPreview(scene,{LEGACY_BALANCE:{svg,source_sha256:sha256(svg)},LIBRA_ACTOR:{svg:actor.svg,source_sha256:sha256(actor.svg)}},{fps:24,startMs:0,endMs:1000,words:[],events:scene.events.map(e=>({...e,at:e.start_frame/24,preview_motion:'state_swap',preview_duration:(e.end_frame-e.start_frame)/24}))},'light',runtime.gsap,runtime.font);
  const played=await runPreview(preview.html);
  for(const event of scene.events){played.seek(event.end_frame/24+.0001);const expected=resolveEntityState(scene,scene.entities[0],event.end_frame),element=[...played.document.querySelectorAll('[data-state-id]')].find(e=>e.dataset.entityId==='balance'&&e.style.visibility==='visible');assert.equal(element.style.transform,`translate(0px, 0px) scale(1) rotate(${expected.transform.rotation}deg)`);assert.equal(played.document.querySelector('[data-entity-id=libra]').style.visibility,'visible');}
});
