// Limited 2D cut-out acting (Studio style spec 2026-11-25). Pure and deterministic: preview and MP4 share it.
// resolveActing/resolveCamera are serialised into the browser painter via Function#toString, so they must
// only reference `steppedMotionFrame` (provided by the pinned renderer / presentationRuntime) and their arguments.
import {readFileSync} from 'node:fs';
import {steppedMotionFrame} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/semantic-motion.mjs';
export const ACTING=JSON.parse(readFileSync(new URL('./acting_registry.json',import.meta.url),'utf8'));
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function resolveActing(events,id,frame){
  const mine=events.filter(e=>['lean','recoil','pull-with-prop'].includes(e.motion)&&(e.target===id||(e.params?.group??[]).includes(id)))
    .sort((a,b)=>a.start_frame-b.start_frame);
  let pose={translateX:0,translateY:0,rotateDeg:0},active=false;
  for(const e of mine){
    if(frame<e.start_frame)break;
    const p=e.params??{},own=e.target===id,rel=e.motion==='pull-with-prop';
    const target={translateX:rel?pose.translateX+(p.dx??0):(p.dx??pose.translateX),
      translateY:rel?pose.translateY+(p.dy??0):(p.dy??pose.translateY),
      rotateDeg:own&&!rel?(p.degrees??pose.rotateDeg):pose.rotateDeg};
    if(frame>=e.end_frame){if(p.settle!=='return')pose=target;continue;}
    const duration=e.end_frame-e.start_frame,sample=steppedMotionFrame(frame,e.start_frame,e.end_frame);
    const progress=Math.max(0,Math.min(1,(sample-e.start_frame)/Math.max(1,duration-1)));
    const k=p.settle==='return'?Math.sin(Math.PI*progress)**2:(1-Math.cos(Math.PI*progress))/2;
    pose={translateX:pose.translateX+(target.translateX-pose.translateX)*k,
      translateY:pose.translateY+(target.translateY-pose.translateY)*k,
      rotateDeg:pose.rotateDeg+(target.rotateDeg-pose.rotateDeg)*k};
    active=true;break;
  }
  return {...pose,active};
}

export function resolveCamera(shots,frame){
  let state={x:540,y:960,zoom:1};
  for(const s of [...(shots??[])].sort((a,b)=>a.start_frame-b.start_frame)){
    if(frame<s.start_frame)break;
    if(frame>=s.end_frame){state={...s.to};continue;}
    const base=s.from??state,duration=s.end_frame-s.start_frame,sample=steppedMotionFrame(frame,s.start_frame,s.end_frame);
    const progress=Math.max(0,Math.min(1,(sample-s.start_frame)/Math.max(1,duration-1))),k=(1-Math.cos(Math.PI*progress))/2;
    return {x:base.x+(s.to.x-base.x)*k,y:base.y+(s.to.y-base.y)*k,zoom:base.zoom+(s.to.zoom-base.zoom)*k};
  }
  return state;
}

export function validateActingEvent(event,scene,targetId){
  const preset=event.motion?.preset,spec=ACTING.motions[preset],p=event.motion?.params??{};
  assert(spec,'VISUAL_ACTING_UNSUPPORTED '+preset);
  for(const [key,max] of [['degrees',spec.max_degrees],['dx',spec.max_dx],['dy',spec.max_dy]])
    if(p[key]!==undefined)assert(finite(p[key])&&Math.abs(p[key])<=max,'VISUAL_ACTING_PARAM_INVALID '+preset+'.'+key);
  assert(p.settle===undefined||['hold','return'].includes(p.settle),'VISUAL_ACTING_PARAM_INVALID '+preset+'.settle');
  if(spec.requires_group){
    assert(Array.isArray(p.group)&&p.group.length>0&&p.group.length<=6,'VISUAL_ACTING_GROUP_REQUIRED '+preset);
    const ids=new Set((scene.entities??[]).map(e=>e.id));
    for(const g of p.group)assert(ids.has(g)&&g!==targetId,'VISUAL_ACTING_GROUP_UNKNOWN '+g);
  }else assert(p.group===undefined,'VISUAL_ACTING_PARAM_INVALID '+preset+'.group');
  const frames=event.motion?.duration_frames??spec.default_duration_frames;
  assert(Number.isInteger(frames)&&frames>=1&&frames<=spec.max_duration_frames,'VISUAL_MOTION_DURATION_INVALID');
}

export function validateCameraShots(shots){
  const c=ACTING.camera;
  assert(Array.isArray(shots)&&shots.length<=c.max_shots_per_scene,'VISUAL_CAMERA_INVENTORY_INVALID');
  const ids=new Set();
  for(const shot of shots){
    assert(typeof shot.id==='string'&&shot.id&&!ids.has(shot.id),'VISUAL_CAMERA_ID_INVALID');ids.add(shot.id);
    assert(['voice_anchor','scene_start','scene_end'].includes(shot.trigger?.type),'VISUAL_CAMERA_TRIGGER_UNSUPPORTED');
    const frames=shot.duration_frames??0;
    assert(Number.isInteger(frames)&&frames>=0&&frames<=c.max_duration_frames,'VISUAL_CAMERA_DURATION_INVALID');
    for(const key of ['from','to'].filter(k=>shot[k]!==undefined)){
      const f=shot[key];
      assert(f&&finite(f.x)&&finite(f.y)&&finite(f.zoom)&&f.zoom>=c.min_zoom,'VISUAL_CAMERA_FRAMING_INVALID');
      assert(f.zoom<=c.max_cut_zoom,'VISUAL_CAMERA_CUT_TOO_CLOSE');
      const hw=c.canvas.width/2/f.zoom,hh=c.canvas.height/2/f.zoom;
      assert(f.x-hw>=-1e-6&&f.x+hw<=c.canvas.width+1e-6&&f.y-hh>=-1e-6&&f.y+hh<=c.canvas.height+1e-6,'VISUAL_CAMERA_OUT_OF_CANVAS');
    }
    assert(shot.to,'VISUAL_CAMERA_FRAMING_INVALID');
    if(shot.from===undefined)assert(shot.to.zoom<=c.max_push_zoom,'VISUAL_CAMERA_PUSH_TOO_CLOSE');
    else if(Math.max(shot.from.zoom,shot.to.zoom)>c.max_push_zoom)
      assert(typeof shot.reason==='string'&&shot.reason.trim().length>=c.reason_min_chars,'VISUAL_CAMERA_REASON_REQUIRED');
  }
}
