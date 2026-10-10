// Deterministic semantic motion shared by final Remotion video and event preview stills.
const clamp=n=>Math.max(0,Math.min(1,n));
export const MOTION_EXPECTED={
  'subtle-tilt':{max_rotate_deg:3.5,min_rotate_deg:2},
  'small-bounce':{max_translate_y_px:20,min_translate_y_px:10},
  'focus-shift':{max_scale_pct:6,min_scale_pct:3},
  'slide':{min_travel_px:24,max_travel_px:360},
};
export function resolveSemanticMotion(event,scene,entity,frame){
  const result={translateX:0,translateY:0,scale:1,rotateDeg:0,opacity:1,active:false,peak:0,motion:event?.motion??null};
  if(!event||frame<event.start_frame||frame>=event.end_frame)return result;
  const duration=event.end_frame-event.start_frame;
  if(!Number.isInteger(duration)||duration<1)throw new Error('MOTION_EVENT_RANGE_INVALID '+event.event_id);
  const progress=clamp((frame-event.start_frame)/Math.max(1,duration-1));
  const peak=Math.sin(Math.PI*progress)**2;
  result.active=true;result.peak=peak;
  switch(event.motion){
    case 'subtle-tilt':result.rotateDeg=3.5*peak;break;
    case 'small-bounce':result.translateY=-20*peak;break;
    case 'focus-shift':result.scale=1+0.06*peak;break;
    case 'slide':{
      // Character/object motion with authored start/end geometry and a spatial anchor.
      // Keep the original pen-to-notebook slide profile below for same-state gestures.
      const from=entity.states?.[event.state_before]?.transform;
      const to=entity.states?.[event.state_after]?.transform;
      const near=(scene.spatial_bindings??[]).find(b=>b.entity===entity.id&&b.relation==='near');
      if(event.state_before!==event.state_after && near){
        if(!(scene.entities??[]).some(e=>e.id===near.anchor))throw new Error('SLIDE_CONTACT_BINDING_REQUIRED '+event.event_id);
        const valid=t=>t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))&&t.width>0&&t.height>0;
        if(!valid(from)||!valid(to)||from.width!==to.width||from.height!==to.height||
           (from.scale??1)!==(to.scale??1)||(from.rotation??0)!==(to.rotation??0))
          throw new Error('SLIDE_CONTACT_GEOMETRY_MISSING '+event.event_id);
        const dx=to.x-from.x,dy=to.y-from.y,travel=Math.hypot(dx,dy);
        if(travel<24||travel>360||[from,to].some(t=>t.x<0||t.y<0||t.x+t.width>1080||t.y+t.height>1920))
          throw new Error('SLIDE_CONTACT_OUT_OF_BOUNDS '+event.event_id);
        // Starts at old state, finishes exactly at new state before the SVG swap.
        const eased=(1-Math.cos(Math.PI*progress))/2;
        result.translateX=dx*eased;result.translateY=dy*eased;result.peak=eased;
        break;
      }
      const binding=(scene.spatial_bindings??[]).find(b=>b.entity===entity.id&&b.relation==='points_to');
      const anchor=(scene.entities??[]).find(e=>e.id===binding?.anchor);
      if(!binding||!anchor||!entity.id.toLowerCase().includes('pen')||!anchor.id.toLowerCase().includes('notebook'))throw new Error('SLIDE_CONTACT_BINDING_REQUIRED '+String(event.event_id));
      const a=anchor.states?.[anchor.initial_state]?.transform,b=entity.states?.[event.state_before]?.transform;
      if(!a||!b||![a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height].every(Number.isFinite))throw new Error('SLIDE_CONTACT_GEOMETRY_MISSING '+event.event_id);
      const tip={x:b.x+b.width*18/320,y:b.y+b.height*151/160};
      const goal={x:a.x+a.width*.60,y:a.y+a.height*.64};
      const dx=goal.x-tip.x,dy=goal.y-tip.y,travel=Math.hypot(dx,dy);
      if(travel<24||travel>360||b.x+dx<0||b.y+dy<0||b.x+dx+b.width>1080||b.y+dy+b.height>1920)throw new Error('SLIDE_CONTACT_OUT_OF_BOUNDS '+event.event_id);
      result.translateX=dx*peak;result.translateY=dy*peak;break;
    }
    case 'fade-in':result.opacity=(1-Math.cos(Math.PI*progress))/2;break;
    case 'fade-out':result.opacity=(1+Math.cos(Math.PI*progress))/2;break;
    case 'pop-in':{
      const eased=(1-Math.cos(Math.PI*progress))/2;
      result.scale=0.82+0.18*eased;result.opacity=eased;break;
    }
    case 'hold':case 'state_swap':break;
    default:break;
  }
  return result;
}
