// Editorial choices stay explicit without imposing arbitrary creative quotas.
export function assertPremiseSelection(c){
 if(!Array.isArray(c?.candidates)||!c.candidates.length)throw Error('CONCEPT_CANDIDATES_REQUIRED');
 if(c.candidates.length===1&&c.selection_mode!=='user_selected')throw Error('CONCEPT_SINGLE_REQUIRES_USER_SELECTION');
 const ids=c.candidates.map(x=>x.id),remaining=ids.filter(id=>id!==c.selected_candidate_id);
 if(!ids.includes(c.selected_candidate_id)||typeof c.selection_rationale!=='string'||!c.selection_rationale.trim()||!Array.isArray(c.rejected_or_reserved_ids)||new Set(c.rejected_or_reserved_ids).size!==remaining.length||c.rejected_or_reserved_ids.length!==remaining.length||remaining.some(id=>!c.rejected_or_reserved_ids.includes(id)))throw Error('CONCEPT_SELECTION_INCOMPLETE');
}
export function assertViralDecision(v){
 if(!Array.isArray(v?.mechanics))throw Error('VIRAL_MECHANICS_REQUIRED');
 if(!v.mechanics.length&&(v.decision?.mode!=='omitted'||typeof v.decision.reason!=='string'||!v.decision.reason.trim()))throw Error('VIRAL_OMISSION_REASON_REQUIRED');
}
