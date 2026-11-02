// Narrative-visual brief: the author states the claim, anchor and state change before drawing. Pure; no I/O.
const text=x=>typeof x==='string'&&x.trim().length>0;
export const narrativeBriefFormat='zodiac-narrative-brief@1';
export function validateNarrativeBrief(scene,brief){
 const issues=[],add=(code,detail={})=>issues.push({code,scene_id:scene?.id,...detail});
 if(!brief){add('NARRATIVE_BRIEF_REQUIRED');return issues;}
 if(brief.format!==narrativeBriefFormat){add('NARRATIVE_BRIEF_FORMAT_INVALID');return issues;}
 const voice=String(scene?.voice??'');
 if(!text(brief.claim))add('NARRATIVE_BRIEF_CLAIM_MISSING');
 if(!text(brief.anchor_phrase)||!voice.includes(brief.anchor_phrase))add('NARRATIVE_BRIEF_ANCHOR_NOT_IN_VOICE',{anchor_phrase:brief.anchor_phrase});
 const changes=brief.state_changes;
 if(!Array.isArray(changes)||!changes.length){add('NARRATIVE_BRIEF_STATE_CHANGE_MISSING');return issues;}
 const events=new Set((scene?.events??[]).map(e=>e.id));
 for(const [i,c] of changes.entries()){
  if(!text(c?.from)||!text(c?.to)||c.from.trim()===c.to.trim())add('NARRATIVE_BRIEF_STATE_CHANGE_INVALID',{index:i});
  if(!text(c?.anchor_phrase)||!voice.includes(c.anchor_phrase))add('NARRATIVE_BRIEF_CHANGE_ANCHOR_NOT_IN_VOICE',{index:i});
  if(c?.event_id!==undefined&&!events.has(c.event_id))add('NARRATIVE_BRIEF_EVENT_UNKNOWN',{index:i,event_id:c.event_id});
 }
 return issues;
}
