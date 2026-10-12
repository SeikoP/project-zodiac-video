const MODES=new Set(['required','optional','omitted']);
const issue=(issues,code,at='')=>issues.push({code,at});
const meaningful=v=>typeof v==='string'&&v.trim().length>0;
const signature=state=>state?.signature??JSON.stringify(Object.fromEntries(Object.entries(state??{}).filter(([k])=>k!=='visual_read')));

export function validateVisualMetaphorPlan(plan){
 const issues=[];
 if(plan?.format!=='zodiac-visual-metaphor-plan@1')issue(issues,'VISUAL_METAPHOR_FORMAT_INVALID');
 const decision=plan?.decision;
 if(!decision||!MODES.has(decision.mode)||!meaningful(decision.reason))issue(issues,'VISUAL_METAPHOR_DECISION_INVALID');
 if(decision?.mode==='omitted'){
  if((plan?.metaphors??[]).length)issue(issues,'VISUAL_METAPHOR_OMITTED_WITH_CONTENT');
  return {format:'zodiac-visual-metaphor-qc@1',status:issues.length?'BLOCKED':'OMITTED_EXPLICIT',metaphors:0,issues};
 }
 const metaphors=Array.isArray(plan?.metaphors)?plan.metaphors:[];
 if(decision?.mode==='required'&&!metaphors.length)issue(issues,'VISUAL_METAPHOR_REQUIRED_MISSING');
 const ids=new Set();
 for(const metaphor of metaphors){
  const at=String(metaphor?.id??'unknown');
  if(!meaningful(metaphor?.id)||ids.has(metaphor.id))issue(issues,'VISUAL_METAPHOR_ID_INVALID',at);
  ids.add(metaphor?.id);
  if(!meaningful(metaphor?.meaning))issue(issues,'VISUAL_METAPHOR_MEANING_MISSING',at);
  const states=metaphor?.visual_states&&typeof metaphor.visual_states==='object'?metaphor.visual_states:{};
  const cues=Array.isArray(metaphor?.cues)?metaphor.cues:[];
  if(!Object.keys(states).length)issue(issues,'VISUAL_METAPHOR_STATES_MISSING',at);
  if(!cues.length)issue(issues,'VISUAL_METAPHOR_CUES_MISSING',at);
  const used=new Set();
  for(const cue of cues){
   if(!meaningful(cue?.scene_id)||!meaningful(cue?.voice_anchor))issue(issues,'VISUAL_METAPHOR_CUE_INVALID',at);
   if(!Object.hasOwn(states,cue?.state))issue(issues,'VISUAL_METAPHOR_STATE_UNKNOWN',at+'/'+String(cue?.state));
   else used.add(cue.state);
   if(cue?.relation?.mode==='environment'||cue?.relation?.mode==='background')issue(issues,'VISUAL_METAPHOR_ENVIRONMENT_RELATION_INVALID',at);
  }
  const seen=new Map();
  for(const name of used){
   const sig=signature(states[name]);
   if(seen.has(sig))issue(issues,'VISUAL_METAPHOR_STATE_DUPLICATE',at+'/'+seen.get(sig)+'/'+name);
   else seen.set(sig,name);
  }
 }
 return {format:'zodiac-visual-metaphor-qc@1',status:issues.length?'BLOCKED':'PASS',metaphors:metaphors.length,issues};
}
