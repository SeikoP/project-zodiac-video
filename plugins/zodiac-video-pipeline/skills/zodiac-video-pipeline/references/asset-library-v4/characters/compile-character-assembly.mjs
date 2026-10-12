#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCharacterDesignIntent} from './character-design-intent.mjs';
import {BODY} from './geometry/body-profiles.mjs';
import {hairPaths} from './geometry/hair-profiles.mjs';
import {transformEyePath} from './geometry/face-profiles.mjs';
import {expr} from './geometry/expression-profiles.mjs';
import {posePaths,handPoints,handShape} from './geometry/pose-profiles.mjs';
import {outfitMarkup,hash32} from './geometry/outfit-profiles.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(await readFile(path.join(here,'components/catalog.json'),'utf8'));
const fail=m=>{throw new Error('CHARACTER_ASSEMBLY_INVALID: '+m);};
const ids=(key)=>new Set((catalog[key]??[]).map(x=>x.id));
const bodyIds=ids('body_profiles'),hairIds=ids('hair'),outfitIds=ids('outfits'),expressionIds=ids('expressions'),poseIds=ids('poses'),cropIds=ids('crops'),faceProfileIds=ids('face_profiles'),accessoryIds=ids('accessories');
const bodyById=new Map(catalog.body_profiles.map(x=>[x.id,x]));
const faceProfileById=new Map((catalog.face_profiles??[]).map(x=>[x.id,x]));
const cropById=new Map((catalog.crops??[]).map(x=>[x.id,x]));
const shirtColors=catalog.shirt_colors??[];
const shirtColorsById=new Map(shirtColors.map(x=>[x.id,x]));
const escapeXml=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const defaultShirtColorId=identity=>{
 if(!shirtColors.length)fail('catalog shirt_colors is required');
 const seed=identity?.variant_seed??identity?.entity_id??'';
 return shirtColors[hash32(`${seed}|${identity?.outfit_id??''}|shirt-color`)%shirtColors.length].id;
};
const resolveShirtColorId=identity=>{
 const id=identity?.shirt_color_id??defaultShirtColorId(identity);
 if(!shirtColorsById.has(id))fail('unknown shirt color '+id);
 return id;
};
const resolveShirtColor=identity=>shirtColorsById.get(resolveShirtColorId(identity));
export const identitySignature=identity=>createHash('sha256').update([identity.entity_id,identity.body_profile,identity.hair_id,identity.face_profile_id??'balanced',identity.outfit_id,resolveShirtColorId(identity),identity.accessory_id??'none',identity.variant_seed??''].join('|')).digest('hex').slice(0,16);
export function resolveShirtColorAssignments(production,plan){
 const specs=plan?.characters??[];
 if(!shirtColors.length)fail('catalog shirt_colors is required');
 const byId=new Map();
 for(const spec of specs){
  if(!spec?.entity_id)fail('character entity_id required for shirt color assignment');
  if(byId.has(spec.entity_id))fail('duplicate character plan '+spec.entity_id);
  byId.set(spec.entity_id,spec);
 }
 const neighbors=new Map(specs.map(spec=>[spec.entity_id,new Set()]));
 for(const scene of production?.scenes??[]){
  const visible=[...new Set((scene.entities??[]).filter(e=>e.kind==='character'&&Object.values(e.states??{}).some(state=>state?.visible!==false)).map(e=>e.id).filter(id=>byId.has(id)))];
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
   neighbors.get(visible[i]).add(visible[j]);neighbors.get(visible[j]).add(visible[i]);
  }
 }
 const assignments=new Map();
 for(const spec of specs)if(spec.shirt_color_id!==undefined){
  assignments.set(spec.entity_id,resolveShirtColorId({...spec,variant_seed:spec.variant_seed??spec.entity_id}));
 }
 for(const spec of specs)if(spec.shirt_color_id!==undefined){
  for(const other of neighbors.get(spec.entity_id)??[])if(assignments.get(other)===assignments.get(spec.entity_id))fail(`visible characters ${spec.entity_id} and ${other} share shirt_color_id ${spec.shirt_color_id}`);
 }
 const automatic=specs.filter(spec=>spec.shirt_color_id===undefined).slice().sort((a,b)=>a.entity_id<b.entity_id?-1:a.entity_id>b.entity_id?1:0);
 for(const spec of automatic){
  const preferred=defaultShirtColorId({...spec,variant_seed:spec.variant_seed??spec.entity_id});
  const start=shirtColors.findIndex(color=>color.id===preferred);
  const order=[...shirtColors.slice(start),...shirtColors.slice(0,start)].map(color=>color.id);
  const used=new Set([...(neighbors.get(spec.entity_id)??[])].map(id=>assignments.get(id)).filter(Boolean));
  assignments.set(spec.entity_id,order.find(id=>!used.has(id))??preferred);
 }
 return assignments;
}
const validate=(identity,state)=>{if(!identity?.entity_id)fail('entity_id required');if(!bodyIds.has(identity.body_profile))fail('unknown body '+identity.body_profile);if(!hairIds.has(identity.hair_id))fail('unknown hair '+identity.hair_id);if(!outfitIds.has(identity.outfit_id))fail('unknown outfit '+identity.outfit_id);if(!faceProfileIds.has(identity.face_profile_id??'balanced'))fail('unknown face profile '+identity.face_profile_id);if(identity.accessory_id&&identity.accessory_id!=='none'&&!accessoryIds.has(identity.accessory_id))fail('unknown accessory '+identity.accessory_id);if(identity.shirt_color_id!==undefined&&!shirtColorsById.has(identity.shirt_color_id))fail('unknown shirt color '+identity.shirt_color_id);if(!poseIds.has(state?.pose_id))fail('unknown pose '+state?.pose_id);if(!expressionIds.has(state?.expression_id))fail('unknown expression '+state?.expression_id);if(state?.crop_id&&!cropIds.has(state.crop_id))fail('unknown crop '+state.crop_id);};
const accessoryMarkup=id=>({
 'round-glasses':'<g id="accessory_glasses"><path d="M171 277 Q176 259 199 260 Q226 262 230 283 Q228 305 204 309 Q179 307 171 277Z M292 280 Q297 259 321 260 Q346 262 351 281 Q349 305 324 309 Q300 307 292 280Z" fill="none" stroke="#2F3C44" stroke-width="6"/><path d="M230 278 Q259 267 292 279 M169 272 Q157 265 146 270 M353 273 Q367 265 378 271" fill="none" stroke="#2F3C44" stroke-width="5.5" stroke-linecap="round"/></g>',
 'star-hair-clip':'<g id="accessory_hair_clip"><path d="M186 185 Q196 167 207 184 L227 180 Q232 199 216 208 L219 226 Q199 229 191 213 Q174 220 166 203 Q178 190 186 185Z" fill="#F2C45C" stroke="#2F3C44" stroke-width="5"/></g>',
 'small-hoop':'<g id="accessory_small_hoop"><path d="M143 310 Q126 319 137 338 Q151 347 158 330" fill="none" stroke="#F2C45C" stroke-width="6"/></g>',
 'headband':'<g id="accessory_headband"><path d="M171 196 Q258 142 354 196" fill="none" stroke="#E97A66" stroke-width="9" stroke-linecap="round"/></g>',
 'neck-scarf':'<g id="accessory_neck_scarf"><path d="M220 449 Q266 470 313 449 Q303 486 267 493 Q230 485 220 449Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="5"/></g>',
 'square-glasses':'<g id="accessory_square_glasses"><path d="M171 263 L229 263 L229 306 L172 306Z M292 263 L350 263 L350 306 L292 306Z M229 278 Q260 268 292 278" fill="none" stroke="#2F3C44" stroke-width="6"/></g>'
})[id]??'';
export function compileCharacterSvg(identity,state){validate(identity,state);const shirt=resolveShirtColor(identity),faceId=identity.face_profile_id??'balanced',accessoryId=identity.accessory_id??'none';const faceProfile=faceProfileById.get(faceId),faceMarks=({
 freckles:'<g id="face_identity_marks"><path d="M194 333 Q198 330 202 333 M207 337 Q211 334 215 337 M310 337 Q314 334 318 337 M323 333 Q327 330 331 333" fill="none" stroke="#E97A66" stroke-width="4.5" stroke-linecap="round"/></g>',
 brow_mark:'<g id="face_identity_marks"><path d="M184 252 Q205 241 225 251 M299 251 Q321 241 341 253" fill="none" stroke="#2F3C44" stroke-width="5" stroke-linecap="round"/></g>',
 beauty_mark:'<g id="face_identity_marks"><path d="M335 337 Q339 333 343 337 Q340 342 335 337Z" fill="#2F3C44"/></g>',
 rosy_cheeks:'<g id="face_identity_marks"><path d="M178 334 Q197 326 216 336 M305 336 Q324 326 343 334" fill="none" stroke="#E97A66" stroke-width="6" stroke-linecap="round"/></g>'
})[faceProfile.mark_style]??'';const b=state.pose_id==='rest_lying'?{...BODY[identity.body_profile],torso:'M282 423 Q324 403 369 412 L571 437 Q594 470 568 504 L346 483 Q302 472 282 423Z',shoulderL:[324,440],shoulderR:[335,415],hipL:[555,480],hipR:[570,454]}:BODY[identity.body_profile],e=expr(state.expression_id),facePaths=e.eyes.map(d=>transformEyePath(d,faceProfile)),p=posePaths(state.pose_id,b),hands=handPoints(state.pose_id,b),slot=['offer','offer-pants','cry-hug','read','text-phone'].includes(state.pose_id)?[(hands[0][0]+hands[1][0])/2,(hands[0][1]+hands[1][1])/2]:hands[1],sig=identitySignature(identity),hair=hairPaths(identity.hair_id),source=bodyById.get(identity.body_profile).source_master,crop=cropById.get(state.crop_id),viewBox=crop?crop.view_box.join(' '):state.pose_id==='rest_lying'?'0 0 900 760':state.pose_id==='rest_sitting'?'0 0 520 800':'0 0 520 760';const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><metadata>asset_role=character_master;id=assembled-${escapeXml(identity.entity_id)};style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;character_assembly=v1;body_profile=${identity.body_profile};body_geometry=authored-limb-reach-v2;hair_id=${identity.hair_id};face_profile_id=${faceId};accessory_id=${accessoryId};outfit_id=${identity.outfit_id};shirt_color_id=${shirt.id};shirt_color=${shirt.hex};identity_signature=${sig};crop_id=${state.crop_id??'none'};production_safe=true</metadata><g id="sticker_edge"><path d="${b.head}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="18"/><path d="${hair[0]}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="16"/>${hair.slice(1).map(d=>`<path d="${d}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="16"/>`).join('')}<path d="${b.torso}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="20"/><path d="${p.la}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${p.ra}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${handShape(hands[0],'left')}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="15"/><path d="${handShape(hands[1],'right')}" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="15"/><path d="${p.ll}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/><path d="${p.rl}" fill="none" stroke="#FFFDF9" stroke-width="22" stroke-linecap="round"/></g>${state.pose_id==='rest_lying'?'':'<g id="shadow"><path d="M171 688 Q257 706 357 687 Q322 699 274 699" fill="none" stroke="#D0C1B3" stroke-width="8" stroke-linecap="round"/></g>'}<g id="head_outline"><path d="${b.head}" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/><path d="${b.inner}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="4.5"/></g><g id="hair_back">${hair.map((d,i)=>`<path d="${d}" fill="#4B5B61" stroke="#2F3C44" stroke-width="${i?5:5.5}" stroke-linejoin="round"/>`).join('')}</g>${accessoryId==='star-hair-clip'?accessoryMarkup(accessoryId):''}<g id="face_eyes"><path d="${facePaths[0]}" fill="${e.eye_mode==='dot'?'#2F3C44':'none'}" stroke="${e.eye_mode==='dot'?'none':'#2F3C44'}" stroke-width="5" stroke-linecap="round"/><path d="${facePaths[1]}" fill="${e.eye_mode==='dot'?'#2F3C44':'none'}" stroke="${e.eye_mode==='dot'?'none':'#2F3C44'}" stroke-width="5" stroke-linecap="round"/></g>${state.expression_id==='cry'?'<g id="face_tears"><path d="M192 288 C185 301 185 312 193 316 C202 313 201 301 192 288Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/><path d="M317 288 C310 301 310 312 318 316 C327 313 326 301 317 288Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="4.5"/></g>':''}<g id="face_mouth"><path d="${e.mouth}" fill="none" stroke="#2F3C44" stroke-width="6" stroke-linecap="round"/></g>${faceMarks}${accessoryId==='round-glasses'?accessoryMarkup(accessoryId):''}<g id="torso"><path d="${b.torso}" fill="${shirt.hex}" stroke="#2F3C44" stroke-width="7"/>${state.pose_id==='rest_lying'?'<defs><clipPath id="lying_outfit_clip"><path d="'+b.torso+'"/></clipPath></defs><g clip-path="url(#lying_outfit_clip)"><g transform="matrix(0 -1 1 0 -130 715)">'+outfitMarkup(identity.outfit_id,identity.variant_seed??identity.entity_id)+'</g></g>':outfitMarkup(identity.outfit_id,identity.variant_seed??identity.entity_id)}</g><g id="left_arm"><path d="${p.la}" fill="none" stroke="#2F3C44" stroke-width="9" stroke-linecap="round"/><path d="${handShape(hands[0],'left')}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="5"/></g><g id="right_arm"><path d="${p.ra}" fill="none" stroke="#2F3C44" stroke-width="10" stroke-linecap="round"/><path d="${handShape(hands[1],'right')}" fill="#F1C6A0" stroke="#2F3C44" stroke-width="5"/></g><g id="left_leg"><path d="${p.ll}" fill="none" stroke="#2F3C44" stroke-width="9" stroke-linecap="round"/></g><g id="right_leg"><path d="${p.rl}" fill="none" stroke="#2F3C44" stroke-width="10" stroke-linecap="round"/></g><g id="prop_slot"><path d="M${slot[0]-5} ${slot[1]} Q${slot[0]} ${slot[1]-6} ${slot[0]+6} ${slot[1]} Q${slot[0]+2} ${slot[1]+6} ${slot[0]-5} ${slot[1]}Z" fill="#E97A66" opacity="0"/></g></svg>`;return {svg,sockets:{left_grip:hands[0],right_grip:hands[1],prop_slot:slot,seat:[(b.hipL[0]+b.hipR[0])/2,(b.hipL[1]+b.hipR[1])/2]},catalog_integrity:'PASS',episode_contact_review:'PENDING',identity_signature:sig,body_source_master:source,body_profile:identity.body_profile,hair_id:identity.hair_id,face_profile_id:faceId,accessory_id:accessoryId,outfit_id:identity.outfit_id,shirt_color_id:shirt.id,shirt_color:shirt.hex,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null};}
const characterIdentity=(spec,resolvedShirtColors)=>({entity_id:spec.entity_id,body_profile:spec.body_profile,hair_id:spec.hair_id,face_profile_id:spec.face_profile_id??'balanced',accessory_id:spec.accessory_id??'none',outfit_id:spec.outfit_id,shirt_color_id:spec.shirt_color_id??resolvedShirtColors.get(spec.entity_id),variant_seed:spec.variant_seed??spec.entity_id});
const stableJson=value=>JSON.stringify(value);
const sha256=value=>createHash('sha256').update(typeof value==='string'?value:stableJson(value),'utf8').digest('hex');
export function planCharacterStateAssets(production,plan){
 if(production?.version!=='2.0')fail('production.version must be 2.0');
 if(!Array.isArray(plan?.characters))fail('plan.characters must be an array');
 validateCharacterDesignIntent(production,plan);
 const sceneMatches=[];
 for(const scene of production.scenes??[])for(const entity of scene.entities??[])if(entity.kind==='character')sceneMatches.push({scene,entity});
 const resolvedShirtColors=resolveShirtColorAssignments(production,plan),seenSpecs=new Set(),assetOwners=new Map(),assetPaths=new Map(),characters=[];
 for(const spec of plan.characters){
  if(seenSpecs.has(spec.entity_id))fail('duplicate character plan '+spec.entity_id);seenSpecs.add(spec.entity_id);
  const matches=sceneMatches.filter(x=>x.entity.id===spec.entity_id);if(!matches.length)fail('unknown character entity '+spec.entity_id);
  const identity=characterIdentity(spec,resolvedShirtColors),stateSpecs=spec.states??{},groupsByKey=new Map();
  for(const {scene,entity} of matches){
   const acting=scene.visual_grammar?.meme_composition?.acting_requirements?.[spec.entity_id]??{};
   for(const stateId of Object.keys(entity.states??{})){
    const state=stateSpecs[stateId];if(!state)fail(`${spec.entity_id} missing assembly state ${stateId}`);
    if(stateId===entity.initial_state)for(const [field,expected] of Object.entries(acting))if(state[field]!==expected)fail(`${scene.id}/${spec.entity_id}/${stateId} meme acting requires ${field}=${expected}, got ${state[field]??'(missing)'}`);
    validate(identity,state);
    const stateKey=stableJson([identitySignature(identity),state.pose_id,state.expression_id,state.crop_id??'']);
    let group=groupsByKey.get(stateKey);
    if(!group){
     const assetKey=sha256(stateKey).slice(0,12),representativeStateId=stateId;
     const assetId=`CHAR_${spec.entity_id}_${representativeStateId}`.replace(/[^A-Za-z0-9_]/gu,'_').toUpperCase();
     const rel=`assets/characters/${spec.entity_id}-${representativeStateId}.svg`;
     const owner=`${spec.entity_id}/${representativeStateId}`;
     if(assetOwners.has(assetId)&&assetOwners.get(assetId)!==owner)fail(`asset id collision ${assetId}: ${assetOwners.get(assetId)} vs ${owner}`);
     if(assetPaths.has(rel)&&assetPaths.get(rel)!==owner)fail(`asset path collision ${rel}: ${assetPaths.get(rel)} vs ${owner}`);
     assetOwners.set(assetId,owner);assetPaths.set(rel,owner);
     group={asset_key:assetKey,asset_id:assetId,path:rel,representative_state_id:representativeStateId,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null,state_ids:[]};groupsByKey.set(stateKey,group);
    }
    if(!group.state_ids.includes(stateId))group.state_ids.push(stateId);
   }
  }
  const groups=[...groupsByKey.values()],requestedBudget=spec.asset_budget?.max_unique_states??groups.length;
  if(!Number.isInteger(requestedBudget)||requestedBudget<1||requestedBudget>0x7fffffff)fail(`${spec.entity_id} asset_budget.max_unique_states must be a positive integer`);
  if(groups.length>requestedBudget)fail(`${spec.entity_id} has ${groups.length} unique character assets; budget is ${requestedBudget}`);
  characters.push({entity_id:spec.entity_id,max_unique_states:requestedBudget,exception_reason:spec.asset_budget?.exception_reason?.trim()??null,unique_asset_count:groups.length,reused_state_count:groups.reduce((n,g)=>n+Math.max(0,g.state_ids.length-1),0),groups});
 }
 const productionStateShape=sceneMatches.map(({scene,entity})=>({scene_id:scene.id,entity_id:entity.id,initial_state:entity.initial_state??null,state_ids:Object.keys(entity.states??{})}));
 return {format:'zodiac-character-state-asset-plan@1',policy:{default_max_unique_states_per_character:null,reuse_key:'identity_signature+pose_id+expression_id+crop_id',svg_content_dedupe:false},source:{production_states_sha256:sha256(productionStateShape),assembly_plan_sha256:sha256(plan)},characters};
}
export async function compileCharacterAssembly(production,plan,{root='.',writeAssets=false,stateAssetPlan}={}){
 const planned=planCharacterStateAssets(production,plan);
 if(stateAssetPlan&&stableJson(stateAssetPlan)!==stableJson(planned))fail('state asset plan is stale; run --plan-only again before --write');
 const out=JSON.parse(JSON.stringify(production));out.assets??={};
 const sceneMatches=[];for(const scene of out.scenes??[])for(const entity of scene.entities??[])if(entity.kind==='character')sceneMatches.push({scene,entity});
 for(const {entity} of sceneMatches){if(entity.visual_role&&entity.visual_role!=='character')fail('ROLE_CONFLICT '+entity.id);entity.visual_role='character';for(const state of Object.values(entity.states??{})){state.layer??=20;state.visible??=true;}}
 const resolvedShirtColors=resolveShirtColorAssignments(production,plan);
 for(const charPlan of planned.characters){
  const spec=plan.characters.find(item=>item.entity_id===charPlan.entity_id),identity=characterIdentity(spec,resolvedShirtColors),matches=sceneMatches.filter(x=>x.entity.id===spec.entity_id);
  for(const group of charPlan.groups){
   const state=spec.states[group.representative_state_id],built=compileCharacterSvg(identity,state),rel=group.path;
   out.assets[group.asset_id]={path:rel,style_id:'zodiac-paper-doodle-meme-v4',category:'character',character_blueprint:{identity_id:spec.identity_id??spec.entity_id,identity_signature:built.identity_signature,body_profile:spec.body_profile,hair_id:spec.hair_id,face_profile_id:built.face_profile_id,accessory_id:built.accessory_id,outfit_id:spec.outfit_id,shirt_color_id:built.shirt_color_id,shirt_color:built.shirt_color,pose_id:state.pose_id,expression_id:state.expression_id,crop_id:state.crop_id??null},lineage:{mode:'composite',source_library:'zodiac-visual-grammar-v4',source_master:built.body_source_master,semantic_intent:`${spec.entity_id} ${group.state_ids.join('|')} ${state.pose_id} ${state.expression_id}`}};
   for(const {entity} of matches)for(const stateId of group.state_ids)if(entity.states?.[stateId])entity.states[stateId].asset=group.asset_id;
   if(writeAssets){const abs=path.resolve(root,rel);await mkdir(path.dirname(abs),{recursive:true});await writeFile(abs,built.svg+'\n');}
  }
 }
 return out;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(direct){if(process.argv.includes('--write')&&!process.argv.includes('--transaction-stage')){const {runGeneratedCompile}=await import('../../../orchestration/generated-asset-ownership.mjs');const result=await runGeneratedCompile(path.dirname(path.resolve(process.argv[2])),fileURLToPath(import.meta.url),process.argv.slice(2),{compiler_id:'character_write',prune:process.argv.includes('--prune-generated')});process.stdout.write(result.stdout??'');process.exit(0);}const productionPath=process.argv[2],planPath=process.argv[3];if(!productionPath||!planPath){console.error('Usage: node compile-character-assembly.mjs <production.json> <character-assembly-plan.json> [--plan-only|--write]');process.exit(2);}try{const production=JSON.parse(await readFile(productionPath,'utf8')),plan=JSON.parse(await readFile(planPath,'utf8')),root=path.dirname(productionPath),assetPlanPath=path.join(root,'.authoring','character-state-asset-plan.json');if(process.argv.includes('--plan-only')){const assetPlan=planCharacterStateAssets(production,plan);await mkdir(path.dirname(assetPlanPath),{recursive:true});await writeFile(assetPlanPath,JSON.stringify(assetPlan,null,2)+'\n');const total=assetPlan.characters.reduce((n,c)=>n+c.unique_asset_count,0),reused=assetPlan.characters.reduce((n,c)=>n+c.reused_state_count,0);console.log(`CHARACTER_ASSET_PLAN_PASS: characters=${assetPlan.characters.length} unique_assets=${total} reused_states=${reused}`);}else if(process.argv.includes('--write')){let assetPlan;try{assetPlan=JSON.parse(await readFile(assetPlanPath,'utf8'));}catch{fail('state asset plan missing; run --plan-only before --write');}const out=await compileCharacterAssembly(production,plan,{root,writeAssets:true,stateAssetPlan:assetPlan});await writeFile(productionPath,JSON.stringify(out,null,2)+'\n');await (await import('./build-identity-preview.mjs')).buildCharacterIdentityPreview(plan,{outDir:path.join(root,'.authoring/character-identity-preview'),compileSvg:compileCharacterSvg,signature:identitySignature});const total=assetPlan.characters.reduce((n,c)=>n+c.unique_asset_count,0),reused=assetPlan.characters.reduce((n,c)=>n+c.reused_state_count,0);console.log(`CHARACTER_ASSEMBLY_COMPILE_PASS: characters=${plan.characters.length} unique_assets=${total} reused_states=${reused}`);}else{const out=await compileCharacterAssembly(production,plan);console.log(JSON.stringify(out,null,2));}}catch(e){console.error(e.message);process.exit(1);}}