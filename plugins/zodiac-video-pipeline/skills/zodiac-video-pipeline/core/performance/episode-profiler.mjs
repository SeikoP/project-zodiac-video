import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import path from 'node:path';import {randomUUID} from 'node:crypto';
export const E2E_FORMAT='zodiac-e2e-performance@1';
const categories=new Set(['agent_compute','native','tool_wait','review_wait','transport','other']);
const phases=new Set(['01-content','02-visual-production','03-handoff','local-runner']);
export async function recordEpisodeSpan(workspace,{phase,stage,category='native',duration_ms,status='PASS',metadata={}}={}){
 if(!phases.has(phase)||typeof stage!=='string'||!stage.trim()||!categories.has(category)||!Number.isFinite(duration_ms)||duration_ms<0)throw Error('FAST_SPAN_INVALID');
 const root=path.join(path.resolve(workspace),'.authoring','perf-events');await mkdir(root,{recursive:true});
 const id=randomUUID(),record={format:'zodiac-e2e-span@1',id,phase,stage,category,duration_ms:+duration_ms.toFixed(2),status,metadata,recorded_at:new Date().toISOString(),not_an_approval:true};
 const target=path.join(root,id+'.json'),tmp=target+'.tmp';await writeFile(tmp,JSON.stringify(record,null,2)+'\n');await rename(tmp,target);return record;
}
export async function summarizeEpisodeSpans(workspace){
 const root=path.join(path.resolve(workspace),'.authoring','perf-events');let names=[];
 try{names=(await readdir(root)).filter(n=>/^[a-f0-9-]{36}\.json$/u.test(n)).sort();}catch(e){if(e.code!=='ENOENT')throw e;}
 const spans=[];for(const n of names){const s=JSON.parse(await readFile(path.join(root,n),'utf8'));if(s.format!== 'zodiac-e2e-span@1')throw Error('FAST_SPAN_FORMAT_INVALID');spans.push(s);}
 const totals=Object.fromEntries([...categories].map(c=>[c,+spans.filter(s=>s.category===c).reduce((a,s)=>a+s.duration_ms,0).toFixed(2)]));
 const perPhase=Object.fromEntries([...phases].map(p=>[p,{spans:spans.filter(s=>s.phase===p).length,duration_ms:+spans.filter(s=>s.phase===p).reduce((a,s)=>a+s.duration_ms,0).toFixed(2)}]));
 return {format:E2E_FORMAT,workspace:path.resolve(workspace),spans:spans.length,totals,per_phase:perPhase,observed_stage_duration_ms:+Object.values(totals).reduce((a,n)=>a+n,0).toFixed(2),unmeasured_categories:[...categories].filter(c=>!spans.some(s=>s.category===c)),not_full_e2e_baseline:![...['01-content','02-visual-production','03-handoff']].every(p=>perPhase[p].spans>0),not_an_approval:true};
}
