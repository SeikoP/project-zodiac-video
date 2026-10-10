#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
const [qcPath,narrationPath]=process.argv.slice(2);
if(!qcPath||!narrationPath){console.error('Usage: node validate-narrative-qc.mjs <narrative-qc.json> <narration.txt>');process.exit(2);}
const qc=JSON.parse(await readFile(qcPath,'utf8'));
const narration=await readFile(narrationPath,'utf8');
const fail=m=>{throw new Error('NARRATIVE_QC_INVALID: '+m);};
const norm=v=>String(v??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const spoken=norm(narration);
const critical=['facet_novelty','progression','identity_coherence','sign_specificity','recognition_strength','payoff_convergence','repetitive_paraphrase','planner_language_cleanliness'];
const groundedExcerpts=[];
for(const key of critical){
  const item=qc[key];
  if(!item||!['PASS','REVIEW'].includes(item.result))fail(`${key}.result must be PASS or REVIEW`);
  if(typeof item.note!=='string'||!item.note.trim())fail(`${key}.note is required`);
  if(typeof item.evidence_excerpt!=='string'||!item.evidence_excerpt.trim())fail(`${key}.evidence_excerpt is required`);
  const excerpt=norm(item.evidence_excerpt);const excerptWords=excerpt.split(' ').filter(Boolean);if(excerptWords.length<3)fail(`${key}.evidence_excerpt must contain at least 3 words`);if(excerptWords.length>35)fail(`${key}.evidence_excerpt must stay <=35 words`);if(!excerpt||!spoken.includes(excerpt))fail(`${key}.evidence_excerpt not found in narration`);groundedExcerpts.push(excerpt);
}
if(new Set(groundedExcerpts).size<4)fail('semantic QC needs at least 4 distinct grounded excerpts across critical criteria');
if(qc.reference_mechanic_match){if(!['PASS','REVIEW','N/A'].includes(qc.reference_mechanic_match.result))fail('reference_mechanic_match.result invalid');if(qc.reference_mechanic_match.result!=='N/A'){if(typeof qc.reference_mechanic_match.evidence_excerpt!=='string'||!qc.reference_mechanic_match.evidence_excerpt.trim())fail('reference_mechanic_match.evidence_excerpt is required');if(!spoken.includes(norm(qc.reference_mechanic_match.evidence_excerpt)))fail('reference_mechanic_match.evidence_excerpt not found in narration');}}
if(!['PASS','REVIEW'].includes(qc.decision))fail('decision must be PASS or REVIEW');
if(!Array.isArray(qc.revision_targets))fail('revision_targets must be an array');
const reviews=critical.filter(k=>qc[k].result==='REVIEW');
if(qc.decision!=='PASS'||reviews.length)fail(`Content Review blocked; unresolved REVIEW: ${reviews.join(', ')||'decision'}`);
if(qc.revision_targets.length)fail('revision_targets must be empty when decision=PASS');
console.log(`NARRATIVE_QC_PASS: grounded_checks=${critical.length}`);
