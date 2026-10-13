// Visibility changes reuse one canonical accent SVG; no asset is generated per event.
export function resolveAccentStates(request,{asset,layer,transform}){
 const input=request.states??{visible:{visible:true}},initial=request.initial_state??'visible';
 if(!input||Array.isArray(input)||typeof input!=='object'||!Object.hasOwn(input,initial)||!Object.keys(input).length)throw Error('SCENE_SET_COMPILE_ACCENT_STATE_INVALID');
 const states={};
 for(const [id,state] of Object.entries(input)){
  if(!/^[-\w]{1,100}$/u.test(id)||!state||typeof state.visible!=='boolean')throw Error('SCENE_SET_COMPILE_ACCENT_STATE_INVALID');
  states[id]={asset,visible:state.visible,layer,transform:structuredClone(transform)};
 }
 return {initial_state:initial,states};
}
