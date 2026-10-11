import test from 'node:test';import assert from 'node:assert/strict';import {compositionHash} from '../phase02-composition.mjs';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {designToken} from '../phase02-composition.mjs';
test('composition CLI resolves authored intent without a circular top-level await',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-composition-cli-'));
 try{
  const f=fixture(),design=await readFile(new URL('../../references/design.md',import.meta.url),'utf8');
  f.token=designToken(design);f.plan.design_token_sha256=compositionHash(f.token);f.plan.composition_stage='intent';
  const {resolveSceneComposition}=await import('../resolve-scene-composition.mjs');
  const resolved=await resolveSceneComposition(f.production,f.plan,f.token);assert.equal(resolved.status,'PASS');
  await mkdir(path.join(root,'.authoring'));
  for(const [rel,data]of Object.entries({'production.json':f.production,'.authoring/scene-art-direction.json':f.plan,'.authoring/scene-composition-resolved.json':resolved}))await writeFile(path.join(root,rel),JSON.stringify(data));
  await writeFile(path.join(root,'design.md'),design);
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('../phase02-composition.mjs',import.meta.url)),root],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'PASS');
  f.production.scenes[0].entities[0].states.idle.transform.x++;
  await writeFile(path.join(root,'production.json'),JSON.stringify(f.production));
  const stale=spawnSync(process.execPath,[fileURLToPath(new URL('../phase02-composition.mjs',import.meta.url)),root],{encoding:'utf8'});
  assert.equal(stale.status,1);assert.equal(JSON.parse(stale.stdout).status,'BLOCKED');
 }finally{await rm(root,{recursive:true,force:true});}
});
const fixture=()=>{const token={id:'test'},entity={id:'hero',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:{asset:'H',visible:true,layer:20,transform:{x:100,y:200,width:300,height:400}}}},scene={id:'s',voice:'Cậu nhìn qua cửa.',entities:[entity],occlusion_relations:[],spatial_bindings:[],layout_contract:{canvas:{width:1080,height:1920}}},plan={design_token_sha256:compositionHash(token),scenes:[{id:'s',voice:scene.voice,components:[{id:'hero',reason:'performer',voice_anchor:'Cậu',visual_role:'character',initial_state:'idle',ownership:{kind:'authored'},states:structuredClone(entity.states)}],occlusion_relations:[],spatial_bindings:[],layout_contract:scene.layout_contract}]};return {production:{assets:{H:{path:'assets/hero.svg'}},scenes:[scene]},plan,token};};
test('intent permits registered compiler component before materialization, never authored missing',async()=>{const m=await import('../resolve-scene-composition.mjs'),f=fixture();f.production.scenes[0].environment={profile:'classroom-study',modifier:'clean'};f.plan.scenes[0].components.push({id:'env__classroom-window',reason:'room cue',voice_anchor:'cửa',visual_role:'background',ownership:{kind:'compiler',locator:'environment:classroom-window'}});assert.equal((await m.validateCompositionIntent(f.production,f.plan,f.token)).status,'PASS');f.plan.scenes[0].components[1].ownership.locator='environment:unknown';assert.equal((await m.validateCompositionIntent(f.production,f.plan,f.token)).status,'BLOCKED');f.plan.scenes[0].components[1].ownership={kind:'authored'};assert.equal((await m.validateCompositionIntent(f.production,f.plan,f.token)).status,'BLOCKED');});
test('resolved report accepts compiler layout without rewriting intent, rejects unexpected output and stale source',async()=>{const m=await import('../resolve-scene-composition.mjs'),f=fixture(),original=structuredClone(f.plan);f.production.scenes[0].entities[0].states.idle.transform.x=200;const resolved=await m.resolveSceneComposition(f.production,f.plan,f.token);assert.equal(resolved.status,'PASS');assert.deepEqual(f.plan,original);assert.equal((await m.validateResolvedComposition(f.production,f.plan,f.token,resolved)).status,'PASS');f.production.scenes[0].entities[0].states.idle.transform.x=201;assert.equal((await m.validateResolvedComposition(f.production,f.plan,f.token,resolved)).status,'BLOCKED');f.production.scenes[0].entities.push({...structuredClone(f.production.scenes[0].entities[0]),id:'unexpected'});assert.equal((await m.resolveSceneComposition(f.production,f.plan,f.token)).status,'BLOCKED');});
test('resolved geometry never silently changes authored visibility or layer intent',async()=>{const m=await import('../resolve-scene-composition.mjs');for(const field of ['visible','layer']){const f=fixture();f.production.scenes[0].entities[0].states.idle[field]=field==='visible'?false:25;assert.equal((await m.resolveSceneComposition(f.production,f.plan,f.token)).status,'BLOCKED',field);}});
