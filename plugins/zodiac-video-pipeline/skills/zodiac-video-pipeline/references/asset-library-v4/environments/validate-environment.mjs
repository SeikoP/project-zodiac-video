#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function validateEnvironmentProfile(){
 const registry=JSON.parse(await readFile(new URL('../scene-set/index.json',import.meta.url)));
 if(!registry.scene_sets?.length)throw Error('CURRENT_SCENE_SET_CATALOG_MISSING');
 return {scene_sets:registry.scene_sets.length,structural_assets:0};
}
export const validateBedroomEnvironment=validateEnvironmentProfile;
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await validateEnvironmentProfile()));
