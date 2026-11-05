// Deterministic scene-level authoring and native scheduling. Native compilation
// uses isolated child processes, then the executor performs a single aggregate publish.
export function planSceneBatches(graph,{maxConcurrency=3,dirtySceneIds=null}={}){
 if(graph?.status!=='PASS')throw Error('SCENE_GRAPH_BLOCKED');
 if(!Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>12)throw Error('SCENE_CONCURRENCY_INVALID');
 const all=graph.nodes??[],active=new Set(dirtySceneIds??all.map(n=>n.scene_id)),finished=new Set(all.filter(n=>!active.has(n.scene_id)).map(n=>n.scene_id));
 for(const id of active)if(!all.some(n=>n.scene_id===id))throw Error('UNKNOWN_SCENE '+id);
 const remaining=new Map(all.filter(n=>active.has(n.scene_id)).map(n=>[n.scene_id,n]));
 const batches=[];
 while(remaining.size){
  const ready=[...remaining.values()].filter(n=>n.depends_on.every(dep=>finished.has(dep))).slice(0,maxConcurrency);
  if(!ready.length)throw Error('SCENE_GRAPH_CYCLE_OR_UNSATISFIED_DEPENDENCY');
  batches.push(ready.map(n=>n.scene_id));
  for(const n of ready){remaining.delete(n.scene_id);finished.add(n.scene_id);}
 }
 return {format:'zodiac-scene-batch-plan@1',max_concurrency:maxConcurrency,batches,scene_count:active.size,parallelizable:batches.some(b=>b.length>1),note:'Use for scene authoring/QC and dependency-aware native batches; native workers must use isolated snapshots and aggregate one atomic publish, never concurrent writes to production.json.',not_an_approval:true};
}
