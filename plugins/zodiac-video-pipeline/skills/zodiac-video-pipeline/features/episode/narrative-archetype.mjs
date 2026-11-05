const fail=code=>{throw new Error('NARRATIVE_ARCHETYPE_INVALID '+code);};
const text=(v,k,min=6)=>{if(typeof v!=='string'||v.trim().length<min)fail(k);return v.trim();};
const modeId=v=>{const s=String(v??'').trim();if(!/^[a-z0-9][a-z0-9_-]{2,48}$/.test(s))fail('mode_id');return s;};
const forbiddenAudienceKeys=new Set(['comments','raw_comments','comment_text','raw_text','usernames','handles','user_ids','authors','profiles']);
function assertNoRawAudienceFields(value,path='audience_evidence'){
 if(!value||typeof value!=='object')return;
 for(const [k,v] of Object.entries(value)){
  if(forbiddenAudienceKeys.has(k))fail('raw audience feedback forbidden at '+path+'.'+k);
  if(v&&typeof v==='object')assertNoRawAudienceFields(v,path+'.'+k);
 }
}
function stringArray(v,k,{min=1,max=6,minLen=6}={}){
 if(!Array.isArray(v)||v.length<min||v.length>max)fail(k);
 return v.map((x,i)=>text(x,k+'.'+i,minLen));
}
function norm(s){
 return String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
}
function includesLabel(spoken,label){
 return spoken===label||spoken.startsWith(label+' ')||spoken.endsWith(' '+label)||spoken.includes(' '+label+' ');
}

export function assertNarrativeArchetype(value){
 if(value?.format!=='zodiac-narrative-archetype@1')fail('format');
 const mode=modeId(value.mode_id);
 if(!['story_mechanics','audience_emergent','hybrid'].includes(value.selection_basis))fail('selection_basis');
 stringArray(value.behavior_mechanics,'behavior_mechanics',{min:2,max:6,minLen:8});
 stringArray(value.visual_grammar,'visual_grammar',{min:1,max:6,minLen:6});
 const vi=value.viewer_inference;
 if(!vi||typeof vi!=='object')fail('viewer_inference');
 text(vi.target_label,'viewer_inference.target_label',3);
 if(!Array.isArray(vi.aliases)||vi.aliases.length>5||vi.aliases.some(x=>typeof x!=='string'||x.trim().length<3))fail('viewer_inference.aliases');
 if(vi.explicitness!=='implicit')fail('viewer_inference.explicitness');
 text(vi.comment_affordance,'viewer_inference.comment_affordance',12);

 const audienceNeeded=value.selection_basis!=='story_mechanics';
 if(audienceNeeded){
  const a=value.audience_evidence;
  if(!a||typeof a!=='object')fail('audience_evidence');
  assertNoRawAudienceFields(a);
  if(!['viewer_comments','user_reported_viewer_feedback','analytics_summary'].includes(a.source_kind))fail('audience_evidence.source_kind');
  if(modeId(a.normalized_mode_id)!==mode)fail('audience_evidence.normalized_mode_id');
  if(!['qualitative','observed','repeated'].includes(a.signal_strength))fail('audience_evidence.signal_strength');
  if(a.not_zodiac_claim_evidence!==true)fail('audience_evidence.not_zodiac_claim_evidence');
 }else if(value.audience_evidence!=null){
  fail('audience_evidence requires audience_emergent or hybrid selection_basis');
 }

 if(value.recent_mode_ids!=null){
  if(!Array.isArray(value.recent_mode_ids)||value.recent_mode_ids.length>3)fail('recent_mode_ids');
  for(const id of value.recent_mode_ids)modeId(id);
  if(value.recent_mode_ids.includes(mode)&&!(typeof value.repeat_reason==='string'&&value.repeat_reason.trim().length>=20))fail('repeat_reason');
 }
 if(value.repeat_reason!=null&&typeof value.repeat_reason!=='string')fail('repeat_reason');
 return value;
}

export function compileNarrativeArchetypeDirection(value){
 const a=assertNarrativeArchetype(value);
 const labels=[a.viewer_inference.target_label,...a.viewer_inference.aliases].map(x=>x.trim()).filter((x,i,arr)=>arr.findIndex(y=>norm(y)===norm(x))===i);
 return {
  mode_id:a.mode_id,
  behavior_mechanics:[...a.behavior_mechanics],
  visual_grammar:[...a.visual_grammar],
  viewer_inference_target:a.viewer_inference.target_label,
  do_not_say_labels:labels,
  comment_affordance:a.viewer_inference.comment_affordance,
  audience_resonance_used:a.selection_basis!=='story_mechanics',
  ...(a.repeat_reason?{repeat_reason:a.repeat_reason.trim()}:{})
 };
}

export function assertImplicitArchetypeLabel(value,narrationRaw){
 const a=assertNarrativeArchetype(value),spoken=norm(narrationRaw);
 const labels=[a.viewer_inference.target_label,...a.viewer_inference.aliases].map(norm).filter(Boolean);
 for(const label of labels)if(includesLabel(spoken,label))throw new Error('NARRATIVE_ARCHETYPE_LABEL_LEAK '+label);
 return true;
}
