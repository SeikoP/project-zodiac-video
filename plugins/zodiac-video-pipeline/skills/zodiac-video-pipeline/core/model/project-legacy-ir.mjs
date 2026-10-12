import {isDeepStrictEqual} from 'node:util';
export function projectLegacyIR(model){
 const ir={format:model.source.legacy_format,fps:model.source.legacy_fps,video:model.source.legacy_video,assets:model.assets,scenes:model.scenes.map(s=>{
  const {actions,...rest}=s;
  return {...rest,events:actions.map(a=>({id:a.id,target:a.target,intent:a.intent,trigger:a.trigger,state_before:a.states.before,state_after:a.states.after,desired_motion:a.motion.source_motion,scheduling:a.scheduling}))};
 })};
 return ir;
}
export function assertRoundTrip(original,restored){
 if(!isDeepStrictEqual(original,restored)){
  const issues=[];
  for(const key of ['format','fps','video','assets'])if(!isDeepStrictEqual(original[key],restored[key]))issues.push(key);
  if(original.scenes.length!==restored.scenes.length)issues.push('scene_count');
  else for(let i=0;i<original.scenes.length;i++)if(!isDeepStrictEqual(original.scenes[i],restored.scenes[i]))issues.push(original.scenes[i].id);
  throw new Error('LEGACY_ROUNDTRIP_DRIFT:'+issues.join(','));
 }
 return true;
}
