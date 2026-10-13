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

// Resolve optional actor-relative accents once against the authored actor's
// initial layout. Actor animation is independent; this is not a physical bind.
export function resolveCanvasAccentEntities(entities) {
 const cast=new Map((entities??[]).map(e=>[e.id,e]));
 return (entities??[]).map(e=>{
  if(e.kind!=='scene_accent'||e.anchor?.type!=='actor')return structuredClone(e);
  const actor=cast.get(e.anchor.actor_id);
  const a=actor?.states?.[actor.initial_state]?.transform;
  if(actor?.kind!=='character'||!bounds(a))throw Error('SCENE_ACCENT_ACTOR_ANCHOR_INVALID '+e.id);
  const placement=e.anchor.placement??'above_head';
  if(!['above_head','near_left','near_right'].includes(placement))throw Error('SCENE_ACCENT_PLACEMENT_INVALID '+e.id);
  const offset=e.anchor.offset_px??{x:0,y:0};
  if(!Number.isFinite(offset.x)||!Number.isFinite(offset.y))throw Error('SCENE_ACCENT_OFFSET_INVALID '+e.id);
  const out=structuredClone(e);
  for(const st of Object.values(out.states??{})){
   const t=st.transform;
   if(!bounds({...t,x:t?.x??0,y:t?.y??0}))throw Error('SCENE_ACCENT_TRANSFORM_INVALID '+e.id);
   let x=a.x+(a.width-t.width)/2,y=a.y-t.height;
   if(placement==='near_left'){x=a.x-t.width;y=a.y+(a.height-t.height)/2;}
   if(placement==='near_right'){x=a.x+a.width;y=a.y+(a.height-t.height)/2;}
   st.transform={...t,x:x+(t.x??0)+offset.x,y:y+(t.y??0)+offset.y};
  }
  return out;
 });
}
