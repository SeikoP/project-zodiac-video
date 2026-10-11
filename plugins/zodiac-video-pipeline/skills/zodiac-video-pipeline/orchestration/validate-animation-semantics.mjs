#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseZip} from './zip-core-v2.mjs';

const categoryForPath=(value)=>{
  const p='/'+String(value??'').replaceAll('\\','/').replace(/^\/+/, '').toLowerCase();
  for(const [folder,category] of [['/characters/','character'],['/effects/','effect'],['/props/','prop'],['/environment/','environment'],['/environments/','environment']])if(p.includes(folder))return category;
  return null;
};
const center=state=>{
  const t=state?.transform;
  return t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))?[t.x+t.width/2,t.y+t.height/2]:null;
};
const semver=s=>String(s??'').match(/^(\d+)\.(\d+)\.(\d+)(?:$|[-+])/)?.slice(1).map(Number)??null;
const atLeast=(s,major,minor,patch)=>{const v=semver(s);return !!v&&(v[0]>major||v[0]===major&&(v[1]>minor||v[1]===minor&&v[2]>=patch));};
export function lintSemanticAnimation(ir){
  const diagnostics=[],assets=ir?.assets??{};
  const add=(code,severity,scene,entity,detail='')=>diagnostics.push({code,severity,scene,entity,detail});
  for(const [id,a] of Object.entries(assets)){
    const inferred=categoryForPath(a.path);
    if(inferred&&a.category!==inferred)add('ASSET_CATEGORY_MISMATCH','P1',null,id,`path=${a.path} expected=${inferred} actual=${a.category}`);
  }
  for(const scene of ir?.scenes??[]){
    const entities=new Map((scene.entities??[]).map(e=>[e.id,e]));
    const events=scene.events??[],targets=new Set(events.map(e=>e.target));
    const bindings=new Map((scene.spatial_bindings??[]).map(b=>[b.entity,b]));
    for(const entity of entities.values()){
      const states=entity.states??{},kinds=new Set(Object.values(states).map(s=>categoryForPath(assets[s.asset]?.path)).filter(Boolean));
      if(kinds.size>1)add('ENTITY_MIXED_CATEGORIES','P1',scene.id,entity.id);
      const kind=[...kinds][0];
      if(kind==='effect'){
        if(!targets.has(entity.id))add('EFFECT_UNSCHEDULED','P1',scene.id,entity.id,'effect requires an authored event');
        else {
          if(states[entity.initial_state]?.visible!==false)add('EFFECT_VISIBLE_BEFORE_EVENT','P1',scene.id,entity.id);
          if(!events.some(e=>e.target===entity.id&&states[e.state_after]?.visible===false))add('EFFECT_NO_RELEASE','P1',scene.id,entity.id);
        }
      }else if(kind==='prop'&&!targets.has(entity.id)){
        const relation=bindings.get(entity.id)?.relation;
        // A single-state visible prop may remain spatially held while the owning
        // character executes the approved gesture. It does not need a second
        // duplicated prop event; complex or unowned interactive props still fail.
        const anchorId=bindings.get(entity.id)?.anchor;
        const anchor=entities.get(anchorId);
        const ownerCategory=anchor&&new Set(Object.values(anchor.states??{}).map(s=>categoryForPath(assets[s.asset]?.path)));
        const ownerIsCharacter=ownerCategory?.size===1&&ownerCategory.has('character');
        const ownerMoves=events.some(e=>e.target===anchorId&&e.state_before!==e.state_after);
        const singleStaticState=Object.keys(states).length===1&&Object.values(states)[0]?.visible!==false;
        if(relation==='held_by'&&singleStaticState&&ownerIsCharacter&&ownerMoves)
          add('STATIC_HELD_PROP_OWNER_GESTURE','P2',scene.id,entity.id,'static held prop is anchored to the character gesture; runner spatial timing still requires review');
        else if(['held_by','points_to'].includes(relation))add('INTERACTIVE_PROP_UNSCHEDULED','P1',scene.id,entity.id);
        else add('PROP_STATIC_REVIEW','P2',scene.id,entity.id,'verify intentional stillness');
      }else if(kind==='character'&&Object.keys(states).length>1&&!targets.has(entity.id))add('UNUSED_CHARACTER_STATES','P2',scene.id,entity.id);
    }
    for(const b of scene.spatial_bindings??[]){
      const subject=entities.get(b.entity),anchor=entities.get(b.anchor);
      if(!subject||!anchor)continue;
      for(const [stateName,state] of Object.entries(subject.states??{})){
        if(state.visible===false)continue;
        const src=center(state);if(!src)continue;
        for(const [anchorState,other] of Object.entries(anchor.states??{})){
          if(other.visible===false)continue;
          const dst=center(other);if(!dst)continue;
          if(Math.hypot(src[0]-dst[0],src[1]-dst[1])>b.max_distance_px)
            add('SPATIAL_BOUND_EXCEEDED','P1',scene.id,b.entity,`${stateName}->${b.anchor}:${anchorState}`);
        }
      }
    }
    if(scene.caption_timing_status==='estimated_not_audio_aligned')add('TIMING_UNMEASURED','P2',scene.id,null,'requires measured audio timing at render');
  }
  return diagnostics;
}
export async function validateSemanticZip(zipPath){
  const entries=parseZip(await readFile(zipPath));
  const get=name=>JSON.parse(entries.find(e=>e.rel===name)?.data.toString('utf8')??'null');
  const manifest=get('package-manifest.json'),ir=get('production.ir.json');
  if(!manifest||!ir)throw new Error('SEMANTIC_QC_INVALID: missing manifest/authoring IR');
  const findings=lintSemanticAnimation(ir),strict=atLeast(manifest.producer?.version,2,2,3),errors=findings.filter(f=>f.severity==='P1');
  if(errors.length&&strict)throw new Error('SEMANTIC_QC_INVALID: '+JSON.stringify(errors.slice(0,20)));
  return {strict,errors,findings};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const zip=process.argv[2];if(!zip){console.error('Usage: node validate-animation-semantics.mjs <job@5.zip>');process.exit(2);}
  try{const result=await validateSemanticZip(zip);
    console.log(JSON.stringify({status:result.errors.length?'LEGACY_REVIEW_REQUIRED':'PASS',strict:result.strict,counts:{P1:result.errors.length,P2:result.findings.length-result.errors.length},findings:result.findings},null,2));
  }catch(e){console.error(e.message);process.exit(1);}
}
