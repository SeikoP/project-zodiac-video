const upstream=/^(WORKSPACE_|SOURCE_|SCENE_PLAN_|CONTRACT_|ASSET_|NARRATION_|PHASE02_|VISUAL_INTENT_)/u;
const creative=/^(CONTENT_REVIEW_|VISUAL_REVIEW_|CREATIVE_|USER_APPROVAL_)/u;
const ownerByPrefix=[
 [/^(CHARACTER_|OUTFIT_|HAIR_)/u,'visual_intent.cast'],
 [/^(NARRATIVE_VISUAL_|STORY_OBJECT_)/u,'visual_intent.narrative_visual'],
 [/^(SCENE_|SPATIAL_|COMPOSITION_)/u,'visual_intent.scenes'],
 [/^(PROP_|ASSET_)/u,'visual_intent.assets'],
 [/^(PUBLISH_)/u,'publish'],
 [/^(NARRATION_|EVIDENCE_|CONCEPT_)/u,'phase01_content'],
 [/^(WORKSPACE_|SOURCE_|CONTRACT_|PHASE02_|VISUAL_INTENT_)/u,'workspace_contract']
];
export function planBatchRepair(issues=[],{upstreamReady=true}={}){
 const groups=new Map(),escalate=[];
 for(const issue of issues){
  const code=String(issue?.code??'UNKNOWN');const owner=ownerByPrefix.find(([pattern])=>pattern.test(code))?.[1]??null;
  if(!upstreamReady||creative.test(code)||!owner){escalate.push({code,reason:!upstreamReady?'UPSTREAM_BLOCKED':creative.test(code)?'HUMAN_REVIEW_REQUIRED':'UNKNOWN_OWNER'});continue;}
  const key=owner+':'+String(issue.scene_id??issue.scene??'global');
  if(!groups.has(key))groups.set(key,{owner,scene_id:issue.scene_id??issue.scene??null,issues:[]});
  groups.get(key).issues.push({...issue,code});
 }
 return {format:'zodiac-batch-repair-plan@1',decision:escalate.length?'REVIEW_REQUIRED':'REPAIR_CAN_BE_GROUPED',groups:[...groups.values()],escalate,requires_revalidation:true,source_of_truth_only:true,no_automatic_approval:true};
}
