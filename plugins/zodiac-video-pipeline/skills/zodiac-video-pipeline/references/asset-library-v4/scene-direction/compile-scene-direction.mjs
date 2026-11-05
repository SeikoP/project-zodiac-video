#!/usr/bin/env node
// Compatibility entrypoint: same compileProduction export and receipt as v1;
// --write now isolates each scene in a worker and publishes one aggregate.
import {stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProduction} from './compile-scene-direction-core.mjs';
import {compileIsolatedScenes} from '../../../features/scene-production/native-scene-executor.mjs';
export {compileProduction};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){try{
 const arg=process.argv[2];if(!arg)throw Error('Usage: compile-scene-direction.mjs <package-root|production.json> [--write]');
 const abs=path.resolve(arg),st=await stat(abs),root=st.isDirectory()?abs:path.dirname(abs);
 if(process.argv.includes('--write')){
  if(!st.isDirectory()&&path.basename(abs)!=='production.json')throw Error('SCENE_DIRECTION_INPUT_NAME_INVALID');
  const nidx=process.argv.indexOf('--max-concurrency'),concurrency=nidx<0?3:Number(process.argv[nidx+1]);
  const result=await compileIsolatedScenes(root,{maxConcurrency:concurrency});
  console.log(`SCENE_DIRECTION_COMPILE_PASS: scenes=${result.scene_count} compiled=${result.compiled.length} reused=${result.reused.length} receipt=${path.relative(root,result.receipt)}`);
 }else{
  const production=JSON.parse(await readFile(st.isDirectory()?path.join(root,'production.json'):abs,'utf8'));
  console.log(JSON.stringify(await compileProduction(production,{root}),null,2));
 }
}catch(e){console.error('SCENE_DIRECTION_COMPILE_INVALID: '+e.message);process.exitCode=2;}}
