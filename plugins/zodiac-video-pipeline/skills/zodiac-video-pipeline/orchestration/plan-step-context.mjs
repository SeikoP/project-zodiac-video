#!/usr/bin/env node
// Read-only context loading plan. No capability, validator, gate or approval is waived.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectAssetGuidance} from '../core/policy/select-asset-guidance.mjs';
import {createHash} from 'node:crypto';
import {conditionApplies} from '../core/policy/resolve-capability-route.mjs';
import {loadCurrentPolicy} from '../core/policy/current-policy.mjs';
import {capabilitiesForStep} from '../core/policy/capability-registry.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestByPhase={'01-content':'01-content.json','02-visual-production':'02-visual-production.json','03-handoff':'03-handoff.json'};
export function planStepContext(manifest, stepId, flags={}, {run_mode='fresh',role='draft',selected_asset_ids=null,meme_selected=flags.meme_selected??false,environment_mode='scene_set',policy=null,asset_needs=[],capabilityIndex=null,coverageMatrix=null}={}) {
 const step=manifest?.steps?.find(s=>s.id===stepId);
 if(!step)throw new Error('CONTEXT_STEP_NOT_FOUND '+stepId);
 if(!['draft','review'].includes(role))throw Error('CONTEXT_ROLE_INVALID');
 if(manifest.id==='02-visual-production'&&['legacy','selected_cues'].includes(environment_mode))throw Error('RECOVERY_SNAPSHOT_REQUIRED');
 const scope=step.context_scopes?.[role]??step;
 const caps=[...(step.required_capabilities??[]),...(step.conditional_capabilities??[])].filter(c=>conditionApplies(c.when,{run_mode,flags}));
 const entry=caps.filter(c=>c.stage==='entry');
 const selectedCapabilities=capabilitiesForStep(manifest.id,step.id,{run_mode,environment_mode,flags});
 let refs=[...new Set([...entry.flatMap(c=>[c.guidance_uri,c.selected_guidance_uri]).filter(Boolean),...(scope.load_references??step.load_references??[])])];
 const guidanceAllowed=ref=>{const rule=step.guidance_selection?.[ref];if(!rule)return true;if(rule==='meme')return meme_selected;return true;};
 refs=refs.filter(guidanceAllowed);
 let assetSelection=null;if(selected_asset_ids!==null||asset_needs.length){if(!policy)throw Error('CONTEXT_SELECTION_POLICY_MISSING');assetSelection=selectAssetGuidance({selected_asset_ids:selected_asset_ids??[],asset_needs,meme_selected,environment_mode},policy,{capabilityIndex,coverageMatrix});if(assetSelection.unresolved_ids.length)throw Error('CONTEXT_ASSET_UNRESOLVED '+assetSelection.unresolved_ids.join(','));selected_asset_ids=assetSelection.selected_asset_ids??selected_asset_ids??[];refs=[...new Set([...refs,...assetSelection.core_refs,...assetSelection.extension_refs])];}
 refs=[...new Set([...refs,...selectedCapabilities.flatMap(item=>item.refs??[])])];
 if(manifest.id==='02-visual-production'&&refs.some(ref=>/(?:^|\/)(?:migration|provenance|compat)(?:\/|$)|story-object-effects|story-object-composition-v2|environments\/compositions/u.test(ref)))throw Error('CONTEXT_RETIRED_REFERENCE');
 const output={production_entrypoint:manifest.production_entrypoint??null,invocation_policy:manifest.invocation_policy??'step_capabilities',format:'zodiac-step-context-plan@1',phase:manifest.id,step:step.id,run_mode,role,
   required_references:refs,required_entry_capabilities:entry.map(c=>c.id),
   selected_capabilities:selectedCapabilities.map(item=>item.id),
   resolved_asset_capabilities:assetSelection?.resolved_capabilities??[],
   deferred_exit_capabilities:caps.filter(c=>c.stage==='exit').map(c=>c.id),
   allowed_context_categories:scope.allowed_context_categories??[],
   forbidden_context_categories:scope.forbidden_context_categories??[],
   required_outputs:[...(step.required_outputs??[]),...(step.conditional_outputs??[]).filter(o=>conditionApplies(o.when,{run_mode,flags})).map(o=>o.name)],
   retention_policy:'only approved content hashes, source paths, explicit decisions, blockers, real receipts',
   no_validation_changes:true,no_approval_changes:true,
   note:'This plans reference loading. Required capabilities still need genuine invocation and receipts.'};
 return output;
}
export async function loadStepContext(phase,step,flags={},options={}){
 if(!manifestByPhase[phase])throw new Error('CONTEXT_PHASE_UNKNOWN '+phase);
 const manifest=JSON.parse(await readFile(path.join(skill,'orchestration/phases',manifestByPhase[phase]),'utf8'));
 const policy=JSON.parse(await readFile(path.join(skill,'references/asset-library-v4/selection-policy.json'),'utf8'));const capabilityIndex=JSON.parse(await readFile(path.join(skill,'references/asset-library-v4/capability-index.json'),'utf8'));const coverageMatrix=JSON.parse(await readFile(path.join(skill,'references/asset-library-v4/coverage-matrix.json'),'utf8'));const result=planStepContext(manifest,step,flags,{...options,policy,capabilityIndex,coverageMatrix});result.effective_policy=await loadCurrentPolicy(skill);result.context_manifest=await Promise.all(result.required_references.map(async ref=>{if(/^[a-z][a-z0-9+.-]*:/iu.test(ref))return {path:ref,provider_required:true,loaded:false};const abs=path.resolve(skill,ref);if(!abs.startsWith(skill+path.sep))throw Error('CONTEXT_PATH_UNSAFE');const raw=await readFile(abs);return {path:ref,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};}));return result;
}
const self=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self){try{
 const args=process.argv.slice(2),phase=args[0],step=args[1],at=args.indexOf('--flags');
 if(!phase||!step)throw new Error('Usage: node plan-step-context.mjs <phase> <step> [--flags <flags.json>]');
 const rawFlags=at>=0?JSON.parse(await readFile(path.resolve(args[at+1]),'utf8')):JSON.parse(await readFile(path.join(skill,'orchestration/pipeline-state.template.json'),'utf8'));
 const flags=rawFlags.flags??rawFlags;
 console.log(JSON.stringify(await loadStepContext(phase,step,flags,{run_mode:rawFlags.run_mode??'fresh',role:rawFlags.context_role??'draft',selected_asset_ids:rawFlags.selected_asset_ids??null,asset_needs:rawFlags.asset_needs??[],environment_mode:rawFlags.environment_mode??'scene_set',meme_selected:flags.meme_selected??false}),null,2));
}catch(e){console.error('CONTEXT_PLAN_BLOCKED '+e.message);process.exitCode=2;}}
