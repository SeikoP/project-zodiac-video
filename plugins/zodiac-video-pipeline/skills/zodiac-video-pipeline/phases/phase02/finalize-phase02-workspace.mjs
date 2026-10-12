import {readFile,mkdir,rename,access,lstat} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {validateNativePairPreview} from '../../features/visual-composition/validate-native-preview-pairs.mjs';
import {compositionHash} from '../../features/visual-composition/phase02-composition.mjs';
const exists=p=>access(p).then(()=>true,()=>false);
export async function finalizePhase02Workspace(root,{write=false}={}){
 root=path.resolve(root);const raw=await readFile(path.join(root,'production.json')),tag=createHash('sha256').update(raw).digest('hex').slice(0,16),stale=[];
 const preview='.authoring/preview-pairs';if(await exists(path.join(root,preview,'preview-report.json'))){try{await validateNativePairPreview(root)}catch(e){if(!/stale|drift|modified preview|ENOENT/i.test(e.message))throw e;stale.push({path:preview,reason:e.message});}}
 const resolved='.authoring/scene-composition-resolved.json';if(await exists(path.join(root,resolved))){const r=JSON.parse(await readFile(path.join(root,resolved)));if(r.source_sha256!==compositionHash(JSON.parse(raw)))stale.push({path:resolved,reason:'RESOLVED_COMPOSITION_STALE'});}
 const superseded=[];for(const item of stale){const src=path.join(root,item.path);if((await lstat(src)).isSymbolicLink())throw Error('FINALIZER_SYMLINK_REFUSED');let destination='.authoring/superseded/'+tag+'/'+path.basename(item.path);if(await exists(path.join(root,destination)))destination='.authoring/superseded/'+tag+'-'+Date.now()+'/'+path.basename(item.path);if(write){await mkdir(path.dirname(path.join(root,destination)),{recursive:true});await rename(src,path.join(root,destination));}superseded.push({...item,destination});}
 return {format:'zodiac-phase02-finalizer@1',mode:write?'write':'inspect',superseded,creative_status:'CREATIVE_REVIEW_REQUIRED',runtime_status:'RUNTIME_QA_PENDING',approval_state_unchanged:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await finalizePhase02Workspace(process.argv[2],{write:process.argv.includes('--write')}),null,2));
