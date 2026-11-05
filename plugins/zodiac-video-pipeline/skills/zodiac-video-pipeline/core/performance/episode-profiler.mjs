import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const E2E_FORMAT='zodiac-e2e-performance@1';
const categories=new Set(['agent_compute','native','tool_wait','review_wait','transport','other']);
const phases=new Set(['01-content','02-visual-production','03-handoff','local-runner']);
const pluginPhases=['01-content','02-visual-production','03-handoff'];
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const sum=xs=>+xs.reduce((a,n)=>a+n,0).toFixed(2);
const intervalUnion=spans=>{
 const intervals=spans.map(s=>[Date.parse(s.started_at),Date.parse(s.ended_at)]).sort((a,b)=>a[0]-b[0]);
 let total=0,start=null,end=null;
 for(const [s,e] of intervals){
  if(start===null){start=s;end=e;continue;}
  if(s<=end){end=Math.max(end,e);} else {total+=end-start;start=s;end=e;}
 }
 if(start!==null)total+=end-start;
 return +total.toFixed(2);
};
export async function recordEpisodeSpan(workspace,{phase,stage,category='native',duration_ms,status='PASS',metadata={},run_id=null,revision_id=null,started_at=null,ended_at=null}={}){
 if(!phases.has(phase)||typeof stage!=='string'||!stage.trim()||!categories.has(category)||!Number.isFinite(duration_ms)||duration_ms<0)throw Error('FAST_SPAN_INVALID');
 // Legacy duration-only spans remain readable, but cannot prove wall-clock E2E.
 if((started_at!==null||ended_at!==null)&&(!validTime(started_at)||!validTime(ended_at)||Date.parse(ended_at)<Date.parse(started_at)))throw Error('FAST_SPAN_TIME_INVALID');
 if(run_id!==null&&(typeof run_id!=='string'||!run_id.trim()))throw Error('FAST_SPAN_RUN_INVALID');
 if(revision_id!==null&&(typeof revision_id!=='string'||!revision_id.trim()))throw Error('FAST_SPAN_REVISION_INVALID');
 const root=path.join(path.resolve(workspace),'.authoring','perf-events');await mkdir(root,{recursive:true});
 const id=randomUUID(),record={format:'zodiac-e2e-span@1',id,phase,stage,category,duration_ms:+duration_ms.toFixed(2),status,metadata,run_id,revision_id,started_at,ended_at,recorded_at:new Date().toISOString(),not_an_approval:true};
 const target=path.join(root,id+'.json'),tmp=target+'.tmp';await writeFile(tmp,JSON.stringify(record,null,2)+'\n');await rename(tmp,target);return record;
}
export async function summarizeEpisodeSpans(workspace){
 const root=path.join(path.resolve(workspace),'.authoring','perf-events');let names=[];
 try{names=(await readdir(root)).filter(n=>/^[a-f0-9-]{36}\.json$/u.test(n)).sort();}catch(e){if(e.code!=='ENOENT')throw e;}
 const all=[];for(const n of names){const s=JSON.parse(await readFile(path.join(root,n),'utf8'));if(s.format!=='zodiac-e2e-span@1')throw Error('FAST_SPAN_FORMAT_INVALID');all.push(s);}
 const spans=all.filter(s=>pluginPhases.includes(s.phase)),runner=all.filter(s=>s.phase==='local-runner');
 const totals=Object.fromEntries([...categories].map(c=>[c,sum(spans.filter(s=>s.category===c).map(s=>s.duration_ms))]));
 const perPhase=Object.fromEntries(pluginPhases.map(p=>[p,{spans:spans.filter(s=>s.phase===p).length,duration_ms:sum(spans.filter(s=>s.phase===p).map(s=>s.duration_ms))}]));
 const runIds=[...new Set(spans.map(s=>s.run_id).filter(Boolean))];
 const revisions=[...new Set(spans.map(s=>s.revision_id).filter(Boolean))];
 const reasons=[];
 if(!pluginPhases.every(p=>perPhase[p].spans>0))reasons.push('MISSING_PLUGIN_PHASE');
 if(spans.some(s=>!s.run_id||!s.revision_id))reasons.push('MISSING_RUN_OR_REVISION_ID');
 if(runIds.length!==1||revisions.length!==1)reasons.push('MIXED_RUN_OR_REVISION');
 if(spans.some(s=>!validTime(s.started_at)||!validTime(s.ended_at)||Date.parse(s.ended_at)<Date.parse(s.started_at)))reasons.push('MISSING_OR_INVALID_INTERVAL');
 if(spans.some(s=>s.status!=='PASS'))reasons.push('NON_PASS_STAGE');
 const intervalsValid=!reasons.includes('MISSING_OR_INVALID_INTERVAL')&&spans.length>0;
 const wall=intervalsValid?Math.max(...spans.map(s=>Date.parse(s.ended_at)))-Math.min(...spans.map(s=>Date.parse(s.started_at))):null;
 const covered=intervalsValid?intervalUnion(spans):null;
 const review=intervalsValid?intervalUnion(spans.filter(s=>s.category==='review_wait')):null;
 const categoriesUnion=intervalsValid?Object.fromEntries([...categories].map(c=>[c,intervalUnion(spans.filter(s=>s.category===c))])):null;
 return {format:E2E_FORMAT,workspace:path.resolve(workspace),spans:spans.length,excluded_local_runner_spans:runner.length,run_id:runIds.length===1?runIds[0]:null,revision_id:revisions.length===1?revisions[0]:null,totals,per_phase:perPhase,
  // Historical additive metric is diagnostic only, NEVER wall-clock E2E.
  observed_stage_duration_ms:sum(Object.values(totals)),
  plugin_wall_clock_ms:intervalsValid&&reasons.length===0?wall:null,
  plugin_observed_interval_union_ms:intervalsValid&&reasons.length===0?covered:null,
  plugin_unmeasured_gap_ms:intervalsValid&&reasons.length===0?+(wall-covered).toFixed(2):null,
  review_wait_wall_clock_ms:intervalsValid&&reasons.length===0?review:null,
  elapsed_excluding_review_wait_ms:intervalsValid&&reasons.length===0?+(wall-review).toFixed(2):null,
  category_interval_union_ms:intervalsValid&&reasons.length===0?categoriesUnion:null,
  unmeasured_categories:[...categories].filter(c=>!spans.some(s=>s.category===c)),
  not_full_e2e_baseline:reasons.length>0,
  baseline_blockers:reasons,
  not_an_approval:true};
}
