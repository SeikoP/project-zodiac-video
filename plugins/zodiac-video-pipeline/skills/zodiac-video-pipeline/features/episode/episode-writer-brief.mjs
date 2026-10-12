import {assertViralDecision} from '../../core/policy/creative-policy.mjs';
import {assertEpisodeScope} from './episode-scope.mjs';import {assertMemberLenses,validateEpisodeBeatEvidence} from './validate-episode-concept.mjs';import {compositionHash} from '../visual-composition/phase02-composition.mjs';
const fail=m=>{throw Error('EPISODE_WRITER_BRIEF_INVALID '+m);};const text=(v,k)=>{if(typeof v!=='string'||!v.trim())fail(k);return v;};
export function compileEpisodeWriterBrief(input){
 const {selectedCandidate:c,narrativePlan:p,evidenceBrief:e,viral:v,referenceMechanics:r,authoredBriefExtras:a}=input;
 const scope=assertEpisodeScope(input.episodeScope,input.researchScope);
 if(p?.version!=='2.1'||p.selected_concept_id!==c?.id||compositionHash(scope)!==compositionHash(p.episode_scope)||e?.format!=='zodiac-episode-evidence-view@1'||e.scope_sha256!==compositionHash(scope))fail('SCOPE_LINEAGE');
 assertMemberLenses(c.member_lenses,scope,e);validateEpisodeBeatEvidence(p,scope,e);
 if(compositionHash(p.member_lenses)!==compositionHash(c.member_lenses))fail('LENS_DRIFT');
 const permitted=['rhythm_direction','forbidden_claims','audience_vibe','narrator_vibe','situation_territories','motif_candidates','creative_direction'];
 if(!a||Object.keys(a).some(k=>!permitted.includes(k))||!Array.isArray(a.forbidden_claims))fail('EXTRAS');
 for(const id of [...c.evidence_refs??[],...(p.beats??[]).flatMap(b=>b.evidence_refs??[])])if(!e.selected_refs.includes(id))fail('EVIDENCE_REF '+id);
 const brief={format:'zodiac-episode-writer-brief@1',...a,episode_scope:scope,member_lenses:structuredClone(c.member_lenses),topic:text(p.topic?.focus,'topic'),thesis:text(c.premise,'premise'),content_engine:'character_deconstruction',delivery_mode:p.delivery_mode??'conversational',...Object.fromEntries(['identity_tension','progression_intent','payoff_target'].map(k=>[k,text(p.story_spine?.[k],k)])),evidence_safe_behaviors:e.claims.filter(x=>['astrology_interpretation','editorial_inference'].includes(x.claim_class)).map(x=>x.claim),selected_evidence:e.claims.map(({id,claim,member_ids,claim_scope})=>({id,claim,member_ids,claim_scope})),rhythm_direction:text(a.rhythm_direction,'rhythm_direction'),viral_mechanics:(v?.mechanics??[]).slice(0,3).map(m=>({source_id:m.id,instruction:text(m.writer_effect,'writer_effect')})),reference_mechanics:r?.reference_present?(r.application_map??[]).map(m=>({source_id:m.mechanic_id,instruction:text(m.concept_application,'reference application')})):[]};
 assertViralDecision(v);if(!brief.evidence_safe_behaviors.length)fail('SOURCE_INSTRUCTIONS');
 const output_bytes=Buffer.byteLength(JSON.stringify(brief));if(output_bytes>10000)fail('BUDGET_EXCEEDED');
 return {brief,receipt:{format:'zodiac-writer-brief-compile@1',source_sha256:compositionHash(input),output_sha256:compositionHash(brief),source_bytes:Buffer.byteLength(JSON.stringify(input)),output_bytes,not_an_approval:true}};
}
