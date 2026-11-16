// Shared Phase-1 semantic contract; no workspace or native producer dependencies.
const meaningful=(value,min=12)=>typeof value==='string'&&value.trim().length>=min;
const issue=(issues,code,detail={})=>issues.push({code,...detail});

export function validateNarrativeVisualDecision(plan){
 const issues=[],visuals=plan?.narrative_visuals,decision=plan?.narrative_visual_decision;
 if(visuals!==undefined&&!Array.isArray(visuals))issue(issues,'NARRATIVE_VISUAL_DIRECTIONS_INVALID');
 const required=Array.isArray(visuals)&&visuals.length>0;
 if(!decision){if(!required)issue(issues,'NARRATIVE_VISUAL_PHASE1_DECISION_REQUIRED');}
 else {
  if(!meaningful(decision.reason))issue(issues,'NARRATIVE_VISUAL_PHASE1_DECISION_REASON_REQUIRED');
  if(decision.mode!==(required?'required':'omitted'))issue(issues,'NARRATIVE_VISUAL_PHASE1_DECISION_DRIFT');
 }
 return issues;
}

export function validateNarrativeVisualDirection(plan,{selectedCandidate=null}={}){
 const issues=validateNarrativeVisualDecision(plan);
 if(!plan||!['2.0','2.1'].includes(plan.version))issue(issues,'NARRATIVE_VISUAL_PLAN_VERSION');
 const visuals=Array.isArray(plan?.narrative_visuals)?plan.narrative_visuals:[];
 if(selectedCandidate&&selectedCandidate.id!==plan?.selected_concept_id)issue(issues,'NARRATIVE_VISUAL_CONCEPT_LINEAGE');
 const beats=new Map((plan.beats??[]).map(beat=>[beat.id,beat]));
 const allowedEvidence=new Set([
  ...(selectedCandidate?.evidence_refs??[]),
  ...(plan.beats??[]).flatMap(beat=>beat.evidence_refs??[])
 ]);
 const ids=new Set(),claimedBeats=new Map();
 for(const visual of visuals){
  const at=String(visual?.id??'unknown');
  if(!meaningful(visual?.id,2)||ids.has(visual.id))issue(issues,'NARRATIVE_VISUAL_ID_INVALID',{at});
  ids.add(visual?.id);
  for(const key of ['trait_basis','story_point','viewer_read','visible_action','visual_idea','concept_fit','centrality_reason','why_visual_not_text','tone_fit'])
   if(!meaningful(visual?.[key]))issue(issues,'NARRATIVE_VISUAL_FIELD_REQUIRED',{at,field:key});
  if(typeof visual?.visible_subject!=='string'||visual.visible_subject.trim().length<3)issue(issues,'NARRATIVE_VISUAL_FIELD_REQUIRED',{at,field:'visible_subject'});
  if(visual?.payoff_image!=null&&!meaningful(visual.payoff_image))issue(issues,'NARRATIVE_VISUAL_PAYOFF_INVALID',{at});
  if(!Array.isArray(visual?.beat_ids)||!visual.beat_ids.length)issue(issues,'NARRATIVE_VISUAL_BEATS_REQUIRED',{at});
  else for(const beatId of visual.beat_ids){
   if(!beats.has(beatId))issue(issues,'NARRATIVE_VISUAL_BEAT_UNKNOWN',{at,beat_id:beatId});
   const prior=claimedBeats.get(beatId);
   if(prior&&prior!==visual.id)issue(issues,'NARRATIVE_VISUAL_BEAT_OVERLAP',{at,beat_id:beatId,prior_visual_id:prior});
   else claimedBeats.set(beatId,visual.id);
  }
  if(!Array.isArray(visual?.evidence_refs)||!visual.evidence_refs.length)issue(issues,'NARRATIVE_VISUAL_EVIDENCE_REQUIRED',{at});
  else for(const ref of visual.evidence_refs)if(allowedEvidence.size&&!allowedEvidence.has(ref))issue(issues,'NARRATIVE_VISUAL_EVIDENCE_UNKNOWN',{at,evidence_ref:ref});
 }
 return {format:'zodiac-narrative-visual-direction-qc@2',status:issues.length?'BLOCKED':'PASS',visuals:visuals.length,issues,not_an_approval:true};
}
