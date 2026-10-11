import {createHash} from 'node:crypto';

export const DIRECTOR_PURPOSES = new Set(['observation','noticing','barrier','subtext','contrast','distance','realization','payoff','setup','reaction','explanation']);
export const DIRECTOR_MOTIONS = new Set(['state_swap','hold','pop-in','fade-in','fade-out','subtle-tilt','small-bounce','focus-shift','slide']);
export const DIRECTOR_SIDES = new Set(['above','below','left','right','between','above-left','above-right','below-left','below-right']);
export const sha256 = content => createHash('sha256').update(content).digest('hex');
const fail = (issues,code,scope,detail='') => issues.push({code,scope,detail});
const normText = s => String(s??'').normalize('NFC');
const hitsFor = (voice,anchor) => {
  const hits=[];let from=0;
  if (!anchor) return hits;
  while (from<=voice.length-anchor.length) {const i=voice.indexOf(anchor,from);if(i<0)break;hits.push(i);from=i+anchor.length;}
  return hits;
};
const safeKey = x => typeof x==='string'&&x.trim().length>0;
const byId = xs=>new Map((xs??[]).map(x=>[x.id,x]));

export function validateDirectorPlan(plan,production,narration){
  const issues=[];
  if (plan?.format!=='zodiac-director-plan@1')fail(issues,'DIRECTOR_FORMAT_INVALID','plan');
  if (plan?.narration_sha256!==sha256(narration))fail(issues,'NARRATION_HASH_MISMATCH','plan');
  if (!Array.isArray(plan?.beats)||!plan.beats.length)fail(issues,'BEATS_MISSING','plan');
  const seen=new Set();const covered=new Set();const blockingOwned=new Set();
  const scenes=byId(production?.scenes);
  for(const beat of plan?.beats??[]){
    const scope=`${beat.scene_id??'?'}/${beat.beat_id??'?'}`;
    const scene=scenes.get(beat.scene_id);
    if(!scene){fail(issues,'SCENE_NOT_FOUND',scope);continue;}
    if(!safeKey(beat.beat_id)||seen.has(beat.beat_id))fail(issues,'BEAT_ID_INVALID',scope);
    seen.add(beat.beat_id);covered.add(beat.scene_id);
    const anchor=normText(beat.voice_anchor),voice=normText(scene.voice);
    const occurrences=hitsFor(voice,anchor);
    if(!anchor||!occurrences.length)fail(issues,'VOICE_ANCHOR_MISSING',scope);
    if(occurrences.length>1&& !Number.isInteger(beat.occurrence))fail(issues,'VOICE_ANCHOR_AMBIGUOUS',scope);
    if(beat.occurrence!==undefined&&(!Number.isInteger(beat.occurrence)||beat.occurrence<1||beat.occurrence>occurrences.length))fail(issues,'ANCHOR_OCCURRENCE_INVALID',scope);
    if(!DIRECTOR_PURPOSES.has(beat.semantic_purpose))fail(issues,'PURPOSE_INVALID',scope);
    const entities=byId(scene.entities);
    if(!safeKey(beat.performer)||!entities.has(beat.performer))fail(issues,'PERFORMER_MISSING',scope);
    if(beat.target!==undefined&&beat.target!==null&&(!safeKey(beat.target)||!entities.has(beat.target)))fail(issues,'TARGET_MISSING',scope);
    if(!safeKey(beat.action)||!safeKey(beat.visual_payoff)||!safeKey(beat.shot_reason))fail(issues,'PERFORMANCE_INTENT_MISSING',scope);
    if(beat.target && entities.get(beat.target)?.kind==='character' && !safeKey(beat.reaction))fail(issues,'RELATIONAL_REACTION_MISSING',scope);
    if(!DIRECTOR_MOTIONS.has(beat.supported_motion_or_state))fail(issues,'MOTION_UNSUPPORTED',scope);
    if(beat.supported_motion_or_state==='hold' && !safeKey(beat.static_reason))fail(issues,'STATIC_HOLD_UNJUSTIFIED',scope);
    if(!safeKey(beat.asset_cost_reason))fail(issues,'ASSET_COST_UNJUSTIFIED',scope);
    const bindingIds=new Set();
    for(const b of beat.blocking??[]){
      if(!safeKey(b.entity_id)||!entities.has(b.entity_id)||!safeKey(b.anchor)||!entities.has(b.anchor)||b.entity_id===b.anchor || !DIRECTOR_SIDES.has(b.side))fail(issues,'BLOCKING_REFERENCE_INVALID',scope,JSON.stringify(b));
      if(bindingIds.has(b.entity_id))fail(issues,'BLOCKING_DUPLICATED',scope,b.entity_id);
      bindingIds.add(b.entity_id);
      const globalBindingKey=`${beat.scene_id}:${b.entity_id}`;
      if(blockingOwned.has(globalBindingKey))fail(issues,'BLOCKING_MULTIPLE_BEATS_CONFLICT',scope,b.entity_id);
      blockingOwned.add(globalBindingKey);
      if(b.side==='between'&&(!safeKey(b.secondary_anchor)||!entities.has(b.secondary_anchor)||b.secondary_anchor===b.entity_id||b.secondary_anchor===b.anchor))fail(issues,'BLOCKING_SECONDARY_ANCHOR_INVALID',scope,b.entity_id);
      if(b.secondary_anchor&&b.side!=='between')fail(issues,'BLOCKING_SECONDARY_ANCHOR_UNUSED',scope,b.entity_id);
      if(b.relayout===true&&entities.get(b.entity_id)?.kind==='character')fail(issues,'BLOCKING_CHARACTER_RELAYOUT_FORBIDDEN',scope,b.entity_id);
      if(b.relayout!==true && b.relayout!==false && b.relayout!==undefined)fail(issues,'BLOCKING_RELAYOUT_INVALID',scope);
    }
    for(const eventId of beat.event_ids??[]){
      if(!(scene.events??[]).some(e=>e.id===eventId))fail(issues,'DIRECTOR_EVENT_MISSING',scope,eventId);
    }
    if(beat.cause_event_id&&!(scene.events??[]).some(e=>e.id===beat.cause_event_id))fail(issues,'CAUSE_EVENT_MISSING',scope);
    if(beat.reaction_event_id&&!(scene.events??[]).some(e=>e.id===beat.reaction_event_id))fail(issues,'REACTION_EVENT_MISSING',scope);
    if(beat.cause_event_id&&beat.reaction_event_id&&beat.cause_event_id===beat.reaction_event_id)fail(issues,'CAUSE_REACTION_IDENTICAL',scope);
  }
  for(const scene of production?.scenes??[])if(scene.voice?.trim()&&!covered.has(scene.id))fail(issues,'SCENE_WITHOUT_DIRECTOR_BEAT',scene.id);
  return {format:'zodiac-director-plan-qc@1',ok:issues.length===0,status:issues.length?'BLOCKED':'PASS',beats:plan?.beats?.length??0,scenes:covered.size,issues};
}

