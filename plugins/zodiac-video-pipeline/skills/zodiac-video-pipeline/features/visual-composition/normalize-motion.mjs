import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync(new URL('../../contracts/motion-registry-v1.json',import.meta.url),'utf8'));
export function normalizeMotion(name, parameters={}){
 if(typeof name!=='string')throw new Error('UNSUPPORTED_MOTION:'+String(name));
 const match=/^(state_swap)_(\d+)f$/.exec(name);
 const base=match?match[1]:name;
 const spec=registry.motions[base];
 if(!spec)throw new Error('UNSUPPORTED_MOTION:'+name);
 const duration=parameters.duration_frames??(match?Number(match[2]):spec.default_duration_frames);
 if(!Number.isInteger(duration)||duration<1||duration>300)throw new Error('MOTION_DURATION_INVALID:'+name);
 return {motion:spec.renderer_motion,duration_frames:duration,supported:true,source_motion:name};
}
export function assertRegistryRunnerSupport(allowed){
 const missing=Object.values(registry.motions).map(v=>v.renderer_motion).filter(x=>!allowed.includes(x));
 if(missing.length)throw new Error('MOTION_REGISTRY_RUNNER_MISMATCH:'+missing.join(','));
 return true;
}
