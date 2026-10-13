#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(await readFile(path.join(here,'../manifest.json'),'utf8'));
const fail=m=>{throw new Error('MEME_PROP_COMPILE_INVALID: '+m);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const clone=x=>JSON.parse(JSON.stringify(x));
const confinedPath=(base,file,code)=>{
 if(typeof file!=='string'||!file.trim())fail(code);
 const full=path.resolve(base,file),rel=path.relative(path.resolve(base),full);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail(code);
 return full;
};
export async function compileMemeProps(production,{root='.',writeAssets=true}={}){
 if(production?.version!=='2.0')fail('production.version must be 2.0');
 for(const scene of production.scenes??[])if(scene.entities?.some(e=>e.kind==='effect')||scene.visual_grammar?.meme_composition?.effects?.length)fail('EFFECTS_REMOVED');
 const out=clone(production);out.assets??={};const writes=[];
 for(const scene of out.scenes??[]){
  const requirements=scene.visual_grammar?.meme_composition?.asset_requirements??[];
  for(const req of requirements){
   const target=scene.entities?.find(e=>e.id===req.entity_id);if(!target||target.kind!=='object')fail(`required asset ${req.asset_id} has no bound object ${req.entity_id}`);
   const source=confinedPath(path.resolve(here,'..'),path.resolve(here,req.source_path),'SOURCE_PATH_OUTSIDE_LIBRARY');
   const dest=confinedPath(path.join(root,'assets'),path.resolve(root,req.output_path),'OUTPUT_PATH_OUTSIDE_ASSETS');
   const svg=await readFile(source,'utf8');if(!svg.includes(`style=${catalog.style_token}`)||!svg.includes(`handmade=${catalog.handmade_profile}`))fail(`required asset ${req.asset_id} is not native V4`);
   const assetId=req.asset_id,rel=req.output_path;out.assets[assetId]={path:rel,style_id:catalog.style_token,category:req.category??'prop',lineage:{mode:'semantic_variant',source_library:'zodiac-visual-grammar-v4',source_master:path.basename(source,'.svg'),semantic_intent:`${scene.visual_grammar.meme_composition.id} required prop`}};
   for(const state of Object.values(target.states??{}))state.asset=assetId;
   if(writeAssets)writes.push([dest,svg]);
  }

 }
 for(const [dest,svg] of writes){await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,svg);}
 return out;
}
export function buildMemePropReceipt(production){const props=[];for(const scene of production.scenes??[])for(const req of scene.visual_grammar?.meme_composition?.asset_requirements??[]){const entity=scene.entities?.find(e=>e.id===req.entity_id);props.push({scene_id:scene.id,entity_id:req.entity_id,asset_id:req.asset_id,path:production.assets?.[req.asset_id]?.path,states:Object.fromEntries(Object.entries(entity?.states??{}).map(([id,state])=>[id,state.asset]))});}return {format:'zodiac-meme-prop-compile-receipt@1',props,signature:createHash('sha256').update(JSON.stringify(props)).digest('hex')};}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){if(process.argv.includes('--write')&&!process.argv.includes('--transaction-stage')){const {runGeneratedCompile}=await import('../../../orchestration/generated-asset-ownership.mjs');const result=await runGeneratedCompile(path.dirname(path.resolve(process.argv[2])),fileURLToPath(import.meta.url),process.argv.slice(2),{compiler_id:'meme_props',prune:process.argv.includes('--prune-generated')});process.stdout.write(result.stdout??'');process.exit(0);}const productionPath=process.argv[2];if(!productionPath){console.error('Usage: node compile-meme-props.mjs <production.json> --write');process.exit(2);}const production=JSON.parse(await readFile(productionPath,'utf8')),root=path.dirname(path.resolve(productionPath)),out=await compileMemeProps(production,{root,writeAssets:process.argv.includes('--write')});if(process.argv.includes('--write')){await writeFile(productionPath,JSON.stringify(out,null,2)+'\n');const receipt=buildMemePropReceipt(out);const receiptPath=path.join(root,'.authoring/meme-prop-compile-receipt.json');await mkdir(path.dirname(receiptPath),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log(`MEME_PROP_COMPILE_PASS: props=${receipt.props.length}`);}else console.log(JSON.stringify(out,null,2));}
