// Story lettering uses the existing overlay role; captions remain runtime-owned.
export function validateStoryText(intent,production){
 const issues=[];
 for(const scene of intent?.scenes??[])for(const entity of scene.entities??[]){
  if(!entity.story_text)continue;
  const add=code=>issues.push({code,scene_id:scene.id,entity_id:entity.id});
  const spec=entity.story_text,voice=production?.scenes?.find(s=>s.id===scene.id)?.voice??'';
  if(entity.kind!=='object'||entity.visual_role!=='overlay')add('STORY_TEXT_ROLE_INVALID');
  if(!['setup','contrast','payoff','annotation','dialogue','internal_voice'].includes(spec.purpose)||!spec.reason?.trim())add('STORY_TEXT_PURPOSE_REQUIRED');
  if(entity.states?.[entity.initial_state]?.visible!==false)add('STORY_TEXT_PREMATURE_REVEAL');
  for(const [id,state] of Object.entries(entity.states??{}))if(state.visible!==false){
   if(!spec.states?.[id]?.trim()||intent.assets?.[state.asset]?.category!=='overlay')add('STORY_TEXT_ASSET_INVALID');
  }
  const events=(scene.events??[]).filter(e=>e.target===entity.id);
  for(const event of events)if(event.trigger?.type!=='voice_anchor'||!event.trigger.text||!voice.includes(event.trigger.text))add('STORY_TEXT_ANCHOR_INVALID');
  const reveals=events.filter(e=>entity.states?.[e.state_after]?.visible!==false);
  if(!reveals.length)add('STORY_TEXT_REVEAL_REQUIRED');
  const last=events.at(-1);
  if(last&&entity.states?.[last.state_after]?.visible!==false&&!spec.hold_to_scene_end_reason?.trim())add('STORY_TEXT_RELEASE_REQUIRED');
 }
 return issues;
}
