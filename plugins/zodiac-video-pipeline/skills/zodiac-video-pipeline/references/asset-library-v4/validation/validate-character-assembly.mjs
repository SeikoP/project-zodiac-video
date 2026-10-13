#!/usr/bin/env node
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileCharacterSvg,identitySignature,planCharacterStateAssets,resolveShirtColorAssignments} from '../characters/compile-character-assembly.mjs';
import {validateHumanStroke} from './validate-human-stroke.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=(code,msg)=>{throw new Error(`${code}: ${msg}`);};
const exists=p=>access(p).then(()=>true).catch(()=>false);
const identityFields=['body_profile','hair_id','face_profile_id','accessory_id','outfit_id','shirt_color_id','variant_seed','identity_id','zodiac_sign_id'];
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);

export async function validateCharacterAssembly(packageRoot,planPath=null){
  const root=path.resolve(packageRoot);
  const production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
  const resolvedPlan=planPath?path.resolve(planPath):path.join(root,'.authoring','character-assembly-plan.json');
  if(!(await exists(resolvedPlan)))fail('CHARACTER_ASSEMBLY_PLAN_MISSING','.authoring/character-assembly-plan.json is required for v4 character production');
  const plan=JSON.parse(await readFile(resolvedPlan,'utf8'));
  if(!['zodiac-character-assembly-plan@1','zodiac-character-assembly-plan@2'].includes(plan?.format)||!Array.isArray(plan.characters))fail('CHARACTER_ASSEMBLY_PLAN_INVALID','plan must use zodiac-character-assembly-plan@1 or @2');
  const byEntity=new Map();
  for(const spec of plan.characters){
    if(!spec?.entity_id)fail('CHARACTER_ASSEMBLY_PLAN_INVALID','character spec missing entity_id');
    if(byEntity.has(spec.entity_id))fail('CHARACTER_ASSEMBLY_PLAN_INVALID',`duplicate character spec ${spec.entity_id}`);
    byEntity.set(spec.entity_id,spec);
    for(const [stateId,state] of Object.entries(spec.states??{})){
      for(const key of identityFields)if(key in (state??{}))fail('CHARACTER_ASSEMBLY_PLAN_INVALID',`${spec.entity_id}/${stateId} state identity override ${key} is forbidden; identity belongs to the character blueprint`);
    }
  }
  const stateAssetPlanPath=path.join(root,'.authoring','character-state-asset-plan.json');
  if(!(await exists(stateAssetPlanPath)))fail('CHARACTER_ASSET_PLAN_REQUIRED','.authoring/character-state-asset-plan.json must be created before SVG compilation');
  const storedStateAssetPlan=JSON.parse(await readFile(stateAssetPlanPath,'utf8'));
  const expectedStateAssetPlan=planCharacterStateAssets(production,plan);
  if(JSON.stringify(storedStateAssetPlan)!==JSON.stringify(expectedStateAssetPlan))fail('CHARACTER_ASSET_PLAN_STALE','state asset plan does not match the current production and assembly plan');
  const resolvedShirtColors=resolveShirtColorAssignments(production,plan);
  const expectedAssetByEntityState=new Map();
  for(const characterPlan of expectedStateAssetPlan.characters)for(const group of characterPlan.groups)for(const stateId of group.state_ids)expectedAssetByEntityState.set(`${characterPlan.entity_id}/${stateId}`,group.asset_id);
  const seenEntities=new Set();let checkedStates=0;
  for(const scene of production.scenes??[])for(const entity of scene.entities??[]){
    if(entity.kind!=='character')continue;seenEntities.add(entity.id);
    const spec=byEntity.get(entity.id);if(!spec)fail('CHARACTER_ASSEMBLY_PLAN_INVALID',`character entity ${entity.id} is missing from assembly plan`);
    const acting=scene.visual_grammar?.meme_composition?.acting_requirements?.[entity.id]??{};
    const shirtColorId=resolvedShirtColors.get(spec.entity_id);
    const identity={entity_id:spec.entity_id,body_profile:spec.body_profile,hair_id:spec.hair_id,face_profile_id:spec.face_profile_id??'balanced',accessory_id:spec.accessory_id??'none',outfit_id:spec.outfit_id,zodiac_sign_id:spec.zodiac_sign_id,shirt_color_id:shirtColorId,variant_seed:spec.variant_seed??spec.entity_id};
    const expectedSignature=identitySignature(identity);
    for(const [stateId,state] of Object.entries(entity.states??{})){
      const stateSpec=spec.states?.[stateId];if(!stateSpec)fail('CHARACTER_ASSEMBLY_PLAN_INVALID',`${entity.id} missing state spec ${stateId}`);
      if(stateId===entity.initial_state)for(const [field,expected] of Object.entries(acting))if(stateSpec[field]!==expected)fail('MEME_ACTING_MISMATCH',`${scene.id}/${entity.id}/${stateId} requires ${field}=${expected}`);
      const built=compileCharacterSvg(identity,stateSpec);
      validateHumanStroke(built.svg,'character');
      const asset=production.assets?.[state.asset];
      if(!asset?.character_blueprint)fail('CHARACTER_ASSEMBLY_REQUIRED',`${entity.id}/${stateId} has not been compiled by native v4 character assembly`);
      if(state.asset!==expectedAssetByEntityState.get(`${entity.id}/${stateId}`))fail('CHARACTER_ASSET_PLAN_MISMATCH',`${entity.id}/${stateId} does not use its preplanned asset`);
      const bp=asset.character_blueprint;
      if(bp.identity_signature!==expectedSignature||bp.body_profile!==spec.body_profile||bp.hair_id!==spec.hair_id||bp.face_profile_id!==identity.face_profile_id||bp.accessory_id!==identity.accessory_id||bp.outfit_id!==spec.outfit_id||(bp.zodiac_sign_id??null)!==(spec.zodiac_sign_id??null)||bp.shirt_color_id!==built.shirt_color_id||bp.shirt_color!==built.shirt_color)fail('CHARACTER_IDENTITY_DRIFT',`${entity.id}/${stateId} compiled identity does not match blueprint`);
      if(bp.pose_id!==stateSpec.pose_id||bp.expression_id!==stateSpec.expression_id||(bp.crop_id??null)!==(stateSpec.crop_id??null))fail('CHARACTER_STATE_MISMATCH',`${entity.id}/${stateId} compiled pose/expression/crop does not match plan`);
      if(asset.style_id!=='zodiac-paper-doodle-meme-v4'||asset.lineage?.source_library!=='zodiac-visual-grammar-v4'||asset.lineage?.mode!=='composite')fail('CHARACTER_ASSEMBLY_REQUIRED',`${entity.id}/${stateId} is not native v4 composite output`);
      if(typeof asset.path!=='string'||!(await exists(path.resolve(root,asset.path))))fail('CHARACTER_ASSEMBLY_REQUIRED',`${entity.id}/${stateId} compiled SVG file is missing`);
      const svg=await readFile(path.resolve(root,asset.path),'utf8');validateHumanStroke(svg,'character');if(svg.trimEnd()!==built.svg)fail('CHARACTER_ART_DRIFT',`${entity.id}/${stateId} SVG geometry differs from deterministic native assembly`);checkedStates++;
    }
  }
  for(const id of byEntity.keys())if(!seenEntities.has(id))fail('CHARACTER_ASSEMBLY_PLAN_INVALID',`assembly plan references unknown character ${id}`);
  return {characters:seenEntities.size,states:checkedStates};
}
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-character-assembly.mjs <package-root> [plan.json]');process.exit(2);}const r=await validateCharacterAssembly(root,process.argv[3]??null);console.log(`CHARACTER_ASSEMBLY_PASS: characters=${r.characters} states=${r.states}`);}
