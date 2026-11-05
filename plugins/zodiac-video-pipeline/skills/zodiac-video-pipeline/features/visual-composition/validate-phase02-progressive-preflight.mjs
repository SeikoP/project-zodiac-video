#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const text=v=>typeof v==='string'&&v.trim().length>0;
const authored=a=>['authored','authored_derivative','derive_new'].includes(a?.lineage?.mode)||a?.ownership?.kind==='authored';
const metadata=(svg,key)=>{const body=/<metadata[^>]*>([\\s\\S]*?)<\\/metadata>/iu.exec(svg)?.[1]??'';for(const part of body.split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===key)return part.slice(i+1).trim();}return null;};
const nums=(svg,re)=>[...svg.matchAll(re)].map(m=>Number(m[1])).filter(Number.isFinite);
const colors=svg=>[...svg.matchAll(/(?:fill|stroke)=["'](#[0-9a-f]{6})["']/giu)].map(m=>m[1].toUpperCase());

export async function validateProgressivePreflight({intent,production,motionRegistry={},designToken={},readAsset}={}){
 const issues=[],add=(code,detail={})=>issues.push({code,...detail});
 for(const scene of intent?.scenes??[]){
  for(const beat of scene.director_beats??[]){
   if(!text(beat.beat_id)||!text(beat.voice_anchor)||!text(beat.semantic_purpose)||(!text(beat.supported_motion_or_state)&&!text(beat.static_reason)))add('DIRECTOR_BEAT_INCOMPLETE',{scene_id:scene.id,beat_id:beat.beat_id??null});
  }
 }
 const registry=motionRegistry.motions??{};
 for(const scene of production?.scenes??[])for(const event of scene.events??[]){
  const motion=event.motion;if(!motion?.preset)continue;const spec=registry[motion.preset];if(!spec)continue;
  const expected=spec.default_duration_frames;
  if(Number.isFinite(expected)&&motion.duration_override!==true&&motion.duration_frames!==expected)add('MOTION_DURATION_MISMATCH',{scene_id:scene.id,event_id:event.id,preset:motion.preset,expected,actual:motion.duration_frames});
 }
 if(typeof readAsset==='function'){
  const range=designToken.stroke_width_range??designToken.handmade_stroke_width_range??[4,9];
  const allowed=new Set((designToken.colors??designToken.palette??[]).map(x=>String(x).toUpperCase()));
  for(const [assetId,asset] of Object.entries(intent?.assets??{})){
   if(!authored(asset)||!asset.path?.toLowerCase().endsWith('.svg'))continue;
   let svg;try{svg=await readAsset(asset.path);}catch{add('AUTHORED_SVG_READ',{asset_id:assetId,path:asset.path});continue;}
   const style=metadata(svg,'style'),handmade=metadata(svg,'handmade');
   if(style!==designToken.id||handmade!==(designToken.handmade_profile??'human-stroke-v2'))add('AUTHORED_SVG_STYLE_METADATA',{asset_id:assetId,style,handmade});
   const widths=nums(svg,/stroke-width=["']([0-9.]+)["']/giu);
   if(widths.some(w=>w<range[0]||w>range[1]))add('AUTHORED_SVG_STROKE_WIDTH',{asset_id:assetId,widths,allowed:range});
   if(allowed.size){
    const invalid=[...new Set(colors(svg).filter(c=>!allowed.has(c)))];
    if(invalid.length)add('AUTHORED_SVG_PALETTE',{asset_id:assetId,colors:invalid});
   }
  }
 }
 return {format:'zodiac-phase02-progressive-preflight@1',status:issues.length?'BLOCKED':'PASS',issues,not_an_approval:true};
}

async function workspace(root){
 const [intent,production,motionRegistry,design]=await Promise.all([
  readFile(path.join(root,'.authoring/visual-intent.json'),'utf8').then(JSON.parse),
  readFile(path.join(root,'production.json'),'utf8').then(JSON.parse),
  readFile(new URL('../../contracts/motion-registry-v1.json',import.meta.url),'utf8').then(JSON.parse),
  readFile(path.join(root,'design.md'),'utf8')
 ]);
 let designToken={id:'zodiac-paper-doodle-meme-v4',handmade_profile:'human-stroke-v2',stroke_width_range:[4,9]};
 try{
  const {designToken:parse}=await import('./phase02-composition.mjs');const t=parse(design);
  designToken={...designToken,...t,colors:[...new Set(JSON.stringify(t).match(/#[0-9A-Fa-f]{6}/g)??[])]};
 }catch{}
 return validateProgressivePreflight({intent,production,motionRegistry,designToken,readAsset:p=>readFile(path.join(root,p),'utf8')});
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-phase02-progressive-preflight.mjs <workspace>');process.exit(2);}try{const r=await workspace(path.resolve(root));console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
