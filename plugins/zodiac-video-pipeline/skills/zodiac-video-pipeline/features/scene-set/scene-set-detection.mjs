import {readFile} from 'node:fs/promises';
const registry=JSON.parse(await readFile(new URL('../../references/asset-library-v4/scene-set/index.json',import.meta.url),'utf8'));
const ids=new Set((registry.scene_sets??[]).map(s=>s.id));
export const sceneSetRefFromEntity=(entity,production)=>Object.values(entity?.states??{}).map(s=>s.asset).find(id=>id&&production?.assets?.[id]);
export function primarySceneSetEntities(scene,production){
 const ref=scene?.environment?.scene_set?.asset??scene?.environment?.scene_set?.asset_id;
 return (scene?.entities??[]).filter(e=>Object.values(e.states??{}).some(s=>s.asset&&(s.asset===ref||ids.has(production?.assets?.[s.asset]?.lineage?.source_master))));
}
export const hasPrimarySceneSet=(scene,production)=>Boolean(scene?.environment?.scene_set_id||scene?.environment?.scene_set||primarySceneSetEntities(scene,production).length);
export const isPrimarySceneSetEntity=(entity,production)=>Object.values(entity?.states??{}).some(s=>ids.has(production?.assets?.[s.asset]?.lineage?.source_master));
export function sceneSetIdentity(scene,production){return scene?.environment?.scene_set_id??scene?.environment?.scene_set?.id??production?.assets?.[sceneSetRefFromEntity(primarySceneSetEntities(scene,production)[0],production)]?.lineage?.source_master??null;}
