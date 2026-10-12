const issue=(issues,code,at='')=>issues.push({code,at});
const environmentEntities=scene=>new Map(Object.entries(scene?.environment?.roles??{}).flatMap(([role,ids])=>(ids??[]).map(id=>[id,role])));
export function validateVisualMetaphorComposition(plan,production){
 const issues=[];let checked=0;
 const scenes=new Map((production?.scenes??[]).map(s=>[s.id,s]));
 for(const metaphor of plan?.metaphors??[]){
  for(const cue of metaphor?.cues??[]){
   const scene=scenes.get(cue.scene_id);const at=metaphor.id+'/'+cue.scene_id;
   if(!scene){issue(issues,'VISUAL_METAPHOR_SCENE_MISSING',at);continue;}
   checked++;
   const env=environmentEntities(scene);
   const objects=(scene.entities??[]).filter(e=>['object','prop','interactive_prop','effect'].includes(e.kind));
   const bound=objects.filter(e=>(scene.spatial_bindings??[]).some(b=>b.entity===e.id&&b.anchor===cue?.relation?.anchor));
   const candidates=bound.length?bound:objects;
   for(const entity of candidates){
    if(env.has(entity.id))issue(issues,'VISUAL_METAPHOR_USED_AS_ENVIRONMENT',at+'/'+env.get(entity.id));
    const slot=(scene.environment?.frame?.slots??[]).find(s=>s.entity===entity.id);
    if(slot&&['background','rear','wallpaper','grounding','environment'].includes(slot.role))issue(issues,'VISUAL_METAPHOR_USED_AS_ENVIRONMENT',at+'/'+slot.role);
   }
  }
 }
 return {format:'zodiac-visual-metaphor-composition-qc@1',status:issues.length?'BLOCKED':checked?'PASS':'NOT_APPLICABLE',checked,issues};
}
