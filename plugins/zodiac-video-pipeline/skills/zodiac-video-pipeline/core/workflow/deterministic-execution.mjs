// Deterministic orchestration contract for existing native executor.
// Does not replace its leases, transactional checkpoints or approval gates.
export const PHASE02_DEPENDENCIES=Object.freeze({
 character_plan:['character_components'],
 character_write:['character_plan'],
 character_identity:['character_write'],
 outfit_bake:['character_identity'],
 environment:['outfit_bake'],
 environment_binding:['environment'],
 scene_direction:['environment_binding'],
 scene_set_identity:['scene_direction'],
 scene_accent_containment:['scene_set_identity'],
 scene_direction_validation:['scene_direction'],
 scene_events:['scene_direction_validation'],
 motion_consistency:['scene_events'],
 visual_quality:['motion_consistency'],
 publish_prep:['visual_quality'],
 director_final_review:['visual_quality']
});
export function validateStepGraph(steps, dependencies=PHASE02_DEPENDENCIES, {strictMissing=false}={}) {
 const issues=[],ids=new Set(),indices=new Map();
 for(const [index,step] of steps.entries()){
  if(typeof step.id!=='string'||!step.id||ids.has(step.id))issues.push({code:'WORKFLOW_STEP_DUPLICATE_OR_INVALID',step_id:step.id});
  if(!step.src||!Array.isArray(step.args)||!Array.isArray(step.required))issues.push({code:'WORKFLOW_STEP_CONTRACT_INVALID',step_id:step.id});
  ids.add(step.id);indices.set(step.id,index);
 }
 for(const step of steps)for(const dependency of dependencies[step.id]??[]){
  if(!ids.has(dependency)){
   if(strictMissing)issues.push({code:'WORKFLOW_DEPENDENCY_MISSING',step_id:step.id,dependency});
   continue;
  }
  if(indices.get(dependency)>=indices.get(step.id))issues.push({code:'WORKFLOW_DEPENDENCY_ORDER_INVALID',step_id:step.id,dependency});
 }
 return {status:issues.length?'BLOCKED':'PASS',issues,order:steps.map(s=>s.id)};
}
export function executionTrace(receipt) {
 return {format:'zodiac-native-execution-trace@1',run_id:receipt.run_id??null,
  source_fingerprint:receipt.source?.fingerprint??null,
  steps:(receipt.steps??[]).map(s=>({
   id:s.id,status:s.status,source_hash:s.source_hash??null,
   input_hash:s.input_hash??null,output_hash:s.output_hash??null,
   exit_code:s.exit_code??null,reason:s.reason??null
  })),
  issues:receipt.issues??[],status:receipt.status};
}

export const WORKFLOW_TRANSITIONS=Object.freeze({
 PENDING:['READY','BLOCKED'],
 READY:['RUNNING','SKIPPED_REUSED','BLOCKED'],
 RUNNING:['PASS','FAIL','BLOCKED'],
 FAIL:['READY','ESCALATED'],
 BLOCKED:['READY','ESCALATED'],
 PASS:[],SKIPPED_REUSED:[],ESCALATED:[]
});
export function transitionStepState(from,to,{approval=false}={}) {
 if(approval)throw Error('WORKFLOW_APPROVAL_FORBIDDEN');
 if(!(WORKFLOW_TRANSITIONS[from]??[]).includes(to))
  throw Error('WORKFLOW_TRANSITION_INVALID '+from+' -> '+to);
 return to;
}
export function createRepairPlan(issues,{attempt=0,maxAttempts=1}={}) {
 if(!Number.isInteger(attempt)||!Number.isInteger(maxAttempts)||attempt<0||maxAttempts<0)
  throw Error('WORKFLOW_RETRY_BUDGET_INVALID');
 const deterministic=/^(WORKSPACE_|SOURCE_|ASSET_|CONTRACT_|SCENE_PLAN_|SPATIAL_|VISUAL_ROLE_|JOB_V5_)/;
 const classified=(issues??[]).map(issue=>{
  const code=String(issue.code??'UNKNOWN');
  const owner=deterministic.test(code)?'producer_or_runner':'review_or_environment';
  return {code,owner,action:owner==='producer_or_runner'?'repair_inputs_or_contract':'escalate_for_review',step:issue.step??null};
 });
 const safeToRetry=classified.length>0&&classified.every(x=>x.owner==='producer_or_runner')&&attempt<maxAttempts;
 return {format:'zodiac-workflow-repair-plan@1',attempt,max_attempts:maxAttempts,
   decision:safeToRetry?'REPAIR_THEN_RETRY':'ESCALATE',
   repairs:classified,no_approval_created:true};
}
