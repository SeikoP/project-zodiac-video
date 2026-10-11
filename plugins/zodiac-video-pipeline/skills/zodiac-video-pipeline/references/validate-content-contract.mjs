#!/usr/bin/env node
import {assertPremiseSelection,assertViralDecision} from '../orchestration/creative-policy.mjs';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateBeatPerformance} from './narration-rhythm.mjs';

import {compileWriterBriefWorkspace} from '../orchestration/compile-writer-brief.mjs';
import {validatePluginUse} from '../orchestration/plan-plugin-use.mjs';
import {newFresh} from '../orchestration/phase01-artifacts.mjs';
import {assertEpisodeConcept,episodeConceptInput} from '../orchestration/validate-episode-concept.mjs';
const rootArg=process.argv[2];
if(!rootArg){console.error('Usage: node validate-content-contract.mjs <workspace-root>');process.exit(2);}
const root=path.resolve(rootArg);
const fail=m=>{throw new Error('CONTENT_CONTRACT_INVALID: '+m);};
const exists=p=>access(p).then(()=>true).catch(()=>false);
const resolveArtifact=async name=>{for(const p of [path.join(root,'.authoring',name),path.join(root,name)])if(await exists(p))return p;fail('missing '+name);};
const readJson=async name=>JSON.parse(await readFile(await resolveArtifact(name),'utf8'));
const norm=v=>String(v??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const same=(a,b)=>{const x=norm(a),y=norm(b);return Boolean(x&&y&&x===y);};
const collectEvidenceIds=(node,out=new Set())=>{if(Array.isArray(node)){for(const x of node)collectEvidenceIds(x,out);return out;}if(!node||typeof node!=='object')return out;for(const [k,v] of Object.entries(node)){if(typeof v==='string'&&['id','evidence_id','claim_id','ref','evidence_ref'].includes(k)&&v.trim())out.add(v.trim());if(/^E\d+[A-Za-z0-9_-]*$/u.test(k))out.add(k);if(typeof v==='string'&&/^E\d+[A-Za-z0-9_-]*$/u.test(v.trim()))out.add(v.trim());collectEvidenceIds(v,out);}return out;};
const nonEmptyString=(v,label)=>{if(typeof v!=='string'||!v.trim())fail(label+' is required');return v.trim();};

const viral=await readJson('viral-analysis.json');
const refs=await readJson('reference-mechanics.json');
const plan=await readJson('narrative-plan.json');
if(plan.story_shape!=='character_deconstruction')fail('Zodiac permits only character_deconstruction story_shape');
const brief=await readJson('phase3-writer-brief.json');
const ledger=await readJson('evidence-ledger.json');
// New fresh runs enforce concept competition. Previously approved releases remain readable.
let requireQuality=false,requireBrief=false;
try{const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8'));
 requireBrief=newFresh(state);if(state.flags?.episode_selected===true&&plan.version!=='2.1')fail('EPISODE_NARRATIVE_REQUIRED');
 const v=String(state.plugin_version??'').split('.').map(Number);
 if(state.run_mode==='fresh'&&(v[0]>2||v[0]===2&&(v[1]>4||v[1]===4&&v[2]>=47)) ){if(!['2.0','2.1'].includes(plan.version))fail('fresh >=2.4.47 requires Narrative Plan 2.0 or 2.1');nonEmptyString(brief.rhythm_direction,'writer brief rhythm_direction');}
 requireQuality=state.run_mode==='fresh' && (v[0]>2 || v[0]===2&&(v[1]>4||v[1]===4&&v[2]>=13));
}catch(e){if(e.code!=='ENOENT')throw e;}
if(requireQuality){
 const candidates=await readJson('concept-candidates.json');
 if(candidates.format!=='zodiac-concept-competition@1')fail('invalid concept-candidates format');
 assertPremiseSelection(candidates);
 const ids=new Set(),premises=new Set();
 for(const c of candidates.candidates){
  const id=nonEmptyString(c?.id,'candidate id');if(ids.has(id))fail('duplicate concept id '+id);ids.add(id);
  const premise=nonEmptyString(c.premise,id+'.premise');if(premises.has(norm(premise)))fail('duplicate premise '+id);premises.add(norm(premise));
  for(const k of ['character_specificity','unanswered_question','stakes_or_recognition','turn_or_reframe','why_watch_without_delivery','failure_risk'])nonEmptyString(c[k],id+'.'+k);
  if(!Array.isArray(c.evidence_refs)||!c.evidence_refs.length)fail(id+'.evidence_refs required');
 }
 const winner=nonEmptyString(candidates.selected_candidate_id,'selected_candidate_id');
 if(!ids.has(winner))fail('selected candidate does not exist');
 nonEmptyString(candidates.selection_rationale,'concept selection_rationale');
 if(plan.selected_concept_id!==winner)fail('plan.selected_concept_id does not match selected candidate');
 if(!Array.isArray(candidates.rejected_or_reserved_ids)||candidates.rejected_or_reserved_ids.length!==candidates.candidates.length-1||candidates.rejected_or_reserved_ids.some(x=>!ids.has(x)||x===winner)||new Set(candidates.rejected_or_reserved_ids).size!==candidates.candidates.length-1)fail('two distinct candidates must be rejected or reserved');
 const evidenceIds=collectEvidenceIds(ledger);
 for(const c of candidates.candidates)for(const e of c.evidence_refs)if(!evidenceIds.has(e))fail('candidate evidence reference not resolvable: '+e);
}


if(plan.version==='2.1')assertEpisodeConcept(await episodeConceptInput(root));
if(requireBrief||plan.version==='2.1'){await compileWriterBriefWorkspace(root);validatePluginUse(await readJson('plugin-use-decisions.json'));if(!['editorial_local','plugin_guidance'].includes(viral.origin))fail('viral origin required');if(viral.origin==='plugin_guidance'&&(!viral.skill_read_ref?.trim()||!viral.guidance_uri?.trim()))fail('actual viral guidance read required');}
if(viral.version!=='1.0')fail('viral-analysis.version must be 1.0');
assertViralDecision(viral);
const writerEffects=new Map(),viralIds=new Set();
for(const [i,m] of viral.mechanics.entries()){
  if(!m||typeof m!=='object'||Array.isArray(m))fail(`viral mechanic ${i+1} must be an object`);
  const id=nonEmptyString(m.id,`viral mechanic ${i+1}.id`);if(viralIds.has(id))fail('duplicate viral mechanic id '+id);viralIds.add(id);
  nonEmptyString(m.principle,`${id}.principle`);nonEmptyString(m.concept_application,`${id}.concept_application`);const effect=nonEmptyString(m.writer_effect,`${id}.writer_effect`);writerEffects.set(id,effect);
}
nonEmptyString(viral.application_summary,'viral-analysis.application_summary');
if(!Array.isArray(viral.rejected_moves))fail('viral-analysis.rejected_moves must be an array');

for(const key of [...(plan.version==='2.1'?[]:['sign']),'topic','thesis','identity_tension','progression_intent','payoff_target'])nonEmptyString(brief[key],`writer brief ${key}`);
if(!Array.isArray(brief.evidence_safe_behaviors)||!brief.evidence_safe_behaviors.length||brief.evidence_safe_behaviors.some(x=>typeof x!=='string'||!x.trim()))fail('writer brief evidence_safe_behaviors must contain at least one non-empty item');
if(!Array.isArray(brief.forbidden_claims))fail('writer brief forbidden_claims must be an array');
if(!Array.isArray(brief.viral_mechanics)||brief.viral_mechanics.length>3)fail('writer brief viral_mechanics must contain at most 3 selected items; omission is explicit upstream');
for(const item of brief.viral_mechanics){const sourceId=typeof item==='object'&&item?item.source_id:null;const instruction=typeof item==='object'&&item?item.instruction:item;if(sourceId){if(!writerEffects.has(sourceId))fail('writer brief viral mechanic source_id does not resolve: '+sourceId);if(!same(writerEffects.get(sourceId),instruction))fail('writer brief viral mechanic instruction drifted from '+sourceId);}else if(![...writerEffects.values()].some(x=>same(x,instruction)))fail('writer brief viral mechanic does not originate exactly in viral-analysis: '+instruction);}

const forbidden=['beats','devices','full_research','asset_rules','renderer_rules','runtime_rules','package_rules','full_qc','raw_srt','raw_reference'];
for(const key of forbidden)if(Object.prototype.hasOwnProperty.call(brief,key))fail('writer brief contains forbidden raw/planning field '+key);

const spine=plan.story_spine??{};
for(const key of ['identity_tension','progression_intent','payoff_target']){
  nonEmptyString(spine[key],'narrative plan story_spine.'+key);
  if(!same(spine[key],brief[key]))fail(`writer brief ${key} drifted from Story Spine`);
}
if(!Array.isArray(plan.beats)||!plan.beats.length)fail('narrative plan beats must be non-empty');
if(['2.0','2.1'].includes(plan.version))for(const beat of plan.beats??[])validateBeatPerformance(beat.performance);
const beatIds=new Set();
const evidenceIds=collectEvidenceIds(ledger);if(!evidenceIds.size)fail('evidence-ledger exposes no resolvable evidence IDs');
for(const beat of plan.beats??[]){if(typeof beat?.id!=='string'||!beat.id.trim())fail('beat missing id');if(beatIds.has(beat.id))fail('duplicate beat id '+beat.id);beatIds.add(beat.id);if(!Array.isArray(beat.evidence_refs)||!beat.evidence_refs.length)fail(`beat ${beat.id} has no evidence_refs`);for(const ref of beat.evidence_refs)if(!evidenceIds.has(ref))fail(`beat ${beat.id} evidence ref does not resolve: ${ref}`);}

if(refs.version!=='1.0'||typeof refs.reference_present!=='boolean')fail('reference-mechanics must use version 1.0 + boolean reference_present');
const refMechanics=Array.isArray(refs.mechanics)?refs.mechanics:[];const appRows=Array.isArray(refs.application_map)?refs.application_map:[];
const briefRefs=Array.isArray(brief.reference_mechanics)?brief.reference_mechanics:[];
if(refs.reference_present===false){if(refMechanics.length||appRows.length||briefRefs.length)fail('reference_present=false requires empty mechanics/application_map/writer brief reference_mechanics');}
if(refs.reference_present===true){
  if(!refMechanics.length)fail('reference_present=true requires at least one reference mechanic');
  const mechanics=new Map();for(const m of refMechanics){const id=nonEmptyString(m?.id,'reference mechanic id');if(mechanics.has(id))fail('duplicate reference mechanic id '+id);mechanics.set(id,nonEmptyString(m.mechanic,`${id}.mechanic`));}
  const applications=new Map();for(const a of appRows){const id=nonEmptyString(a?.mechanic_id,'reference application mechanic_id');if(!mechanics.has(id))fail('reference application points to unknown mechanic '+id);if(applications.has(id))fail('duplicate reference application '+id);applications.set(id,nonEmptyString(a.concept_application,`${id}.concept_application`));}
  for(const id of mechanics.keys())if(!applications.has(id))fail('reference mechanic '+id+' is missing application_map entry');
  if(!briefRefs.length)fail('writer brief must carry at least one reference mechanic when reference_present=true');
  for(const item of briefRefs){const sourceId=typeof item==='object'&&item?item.source_id:null;const instruction=typeof item==='object'&&item?item.instruction:item;if(sourceId){if(!mechanics.has(sourceId)&&!applications.has(sourceId))fail('writer brief reference mechanic source_id does not resolve: '+sourceId);const allowed=[mechanics.get(sourceId),applications.get(sourceId)].filter(Boolean);if(!allowed.some(x=>same(x,instruction)))fail('writer brief reference mechanic instruction drifted from '+sourceId);}else if(![...mechanics.values(),...applications.values()].some(x=>same(x,instruction)))fail('writer brief reference mechanic does not originate exactly in reference-mechanics: '+instruction);}
}

console.log(`CONTENT_CONTRACT_PASS: viral=${brief.viral_mechanics.length}; beats=${plan.beats.length}; reference=${refs.reference_present?'yes':'no'}`);
