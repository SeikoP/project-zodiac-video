#!/usr/bin/env node
// Authoring seam validation BEFORE costly native SVG compilation. No generated receipts.
import {validateComposition,designToken,compositionHash} from './phase02-composition.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const normal=s=>String(s??'').normalize('NFC').replace(/\s+/gu,' ').trim();
const compact=s=>normal(s).replace(/\s+/gu,'');
const furniture=/(?:^|[^\p{L}\p{N}])(?:desk|table|bed|chair|sofa|pillow|blanket|cabinet|headboard|bàn|ghế|giường|gối|chăn)(?=$|[^\p{L}\p{N}])/iu;
export function validatePrecompileBoundary(production,narration){
 const issues=[];
 const scenes=production?.scenes??[];
 const voices=scenes.map(x=>normal(x.voice));
 const canonical=normal(narration);
 if(compact(voices.join(''))!==compact(canonical))issues.push({code:'NARRATION_SCENE_MISMATCH',detail:'ordered scene speech must equal approved narration'});
 // Preserve approved paragraph boundaries. Individual scenes can include one or multiple full paragraphs.
 const paragraphs=String(narration).replace(/\r\n/g,'\n').split(/\n\s*\n/u).map(normal).filter(Boolean);
 let paragraphIndex=0,buffer='';
 for(const scene of scenes){
  buffer=normal(buffer+' '+scene.voice);
  if(!buffer)continue;
  while(paragraphIndex<paragraphs.length && compact(buffer).startsWith(compact(paragraphs[paragraphIndex]))){
   const p=paragraphs[paragraphIndex];
   // Consume by normalized character count, preventing mid-paragraph seams.
   const re=normal(buffer),n=compact(p).length;
   let pos=0,count=0;
   while(pos<re.length&&count<n){if(!/\s/u.test(re[pos]))count++;pos++;}
   buffer=normal(re.slice(pos));paragraphIndex++;
  }
  if(buffer && paragraphIndex<paragraphs.length){
   const expected=compact(paragraphs[paragraphIndex]);
   if(expected.startsWith(compact(buffer)))issues.push({code:'SCENE_PARAGRAPH_SPLIT',scene_id:scene.id,paragraph_index:paragraphIndex});
   else issues.push({code:'SCENE_PARAGRAPH_BOUNDARY',scene_id:scene.id,paragraph_index:paragraphIndex});
  }
 }
 for(const scene of scenes){
  const entityIds=new Set((scene.entities??[]).map(e=>String(e.id)));
  for(const event of scene.events??[]){
   if(event.target && !entityIds.has(String(event.target)))issues.push({code:'EVENT_TARGET_NOT_IN_SCENE',scene_id:scene.id,event_id:event.id,target:event.target});
   if(event.trigger?.type==='voice_anchor' && event.trigger.text && !normal(scene.voice).includes(normal(event.trigger.text)))issues.push({code:'EVENT_VOICE_ANCHOR_NOT_IN_SCENE',scene_id:scene.id,event_id:event.id,anchor:event.trigger.text});
  }
  const entities=new Map((scene.entities??[]).map(e=>[String(e.id),e]));
  for(const event of scene.events??[]){
   const target=entities.get(String(event.target??''));
   if(target?.states){
    for(const stateName of ['state_before','state_after']){
     if(event[stateName] && !Object.hasOwn(target.states,event[stateName]))issues.push({code:'EVENT_STATE_NOT_DECLARED',scene_id:scene.id,event_id:event.id,state:event[stateName]});
    }
   }
  }
  // An effect explicitly bound to a hidden object may not fire before its reveal.
  for(const effect of scene.entities??[]){
   if(effect.kind!=='effect'||!effect.source_object_id)continue;
   const owner=entities.get(String(effect.source_object_id));
   if(!owner||owner.states?.[owner.initial_state]?.visible!==false)continue;
   const revealIndex=(scene.events??[]).findIndex(ev=>ev.target===owner.id && ev.state_after && owner.states?.[ev.state_after]?.visible!==false);
   const effectIndex=(scene.events??[]).findIndex(ev=>ev.target===effect.id);
   if(effectIndex>=0&&(revealIndex<0||effectIndex<revealIndex))issues.push({code:'EFFECT_PRECEDES_OBJECT',scene_id:scene.id,effect_id:effect.id,object_id:owner.id});
  }
  // Geometry-only early warning for furniture covering the performer's face.
  const boxes=(entity)=>Object.values(entity.states??{}).map(st=>st?.transform??entity.transform).filter(t=>t&&[t.x,t.y,t.width,t.height].every(Number.isFinite));
  const people=(scene.entities??[]).filter(e=>e.kind==='character');
  for(const prop of scene.entities??[]){
   if(prop.kind==='character'||!furniture.test(String(prop.id??'')))continue;
   for(const person of people){
    if(Number.isFinite(prop.layer)&&Number.isFinite(person.layer)&&prop.layer<person.layer)continue;
    for(const actor of boxes(person))for(const item of boxes(prop)){
     const face={x:actor.x+actor.width*.2,y:actor.y+actor.height*.04,width:actor.width*.6,height:actor.height*.31};
     const intersection=Math.max(0,Math.min(face.x+face.width,item.x+item.width)-Math.max(face.x,item.x))*Math.max(0,Math.min(face.y+face.height,item.y+item.height)-Math.max(face.y,item.y));
     if(intersection/(face.width*face.height)>0.2){issues.push({code:'PROP_OCCLUDES_CHARACTER_FACE',scene_id:scene.id,entity_id:prop.id,character_id:person.id});break;}
    }
   }
  }
  const roles=scene.environment?.roles??{};
  const envRoleIds=new Set(Object.values(roles).flat());
  for(const entity of scene.entities??[]){
   const id=String(entity.id??'');
   const ownsEnvironment=id.startsWith('env__')||envRoleIds.has(id);
   const assetIds=Object.values(entity.states??{}).map(s=>String(s.asset??''));
   const assetMetadata=assetIds.map(id=>production.assets?.[id]??{});
   const authoredFurniture=furniture.test(id)||assetMetadata.some(a=>furniture.test(`${a.path??''} ${a.lineage?.source_master??''}`));
   if(ownsEnvironment&&authoredFurniture)issues.push({code:'BACKGROUND_FURNITURE_OWNERSHIP',scene_id:scene.id,entity_id:id});
  }
 }
 return {format:'zodiac-precompile-seam-qc@1',status:issues.length?'BLOCKED':'PASS',scenes:scenes.length,paragraphs:paragraphs.length,issues};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-phase02-precompile-boundary.mjs <workspace>');process.exit(2);}
 try{const [p,n]=await Promise.all([readFile(path.join(root,'production.json'),'utf8'),readFile(path.join(root,'narration.txt'),'utf8')]);const r=validatePrecompileBoundary(JSON.parse(p),n);const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));
 await (await import('./episode-handoff.mjs')).episodeHandoffWorkspace(root);
 const version=String(state.plugin_version??'').split('.').map(Number);
 if(state.run_mode==='fresh'&&(version[0]>2||(version[0]===2&&(version[1]>4||version[1]===4&&version[2]>=47)))){let rawPlan;try{rawPlan=await readFile(path.join(root,'.authoring/narrative-plan.json'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;rawPlan=await readFile(path.join(root,'narrative-plan.json'),'utf8');}const rhythm=JSON.parse(rawPlan);if(!['2.0','2.1'].includes(rhythm.version))throw Error('NARRATIVE_V2_REQUIRED');(await import('./compile-narration-performance.mjs')).compileNarrationPerformance(JSON.parse(p),rhythm,n);}
 if(version[0]>2 || (version[0]===2&&(version[1]>4||(version[1]===4&&version[2]>=44)))){
  const [plan,design]=await Promise.all([readFile(path.join(root,'.authoring/scene-art-direction.json'),'utf8'),readFile(path.join(root,'design.md'),'utf8')]);
  const modern=version[0]>2||(version[0]===2&&(version[1]>4||(version[1]===4&&version[2]>=46)));
  const authored=JSON.parse(plan);
  if(modern&&state.run_mode==='fresh'&&authored.composition_stage!=='intent')throw Error('COMPOSITION_INTENT_MIGRATION_REQUIRED');
  const composition=authored.composition_stage==='intent'?await (await import('./resolve-scene-composition.mjs')).validateCompositionIntent(JSON.parse(p),authored,designToken(design)):validateComposition(JSON.parse(p),authored,designToken(design));
  const canonicalToken=designToken(await readFile(new URL('../references/design.md',import.meta.url),'utf8'));
  if(compositionHash(designToken(design))!==compositionHash(canonicalToken))r.issues.push({code:'COMPOSITION_CANONICAL_TOKEN_DRIFT'});
  r.issues.push(...composition.issues);r.status=r.issues.length?'BLOCKED':'PASS';
 }
 console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
