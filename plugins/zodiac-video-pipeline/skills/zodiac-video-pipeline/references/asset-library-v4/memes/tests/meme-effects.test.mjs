import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {compileMemeEffects,buildMemeEffectReceipt} from '../compile-meme-effects.mjs';
import {compileVisualGrammar} from '../../compile-visual-grammar.mjs';
import {validateHumanStroke} from '../../validation/validate-human-stroke.mjs';
import {validateMemeEffects} from '../validate-meme-effects.mjs';
import {finalizeMemeEffectReceipt} from '../finalize-meme-effect-receipt.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const memeRegistry=JSON.parse(await readFile(path.join(here,'../index.json'),'utf8'));

const baseProduction=(effectId='question-accent')=>({version:'2.0',assets:{},scenes:[{id:'S01',entities:[],visual_grammar:{meme_composition:{id:'side-eye-object',effects:[{id:effectId,entity_id:'FX_S01_01',box:[740,500,140,170],layer:70,locus:'near the prop'}]}}}]});

test('canonical effect CLI inspects without writes and emits a receipt in write mode',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-cli-'));
 try{
  const input=path.join(root,'production.json'),source=JSON.stringify(baseProduction());
  await writeFile(input,source);
  const cli=fileURLToPath(new URL('../compile-meme-effects.mjs',import.meta.url));
  const inspect=spawnSync(process.execPath,[cli,input],{encoding:'utf8'});
  assert.equal(inspect.status,0,inspect.stderr);
  const out=JSON.parse(inspect.stdout),asset=Object.values(out.assets)[0];
  await assert.rejects(readFile(path.join(root,asset.path)),{code:'ENOENT'});
  assert.equal(await readFile(input,'utf8'),source);
  const written=spawnSync(process.execPath,[cli,input,'--write'],{encoding:'utf8'});
  assert.equal(written.status,0,written.stderr);
  const receipt=JSON.parse(await readFile(path.join(root,'.authoring/meme-effect-compile-receipt.json'),'utf8'));
  assert.equal(receipt.signature,buildMemeEffectReceipt(JSON.parse(await readFile(input,'utf8'))).signature);
  await readFile(path.join(root,asset.path));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('effect compiler emits a bounded V4 SVG entity for an adapter effect',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-effects-'));try{const output=await compileMemeEffects(baseProduction(),{root});const scene=output.scenes[0],entity=scene.entities.find(x=>x.id==='FX_S01_01');assert.ok(entity);assert.equal(entity.kind,'effect');assert.deepEqual(entity.states.effect.transform,{x:670,y:415,width:140,height:170});const asset=output.assets[entity.states.effect.asset];assert.equal(asset.style_id,'zodiac-paper-doodle-meme-v4');assert.equal(asset.category,'effect');const svg=await readFile(path.join(root,asset.path),'utf8');assert.match(svg,/style=zodiac-paper-doodle-meme-v4/u);assert.match(svg,/handmade=human-stroke-v2/u);assert.match(svg,/<path\b/u);assert.doesNotMatch(svg,/<text\b|<filter\b|<circle\b|<rect\b/iu);}finally{await rm(root,{recursive:true,force:true});}});
test('effect compiler rejects an unknown primitive instead of silently dropping it',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-effects-'));try{await assert.rejects(()=>compileMemeEffects(baseProduction('not-a-primitive'),{root}),/MEME_EFFECT_COMPILE_INVALID.*unknown/u);}finally{await rm(root,{recursive:true,force:true});}});
test('all eleven adapter effects compile to human-stroke-v2 assets',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-effects-all-'));try{const scenes=memeRegistry.compositions.map((composition,i)=>{const bindings={},entities=[];for(const [role,contract] of Object.entries(composition.roles)){if(!contract.required)continue;const id=`${composition.id}-${role}`;bindings[role]=id;entities.push({id,kind:contract.kind,initial_state:'meme',states:{meme:{}}});}return {scene:{id:`S${String(i+1).padStart(2,'0')}`,entities},plan:{scene_id:`S${String(i+1).padStart(2,'0')}`,meme_composition:{id:composition.id,bindings}}};});const compiled=compileVisualGrammar({version:'2.0',assets:{},scenes:scenes.map(x=>x.scene)},{format:'zodiac-visual-grammar-plan@1',scenes:scenes.map(x=>x.plan)});const output=await compileMemeEffects(compiled,{root});let count=0;for(const scene of output.scenes){const effect=scene.entities.find(e=>e.kind==='effect');assert.ok(effect,scene.id);const asset=output.assets[effect.states.effect.asset],svg=await readFile(path.join(root,asset.path),'utf8');validateHumanStroke(svg,'support');count++;}assert.equal(count,11);output.scenes[0].entities.find(e=>e.kind==='effect').states.effect.transform.x+=7;await writeFile(path.join(root,'production.json'),JSON.stringify(output));await finalizeMemeEffectReceipt(root);assert.equal((await validateMemeEffects(root)).effects,11);}finally{await rm(root,{recursive:true,force:true});}});

// Regression: a topic-banter reaction effect belongs to scene semantics, not a meme adapter.
test('non-meme topic banter effects do not pollute meme compile receipts',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-nonmeme-effects-'));try{const production={version:'2.0',assets:{},scenes:[{id:'S01',visual_grammar:{frame_id:'reaction-closeup'},entities:[{id:'reaction',kind:'effect',initial_state:'hidden',states:{hidden:{visible:false},shown:{visible:true}}}]}]};await writeFile(path.join(root,'production.json'),JSON.stringify(production));await finalizeMemeEffectReceipt(root);const receipt=buildMemeEffectReceipt(production);assert.equal(receipt.effects.length,0);assert.equal((await validateMemeEffects(root)).effects,0);}finally{await rm(root,{recursive:true,force:true});}});
