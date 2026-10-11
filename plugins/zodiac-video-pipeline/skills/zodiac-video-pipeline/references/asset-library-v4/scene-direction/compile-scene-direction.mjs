#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyEnvironmentFrame} from '../environments/environment-frame-v2.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const deepClone=x=>JSON.parse(JSON.stringify(x));
const round=n=>Math.round(n);
const fail=m=>{throw new Error('SCENE_DIRECTION_COMPILE_INVALID: '+m);};
const profileDefault=JSON.parse(await readFile(path.join(here,'compiler-profile.json'),'utf8'));

const resolvePaths=async(arg)=>{let s;try{s=await stat(arg);}catch{fail('input not found: '+arg);}const productionPath=s.isDirectory()?path.join(arg,'production.json'):arg;return {productionPath,root:s.isDirectory()?arg:path.dirname(arg)};};
const parseViewBox=svg=>{const m=svg.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/iu);if(m)return [Number(m[1]),Number(m[2])];const w=svg.match(/\bwidth=["']([0-9.]+)/iu),h=svg.match(/\bheight=["']([0-9.]+)/iu);return w&&h?[Number(w[1]),Number(h[1])]:null;};
const fit=(aspect,box,canvas)=>{const [cx,cy,maxW,maxH]=box;let w=maxW,h=w/aspect;if(h>maxH){h=maxH;w=h*aspect;}w=Math.min(w,canvas.width);h=Math.min(h,canvas.height);let x=round(cx-w/2),y=round(cy-h/2);x=Math.max(0,Math.min(x,round(canvas.width-w)));y=Math.max(0,Math.min(y,round(canvas.height-h)));return {x,y,width:round(w),height:round(h)};};
const targetBox=(profile,shot,role,key)=>{const node=profile.shots?.[shot]?.[role];if(!node)fail(`${shot} missing compiler role ${role}`);if(Array.isArray(node))return node;if(!node[key])fail(`${shot}/${role} missing placement ${key}`);return node[key];};
const stateEntries=e=>Object.entries(e?.states??{});
const entityMap=scene=>new Map((scene.entities??[]).map(e=>[e.id,e]));
const firstCharacter=scene=>(scene.entities??[]).find(e=>e.kind==='character')?.id??null;
const assetAspectReader=(production,root)=>{const cache=new Map();return async assetId=>{if(cache.has(assetId))return cache.get(assetId);const a=production.assets?.[assetId];if(!a?.path)fail(`asset ${assetId} missing path`);const svg=await readFile(path.resolve(root,a.path),'utf8');const vb=parseViewBox(svg);if(!vb||!vb[0]||!vb[1])fail(`asset ${assetId} missing usable viewBox`);const aspect=vb[0]/vb[1];cache.set(assetId,aspect);return aspect;};};
const roleHash=roles=>createHash('sha256').update(JSON.stringify(roles)).digest('hex');

export async function compileProduction(production,{root='.',profile=profileDefault}={}){
  if(production?.version!=='2.0')fail('production.version must be 2.0');
  const out=deepClone(production),aspectOf=assetAspectReader(out,root),receiptScenes=[],canvas=profile.canvas??{width:1080,height:1920};
  for(const [sceneIndex,scene] of (out.scenes??[]).entries()){
    const d=scene.scene_direction;if(!d)fail(`scene ${scene.id??sceneIndex+1} missing scene_direction`);const em=entityMap(scene);const roles=[];
    const memeEntities=d.meme_layout?.entities;const assignedMemeEntities=new Set();
    if(memeEntities!==undefined){
      if(!d.meme_layout?.composition_id||!memeEntities||typeof memeEntities!=='object'||Array.isArray(memeEntities))fail(`${scene.id} invalid meme_layout`);
      for(const [id,box] of Object.entries(memeEntities)){
        if(!em.has(id))fail(`${scene.id} meme_layout references unknown entity ${id}`);
        if(!Array.isArray(box)||box.length!==4||box.some(n=>typeof n!=='number'||!Number.isFinite(n))||box[2]<=0||box[3]<=0)fail(`${scene.id}/${id} invalid meme role box`);
      }
    }
    const requireEntity=(id,label)=>{const e=em.get(id);if(!e)fail(`${scene.id} ${label} ${id} is not a scene entity`);return e;};
    const assign=async(id,role,box)=>{const e=requireEntity(id,role);const resolvedBox=memeEntities?.[id]??box;
      // Explicit frame slots own actor geometry. Fitting each state aspect to
      // the generic shot first changes relative positions and is not idempotent.
      if(scene.environment?.frame?.slots?.some(slot=>slot.entity===id)){
        for(const [stateId,state] of stateEntries(e)){
          if(!state?.asset)fail(`${scene.id}/${id}/${stateId} missing asset`);
          await aspectOf(state.asset);
        }
        roles.push({role,entity_id:id,transform:e.states?.[e.initial_state]?.transform??null});
        if(memeEntities?.[id])assignedMemeEntities.add(id);
        return;
      }
      const originalBase=e.states?.[e.initial_state]?.transform;
      for(const [stateId,state] of stateEntries(e)){
        if(!state?.asset)fail(`${scene.id}/${id}/${stateId} missing asset`);
        const previous=state.transform??{},dx=Number(previous.x??0)-Number(originalBase?.x??0),dy=Number(previous.y??0)-Number(originalBase?.y??0);
        const aspect=await aspectOf(state.asset),t=fit(aspect,resolvedBox,canvas);
        // The director profile owns baseline layout, not authored movement between states.
        state.transform={...previous,...t,x:round(t.x+dx),y:round(t.y+dy)};
      }
      const init=e.states?.[e.initial_state];roles.push({role,entity_id:id,transform:init?.transform??null});if(memeEntities?.[id])assignedMemeEntities.add(id);};
    const focusId=em.has(d.focus)?d.focus:null;const subjectId=focusId??firstCharacter(scene);const placement=d.subject_placement;
    if(['wide-environment','medium-character','reaction-closeup','caption-led'].includes(d.shot)){
      if(!subjectId)fail(`${scene.id} ${d.shot} has no resolvable subject`);await assign(subjectId,'subject',targetBox(profile,d.shot,'subject',placement));
      if(d.foreground_role&&profile.shots[d.shot]?.foreground){const side=placement==='right'?'left':'right';await assign(d.foreground_role,'foreground',targetBox(profile,d.shot,'foreground',side));}
    }else if(d.shot==='prop-insert'){
      if(!focusId)fail(`${scene.id} prop-insert focus must resolve to entity`);await assign(focusId,'focus_prop',targetBox(profile,d.shot,'focus',placement));const companion=(scene.entities??[]).find(e=>e.kind==='character'&&e.id!==focusId)?.id;if(companion){const side=placement==='right'?'left':'right';await assign(companion,'companion',targetBox(profile,d.shot,'companion',side));}
    }else if(d.shot==='two-person'){
      const r=d.interaction_roles??{};await assign(r.speaker,'speaker',profile.shots[d.shot].speaker);await assign(r.listener,'listener',profile.shots[d.shot].listener);if(r.shared_prop)await assign(r.shared_prop,'shared_prop',profile.shots[d.shot].shared_prop);
    }else if(d.shot==='over-shoulder'){
      if(!focusId||!d.foreground_role)fail(`${scene.id} over-shoulder needs focus entity + foreground_role`);await assign(focusId,'focus',targetBox(profile,d.shot,'focus',placement));const key=placement==='left'?'when_focus_left':'when_focus_right';await assign(d.foreground_role,'foreground',targetBox(profile,d.shot,'foreground',key));
    }else if(d.shot==='foreground-peek'){
      if(!subjectId||!d.foreground_role)fail(`${scene.id} foreground-peek needs subject + foreground_role`);await assign(subjectId,'subject',targetBox(profile,d.shot,'subject',placement));const key=placement==='left'?'when_subject_left':placement==='right'?'when_subject_right':'when_subject_center';await assign(d.foreground_role,'foreground',targetBox(profile,d.shot,'foreground',key));
    }else fail(`${scene.id} unsupported shot ${d.shot}`);
    if(memeEntities){
      const semanticRoles=scene.visual_grammar?.meme_composition?.roles??{};
      for(const [id,box] of Object.entries(memeEntities))if(!assignedMemeEntities.has(id)){
        const role=Object.entries(semanticRoles).find(([,binding])=>binding?.entity_id===id)?.[0]??'meme_entity';
        await assign(id,role,box);
      }
    }
    if(scene.environment?.frame){
      const framed=applyEnvironmentFrame(scene,out.assets,{styleToken:out.visual_system?.style_token?.id});
      Object.assign(scene,framed);
      const byId=entityMap(scene);
      for(const role of roles){
        const actor=byId.get(role.entity_id);
        role.transform=actor?.states?.[actor.initial_state]?.transform??null;
      }
    }
    for(const role of roles){const t=role.transform;if(!t||t.x<0||t.y<0||t.x+t.width>canvas.width||t.y+t.height>canvas.height)fail(`${scene.id}/${role.entity_id} compiled outside canvas`);}
    const signature=scene.environment?.frame?roleHash({roles,frame:scene.environment.frame}):roleHash(roles);receiptScenes.push({scene_id:scene.id,shot:d.shot,focus:d.focus,placement,roles,signature,...(scene.environment?.frame?{environment_frame_intent:scene.environment.frame.intent}:{})});
  }
  const receipt={format:'zodiac-scene-direction-compile-receipt@1',compiler_version:profile.version,production_version:out.version,scenes:receiptScenes,signature:roleHash(receiptScenes.map(x=>x.signature))};
  return {production:out,receipt};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const arg=process.argv[2];if(!arg){console.error('Usage: node compile-scene-direction.mjs <package-root|production.json> --write');process.exit(2);}const write=process.argv.includes('--write');const {productionPath,root}=await resolvePaths(arg);const production=JSON.parse(await readFile(productionPath,'utf8'));const result=await compileProduction(production,{root});if(write){await writeFile(productionPath,JSON.stringify(result.production,null,2)+'\n');const receiptPath=path.join(root,profileDefault.policy.receipt_path);await mkdir(path.dirname(receiptPath),{recursive:true});await writeFile(receiptPath,JSON.stringify(result.receipt,null,2)+'\n');console.log(`SCENE_DIRECTION_COMPILE_PASS: scenes=${result.receipt.scenes.length} receipt=${path.relative(root,receiptPath)}`);}else console.log(JSON.stringify(result,null,2));}
