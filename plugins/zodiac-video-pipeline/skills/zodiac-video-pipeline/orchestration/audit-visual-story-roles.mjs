#!/usr/bin/env node
// Inspect authored visual role coverage. This is evidence for editorial review, NOT visual approval.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const workspace=path.resolve(process.argv[2]??'.');
let prod;
try{prod=JSON.parse(await readFile(path.join(workspace,'production.json'),'utf8'));}catch(e){console.error('PRODUCTION_UNAVAILABLE '+e.message);process.exit(2)}
if(!Array.isArray(prod.scenes)||!prod.scenes.length){console.error('SCENES_MISSING');process.exit(2)}
const scenes=prod.scenes.map(scene=>{
 const ents=scene.entities??[];const events=scene.events??[];
 const cats={};const missing=[];const referenced=new Set();
 for(const e of ents){
  const roles=new Set();
  for(const [state,record] of Object.entries(e.states??{})){
   const asset=prod.assets?.[record.asset];
   if(!asset){missing.push({entity:e.id,state,asset:record.asset??null});continue}
   roles.add(asset.category??'untyped');referenced.add(record.asset);
  }
  for(const role of roles)cats[role]=(cats[role]??0)+1;
 }
 const targeted=new Set(events.map(e=>e.target));
 const stale=events.filter(ev=>!ents.some(e=>e.id===ev.target));
 const active=ents.filter(e=>targeted.has(e.id)).map(e=>e.id);

 const actors=ents.filter(e=>e.kind==='character');
 const objects=ents.filter(e=>e.kind==='story_object'||/^story[_-]/iu.test(e.id));
 const eventsByTarget=id=>events.filter(e=>e.target===id);
 const objectStates=[];
 for(const obj of objects){
   const states=obj.states??{};
   const trace=eventsByTarget(obj.id);
   const meaningful=trace.some(event=>{
     const from=states[event.state_before],to=states[event.state_after];
     if(!from||!to)return false;
     const changedAsset=from.asset!==to.asset;
     const changedTransform=JSON.stringify(from.transform??{})!==JSON.stringify(to.transform??{});
     const changedVisibility=from.visible!==to.visible;
     const purposefulMotion=Boolean(event.motion?.preset&&event.motion.preset!=='hold');
     return changedAsset||changedTransform||changedVisibility||purposefulMotion;
   });
   objectStates.push({entity:obj.id,state_count:Object.keys(states).length,event_count:trace.length,
     meaningful_native_transition:meaningful,
     masquerades_as_environment:Object.values(states).some(x=>prod.assets?.[x.asset]?.category==='environment')});
 }
 const effectStates=ents.filter(e=>Object.values(e.states??{}).some(x=>prod.assets?.[x.asset]?.category==='effect')).map(e=>({
   entity:e.id,event_count:eventsByTarget(e.id).length,
   enters:eventsByTarget(e.id).some(ev=>e.states?.[ev.state_after]?.visible!==false),
   releases:eventsByTarget(e.id).some(ev=>e.states?.[ev.state_after]?.visible===false)
 }));
 const layoutSignature=JSON.stringify(ents.filter(e=>Object.values(e.states??{}).some(x=>prod.assets?.[x.asset]?.category==='character')).map(e=>{
   const t=e.states?.[e.initial_state]?.transform??{};
   return {kind:e.kind,x:Math.round((t.x??0)/80),y:Math.round((t.y??0)/80),width:Math.round((t.width??0)/80)};
 }));
 const notes=[];
 if(!events.length)notes.push('NO_VISUAL_EVENTS');
 if(!active.length)notes.push('NO_EVENTED_ENTITY');
 if(Object.keys(cats).length<=2)notes.push('LIMITED_VISUAL_ROLE_VARIETY_REVIEW');
 if(missing.length)notes.push('ASSET_REFERENCE_MISSING');
 if(stale.length)notes.push('EVENT_TARGET_MISSING');

 if(objects.length&&!objectStates.some(x=>x.meaningful_native_transition))notes.push('STORY_OBJECT_DECORATIVE_REVIEW');
 if(objectStates.some(x=>x.masquerades_as_environment))notes.push('STORY_OBJECT_REPLACES_ENVIRONMENT');
 if(effectStates.some(x=>!x.enters||!x.releases))notes.push('EFFECT_LIFECYCLE_INCOMPLETE');
 if(!actors.length)notes.push('NO_CHARACTER_PRESENT');

 return {scene_id:scene.id,layout_signature:layoutSignature,story_objects:objectStates,effects:effectStates,voice_present:Boolean(String(scene.voice??'').trim()),entity_count:ents.length,event_count:events.length,asset_roles:cats,evented_entities:active,referenced_assets:[...referenced],unresolved_assets:missing,invalid_event_targets:stale.map(e=>e.id),editorial_review_flags:notes,editorial_questions:['Does the Story Object change meaning without voice?','Are supporting props, effects or social pressure meaningful rather than decorative?','Does placement respect face, caption and thought-space?','Does this scene differ intentionally from adjacent scenes?']};
});
for(let i=2;i<scenes.length;i++)if(scenes[i].layout_signature===scenes[i-1].layout_signature&&scenes[i].layout_signature===scenes[i-2].layout_signature&&scenes[i].layout_signature!=='[]')scenes[i].editorial_review_flags.push('THREE_SCENES_SAME_CAST_LAYOUT');
const report={format:'zodiac-visual-role-audit@1',status:scenes.some(s=>s.unresolved_assets.length||s.invalid_event_targets.length||s.editorial_review_flags.includes('STORY_OBJECT_REPLACES_ENVIRONMENT'))?'BLOCKED':'REVIEW_REQUIRED',scope:'native-authoring-only',disclaimer:'Neither asset count nor validator output proves visual quality. Inspect rendered frames and obtain user approval.',scenes};
const output=path.join(workspace,'.authoring/visual-role-audit.json');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,output,flags:scenes.flatMap(s=>s.editorial_review_flags.map(code=>({scene:s.scene_id,code})))},null,2));process.exit(report.status==='BLOCKED'?2:0);
