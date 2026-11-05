#!/usr/bin/env node
// One child process per scene; reads immutable input and writes only its isolated output.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProduction} from '../../references/asset-library-v4/scene-direction/compile-scene-direction-core.mjs';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){try{
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('SCENE_NATIVE_WORKER_ARGS_REQUIRED');
 const source=JSON.parse(await readFile(input,'utf8'));
 if(source?.scenes?.length!==1)throw Error('SCENE_NATIVE_WORKER_SINGLE_SCENE_REQUIRED');
 const workspace=path.resolve(path.dirname(input),'../../..');
 const result=await compileProduction(source,{root:workspace});
 await writeFile(output,JSON.stringify(result));
 }catch(e){console.error(e.stack??e.message);process.exitCode=2;}}
