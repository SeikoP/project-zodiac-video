export function selectAssetGuidance({selected_asset_ids=[],meme_selected=false,environment_mode='legacy'},policy){
 if(!['archive_frame','selected_cues','legacy'].includes(environment_mode))throw new Error('ASSET_ENVIRONMENT_MODE_INVALID');
 const extensions=policy.extensions??[],known=new Set([...(policy.core_ids??[]),...(policy.compatibility_ids??[]),...extensions.flatMap(x=>x.ids)]);
 const selected=new Set(selected_asset_ids);return {core_refs:[...policy.core_refs],extension_refs:[...new Set(extensions.filter(x=>x.ids.some(id=>selected.has(id))&&(x.kind!=='meme'||meme_selected)).flatMap(x=>x.refs))],unresolved_ids:selected_asset_ids.filter(id=>!known.has(id))};
}
