// Optional words belong to the same story visual states and assets; captions remain runtime-owned.
export function validateStoryVisualLettering(intent,production){
 const issues=[],letteringByPath=new Map();
 for(const scene of intent?.scenes??[]){
  for(const entity of scene.entities??[]){
  if(!entity.lettering)continue;
  const add=code=>issues.push({code,scene_id:scene.id,entity_id:entity.id});
  const spec=entity.lettering,voice=production?.scenes?.find(s=>s.id===scene.id)?.voice??'';
  if(entity.kind!=='story_visual'||entity.visual_role!=='story_visual')add('STORY_VISUAL_LETTERING_ROLE_INVALID');
  if(!['setup','contrast','payoff','annotation','dialogue','internal_voice'].includes(spec.purpose)||!spec.reason?.trim())add('STORY_VISUAL_LETTERING_PURPOSE_REQUIRED');
  if(spec.states?.[entity.initial_state]&&entity.states?.[entity.initial_state]?.visible!==false)add('STORY_VISUAL_LETTERING_PREMATURE_REVEAL');
  if(!spec.states||!Object.keys(spec.states).length)add('STORY_VISUAL_LETTERING_STATE_INVALID');
  for(const [id,words] of Object.entries(spec.states??{})){
   const state=entity.states?.[id];
   if(!state||state.visible===false||typeof words!=='string'||!words.trim()){add('STORY_VISUAL_LETTERING_STATE_INVALID');continue;}
   if(intent.assets?.[state.asset]?.category!=='story_visual')add('STORY_VISUAL_LETTERING_ASSET_INVALID');
   const style=spec.styles?.[id]??'note';
   if(!['note','stamp','score','title','bubble','thought','burst','whisper','tag','ribbon','underline','sfx'].includes(style))add('STORY_VISUAL_LETTERING_STYLE_INVALID');
   const asset=intent.assets?.[state.asset],key=asset?.path??state.asset,value=JSON.stringify([spec.states?.[id],style]);
   if(letteringByPath.has(key)&&letteringByPath.get(key)!==value)add('STORY_VISUAL_LETTERING_ASSET_TEXT_CONFLICT');
   letteringByPath.set(key,value);
  }
  const events=(scene.events??[]).filter(e=>e.target===entity.id);
  for(const event of events)if(event.trigger?.type!=='voice_anchor'||!event.trigger.text||!voice.includes(event.trigger.text))add('STORY_VISUAL_LETTERING_ANCHOR_INVALID');
  const reveals=events.filter(e=>spec.states?.[e.state_after]&&entity.states?.[e.state_after]?.visible!==false);
  if(!reveals.length)add('STORY_VISUAL_LETTERING_REVEAL_REQUIRED');
  const last=events.at(-1);
  if(last&&spec.states?.[last.state_after]&&entity.states?.[last.state_after]?.visible!==false&&!spec.hold_to_scene_end_reason?.trim())add('STORY_VISUAL_LETTERING_RELEASE_REQUIRED');
  }
 }
 return issues;
}
