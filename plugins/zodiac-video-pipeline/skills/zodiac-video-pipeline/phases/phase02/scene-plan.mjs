// Scene planning is authoring intent, not measured runtime segmentation.
// Legacy productions without scene_plan remain importable.
export function validateScenePlan(source, {required=false}={}) {
  const issues=[];
  const scenes=source?.scenes??[];
  const plan=source?.scene_plan;
  if(!plan) {
    if(required)issues.push({code:'SCENE_PLAN_MISSING',detail:'Author a narrative Scene Plan before compiling assets/events'});
    return {status:issues.length?'BLOCKED':'PASS',issues};
  }
  if(!Array.isArray(plan.scenes) || !plan.scenes.length) return {status:'BLOCKED',issues:[{code:'SCENE_PLAN_INVALID',detail:'scene_plan.scenes must be a nonempty ordered array'}]};
  const ids=scenes.map(s=>s.id),planned=plan.scenes.map(s=>s.id);
  if(JSON.stringify(ids)!==JSON.stringify(planned))issues.push({code:'SCENE_PLAN_DRIFT',detail:'Production scenes differ from planned scene boundaries/order'});
  if(new Set(planned).size!==planned.length)issues.push({code:'SCENE_PLAN_DUPLICATE',detail:'Scene IDs must be unique'});
  for(const [i,s] of plan.scenes.entries()){
    if(typeof s.purpose!=='string'||!s.purpose.trim())issues.push({code:'SCENE_PURPOSE_MISSING',scene_id:s.id});
    if(i>0&&(!s.transition_reason||!s.transition_reason.trim()))issues.push({code:'SCENE_TRANSITION_MISSING',scene_id:s.id});
    if(!Array.isArray(s.beats)||!s.beats.length||s.beats.some(b=>typeof b!=='string'||!b.trim()))issues.push({code:'SCENE_BEATS_MISSING',scene_id:s.id});
  }
  if(plan.scenes.length===1) {
    if(!plan.single_scene_rationale?.trim())issues.push({code:'SINGLE_SCENE_RATIONALE_MISSING',scene_id:planned[0]});
    if(plan.scenes[0].beats?.length>1&&!plan.continuous_visual_logic?.trim())
      issues.push({code:'SINGLE_SCENE_CONTINUITY_MISSING',scene_id:planned[0]});
  }
  return {status:issues.length?'BLOCKED':'PASS',issues};
}
