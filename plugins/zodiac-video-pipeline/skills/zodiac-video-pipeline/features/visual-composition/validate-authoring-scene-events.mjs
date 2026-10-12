#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
export function lintSceneEvents(production){
 const errors=[];let eventCount=0,voiceCount=0;
 const fail=(scope,problem)=>errors.push({scope,problem});
 for(const scene of production?.scenes??[]){
  const scope=scene.id??'<unnamed>';
  if(typeof scene.voice!=='string'||!scene.voice.trim())fail(scope,'SCENE_VOICE_MISSING');else voiceCount++;
  const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
  const events=scene.events;
  if(!Array.isArray(events)||!events.length)fail(scope,'SCENE_EVENTS_MISSING');
  const eventIds=new Set();
  for(const event of events??[]){
   eventCount++;
   if(eventIds.has(event.id))fail(scope,'DUPLICATE_EVENT_ID '+event.id);
   eventIds.add(event.id);
   const entity=entities.get(event.target);
   if(!entity) {fail(scope,'EVENT_TARGET_MISSING '+event.target);continue;}
   for(const k of ['state_before','state_after'])if(!entity.states||!(event[k] in entity.states))fail(scope,`EVENT_${k.toUpperCase()}_MISSING ${event.target}.${event[k]}`);
   if(typeof event.motion?.preset!=='string'||!event.motion.preset||!Number.isInteger(event.motion.duration_frames)||event.motion.duration_frames<1)fail(scope,'EVENT_MOTION_INVALID '+event.id);
   const trigger=event.trigger;
   if(trigger?.type==='voice_anchor'||trigger?.source==='voice_anchor'){
    if(typeof trigger.text!=='string'||!scene.voice?.includes(trigger.text))fail(scope,'VOICE_ANCHOR_MISSING '+event.id);
   }else if(trigger?.type!=='scene_start'&&trigger?.source!=='scene_start')fail(scope,'EVENT_TRIGGER_INVALID '+event.id);
  }
  // Runtime starts at entity.initial_state. All authored events targeting the
  // same entity must be executable from that actual state; a pair snapshot
  // of state_before/state_after does not prove this runtime precondition.
  for(const entity of entities.values()){
   let current=entity.initial_state;
   const timeline=(events??[]).filter(e=>e.target===entity.id);
   for(let i=0;i<timeline.length;i++){
    const event=timeline[i];
    if(event.state_before!==current){
     const code=i===0?'EVENT_STATE_CHAIN_INITIAL':'EVENT_STATE_CHAIN_DISCONNECTED';
     fail(scope,`${code} ${entity.id} event=${event.id} expected=${current} actual=${event.state_before}`);
    }
    current=event.state_after;
   }
  }
  for(const entity of entities.values()){
   const first=entity.states?.[entity.initial_state];
   const effect=Object.values(entity.states??{}).some(st=>production.assets?.[st?.asset]?.category==='effect');
   if(!effect)continue;
   if(first?.visible!==false)fail(scope,'EFFECT_NOT_INITIALLY_HIDDEN '+entity.id);
   const ev=(events??[]).filter(e=>e.target===entity.id);
   if(!ev.some(e=>entity.states?.[e.state_after]?.visible===true))fail(scope,'EFFECT_MISSING_ENTER '+entity.id);
   if(!ev.some(e=>entity.states?.[e.state_after]?.visible===false))fail(scope,'EFFECT_MISSING_RELEASE '+entity.id);
  }
 }
 return {format:'zodiac-authoring-scene-events-qc@1',status:errors.length?'BLOCKED':'PASS',scenes:production?.scenes?.length??0,voice_scenes:voiceCount,events:eventCount,errors};
}
if(direct){const input=process.argv[2];if(!input){console.error('Usage: node validate-authoring-scene-events.mjs <workspace|production.json>');process.exit(2)}
 try{const file=input.endsWith('.json')?input:path.join(input,'production.json');const result=lintSceneEvents(JSON.parse(await readFile(file,'utf8')));console.log(JSON.stringify(result,null,2));process.exit(result.errors.length?1:0)}catch(e){console.error(e.message);process.exit(2)}
}
