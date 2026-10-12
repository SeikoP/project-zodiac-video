#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {hasPrimarySceneSet} from '../../orchestration/scene-set-detection.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=m=>{throw new Error('VISUAL_GRAMMAR_COMPILE_INVALID: '+m);};
const shotLayoutsDoc=JSON.parse(await readFile(path.join(here,'shot-layouts/index.json'),'utf8'));
const frameRows=shotLayoutsDoc.layouts??shotLayoutsDoc.frames??[];
const mechanicsDoc=JSON.parse(await readFile(path.join(here,'mechanics/index.json'),'utf8'));
const sceneSetDoc=JSON.parse(await readFile(path.join(here,'scene-set/index.json'),'utf8'));
const memesDoc=JSON.parse(await readFile(path.join(here,'memes/index.json'),'utf8'));
const frames=new Map(frameRows.map(x=>[x.id,x]));
const mechanics=new Map(mechanicsDoc.mechanics.map(x=>[x.id,x]));
const sceneSets=new Map((sceneSetDoc.scene_sets??[]).map(x=>[x.id,x]));
const memes=new Map((memesDoc.compositions??[]).map(x=>[x.id,x]));
const clone=x=>JSON.parse(JSON.stringify(x));

function resolveMeme(spec,scene,sceneId){
  if(spec.meme_composition===undefined)return null;
  const request=spec.meme_composition;
  if(!request||typeof request!=='object'||Array.isArray(request))fail(`${sceneId} meme_composition must be an object`);
  const id=String(request.id??'').trim();
  const composition=memes.get(id);
  if(!composition)fail(`${sceneId} unknown meme composition ${id||'(missing id)'}`);
  if(spec.frame_id&&spec.frame_id!==composition.frame_id)fail(`${sceneId} meme ${id} requires frame ${composition.frame_id}, got ${spec.frame_id}`);
  if(spec.mechanic_id&&spec.mechanic_id!==composition.mechanic_id)fail(`${sceneId} meme ${id} requires mechanic ${composition.mechanic_id}, got ${spec.mechanic_id}`);
  const supplied=request.bindings??{};
  if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))fail(`${sceneId} meme ${id} bindings must be an object`);
  const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
  const knownRoles=new Set(Object.keys(composition.roles??{}));
  for(const role of Object.keys(supplied))if(!knownRoles.has(role))fail(`${sceneId} meme ${id} unknown role binding ${role}`);
  const roles={};
  const frameBindings=clone(spec.bindings??{});
  const layoutEntities={};
  const actingRequirements={};
  const effectSpecs=[];
  for(const [role,contract] of Object.entries(composition.roles??{})){
    const entityId=supplied[role];
    if(contract.required&&!entityId)fail(`${sceneId} meme ${id} missing required role ${role}`);
    if(!entityId)continue;
    const entity=entities.get(entityId);
    if(!entity)fail(`${sceneId} meme ${id} role ${role} references unknown entity ${entityId}`);
    if(entity.kind!==contract.kind)fail(`${sceneId} meme ${id} role ${role} expects ${contract.kind}, got ${entity.kind}`);
    if(Object.values(roles).some(v=>v.entity_id===entityId))fail(`${sceneId} meme ${id} binds entity ${entityId} to more than one role`);
    roles[role]={entity_id:entityId,kind:contract.kind,slot:contract.slot??null};
    if(contract.slot){
      const existing=frameBindings[contract.slot];
      if(existing&&existing!==entityId)fail(`${sceneId} meme ${id} role ${role} conflicts with frame slot ${contract.slot}`);
      frameBindings[contract.slot]=entityId;
    }
    const box=composition.layout?.[role];
    if(!Array.isArray(box)||box.length!==4||box.some(x=>typeof x!=='number'||!Number.isFinite(x)))fail(`${sceneId} meme ${id} has invalid layout for role ${role}`);
    const [cx,cy,w,h]=box;
    if(w<=0||h<=0||cx-w/2<0||cy-h/2<0||cx+w/2>memesDoc.canvas.width||cy+h/2>memesDoc.canvas.height)fail(`${sceneId} meme ${id} layout for role ${role} exceeds canvas`);
    layoutEntities[entityId]=box;
    if(contract.kind==='character'&&contract.acting)actingRequirements[entityId]=clone(contract.acting);
  }
  if(composition.effect){
    const effect=composition.effect;
    const anchor=effect.anchor;
    const role=anchor?.role;
    const roleBinding=roles[role];
    if(!roleBinding)fail(`${sceneId} meme ${id} effect anchor references unbound role ${role}`);
    const roleBox=layoutEntities[roleBinding.entity_id];
    const [cx,cy,w,h]=roleBox,[px,py]=anchor.point??[0.5,0.5],[ox,oy]=anchor.offset_px??[0,0];
    const [ew,eh]=effect.size_px??[];
    if(![px,py,ox,oy,ew,eh].every(Number.isFinite)||ew<=0||eh<=0)fail(`${sceneId} meme ${id} has invalid effect geometry`);
    const x=cx-w/2+px*w+ox-ew/2,y=cy-h/2+py*h+oy-eh/2;
    const box=[x+ew/2,y+eh/2,ew,eh];
    if(x<0||y<0||x+ew>memesDoc.canvas.width||y+eh>memesDoc.canvas.height)fail(`${sceneId} meme ${id} effect exceeds canvas`);
    const entityId=`FX_${String(sceneId).replace(/[^A-Za-z0-9_]/gu,'_')}_01`;
    layoutEntities[entityId]=box;
    effectSpecs.push({id:effect.id,entity_id:entityId,box,layer:effect.layer??70,locus:effect.locus,anchor:clone(anchor)});
  }
  return {id,composition,roles,frameBindings,layoutEntities,actingRequirements,effectSpecs};
}

