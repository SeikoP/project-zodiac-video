import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {compileCharacterSvg} from '../../characters/compile-character-assembly.mjs';
import {compileProduction} from '../../scene-direction/compile-scene-direction.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

test('character compiler supports meme facepalm crop without changing identity',()=>{
  const identity={entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'series-a|hero'};
  const meme=compileCharacterSvg(identity,{pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'});
  const neutral=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  assert.match(meme.svg,/viewBox="45 65 430 520"/u);
  assert.match(meme.svg,/crop_id=face-closeup/u);
  assert.notEqual(meme.svg,neutral.svg);
  assert.equal(meme.identity_signature,neutral.identity_signature);
});

test('cry expression compiles two eye-rooted tears into native v4 character art',()=>{
  const identity={entity_id:'hero',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'series-a|hero'};
  const crying=compileCharacterSvg(identity,{pose_id:'cry-hug',expression_id:'cry',crop_id:'face-closeup'});
  const neutral=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  const tears=crying.svg.match(/<g id="face_tears">([\s\S]*?)<\/g>/u)?.[1]??'';
  assert.equal((tears.match(/<path\b/gu)??[]).length,2);
  assert.match(tears,/M192 288/u);
  assert.match(tears,/M317 288/u);
  assert.match(crying.svg,/viewBox="45 65 430 520"/u);
  assert.doesNotMatch(neutral.svg,/face_tears/u);
});

test('all registered meme poses compile for every body profile with visible hands',async()=>{
  const catalog=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(here,'../../characters/components/catalog.json'),'utf8'));
  const ids=['facepalm','cry-hug','offer-pants','recoil','inspect-prop','flex-prop'];
  for(const poseId of ids){
    assert.ok(catalog.poses.some(x=>x.id===poseId),`catalog missing ${poseId}`);
    for(const body of catalog.body_profiles){
      const result=compileCharacterSvg({entity_id:'hero',body_profile:body.id,hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'a'},
        {pose_id:poseId,expression_id:poseId==='cry-hug'?'cry':'neutral'});
      for(const arm of ['left_arm','right_arm']){
        const group=result.svg.match(new RegExp(`<g id="${arm}">([\\s\\S]*?)<\\/g>`,'u'))?.[1]??'';
        assert.match(group,/fill="#F1C6A0"/u,`${body.id}/${poseId}/${arm} missing visible hand`);
      }
    }
  }
});

test('Scene Direction uses registered meme role boxes instead of generic shot positions',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-layout-'));
  try{
    await mkdir(path.join(root,'assets'),{recursive:true});
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 720"></svg>';
    for(const name of ['evidence','target','receipt'])await writeFile(path.join(root,'assets',`${name}.svg`),svg);
    const production={version:'2.0',assets:{},scenes:[{id:'S01',scene_direction:{shot:'two-person',focus:'evidence',subject_placement:'split',interaction_roles:{speaker:'evidence',listener:'target',shared_prop:'receipt'},meme_layout:{composition_id:'receipt-in-face',entities:{evidence:[305,750,430,780],target:[785,780,420,730],receipt:[550,640,230,330]}}},entities:['evidence','target','receipt'].map(id=>({id,kind:id==='receipt'?'object':'character',initial_state:'meme',states:{meme:{asset:id.toUpperCase(),transform:{x:0,y:0,width:10,height:10},layer:1,visible:true}}}))}]};
    for(const id of ['evidence','target','receipt'])production.assets[id.toUpperCase()]={path:`assets/${id}.svg`};
    const compiled=await compileProduction(production,{root});
    assert.deepEqual(compiled.production.scenes[0].entities[0].states.meme.transform,{x:90,y:452,width:430,height:595});
    assert.deepEqual(compiled.production.scenes[0].entities[1].states.meme.transform,{x:575,y:489,width:420,height:582});
    assert.equal(compiled.receipt.scenes[0].roles[0].transform.x,90);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('single-character meme layouts also place their prop and optional target roles',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-layout-'));
  try{
    await mkdir(path.join(root,'assets'),{recursive:true});
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 720"></svg>';
    for(const name of ['giver','target','prop'])await writeFile(path.join(root,'assets',`${name}.svg`),svg);
    const ids=['giver','target','prop'];
    const production={version:'2.0',assets:Object.fromEntries(ids.map(id=>[id.toUpperCase(),{path:`assets/${id}.svg`}])),scenes:[{id:'S01',scene_direction:{shot:'medium-character',focus:'giver',subject_placement:'center',meme_layout:{composition_id:'absurd-offer',entities:{giver:[390,760,500,780],target:[820,770,390,700],prop:[590,530,300,310]}}},visual_grammar:{meme_composition:{roles:{giver:{entity_id:'giver'},target:{entity_id:'target'},prop:{entity_id:'prop'}}}},entities:ids.map(id=>({id,kind:id==='prop'?'object':'character',initial_state:'meme',states:{meme:{asset:id.toUpperCase(),transform:{x:0,y:0,width:10,height:10},layer:1,visible:true}}}))}]};
    const compiled=await compileProduction(production,{root});
    const scene=compiled.production.scenes[0],receipt=compiled.receipt.scenes[0];
    assert.equal(receipt.roles.length,3);
    assert.ok(receipt.roles.some(x=>x.role==='prop'&&x.entity_id==='prop'));
    assert.notDeepEqual(scene.entities.find(x=>x.id==='prop').states.meme.transform,{x:0,y:0,width:10,height:10});
    assert.deepEqual(scene.entities.find(x=>x.id==='target').states.meme.transform,{x:625,y:500,width:390,height:540});
  }finally{await rm(root,{recursive:true,force:true});}
});
