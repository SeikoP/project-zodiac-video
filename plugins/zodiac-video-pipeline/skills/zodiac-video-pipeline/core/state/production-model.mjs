import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {canonicalDigest} from '../release/verify-release-sync.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export function canonicalizeProductionModel(model){return JSON.stringify(canonical(model));}
export function validateProductionModel(model,{narrationChecksum=null}={}){
 const errors=[];
 if(model?.format!=='zodiac-production-model@1')errors.push('MODEL_FORMAT_INVALID');
 if(!Array.isArray(model?.scenes)||!model.scenes.length)errors.push('SCENES_MISSING');
 if(typeof model?.narration!=='string'||!model.narration.trim())errors.push('NARRATION_MISSING');
 if(narrationChecksum&&canonicalDigest(model.narration)!==narrationChecksum)errors.push('APPROVED_NARRATION_CHANGED');
 if(model?.projections&&Object.keys(model.projections).length)errors.push('PROJECTIONS_NOT_AUTHORITATIVE');
 if(model?.scenes?.some(s=>!s.id||!Array.isArray(s.actions)))errors.push('SCENE_ACTIONS_INVALID');
 return {ok:errors.length===0,errors,digest:errors.length?null:canonicalDigest(model)};
}
export async function loadProductionModel(workspace){const model=JSON.parse(await readFile(path.join(workspace,'production-model.json'),'utf8'));const result=validateProductionModel(model);if(!result.ok)throw new Error(result.errors.join(','));return model;}
export function getOwnedField(field,registry){const owner=registry?.paths?.[field];if(!owner)throw new Error('UNOWNED_FIELD:'+field);return owner;}
