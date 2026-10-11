import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {compileProduction} from './compile-scene-direction.mjs';
const character=id=>({id,kind:'character',initial_state:'one',states:{one:{asset:'A',transform:{x:100,y:400,width:200,height:400},layer:20},two:{asset:'A',transform:{x:125,y:400,width:200,height:400},layer:20}}});
test('scene direction resolves authored frame to Job@5 existing geometry and preserves movement',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-frame-v2-'));try{
  await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'assets/f.svg'),'<svg viewBox="0 0 100 180"></svg>');
  const scene={id:'S01',voice:'Bọ Cạp khép cửa.',scene_direction:{shot:'two-person',focus:'lead',subject_placement:'split',interaction_roles:{speaker:'lead',listener:'friend'}},entities:[character('lead'),character('friend'),{id:'door',kind:'object',initial_state:'one',states:{one:{asset:'D',layer:25,transform:{x:390,y:320,width:280,height:540}}}}],events:[],spatial_bindings:[],environment:{frame:{version:'zodiac-environment-frame@1',intent:'locked threshold between two friends',slots:[{entity:'lead',role:'performer',box:{x:120,y:510,width:290,height:410}},{entity:'friend',role:'listener',box:{x:720,y:510,width:290,height:410}},{entity:'door',role:'story_fixture',box:{x:425,y:310,width:260,height:600},layer:15}],contacts:[{entity:'door',anchor:'lead',relation:'near',max_distance_px:900}]}}};
  const production={version:'2.0',assets:{A:{path:'assets/f.svg',category:'character',style_id:'zodiac-paper-doodle-meme-v4'},D:{path:'assets/f.svg',category:'prop',style_id:'zodiac-paper-doodle-meme-v4'}},visual_system:{style_token:{id:'zodiac-paper-doodle-meme-v4'}},scenes:[scene]};
  const {production:output}=await compileProduction(production,{root});const t=output.scenes[0].entities[0].states;
  assert.equal(t.one.transform.x,120);assert.equal(t.two.transform.x,145);assert.equal(output.scenes[0].entities[2].states.one.layer,15);
  assert.equal(output.scenes[0].spatial_bindings.length,1);
  assert.deepEqual((await compileProduction(output,{root})).production,output);
 }finally{await rm(root,{force:true,recursive:true});}
});

test('authored frame remains idempotent across portrait and lying state aspects',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-frame-v2-'));try{
  await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'assets/lying.svg'),'<svg viewBox="0 0 800 300"></svg>');await writeFile(path.join(root,'assets/f.svg'),'<svg viewBox="0 0 100 180"></svg>');
  const scene={id:'S01',voice:'Bọ Cạp khép cửa.',scene_direction:{shot:'two-person',focus:'lead',subject_placement:'split',interaction_roles:{speaker:'lead',listener:'friend'}},entities:[character('lead'),character('friend'),{id:'door',kind:'object',initial_state:'one',states:{one:{asset:'D',layer:25,transform:{x:390,y:320,width:280,height:540}}}}],events:[],spatial_bindings:[],environment:{frame:{version:'zodiac-environment-frame@1',intent:'locked threshold between two friends',slots:[{entity:'lead',role:'performer',box:{x:120,y:510,width:290,height:410}},{entity:'friend',role:'listener',box:{x:720,y:510,width:290,height:410}},{entity:'door',role:'story_fixture',box:{x:425,y:310,width:260,height:600},layer:15}],contacts:[{entity:'door',anchor:'lead',relation:'near',max_distance_px:900}]}}};
  const production={version:'2.0',assets:{A:{path:'assets/f.svg',category:'character',style_id:'zodiac-paper-doodle-meme-v4'},D:{path:'assets/f.svg',category:'prop',style_id:'zodiac-paper-doodle-meme-v4'}},visual_system:{style_token:{id:'zodiac-paper-doodle-meme-v4'}},scenes:[scene]};
  production.assets.B={path:'assets/lying.svg',category:'character',style_id:'zodiac-paper-doodle-meme-v4'};production.scenes[0].entities[0].states.two.asset='B';const {production:output}=await compileProduction(production,{root});const t=output.scenes[0].entities[0].states;
  assert.equal(t.one.transform.x,120);assert.equal(t.two.transform.x,145);assert.equal(output.scenes[0].entities[2].states.one.layer,15);
  assert.equal(output.scenes[0].spatial_bindings.length,1);
  assert.deepEqual((await compileProduction(output,{root})).production,output);
 }finally{await rm(root,{force:true,recursive:true});}
});
