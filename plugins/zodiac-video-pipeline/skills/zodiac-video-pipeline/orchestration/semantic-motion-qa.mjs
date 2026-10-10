// Semantic motion QA independent of measured frame timing; never claim a Remotion render.
const fail=(code,msg)=>{throw new Error(`${code}: ${msg}`)};
const box=t=>t && ['x','y','width','height'].every(k=>Number.isFinite(t[k])) && t.width>0 && t.height>0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const motionPreset=e=>e.motion?.preset??e.desired_motion;
export const isStateChanged=(before,after,e)=>e.state_before!==e.state_after||before.asset!==after.asset||before.visible!==after.visible||JSON.stringify(before.transform)!==JSON.stringify(after.transform);
export const MOTION_QA_LIMITS={"subtle-tilt":{property:'rotate_deg',peak:3.5,min:2,max:6},"small-bounce":{property:'translate_y_px',peak:-20,min:10,max:30},"focus-shift":{property:'scale_pct',peak:6,min:3,max:9},"slide":{property:'translate_xy_px',min:24,max:360}};
export function assessSemanticEvent(scene,event){
 const target=(scene.entities??[]).find(e=>e.id===event.target);
 if(!target)fail('MOTION_TARGET_MISSING',`${scene.id}/${event.id}/${event.target}`);
 const before=target.states?.[event.state_before],after=target.states?.[event.state_after];
 if(!before||!after)fail('MOTION_STATE_MISSING',`${scene.id}/${event.id}`);
 const preset=motionPreset(event),changed=isStateChanged(before,after,event);
 if(preset==='state_swap'&&before.asset===after.asset&&before.visible===after.visible&&JSON.stringify(before.transform)===JSON.stringify(after.transform))fail('NOOP_STATE_SWAP',`${scene.id}/${event.id} state_swap without a visually different asset, geometry or visibility`);
 if(preset==='hold'&&changed)fail('HOLD_STATE_CHANGE',`${scene.id}/${event.id} hold cannot perform a state transition`);
 if(preset==='hold')return {kind:'static_hold',runner_motion_check_required:false,expected_motion:{property:'none',peak:0}};
 if(changed&&preset!=='slide')return {kind:'state_or_visibility_change',runner_motion_check_required:false,expected_motion:{property:'state_transition',peak:null}};
 const spec=MOTION_QA_LIMITS[preset];
 if(!spec)fail('MOTION_PRESET_UNCHECKED',`${scene.id}/${event.id} unsupported same-state motion ${preset}`);
 if(preset!=='slide')return {kind:'motion_only',runner_motion_check_required:true,expected_motion:spec};
 // Actor slide: source transforms are the authored start/end points. The
 // renderer must interpolate them, not reuse pen/nib contact math.
 const actorBinding=(scene.spatial_bindings??[]).find(x=>x.entity===target.id&&x.relation==='near');
 if(preset==='slide'&&changed&&actorBinding){
  const actorAnchor=(scene.entities??[]).find(x=>x.id===actorBinding.anchor);
  const a=before.transform,b=after.transform;
  if(!actorAnchor||!box(a)||!box(b))fail('SLIDE_GEOMETRY_MISSING',`${scene.id}/${event.id}`);
  if(a.width!==b.width||a.height!==b.height||(a.scale??1)!==(b.scale??1)||(a.rotation??0)!==(b.rotation??0))fail('SLIDE_GEOMETRY_MISMATCH',`${scene.id}/${event.id} moving state dimensions must match`);
  const dx=b.x-a.x,dy=b.y-a.y,travel=Math.hypot(dx,dy);
  if(travel<spec.min||travel>spec.max)fail('SLIDE_TRAVEL_INVALID',`${scene.id}/${event.id} ${travel.toFixed(1)}px`);
  if([a,b].some(t=>t.x<0||t.y<0||t.x+t.width>1080||t.y+t.height>1920))fail('SLIDE_CANVAS_OVERFLOW',`${scene.id}/${event.id}`);
  return {kind:'actor_state_slide',runner_motion_check_required:true,expected_motion:{...spec,peak:travel,travel_px:travel,delta_px:{x:dx,y:dy},anchor_entity:actorAnchor.id,contact_profile:'actor-near-authored-state-v1'}};
 }
 if(changed&&preset==='slide')fail('SLIDE_CONTACT_BINDING_REQUIRED',`${scene.id}/${event.id} moved state without actor near binding`);
 const binding=(scene.spatial_bindings??[]).find(x=>x.entity===target.id);
 if(!binding||binding.relation!=='points_to')fail('SLIDE_CONTACT_BINDING_REQUIRED',`${scene.id}/${event.id} slide requires points_to binding`);
 const anchor=(scene.entities??[]).find(e=>e.id===binding.anchor);
 const anchorState=anchor?.states?.[anchor.initial_state];
 if(!anchor||!box(anchorState?.transform)||!box(before.transform))fail('SLIDE_GEOMETRY_MISSING',`${scene.id}/${event.id}`);
 // V4 pen master has authored nib at (18,151) in 320x160 viewBox. The notebook B target
 // is on the paper area ~60% across and 64% down. This is a deterministic role-specific contact.
 if(!String(target.id).toLowerCase().includes('pen')||!String(anchor.id).toLowerCase().includes('notebook'))fail('SLIDE_CONTACT_PROFILE_UNSUPPORTED',`${scene.id}/${event.id} needs authored contact profile`);
 const a=anchorState.transform,b=before.transform;
 const tip={x:b.x+b.width*18/320,y:b.y+b.height*151/160};
 const goal={x:a.x+a.width*.60,y:a.y+a.height*.64};
 const delta={x:goal.x-tip.x,y:goal.y-tip.y};
 const travel=distance(tip,goal);
 if(travel<spec.min||travel>spec.max)fail('SLIDE_TRAVEL_INVALID',`${scene.id}/${event.id} ${travel.toFixed(1)}px outside ${spec.min}-${spec.max}`);
 if(goal.x<a.x+a.width*.22||goal.x>a.x+a.width*.82||goal.y<a.y+a.height*.2||goal.y>a.y+a.height*.85)fail('SLIDE_CONTACT_MISSED',`${scene.id}/${event.id} contact falls outside notebook paper`);
 if(b.x+delta.x<0||b.x+b.width+delta.x>1080||b.y+delta.y<0||b.y+b.height+delta.y>1920)fail('SLIDE_CANVAS_OVERFLOW',`${scene.id}/${event.id}`);
 return {kind:'motion_only',runner_motion_check_required:true,expected_motion:{...spec,peak:travel,travel_px:travel,delta_px:delta,tip_start:tip,contact_target:goal,anchor_entity:anchor.id,contact_profile:'pen-to-notebook-mark-v1'}};
}
