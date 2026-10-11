import assert from 'node:assert/strict';
import {access,mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.join(root,'components/catalog.json');
const compilerPath=path.join(root,'compile-character-assembly.mjs');

test('native v4 catalog spans body hair outfit expression and pose dimensions',async()=>{
  const c=JSON.parse(await readFile(catalogPath,'utf8'));
  assert.equal(c.format,'zodiac-character-components@1');
  assert.ok(c.body_profiles.length>=6);
  assert.ok(c.hair.length>=10);
  assert.equal(c.outfits.filter(x=>x.kind==='zodiac').length,12);
  assert.ok(c.outfits.filter(x=>x.kind==='generic').length>=5);
  assert.ok(c.expressions.length>=6);
  assert.ok(c.poses.length>=8);
  assert.equal(c.policy.render_time_randomness,false);
  assert.equal(c.policy.identity_fields.join('|'),'body_profile|hair_id|face_profile_id|outfit_id|shirt_color_id|accessory_id');
  assert.ok(c.face_profiles.length>=4);
  assert.ok(c.poses.some(x=>x.id==='write')&&c.poses.some(x=>x.id==='read'));
  assert.equal(c.policy.state_fields.join('|'),'pose_id|expression_id|crop_id');
});

test('assembly is deterministic and state changes preserve identity',async()=>{
  const {compileCharacterSvg,identitySignature}=await import(pathToFileURL(compilerPath).href);
  const identity={entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'series-a|hero'};
  const a=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  const b=compileCharacterSvg(identity,{pose_id:'reach',expression_id:'side-eye'});
  const a2=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  assert.equal(a.svg,a2.svg);
  assert.equal(identitySignature(identity),identitySignature(identity));
  assert.notEqual(a.svg,b.svg);
  for(const token of ['style=zodiac-paper-doodle-meme-v4','handmade=human-stroke-v2','id="hair_back"','id="outfit_decoration"']) assert.match(a.svg,new RegExp(token));
  assert.equal(a.identity_signature,b.identity_signature);
  assert.equal(a.body_source_master,'lean-tall');
});

test('semantic states with identical character geometry reuse one baked SVG asset',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const entity={id:'hero',kind:'character',initial_state:'neutral',states:{neutral:{},settled:{}}};
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[entity]}]};
  const state={pose_id:'neutral',expression_id:'neutral'};
  const plan={format:'zodiac-character-assembly-plan@1',characters:[{
    entity_id:'hero',body_profile:'standard_compact',hair_id:'asym-bang',
    outfit_id:'generic-soft-stripes',variant_seed:'same-person',
    states:{neutral:{...state},settled:{...state}}
  }]};
  const out=await compileCharacterAssembly(production,plan);
  const states=out.scenes[0].entities[0].states;
  assert.equal(states.neutral.asset,states.settled.asset);
  assert.equal(Object.keys(out.assets).length,1);
});

test('explicit state asset budget is checked before any character SVG is written',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const root=await mkdtemp(path.join(os.tmpdir(),'character-state-budget-'));
  const states={base:{},explain:{},reach:{},offer:{}};
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[{id:'hero',kind:'character',initial_state:'base',states}]}]};
  const plan={format:'zodiac-character-assembly-plan@1',characters:[{
    entity_id:'hero',body_profile:'standard_compact',hair_id:'asym-bang',outfit_id:'generic-soft-stripes',
    asset_budget:{max_unique_states:3},states:{base:{pose_id:'neutral',expression_id:'neutral'},explain:{pose_id:'explain',expression_id:'neutral'},reach:{pose_id:'reach',expression_id:'neutral'},offer:{pose_id:'offer',expression_id:'neutral'}}
  }]};
  try{
    await assert.rejects(()=>compileCharacterAssembly(production,plan,{root,writeAssets:true}),/has 4 unique character assets; budget is 3/u);
    await assert.rejects(()=>access(path.join(root,'assets','characters')));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('authored state budget permits the declared count without a forced exception story',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const states={base:{},explain:{},reach:{},offer:{}};
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[{id:'hero',kind:'character',initial_state:'base',states}]}]};
  const character={entity_id:'hero',body_profile:'standard_compact',hair_id:'asym-bang',outfit_id:'generic-soft-stripes',states:{base:{pose_id:'neutral',expression_id:'neutral'},explain:{pose_id:'explain',expression_id:'neutral'},reach:{pose_id:'reach',expression_id:'neutral'},offer:{pose_id:'offer',expression_id:'neutral'}}};
  await compileCharacterAssembly(production,{format:'zodiac-character-assembly-plan@1',characters:[{...character,asset_budget:{max_unique_states:4}}]});
  const out=await compileCharacterAssembly(production,{format:'zodiac-character-assembly-plan@1',characters:[{...character,asset_budget:{max_unique_states:4,exception_reason:'Four distinct actions are required for the plot payoff.'}}]});
  assert.equal(Object.keys(out.assets).length,4);
});

