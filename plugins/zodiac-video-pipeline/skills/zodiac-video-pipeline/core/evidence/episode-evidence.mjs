import {compileEvidenceBrief} from './compile-evidence-brief.mjs';
import {assertEpisodeScope,MEMBER_LABELS,validateResearchScope} from '../../orchestration/episode-scope.mjs';
import {compositionHash} from '../../orchestration/phase02-composition.mjs';
export function compileEpisodeEvidenceView(ledger,inputScope){
 const scope=assertEpisodeScope(inputScope),entries=ledger.entries??ledger.sources;
 if(!Array.isArray(entries))throw Error('EPISODE_EVIDENCE_ENTRIES');
 for(const e of entries)if(!['element','shared','member','comparison'].includes(e.claim_scope)||!Array.isArray(e.member_ids)||!e.member_ids.length||new Set(e.member_ids).size!==e.member_ids.length||e.member_ids.some(x=>!Object.hasOwn(MEMBER_LABELS,x)))throw Error('EPISODE_EVIDENCE_SCOPE '+e.id);
 const selected=entries.filter(e=>e.member_ids.some(x=>scope.member_ids.includes(x)));
 const brief=compileEvidenceBrief(ledger,{evidence_ids:selected.map(e=>e.id)});
 // The view contains selected member IDs only; pool provenance remains in its hash.
 const claims=brief.claims.map(c=>({...c,member_ids:c.member_ids.filter(x=>scope.member_ids.includes(x))}));
 const member_claims=Object.fromEntries(scope.member_ids.map(id=>{
  const own=claims.filter(c=>c.claim_scope==='member'&&c.member_ids.includes(id));
  if(new Set(own.filter(c=>c.claim_class==='astrology_interpretation').map(c=>c.source_identity)).size<2)throw Error('EPISODE_MEMBER_CORROBORATION '+id);
  return [id,own];
 }));
 return {format:'zodiac-episode-evidence-view@1',episode_id:scope.episode_id,scope_sha256:compositionHash(scope),source_sha256:compositionHash(ledger),member_claims,shared_claims:claims.filter(c=>c.claim_scope!=='member'),selected_refs:claims.map(c=>c.id),claims,creative_quality_verified:false};
}

export function validateEpisodeEvidencePool(ledger,research){validateResearchScope(research);const entries=ledger.entries??ledger.sources;if(!Array.isArray(entries))throw Error('EPISODE_EVIDENCE_ENTRIES');for(const e of entries){if(!['element','shared','member','comparison'].includes(e.claim_scope)||!Array.isArray(e.member_ids)||!e.member_ids.length||new Set(e.member_ids).size!==e.member_ids.length||e.member_ids.some(m=>!research.candidate_member_ids.includes(m)))throw Error('EPISODE_EVIDENCE_POOL_SCOPE '+e.id);}return {status:'VALID',not_an_approval:true};}
