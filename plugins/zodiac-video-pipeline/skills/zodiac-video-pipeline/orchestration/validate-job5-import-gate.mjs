#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Match the local runner's unicode \w+ / casefold token-matching semantics.
const tokens = value => [...String(value??'').toLocaleLowerCase('vi').matchAll(/[\p{L}\p{N}_]+/gu)].map(x=>x[0]);
const matches = (voice, phrase) => {
 const hay=tokens(voice),needle=tokens(phrase),result=[];
 if(!needle.length)return result;
 for(let at=0;at+needle.length<=hay.length;at++)if(needle.every((v,i)=>hay[at+i]===v))result.push(at);
 return result;
};
export function job5ImportDiagnostics(ir){
 const issues=[],add=(scene,event,code,detail,severity='P1')=>issues.push({scene_id:scene,event_id:event,code,severity,detail});
 for(const scene of ir?.scenes??[]){
  const positions=new Map();
  for(const event of scene.events??[]){
   const trigger=event.trigger??{};
   if(trigger.type==='scene_start')positions.set(event.id,-1);
   else if(trigger.type==='voice_anchor'){
    const text=String(trigger.text??''),hits=matches(scene.voice??'',text),n=trigger.occurrence;
    if(!hits.length)add(scene.id,event.id,'ANCHOR_NOT_FOUND',`anchor=${JSON.stringify(text)} matches=0`);
    else if(hits.length>1&&n===undefined)add(scene.id,event.id,'ANCHOR_AMBIGUOUS',`anchor=${JSON.stringify(text)} matches=${hits.length}; choose occurrence or unique phrase`);
    else if(n!==undefined&&(!Number.isInteger(n)||n<1||n>hits.length))add(scene.id,event.id,'ANCHOR_OCCURRENCE_INVALID',`anchor=${JSON.stringify(text)} occurrence=${n} matches=${hits.length}`);
    else{
     positions.set(event.id,hits[(n??1)-1]);
     if(tokens(text).length===1)add(scene.id,event.id,'ANCHOR_FRAGILE',`single-word anchor ${JSON.stringify(text)}`,'P2');
    }
   }
   if(event.desired_motion==='state_swap'&&event.state_before===event.state_after)add(scene.id,event.id,'NOOP_STATE_SWAP','same before/after state');
  }
  const bindings=new Map((scene.spatial_bindings??[]).filter(b=>b.relation==='points_to').map(b=>[b.entity,b.anchor]));
  for(const drawing of scene.events??[]){
   if(drawing.desired_motion!=='slide')continue;
   const anchor=bindings.get(drawing.target);if(!anchor)continue;
   for(const marked of scene.events??[]){
    if(marked.target!==anchor||marked.desired_motion!=='state_swap')continue;
    if(positions.has(drawing.id)&&positions.has(marked.id)&&positions.get(drawing.id)>positions.get(marked.id))
     add(scene.id,drawing.id,'EVENT_DEPENDENCY_REVERSED',`slide ${drawing.id} follows mark ${marked.id} on ${anchor}`);
   }
  }
 }
 return issues;
}
export function assertJob5ImportReady(ir){
 const diagnostics=job5ImportDiagnostics(ir),errors=diagnostics.filter(x=>x.severity==='P1');
 if(errors.length){const e=new Error('JOB5_IMPORT_GATE_INVALID: '+errors.map(x=>`${x.scene_id}/${x.event_id}:${x.code}`).join('; '));e.diagnostics=diagnostics;throw e;}
 return {status:'PASS',events:(ir.scenes??[]).reduce((n,s)=>n+(s.events??[]).length,0),warnings:diagnostics};
}
export async function validateJob5Workspace(root){const ir=JSON.parse(await readFile(path.join(root,'production.ir.json'),'utf8'));return assertJob5ImportReady(ir);}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-job5-import-gate.mjs <job5-root>');process.exit(2);}
 try{const r=await validateJob5Workspace(path.resolve(root));console.log(`JOB5_IMPORT_GATE_PASS events=${r.events} warnings=${r.warnings.length}`);}
 catch(e){console.error(e.message);if(e.diagnostics)console.error(JSON.stringify(e.diagnostics,null,2));process.exit(1);}
}