test('visible characters get deterministic distinct shirt colors that stay fixed across states',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const root=await mkdtemp(path.join(os.tmpdir(),'shirt-colors-'));
  const entity=(id)=>({id,kind:'character',initial_state:'neutral',states:{neutral:{},reach:{}}});
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[entity('scorpio'),entity('friend')]}]};
  const states={neutral:{pose_id:'neutral',expression_id:'neutral'},reach:{pose_id:'reach',expression_id:'neutral'}};
  const plan={format:'zodiac-character-assembly-plan@1',characters:[
    {entity_id:'scorpio',body_profile:'standard_compact',hair_id:'clean-bun',outfit_id:'scorpio-basic-clean',variant_seed:'series-a|scorpio',states},
    {entity_id:'friend',body_profile:'lean_tall',hair_id:'soft-wave',outfit_id:'generic-soft-stripes',variant_seed:'series-a|friend',states}
  ]};
  const out=await compileCharacterAssembly(production,plan,{root,writeAssets:true});
  const shirtFill=svg=>svg.match(/<g id="torso">[\s\S]*?fill="(#[0-9A-Fa-f]{6})"/u)?.[1];
  const readAsset=async name=>readFile(path.join(root,'assets/characters',name),'utf8');
  const scorpioNeutral=await readAsset('scorpio-neutral.svg');
  const scorpioReach=await readAsset('scorpio-reach.svg');
  const friendNeutral=await readAsset('friend-neutral.svg');
  assert.notEqual(out.assets.CHAR_SCORPIO_NEUTRAL.character_blueprint.shirt_color_id,undefined);
  assert.notEqual(out.assets.CHAR_SCORPIO_NEUTRAL.character_blueprint.shirt_color_id,out.assets.CHAR_FRIEND_NEUTRAL.character_blueprint.shirt_color_id);
  assert.equal(out.assets.CHAR_SCORPIO_NEUTRAL.character_blueprint.shirt_color_id,out.assets.CHAR_SCORPIO_REACH.character_blueprint.shirt_color_id);
  assert.equal(shirtFill(scorpioNeutral),shirtFill(scorpioReach));
  assert.notEqual(shirtFill(scorpioNeutral),shirtFill(friendNeutral));
  await rm(root,{recursive:true,force:true});
});

test('body profiles produce authored silhouette differences rather than scale-only metadata',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  const base={entity_id:'x',hair_id:'soft-wave',outfit_id:'generic-soft-stripes',variant_seed:'s|x'};
  const lean=compileCharacterSvg({...base,body_profile:'lean_tall'},{pose_id:'neutral',expression_id:'neutral'}).svg;
  const round=compileCharacterSvg({...base,body_profile:'round_soft'},{pose_id:'neutral',expression_id:'neutral'}).svg;
  const torso=s=>s.match(/<g id="torso">([\s\S]*?)<\/g>/u)?.[1];
  assert.notEqual(torso(lean),torso(round));
  assert.doesNotMatch(lean,/scale\(/u);assert.doesNotMatch(round,/scale\(/u);
});

test('unsupported component ids fail closed',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  assert.throws(()=>compileCharacterSvg({entity_id:'x',body_profile:'lean_tall',hair_id:'does-not-exist',outfit_id:'gemini-basic-clean',variant_seed:'x'},{pose_id:'neutral',expression_id:'neutral'}),/CHARACTER_ASSEMBLY_INVALID.*hair/u);
  assert.throws(()=>compileCharacterSvg({entity_id:'x',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'x'},{pose_id:'teleport',expression_id:'neutral'}),/CHARACTER_ASSEMBLY_INVALID.*pose/u);
});

test('all 17 native outfit ids have distinct core geometry, not accent-only aliases',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  const cores=[];
  for(const outfit of catalog.outfits){
    const svg=compileCharacterSvg({entity_id:'hero',body_profile:'standard_compact',hair_id:'clean-bun',outfit_id:outfit.id,variant_seed:'same-seed'},{pose_id:'neutral',expression_id:'neutral'}).svg;
    const group=svg.match(/<g id="outfit_decoration">([\s\S]*?)<\/g>/u)?.[1]??'';
    const core=group.match(/<path d="([^"]+)"/u)?.[1]??'';
    cores.push([outfit.id,core]);
  }
  assert.equal(new Set(cores.map(x=>x[1])).size,cores.length,JSON.stringify(cores));
});

