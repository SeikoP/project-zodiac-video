import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileVisualGrammar} from '../../compile-visual-grammar.mjs';
import {planCharacterStateAssets,compileCharacterAssembly} from '../../characters/compile-character-assembly.mjs';
import {validateCharacterAssembly} from '../../validation/validate-character-assembly.mjs';

function fixture(){
 const production={version:'2.0',assets:{},scenes:[{id:'S01',voice:'Bọ Cạp bảo đã quên. Nhưng vẫn nhớ từng chữ.',entities:[{id:'hero',kind:'character',initial_state:'setup',states:{setup:{visible:true},punchline:{visible:true}}}],events:[{id:'reveal',target:'hero',state_before:'setup',state_after:'punchline',trigger:{type:'voice_anchor',text:'vẫn nhớ từng chữ'},motion:{preset:'state_swap',duration_frames:8}}]}]};
 const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'facepalm-closeup',bindings:{actor:'hero'},state_bindings:{actor:'punchline'}}}]};
 const cast={format:'zodiac-character-assembly-plan@1',characters:[{entity_id:'hero',body_profile:'lean_tall',hair_id:'long-side-part',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'scorpio',shirt_color_id:'teal',states:{setup:{pose_id:'neutral',expression_id:'neutral',crop_id:'face-closeup'},punchline:{pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'}}}]};
 return {production,plan,cast};
}

test('meme acting targets an anchored punchline state while setup stays neutral',()=>{
 const {production,plan,cast}=fixture(),out=compileVisualGrammar(production,plan);
 assert.equal(out.scenes[0].visual_grammar.meme_composition.acting_requirements.hero.state_id,'punchline');
 const assets=planCharacterStateAssets(out,cast);assert.equal(assets.characters[0].unique_asset_count,2);
 assert.deepEqual(assets.characters[0].groups.map(g=>g.pose_id),['neutral','facepalm']);
 const wrong=structuredClone(cast);wrong.characters[0].states.punchline.pose_id='neutral';
 assert.throws(()=>planCharacterStateAssets(out,wrong),/meme acting requires pose_id=facepalm/);
});

test('state-specific native meme assets pass independent identity and acting validation',async()=>{
 const {production,plan,cast}=fixture(),out=compileVisualGrammar(production,plan),root=await mkdtemp(path.join(os.tmpdir(),'z-meme-state-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  const planned=planCharacterStateAssets(out,cast),built=await compileCharacterAssembly(out,cast,{root,writeAssets:true,stateAssetPlan:planned});
  await writeFile(path.join(root,'production.json'),JSON.stringify(built));
  await writeFile(path.join(root,'.authoring/character-assembly-plan.json'),JSON.stringify(cast));
  await writeFile(path.join(root,'.authoring/character-state-asset-plan.json'),JSON.stringify(planned));
  assert.deepEqual(await validateCharacterAssembly(root),{characters:1,states:2});
  const states=Object.values(built.assets).filter(a=>a.character_blueprint).map(a=>a.character_blueprint);
  assert.equal(new Set(states.map(a=>a.identity_signature)).size,1);
  assert.ok(states.every(a=>a.zodiac_sign_id==='scorpio'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('legacy meme requests still require initial-state acting',()=>{
 const {production,plan,cast}=fixture();delete plan.scenes[0].meme_composition.state_bindings;
 const out=compileVisualGrammar(production,plan);
 assert.equal(out.scenes[0].visual_grammar.meme_composition.acting_requirements.hero.state_id,undefined);
 assert.throws(()=>planCharacterStateAssets(out,cast),/meme acting requires/);
});

for(const [name,change] of [
 ['unknown role',({plan})=>{plan.scenes[0].meme_composition.state_bindings={stranger:'punchline'};}],
 ['missing state',({plan})=>{plan.scenes[0].meme_composition.state_bindings.actor='absent';}],
 ['hidden state',({production})=>{production.scenes[0].entities[0].states.punchline.visible=false;}],
 ['unreachable state',({production})=>{production.scenes[0].events=[];}],
 ['unanchored reveal',({production})=>{production.scenes[0].events[0].trigger={type:'scene_start'};}],
 ['anchor outside narration',({production})=>{production.scenes[0].events[0].trigger.text='not spoken';}],
 ['broken state chain',({production})=>{production.scenes[0].events[0].state_before='punchline';}],
 ['non-object bindings',({plan})=>{plan.scenes[0].meme_composition.state_bindings=[];}]
])test('meme state binding rejects '+name,()=>{const f=fixture();change(f);assert.throws(()=>compileVisualGrammar(f.production,f.plan),/VISUAL_GRAMMAR_COMPILE_INVALID|TRACE_STATE_BEFORE/);});
