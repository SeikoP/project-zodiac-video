import {readFile} from 'node:fs/promises';
import path from 'node:path';

const load=async file=>JSON.parse(await readFile(file,'utf8'));
export function isCurrentVisualState(state,{intent=null,artDirection=null}={}){
 return state?.run_mode==='fresh'||intent?.format==='zodiac-visual-intent@1'||artDirection?.composition_stage==='intent';
}
export async function isCurrentVisualWorkspace(root,state=null){
 root=path.resolve(root);
 if(state?.run_mode==='fresh')return true;
 let intent=null,artDirection=null;
 try{intent=await load(path.join(root,'.authoring/visual-intent.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 try{artDirection=await load(path.join(root,'.authoring/scene-art-direction.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
 return isCurrentVisualState(state,{intent,artDirection});
}