test('compiler rejects asset-id collisions after sanitizing different entity ids',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const production={version:'2.0',assets:{},scenes:[{id:'S',entities:[
    {id:'hero-a',kind:'character',initial_state:'n',states:{n:{}}},
    {id:'hero_a',kind:'character',initial_state:'n',states:{n:{}}}
  ]}]};
  const mk=id=>({entity_id:id,body_profile:'standard_compact',hair_id:'clean-bun',outfit_id:'generic-soft-stripes',states:{n:{pose_id:'neutral',expression_id:'neutral'}}});
  const plan={format:'zodiac-character-assembly-plan@1',characters:[mk('hero-a'),mk('hero_a')]};
  await assert.rejects(()=>compileCharacterAssembly(production,plan),/CHARACTER_ASSEMBLY_INVALID.*collision/i);
});

test('meme acting requirements must be present in the assembled initial state',async()=>{
  const {compileCharacterAssembly}=await import(pathToFileURL(compilerPath).href);
  const production={version:'2.0',assets:{},scenes:[{id:'S01',visual_grammar:{meme_composition:{acting_requirements:{hero:{pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'}}}},entities:[{id:'hero',kind:'character',initial_state:'reaction',states:{reaction:{}}}]}]};
  const character={entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',states:{reaction:{pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'}}};
  const result=await compileCharacterAssembly(production,{format:'zodiac-character-assembly-plan@1',characters:[character]});
  assert.equal(result.assets.CHAR_HERO_REACTION.character_blueprint.crop_id,'face-closeup');
  await assert.rejects(()=>compileCharacterAssembly(production,{format:'zodiac-character-assembly-plan@1',characters:[{...character,states:{reaction:{pose_id:'neutral',expression_id:'neutral'}}}]}),/meme acting requires pose_id=facepalm/u);
});

test('every pose emits visible curved hand contours for prop/contact readability',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  for(const pose of catalog.poses){
    const svg=compileCharacterSvg({entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'x'},{pose_id:pose.id,expression_id:'neutral'}).svg;
    for(const groupId of ['left_arm','right_arm']){
      const g=svg.match(new RegExp(`<g id="${groupId}">([\\s\\S]*?)<\\/g>`,'u'))?.[1]??'';
      assert.ok((g.match(/<path\b/gu)||[]).length>=2,`${pose.id}/${groupId} needs limb + hand contour`);
      assert.match(g,/fill="#F1C6A0"/u,`${pose.id}/${groupId} needs visible hand fill`);
    }
  }
});

test('prop_slot is a hidden pose-aware anchor instead of a fixed visible marker',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  const id={entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'x'};
  const neutral=compileCharacterSvg(id,{pose_id:'neutral',expression_id:'neutral'}).svg;
  const reach=compileCharacterSvg(id,{pose_id:'reach',expression_id:'neutral'}).svg;
  const slot=s=>s.match(/<g id="prop_slot">([\s\S]*?)<\/g>/u)?.[1]??'';
  assert.notEqual(slot(neutral),slot(reach));
  assert.match(slot(neutral),/opacity="0"/u);
  assert.match(slot(reach),/opacity="0"/u);
});

test('all body-profile × pose hand contours stay inside the 520x720 character viewBox',async()=>{
  const {compileCharacterSvg}=await import(pathToFileURL(compilerPath).href);
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  for(const body of catalog.body_profiles)for(const pose of catalog.poses){
    const svg=compileCharacterSvg({entity_id:'hero',body_profile:body.id,hair_id:'side-part',outfit_id:'generic-soft-stripes',variant_seed:'x'},{pose_id:pose.id,expression_id:'neutral'}).svg;
    for(const groupId of ['left_arm','right_arm']){
      const g=svg.match(new RegExp(`<g id="${groupId}">([\\s\\S]*?)<\\/g>`,'u'))?.[1]??'';
      const hand=[...g.matchAll(/<path d="([^"]+)" fill="#F1C6A0"/gu)][0]?.[1]??'';
      const nums=[...hand.matchAll(/-?\d+(?:\.\d+)?/gu)].map(x=>Number(x[0]));
      const xs=nums.filter((_,i)=>i%2===0),ys=nums.filter((_,i)=>i%2===1);
      assert.ok(xs.every(x=>x>=0&&x<=520),`${body.id}/${pose.id}/${groupId} hand x out of bounds: ${hand}`);
      assert.ok(ys.every(y=>y>=0&&y<=720),`${body.id}/${pose.id}/${groupId} hand y out of bounds: ${hand}`);
    }
  }
});
