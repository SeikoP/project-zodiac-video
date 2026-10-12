import {fileURLToPath} from 'node:url';import path from 'node:path';
import {compositionHash} from '../../orchestration/phase02-composition.mjs';import {readArtifact,writeArtifact} from '../../orchestration/phase01-artifacts.mjs';
const fail=m=>{throw Error('EVIDENCE_BRIEF_INVALID '+m);};
export function compileEvidenceBrief(ledger,{evidence_ids,max_bytes=12000}={}){
 const entries=ledger.entries??ledger.sources;if(!Array.isArray(entries)||entries.length<2)fail('SOURCES');
 if((ledger.unresolved_conflicts??[]).length)fail('UNRESOLVED_CONFLICT');
 const chosen=evidence_ids?new Set(evidence_ids):null,ids=new Set(),sources=new Set(),claims=[];
 for(const e of entries){if(!e.id||ids.has(e.id))fail('DUPLICATE_ID');ids.add(e.id);if(chosen&&!chosen.has(e.id))continue;
  let url;try{url=new URL(e.url);}catch{fail('URL '+e.id);}if(!['http:','https:'].includes(url.protocol))fail('URL '+e.id);
  let canonical=url;try{if(e.canonical_url)canonical=new URL(e.canonical_url);}catch{fail('CANONICAL_URL');}if(!['http:','https:'].includes(canonical.protocol))fail('CANONICAL_URL');
  const source=String(e.original_author??e.source_origin??canonical.hostname.replace(/^www\./,'')).trim().toLowerCase();if(!source)fail('SOURCE');sources.add(source);
  const claim=e.supported_interpretation??e.interpretation??e.claim??e.summary??e.supports;
  if(typeof claim!=='string'||!claim.trim()||typeof e.scope!=='string'||!e.scope.trim())fail('CLAIM_SCOPE '+e.id);
  if(!['astrology_interpretation','editorial_inference','fictional_example','language_corpus'].includes(e.claim_class))fail('CLAIM_CLASS '+e.id);
  if(e.conflict_unresolved===true)fail('UNRESOLVED_CONFLICT '+e.id);
  claims.push({id:e.id,claim,url:e.url,source_identity:source,claim_class:e.claim_class,scope:e.scope,...(e.member_ids?{member_ids:structuredClone(e.member_ids),claim_scope:e.claim_scope}:{}),...(e.published_at?{published_at:e.published_at}:{})});
 }
 if(chosen)for(const id of chosen)if(!claims.some(e=>e.id===id))fail('MISSING_REF '+id);
 if(sources.size<2)fail('INDEPENDENT_SOURCES');
 const out={format:'zodiac-evidence-brief@1',source_sha256:compositionHash(ledger),claims,independent_sources:sources.size,conflicts:[],unresolved:[],creative_quality_verified:false};
 if(Buffer.byteLength(JSON.stringify(out))>max_bytes)fail('BUDGET_EXCEEDED select evidence IDs; never silently truncate');return out;
}
export async function compileEvidenceBriefWorkspace(root,{write=false}={}){const brief=compileEvidenceBrief(await readArtifact(root,'evidence-ledger.json'));if(write)await writeArtifact(root,'evidence-brief.json',brief);else if(compositionHash(await readArtifact(root,'evidence-brief.json'))!==compositionHash(brief))fail('SOURCE_DRIFT');return brief;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){compileEvidenceBriefWorkspace(process.argv[2],{write:process.argv.includes('--write')}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=2;});}
