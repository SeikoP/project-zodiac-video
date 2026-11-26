// Deterministic geometry repair for the two layout faults the technical QA reports on every built scene:
// OUTSIDE_CANVAS and CAPTION_OCCLUSION. No model is involved: each entity gets one uniform scale + shift applied to
// ALL of its states, so a character never jumps between poses, and the fix is idempotent (a second run changes nothing).
import {presentationFor,resolveCaptionZone} from './visual_presentation.mjs';
import {THEMES} from './visual_themes.mjs';

const CANVAS={width:1080,height:1920};
const MARGIN=8;
const EXEMPT=new Set(['background','environment','scene_accent']);
const FIXABLE=new Set(['OUTSIDE_CANVAS','CAPTION_OCCLUSION']);
export const FIXABLE_CODES=FIXABLE;

const visible=entity=>Object.values(entity.states??{}).filter(s=>s?.transform&&s.visible!==false);
const rectOf=state=>{
  const t=state.transform,w=t.width??520,h=t.height??520,k=t.scale??1,cx=(t.x??0)+w/2,cy=(t.y??0)+h/2;
  return {left:cx-w*k/2,top:cy-h*k/2,right:cx+w*k/2,bottom:cy+h*k/2};
};
const union=rects=>({left:Math.min(...rects.map(r=>r.left)),top:Math.min(...rects.map(r=>r.top)),
  right:Math.max(...rects.map(r=>r.right)),bottom:Math.max(...rects.map(r=>r.bottom))});

/** Fix one scene in place. Returns the list of changes made (empty when the scene is already clean). */
export function autofixScene(scene,themeId='light'){
  const zone=resolveCaptionZone(scene,presentationFor(THEMES[themeId]??THEMES.light),CANVAS);
  const changes=[];
  for(const entity of scene.entities??[]){
    const states=visible(entity);
    if(!states.length)continue;
    const exempt=EXEMPT.has(entity.visual_role??entity.kind);
    const box=union(states.map(rectOf));
    const w=box.right-box.left,h=box.bottom-box.top;
    const overlapsX=r=>r.left<zone.x+zone.width&&r.right>zone.x;
    const wouldHitCaption=!exempt&&overlapsX(box);
    let scale=Math.min(1,CANVAS.width/w,CANVAS.height/h);
    if(wouldHitCaption)scale=Math.min(scale,(zone.y-MARGIN)/h);
    const cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2;
    const scaled={left:cx-w*scale/2,right:cx+w*scale/2,top:cy-h*scale/2,bottom:cy+h*scale/2};
    let dx=0,dy=0;
    if(scaled.left<0)dx=-scaled.left;else if(scaled.right>CANVAS.width)dx=CANVAS.width-scaled.right;
    if(scaled.top+dy<0)dy=-scaled.top;
    else if(scaled.bottom>CANVAS.height)dy=CANVAS.height-scaled.bottom;
    if(wouldHitCaption){
      const moved={left:scaled.left+dx,right:scaled.right+dx,top:scaled.top,bottom:scaled.bottom};
      const hits=overlapsX(moved)&&moved.top<zone.y+zone.height&&moved.bottom>zone.y;
      if(hits)dy=Math.min(dy,zone.y-MARGIN-scaled.bottom);
      if(scaled.top+dy<0)dy=-scaled.top;
    }
    const outside=box.left<0||box.top<0||box.right>CANVAS.width||box.bottom>CANVAS.height;
    const occluded=!exempt&&overlapsX(box)&&box.top<zone.y+zone.height&&box.bottom>zone.y;
    if(!outside&&!occluded)continue;
    const before=Object.fromEntries(Object.entries(entity.states).filter(([,s])=>s?.transform).map(([id,s])=>[id,{...s.transform}]));
    for(const state of Object.values(entity.states)){
      const t=state?.transform;
      if(!t)continue;
      const tw=t.width??520,th=t.height??520;
      t.x=Math.round(cx+((t.x??0)-cx)*scale+dx);
      t.y=Math.round(cy+((t.y??0)-cy)*scale+dy);
      t.width=Math.round(tw*scale);
      t.height=Math.round(th*scale);
    }
    changes.push({scene_id:scene.id,entity_id:entity.id,reasons:[outside?'OUTSIDE_CANVAS':null,occluded?'CAPTION_OCCLUSION':null].filter(Boolean),
      scale:Number(scale.toFixed(3)),dx:Math.round(dx),dy:Math.round(dy),before});
  }
  return changes;
}

/** Fix the named scenes (all when none are named) of an intent; returns a repaired copy and what changed. */
export function autofixIntent(intent,{theme='light',sceneIds=null}={}){
  const copy=JSON.parse(JSON.stringify(intent));
  const changes=[];
  for(const scene of copy.scenes??[]){
    if(sceneIds&&!sceneIds.includes(scene.id))continue;
    changes.push(...autofixScene(scene,theme));
  }
  return {intent:copy,changes};
}
