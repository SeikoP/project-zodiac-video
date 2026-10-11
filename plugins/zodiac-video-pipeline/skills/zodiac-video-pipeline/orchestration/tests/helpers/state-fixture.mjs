// Test-only manifest evidence; never used by production orchestration.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const validator=path.join(root,'validate-pipeline-state.mjs');
const index=JSON.parse(await readFile(path.join(root,'phase-index.json'),'utf8'));
const manifests=new Map();for(const item of index.phases)manifests.set(item.id,JSON.parse(await readFile(path.join(root,item.manifest),'utf8')));
const currentPluginVersion=JSON.parse(await readFile(path.resolve(root,'../../..','plugin.json'),'utf8')).version;
const condition=(when,flags,runMode='fresh')=>{if(!when||when==='always')return true;if(when==='fresh')return runMode==='fresh';if(when==='continuity')return runMode==='continuity';if(when.startsWith('flag:'))return Boolean(flags[when.slice(5)]);throw new Error('unsupported '+when);};
const proofKind=kind=>({external_tool:'tool_result',external_skill:'plugin_result',guidance_skill:'skill_read',internal_reference:'skill_read',internal_compiler:'compiler_result',internal_validator:'validator_result'}[kind]);
const receipt=cap=>({capability_id:cap.id,status:'PASS',provider:'test',guidance_loaded:cap.guidance_uri?true:undefined,application_summary:cap.require_application_summary?'Applied '+cap.id+' output to the active step.':undefined,proof:{kind:proofKind(cap.kind),ref:'proof:'+cap.id}});
const completeStep=(def,flags,runMode='fresh')=>{const caps=[...(def.required_capabilities??[]),...(def.conditional_capabilities??[])].filter(c=>condition(c.when,flags,runMode));const outputs=[...(def.required_outputs??[]),...(def.conditional_outputs??[]).filter(o=>condition(o.when,flags,runMode)).map(o=>o.name)];const gates=[...(def.gate_checks??[]),...(def.conditional_gate_checks??[]).filter(g=>condition(g.when,flags,runMode)).map(g=>g.name)];return {status:'PASS',capability_receipts:caps.map(receipt),context_manifest:[],outputs,gate_results:Object.fromEntries(gates.map(g=>[g,'PASS']))};};
const materialKind=step=>['write_authoring','write_production','write_assets','write_authoring_receipt','write_publish_metadata','write_package_workspace','create_zip','write_series_tracker'].find(k=>(step.allowed_operations??[]).includes(k));
const operationPath=out=>out.endsWith('/**')?out.slice(0,-3)+'/fixture.svg':out==='zodiac-job.zip'?'zodiac-xunu-doi-goc-nhin.zip':out;
export const valid=(overrides={})=>{const runMode=overrides.run_mode??'fresh';const flags={export_zip:true,series_tracker:false,series_auto_select:false,reference_analysis:false,hard_to_extract:false,relational_beats:false,meme_selected:false,content_quality_engine:true,...(overrides.flags??{})};const phases={},operations=[];for(const item of index.phases){const manifest=manifests.get(item.id);const steps={};for(const def of manifest.steps){steps[def.id]=completeStep(def,flags,runMode);const kind=materialKind(def);if(kind)for(const out of steps[def.id].outputs){if(out==='zodiac-job.zip'&&!flags.export_zip)continue;const opKind=out==='zodiac-job.zip'?'create_zip':kind;operations.push({phase_id:item.id,step_id:def.id,kind:opKind,path:operationPath(out)});}}phases[item.id]={status:'PASS',current_step:manifest.steps.at(-1).id,steps};}return {format:'zodiac-pipeline-state@2',plugin_version:currentPluginVersion,run_id:'valid',run_mode:runMode,flags,current_phase:'03-handoff',operations,review_receipts:[{phase_id:'01-content',status:'APPROVED',proof:{kind:'user_message',ref:'user:content-review'}},{phase_id:'02-visual-production',status:'APPROVED',proof:{kind:'user_message',ref:'user:visual-review'}}],waivers:[],phases};};

export async function writeStateFixture(workspace,overrides={}){
 const state=valid(overrides),stateDir=path.join(workspace,'.authoring');
 await mkdir(stateDir,{recursive:true});
 for(const [phaseId,phase] of Object.entries(state.phases)){
  const manifest=manifests.get(phaseId);
  for(const [stepId,step] of Object.entries(phase.steps))for(const r of step.capability_receipts??[]){
   if(r.proof?.kind!=='validator_result')continue;
   const def=manifest.steps.find(x=>x.id===stepId),cap=[...(def.required_capabilities??[]),...(def.conditional_capabilities??[])].find(x=>x.id===r.capability_id);
   const rel=`validator-receipts/${phaseId}-${stepId}-${r.capability_id}.json`;r.proof.receipt_path=rel;
   const abs=path.join(stateDir,rel);await mkdir(path.dirname(abs),{recursive:true});
   await writeFile(abs,JSON.stringify({format:'zodiac-validator-receipt@1',capability_id:r.capability_id,validator:cap.tool_locator,args:cap.required_arg_suffixes??[],executed_at:'2026-10-10T00:00:00.000Z',exit_code:0,status:'PASS'}));
  }
 }
 await writeFile(path.join(stateDir,'pipeline-state.json'),JSON.stringify(state));
 await writeFile(path.join(stateDir,'phase02-native-checkpoints.json'),JSON.stringify({format:'zodiac-phase02-native-checkpoints@1',version:state.plugin_version,steps:{fixture:{status:'PASS',output_sha:'fixture-output',after_input_sha:'fixture-input'}}}));
 await writeFile(path.join(stateDir,'phase02-execution-receipt.json'),JSON.stringify({status:'NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED'}));
 for(const rel of ['asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json'])await writeFile(path.join(workspace,rel),'{}');
 return state;
}
