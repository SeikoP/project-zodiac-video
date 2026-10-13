import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCharacterSvg,identitySignature,planCharacterStateAssets,compileCharacterAssembly} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {validateCharacterAssembly} from '../../references/asset-library-v4/validation/validate-character-assembly.mjs';
import {mkdtemp,mkdir,writeFile,rm,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {runGeneratedCompile} from '../../core/ownership/generated-asset-ownership.mjs';
import {compileSceneSetWorkspace} from '../../references/asset-library-v4/scene-set/compile-scene-set.mjs';
import {sceneSetComponentIntents} from '../../features/visual-composition/compile-visual-intent.mjs';
import {validateFreshAssetSelection} from '../../features/visual-composition/validate-fresh-asset-selection.mjs';
import {preflightHandoff} from '../../phases/phase03/handoff-preflight.mjs';
const identity={entity_id:'gemini',body_profile:'lean_tall',hair_id:'long-side-part',face_profile_id:'balanced',accessory_id:'none',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'gemini',shirt_color_id:'teal'};
test('compiler staging never copies or republishes parent process leases',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-lease-staging-')),script=path.join(root,'probe.mjs');
 try{
  await mkdir(path.join(root,'.authoring'));await writeFile(path.join(root,'production.json'),JSON.stringify({version:'2.0',assets:{},scenes:[]}));
  const lease=path.join(root,'.authoring/.phase02-native.lock');await writeFile(lease,'parent-owned');
  await writeFile(script,"import {readdir} from 'node:fs/promises';import path from 'node:path';const rows=await readdir(path.join(process.argv[2],'.authoring'));if(rows.some(x=>x.endsWith('.lock')))throw Error('PROCESS_LEASE_COPIED');");
  for(let i=0;i<2;i++)await runGeneratedCompile(root,script,[root],{compiler_id:'meme_props'});
  assert.equal(await readFile(lease,'utf8'),'parent-owned');await assert.rejects(()=>access(path.join(root,'.authoring/native-compile.lock')),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('plain-shirt identity keeps the existing hash for unchanged baked assets',()=>{
 const plain={...identity,outfit_id:'plain-shirt',zodiac_sign_id:undefined};
 const expected=createHash('sha256').update([plain.entity_id,plain.body_profile,plain.hair_id,'balanced',plain.outfit_id,plain.shirt_color_id,'none',''].join('|')).digest('hex').slice(0,16);
 assert.equal(identitySignature(plain),expected);
});
test('handoff density checks co-visible states instead of all props declared in a continuous scene',()=>{
 const state=(asset,visible)=>({asset,visible});
 const entities=['a','b','c'].map(id=>({id,kind:'character',initial_state:'on',states:{on:state('A',true)}}));
 entities.push({id:'thought',kind:'object',initial_state:'on',states:{on:state('P',true),off:state('P',false)}},{id:'chair',kind:'object',initial_state:'off',states:{on:state('P',true),off:state('P',false)}});
 const events=[{id:'hide',target:'thought',state_before:'on',state_after:'off'},{id:'show',target:'chair',state_before:'off',state_after:'on'}];
 const p={assets:{A:{category:'character'},P:{category:'prop'}},scenes:[{id:'s',entities,events}]};
 assert.equal(preflightHandoff(p).status,'PASS');
 p.scenes[0].events=[events[1],events[0]];assert.ok(preflightHandoff(p).issues.some(x=>x.code==='THREE_ACTOR_DENSITY'));
});
test('fresh policy keeps the intrinsic sign icon while rejecting removed character decorations',()=>{
 const input={intent:{scenes:[]},production:{assets:{A:{category:'character',character_blueprint:{...identity}}}},policy:{retired_asset_ids:[],retired_hair_ids:[],extensions:[]}};
 assert.equal(validateFreshAssetSelection(input).status,'PASS');
 input.production.assets.A.character_blueprint.outfit_id='decorated-zodiac-shirt';assert.throws(()=>validateFreshAssetSelection(input),/REMOVED_CHARACTER_FEATURE/);
 input.production.assets.A.character_blueprint.outfit_id='zodiac-glyph-shirt';input.production.assets.A.character_blueprint.zodiac_sign_id='unknown';assert.throws(()=>validateFreshAssetSelection(input),/ZODIAC_SIGN/);
});
test('feminine tall lead has an intrinsic Gemini glyph without surrounding decoration',()=>{
 const svg=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'}).svg;
 assert.match(svg,/hair_id=long-side-part/);assert.match(svg,/body_profile=lean_tall/);assert.match(svg,/id="shirt_zodiac_glyph"/);assert.match(svg,/zodiac_sign_id=gemini/);assert.doesNotMatch(svg,/shirt_(?:rays|sparkles|halo|decoration)/);
});
test('shirt sign participates in identity hashing and unknown signs fail closed',()=>{
 assert.notEqual(identitySignature(identity),identitySignature({...identity,zodiac_sign_id:'libra'}));
 assert.throws(()=>compileCharacterSvg({...identity,zodiac_sign_id:'not-a-sign'},{pose_id:'neutral',expression_id:'neutral'}),/unknown zodiac sign/);
});
test('baked zodiac identity survives native assembly validation and rejects blueprint sign drift',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-shirt-identity-'));
 try{
  const spec={...identity,states:{idle:{pose_id:'neutral',expression_id:'neutral'}}},plan={format:'zodiac-character-assembly-plan@1',characters:[spec]};
  const production={version:'2.0',assets:{},scenes:[{id:'s',entities:[{id:'gemini',kind:'character',initial_state:'idle',states:{idle:{asset:'PENDING',visible:true,layer:20,transform:{x:200,y:500,width:520,height:760}}}}]}]};
  const statePlan=planCharacterStateAssets(production,plan),out=await compileCharacterAssembly(production,plan,{root,writeAssets:true,stateAssetPlan:statePlan});
  await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'production.json'),JSON.stringify(out));await writeFile(path.join(root,'.authoring/character-assembly-plan.json'),JSON.stringify(plan));await writeFile(path.join(root,'.authoring/character-state-asset-plan.json'),JSON.stringify(statePlan));
  await validateCharacterAssembly(root);
  Object.values(out.assets)[0].character_blueprint.zodiac_sign_id='libra';await writeFile(path.join(root,'production.json'),JSON.stringify(out));await assert.rejects(()=>validateCharacterAssembly(root),/CHARACTER_IDENTITY_DRIFT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('plain-shirt stays undecorated and all twelve glyphs compile natively',()=>{
 assert.doesNotMatch(compileCharacterSvg({...identity,outfit_id:'plain-shirt',zodiac_sign_id:undefined},{pose_id:'neutral',expression_id:'neutral'}).svg,/id="shirt_zodiac_glyph"/);
 for(const zodiac_sign_id of ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'])assert.match(compileCharacterSvg({...identity,zodiac_sign_id},{pose_id:'explain',expression_id:'smug'}).svg,/id="shirt_zodiac_glyph"/);
});
const request={id:'scene-accent-sign',initial_state:'hidden',states:{hidden:{visible:false},visible:{visible:true}}};
test('scene accents carry voice-controlled visibility states through native compilation',async()=>{
 const p={version:'2.0',assets:{},scenes:[{id:'s',entities:[],environment:{scene_set_id:'scene-set-cafe',scene_accents:[request]}}]};
 const a=await compileSceneSetWorkspace('.',{production:p,write:false});const e=a.production.scenes[0].entities.find(e=>e.scene_asset_role==='scene_accent');
 assert.equal(e.initial_state,'hidden');assert.equal(e.states.hidden.visible,false);assert.equal(e.states.visible.visible,true);assert.equal(e.states.hidden.asset,e.states.visible.asset);
 assert.deepEqual((await compileSceneSetWorkspace('.',{production:a.production,write:false})).production,a.production);
 const c=sceneSetComponentIntents(p.scenes[0].environment,'Một chuyện.')[1];assert.equal(c.initial_state,'hidden');assert.deepEqual(Object.keys(c.states),['hidden','visible']);
});
test('accent lifecycle rejects missing initial state and malformed visibility',async()=>{
 const p={version:'2.0',assets:{},scenes:[{id:'s',entities:[],environment:{scene_set_id:'scene-set-cafe',scene_accents:[{...request,initial_state:'unknown'}]}}]};
 await assert.rejects(()=>compileSceneSetWorkspace('.',{production:p,write:false}),/ACCENT_STATE/);
 p.scenes[0].environment.scene_accents[0]={...request,states:{hidden:{visible:'no'}}};await assert.rejects(()=>compileSceneSetWorkspace('.',{production:p,write:false}),/ACCENT_STATE/);
});
