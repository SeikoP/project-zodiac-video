import {isDeepStrictEqual} from 'node:util';
const fail=message=>{throw new Error('EFFECT_LIFECYCLE_INVALID '+message);};
export function resolveEffectAnchor(voice,text,occurrence){
 if(typeof text!=='string'||!text.trim())fail('ANCHOR_MISSING');
 const positions=[];let at=0;while(at<=voice.length){const i=voice.indexOf(text,at);if(i<0)break;positions.push(i);at=i+text.length;}
 if(!positions.length)fail('ANCHOR_MISSING '+text);
 if(positions.length>1&&occurrence===undefined)fail('OCCURRENCE_REQUIRED '+text);
 const n=occurrence??1;if(!Number.isInteger(n)||n<1||n>positions.length)fail('OCCURRENCE_INVALID '+text);
 return {position:positions[n-1],trigger:{source:'voice_anchor',text,...(occurrence!==undefined?{occurrence}: {})}};
}
export function materializeEffectLifecycle(scene,spec,beat,assetId){
 if(!beat||beat.scene_id!==scene.id||beat.entity_id!==spec.entity_id)fail('CHOREOGRAPHY_MISSING '+spec.entity_id);
 if(!['observation','noticing','barrier','subtext','contrast','distance','realization','payoff'].includes(beat.semantic_role))fail('CHOREOGRAPHY_ROLE_INVALID');
 const owner=scene.visual_grammar?.meme_composition?.roles?.[spec.anchor?.role]?.entity_id;
 if(!owner||owner===spec.entity_id||!scene.entities?.some(e=>e.id===owner))fail('OWNER_MISSING '+spec.entity_id);
 const enter=resolveEffectAnchor(String(scene.voice??''),beat.voice_anchor,beat.enter_occurrence),release=resolveEffectAnchor(String(scene.voice??''),beat.release_anchor,beat.release_occurrence);
 if(release.position<=enter.position)fail('LIFECYCLE_ORDER');
 if(!Number.isFinite(beat.max_distance_px)||beat.max_distance_px<=0||beat.max_distance_px>1200)fail('OWNER_DISTANCE_REQUIRED');
 const [cx,cy,width,height]=spec.box??[];if(![cx,cy,width,height].every(Number.isFinite)||width<=0||height<=0||!Number.isInteger(spec.layer))fail('GEOMETRY_INVALID');
 const state={asset:assetId,transform:{x:cx-width/2,y:cy-height/2,width,height},layer:spec.layer};
 const entity={id:spec.entity_id,kind:'effect',visual_role:'effect',initial_state:'off',states:{off:{...structuredClone(state),visible:false},on:{...structuredClone(state),visible:true}},metadata:{effect_id:spec.id,locus:spec.locus}};
 const events=[['enter','off','on',enter,'pop-in'],['release','on','off',release,'fade-out']].map(([action,before,after,anchor,preset])=>({id:`${scene.id}__${spec.entity_id}__${action}`,target:spec.entity_id,action,state_before:before,state_after:after,trigger:anchor.trigger,motion:{preset,duration_frames:8}}));
 const binding={entity:spec.entity_id,anchor:owner,relation:'emitted_by',max_distance_px:beat.max_distance_px};
 for(const event of scene.events??[])if(event.target===spec.entity_id||events.some(e=>e.id===event.id)){if(!events.some(e=>isDeepStrictEqual(e,event)))fail('EVENT_CONFLICT '+event.id);}
 for(const b of scene.spatial_bindings??[])if(b.entity===spec.entity_id&&!isDeepStrictEqual(b,binding))fail('BINDING_CONFLICT');
 return {entity,events,binding};
}
export function validateEffectLifecycle(scene,beat,assets){
 const e=scene.entities?.find(e=>e.id===beat.entity_id),events=(scene.events??[]).filter(ev=>ev.target===beat.entity_id);
 if(!e||e.kind!=='effect'||e.states?.[e.initial_state]?.visible!==false)fail('INITIAL_EFFECT_NOT_HIDDEN');
 let active=e.initial_state;for(const ev of events){if(ev.state_before!==active||!e.states?.[ev.state_after])fail('STATE_CHAIN_INVALID');active=ev.state_after;}
 if(events.length!==2)fail('LIFECYCLE_EVENT_COUNT');
 for(const [action,text,occurrence,visible] of [['enter',beat.voice_anchor,beat.enter_occurrence,true],['release',beat.release_anchor,beat.release_occurrence,false]]){
  const matching=events.filter(ev=>ev.action===action);if(matching.length!==1)fail('LIFECYCLE_MISSING');const ev=matching[0],anchor=resolveEffectAnchor(String(scene.voice??''),text,occurrence);
  const trigger=ev.trigger??{};if((trigger.source??trigger.type)!=='voice_anchor'||trigger.text!==anchor.trigger.text||(trigger.occurrence??1)!==(anchor.trigger.occurrence??1))fail('LIFECYCLE_TRIGGER_DRIFT');
  if(e.states[ev.state_after].visible!==visible)fail('LIFECYCLE_VISIBILITY');
 }
 const a=resolveEffectAnchor(scene.voice,beat.voice_anchor,beat.enter_occurrence),b=resolveEffectAnchor(scene.voice,beat.release_anchor,beat.release_occurrence);if(b.position<=a.position)fail('LIFECYCLE_ORDER');
 if(assets?.[e.states?.on?.asset]?.category!=='effect')fail('NATIVE_ASSET_MISSING');
 if(!scene.spatial_bindings?.some(binding=>binding.entity===e.id&&binding.anchor!==e.id&&scene.entities.some(actor=>actor.id===binding.anchor)))fail('OWNER_MISSING');
 return {ok:true};
}
