// Runs the narrative-visual kit lint over a production's authored SVGs. Form only, never content.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateNarrativeVisualKit} from './validate-narrative-visual-kit.mjs';
const validRect=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;
export const defaultCanvas={width:1080,height:1920};
/** @param {object} production @param {(assetPath:string)=>Promise<string|null>} readSvg returns null when the file is not authored yet */
export async function lintNarrativeVisualAssets(production,readSvg,{canvas=defaultCanvas}={}){
 const issues=[];
 for(const scene of production?.scenes??[]){
  const zone=scene.layout_contract?.caption_safe_zone;
  for(const entity of scene.entities??[]){
   if(entity.kind!=='narrative_visual')continue;
   for(const [stateId,state] of Object.entries(entity.states??{})){
    if(!state?.asset||state.visible===false)continue;
    const assetPath=production.assets?.[state.asset]?.path;
    if(!assetPath)continue;
    const svg=await readSvg(assetPath);
    if(svg==null)continue;
    const rect=state.transform??entity.transform;
    const options={canvas,captionSafeZone:validRect(zone)?zone:undefined,...(rect===undefined?{}:{rect})};
    for(const issue of validateNarrativeVisualKit(svg,options))issues.push({...issue,scene_id:scene.id,entity_id:entity.id,state_id:stateId});
   }
  }
 }
 return issues;
}
export const workspaceSvgReader=root=>async assetPath=>{
 const full=path.resolve(root,assetPath);
 if(!full.startsWith(path.resolve(root)+path.sep))return null;
 try{return await readFile(full,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}
};