// Independent of exact audio timing; positions are ordered by source utterance and
// must later be checked against measured audio by the local renderer.
export function validateDirectorCausality(plan,production){
  const issues=[];const scenes=byId(production.scenes);
  for(const beat of plan.beats??[]){
    const s=scenes.get(beat.scene_id);if(!s)continue;
    const ev=byId(s.events),cause=ev.get(beat.cause_event_id),reaction=ev.get(beat.reaction_event_id);
    if(!cause||!reaction)continue;
    const label=`${beat.scene_id}/${beat.beat_id}`;
    const loc=e=>e?.trigger?.text?hitsFor(normText(s.voice),normText(e.trigger.text))[((e.trigger.occurrence??1)-1)]??-1:e?.trigger?.source==='scene_start'||e?.trigger?.type==='scene_start'?-1:null;
    const a=loc(cause),b=loc(reaction);
    if(a===null||b===null||a===-1&&cause.trigger?.type!=='scene_start'&&cause.trigger?.source!=='scene_start'||b===-1&&reaction.trigger?.type!=='scene_start'&&reaction.trigger?.source!=='scene_start')fail(issues,'CAUSE_REACTION_TRIGGER_UNRESOLVED',label);
    else if(b<a)fail(issues,'REACTION_PRECEDES_CAUSE',label);
    if(cause.target===reaction.target&&!beat.allow_self_reaction)fail(issues,'REACTION_OWNER_SAME_AS_CAUSE',label);
  }
  return issues;
}

