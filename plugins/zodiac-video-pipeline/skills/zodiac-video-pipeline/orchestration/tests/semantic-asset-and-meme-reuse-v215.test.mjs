import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {compileMemeProps} from '../../references/asset-library-v4/memes/compile-meme-props.mjs';
import {validateSemanticAssetFit} from '../validate-semantic-asset-fit.mjs';

test('story object without semantic fit decision is rejected',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-fit-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'S01',entities:[{id:'phone',kind:'object',states:{visible:{asset:'PHONE'}}}]}]}));
  await writeFile(path.join(root,'.authoring','asset-plan.json'),JSON.stringify({semantic_asset_fit:{format:'zodiac-semantic-asset-plan@1',decisions:[]}}));
  await assert.rejects(validateSemanticAssetFit(root),/ASSET_SEMANTIC_FIT_MISSING/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('identical meme effect across scenes shares one SVG',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-effect-'));
 try{
  const scene=id=>({id,visual_grammar:{meme_composition:{effects:[{id:'offer-swish',entity_id:'effect',box:[120,120,100,100],layer:19,locus:'contact'}]}},entities:[]});
  await assert.rejects(()=>compileMemeProps({version:'2.0',scenes:[scene('S01'),scene('S02')]},{root}),/EFFECTS_REMOVED/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('multi-object scene requires separate semantic decisions for each story asset',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'zodiac-fit-multi-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  await writeFile(path.join(root,'production.json'),JSON.stringify({scenes:[{id:'S01',entities:[
   {id:'phone',kind:'object',states:{visible:{asset:'PHONE'}}},
   {id:'notebook',kind:'object',states:{visible:{asset:'NOTE'}}}
  ]}]}));
  await writeFile(path.join(root,'.authoring','asset-plan.json'),JSON.stringify({semantic_asset_fit:{
   format:'zodiac-semantic-asset-plan@1',
   decisions:[{scene_id:'S01',asset_id:'PHONE',role:'primary_story',semantic_need:'message',semantic_tags:['message'],fit_score:1,resolution:'reuse',selected_master:'notification-card'}]
  }}));
  await assert.rejects(validateSemanticAssetFit(root),/ASSET_SEMANTIC_FIT_MISSING.*notebook/);
 }finally{await rm(root,{recursive:true,force:true});}
});
