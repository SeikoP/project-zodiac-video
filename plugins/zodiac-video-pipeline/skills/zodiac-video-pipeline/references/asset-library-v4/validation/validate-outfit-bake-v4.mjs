#!/usr/bin/env node
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveShirtColorAssignments} from '../characters/compile-character-assembly.mjs';
const fail=m=>{throw new Error('OUTFIT_BAKE_V4_INVALID: '+m);};
const exists=p=>access(p).then(()=>true).catch(()=>false);
const here=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(await readFile(path.resolve(here,'../characters/components/catalog.json'),'utf8'));
const shirtColorById=new Map((catalog.shirt_colors??[]).map(x=>[x.id,x]));
const root=process.argv[2];
if(!root){console.error('Usage: node validate-outfit-bake-v4.mjs <package-root>');process.exit(2);}
const prod=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
const planPath=path.join(root,'.authoring','character-assembly-plan.json');
if(!(await exists(planPath)))fail('missing character assembly plan');
const plan=JSON.parse(await readFile(planPath,'utf8'));
const byId=new Map((plan.characters??[]).map(x=>[x.entity_id,x]));
const expectedShirtColors=resolveShirtColorAssignments(prod,plan);
const outfitAsset=async(a,label)=>{
 if(!a?.character_blueprint)fail(label+' missing character_blueprint');
 const file=path.resolve(root,a.path??'');if(!(await exists(file)))fail(label+' missing SVG');
 const svg=await readFile(file,'utf8');
 const group=svg.match(/<g id="outfit_decoration">([\s\S]*?)<\/g>/u)?.[1];if(!group)fail(label+' missing outfit_decoration group');
 const fill=svg.match(/<g id="torso">[\s\S]*?<path\b[^>]*\bfill="([^"]+)"/u)?.[1];if(!fill)fail(label+' missing torso shirt fill');
 return {group,fill};
};
let checked=0;
for(const scene of prod.scenes??[]){
 const visibleOutfits=new Map(),visibleColors=new Map();
 const visibleCharacters=new Set((scene.entities??[]).filter(e=>e.kind==='character'&&Object.values(e.states??{}).some(state=>state?.visible!==false)).map(e=>e.id));
 for(const e of scene.entities??[]){
  if(e.kind!=='character')continue;
  const spec=byId.get(e.id);if(!spec)fail('missing plan for '+e.id);
  const expectedColorId=expectedShirtColors.get(e.id),expectedColor=shirtColorById.get(expectedColorId);if(!expectedColor)fail(e.id+' has invalid shirt_color_id');
  let signature=null,initialSignature=null,initialColor=null;
  for(const [sid,state] of Object.entries(e.states??{})){
   const a=prod.assets?.[state.asset];if(!a?.character_blueprint)fail(`${e.id}/${sid} missing character_blueprint`);
   if(a.character_blueprint.outfit_id!==spec.outfit_id)fail(`${e.id}/${sid} outfit drift`);
   if(a.character_blueprint.shirt_color_id!==expectedColorId||a.character_blueprint.shirt_color!==expectedColor.hex)fail(`${e.id}/${sid} shirt color identity drift`);
   const {group,fill}=await outfitAsset(a,`${e.id}/${sid}`);
   if(fill.toUpperCase()!==expectedColor.hex.toUpperCase())fail(`${e.id}/${sid} shirt SVG fill does not match ${expectedColorId}`);
   if(signature===null)signature=group;else if(signature!==group)fail(`${e.id} outfit geometry changed across states`);
   if(sid===e.initial_state&&state.visible!==false){initialSignature=group;initialColor=expectedColorId;}
   checked++;
  }
  if(initialSignature!==null){
   const prior=visibleOutfits.get(initialSignature);if(prior&&prior!==e.id)fail(`duplicate visible outfit geometry in ${scene.id}: ${prior} and ${e.id}`);visibleOutfits.set(initialSignature,e.id);
   if(visibleCharacters.size<=shirtColorById.size){const priorColor=visibleColors.get(initialColor);if(priorColor&&priorColor!==e.id)fail(`duplicate visible shirt color in ${scene.id}: ${priorColor} and ${e.id}`);visibleColors.set(initialColor,e.id);}
  }
 }
}
console.log(`OUTFIT_BAKE_V4_PASS: states=${checked}`);
