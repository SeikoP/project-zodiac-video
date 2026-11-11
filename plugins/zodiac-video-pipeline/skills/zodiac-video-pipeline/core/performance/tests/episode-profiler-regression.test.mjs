import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordEpisodeSpan,summarizeEpisodeSpans,performanceIdentity} from '../episode-profiler.mjs';
async function withSpace(fn){const p=await mkdtemp(path.join(tmpdir(),'zodiac-e2e-'));try{await fn(p)}finally{await rm(p,{recursive:true,force:true})}}
const iso=s=>new Date(1700000000000+s).toISOString();
const rec=(phase,start,end,extra={})=>({phase,stage:'demo',duration_ms:end-start,run_id:'run-one',revision_id:'rev-a',started_at:iso(start),ended_at:iso(end),...extra});

test('local Phase 2 exposes observed timing without pretending missing Phase 1 or agent time was measured',async()=>withSpace(async p=>{
 await recordEpisodeSpan(p,rec('02-visual-production',0,100,{category:'native',status:'BLOCKED'}));
 await recordEpisodeSpan(p,rec('02-visual-production',80,150,{category:'native'}));
 await recordEpisodeSpan(p,rec('02-visual-production',200,250,{category:'review_wait'}));
 const all=await summarizeEpisodeSpans(p),s=all.per_phase['02-visual-production'];
 assert.equal(all.plugin_wall_clock_ms,null);assert.equal(all.not_full_e2e_baseline,true);
 assert.equal(s.observed_wall_clock_ms,250);assert.equal(s.observed_interval_union_ms,200);assert.equal(s.observed_gap_ms,50);
 assert.equal(s.review_wait_wall_clock_ms,50);assert.equal(s.timing_scope,'observed_spans_only');
 assert.ok(s.unmeasured_categories.includes('agent_compute'));
}));

test('phase-local timing refuses mixed identities and duration-only spans',async()=>withSpace(async p=>{
 await recordEpisodeSpan(p,rec('02-visual-production',0,100));
 await recordEpisodeSpan(p,rec('02-visual-production',100,150,{revision_id:'rev-b'}));
 let all=await summarizeEpisodeSpans(p);assert.equal(all.per_phase['02-visual-production'].observed_wall_clock_ms,null);
 await recordEpisodeSpan(p,{phase:'03-handoff',stage:'legacy',duration_ms:20});
 all=await summarizeEpisodeSpans(p);assert.equal(all.per_phase['03-handoff'].observed_wall_clock_ms,null);
}));
test('overlap is not double-counted, runner excluded, review wait subtracted',async()=>withSpace(async p=>{
 await recordEpisodeSpan(p,rec('01-content',0,200,{category:'agent_compute'}));
 await recordEpisodeSpan(p,rec('02-visual-production',100,300,{category:'native'}));
 await recordEpisodeSpan(p,rec('03-handoff',300,400,{category:'transport'}));
 await recordEpisodeSpan(p,rec('02-visual-production',125,175,{category:'review_wait'}));
 await recordEpisodeSpan(p,rec('local-runner',400,900,{category:'native'}));
 const s=await summarizeEpisodeSpans(p);
 assert.equal(s.not_full_e2e_baseline,false);
 assert.equal(s.observed_stage_duration_ms,550);
 assert.equal(s.plugin_wall_clock_ms,400);
 assert.equal(s.plugin_observed_interval_union_ms,400);
 assert.equal(s.review_wait_wall_clock_ms,50);
 assert.equal(s.elapsed_excluding_review_wait_ms,350);
 assert.equal(s.excluded_local_runner_spans,1);
}));
test('duration-only legacy spans cannot claim a full E2E baseline',async()=>withSpace(async p=>{
 for(const phase of ['01-content','02-visual-production','03-handoff'])await recordEpisodeSpan(p,{phase,stage:'legacy',duration_ms:100});
 const s=await summarizeEpisodeSpans(p);assert.equal(s.plugin_wall_clock_ms,null);assert.equal(s.not_full_e2e_baseline,true);
 assert.ok(s.baseline_blockers.includes('MISSING_OR_INVALID_INTERVAL'));
}));
test('mixed revisions cannot claim wall-clock result',async()=>withSpace(async p=>{
 await recordEpisodeSpan(p,rec('01-content',0,50));
 await recordEpisodeSpan(p,rec('02-visual-production',50,100,{revision_id:'rev-b'}));
 await recordEpisodeSpan(p,rec('03-handoff',100,150));
 const s=await summarizeEpisodeSpans(p);assert.equal(s.plugin_wall_clock_ms,null);
 assert.ok(s.baseline_blockers.includes('MIXED_RUN_OR_REVISION'));
}));
test('rejects inverted timestamps',async()=>withSpace(async p=>{
 await assert.rejects(()=>recordEpisodeSpan(p,rec('01-content',300,100,{duration_ms:5})),/FAST_SPAN_TIME_INVALID/);
}));

test('performance identity is stable for a run/plugin pair and rejects templates',()=>{
 const a=performanceIdentity({run_id:'run-123',plugin_version:'2.8.0'}),b=performanceIdentity({run_id:'run-123',plugin_version:'2.8.0'});
 assert.deepEqual(a,b);assert.equal(a.run_id,'run-123');assert.match(a.revision_id,/^[a-f0-9]{20}$/u);
 assert.equal(performanceIdentity({run_id:'<create-per-run>',plugin_version:'2.8.0'}),null);
});


test('failed repair attempts stay inside wall-clock E2E without poisoning a later PASS',async()=>{
 const ws=await mkdtemp(path.join(tmpdir(),'z-profiler-repair-'));
 try{
  const origin=Date.parse('2026-11-09T12:00:00.000Z');
  const rec=(phase,stage,status,start,duration)=>recordEpisodeSpan(ws,{phase,stage,status,category:'native',duration_ms:duration,run_id:'run-1',revision_id:'rev-1',started_at:new Date(origin+start).toISOString(),ended_at:new Date(origin+start+duration).toISOString()});
  await rec('01-content','commit','PASS',0,40);
  await rec('02-visual-production','native-attempt-1','BLOCKED',50,50);
  await rec('02-visual-production','native-attempt-2','PASS',110,70);
  await rec('03-handoff','export','PASS',200,40);
  const summary=await summarizeEpisodeSpans(ws);
  assert.equal(summary.not_full_e2e_baseline,false);
  assert.equal(summary.plugin_wall_clock_ms,240);
  assert.equal(summary.failed_spans,1);
  assert.equal(summary.failed_stage_duration_ms,50);
  assert.equal(summary.per_phase['02-visual-production'].pass_spans,1);
  assert.equal(summary.per_phase['02-visual-production'].non_pass_spans,1);
 }finally{await rm(ws,{recursive:true,force:true});}
});
