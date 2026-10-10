#!/usr/bin/env node
// Persist a real agent-authored, four-part Phase02 payload with an immutable
// approved narration precondition; never generate fictional creative inputs.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,open,rm,rename,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const decode=async p=>JSON.parse(await readFile(p,'utf8'));
const normalized=s=>String(s).replaceAll('\r\n','\n').replaceAll('\r','\n').trimEnd();
const fileMap=[['production','production.json'],['asset_plan','asset-plan.json'],['visual_grammar_plan','visual-grammar-plan.json'],['character_assembly_plan','.authoring/character-assembly-plan.json']];
export function assessAuthoringPayload(payload,{narration,pluginVersion,state}){
 const issues=[];
 const fail=(code,detail={})=>issues.push({code,...detail});
 if(payload?.format!=='zodiac-phase02-authored-handoff@1')fail('HANDOFF_FORMAT_INVALID');
 if(payload?.plugin_version!==pluginVersion)fail('PLUGIN_VERSION_MISMATCH');
 if(payload?.approved_narration_sha256!==sha(Buffer.from(narration)))fail('APPROVED_NARRATION_CHANGED');
 const phase1=state?.phases?.['01-content'];
 if(!['PASS','SKIPPED_REUSED'].includes(phase1?.status))fail('CONTENT_NOT_APPROVED');
 if(!state?.review_receipts?.some(r=>r.phase_id==='01-content'&&r.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof.ref==='string'&&r.proof.ref.trim()&&!r.proof.ref.includes('<')))fail('CONTENT_APPROVAL_MISSING');
 const p=payload?.production;
 if(!p||p.version!=='2.0'||!Array.isArray(p.scenes)||p.scenes.length===0)fail('SCENE_AUTHORING_REQUIRED');
 else {
  const voices=p.scenes.map(x=>String(x.voice??''));
  if(voices.some(s=>!s.trim())||normalized(voices.join('\n'))!==normalized(narration))fail('SCENE_VOICE_DOES_NOT_MATCH_APPROVED_NARRATION');
  if(!p.assets||typeof p.assets!=='object'||!Object.keys(p.assets).length)fail('PRODUCTION_ASSETS_REQUIRED');
  if(p.video?.width!==1080||p.video?.height!==1920||![24,30].includes(p.video?.fps))fail('PRODUCTION_VIDEO_CONTRACT_MISSING');
  for(const scene of p.scenes){
   if(!scene.id||!Array.isArray(scene.entities)||!scene.entities.length||!Array.isArray(scene.events))fail('SCENE_DIRECTOR_STRUCTURE_MISSING',{scene:scene.id??null});
   const actors=new Set((scene.entities??[]).map(e=>e.id));
   for(const entity of scene.entities??[])if(!entity.id||!entity.initial_state||!entity.states?.[entity.initial_state])fail('SCENE_ENTITY_STATE_INCOMPLETE',{scene:scene.id,entity:entity.id??null});
   for(const ev of scene.events??[]){
    if(!ev.id||!ev.target||!actors.has(ev.target)||!ev.state_before||!ev.state_after||!ev.trigger)fail('SCENE_EVENT_INCOMPLETE',{scene:scene.id,event:ev.id??null});
    if(ev.trigger?.type==='voice_anchor'&&(!ev.trigger.text||!scene.voice.includes(ev.trigger.text)))fail('VOICE_ANCHOR_NOT_IN_SCENE',{scene:scene.id,event:ev.id});
   }
  }
 }
 for(const [key] of fileMap.slice(1))if(!payload?.[key]||typeof payload[key]!=='object'||Array.isArray(payload[key])||!Object.keys(payload[key]).length)fail('AUTHORING_PLAN_MISSING',{key});
 const grammar=payload?.visual_grammar_plan;
 if(grammar?.format!=='zodiac-visual-grammar-plan@1'||!Array.isArray(grammar.scenes)||!grammar.scenes.length)
  fail('VISUAL_GRAMMAR_PLAN_INCOMPLETE');
 else for(const scene of p?.scenes??[])if(!grammar.scenes.some(x=>x.scene_id===scene.id&&x.frame_id&&x.mechanic_id))
  fail('VISUAL_GRAMMAR_SCENE_MISSING',{scene:scene.id});
 const asset=payload?.asset_plan?.semantic_asset_fit;
 if(asset?.format!=='zodiac-semantic-asset-plan@1'||!Array.isArray(asset.decisions))fail('SEMANTIC_ASSET_PLAN_INCOMPLETE');
 else if((p?.scenes??[]).some(s=>(s.entities??[]).some(e=>e.kind==='object'&&!/^env_|^decor_|^ground_/u.test(e.id)))&&!asset.decisions.length)
  fail('STORY_OBJECT_SEMANTIC_DECISIONS_MISSING');
 const cast=payload?.character_assembly_plan;
 if(cast?.format!=='zodiac-character-assembly-plan@2'||!Array.isArray(cast.characters))fail('CHARACTER_ASSEMBLY_PLAN_INCOMPLETE');
 else for(const id of new Set((p?.scenes??[]).flatMap(s=>(s.entities??[]).filter(e=>e.kind==='character').map(e=>e.id)))){
  if(!cast.characters.some(c=>c.entity_id===id&&c.design_intent))fail('CHARACTER_DESIGN_INTENT_MISSING',{entity:id});
 }
 if(fileMap.some(([key])=>payload?.[key]?.status==='DRAFT'))fail('DRAFT_AUTHORING_NOT_EXECUTABLE');

 return {status:issues.length?'BLOCKED':'AUTHORING_PAYLOAD_VALID',issues,files:fileMap.map(([,name])=>name),not_compiled:true};
}
export async function writePhase02Authoring({workspace,payloadPath}){
 const root=path.resolve(workspace);const dir=path.join(root,'.authoring');await mkdir(dir,{recursive:true});
 const leasePath=path.join(dir,'.phase02-authoring-write.lock');const lease=await open(leasePath,'wx').catch(e=>{throw new Error('AUTHORING_WRITE_BUSY '+e.code)});
 const staged=[],committed=[];
 try{
  const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../plugin.json');
  const manifest=await decode(pkg),statePath=path.join(dir,'pipeline-state.json'),stateBytes=await readFile(statePath),state=JSON.parse(stateBytes);
  const source=await readFile(path.join(root,'narration.txt'),'utf8');
  const payload=await decode(payloadPath);
  const verdict=assessAuthoringPayload(payload,{narration:source,pluginVersion:manifest.version,state});
  if(verdict.status==='BLOCKED')throw new Error('AUTHORING_PAYLOAD_BLOCKED '+JSON.stringify(verdict.issues));
  const outputs=[];
  for(const [key,rel] of fileMap){
   const target=path.join(root,rel),data=JSON.stringify(payload[key],null,2)+'\n';
   let alreadyPresent=false;
   try{
    const st=await lstat(target);
    if(!st.isFile()||st.isSymbolicLink())throw new Error('AUTHORING_TARGET_UNSAFE '+rel);
    if((await readFile(target,'utf8'))!==data)throw new Error('AUTHORING_REVISION_REQUIRED '+rel);
    alreadyPresent=true;
   }catch(e){if(e.code!=='ENOENT')throw e;}
   outputs.push({rel,target,data,alreadyPresent,sha256:sha(Buffer.from(data))});
  }
  // Re-read approved source/state before mutating: concurrent edits fail closed.
  if(sha(Buffer.from(await readFile(path.join(root,'narration.txt'))))!==payload.approved_narration_sha256)throw new Error('NARRATION_CHANGED_CONCURRENTLY');
  if(sha(await readFile(statePath))!==sha(stateBytes))throw new Error('STATE_CHANGED_CONCURRENTLY');
  for(const o of outputs.filter(o=>!o.alreadyPresent)){await mkdir(path.dirname(o.target),{recursive:true});const tmp=o.target+'.staged-'+process.pid;await writeFile(tmp,o.data,'utf8');staged.push({tmp,...o});}
  for(const o of staged){await rename(o.tmp,o.target);committed.push(o);}
  return {status:'AUTHORING_WRITTEN_NOT_COMPILED',files:outputs.map(o=>({path:o.rel,sha256:o.sha256})),next:'Run strict execution-preflight and native Phase02 compilers; do not mark PASS.'};
 }catch(e){for(const o of committed.reverse())await rm(o.target,{force:true});throw e;}
 finally{for(const o of staged)await rm(o.tmp,{force:true});await lease.close();await rm(leasePath,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),idx=k=>args.indexOf(k),w=args[idx('--workspace')+1],p=args[idx('--payload')+1];
 if(idx('--workspace')<0||idx('--payload')<0||!w||!p){console.error('Usage: node write-phase02-authoring.mjs --workspace <dir> --payload <agent-authored.json>');process.exitCode=2;}
 else writePhase02Authoring({workspace:w,payloadPath:p}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=2});
}
