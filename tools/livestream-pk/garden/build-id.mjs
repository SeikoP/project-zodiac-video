import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Include code whose changes affect what the viewer sees or what gameplay awards.
export const GARDEN_BUILD_FILES = Object.freeze([
  'garden/server.mjs','garden/garden.mjs','garden/camera.mjs',
  'garden/hearts.mjs','garden/gifts.mjs','garden/boss.mjs',
  'garden/events.mjs','garden/config.mjs','garden/displays.mjs',
  'public/garden/garden.js','public/garden/view.js',
  'public/garden/presentation.js','public/garden/audio.js',
  'public/garden/garden.css','public/garden/index.html',
  'public/garden/control.js','public/garden/control.html',
]);
// Resolve transitive local ESM imports so newly added modules change build identity too.
export function buildRuntimeFiles(root){
 const result=new Set(),pending=[...GARDEN_BUILD_FILES];
 while(pending.length){
  const name=pending.pop().replaceAll('\\','/');
  if(result.has(name))continue;
  const full=path.resolve(root,name);
  if(!fs.existsSync(full))throw new Error(`Missing Garden runtime dependency: ${name}`);
  result.add(name);
  if(!/\.(?:mjs|js|cjs)$/.test(name))continue;
  const source=fs.readFileSync(full,'utf8');
  const imports=/(?:\b(?:import|export)\s+(?:[^;\r\n]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  for(const match of source.matchAll(imports)){
   const spec=match[1]??match[2];if(!spec.startsWith('.'))continue;
   const dest=path.resolve(path.dirname(full),spec),relative=path.relative(root,dest).replaceAll('\\','/');
   if(relative.startsWith('..')||path.isAbsolute(relative))continue;
   pending.push(relative);
  }
 }
 return [...result].sort();
}
export function buildFingerprint(root){
 const hash=createHash('sha256');
 for(const name of buildRuntimeFiles(root)){hash.update(name);hash.update(fs.readFileSync(path.join(root,name)));}
 return hash.digest('hex').slice(0,12);
}
// Cheap preflight signal: this process loaded a previous source revision.
export function runtimeSourceChanged(root,startedAt,files=buildRuntimeFiles(root)){
 return files.some(name=>fs.statSync(path.join(root,name)).mtimeMs > startedAt);
}