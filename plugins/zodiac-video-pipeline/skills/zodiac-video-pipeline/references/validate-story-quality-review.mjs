#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-story-quality-review.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace);
const read=(n)=>readFile(path.join(root,'.authoring',n),'utf8');
const fail=(m)=>{throw new Error('STORY_QUALITY_REVIEW_INVALID: '+m);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const [rawPlan,rawNarration,rawCandidate,rawReview]=await Promise.all(['narrative-plan.json','narration.txt','concept-candidates.json','story-quality-review.json'].map(read));
const plan=JSON.parse(rawPlan),candidates=JSON.parse(rawCandidate),q=JSON.parse(rawReview),narration=norm(rawNarration);
if(q.format!=='zodiac-story-quality-review@1')fail('format');
if(q.source?.plan_sha256!==hash(rawPlan)||q.source?.narration_sha256!==hash(rawNarration)||q.source?.candidates_sha256!==hash(rawCandidate))fail('stale or incorrect source fingerprints');
if(q.selected_concept_id!==plan.selected_concept_id||q.selected_concept_id!==candidates.selected_candidate_id)fail('selected concept mismatch');
if(q.reviewer_role!=='editorial_challenger')fail('reviewer_role must be editorial_challenger');
if(typeof q.blind_read_verdict!=='string'||q.blind_read_verdict.trim().length<35)fail('blind_read_verdict must be substantive');
const keys=['premise_strength','stakes_or_recognition','progression_and_turn','sign_irreplaceability','payoff_and_callback','silent_read_test'];
if(!q.criteria||Object.keys(q.criteria).sort().join('|')!==[...keys].sort().join('|'))fail('exact six editorial criteria required');
const excerpts=new Set(),objections=new Set();let unresolved=[];
for(const k of keys){
 const c=q.criteria[k];if(!c||!['PASS','REVIEW'].includes(c.result))fail(k+'.result');
 for(const prop of ['objection','response','evidence_excerpt'])if(typeof c[prop]!=='string'||c[prop].trim().length<(prop==='evidence_excerpt'?15:25))fail(k+'.'+prop+' must be substantive');
 const excerpt=norm(c.evidence_excerpt);if(excerpt.split(' ').length<3||excerpt.split(' ').length>35||!narration.includes(excerpt))fail(k+'.evidence_excerpt not grounded in narration');
 excerpts.add(excerpt);objections.add(norm(c.objection));
 if(c.result==='REVIEW')unresolved.push(k);
}
if(excerpts.size<4)fail('at least four distinct grounded excerpts');
if(objections.size<5)fail('recycled generic objections not accepted');
if(!['PASS','REVIEW'].includes(q.decision)||!Array.isArray(q.revision_targets))fail('decision or revision_targets');
if(q.decision==='PASS'&&(unresolved.length||q.revision_targets.length))fail('cannot PASS unresolved editorial objections');
if(q.decision==='REVIEW'&&!q.revision_targets.length)fail('REVIEW requires revision_targets');
// Fresh 2.4.15+ runs cannot PASS editorial review without an explicit
// Zodiac-vs-generic-story challenge grounded in narration. This is a
// provenance/decision check, not an automated quality score.
let needsIdentity=false;
try{const state=JSON.parse(await readFile(path.join(root,'.authoring','pipeline-state.json'),'utf8'));
 const v=String(state.plugin_version??'').split('.').map(Number);
 needsIdentity=state.run_mode==='fresh'&&(v[0]>2||v[0]===2&&(v[1]>4||v[1]===4&&v[2]>=15));
}catch(e){if(e.code!=='ENOENT')throw e;}
if(needsIdentity){
 const a=q.zodiac_identity_review;
 if(!a||!['PASS','REVIEW'].includes(a.decision))fail('zodiac_identity_review missing');
 for(const key of ['sign_swap','scene_dominance','moral_arc_drift']){
  const c=a[key];if(!c||!['PASS','REVIEW'].includes(c.result))fail('zodiac_identity_review.'+key);
  if(typeof c.objection!=='string'||c.objection.length<25||typeof c.response!=='string'||c.response.length<25)fail('zodiac_identity_review.'+key+' assessment missing');
  if(typeof c.evidence_excerpt!=='string'||!narration.includes(norm(c.evidence_excerpt))||norm(c.evidence_excerpt).split(' ').length<3)fail('zodiac_identity_review.'+key+' excerpt not grounded');
  if(c.result==='REVIEW')fail('zodiac identity unresolved: '+key);
 }
 if(a.decision!=='PASS')fail('zodiac identity review blocks Content Review');
}
if(q.decision!=='PASS')fail('Content Review blocked by story-quality REVIEW');
console.log(`STORY_QUALITY_REVIEW_CONTRACT_PASS: criteria=${keys.length}; editorial_quality_unverified`);
