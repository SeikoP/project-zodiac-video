// Registry defaults follow the selected backdrop; explicit and compiled transforms stay in canvas space.
export function resolveAccentPlacement(master,accent,request){
 if(request.transform)return structuredClone(request.transform);
 const r=accent.transform,t=master.transform,v=master.view_box;
 return accent.placement_space==='scene_set_view_box'?{
  x:t.x+(r.x-v[0])*t.width/v[2],y:t.y+(r.y-v[1])*t.height/v[3],
  width:r.width*t.width/v[2],height:r.height*t.height/v[3]
 }:structuredClone(r);
}
