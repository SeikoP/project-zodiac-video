import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMemeProps,buildMemePropReceipt} from '../../references/asset-library-v4/memes/compile-meme-props.mjs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runGeneratedCompile} from '../generated-asset-ownership.mjs';
test('prop compiler rejects effects and receipts describe actual prop bindings',async()=>{
 const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[],visual_grammar:{meme_composition:{effects:[]}}}]};
 assert.deepEqual(await compileMemeProps(production,{writeAssets:false}),production);
 assert.deepEqual(buildMemePropReceipt(production).props,[]);
 production.scenes[0].entities.push({id:'spark',kind:'effect'});
 await assert.rejects(()=>compileMemeProps(production,{writeAssets:false}),/EFFECTS_REMOVED/);
});
test('native prop transaction writes bound SVG, prop receipt and ownership',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-prop-test-'));
 try{
  const production={version:'2.0',assets:{},scenes:[{id:'S01',entities:[{id:'phone',kind:'object',states:{idle:{asset:null}}}],visual_grammar:{meme_composition:{id:'test',effects:[],asset_requirements:[{entity_id:'phone',asset_id:'PHONE',source_path:'../props/phone.svg',output_path:'assets/phone.svg'}]}}}]};
  const file=path.join(root,'production.json');await writeFile(file,JSON.stringify(production));
  await runGeneratedCompile(root,fileURLToPath(new URL('../../references/asset-library-v4/memes/compile-meme-props.mjs',import.meta.url)),[file,'--write'],{compiler_id:'meme_props'});
  const out=JSON.parse(await readFile(file));assert.equal(out.scenes[0].entities[0].states.idle.asset,'PHONE');
  assert.match(await readFile(path.join(root,'assets/phone.svg'),'utf8'),/zodiac-paper-doodle-meme-v4/);
  const receipt=JSON.parse(await readFile(path.join(root,'.authoring/meme-prop-compile-receipt.json')));assert.equal(receipt.props[0].asset_id,'PHONE');assert.equal(receipt.props[0].states.idle,'PHONE');
  const ownership=JSON.parse(await readFile(path.join(root,'.authoring/generated-assets.json')));assert.equal(ownership.entries[0].compiler_id,'meme_props');
 }finally{await rm(root,{recursive:true,force:true});}
});
