#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const registry=JSON.parse(await readFile(path.join(here,'index.json'),'utf8'));
const fail=m=>{throw new Error('MEME_CONTACT_INVALID: '+m);};
const scenePoint=(role,point,box,viewBox)=>{const [cx,cy,w,h]=box,[vw,vh]=viewBox;return [cx-w/2+point[0]/vw*w,cy-h/2+point[1]/vh*h];};
export async function validateMemeContacts(packageRoot=null,compositionId='equip-this'){
 const c=registry.compositions.find(x=>x.id===compositionId);if(!c)fail(`unknown composition ${compositionId}`);
 if(compositionId!=='equip-this')return {composition:compositionId,contacts:0};
 if(c.roles.giver?.slot!=='speaker'||!c.roles.giver.required||c.roles.embarrassed_target?.slot!=='listener'||!c.roles.embarrassed_target.required||c.roles.pants?.slot!=='shared_prop')fail('equip-this must bind a giver, a required receiving person, and pants');
 if(c.required_contacts.some(x=>x.includes('head_zone'))||!c.required_contacts.includes('pants→target.handoff_zone'))fail('equip-this contact intent must end at the receiver handoff zone, never the face');
 const limit=c.contact_geometry?.max_distance_px??0,view=c.contact_geometry?.view_boxes??{},contacts=c.contact_geometry?.contacts??[];
 if(!limit||contacts.length<3)fail('equip-this needs authored waistband and receiver contact anchors');
 for(const contact of contacts){const a=contact.from,b=contact.to,pa=scenePoint(a.role,a.point,c.layout[a.role],view[a.role]),pb=scenePoint(b.role,b.point,c.layout[b.role],view[b.role]),distance=Math.hypot(pa[0]-pb[0],pa[1]-pb[1]);if(distance>limit)fail(`${a.role} to ${b.role} contact is ${distance.toFixed(1)}px apart; limit ${limit}px`);}
 if(packageRoot){
  const root=path.resolve(packageRoot),production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
  for(const scene of production.scenes??[]){if(scene.visual_grammar?.meme_composition?.id!==compositionId)continue;const req=scene.visual_grammar.meme_composition.asset_requirements?.find(x=>x.role==='pants');if(!req)fail(`${scene.id} has no native pants asset requirement`);const entity=scene.entities?.find(x=>x.id===req.entity_id);if(!entity||entity.kind!=='object')fail(`${scene.id} has no pants object entity`);if(Object.values(entity.states??{}).some(s=>s.asset!==req.asset_id))fail(`${scene.id}/${entity.id} must use ${req.asset_id}`);const asset=production.assets?.[req.asset_id];if(asset?.style_id!=='zodiac-paper-doodle-meme-v4'||asset.category!=='prop'||asset.path!==req.output_path)fail(`${scene.id}/${req.asset_id} is not the native V4 pants prop`);await readFile(path.resolve(root,asset.path),'utf8');
  }
 }
 return {composition:compositionId,contacts:contacts.length,max_distance_px:limit};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const result=await validateMemeContacts(process.argv[2]??null);console.log(`MEME_CONTACT_PASS: composition=${result.composition} contacts=${result.contacts}`);}
