#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-silent-read-review.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const raw=n=>readFile(path.join(dir,n),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const fail=m=>{throw Error('SILENT_READ_REVIEW_INVALID '+m);};
try{
 const [narration,plan,candidates,reviewRaw]=await Promise.all(['narration.txt','narrative-plan.json','concept-candidates.json','silent-read-review.json'].map(raw));
 const review=JSON.parse(reviewRaw),spoken=norm(narration);
 if(review.format!=='zodiac-silent-read-review@1')fail('format');
 if(review.reviewer_role!=='silent_reader')fail('reviewer_role');
 if(review.source?.narration_sha256!==hash(narration)||review.source?.plan_sha256!==hash(plan)||review.source?.candidates_sha256!==hash(candidates))fail('source_lineage');
 const keys=['premise_clarity','progression_without_performance','contradiction_reframe_legibility','recognition_on_page','payoff_without_audiovisual_help','ending_energy_on_page','sign_irreplaceability_on_page'];
 if(!review.criteria||Object.keys(review.criteria).sort().join('|')!==[...keys].sort().join('|'))fail('criteria');
 const unresolved=[];
 for(const key of keys){
  const c=review.criteria[key];
  if(!c||!['PASS','REVIEW'].includes(c.result))fail(key+'.result');
  if(typeof c.response!=='string'||c.response.trim().length<25)fail(key+'.response');
  if(typeof c.evidence_excerpt!=='string')fail(key+'.evidence_excerpt');
  const ex=norm(c.evidence_excerpt),words=ex.split(' ').filter(Boolean);
  if(words.length<3||words.length>35||!spoken.includes(ex))fail(key+'.evidence_excerpt_grounding');
  if(c.result==='REVIEW')unresolved.push(key);
 }
 if(!['PASS','REVIEW'].includes(review.decision)||!Array.isArray(review.revision_targets))fail('decision');
 if(review.decision==='PASS'&&(unresolved.length||review.revision_targets.length))fail('pass_with_unresolved');
 if(review.decision==='REVIEW'&&!review.revision_targets.length)fail('review_without_targets');
 if(review.decision!=='PASS')fail('Content Review blocked by silent-read REVIEW');
 console.log('SILENT_READ_REVIEW_PASS: criteria='+keys.length);
}catch(e){console.error(e.message);process.exitCode=2;}
