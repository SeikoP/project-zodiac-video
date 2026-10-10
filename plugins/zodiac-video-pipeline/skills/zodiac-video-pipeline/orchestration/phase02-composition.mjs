#!/usr/bin/env node
// One scene-owned contract inside existing Art Direction, never chat memory.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const compositionHash=x=>createHash('sha256').update((JSON.stringify(canonical(x))??'undefined')).digest('hex');
export function designToken(markdown){
 const block=String(markdown).match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);
 if(!block)throw new Error('COMPOSITION_DESIGN_TOKEN_MISSING');
 const token=JSON.parse(block[1]);
 if(token.id!=='zodiac-paper-doodle-meme-v4'||token.version!=='4.0'||token.hard_style_lock!==true||token.handmade_profile!=='human-stroke-v2')throw new Error('COMPOSITION_STYLE_DRIFT');
 return token;
}
const roles=new Set(['background','character','interactive_prop','foreground_environment','effect','caption','overlay']);
export function validateComposition(production,plan,token){
 const issues=[];const add=(code,scene_id,entity_id,detail)=>issues.push({code,scene_id,entity_id,detail});
 if(plan?.design_token_sha256!==compositionHash(token))add('COMPOSITION_TOKEN_STALE');
 if(plan?.scenes?.length!==production?.scenes?.length)add('COMPOSITION_SCENE_COVERAGE');
 for(const scene of production?.scenes??[]){
  const planned=plan?.scenes?.find(s=>s.id===scene.id),components=planned?.components;
  if(planned?.voice!==scene.voice)add('COMPOSITION_VOICE_STALE',scene.id);
  if(!Array.isArray(components)){add('COMPOSITION_INVENTORY_MISSING',scene.id);continue;}
  const entities=scene.entities??[],ids=new Set(entities.map(e=>e.id)),seen=new Set();
  for(const c of components){
   if(seen.has(c.id))add('COMPOSITION_COMPONENT_DUPLICATE',scene.id,c.id);seen.add(c.id);
   const entity=entities.find(e=>e.id===c.id);
   if(!entity){add('COMPOSITION_COMPONENT_MISSING',scene.id,c.id);continue;}
   if(!c.reason?.trim()||!c.voice_anchor?.trim()||!scene.voice.includes(c.voice_anchor))add('COMPOSITION_NARRATIVE_REASON_MISSING',scene.id,c.id);
   if(!roles.has(entity.visual_role)||c.visual_role!==entity.visual_role)add('COMPOSITION_ROLE_MISSING_OR_STALE',scene.id,c.id);
   if(!entity.initial_state||!entity.states?.[entity.initial_state]||c.initial_state!==entity.initial_state)add('COMPOSITION_INITIAL_STATE_INVALID',scene.id,c.id);
   const states=Object.fromEntries(Object.entries(entity.states??{}).map(([id,s])=>[id,{transform:s.transform,layer:s.layer,visible:s.visible}]));
   if(compositionHash(c.states)!==compositionHash(states))add('COMPOSITION_GEOMETRY_STALE',scene.id,c.id);
   for(const [stateId,s] of Object.entries(states)){
    const t=s.transform??{};
    if(!Number.isInteger(s.layer)||typeof s.visible!=='boolean'||![t.x,t.y,t.width,t.height,t.scale??1,t.rotation??0].every(Number.isFinite)||t.width<=0||t.height<=0||(t.scale??1)<=0)add('COMPOSITION_GEOMETRY_INCOMPLETE',scene.id,c.id,stateId);
   }
  }
  for(const entity of entities)if(!seen.has(entity.id))add('COMPOSITION_COMPONENT_UNPLANNED',scene.id,entity.id);
  for(const field of ['occlusion_relations','spatial_bindings','layout_contract']){
   if(planned?.[field]===undefined||compositionHash(planned[field])!==compositionHash(scene[field]??(field==='layout_contract'?null:[])))add('COMPOSITION_RELATIONS_STALE',scene.id,null,field);
  }
  if(!scene.layout_contract)add('COMPOSITION_LAYOUT_MISSING',scene.id);
  const edges=scene.occlusion_relations??[],remaining=new Set(ids);
  for(const edge of edges)if(!ids.has(edge.front)||!ids.has(edge.back)||edge.front===edge.back)add('COMPOSITION_DEPTH_REFERENCE_INVALID',scene.id);
  while(remaining.size){const ready=[...remaining].filter(id=>!edges.some(e=>e.front===id&&remaining.has(e.back)));if(!ready.length){add('COMPOSITION_DEPTH_CYCLE',scene.id);break;}for(const id of ready)remaining.delete(id);}
  for(const binding of scene.spatial_bindings??[])if(!ids.has(binding.entity)||!ids.has(binding.anchor)||binding.entity===binding.anchor||!['near','held_by','on_surface','emitted_by','points_to'].includes(binding.relation)||!Number.isFinite(binding.max_distance_px)||binding.max_distance_px<=0||binding.max_distance_px>1200)add('COMPOSITION_BINDING_INVALID',scene.id,binding.entity);
 }
 return {format:'zodiac-phase02-composition-qc@1',status:issues.length?'BLOCKED':'PASS',issues};
}
export function sceneContext(production,plan,token,sceneId){
 const scene=production.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('COMPOSITION_SCENE_NOT_FOUND');
 return {format:'zodiac-phase02-scene-context@1',design_token:token,design_token_sha256:compositionHash(token),scene,art_direction:plan.scenes.find(s=>s.id===sceneId),warning:'Source-backed context only; no approval or validator receipt. Read references/design.md and native compiler guidance.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const root=process.argv[2];if(!root)throw new Error('Usage: phase02-composition.mjs <workspace> [--context <scene-id>]');
 const [p,a,d]=await Promise.all([readFile(path.join(root,'production.json'),'utf8'),readFile(path.join(root,'.authoring/scene-art-direction.json'),'utf8'),readFile(path.join(root,'design.md'),'utf8')]);
 const production=JSON.parse(p),plan=JSON.parse(a),token=designToken(d),result=validateComposition(production,plan,token);
 const canonicalToken=designToken(await readFile(new URL('../references/design.md',import.meta.url),'utf8'));
 if(compositionHash(token)!==compositionHash(canonicalToken)){result.issues.push({code:'COMPOSITION_CANONICAL_TOKEN_DRIFT'});result.status='BLOCKED';}
 const at=process.argv.indexOf('--context');
 console.log(JSON.stringify(at>=0?{...sceneContext(production,plan,token,process.argv[at+1]),validation:result}:result,null,2));
 if(result.status!=='PASS')process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
