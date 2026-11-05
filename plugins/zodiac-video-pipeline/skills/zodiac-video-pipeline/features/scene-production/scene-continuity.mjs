const text=x=>typeof x==='string'&&x.trim().length>0;
const identityFields=['body_profile','hair_id','face_profile_id','outfit_id','shirt_color_id','zodiac_sign_id'];
const isCharacter=e=>e?.kind==='character'||e?.visual_role==='character';
const isProp=e=>e?.visual_role==='interactive_prop'||e?.kind==='prop';
const storyRole=e=>e?.kind==='narrative_visual'||e?.visual_role==='narrative_visual'||isProp(e);

export function reviewSceneContinuity(intent,{graph}={}){
 const issues=[],scenes=intent?.scenes??[],cast=intent?.cast??[],known=new Map();
 for(const c of cast){const id=c.entity_id;if(!id)continue;const signature=Object.fromEntries(identityFields.filter(key=>c[key]!=null).map(key=>[key,c[key]]));if(known.has(id)&&JSON.stringify(known.get(id))!==JSON.stringify(signature))issues.push({code:'CAST_IDENTITY_CONFLICT',entity_id:id});else known.set(id,signature);}
 const appearances=new Map();const introduced=new Set();
 for(const [index,s] of scenes.entries()){
  const chars=(s.entities??[]).filter(isCharacter);
  for(const c of chars){if(!appearances.has(c.id))appearances.set(c.id,[]);appearances.get(c.id).push(s.id);if(known.size&&!known.has(c.id))issues.push({code:'CAST_BINDING_MISSING',scene_id:s.id,entity_id:c.id});}
  const profile=s.experience_profile??{},refs=profile.callback_scene_ids??[];
  for(const prev of refs)if(!scenes.slice(0,index).some(x=>x.id===prev))issues.push({code:'CALLBACK_SOURCE_INVALID',scene_id:s.id,source:prev});
  // Named recurring story-object IDs may be reused, but an explicit callback must point
  // to the prior scene; this avoids treating unrelated one-off props as continuity errors.
  for(const entity of (s.entities??[]).filter(storyRole)){
   if(introduced.has(entity.id)&&profile.recurring_entity_ids?.includes(entity.id)&&!refs.length)issues.push({code:'RECURRING_OBJECT_UNLINKED',scene_id:s.id,entity_id:entity.id});
   introduced.add(entity.id);
  }
  if((profile.story_mode==='payoff')&&text(profile.payoff_source_scene_id)&&!scenes.slice(0,index).some(x=>x.id===profile.payoff_source_scene_id))issues.push({code:'PAYOFF_SOURCE_INVALID',scene_id:s.id,source:profile.payoff_source_scene_id});
 }
 if(graph?.status==='BLOCKED')issues.push({code:'SCENE_GRAPH_BLOCKED'});
 return {format:'zodiac-scene-continuity-review@1',decision:issues.length?'REVIEW':'PASS',issues,character_appearances:Object.fromEntries(appearances),not_an_approval:true};
}
