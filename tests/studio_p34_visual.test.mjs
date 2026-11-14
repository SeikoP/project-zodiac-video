import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {buildEpisode,validateIntent} from '../tools/studio_project/visual_compiler.mjs';
import {describeAssets,findCandidates,safeSvg,confined} from '../tools/studio_project/visual_candidates.mjs';
import {makeFixture,syntheticTiming} from './studio_p34_fixture.mjs';

const narration=Array.from({length:8},(_,i)=>`Song Tử hỏi thêm câu ${i+1}.`).join('\n');
async function setup(t){const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-p34-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,intent:makeFixture(narration),input:{action:'build',narration,timing:syntheticTiming(narration),workspace:root,cache:path.join(root,'cache'),output:path.join(root,'cold'),revision:1,theme:'light'}};}

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
  const phones=catalog.items.filter(a=>a.identity.family_id==='phone');assert.ok(phones.length>=5);
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
