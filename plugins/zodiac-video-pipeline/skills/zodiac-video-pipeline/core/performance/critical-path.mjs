import {performance} from 'node:perf_hooks';
export const FAST_PROFILE_FORMAT='zodiac-fast-profile@1';
export function criticalPath(tasks,{durations={}}={}){
 const byId=new Map(tasks.map(t=>[t.id,t]));const done=new Map(),visiting=new Set();
 const visit=id=>{
  if(done.has(id))return done.get(id);
  if(visiting.has(id))throw Error('FAST_PROFILE_CYCLE '+id);
  const item=byId.get(id);if(!item)throw Error('FAST_PROFILE_MISSING_DEPENDENCY '+id);
  visiting.add(id);let best={duration_ms:0,path:[]};
  for(const dep of item.dependencies??[]){const candidate=visit(dep);if(candidate.duration_ms>best.duration_ms)best=candidate;}
  const ms=Number(durations[id]??item.duration_ms??0);
  if(!Number.isFinite(ms)||ms<0)throw Error('FAST_PROFILE_DURATION_INVALID '+id);
  const result={duration_ms:best.duration_ms+ms,path:[...best.path,id]};visiting.delete(id);done.set(id,result);return result;
 };
 let longest={duration_ms:0,path:[]};for(const t of tasks){const p=visit(t.id);if(p.duration_ms>longest.duration_ms)longest=p;}
 return {critical_path_ms:longest.duration_ms,critical_path:longest.path,task_count:tasks.length};
}
export function summarizeFastProfile({started_ms,ended_ms,steps=[],dependencies={},phase='02-visual-production',review_wait_ms=0,preflight_wall_ms=0}={}){
 const elapsed=Math.max(0,(ended_ms??performance.now())-(started_ms??0));
 const tasks=steps.map(s=>({id:s.id,duration_ms:Number(s.elapsed_ms??0),dependencies:(dependencies[s.id]??[]).filter(id=>steps.some(t=>t.id===id))}));
 const total=tasks.reduce((a,t)=>a+t.duration_ms,0);const path=criticalPath(tasks);
 return {format:FAST_PROFILE_FORMAT,phase,wall_clock_ms:+elapsed.toFixed(2),native_step_ms:+total.toFixed(2),preflight_wall_ms:+preflight_wall_ms.toFixed(2),overhead_ms:+Math.max(0,elapsed-total-preflight_wall_ms).toFixed(2),review_wait_ms,cache_hit_count:steps.filter(s=>s.status==='SKIPPED_REUSED').length,failed_count:steps.filter(s=>s.status==='FAIL').length,critical_path:path.critical_path,critical_path_ms:path.critical_path_ms,steps:steps.map(s=>({id:s.id,status:s.status,elapsed_ms:s.elapsed_ms??0,cache_reason:s.cache_reason??null})),not_an_approval:true};
}
export function profileScope(clock=()=>performance.now()){
 const started=clock(),events=[];
 return {mark:(name,extra={})=>events.push({name,at_ms:+(clock()-started).toFixed(3),...extra}),finish:()=>({wall_clock_ms:+(clock()-started).toFixed(3),events})};
}
