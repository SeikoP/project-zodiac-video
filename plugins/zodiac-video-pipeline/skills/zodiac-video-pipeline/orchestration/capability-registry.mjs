import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const orchestrationDir=path.dirname(fileURLToPath(import.meta.url));
const skillRoot=path.resolve(orchestrationDir,'..');
const registryPath=path.join(skillRoot,'bootstrap','capabilities.json');

function loadRegistry(){
 const registry=JSON.parse(readFileSync(registryPath,'utf8'));
 if(registry?.format!=='zodiac-capability-registry@1'||!Array.isArray(registry.capabilities)){
  throw new Error('CAPABILITY_REGISTRY_INVALID');
 }
 return registry;
}

export function listCapabilities(){
 return loadRegistry().capabilities.map(item=>structuredClone(item));
}

export function resolveCapability(id){
 const item=loadRegistry().capabilities.find(candidate=>candidate.id===id);
 if(!item)throw new Error('CAPABILITY_UNKNOWN '+id);
 return structuredClone(item);
}
