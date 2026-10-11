#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
export async function validatePipelineState(statePath){
if(!statePath)throw new Error('Usage: node validate-pipeline-state.mjs <pipeline-state.json>');
const fail=(code,msg)=>{throw new Error(`${code}: ${msg}`);};
const state=await readJson(statePath);
const stateDir=path.dirname(path.resolve(statePath));
const index=await readJson(path.join(root,'phase-index.json'));
const manifests=new Map();
for(const item of index.phases)manifests.set(item.id,await readJson(path.join(root,item.manifest)));
const phaseIds=index.phases.map(x=>x.id);
const terminalPhase=new Set(['PASS','SKIPPED_REUSED']);
const phaseStatuses=new Set(['LOCKED','READY','IN_PROGRESS','IN_REVIEW','PASS','BLOCKED','SKIPPED_REUSED']);
const stepStatuses=new Set(['LOCKED','READY','IN_PROGRESS','PASS','BLOCKED','SKIPPED_REUSED']);
const freshForbidden=new Set(['memory','prior_chat','old_package','continuity_snapshot','sign_example']);

if(state.format==='zodiac-pipeline-state@1')fail('PIPELINE_STATE_MIGRATION_REQUIRED','orchestration v2 state must be migrated to zodiac-pipeline-state@2');
if(state.format!=='zodiac-pipeline-state@2')fail('PIPELINE_STATE_INVALID','unexpected format');
const installedPlugin=await readJson(path.resolve(root,'../../../plugin.json'));
if(state.plugin_version!==installedPlugin.version)fail('PLUGIN_VERSION_MISMATCH',`state plugin_version ${state.plugin_version??'<missing>'} does not match installed ${installedPlugin.version}`);
if(!['fresh','continuity'].includes(state.run_mode))fail('PIPELINE_STATE_INVALID','run_mode must be fresh or continuity');
const [major,minor,patch]=installedPlugin.version.split('.').map(Number);
const contentQualityRequired=major>2||(major===2&&(minor>4||(minor===4&&patch>=13)));
if(state.run_mode==='fresh'&&contentQualityRequired&&state.flags?.content_quality_engine!==true)fail('CONTENT_QUALITY_REQUIRED','new fresh 2.4.13+ pipeline requires Content Quality Engine');
if(!phaseIds.includes(state.current_phase))fail('PIPELINE_STATE_INVALID','unknown current_phase');
if(state.phases?.[state.current_phase]?.status==='LOCKED')fail('CURRENT_PHASE_LOCKED',`${state.current_phase} cannot be LOCKED`);
for(const id of phaseIds)if(!state.phases?.[id])fail('PIPELINE_STATE_INVALID',`missing phase state ${id}`);
if(!Array.isArray(state.review_receipts))fail('PIPELINE_STATE_INVALID','review_receipts must be an array');
const seenReviewPhases=new Set();
for(const receipt of state.review_receipts){
  if(!phaseIds.includes(receipt?.phase_id))fail('REVIEW_APPROVAL_INVALID','review receipt has unknown phase_id');
  if(seenReviewPhases.has(receipt.phase_id))fail('REVIEW_APPROVAL_INVALID',`${receipt.phase_id} has a duplicate approval receipt`);
  seenReviewPhases.add(receipt.phase_id);
  if(receipt.status!=='APPROVED'||receipt.proof?.kind!=='user_message'||typeof receipt.proof?.ref!=='string'||!receipt.proof.ref.trim())fail('REVIEW_APPROVAL_INVALID',`${receipt.phase_id} approval must be proved by a non-empty user_message ref`);
}
const reviewReceiptFor=phaseId=>(state.review_receipts??[]).find(r=>r.phase_id===phaseId&&r.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof?.ref==='string'&&r.proof.ref.trim());

for(const receipt of state.review_receipts)if(manifests.get(receipt.phase_id)?.review_boundary!=='required')fail('REVIEW_APPROVAL_INVALID',`${receipt.phase_id} has no required review boundary`);
if(state.phases[state.current_phase]?.status==='LOCKED')fail('CURRENT_PHASE_LOCKED',`${state.current_phase} cannot be the current phase while LOCKED`);

const conditionApplies=(when)=>{if(!when||when==='always')return true;if(when==='fresh')return state.run_mode==='fresh';if(when==='continuity')return state.run_mode==='continuity';if(when.startsWith('flag:'))return Boolean(state.flags?.[when.slice(5)]);fail('PIPELINE_STATE_INVALID',`unsupported condition ${when}`);};
const waiverFor=(phaseId,stepId,capabilityId)=>(state.waivers??[]).find(w=>w.phase_id===phaseId&&w.step_id===stepId&&w.capability_id===capabilityId&&w.user_authorized===true&&typeof w.reason==='string'&&w.reason.trim());
const proofAllowed=(cap,receipt)=>{const kind=receipt?.proof?.kind;if(!kind||kind==='self_asserted')return false;if(cap.kind==='external_tool')return kind==='tool_result';if(cap.kind==='external_skill')return kind==='plugin_result';if(cap.kind==='guidance_skill')return ['skill_read','plugin_result'].includes(kind);if(cap.kind==='internal_reference')return kind==='skill_read';if(cap.kind==='internal_compiler')return kind==='compiler_result';if(cap.kind==='internal_validator')return kind==='validator_result';return false;};
const normalizePath=p=>String(p??'').replaceAll('\\','/').replace(/^\.\//,'');
const outputCovered=(phaseId,stepId,out)=>{const target=normalizePath(out);if(stepId==='export'&&target==='zodiac-job.zip')return (state.operations??[]).some(op=>op.phase_id===phaseId&&op.step_id===stepId&&op.kind==='create_zip');const ops=(state.operations??[]).filter(op=>op.phase_id===phaseId&&op.step_id===stepId&&op.path);if(target.endsWith('/**')){const prefix=target.slice(0,-3).replace(/\/$/,'');return ops.some(op=>normalizePath(op.path).startsWith(prefix+'/'));}if(target.includes('*')){const escaped=target.replace(/[|\\{}()[\]^$+?.]/g,'\\$&').replaceAll('*','[^/]*');const matcher=new RegExp(`^${escaped}$`);return ops.some(op=>matcher.test(normalizePath(op.path)));}return ops.some(op=>{const candidate=normalizePath(op.path);return candidate===target||candidate.endsWith('/'+target)||path.posix.basename(candidate)===path.posix.basename(target);});};
const verifyValidatorReceipt=async(cap,receipt,phaseId,stepId)=>{const rel=receipt?.proof?.receipt_path;if(typeof rel!=='string'||!rel.trim())fail('VALIDATOR_EXECUTION_RECEIPT_REQUIRED',`${phaseId}/${stepId}/${cap.id} missing proof.receipt_path`);const abs=path.resolve(stateDir,rel);if(abs!==stateDir&&!abs.startsWith(stateDir+path.sep))fail('VALIDATOR_EXECUTION_RECEIPT_INVALID',`${phaseId}/${stepId}/${cap.id} receipt escapes workspace`);let exec;try{exec=await readJson(abs);}catch{fail('VALIDATOR_EXECUTION_RECEIPT_REQUIRED',`${phaseId}/${stepId}/${cap.id} execution receipt not readable: ${rel}`);}if(exec.format!=='zodiac-validator-receipt@1'||exec.capability_id!==cap.id||exec.exit_code!==0||exec.status!=='PASS')fail('VALIDATOR_EXECUTION_RECEIPT_INVALID',`${phaseId}/${stepId}/${cap.id} execution receipt does not prove PASS`);if(typeof exec.validator!=='string'||!exec.validator.trim()||typeof exec.executed_at!=='string'||!exec.executed_at.trim())fail('VALIDATOR_EXECUTION_RECEIPT_INVALID',`${phaseId}/${stepId}/${cap.id} execution receipt missing validator/executed_at`);const actualValidator=normalizePath(exec.validator),expectedValidator=normalizePath(cap.tool_locator);if(expectedValidator&&actualValidator!==expectedValidator&&!actualValidator.endsWith('/'+expectedValidator))fail('VALIDATOR_EXECUTION_RECEIPT_INVALID',`${phaseId}/${stepId}/${cap.id} receipt validator does not match ${expectedValidator}`);if(Array.isArray(cap.required_arg_suffixes)){const args=Array.isArray(exec.args)?exec.args.map(normalizePath):[];for(const suffix of cap.required_arg_suffixes){const want=normalizePath(suffix);if(!args.some(a=>a===want||a.endsWith('/'+want)))fail('VALIDATOR_EXECUTION_RECEIPT_INVALID',`${phaseId}/${stepId}/${cap.id} receipt missing required validator arg ${want}`);}}};
const currentPhaseIndex=phaseIds.indexOf(state.current_phase);

for(let i=0;i<phaseIds.length;i++){
  const phaseId=phaseIds[i],phaseState=state.phases[phaseId],manifest=manifests.get(phaseId);
  if(!phaseStatuses.has(phaseState.status))fail('PIPELINE_STATE_INVALID',`${phaseId} has unsupported status ${phaseState.status}`);
  if(i>currentPhaseIndex&&phaseState.status!=='LOCKED')fail('PHASE_LOCKED',`${phaseId} is after current_phase and must remain LOCKED`);
  if(i>0&&phaseState.status!=='LOCKED')for(let j=0;j<i;j++)if(!terminalPhase.has(state.phases[phaseIds[j]].status))fail('PHASE_LOCKED',`${phaseId} cannot open before ${phaseIds[j]} is PASS/SKIPPED_REUSED`);
  if(phaseState.status==='SKIPPED_REUSED'){if(state.run_mode!=='continuity'||typeof phaseState.reuse_source!=='string'||!phaseState.reuse_source.trim())fail('REUSE_NOT_ALLOWED',`${phaseId} reuse requires continuity + explicit reuse_source`);continue;}
  const stepDefs=manifest.steps??[],stepIds=stepDefs.map(s=>s.id);if(!stepIds.includes(phaseState.current_step))fail('PIPELINE_STATE_INVALID',`${phaseId} unknown current_step ${phaseState.current_step}`);for(const stepId of stepIds)if(!phaseState.steps?.[stepId])fail('PIPELINE_STATE_INVALID',`${phaseId} missing step state ${stepId}`);const currentStepIndex=stepIds.indexOf(phaseState.current_step);
  for(let si=0;si<stepDefs.length;si++){
    const step=stepDefs[si],ss=phaseState.steps[step.id];if(!stepStatuses.has(ss.status))fail('PIPELINE_STATE_INVALID',`${phaseId}/${step.id} unsupported status ${ss.status}`);if(si>currentStepIndex&&ss.status!=='LOCKED')fail('STEP_LOCKED',`${phaseId}/${step.id} is after current_step and must remain LOCKED`);if(si>0&&ss.status!=='LOCKED')for(let sj=0;sj<si;sj++)if(!['PASS','SKIPPED_REUSED'].includes(phaseState.steps[stepIds[sj]].status))fail('STEP_LOCKED',`${phaseId}/${step.id} cannot open before ${stepIds[sj]} PASS/SKIPPED_REUSED`);
    if(ss.status==='SKIPPED_REUSED'){if(state.run_mode!=='continuity'||typeof ss.reuse_source!=='string'||!ss.reuse_source.trim())fail('REUSE_NOT_ALLOWED',`${phaseId}/${step.id} reuse requires continuity + explicit reuse_source`);continue;}
    if(!['draft','review'].includes(ss.context_role??'draft'))fail('CONTEXT_ROLE_INVALID',step.id);const contextScope=step.context_scopes?.[ss.context_role??'draft']??step;const allowed=new Set(contextScope.allowed_context_categories??[]),forbidden=new Set(contextScope.forbidden_context_categories??[]);for(const item of ss.context_manifest??[]){if(!item||typeof item.category!=='string')fail('CONTEXT_INVALID',`${phaseId}/${step.id} context item missing category`);if(forbidden.has(item.category)||!allowed.has(item.category))fail('CONTEXT_NOT_ALLOWED',`${phaseId}/${step.id} received ${item.category}`);if(state.run_mode==='fresh'&&freshForbidden.has(item.category))fail('CONTEXT_NOT_ALLOWED',`${phaseId}/${step.id} fresh run received ${item.category}`);}
    const applicable=[...(step.required_capabilities??[]),...(step.conditional_capabilities??[])].filter(c=>conditionApplies(c.when));const requireCaps=['IN_PROGRESS','PASS'].includes(ss.status)?applicable.filter(c=>(c.stage??'entry')==='entry'||ss.status==='PASS'):[];
    for(const cap of requireCaps){if(waiverFor(phaseId,step.id,cap.id))continue;const receipt=(ss.capability_receipts??[]).find(r=>r.capability_id===cap.id);if(!receipt)fail('MISSING_CAPABILITY_RECEIPT',`${phaseId}/${step.id} missing ${cap.id}`);if(!proofAllowed(cap,receipt))fail('INVALID_RECEIPT_PROOF',`${phaseId}/${step.id}/${cap.id} has invalid proof`);if(cap.kind==='internal_validator')await verifyValidatorReceipt(cap,receipt,phaseId,step.id);if(cap.guidance_uri&&receipt.guidance_loaded!==true)fail('GUIDANCE_NOT_LOADED',`${phaseId}/${step.id}/${cap.id} did not load guidance`);if(receipt.status==='FALLBACK_USED'){if(cap.unavailable_policy!=='fallback')fail('FALLBACK_NOT_ALLOWED',`${phaseId}/${step.id}/${cap.id} may not fallback`);if(typeof receipt.failure_reason!=='string'||!receipt.failure_reason.trim())fail('FALLBACK_NOT_ALLOWED',`${phaseId}/${step.id}/${cap.id} missing failure_reason`);if(!(cap.fallback_providers??[]).includes(receipt.provider))fail('FALLBACK_NOT_ALLOWED',`${phaseId}/${step.id}/${cap.id} provider not approved`);}else if(receipt.status!=='PASS')fail('CAPABILITY_NOT_PASS',`${phaseId}/${step.id}/${cap.id} status ${receipt.status}`);if(cap.require_application_summary&&(!receipt.application_summary||!String(receipt.application_summary).trim()))fail('CAPABILITY_NOT_APPLIED',`${phaseId}/${step.id}/${cap.id} missing application_summary`);}
    if(ss.status==='PASS'){const outputs=[...(step.required_outputs??[]),...(step.conditional_outputs??[]).filter(o=>conditionApplies(o.when)).map(o=>o.name)];for(const out of outputs){if(!(ss.outputs??[]).includes(out))fail('MISSING_STEP_OUTPUT',`${phaseId}/${step.id} missing ${out}`);if(!(step.id==='export'&&out==='zodiac-job.zip'&&!state.flags?.export_zip)&&!outputCovered(phaseId,step.id,out))fail('OUTPUT_OPERATION_MISSING',`${phaseId}/${step.id} output ${out} has no matching material operation`);}const gates=[...(step.gate_checks??[]),...(step.conditional_gate_checks??[]).filter(g=>conditionApplies(g.when)).map(g=>g.name)];for(const gate of gates)if(ss.gate_results?.[gate]!=='PASS')fail('STEP_GATE_NOT_PASS',`${phaseId}/${step.id}/${gate} is not PASS`);}
  }
  if(['PASS','IN_REVIEW'].includes(phaseState.status))for(const stepId of stepIds)if(!['PASS','SKIPPED_REUSED'].includes(phaseState.steps[stepId].status))fail('PHASE_NOT_COMPLETE',`${phaseId} cannot be ${phaseState.status} while ${stepId} is not PASS/SKIPPED_REUSED`);
  if(manifest.review_boundary==='required'&&phaseState.status==='PASS'&&!reviewReceiptFor(phaseId))fail('REVIEW_APPROVAL_REQUIRED',`${phaseId} cannot PASS without explicit user approval proof`);
}
const zipCounts=new Map();for(const op of state.operations??[]){const manifest=manifests.get(op.phase_id);if(!manifest)fail('OPERATION_INVALID',`unknown phase ${op.phase_id}`);const step=(manifest.steps??[]).find(s=>s.id===op.step_id);if(!step)fail('OPERATION_INVALID',`unknown step ${op.phase_id}/${op.step_id}`);if(op.kind==='create_zip'&&String(op.path??'').replaceAll('\\','/').endsWith('zodiac-publish-bundle.zip'))fail('STUDIO_OUTPUT_OWNERSHIP','zodiac-publish-bundle.zip is retired/forbidden; Studio emits loose publish outputs');if(!(step.allowed_operations??[]).includes(op.kind))fail('PHASE_SIDE_EFFECT_VIOLATION',`${op.phase_id}/${op.step_id} may not perform ${op.kind}`);if(op.kind==='create_zip'){const key=`${op.phase_id}/${op.step_id}`;zipCounts.set(key,(zipCounts.get(key)??0)+1);if(step.zip_output_name_pattern&&!new RegExp(step.zip_output_name_pattern).test(path.basename(String(op.path??''))))fail('ZIP_OUTPUT_NAME_INVALID',`${key} failed canonical filename contract`);if(step.zip_output_name&&path.basename(String(op.path??''))!==step.zip_output_name)fail('ZIP_OUTPUT_NAME_INVALID',`${key} may only create ${step.zip_output_name}`);}}
for(const [phaseId,manifest] of manifests)for(const step of manifest.steps??[]){const count=zipCounts.get(`${phaseId}/${step.id}`)??0;if(step.max_zip_outputs!==undefined&&count>step.max_zip_outputs)fail('ZIP_OUTPUT_LIMIT',`${phaseId}/${step.id} created ${count} ZIPs; max ${step.max_zip_outputs}`);if(count>0&&step.id==='export'&&!state.flags?.export_zip)fail('PHASE_SIDE_EFFECT_VIOLATION','export ZIP created while export_zip=false');if(count>0&&step.zip_output_name_pattern){const matcher=new RegExp(step.zip_output_name_pattern);for(const op of state.operations??[])if(op.phase_id===phaseId&&op.step_id===step.id&&op.kind==='create_zip'&&!matcher.test(path.posix.basename(String(op.path??'').replaceAll('\\','/'))))fail('ZIP_OUTPUT_NAME_INVALID',`${phaseId}/${step.id} output ${op.path} does not match ${step.zip_output_name_pattern}`);}}
return `PIPELINE_STATE_PASS: ${state.run_id} @ ${state.current_phase}`;
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:null;
if(invokedPath===import.meta.url){
  const statePath=process.argv[2];
  if(!statePath){console.error('Usage: node validate-pipeline-state.mjs <pipeline-state.json>');process.exitCode=2;}
  else try{console.log(await validatePipelineState(statePath));}catch(error){console.error(error);process.exitCode=1;}
}
