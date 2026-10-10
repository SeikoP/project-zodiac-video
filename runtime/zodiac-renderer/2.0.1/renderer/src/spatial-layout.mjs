import {resolveSemanticMotion} from './semantic-motion.mjs';
import {resolveVisualRole,resolveLayer,resolveLayerOrder} from './visual-role.mjs';
export const overlapArea=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export function resolveEntityState(scene,entity,frame) {
  let stateId=entity.initial_state;
  let layer=entity.states[stateId]?.layer ?? entity.layer;
  for (const event of [...scene.events].filter(e=>e.target===entity.id).sort((a,b)=>a.end_frame-b.end_frame)) {
    if(frame>=event.end_frame) {stateId=event.state_after;layer=entity.states[stateId]?.layer ?? layer;} else break;
  }
  const state=entity.states[stateId] ?? entity.states[entity.initial_state];
  return state ? {...state,layer:state.layer ?? layer}:state;
}
export function resolveDisplayedEntityState(scene,entity,frame) {
  const original=resolveEntityState(scene,entity,frame);
  const event=scene.events.find(e=>e.target===entity.id&&frame>=e.start_frame&&frame<e.end_frame);
  if(original?.visible===false && ['fade-in','pop-in'].includes(event?.motion))
    return entity.states[event.state_after] ?? original;
  return original;
}
export function entityBounds(scene,entity,state,frame,asset={}) {
  const t=state.transform ?? {}, w=t.width ?? 520,h=t.height ?? 520;
  if(![t.x??0,t.y??0,w,h,t.scale??1,t.rotation??0].every(Number.isFinite) || w<=0 || h<=0 || (t.scale??1)<=0)
    throw new Error(`SPATIAL_GEOMETRY_INVALID scene=${scene.id} entity=${entity.id} frame=${frame}`);
  const event=scene.events.find(e=>e.target===entity.id && frame>=e.start_frame && frame<e.end_frame);
  const m=resolveSemanticMotion(event,scene,entity,frame);
  const scale=(t.scale ?? 1)*m.scale, angle=((t.rotation ?? 0)+m.rotateDeg)*Math.PI/180;
  const box=asset.visual_bounds ?? {x:0,y:0,width:1,height:1};
  const native=asset.intrinsic_size ?? {width:w,height:h};
  const fit=Math.min(w/native.width,h/native.height),drawW=native.width*fit,drawH=native.height*fit;
  const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>{
    const dx=(x-.5)*drawW*scale,dy=(y-.5)*drawH*scale;
    return {x:(t.x ?? 0)+w/2+m.translateX+dx*Math.cos(angle)-dy*Math.sin(angle),y:(t.y ?? 0)+h/2+m.translateY+dx*Math.sin(angle)+dy*Math.cos(angle)};
  });
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
}
export function auditSpatialLayout(plan) {
  const rows=[];
  for (const scene of plan.scenes) {
    for(const entity of scene.entities??[]) for(const state of Object.values(entity.states??{})) {
      resolveLayer(entity,state,plan.assets);
      entityBounds({...scene,events:[]},entity,state,scene.start_frame,plan.assets[state.asset]);
    }
    for(let frame=scene.start_frame;frame<scene.start_frame+scene.duration_frames;frame++) {
      const states=Object.fromEntries((scene.entities ?? []).map(e=>[e.id,resolveDisplayedEntityState(scene,e,frame)]));
      const ordered=resolveLayerOrder(scene,plan.assets,states);
      const visible=ordered.filter(e=>states[e.id]?.visible!==false).map((entity,index)=>{
        const state=states[entity.id],role=resolveVisualRole(entity,plan.assets),asset=plan.assets[state.asset];
        return {entity:entity.id,asset:state.asset,category:asset?.category,kind:entity.kind,role,layer:resolveLayer(entity,state,plan.assets),order:index,transform:state.transform,animation:scene.events.filter(e=>e.target===entity.id && frame>=e.start_frame && frame<e.end_frame),bounds:entityBounds(scene,entity,state,frame,asset)};
      });
      for (const binding of scene.spatial_bindings ?? []) {
        const subject=(scene.entities ?? []).find(e=>e.id===binding.entity),anchor=(scene.entities ?? []).find(e=>e.id===binding.anchor);
        if(!subject || !anchor || subject===anchor || !Number.isFinite(binding.max_distance_px) || binding.max_distance_px<=0)
          throw new Error(`SPATIAL_BINDINGS_INVALID scene=${scene.id} entity=${binding.entity} frame=${frame}`);
        if(states[subject.id]?.visible===false) continue;
        if(states[anchor.id]?.visible===false) throw new Error(`SPATIAL_ANCHOR_HIDDEN scene=${scene.id} entity=${subject.id} anchor=${anchor.id} frame=${frame}`);
        const center=entity=>{
          const t=states[entity.id]?.transform ?? {};
          const event=scene.events.find(e=>e.target===entity.id && frame>=e.start_frame && frame<e.end_frame);
          const m=resolveSemanticMotion(event,scene,entity,frame);
          return {x:(t.x??0)+(t.width??520)/2+m.translateX,y:(t.y??0)+(t.height??520)/2+m.translateY};
        };
        const a=center(subject),b=center(anchor),distance=Math.hypot(a.x-b.x,a.y-b.y);
        if(distance>binding.max_distance_px) throw new Error(`SPATIAL_SEMANTICS_MISMATCH scene=${scene.id} entity=${subject.id} anchor=${anchor.id} frame=${frame} distance=${Math.round(distance)} max=${binding.max_distance_px}`);
      }
      const caption=scene.captions?.find(c=>frame>=c.start_frame && frame<c.end_frame);
      const text=caption?.resolved_layout;
      for(const item of visible) {
        if(text && !['background','overlay','caption'].includes(item.role)) {
          const padding=text.zone.padding;
          const overlap=overlapArea(item.bounds,{x:text.x-padding,y:text.y-padding,width:text.width+2*padding,height:text.height+2*padding});
          item.caption_overlap_px=Math.ceil(overlap);
          if(overlap>0) throw new Error(`CAPTION_SAFE_ZONE_BLOCKED scene=${scene.id} entity=${item.entity} frame=${frame} role=${item.role} overlap_px=${Math.ceil(overlap)}`);
        }
        for(const actor of visible.filter(v=>v.role==='character')) {
          // shortcut: conservative face AABB for current silhouettes, upgrade when the library supplies landmarks.
          const face={x:actor.bounds.x+actor.bounds.width*.2,y:actor.bounds.y,width:actor.bounds.width*.6,height:actor.bounds.height*.55};
          if(['background','foreground_environment'].includes(item.role) && item.order>actor.order && overlapArea(item.bounds,face)>0)
            throw new Error(`OCCLUSION_INVALID scene=${scene.id} entity=${item.entity} character=${actor.entity} frame=${frame} role=${item.role} layer=${item.layer}`);
        }
      }
      rows.push({scene:scene.id,frame,entities:visible,caption_zone:text?.zone,caption_bounds:text ? {x:text.x,y:text.y,width:text.width,height:text.height}:null});
    }
  }
  return {gates:['ROLE_RESOLUTION_VALID','LAYER_ORDER_VALID','OCCLUSION_VALID','CAPTION_SAFE_ZONE_VALID','CAPTION_TEXT_FIT_VALID','SPATIAL_BINDINGS_VALID'],frames:rows};
}