export const rect = t=>t&&[t.x,t.y,t.width,t.height].every(Number.isFinite)&&t.width>0&&t.height>0;
export const intersect = (a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const center = t=>({x:t.x+t.width/2,y:t.y+t.height/2});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const thumb=(p)=>{const t=p.states?.[p.initial_state]?.transform;return rect(t)?t:null};
const limits=(asset)=>{const c=asset?.category??'';return c==='effect'?{area:30000,short:110}:c==='prop'?{area:43000,short:110}:null};

// Called after native character/environment/shot compilation: preserve all
// explicit role geometry. Director-owned supporting objects/effects only.
export function compileDirectorBlocking(production,plan,{safeZone=null}={}){
  const output=structuredClone(production),issues=[],changes=[];
  const scenes=byId(output.scenes),canvas={width:1080,height:1920};
  for(const beat of plan.beats??[]){
    const scene=scenes.get(beat.scene_id);if(!scene)continue;
    const entities=byId(scene.entities);
    for(const instruction of beat.blocking??[]){
      const subject=entities.get(instruction.entity_id),owner=entities.get(instruction.anchor);
      if(!subject||!owner)continue;
      const original=thumb(subject),target=thumb(owner),scope=`${scene.id}/${subject.id}`;
      if(!target){fail(issues,'DIRECTOR_ANCHOR_GEOMETRY_MISSING',scope);continue;}
      if(original && !instruction.relayout)continue; // authored geometry is authoritative
      if(subject.kind==='character') {fail(issues,'DIRECTOR_CHARACTER_RELAYOUT_FORBIDDEN',scope);continue;}
      if((scene.spatial_bindings??[]).some(b=>b.entity===subject.id&&b.relation==='points_to')){
        fail(issues,'DIRECTOR_CONTACT_MANAGED_BY_NATIVE',scope);continue;
      }
      const initial=subject.states?.[subject.initial_state];const asset=output.assets?.[initial?.asset]??{};
      const template=original??{width:instruction.width??175,height:instruction.height??185,x:0,y:0};
      let width=template.width,height=template.height;
      const lim=limits(asset);
      if(lim){const factor=Math.max(1,Math.sqrt(lim.area/(width*height)),lim.short/Math.min(width,height));width=Math.ceil(width*factor);height=Math.ceil(height*factor);}
      const offset=Number.isFinite(instruction.offset_px)?clamp(instruction.offset_px,0,180):30;
      const a=center(target);let cx=a.x,cy=a.y;
      if(instruction.side==='left'||instruction.side==='above-left'||instruction.side==='below-left')cx=target.x-width/2-offset;
      if(instruction.side==='right'||instruction.side==='above-right'||instruction.side==='below-right')cx=target.x+target.width+width/2+offset;
      if(instruction.side==='above'||instruction.side==='above-left'||instruction.side==='above-right')cy=target.y-height/2-offset;
      if(instruction.side==='below'||instruction.side==='below-left'||instruction.side==='below-right')cy=target.y+target.height+height/2+offset;
      if(instruction.side==='between'){
        const other=entities.get(instruction.secondary_anchor);const b=other&&thumb(other);
        if(!b){fail(issues,'DIRECTOR_BETWEEN_ANCHOR_MISSING',scope);continue;}
        const c=center(b);cx=(a.x+c.x)/2;cy=(a.y+c.y)/2;
      }
      const t={x:Math.round(cx-width/2),y:Math.round(cy-height/2),width:Math.round(width),height:Math.round(height)};
      if(t.x<0||t.y<0||t.x+t.width>canvas.width||t.y+t.height>canvas.height){fail(issues,'DIRECTOR_BLOCKING_OFF_CANVAS',scope,JSON.stringify(t));continue;}
      const caption=safeZone||scene.caption_safe_zone;
      if(rect(caption)&&intersect(t,caption)>0){fail(issues,'DIRECTOR_BLOCKING_CAPTION_COLLISION',scope);continue;}
      const characters=(scene.entities??[]).filter(e=>e.kind==='character');
      if(asset.category==='effect'&&characters.some(c=>{const ct=thumb(c);if(!ct)return false;const face={x:ct.x+ct.width*.20,y:ct.y,width:ct.width*.60,height:ct.height*.48};return intersect(face,t)>0;})){
        fail(issues,'DIRECTOR_EFFECT_OCCLUDES_FACE',scope);continue;
      }
      for(const state of Object.values(subject.states??{}))state.transform={...(state.transform??{}),...t};
      changes.push({scene_id:scene.id,entity_id:subject.id,anchor:owner.id,side:instruction.side,transform:t});
    }
  }
  return {production:output,issues,changes};
}
