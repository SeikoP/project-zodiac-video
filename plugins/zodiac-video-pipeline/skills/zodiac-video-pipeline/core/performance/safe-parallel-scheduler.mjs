// Fail-closed dependency scheduler. Only explicitly declared disjoint writes may overlap.
// The caller owns all native gates, leases, approvals and receipt verification.
export function planSafeParallel(tasks,{maxConcurrency=3}={}){
 if(!Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>8)throw Error('FAST_CONCURRENCY_INVALID');
 const items=new Map(),levels=[],completed=new Set();
 for(const t of tasks){
  if(!t?.id||items.has(t.id)||!Array.isArray(t.reads)||!Array.isArray(t.writes)||!Array.isArray(t.dependencies))throw Error('FAST_TASK_CONTRACT_INVALID '+t?.id);
  if(!t.reads.every(x=>typeof x==='string'&&x)||!t.writes.every(x=>typeof x==='string'&&x))throw Error('FAST_IO_CONTRACT_INVALID '+t.id);
  if(t.writes.some(x=>t.reads.includes(x)))throw Error('FAST_TASK_SELF_CONFLICT '+t.id);
  items.set(t.id,t);
 }
 for(const t of tasks)for(const d of t.dependencies)if(!items.has(d))throw Error('FAST_TASK_DEPENDENCY_MISSING '+d);
 const conflict=(a,b)=>a.writes.some(p=>b.writes.includes(p)||b.reads.includes(p))||b.writes.some(p=>a.reads.includes(p));
 while(completed.size<tasks.length){
  const ready=tasks.filter(t=>!completed.has(t.id)&&t.dependencies.every(d=>completed.has(d)));
  if(!ready.length)throw Error('FAST_TASK_CYCLE');
  const batch=[];
  for(const t of ready){if(batch.length>=maxConcurrency)break;if(batch.every(b=>!conflict(t,b)))batch.push(t);}
  if(!batch.length)throw Error('FAST_TASK_UNSAFE_BATCH');
  levels.push(batch.map(x=>x.id));for(const t of batch)completed.add(t.id);
 }
 return {format:'zodiac-safe-parallel-plan@1',max_concurrency:maxConcurrency,batches:levels,ordered_tasks:levels.flat()};
}
export async function runSafeParallel(tasks,{maxConcurrency=3,execute}={}){
 if(typeof execute!=='function')throw Error('FAST_EXECUTOR_REQUIRED');
 const plan=planSafeParallel(tasks,{maxConcurrency}),byId=new Map(tasks.map(t=>[t.id,t])),results=[];
 for(const ids of plan.batches){
  const settled=await Promise.allSettled(ids.map(id=>execute(byId.get(id))));
  for(let i=0;i<ids.length;i++){const outcome=settled[i];results.push({id:ids[i],status:outcome.status==='fulfilled'?'PASS':'FAIL',...(outcome.status==='fulfilled'?{value:outcome.value}:{error:String(outcome.reason)})});}
  if(settled.some(x=>x.status==='rejected'))return {status:'BLOCKED',plan,results,not_an_approval:true};
 }
 return {status:'PASS',plan,results,not_an_approval:true};
}