export function resolveCoverVisuals(visuals,scene,assets,region) {
  const selected=visuals.map(visual=>{
    const entity=scene.entities.find(e=>e.id===visual.entity_id),state=entity?.states[visual.state_id];
    if(!state) throw new Error(`COVER_STATE_MISSING ${visual.entity_id}.${visual.state_id}`);
    if(!assets[state.asset]?.src) throw new Error(`COVER_ASSET_MISSING ${visual.entity_id}.${visual.state_id}`);
    return {visual,entity,state,src:assets[state.asset].src,transform:visual.transform ?? state.transform ?? {}};
  });
  const boxes=selected.map(({transform:t})=>({x:t.x??0,y:t.y??0,width:t.width??520,height:t.height??520}));
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  const width=Math.max(...boxes.map(b=>b.x+b.width))-x,height=Math.max(...boxes.map(b=>b.y+b.height))-y;
  const scale=Math.min(region.width/width,region.height/height);
  const ordered=resolveLayerOrder({...scene,entities:selected.map(v=>v.entity),occlusion_relations:[]},assets,Object.fromEntries(selected.map(v=>[v.entity.id,v.state])));
  return selected.map((v,i)=>({...v,role:resolveVisualRole(v.entity,assets),box:{x:(region.width-width*scale)/2+(boxes[i].x-x)*scale,y:(region.height-height*scale)/2+(boxes[i].y-y)*scale,width:boxes[i].width*scale,height:boxes[i].height*scale},order:ordered.findIndex(e=>e.id===v.entity.id)}));
}
