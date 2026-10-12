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

function bindingApplies(binding,phase,step,{run_mode='fresh',environment_mode='archive_frame'}={}){
 if(binding?.phase!==phase)return false;
 if(!Array.isArray(binding.steps)||!binding.steps.includes(step))return false;
 if(Array.isArray(binding.run_modes)&&!binding.run_modes.includes(run_mode))return false;
 if(Array.isArray(binding.environment_modes)&&!binding.environment_modes.includes(environment_mode))return false;
 return true;
}

export function listCapabilities(){
 return loadRegistry().capabilities.map(item=>structuredClone(item));
}

export function resolveCapability(id){
 const item=loadRegistry().capabilities.find(candidate=>candidate.id===id);
 if(!item)throw new Error('CAPABILITY_UNKNOWN '+id);
 return structuredClone(item);
}

export function capabilitiesForStep(phase,step,context={}){
 return loadRegistry().capabilities
  .filter(item=>(item.bindings??[]).some(binding=>bindingApplies(binding,phase,step,context)))
  .map(item=>structuredClone(item));
}
