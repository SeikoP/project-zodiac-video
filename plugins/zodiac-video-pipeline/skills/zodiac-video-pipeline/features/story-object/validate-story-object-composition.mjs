#!/usr/bin/env node
// Story Object Composition v2: authored metaphor is a symbolic narrative entity, never a backdrop.
// Operates on V4 production source; emits no new Job@5/runtime fields.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MODES=new Set(['thought_metaphor','physical_interaction','visual_cutaway']);
const SCENE_SIZE=1080*1920;
const isRect=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;
const intersection=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const actualStates=e=>Object.entries(e?.states??{}).filter(([,v])=>v?.visible!==false);
const rects=e=>actualStates(e).map(([name,state])=>({name,rect:state.transform}));
const envIds=scene=>new Map(Object.entries(scene.environment?.roles??{}).flatMap(([role,ids])=>(ids??[]).map(id=>[id,role])));
const issue=(rows,code,at)=>rows.push({code,at});
const actor=e=>e?.kind==='character';
const hasCast=(scene)=>scene?.entities?.some(e=>actor(e)&&actualStates(e).length);
function freshV2411(state){
 const v=/^(\d+)\.(\d+)\.(\d+)/.exec(String(state?.plugin_version??''));
 return state?.run_mode==='fresh'&&v&&(Number(v[1])>2||Number(v[1])===2&&(Number(v[2])>4||Number(v[2])===4&&Number(v[3])>=11));
}
export function validateStoryObjectComposition(plan,production,{required=true}={}){
 const issues=[];
 const scenes=production?.scenes??[];
 const sceneById=new Map(scenes.map((s,i)=>[s.id,{scene:s,index:i}]));
 const beats=plan?.beats??[];
 let checked=0;
 for(const beat of beats){
  const at=String(beat?.beat_id??'unknown'),mode=beat?.presentation_mode;
  if(!mode){if(required)issue(issues,'STORY_OBJECT_PRESENTATION_MODE_MISSING',at);continue;}
  if(!MODES.has(mode)){issue(issues,'STORY_OBJECT_PRESENTATION_MODE_INVALID',at);continue;}
  checked++;
  const entry=sceneById.get(beat.scene_id);
  if(!entry){issue(issues,'STORY_OBJECT_SCENE_MISSING',at);continue;}
  const scene=entry.scene,entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
  const story=entities.get(beat.object_entity);
  if(!story){issue(issues,'STORY_OBJECT_ENTITY_MISSING',at);continue;}
  const categories=new Set(Object.values(story.states??{}).map(s=>production.assets?.[s.asset]?.category).filter(Boolean));
  if(mode==='physical_interaction'&&[...categories].some(c=>c!=='prop'))issue(issues,'STORY_OBJECT_PHYSICAL_ASSET_INVALID',at);
  if(!['story_object','prop','object','interactive_prop','effect'].includes(story.kind))issue(issues,'STORY_OBJECT_KIND_INVALID',at);
  const environmentRole=envIds(scene).get(story.id);
  if(environmentRole)issue(issues,'STORY_OBJECT_USED_AS_ENVIRONMENT',`${at}/${environmentRole}`);
  const slot=(scene.environment?.frame?.slots??[]).find(s=>s.entity===story.id);
  if(slot&&['background','rear','wallpaper','grounding','environment'].includes(slot.role))issue(issues,'STORY_OBJECT_USED_AS_BACKDROP_SLOT',at);
  const states=rects(story);
  if(!states.length)issue(issues,'STORY_OBJECT_NOT_VISIBLE',at);
  const cast=(scene.entities??[]).filter(actor).filter(e=>actualStates(e).length);
  const bindings=(scene.spatial_bindings??[]).filter(b=>b.entity===story.id);
  if(mode==='visual_cutaway'){
   if(!beat.cutaway_return_scene_id){issue(issues,'STORY_OBJECT_CUTAWAY_RETURN_MISSING',at);continue;}
   const reentry=sceneById.get(beat.cutaway_return_scene_id);
   if(!reentry||reentry.index<=entry.index||!hasCast(reentry.scene))issue(issues,'STORY_OBJECT_CUTAWAY_RETURN_INVALID',at);
  }else{
   if(cast.length===0)issue(issues,'STORY_OBJECT_ACTOR_MISSING',at);
   const validLinks=bindings.filter(b=>{
    const anchor=entities.get(b.anchor);
    if(!anchor||b.anchor===story.id)return false;
    if(mode==='thought_metaphor')return actor(anchor)&&['near','emitted_by'].includes(b.relation);
    return ['held_by','on_surface'].includes(b.relation);
   });
   if(!validLinks.length)issue(issues,'STORY_OBJECT_RELATION_MISSING',at);
   if(mode==='thought_metaphor'&&validLinks.length){
    const current=Object.fromEntries((scene.entities??[]).map(e=>[e.id,e.initial_state??Object.keys(e.states??{})[0]]));
    const supported=()=>story.states?.[current[story.id]]?.visible===false||validLinks.some(b=>entities.get(b.anchor)?.states?.[current[b.anchor]]?.visible!==false);
    let unsupported=!supported();
    for(const e of scene.events??[]){if(e.target&&e.state_after)current[e.target]=e.state_after;if(!supported())unsupported=true;}
    if(unsupported)issue(issues,'STORY_OBJECT_VISIBLE_ANCHOR_MISSING',at);
   }
   for(const {name,rect} of states){
    if(!isRect(rect)){issue(issues,'STORY_OBJECT_GEOMETRY_MISSING',`${at}/${name}`);continue;}
    if(rect.width*rect.height/SCENE_SIZE>0.42)issue(issues,'STORY_OBJECT_BACKDROP_TAKEOVER',`${at}/${name}`);
    const overlapLimit=mode==='thought_metaphor'?0.30:0.48;
    for(const c of cast){
     for(const [cName,cState] of actualStates(c)){
      const cr=cState.transform;
      if(isRect(cr)&&intersection(rect,cr)/(cr.width*cr.height)>overlapLimit){issue(issues,'STORY_OBJECT_OCCLUDES_CHARACTER',`${at}/${name}/${c.id}/${cName}`);break;}
     }
    }
   }
  }
 }
 return {format:'zodiac-story-object-composition-qc@2',status:issues.length?'BLOCKED':checked?'PASS':'LEGACY_NOT_APPLICABLE',checked,issues};
}
export async function validateStoryObjectCompositionWorkspace(workspace,{writeReceipt=false}={}){
 const root=path.resolve(workspace),a=path.join(root,'.authoring');
 const [spec,source,stateText]=await Promise.all([
  readFile(path.join(a,'story-object-plan.json'),'utf8').catch(e=>e.code==='ENOENT'?null:Promise.reject(e)),
  readFile(path.join(root,'production.json'),'utf8'),
  readFile(path.join(a,'pipeline-state.json'),'utf8').catch(e=>e.code==='ENOENT'?null:Promise.reject(e))
 ]);
 const state=stateText?JSON.parse(stateText):{};
 const intent=await readFile(path.join(a,'visual-intent.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(intent?.story_object_decision?.mode==='omitted'){if(state.flags?.story_object_required===true)throw Error('STORY_OBJECT_DECISION_FLAG_CONFLICT');if(!intent.story_object_decision.reason?.trim()||!intent.story_object_decision.review_ref?.trim())throw Error('STORY_OBJECT_DECISION_INVALID');return {format:'zodiac-story-object-composition-qc@2',status:'OMITTED_EXPLICIT',issues:[]};}
 // Existing sealed jobs / older plugin releases remain importable.
 const required=Boolean(freshV2411(state));
 if(!spec){
  if(required)throw Error('STORY_OBJECT_COMPOSITION_PLAN_MISSING');
  return {format:'zodiac-story-object-composition-qc@2',status:'LEGACY_NOT_APPLICABLE',checked:0,issues:[]};
 }
 const result=validateStoryObjectComposition(JSON.parse(spec),JSON.parse(source),{required});
 if(writeReceipt){await mkdir(a,{recursive:true});await writeFile(path.join(a,'story-object-composition-qc.json'),JSON.stringify(result,null,2)+'\n');}
 if(result.status==='BLOCKED')throw Error('STORY_OBJECT_COMPOSITION_BLOCKED '+result.issues.map(x=>x.code+':'+x.at).join(','));
 return result;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 if(!process.argv[2]){console.error('Usage: node validate-story-object-composition.mjs <workspace> [--write]');process.exitCode=2;}
 else try{console.log(JSON.stringify(await validateStoryObjectCompositionWorkspace(process.argv[2],{writeReceipt:process.argv.includes('--write')})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
