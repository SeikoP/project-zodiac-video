const overlapArea=(a,b)=>{
  const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return x*y;
};
const area=(r)=>Math.max(0,r.width)*Math.max(0,r.height);
export const overlapRatio=(a,b)=>{
  const denom=Math.min(area(a),area(b));
  return denom>0?overlapArea(a,b)/denom:0;
};
export const effectiveZIndex=(layer,entityIndex)=>layer*1000+entityIndex/1000;
const activeSnapshot=(scene,stateIds,label)=>({
  label,
  nodes:scene.entities.flatMap((entity,index)=>{
    const stateId=stateIds.get(entity.id);
    const state=stateId?entity.states?.[stateId]:null;
    return state?.visible?[{entity,index,stateId,state}]:[];
  }),
});
export const sceneStateSnapshots=(scene)=>{
  const states=new Map(scene.entities.map((entity)=>[entity.id,entity.initial_state]));
  const out=[activeSnapshot(scene,states,"initial")];
  for(const event of scene.events??[]){
    if(event.target==="camera")continue;
    states.set(event.target,event.state_after);
    out.push(activeSnapshot(scene,states,"after:"+event.id));
  }
  return out;
};
export const validateSceneLayerSafety=(scene,{minimumOverlapRatio=0.08}={})=>{
  for(const snapshot of sceneStateSnapshots(scene)){
    const nodes=snapshot.nodes;
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];
      const ratio=overlapRatio(a.state.transform,b.state.transform);
      if(ratio<minimumOverlapRatio)continue;
      if(a.state.layer===b.state.layer){
        throw new Error(
          `LAYER_AMBIGUITY: ${scene.id}/${snapshot.label} ${a.entity.id}.${a.stateId} and ${b.entity.id}.${b.stateId} overlap ${Math.round(ratio*100)}% on layer ${a.state.layer}; assign explicit front/back layers.`
        );
      }
    }
  }
};
