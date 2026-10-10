#!/usr/bin/env node
// Read-only context loading plan. No capability, validator, gate or approval is waived.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestByPhase={'01-content':'01-content.json','02-visual-production':'02-visual-production.json','03-handoff':'03-handoff.json'};
export function planStepContext(manifest, stepId, flags={}) {
 const step=manifest?.steps?.find(s=>s.id===stepId);
 if(!step)throw new Error('CONTEXT_STEP_NOT_FOUND '+stepId);
 const active=c=>{
   if(!c.when||c.when==='always')return true;
   if(!String(c.when).startsWith('flag:'))throw new Error('CONTEXT_CONDITION_UNSUPPORTED '+c.id+' '+c.when);
   const key=String(c.when).slice(5);
   if(!(key in flags))throw new Error('CONTEXT_FLAG_UNKNOWN '+key);
   if(typeof flags[key]!=='boolean')throw new Error('CONTEXT_FLAG_INVALID '+key);
   return flags[key];
 };
 const caps=[...(step.required_capabilities??[]),...(step.conditional_capabilities??[]).filter(active)];
 const entry=caps.filter(c=>c.stage==='entry');
 const refs=[...new Set([...entry.map(c=>c.guidance_uri).filter(Boolean),...(step.load_references??[])])];
 const output={format:'zodiac-step-context-plan@1',phase:manifest.id,step:step.id,
   required_references:refs,required_entry_capabilities:entry.map(c=>c.id),
   deferred_exit_capabilities:caps.filter(c=>c.stage==='exit').map(c=>c.id),
   allowed_context_categories:step.allowed_context_categories??[],
   forbidden_context_categories:step.forbidden_context_categories??[],
   required_outputs:step.required_outputs??[],
   retention_policy:'only approved content hashes, source paths, explicit decisions, blockers, real receipts',
   no_validation_changes:true,no_approval_changes:true,
   note:'This plans reference loading. Required capabilities still need genuine invocation and receipts.'};
 return output;
}
export async function loadStepContext(phase,step,flags={}){
 if(!manifestByPhase[phase])throw new Error('CONTEXT_PHASE_UNKNOWN '+phase);
 const manifest=JSON.parse(await readFile(path.join(skill,'orchestration/phases',manifestByPhase[phase]),'utf8'));
 return planStepContext(manifest,step,flags);
}
const self=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self){try{
 const args=process.argv.slice(2),phase=args[0],step=args[1],at=args.indexOf('--flags');
 if(!phase||!step)throw new Error('Usage: node plan-step-context.mjs <phase> <step> [--flags <flags.json>]');
 const rawFlags=at>=0?JSON.parse(await readFile(path.resolve(args[at+1]),'utf8')):{};
 const flags=rawFlags.flags??rawFlags;
 console.log(JSON.stringify(await loadStepContext(phase,step,flags),null,2));
}catch(e){console.error('CONTEXT_PLAN_BLOCKED '+e.message);process.exitCode=2;}}
