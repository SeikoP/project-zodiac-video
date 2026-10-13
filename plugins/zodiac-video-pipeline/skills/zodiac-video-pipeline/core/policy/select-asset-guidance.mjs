function resolveAssetNeed(needId,{capabilityIndex,coverageMatrix}){
 const row=(coverageMatrix?.needs??[]).find(candidate=>candidate.id===needId);
 if(!row)throw new Error('ASSET_CAPABILITY_NEED_UNKNOWN '+needId);
 const capabilityId=row.capability;
 const groups=[
  ['scene_set',capabilityIndex?.scene_sets],
  ['layout',capabilityIndex?.layouts],
  ['interaction',capabilityIndex?.interactions],
  ['effect',capabilityIndex?.effects],
  ['visual_metaphor',capabilityIndex?.visual_metaphors],
 ];
 for(const [kind,entries] of groups){
  if(entries&&Object.prototype.hasOwnProperty.call(entries,capabilityId)){
   return {need_id:needId,capability_id:capabilityId,kind,metadata:structuredClone(entries[capabilityId])};
  }
 }
 throw new Error('ASSET_CAPABILITY_TARGET_UNKNOWN '+needId+' '+capabilityId);
}

export function selectAssetGuidance({selected_asset_ids=[],asset_needs=[],meme_selected=false,environment_mode='canvas'},policy,catalogs={}){
 if(['selected_cues','legacy'].includes(environment_mode))throw new Error('RECOVERY_SNAPSHOT_REQUIRED');
 if(!['canvas','scene_set','archive_frame'].includes(environment_mode))throw new Error('ASSET_ENVIRONMENT_MODE_INVALID');
 if(asset_needs.length&&(!catalogs.capabilityIndex||!catalogs.coverageMatrix))throw new Error('ASSET_CAPABILITY_CATALOG_MISSING');
 const resolvedCapabilities=asset_needs.map(need=>resolveAssetNeed(need,catalogs));
 const derivedAssetIds=resolvedCapabilities.filter(row=>['scene_set','visual_metaphor'].includes(row.kind)).map(row=>row.capability_id);
 const effectiveAssetIds=[...new Set([...selected_asset_ids,...derivedAssetIds])];
 const retired=new Set(policy.retired_asset_ids??[]);
 for(const id of effectiveAssetIds)if(retired.has(id))throw new Error('ASSET_RETIRED '+id);
 const extensions=policy.extensions??[],known=new Set([...(policy.core_ids??[]),...extensions.flatMap(x=>x.ids)]);
 const selected=new Set(effectiveAssetIds);
 const allowed=ext=>{
  if(ext.kind==='meme'&&!meme_selected)return false;
  if(Array.isArray(ext.availability)&&!ext.availability.includes(environment_mode))return false;
  return ext.ids.some(id=>selected.has(id));
 };
 const base={
  core_refs:[...policy.core_refs],
  extension_refs:[...new Set(extensions.filter(allowed).flatMap(x=>x.refs))],
  unresolved_ids:effectiveAssetIds.filter(id=>!known.has(id)),
 };
 if(!asset_needs.length)return base;
 return {...base,selected_asset_ids:effectiveAssetIds,resolved_capabilities:resolvedCapabilities,unresolved_needs:[]};
}
