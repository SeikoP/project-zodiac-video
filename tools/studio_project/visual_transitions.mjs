// Scene transitions for the Studio episode composition (spec 2026-11-25, "Transitions"). Pure and deterministic:
// the painter is a function of progress only, so preview and MP4 frames match.
// paintTransition/resetTransition are serialised into the browser via Function#toString: they may only use their arguments.
import {readFileSync} from 'node:fs';
export const TRANSITIONS=JSON.parse(readFileSync(new URL('./transitions.json',import.meta.url),'utf8'));
export const DEFAULT_TRANSITION=TRANSITIONS.default;
const assert=(ok,message)=>{if(!ok)throw Error(message);};

export function validateTransition(transition){
  const spec=TRANSITIONS.presets[transition?.preset];
  assert(spec,'VISUAL_TRANSITION_INVALID preset '+transition?.preset);
  const frames=transition.frames;
  assert(Number.isInteger(frames)&&frames>=spec.min_frames&&frames<=spec.max_frames,'VISUAL_TRANSITION_INVALID frames '+frames+' for '+transition.preset);
}

/** The window around a scene boundary, or null (cut, last scene, or neighbours too short to carry one). */
export function resolveTransition(transition,framesOut,framesIn){
  const t=transition??DEFAULT_TRANSITION;
  if(!framesIn||t.preset==='cut')return null;
  const frames=Math.min(t.frames,Math.floor(0.4*Math.min(framesOut,framesIn)));
  if(frames<2)return null;
  const before=Math.floor(frames/2);
  return {preset:t.preset,frames,before,after:frames-before};
}

export function paintTransition(outgoing,incoming,preset,progress,paper){
  const p=Math.max(0,Math.min(1,progress));
  const out=outgoing.style,inc=incoming.style;
  out.zIndex='2';inc.zIndex='1';
  out.background=paper;out.backfaceVisibility='hidden';
  if(preset==='dissolve'){
    // Opacity and a small transform only: both stay on the compositor, so the move is smooth in the editor and identical in the export.
    const e=p*p*(3-2*p);
    out.opacity=String(1-e);
    out.transformOrigin='50% 50%';
    out.transform='translateX('+(-e*36)+'px) scale('+(1+0.025*e)+')';
    inc.opacity=String(0.3+0.7*e);
  }else if(preset==='paper-slide'){
    out.transformOrigin='0% 100%';
    out.transform='translateX('+(-p*1120)+'px) rotate('+(-4*p)+'deg)';
    out.boxShadow=(14*(1-p))+'px 0 28px rgba(0,0,0,'+(0.28*(1-p))+')';
    inc.filter='brightness('+(0.9+0.1*p)+')';
  }else{
    out.transformOrigin='0% 50%';
    out.transform='perspective(2600px) rotateY('+(-p*165)+'deg)';
    out.boxShadow=(26*(1-p))+'px 0 44px rgba(0,0,0,'+(0.3*(1-p))+')';
    inc.filter='brightness('+(0.86+0.14*p)+')';
  }
  out.visibility=p>=1?'hidden':'visible';
}

export function resetTransition(node){
  const s=node.style;
  for(const key of ['transform','transformOrigin','boxShadow','filter','background','backfaceVisibility','visibility','zIndex','opacity'])s[key]='';
}
