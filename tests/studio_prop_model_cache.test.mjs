// Visual V5 spec test 7: a model-only or state-only prop edit invalidates exactly the nodes downstream of it, never voice,
// timing or the other scenes; an unchanged warm build reuses everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildEpisode} from '../tools/studio_project/visual_compiler.mjs';
import {makeFixture,syntheticTiming} from './studio_p34_fixture.mjs';

const narration=Array.from({length:8},(_,i)=>`Song Tử hỏi thêm câu ${i+1}.`).join('\n');
async function setup(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-propcache-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const intent=makeFixture(narration);
  const input={action:'build',narration,timing:syntheticTiming(narration),workspace:root,cache:path.join(root,'cache'),
    output:path.join(root,'cold'),revision:1,theme:'light',intent};
  return {root,intent,input};
}
const swap=(intent,sceneId,key,libraryPath)=>{
  const edited=structuredClone(intent);
  edited.assets[key]={path:'library:'+libraryPath,category:'prop'};
  const scene=edited.scenes.find(s=>s.id===sceneId);
  scene.entities.find(e=>e.id==='phone').states.idle.asset=key;
  return edited;
};
const misses=build=>build.cache.events.filter(e=>!e.hit).map(e=>e.node_id).sort();

test('swapping one scene to another physical phone model rebuilds that scene only',async t=>{
  const {root,intent,input}=await setup(t);
  const cold=await buildEpisode(input);
  const edited=swap(intent,'s03','phone-rounded','props/phone-rounded.svg');
  const next=await buildEpisode({...input,intent:edited,output:path.join(root,'model'),revision:2});
  assert.deepEqual(misses(next),['appearance:s03','geometry:asset:phone-rounded','scene:s03']);
  assert.equal(next.voice_sha256,cold.voice_sha256);
  assert.equal(next.timing_sha256,cold.timing_sha256);
  for(const scene of next.scenes.filter(s=>s.id!=='s03'))
    assert.equal(scene.preview_sha256,cold.scenes.find(s=>s.id===scene.id).preview_sha256,scene.id+' must be byte-identical');
  assert.notEqual(next.scenes.find(s=>s.id==='s03').preview_sha256,cold.scenes.find(s=>s.id==='s03').preview_sha256);
});

test('a state-only change of the same phone model rebuilds that scene only',async t=>{
  const {root,intent,input}=await setup(t);
  await buildEpisode(input);
  const edited=swap(intent,'s05','phone-ping','props/phone-ping.svg');
  const next=await buildEpisode({...input,intent:edited,output:path.join(root,'state'),revision:2});
  assert.deepEqual(misses(next),['appearance:s05','geometry:asset:phone-ping','scene:s05']);
});

test('an unchanged warm build reuses every node',async t=>{
  const {root,input}=await setup(t);
  await buildEpisode(input);
  const warm=await buildEpisode({...input,output:path.join(root,'warm')});
  assert.equal(warm.cache.rebuilt,0);
});