export function compileVisualGrammar(production,plan){
  if(production?.version!=='2.0')fail('production.version must be 2.0');
  if(plan?.format!=='zodiac-visual-grammar-plan@1'||!Array.isArray(plan.scenes))fail('visual grammar plan must be zodiac-visual-grammar-plan@1');
  const out=clone(production),sceneMap=new Map((out.scenes??[]).map(s=>[s.id,s]));
  for(const spec of plan.scenes){
    const scene=sceneMap.get(spec.scene_id);
    if(!scene)fail(`unknown scene ${spec.scene_id}`);
    const meme=resolveMeme(spec,scene,spec.scene_id);
    const frameId=meme?.composition.frame_id??spec.frame_id;
    const mechanicId=meme?.composition.mechanic_id??spec.mechanic_id;
    const frame=frames.get(frameId);
    if(!frame)fail(`${spec.scene_id} unknown frame ${frameId}`);
    const mechanic=mechanics.get(mechanicId);
    if(!mechanic)fail(`${spec.scene_id} unknown mechanic ${mechanicId}`);
    const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
    const bindings=meme?.frameBindings??clone(spec.bindings??{});
    for(const [slotId,slot] of Object.entries(frame.slots??{})){
      const entityId=bindings[slotId];
      if(slot.required&&(!entityId||!String(entityId).trim()))fail(`${spec.scene_id}/${frame.id} missing required binding ${slotId}`);
      if(!entityId)continue;
      const entity=entities.get(entityId);
      if(!entity)fail(`${spec.scene_id}/${slotId} binding references unknown entity ${entityId}`);
      if(slot.kind&&entity.kind!==slot.kind)fail(`${spec.scene_id}/${slotId} expects ${slot.kind}, got ${entity.kind}`);
    }
    const suppliedCaps=new Set();
    for(const [slotId,entityId] of Object.entries(bindings)){
      if(!entityId)continue;
      for(const cap of frame.slots?.[slotId]?.capabilities??[])suppliedCaps.add(cap);
    }
    const missing=(mechanic.requires??[]).filter(x=>!suppliedCaps.has(x));
    if(missing.length)fail(`${spec.scene_id} mechanic ${mechanic.id} cannot bind to frame ${frame.id}; missing capabilities: ${missing.join(', ')}`);
    const d=frame.scene_direction,focus=bindings[d.focus_role];
    if(!focus)fail(`${spec.scene_id}/${frame.id} cannot resolve focus role ${d.focus_role}`);
    const interaction=d.interaction_roles?Object.fromEntries(Object.entries(d.interaction_roles).flatMap(([outKey,slotId])=>bindings[slotId]?[[outKey,bindings[slotId]]]:[])):undefined;
    scene.scene_direction={shot:d.shot,focus,subject_placement:d.subject_placement,continuity_relation:spec.continuity_relation??'continue',foreground_role:d.foreground_role?bindings[d.foreground_role]??null:null,composition_goal:String(spec.composition_goal??'').trim()||`${frame.id} + ${mechanic.id}`,...(interaction&&Object.keys(interaction).length?{interaction_roles:interaction}:{})};
    scene.visual_grammar={frame_id:frame.id,mechanic_id:mechanic.id,bindings:clone(bindings)};
    if(meme){
      scene.scene_direction.meme_layout={composition_id:meme.id,entities:meme.layoutEntities,caption_slot:meme.composition.caption_slot??null};
      const assetRequirements=(meme.composition.asset_requirements??[]).map(req=>{const binding=meme.roles[req.role];if(!binding)fail(`${scene.id} meme ${meme.id} asset requirement references unbound role ${req.role}`);return {...clone(req),entity_id:binding.entity_id};});
      scene.visual_grammar.meme_composition={id:meme.id,source_library:'zodiac-visual-grammar-v4',source_contract:meme.composition.source,roles:meme.roles,required_contacts:clone(meme.composition.required_contacts??[]),acting_requirements:meme.actingRequirements,effects:meme.effectSpecs,asset_requirements:assetRequirements};
    }
    if(spec.environment!==undefined){
      if(!spec.environment||typeof spec.environment!=='object'||Array.isArray(spec.environment))fail(`${spec.scene_id} environment must be an object`);
      if(spec.environment.scene_set_id){
        if(spec.environment.profile)fail(`${spec.scene_id} may not mix scene_set_id with legacy profile`);
        const set=sceneSets.get(spec.environment.scene_set_id);if(!set)fail(`${spec.scene_id} unknown scene set ${spec.environment.scene_set_id}`);
        if(spec.environment.scene_accents!==undefined&&!Array.isArray(spec.environment.scene_accents))fail(`${spec.scene_id} scene_accents must be an array`);
        scene.environment={...scene.environment,mode:'scene_set',scene_set_id:set.id,background_palette_id:spec.environment.background_palette_id??'warm-paper',scene_accents:clone(spec.environment.scene_accents??[])};
      }else if(!hasPrimarySceneSet(scene,out)){
        fail(`${spec.scene_id} RECOVERY_SNAPSHOT_REQUIRED`);
      }
    }
  }
  return out;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const productionPath=process.argv[2],planPath=process.argv[3];
  if(!productionPath||!planPath){console.error('Usage: node compile-visual-grammar.mjs <production.json> <visual-grammar-plan.json> --write');process.exit(2);}
  const production=JSON.parse(await readFile(productionPath,'utf8')),plan=JSON.parse(await readFile(planPath,'utf8')),out=compileVisualGrammar(production,plan);
  if(process.argv.includes('--write')){await writeFile(productionPath,JSON.stringify(out,null,2)+'\\n');console.log(`VISUAL_GRAMMAR_COMPILE_PASS: scenes=${plan.scenes.length}`);}else console.log(JSON.stringify(out,null,2));
}
