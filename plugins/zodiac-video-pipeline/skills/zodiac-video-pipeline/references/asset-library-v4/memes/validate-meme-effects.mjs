#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMemeEffectReceipt} from './compile-meme-effects.mjs';
import {validateHumanStroke} from '../validation/validate-human-stroke.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const registry=JSON.parse(await readFile(path.join(here,'index.json'),'utf8'));
const fail=m=>{throw new Error('MEME_EFFECT_INVALID: '+m);};
export async function validateMemeEffects(packageRoot){
 const root=path.resolve(packageRoot),production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
 const expected=new Map(registry.compositions.map(x=>[x.id,x.effect?.id]));let checked=0;
 for(const scene of production.scenes??[]){const meme=scene.visual_grammar?.meme_composition;if(!meme)continue;const expectedId=expected.get(meme.id);if(!expectedId)fail(`${scene.id} unknown meme ${meme.id}`);const specs=meme.effects??[];if(specs.length!==1||specs[0].id!==expectedId)fail(`${scene.id}/${meme.id} effect registry mapping is missing or drifted`);
  for(const spec of specs){const entity=scene.entities?.find(e=>e.id===spec.entity_id);if(!entity||entity.kind!=='effect')fail(`${scene.id}/${spec.id} effect entity is missing`);const asset=production.assets?.[entity.states?.effect?.asset];if(asset?.category!=='effect'||asset.style_id!=='zodiac-paper-doodle-meme-v4'||!asset.path)fail(`${scene.id}/${spec.id} asset is not native V4`);const svg=await readFile(path.resolve(root,asset.path),'utf8');if(!svg.includes(`id=${spec.id}`)||!svg.includes('handmade=human-stroke-v2'))fail(`${scene.id}/${spec.id} SVG metadata does not match adapter`);try{validateHumanStroke(svg,'support');}catch(e){fail(`${scene.id}/${spec.id}: ${e.message}`);}checked++;}
 }
 const receipt=JSON.parse(await readFile(path.join(root,'.authoring/meme-effect-compile-receipt.json'),'utf8')),expectedReceipt=buildMemeEffectReceipt(production);if(receipt.format!==expectedReceipt.format||receipt.signature!==expectedReceipt.signature||receipt.effects?.length!==checked)fail('compile receipt does not exactly cover every selected meme effect');
 let actual=0;for(const scene of production.scenes??[])if(scene.visual_grammar?.meme_composition)actual+=(scene.entities??[]).filter(e=>e.kind==='effect').length;if(actual!==checked)fail('orphan or duplicate effect entity exists without an adapter effect');
 return {effects:checked};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-meme-effects.mjs <package-root>');process.exit(2);}const result=await validateMemeEffects(root);console.log(`MEME_EFFECT_PASS: effects=${result.effects}`);}
