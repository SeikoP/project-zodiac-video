import {normalizeMotion,assertRegistryRunnerSupport} from './normalize-motion.mjs';

// Fail closed until the runner exposes event-level durations. Merely renaming
// state_swap_8f to state_swap would silently lose the timing semantics.
export const RUNNER_201_MOTIONS=Object.freeze(['state_swap','hold','pop-in','fade-in','fade-out','subtle-tilt','small-bounce','focus-shift','slide']);
export function validateRunnerMotionBoundary(ir,{runnerMotions=RUNNER_201_MOTIONS}={}){
  assertRegistryRunnerSupport(runnerMotions);
  const issues=[];
  const entries=new Map();
  for(const scene of ir?.scenes??[]){
    for(const event of scene.events??[]){
      try{
        const normalized=normalizeMotion(event.desired_motion);
        if(!runnerMotions.includes(normalized.motion))throw new Error('RUNNER_MOTION_UNSUPPORTED');
        const key=normalized.motion;
        if(!entries.has(key))entries.set(key,new Set());
        entries.get(key).add(normalized.duration_frames);
        if(event.desired_motion!==normalized.motion){
          issues.push({code:'RUNNER_MOTION_ALIAS_UNSUPPORTED',scene_id:scene.id,event_id:event.id,motion:event.desired_motion,normalized_motion:normalized.motion,detail:'Renderer 2.0.1 has no event-duration field; cannot lower preset alias losslessly'});
        }
      }catch(error){issues.push({code:'UNSUPPORTED_MOTION',scene_id:scene.id,event_id:event.id,detail:String(error.message)});}
    }
  }
  return {ok:issues.length===0,issues,normalized_durations:Object.fromEntries([...entries].map(([k,v])=>[k,[...v].sort((a,b)=>a-b)]))};
}
