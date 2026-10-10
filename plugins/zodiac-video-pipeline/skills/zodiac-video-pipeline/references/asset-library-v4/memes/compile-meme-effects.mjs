#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(await readFile(path.join(here,'../effects/meme-effect-catalog.json'),'utf8'));
const fail=m=>{throw new Error('MEME_EFFECT_COMPILE_INVALID: '+m);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const clone=x=>JSON.parse(JSON.stringify(x));
const confinedPath=(base,file,code)=>{
 if(typeof file!=='string'||!file.trim())fail(code);
 const full=path.resolve(base,file),rel=path.relative(path.resolve(base),full);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail(code);
 return full;
};
function svgFor(id,aspect=1){
 const effect=catalog.effects[id];if(!effect)fail(`unknown effect primitive ${id}`);
 if(!Array.isArray(effect.paths)||effect.paths.length<2)fail(`${id} needs at least two authored paths`);
 for(const p of effect.paths){if(typeof p.d!=='string'||!/[QqCcSsTt]/u.test(p.d))fail(`${id} has a non-handmade path`);if(!catalog.palette.includes(p.stroke)||p.fill&&!catalog.palette.includes(p.fill))fail(`${id} has a noncanonical color`);if(!(p.width>=4&&p.width<=9))fail(`${id} has invalid stroke width`);}
 const body=effect.paths.map(p=>`<path d="${esc(p.d)}" fill="${p.fill??'none'}" stroke="${p.stroke}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const ratio=Math.max(0.5,Math.min(2,aspect));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${100*ratio} 100"><metadata>asset_role=meme-effect;id=${id};style=${catalog.style_token};handmade=${catalog.handmade_profile};production_safe=true</metadata><g id="effect_${id}" transform="scale(${ratio} 1)">${body}</g></svg>`;
}
export async function compileMemeEffects(production,{root='.',writeAssets=true}={}){
 if(production?.version!=='2.0')fail('production.version must be 2.0');
 const out=clone(production);out.assets??={};const emittedEffects=new Set();
 for(const scene of out.scenes??[]){
  const requirements=scene.visual_grammar?.meme_composition?.asset_requirements??[];
  for(const req of requirements){
   const target=scene.entities?.find(e=>e.id===req.entity_id);if(!target||target.kind!=='object')fail(`required asset ${req.asset_id} has no bound object ${req.entity_id}`);
   const source=confinedPath(path.resolve(here,'..'),path.resolve(here,req.source_path),'SOURCE_PATH_OUTSIDE_LIBRARY');
   const dest=confinedPath(path.join(root,'assets'),path.resolve(root,req.output_path),'OUTPUT_PATH_OUTSIDE_ASSETS');
   const svg=await readFile(source,'utf8');if(!svg.includes(`style=${catalog.style_token}`)||!svg.includes(`handmade=${catalog.handmade_profile}`))fail(`required asset ${req.asset_id} is not native V4`);
   const assetId=req.asset_id,rel=req.output_path;out.assets[assetId]={path:rel,style_id:catalog.style_token,category:req.category??'prop',lineage:{mode:'semantic_variant',source_library:'zodiac-visual-grammar-v4',source_master:path.basename(source,'.svg'),semantic_intent:`${scene.visual_grammar.meme_composition.id} required prop`}};
   for(const state of Object.values(target.states??{}))state.asset=assetId;
   if(writeAssets){await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,svg);}
  }
  const specs=scene.visual_grammar?.meme_composition?.effects??[];
  const generated=new Set(specs.map(x=>x.entity_id));
  scene.entities=(scene.entities??[]).filter(e=>!generated.has(e.id));
  for(const spec of specs){
   const svg=svgFor(spec.id,spec.box[2]/spec.box[3]);const contentHash=createHash('sha256').update(svg).digest('hex').slice(0,16);const assetId=`FX_ASSET_${contentHash.toUpperCase()}`,rel=`assets/effects/${contentHash}.svg`;
   out.assets[assetId]={path:rel,style_id:catalog.style_token,category:'effect',lineage:{mode:'semantic_variant',source_library:'zodiac-visual-grammar-v4',source_master:spec.id,semantic_intent:spec.locus}};
   const [cx,cy,width,height]=spec.box;
   scene.entities.push({id:spec.entity_id,kind:'effect',initial_state:'effect',states:{effect:{asset:assetId,transform:{x:cx-width/2,y:cy-height/2,width,height},layer:spec.layer}},metadata:{effect_id:spec.id,locus:spec.locus}});
   if(writeAssets&&!emittedEffects.has(rel)){const abs=path.resolve(root,rel);await mkdir(path.dirname(abs),{recursive:true});await writeFile(abs,svg+'\n');emittedEffects.add(rel);}
  }
 }
 return out;
}
export function buildMemeEffectReceipt(production){const rows=[];for(const scene of production.scenes??[]){const selected=new Set((scene.visual_grammar?.meme_composition?.effects??[]).map(spec=>spec.entity_id));for(const entity of scene.entities??[])if(entity.kind==='effect'&&selected.has(entity.id))rows.push({scene_id:scene.id,entity_id:entity.id,effect_id:entity.metadata?.effect_id,asset:entity.states?.effect?.asset,transform:entity.states?.effect?.transform,layer:entity.states?.effect?.layer,locus:entity.metadata?.locus});}return {format:'zodiac-meme-effect-compile-receipt@1',effects:rows,signature:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const productionPath=process.argv[2];if(!productionPath){console.error('Usage: node compile-meme-effects.mjs <production.json> --write');process.exit(2);}const production=JSON.parse(await readFile(productionPath,'utf8')),root=path.dirname(path.resolve(productionPath)),out=await compileMemeEffects(production,{root,writeAssets:process.argv.includes('--write')});if(process.argv.includes('--write')){await writeFile(productionPath,JSON.stringify(out,null,2)+'\n');const receipt=buildMemeEffectReceipt(out);const receiptPath=path.join(root,'.authoring/meme-effect-compile-receipt.json');await mkdir(path.dirname(receiptPath),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log(`MEME_EFFECT_COMPILE_PASS: effects=${receipt.effects.length}`);}else console.log(JSON.stringify(out,null,2));}
