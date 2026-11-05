import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordEpisodeSpan,summarizeEpisodeSpans} from '../episode-profiler.mjs';
async function withSpace(fn){const p=await mkdtemp(path.join(tmpdir(),'zodiac-e2e-'));try{await fn(p)}finally{await rm(p,{recursive:true,force:true})}}
const iso=s=>new Date(1700000000000+s).toISOString();
const rec=(phase,start,end,extra={})=>({phase,stage:'demo',duration_ms:end-start,run_id:'run-one',revision_id:'rev-a',started_at:iso(start),ended_at:iso(end),...extra});
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
