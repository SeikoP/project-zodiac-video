// A character is authored from its script role and performed actions BEFORE
// picking any V4 library components. v1 plans are retained for legacy jobs.
const fail=(code,detail='')=>{throw new Error(code+(detail?' '+detail:''));};
const meaningful=s=>typeof s==='string'&&s.trim().length>=18;
export function validateCharacterDesignIntent(production,plan,{requireV2=false}={}){
 const version=plan?.format;
 if(!['zodiac-character-assembly-plan@1','zodiac-character-assembly-plan@2'].includes(version))fail('CHARACTER_PLAN_FORMAT_INVALID');
 if(requireV2&&version!=='zodiac-character-assembly-plan@2')fail('CHARACTER_INTENT_V2_REQUIRED');
 if(version==='zodiac-character-assembly-plan@1')return {legacy:true};
 const sceneMap=new Map((production?.scenes??[]).map(s=>[s.id,s]));
 for(const spec of plan.characters??[]){
  const id=spec.entity_id,design=spec.design_intent;
  if(!design||typeof design!=='object')fail('CHARACTER_INTENT_MISSING',id);
  const visual=spec.visual_identity_intent;
  if(visual){
   if(visual.role!==design.role||visual.reference_entity_id&&visual.reference_entity_id!==id)fail('CHARACTER_REFERENCE_SCOPE',id);
   if(typeof visual.silhouette_priority!=='string'||!visual.silhouette_priority.trim()||typeof visual.reference_notes!=='string'||!visual.reference_notes.trim())fail('CHARACTER_VISUAL_INTENT_INVALID',id);
   for(const [field,value] of Object.entries(visual.identity_lock??{}))if(!['body_profile','hair_id','face_profile_id','outfit_id','shirt_color_id','accessory_id'].includes(field)||spec[field]!==value)fail('CHARACTER_IDENTITY_LOCK',id+'/'+field);
  }
  if(design.selection_basis!=='story_first')fail('CHARACTER_INTENT_STORY_FIRST_REQUIRED',id);
  if(!['lead','support'].includes(design.role)||!meaningful(design.identity_tension)||!meaningful(design.audience_read))fail('CHARACTER_INTENT_ROLE_MISSING',id);
  for(const field of ['body_profile','hair_id','shirt_color_id']){
   if(!meaningful(design.decision_reasons?.[field]))fail('CHARACTER_INTENT_CHOICE_REASON_MISSING',`${id}/${field}`);
  }
  if(design.role==='lead'&&!spec.shirt_color_id)fail('CHARACTER_INTENT_SHIRT_CHOICE_REQUIRED',id);
  if(!meaningful(design.rejected_alternative?.reason)||!String(design.rejected_alternative?.choice??'').trim())fail('CHARACTER_INTENT_ALTERNATIVE_REQUIRED',id);
  if(design.reuse_strategy!=='native_assembly_after_story'&&design.reuse_strategy!=='new_native_asset_after_story')fail('CHARACTER_INTENT_REUSE_STRATEGY_INVALID',id);
  const anchor=design.scene_anchor,scene=sceneMap.get(anchor?.scene_id);
  if(!scene||(scene.entities??[]).every(e=>e.id!==id)||!meaningful(anchor?.meaning)||!String(anchor?.excerpt??'').trim()||!String(scene.voice??'').toLocaleLowerCase('vi').includes(String(anchor.excerpt).trim().toLocaleLowerCase('vi')))
   fail('CHARACTER_INTENT_VOICE_ANCHOR_INVALID',id);
  const states=new Set();
  for(const s of (production.scenes??[]))for(const entity of s.entities??[])if(entity.id===id)for(const state of Object.keys(entity.states??{}))states.add(state);
  for(const state of states)if(!meaningful(design.state_purposes?.[state]))fail('CHARACTER_INTENT_STATE_PURPOSE_MISSING',`${id}/${state}`);
 }
 return {legacy:false,character_count:plan.characters?.length??0};
}
