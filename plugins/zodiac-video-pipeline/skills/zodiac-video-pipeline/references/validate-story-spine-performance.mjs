#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const [planArg,narrArg,auditArg]=process.argv.slice(2);
if(!planArg||!narrArg||!auditArg){
  console.error('Usage: node validate-story-spine-performance.mjs <narrative-plan.json> <narration.txt> <story-spine-performance.json>');
  process.exit(2);
}
const fail=(code,msg)=>{throw new Error(`${code}: ${msg}`);};
const planRaw=await readFile(path.resolve(planArg));
const narrationRaw=await readFile(path.resolve(narrArg));
const plan=JSON.parse(planRaw.toString('utf8'));
const narration=narrationRaw.toString('utf8');
const audit=JSON.parse(await readFile(path.resolve(auditArg),'utf8'));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const spoken=norm(narration);
const txt=(s,k)=>{if(typeof s!=='string'||!s.trim())fail('STORY_SPINE_INVALID',`${k} required`);return s.trim();};
const quote=(s,k)=>{
  const raw=txt(s,k),n=norm(raw),len=n.split(' ').filter(Boolean).length;
  if(len<3||len>35)fail('STORY_SPINE_QUOTE_INVALID',`${k} requires 3..35 words, got ${len}`);
  const p=spoken.indexOf(n);
  if(p===-1)fail('STORY_SPINE_QUOTE_NOT_FOUND',`${k} not found in narration`);
  return {n,position:p};
};
if(audit.format!=='zodiac-story-spine-performance@1')fail('STORY_SPINE_INVALID','unsupported format');
if(audit.source?.plan_sha256!==hash(planRaw)||audit.source?.narration_sha256!==hash(narrationRaw))
  fail('STORY_SPINE_SOURCE_DRIFT','plan/narration changed since the review; rerun semantic review');
if(!['PASS','REVIEW'].includes(audit.decision))fail('STORY_SPINE_INVALID','decision must be PASS or REVIEW');
if(!Array.isArray(audit.revision_targets))fail('STORY_SPINE_INVALID','revision_targets must be an array');
const anchors=['identity_tension','starting_read','progression_intent','payoff_target'];
const quotes=[];
for(const k of anchors){
  txt(plan.story_spine?.[k],`plan.story_spine.${k}`);
  const a=audit.spine?.[k];
  if(!a||!['PASS','REVIEW'].includes(a.assessment))fail('STORY_SPINE_INVALID',`spine.${k}.assessment missing`);
  txt(a.reason,`spine.${k}.reason`);
  quotes.push(quote(a.evidence_excerpt,`spine.${k}.evidence_excerpt`).n);
}
if(!Array.isArray(plan.beats)||plan.beats.length<1)fail('STORY_SPINE_INVALID','plan beats missing');
if(!Array.isArray(audit.beats)||audit.beats.length!==plan.beats.length)
  fail('STORY_SPINE_BEAT_COVERAGE',`expected ${plan.beats.length} beat reviews`);
let previous=-1;
for(let i=0;i<plan.beats.length;i++){
  const expected=plan.beats[i],b=audit.beats[i];
  if(b?.beat_id!==expected.id)fail('STORY_SPINE_BEAT_ORDER',`expected ${expected.id} at index ${i}`);
  if(!['PASS','REVIEW'].includes(b.assessment))fail('STORY_SPINE_INVALID',`${b.beat_id}.assessment missing`);
  for(const field of ['character_action','response_or_state_change','semantic_delta_realized','spine_effect','review_note'])txt(b[field],`${b.beat_id}.${field}`);
  const q=quote(b.evidence_excerpt,`${b.beat_id}.evidence_excerpt`);
  if(q.position<=previous)fail('STORY_SPINE_BEAT_ORDER',`excerpts out of narration order at ${b.beat_id}`);
  previous=q.position; quotes.push(q.n);
}
if(new Set(quotes).size<Math.min(5,quotes.length))fail('STORY_SPINE_EVIDENCE_REUSE','too few independent narration excerpts');
const problems=[...anchors.filter(k=>audit.spine[k].assessment==='REVIEW'),...audit.beats.filter(b=>b.assessment==='REVIEW').map(b=>b.beat_id)];
if(problems.length>0||audit.decision!=='PASS'||audit.revision_targets.length>0)
  fail('STORY_SPINE_REVIEW_REQUIRED',`unresolved: ${problems.join(', ')||audit.decision}`);
console.log(`STORY_SPINE_PERFORMANCE_PASS: anchors=${anchors.length} beats=${plan.beats.length} distinct_excerpts=${new Set(quotes).size}`);
