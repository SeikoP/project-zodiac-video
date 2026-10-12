#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hasPrimarySceneSet,primarySceneSetEntities} from './scene-set-detection.mjs';
import {validateHumanStroke} from '../references/asset-library-v4/validation/validate-human-stroke.mjs';
const arg=process.argv[2];if(!arg){console.error('Usage: node validate-visual-quality-core.mjs <package-root|production.json>');process.exit(2);}
const packageRoot=arg.endsWith('.json')?path.dirname(arg):arg;const productionPath=arg.endsWith('.json')?arg:path.join(arg,'production.json');
const production=JSON.parse(await readFile(productionPath,'utf8'));
const here=path.dirname(fileURLToPath(import.meta.url));
const v4Root=path.join(here,'../references/asset-library-v4');const v4Style=JSON.parse(await readFile(path.join(v4Root,'foundations/style-token.json'),'utf8'));const catalog=JSON.parse(await readFile(path.join(v4Root,'characters/components/catalog.json'),'utf8'));
const fail=(c,m)=>{throw new Error(c+': '+m);};const assetById=production.assets??{};const charByMaster=new Map(catalog.body_profiles.flatMap(x=>[[x.id,x],[x.source_master,x]]));
const sourceMasters=(a)=>{const s=a?.lineage?.source_master;return Array.isArray(s)?s:(s?[s]:[]);};const charMaster=(assetId)=>{const a=assetById[assetId];return a?.character_blueprint?.body_profile??sourceMasters(a).find(id=>charByMaster.has(id));};const bodyProfile=m=>charByMaster.get(m)?.id;
const appearanceGroups=['hair_back','hair_silhouette','torso','torso_identity','body_silhouette','head_outline','cap','mask','scarf'];
const groupMarkup=(svg,id)=>svg.match(new RegExp(String.raw`<g\s+id=["']${id}["'][^>]*>[\s\S]*?<\/g>`,`u`))?.[0]??null;
const colors=(s)=>[...s.matchAll(/(?:fill|stroke)=["'](#[0-9a-fA-F]{6})["']/gu)].map(m=>m[1].toUpperCase()).sort();
const appearanceSignature=(svg)=>appearanceGroups.map(id=>{const g=groupMarkup(svg,id);return g?`${id}:${colors(g).join(',')}`:null;}).filter(Boolean).join('|');
const svgCache=new Map();const loadCharSignature=async(assetId)=>{const a=assetById[assetId];if(!a?.path)return null;const p=path.join(packageRoot,a.path);if(svgCache.has(p))return svgCache.get(p);const svg=await readFile(p,'utf8');const sig=appearanceSignature(svg);svgCache.set(p,sig);return sig;};

const cast=new Map();const baselines=new Map();
for(const scene of production.scenes??[]){
 const sceneChars=[];
 for(const entity of scene.entities??[]){
   for(const [stateId,state] of Object.entries(entity.states??{})){
   const v4bp=assetById[state?.asset]?.character_blueprint;if(entity.kind==='character'&&v4bp){const p=v4bp.body_profile;if(!p)fail('CAST_DIVERSITY_INVALID',`v4 character ${entity.id} lacks body_profile`);const sig=[v4bp.identity_signature,v4bp.body_profile,v4bp.hair_id,v4bp.outfit_id].join('|');const base=baselines.get(entity.id);if(!base)baselines.set(entity.id,{master:sig,profile:p,signature:sig,stateId});else if(base.master!==sig||base.profile!==p)fail('CAST_IDENTITY_DRIFT',`${entity.id} changes native v4 identity at state ${stateId}`);continue;}
   const m=charMaster(state?.asset);if(!m)continue;const p=bodyProfile(m);if(!p)fail('CAST_DIVERSITY_INVALID',`character master ${m} lacks body_profile`);
     const sig=await loadCharSignature(state.asset);const base=baselines.get(entity.id);
     if(!base)baselines.set(entity.id,{master:m,profile:p,signature:sig,stateId});else{if(base.master!==m)fail('CAST_IDENTITY_DRIFT',`${entity.id} changes source master ${base.master} -> ${m} at state ${stateId}`);if(base.profile!==p)fail('CAST_IDENTITY_DRIFT',`${entity.id} changes body_profile ${base.profile} -> ${p} at state ${stateId}`);if(base.signature&&sig&&base.signature!==sig)fail('CHARACTER_APPEARANCE_DRIFT',`${entity.id} changes identity/outfit palette at state ${stateId}`);}
   }
 const initial=entity.states?.[entity.initial_state];const v4bp=assetById[initial?.asset]?.character_blueprint;if(entity.kind==='character'&&v4bp){const p=v4bp.body_profile;const prev=cast.get(entity.id);if(prev&&prev.profile!==p)fail('CAST_IDENTITY_DRIFT',`${entity.id} changes body_profile ${prev.profile} -> ${p}`);cast.set(entity.id,{profile:p,master:v4bp.identity_signature,count:(prev?.count??0)+1});sceneChars.push({id:entity.id,profile:p});continue;}const m=charMaster(initial?.asset);if(!m)continue;const p=bodyProfile(m);const prev=cast.get(entity.id);if(prev&&prev.profile!==p)fail('CAST_IDENTITY_DRIFT',`${entity.id} changes body_profile ${prev.profile} -> ${p}`);cast.set(entity.id,{profile:p,master:m,count:(prev?.count??0)+1});sceneChars.push({id:entity.id,profile:p});
 }
 const ids=[...new Map(sceneChars.map(x=>[x.id,x])).values()];if(ids.length>=2&&new Set(ids.map(x=>x.profile)).size<2)fail('CAST_DIVERSITY_INVALID',`${scene.id} has multiple people but only one body_profile`);
}
const recurring=[...cast.entries()].filter(([,v])=>v.count>=2);const considered=recurring.length>=2?recurring:[...cast.entries()];if(considered.length>=2){const unique=new Set(considered.map(([,v])=>v.profile));const need=Math.min(3,considered.length);if(unique.size<need)fail('CAST_DIVERSITY_INVALID',`cast has ${considered.length} people but only ${unique.size} body profiles; need ${need}`);}

const marker=/(?:beat|scene|panel|step|cảnh|nhịp)\s*#?\s*\d+/iu;const circled=/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/u;const inspectText=(v,l)=>{if(typeof v==='string'&&(marker.test(v)||circled.test(v)))fail('VISIBLE_METADATA_INVALID',`${l} exposes authoring order: ${v}`);};const walk=(v,p='root')=>{if(Array.isArray(v))return v.forEach((x,i)=>walk(x,`${p}[${i}]`));if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(['visible_text','display_text','overlay_text','label','title'].includes(k))inspectText(x,`${p}.${k}`);walk(x,`${p}.${k}`);}};walk(production);

let checked=0;
for(const [assetId,a] of Object.entries(assetById)){
 if(typeof a.path!=='string')fail('STYLE_TOKEN_INVALID',`${assetId} missing asset path`);
 const svg=await readFile(path.join(packageRoot,a.path),'utf8');
 if(a.style_id!==v4Style.id)fail('ASSET_LIBRARY_MIGRATION_REQUIRED',`${assetId} uses non-V4 style ${a.style_id??'(missing)'}`);
 const kind=a.category==='character'?'character':a.category==='effect'?'support':'focal';try{validateHumanStroke(svg,kind);}catch(e){fail('HUMAN_STROKE_V2_INVALID',`${assetId}: ${e.message}`);}checked++;
}

// Frame-composition quality gate: validate actual 1080x1920 geometry before VISUAL REVIEW.
const design=await readFile(path.join(packageRoot,'design.md'),'utf8');const tokenMatch=design.match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);if(!tokenMatch)fail('FRAME_COMPOSITION_INVALID','design.md missing STYLE_TOKEN');let designToken;try{designToken=JSON.parse(tokenMatch[1]);}catch(e){fail('FRAME_COMPOSITION_INVALID','invalid STYLE_TOKEN JSON: '+e.message);}const safe=designToken.safe_zone;const canvas={width:1080,height:1920};if(!safe||!['x','y','width','height'].every(k=>Number.isFinite(safe[k])))fail('FRAME_COMPOSITION_INVALID','design safe_zone missing/nonnumeric');
const intersection=(a,b)=>{const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));const h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return w*h;};const area=r=>r.width*r.height;const initialRect=e=>e?.states?.[e.initial_state]?.transform;const visibleInitial=e=>e?.states?.[e.initial_state]?.visible!==false;
const wallpaper=new Map();const inferredSceneSet=e=>e?.visual_role==='scene_set'||(e?.visual_role==='background'&&String(e?.id??'').startsWith('env__scene-set'));
for(const scene of production.scenes??[]){
 const env=scene.environment??{};const roles=env.roles??{};const roleOf=new Map();for(const [role,ids] of Object.entries(roles))for(const id of ids??[])roleOf.set(id,role);const shot=scene.scene_direction?.shot??'unknown';const sceneSetAsset=env.scene_set?.asset??env.scene_set?.asset_id;const hasSceneSet=hasPrimarySceneSet(scene,production);
 const chars=[];const envSignature=[];
 for(const entity of scene.entities??[]){
   if(!visibleInitial(entity))continue;const rect=initialRect(entity);if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.width<=0||rect.height<=0)fail('FRAME_COMPOSITION_INVALID',`${scene.id}/${entity.id} missing valid initial transform`);
   if(rect.x<0||rect.y<0||rect.x+rect.width>canvas.width||rect.y+rect.height>canvas.height)fail('FRAME_CANVAS_BOUNDS',`${scene.id}/${entity.id} escapes 1080x1920 canvas: ${JSON.stringify(rect)}`);
   const overlap=intersection(rect,safe)/area(rect);const role=roleOf.get(entity.id);const isSceneSet=primarySceneSetEntities(scene,production).some(e=>e.id===entity.id);let limit=isSceneSet?1:0.35;if(role==='grounding'&&!isSceneSet)limit=0.05;else if(role&&!isSceneSet)limit=0.20;if(shot==='caption-led'&&!isSceneSet)limit=Math.min(limit,0.15);
   if(overlap>limit+1e-9)fail('FRAME_CAPTION_COLLISION',`${scene.id}/${entity.id} occupies ${(overlap*100).toFixed(1)}% of caption-safe area budget; limit ${(limit*100).toFixed(0)}%`);
   if(entity.kind==='character')chars.push({id:entity.id,rect});
   if(role)envSignature.push(`${role}:${entity.id}:${rect.x},${rect.y},${rect.width},${rect.height}`);
 }
 if(shot==='two-person'&&chars.length>=2){const [a,b]=chars;const ax=a.rect.x+a.rect.width/2,bx=b.rect.x+b.rect.width/2;if(Math.abs(ax-bx)<260)fail('FRAME_TWO_PERSON_BLOCKING',`${scene.id} character centers are too close for readable two-person blocking`);}
 if(shot==='caption-led'){for(const entity of scene.entities??[]){if(!visibleInitial(entity)||primarySceneSetEntities(scene,production).some(e=>e.id===entity.id))continue;const rect=initialRect(entity);if(rect.y+rect.height>safe.y+40)fail('FRAME_CAPTION_LED_BLOCKED',`${scene.id}/${entity.id} extends too far into caption-led field`);}}
 if(env.mode==='micro_environment'&&!hasSceneSet&&envSignature.length){const sig=envSignature.sort().join('|');const row=wallpaper.get(sig)??{count:0,shots:new Set(),scenes:[]};row.count++;row.shots.add(shot);row.scenes.push(scene.id);wallpaper.set(sig,row);}
}
for(const row of wallpaper.values())if(row.count>=3&&row.shots.size>=2)fail('FRAME_ENVIRONMENT_WALLPAPER',`identical environment geometry repeats across reframed scenes: ${row.scenes.join(', ')}`);

console.log(`CAST_DIVERSITY_PASS: cast=${cast.size} profiles=${new Set([...cast.values()].map(v=>v.profile)).size}`);
console.log('CHARACTER_APPEARANCE_LOCK_PASS');
console.log('VISIBLE_METADATA_CLEAN_PASS');
console.log(`ASSET_STYLE_CONFORMANCE_PASS: non_character_assets=${checked}`);
console.log(`HANDMADE_GEOMETRY_PASS: non_character_assets=${checked}`);
console.log(`V4_CHARACTER_IDENTITY_QUALITY_PASS: native_face_profiles=${catalog.face_profiles?.length??0} accessories=${catalog.accessories?.length??0}`);
console.log('FRAME_COMPOSITION_PASS');
console.log('VISUAL_QUALITY_PASS');
