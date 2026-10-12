// Static same-anchor conflicts only. Measured timing remains runner-owned.
export function validateAnchorLanes(ir, token) {
 const issues=[];
 for(const scene of ir.scenes??[]) {
  const lanes=new Map();
  for(const event of scene.events??[]) {
   const t=event.trigger;
   if(!['voice_anchor','scene_start'].includes(t?.type))continue;
   const key=JSON.stringify([event.target,t.type,t.text??null,t.occurrence??1,t.offset_frames??0]);
   const profile=token.motion_defaults?.[event.desired_motion];
   const ctx=scene.performance_context??{};
   const ms=ctx.transition_duration_ms||ctx.motion_duration_ms||profile?.duration_ms;
   const duration=ms?Math.max(1,Math.round(ms*({slow:1.15,medium:1,fast:.85}[ctx.pace??'medium'])*(ir.video?.fps??24)/1000)):profile?.duration_frames;
   if(!Number.isInteger(duration)||duration<1)continue;
   const prior=lanes.get(key);
   if(prior) {
    const merge=event.scheduling?.merge_policy==='same_intent_same_state'&&['intent','state_before','state_after','desired_motion','target'].every(k=>prior.event[k]===event[k]);
    if(merge){prior.end=Math.max(prior.end,duration);continue;}
    if(prior.end>(event.scheduling?.max_drift_frames??0))issues.push({scene_id:scene.id,event_id:event.id,target:event.target,prior_event_id:prior.event.id,required_drift_frames:prior.end,max_drift_frames:event.scheduling?.max_drift_frames??0});
   }
   lanes.set(key,{event,end:(prior?.end??0)+duration});
  }
 }
 return {status:issues.length?'BLOCKED':'PASS',issues,measured_timing_verified:false};
}
