// Fresh-only canvas-native context accents. Legacy scene sets are handled separately.
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
 Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const bounds=x=>x&&['x','y','width','height'].every(k=>Number.isFinite(x[k]))&&x.width>0&&x.height>0;
export function validateCanvasAccents(scene,assets,{width=1080,height=1920}={}){
 const issues=[],add=(code,id)=>issues.push({code,scene_id:scene.id,entity_id:id});
 const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
 const caption=scene.layout_contract?.caption_safe_zone;
 for(const e of scene.entities??[]){
  if(e.kind!=='scene_accent'&&e.visual_role!=='scene_accent')continue;
  if(e.visual_role!=='scene_accent'||e.kind!=='scene_accent')add('SCENE_ACCENT_ROLE_MISMATCH',e.id);
  if(e.anchor?.type&&!['canvas','actor'].includes(e.anchor.type))add('SCENE_ACCENT_ANCHOR_INVALID',e.id);
  if(e.anchor?.type==='actor'&&!entities.has(e.anchor.actor_id))add('SCENE_ACCENT_ANCHOR_MISSING',e.id);
  if(!e.states||!e.states[e.initial_state]){add('SCENE_ACCENT_INITIAL_STATE_MISSING',e.id);continue;}
  for(const [name,state] of Object.entries(e.states)){
   const a=assets?.[state.asset];
   if(!a||a.category!=='scene_accent'||!a.path) add('SCENE_ACCENT_ASSET_INVALID',e.id);
   if(state.visible===false)continue;
   const t=state.transform;
   if(!bounds(t)||t.x<0||t.y<0||t.x+t.width>width||t.y+t.height>height){add('SCENE_ACCENT_CANVAS_BOUNDS',e.id);continue;}
   if(caption&&bounds(caption)&&overlap(t,caption)>0)add('SCENE_ACCENT_CAPTION_COLLISION',e.id);
  }
 }
 for(const ev of scene.events??[]){
  const e=entities.get(ev.target);
  if(!e||e.kind!=='scene_accent')continue;
  if(!ev.state_after||!Object.hasOwn(e.states??{},ev.state_after))add('SCENE_ACCENT_EVENT_STATE_MISSING',e.id);
  if(ev.trigger?.type==='voice_anchor'&&!String(scene.voice??'').includes(ev.trigger.text??''))
   add('SCENE_ACCENT_EVENT_ANCHOR_MISSING',e.id);
 }
 return {status:issues.length?'BLOCKED':'PASS',issues};
}
