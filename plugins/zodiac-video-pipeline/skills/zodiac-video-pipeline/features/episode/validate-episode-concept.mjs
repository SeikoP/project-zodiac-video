import {assertPremiseSelection} from '../../core/policy/creative-policy.mjs';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {assertEpisodeScope,validateResearchScope,MEMBER_LABELS} from './episode-scope.mjs';
import {compositionHash} from '../visual-composition/phase02-composition.mjs';
import {readArtifact} from '../../orchestration/phase01-artifacts.mjs';
import {compileEpisodeEvidenceView,validateEpisodeEvidencePool} from '../../core/evidence/episode-evidence.mjs';
const text=v=>typeof v==='string'&&Boolean(v.trim());
export function assertMemberLenses(lenses,scope,evidenceView){
 if(!Array.isArray(lenses)||lenses.length!==scope.member_ids.length||new Set(lenses.map(l=>l?.member_id)).size!==lenses.length)throw Error('EPISODE_MEMBER_LENSES');
 for(const l of lenses){
  if(!scope.member_ids.includes(l?.member_id)||!text(l.identity_mechanism)||!text(l.misread_vs_reframe)||!Array.isArray(l.archetype_facets)||!l.archetype_facets.length||new Set(l.archetype_facets).size!==l.archetype_facets.length||l.archetype_facets.some(x=>!text(x)))throw Error('EPISODE_MEMBER_IDENTITY');
  if(!Object.hasOwn(MEMBER_LABELS,l.sign_swap_test?.alternate_sign)||l.sign_swap_test.alternate_sign===l.member_id||!text(l.sign_swap_test.irreplaceable_difference))throw Error('EPISODE_MEMBER_SIGN_SWAP');
  const own=evidenceView?.member_claims?.[l.member_id]??[];
  if(!Array.isArray(l.evidence_refs)||!l.evidence_refs.length||new Set(l.evidence_refs).size!==l.evidence_refs.length||l.evidence_refs.some(id=>!own.find(c=>c.id===id)))throw Error('EPISODE_MEMBER_EVIDENCE_REF '+l.member_id);
  if(new Set(own.filter(c=>l.evidence_refs.includes(c.id)&&c.claim_class==='astrology_interpretation').map(c=>c.source_identity)).size<2)throw Error('EPISODE_MEMBER_CORROBORATION '+l.member_id);
 }
 return lenses;
}
export function validateEpisodeConcept({scope,candidates,narrativePlan:p,evidenceView:e,researchScope}={}){
 try{
  const s=assertEpisodeScope(scope,researchScope);
  if(p?.version!=='2.1'||compositionHash(assertEpisodeScope(p.episode_scope))!==compositionHash(s)||e?.scope_sha256!==compositionHash(s))throw Error('EPISODE_SCOPE_LINEAGE');
  if(candidates?.format!=='zodiac-concept-competition@1')throw Error('EPISODE_CONCEPT_FORMAT');assertPremiseSelection(candidates);
  const ids=new Set(),premises=new Set();
  for(const c of candidates.candidates){
   if(!text(c.id)||ids.has(c.id)||!text(c.premise)||premises.has(c.premise.trim().toLowerCase()))throw Error('EPISODE_DUPLICATE_PREMISE');ids.add(c.id);premises.add(c.premise.trim().toLowerCase());
   for(const k of ['episode_thesis','cross_member_progression','payoff','character_specificity','unanswered_question','stakes_or_recognition','turn_or_reframe','why_watch_without_delivery','failure_risk'])if(!text(c[k]))throw Error('EPISODE_PREMISE_'+k);
   assertMemberLenses(c.member_lenses,s,e);
   if(!Array.isArray(c.evidence_refs)||c.evidence_refs.some(id=>!e.selected_refs.includes(id))||c.member_lenses.some(l=>l.evidence_refs.some(id=>!c.evidence_refs.includes(id))))throw Error('EPISODE_PREMISE_REFS');
  }
  const winner=candidates.candidates.find(c=>c.id===candidates.selected_candidate_id);
  if(!winner||p.selected_concept_id!==winner.id||!text(candidates.selection_rationale)||candidates.rejected_or_reserved_ids?.length!==candidates.candidates.length-1||new Set(candidates.rejected_or_reserved_ids).size!==candidates.candidates.length-1||candidates.rejected_or_reserved_ids.some(id=>!ids.has(id)||id===winner.id))throw Error('EPISODE_WINNER');
  validateEpisodeBeatEvidence(p,s,e);
  if(compositionHash(p.member_lenses)!==compositionHash(winner.member_lenses))throw Error('EPISODE_LENS_DRIFT');
  return {status:'VALID',issues:[],creative_quality_verified:false};
 }catch(e){return {status:'BLOCKED',issues:[e.message],creative_quality_verified:false};}
}
export function assertEpisodeConcept(input){const r=validateEpisodeConcept(input);if(r.status==='BLOCKED')throw Error('EPISODE_CONCEPT_INVALID '+r.issues.join(','));return r;}
export async function episodeConceptInput(root){
 const [scope,researchScope,candidates,narrativePlan,ledger]=await Promise.all(['episode-scope.json','research-scope.json','concept-candidates.json','narrative-plan.json','evidence-ledger.json'].map(n=>readArtifact(root,n)));
 validateResearchScope(researchScope);validateEpisodeEvidencePool(ledger,researchScope);return {scope,candidates,narrativePlan,researchScope,evidenceView:compileEpisodeEvidenceView(ledger,scope)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))episodeConceptInput(process.argv[2]).then(x=>console.log(JSON.stringify(assertEpisodeConcept(x)))).catch(e=>{console.error(e.message);process.exitCode=2;});

export function validateEpisodeBeatEvidence(p,scope,e){if(!Array.isArray(p.beats)||!p.beats.length)throw Error('EPISODE_BEATS');for(const b of p.beats){if(!Array.isArray(b.member_ids)||!b.member_ids.length||b.member_ids.some(m=>!scope.member_ids.includes(m))||new Set(b.member_ids).size!==b.member_ids.length||!Array.isArray(b.evidence_refs)||!b.evidence_refs.length)throw Error('EPISODE_BEAT_MEMBERS');for(const id of b.evidence_refs){const c=e.claims.find(x=>x.id===id);if(!c||(c.claim_scope==='member'&&!c.member_ids.some(m=>b.member_ids.includes(m))))throw Error('EPISODE_BEAT_EVIDENCE_OWNERSHIP '+b.id);}}}
