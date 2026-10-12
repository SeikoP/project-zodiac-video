#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileSceneSetWorkspace} from '../scene-set/compile-scene-set.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=m=>{throw Error('ENVIRONMENT_COMPILE_INVALID: '+m);};
export const isBackgroundCue=id=>!/(?:^|[-_])(?:desk|table|bed|headboard|pillow|blanket|sofa|chair|counter|cabinet|bookshelf)(?:[-_]|$)/iu.test(String(id));
export const backgroundOnlyRoles=roles=>Object.fromEntries(Object.entries(roles).map(([k,ids])=>[k,ids.filter(isBackgroundCue)]));
export function materializeEnvironment(production){
 if(production?.version!=='2.0')fail('production.version must be 2.0');
 for(const scene of production.scenes??[])if(scene.environment?.profile)fail('RECOVERY_SNAPSHOT_REQUIRED '+scene.id);
 return structuredClone(production);
}
export async function compileEnvironmentWorkspace(root,{libraryRoot=here,write=true}={}){
 if(path.resolve(libraryRoot)!==here)fail('RECOVERY_SNAPSHOT_REQUIRED');
 const source=materializeEnvironment(JSON.parse(await readFile(path.join(root,'production.json'))));
 const native=await compileSceneSetWorkspace(root,{production:source,write:false}),out=native.production;
 const scenes=native.receipt.selected??native.receipt.scenes??[];
 const receipt={format:'zodiac-environment-compile-receipt@1',scenes,signature:createHash('sha256').update(JSON.stringify(scenes)).digest('hex')};
 if(write){
  for(const [rel,bytes] of Object.entries(native.files)){await mkdir(path.dirname(path.join(root,rel)),{recursive:true});await writeFile(path.join(root,rel),bytes);}
  await mkdir(path.join(root,'.authoring'),{recursive:true});
  await writeFile(path.join(root,'.authoring/scene-set-compile-receipt.json'),JSON.stringify(native.receipt,null,2)+'\n');
  await writeFile(path.join(root,'.authoring/environment-compile-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await writeFile(path.join(root,'production.json'),JSON.stringify(out,null,2)+'\n');
 }
 return {production:out,receipt};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--write')&&!process.argv.includes('--transaction-stage')){
  const {runGeneratedCompile}=await import('../../../orchestration/generated-asset-ownership.mjs');
  const r=await runGeneratedCompile(path.resolve(process.argv[2]),fileURLToPath(import.meta.url),process.argv.slice(2),{compiler_id:'environment',prune:process.argv.includes('--prune-generated')});process.stdout.write(r.stdout??'');
 }else{
  const root=process.argv[2];if(!root)throw Error('workspace required');
  if(process.argv.includes('--library-root'))fail('RECOVERY_SNAPSHOT_REQUIRED');
  console.log(JSON.stringify(await compileEnvironmentWorkspace(path.resolve(root),{write:process.argv.includes('--write')})));
 }
}
