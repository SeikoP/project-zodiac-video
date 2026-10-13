// Authored coverage belongs to Visual Intent/Art Direction; no runtime fields or approvals.
import {createHash} from 'node:crypto';
export const coverageLayers=['actors','scene_set','scene_accent','story_object','props','support','caption'];
const text=x=>typeof x==='string'&&x.trim().length>0;
const sha=x=>createHash('sha256').update(x).digest('hex');
const anchorOffset=(voice,trigger)=>{let at=-1,start=0;for(let i=0;i<(trigger?.occurrence??1);i++){at=voice.indexOf(trigger?.text??'',start);if(at<0)return -1;start=at+1;}return Buffer.byteLength(voice.slice(0,at));};
export function validateVisualCoverage(scene,planned,{required=false}={}){
 const issues=[],add=(code,detail={})=>issues.push({code,scene_id:scene.id,...detail});
 const coverage=planned?.visual_coverage;
 if(!coverage){if(required)add('VISUAL_COVERAGE_REQUIRED');return issues;}
 const voice=String(scene.voice??''),bytes=Buffer.from(voice);
 if(coverage.format!=='zodiac-visual-coverage@1'||!Array.isArray(coverage.beats)||!coverage.beats.length){add('COVERAGE_FORMAT_INVALID');return issues;}
 if(coverage.narration_sha256!==sha(bytes))add('COVERAGE_NARRATION_STALE');
 const entities=new Map((scene.entities??[]).map(e=>[e.id,e])),components=new Map((planned.components??[]).map(c=>[c.id,c]));
 const events=new Map((scene.events??[]).map(e=>[e.id,e])),coveredEvents=new Set(),seenBeats=new Set();
 const lanes=new Map();
 for(const e of scene.events??[]){const key=JSON.stringify([e.target,e.trigger?.type,e.trigger?.text,e.trigger?.occurrence??1,e.trigger?.offset_frames??0]);const prior=lanes.get(key);if(prior&&prior.state_after!==e.state_after)add('COVERAGE_EVENT_ANCHOR_CONFLICT',{event_id:e.id,prior_event_id:prior.id});lanes.set(key,e);}
 const states=new Map([...entities].map(([id,e])=>[id,e.initial_state]));
 const visible=id=>{const e=entities.get(id);return e?e.states?.[states.get(id)]?.visible!==false:components.get(id)?.visual_role==='background';};
 const roleOf=id=>{const c=components.get(id),e=entities.get(id);if(e?.kind==='character')return 'actors';if(c?.visual_role==='background')return 'scene_set';if(c?.visual_role==='effect')return 'scene_accent';if(c?.narrative_role==='story_object')return 'story_object';if(c?.visual_role==='interactive_prop'||c?.visual_role==='foreground_environment')return 'physical';return null;};
 let end=0;
 for(const beat of coverage.beats){
  if(!beat||!text(beat.id)||seenBeats.has(beat.id)||!text(beat.goal)){add('COVERAGE_BEAT_INVALID');continue;}seenBeats.add(beat.id);
  const [start,stop]=Array.isArray(beat.narration_range)?beat.narration_range:[];
  if(!Number.isInteger(start)||!Number.isInteger(stop)||start!==end||stop<=start||stop>bytes.length||!Buffer.from(bytes.subarray(start,stop).toString('utf8')).equals(bytes.subarray(start,stop)))add('COVERAGE_NARRATION_RANGE',{beat_id:beat.id});end=stop;
  const used=new Set(),byRole={};
  for(const layer of coverageLayers){
   const d=beat.layers?.[layer];
   if(!d||!['use','omit'].includes(d.decision)||!text(d.reason)){add('COVERAGE_LAYER_DECISION_MISSING',{beat_id:beat.id,layer});continue;}
   if(d.decision==='omit'){if(d.entity_ids?.length)add('COVERAGE_OMISSION_HAS_ENTITIES',{beat_id:beat.id,layer});continue;}
   if(layer==='caption'){const r=scene.layout_contract?.caption_safe_zone;if(!r||!['x','y','width','height'].every(k=>Number.isFinite(r[k]))||r.width<=0||r.height<=0)add('COVERAGE_CAPTION_LAYOUT_MISSING',{beat_id:beat.id});continue;}
   if(!Array.isArray(d.entity_ids)||!d.entity_ids.length||new Set(d.entity_ids).size!==d.entity_ids.length){add('COVERAGE_ENTITY_SELECTION_MISSING',{beat_id:beat.id,layer});continue;}
   byRole[layer]=d.entity_ids;
   for(const id of d.entity_ids){
    used.add(id);if(!components.has(id)||(!entities.has(id)&&components.get(id)?.visual_role!=='background'))add('COVERAGE_ENTITY_MISSING',{beat_id:beat.id,entity_id:id});
    const role=roleOf(id),matches=['props','support'].includes(layer)?role==='physical':role===layer;
    if(!matches)add('COVERAGE_ROLE_MISMATCH',{beat_id:beat.id,entity_id:id,layer});
   }
  }
  const seenVisible=new Set([...components.keys()].filter(visible));
  if(!Array.isArray(beat.event_ids)||new Set(beat.event_ids).size!==beat.event_ids.length){add('COVERAGE_EVENT_LIST_INVALID',{beat_id:beat.id});continue;}
  const expected=(scene.events??[]).filter(e=>{const p=anchorOffset(voice,e.trigger);return p>=start&&p<stop;}).map(e=>e.id);
  if(JSON.stringify(expected)!==JSON.stringify(beat.event_ids))add('COVERAGE_EVENT_ORDER',{beat_id:beat.id});
  for(const id of beat.event_ids){
   const event=events.get(id);if(!event||coveredEvents.has(id)){add('COVERAGE_EVENT_MISSING_OR_DUPLICATE',{beat_id:beat.id,event_id:id});continue;}coveredEvents.add(id);
   const at=anchorOffset(voice,event.trigger);if(event.trigger?.type!=='voice_anchor'||!text(event.trigger.text)||at<start||at>=stop)add('COVERAGE_EVENT_ANCHOR',{beat_id:beat.id,event_id:id});
   if(event.state_after)states.set(event.target,event.state_after);
   for(const id of components.keys())if(visible(id))seenVisible.add(id);
  }
  for(const id of seenVisible)if(!used.has(id))add('COVERAGE_VISIBLE_ENTITY_UNDECLARED',{beat_id:beat.id,entity_id:id});
  for(const id of used)if(!seenVisible.has(id))add('COVERAGE_ENTITY_NOT_VISIBLE',{beat_id:beat.id,entity_id:id});
  for(const id of byRole.support??[])if(!(scene.spatial_bindings??[]).some(b=>b.anchor===id&&entities.get(b.entity)?.kind==='character'&&b.relation==='on_surface'))add('COVERAGE_SUPPORT_CONTACT_MISSING',{beat_id:beat.id,entity_id:id});
  for(const id of byRole.props??[]){
   const bindings=scene.spatial_bindings??[];
   if(!bindings.some(b=>b.entity===id&&entities.has(b.anchor)&&['held_by','on_surface','near'].includes(b.relation)))add('COVERAGE_PROP_RELATION_MISSING',{beat_id:beat.id,entity_id:id});
   if(!(scene.events??[]).some(e=>e.target===id&&text(e.action)))add('COVERAGE_PROP_ACTION_MISSING',{beat_id:beat.id,entity_id:id});
  }
 }
 if(end!==bytes.length)add('COVERAGE_NARRATION_RANGE');
 for(const id of events.keys())if(!coveredEvents.has(id))add('COVERAGE_EVENT_UNCOVERED',{event_id:id});
 return issues;
}
