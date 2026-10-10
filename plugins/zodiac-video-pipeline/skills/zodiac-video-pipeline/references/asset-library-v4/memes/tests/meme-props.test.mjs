import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {compileVisualGrammar} from '../../compile-visual-grammar.mjs';
import {compileMemeEffects} from '../compile-meme-effects.mjs';
import {validateMemeContacts} from '../validate-meme-contacts.mjs';

test('meme prop requirements cannot write outside assets or read outside the native library',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-path-'));
 try{
  const req={entity_id:'pants',asset_id:'PANTS',source_path:'../props/pants.svg',output_path:'../escaped.svg'};
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[{id:'pants',kind:'object',states:{on:{}}}],visual_grammar:{meme_composition:{id:'equip-this',asset_requirements:[req]}}}]};
  await assert.rejects(()=>compileMemeEffects(production,{root,writeAssets:false}),/OUTPUT_PATH_OUTSIDE_ASSETS/);
  req.output_path='assets/props/pants.svg';req.source_path=path.join(root,'outside.svg');
  await assert.rejects(()=>compileMemeEffects(production,{root,writeAssets:false}),/SOURCE_PATH_OUTSIDE_LIBRARY/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('equip-this materializes pants and keeps all three handoff contacts within tolerance',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-meme-pants-'));
 try{
  const roles={giver:'giver',embarrassed_target:'receiver',pants:'pants'};
  const entities=Object.entries(roles).map(([role,id])=>({id,kind:role==='pants'?'object':'character',initial_state:'meme',states:{meme:{transform:{x:0,y:0,width:1,height:1}}}}));
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'equip-this',bindings:roles}}]};
  const compiled=compileVisualGrammar({version:'2.0',assets:{},scenes:[{id:'S01',entities}]},plan);
  const output=await compileMemeEffects(compiled,{root});
  await writeFile(path.join(root,'production.json'),JSON.stringify(output));
  const scene=output.scenes[0],pants=scene.entities.find(e=>e.id==='pants');
  assert.equal(pants.states.meme.asset,'PROP_OFFERED_PANTS');
  assert.equal((await validateMemeContacts(root)).contacts,3);
  const asset=output.assets.PROP_OFFERED_PANTS;assert.equal(asset.style_id,'zodiac-paper-doodle-meme-v4');
  assert.match(await readFile(path.join(root,asset.path),'utf8'),/handed-from-giver-to-receiver/u);
 }finally{await rm(root,{recursive:true,force:true});}
});
