// Non-mutating Job@5 visual payload parity audit.
// Compare the package Authoring IR against the executable render plan to
// detect entity/asset/spatial-binding loss before spending CPU on Remotion.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {isDeepStrictEqual} from "node:util";
const read = async path => JSON.parse(await readFile(path,"utf8"));

export const auditJob5Payload = (ir, plan) => {
  const errors=[], scenes=[];
  const planScenes=new Map((plan.scenes??[]).map(s=>[s.id,s]));
  const assetIds=new Set(Object.keys(plan.assets??{}));
  for(const authored of ir.scenes??[]){
    const rendered=planScenes.get(authored.id);
    if(!rendered){errors.push(`SCENE_DROPPED ${authored.id}`);continue;}
    const outputEntities=new Map((rendered.entities??[]).map(e=>[e.id,e]));
    const inputEntities=new Map((authored.entities??[]).map(e=>[e.id,e]));
    const beforeEvents=new Set((authored.events??[]).map(e=>e.id));
    const afterEvents=new Set((rendered.events??[]).flatMap(e=>[e.event_id,...(e.merged_event_ids??[])]));
    for(const [id,e] of inputEntities){
      const current=outputEntities.get(id);
      if(!current){errors.push(`ENTITY_DROPPED ${authored.id} ${id}`);continue;}
      for(const [stateId,state] of Object.entries(e.states??{})){
        const got=current.states?.[stateId];
        if(!got){errors.push(`STATE_DROPPED ${authored.id} ${id}.${stateId}`);continue;}
        if(got.asset!==state.asset)errors.push(`ASSET_CHANGED ${authored.id} ${id}.${stateId}`);
        if(!assetIds.has(state.asset))errors.push(`ASSET_UNRESOLVED ${authored.id} ${id}.${stateId}`);
      }
    }
    for(const id of beforeEvents)if(!afterEvents.has(id))errors.push(`EVENT_DROPPED ${authored.id} ${id}`);
    const prior=authored.spatial_bindings??[],next=rendered.spatial_bindings??[];
    // Python serializes render-plan.json with sort_keys=True. Comparing JSON
    // strings flags equal bindings as different if field insertion order varies.
    // Deep structural equality ignores object key order but preserves array order
    // and rejects actual changes in entity, anchor, relation or distance.
    if(!isDeepStrictEqual(prior,next))errors.push(`SPATIAL_BINDINGS_CHANGED ${authored.id}`);
    const roles=["story_prop","story_effect"].map(id=>({
      id,authored:inputEntities.has(id),rendered:outputEntities.has(id),
      visibleStates:Object.values(outputEntities.get(id)?.states??{}).filter(x=>x.visible!==false).length,
    }));
    for(const r of roles)if(r.authored&&!r.visibleStates)errors.push(`VISUAL_ROLE_INVISIBLE ${authored.id} ${r.id}`);
    scenes.push({id:authored.id,authored_entities:inputEntities.size,rendered_entities:outputEntities.size,authored_events:beforeEvents.size,rendered_events:afterEvents.size,roles});
  }
  for(const id of planScenes.keys())if(!(ir.scenes??[]).some(s=>s.id===id))errors.push(`UNEXPECTED_RENDER_SCENE ${id}`);
  return {format:"zodiac-job5-payload-parity@1",ok:errors.length===0,errors,scenes};
};

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(process.argv[2]??".");
  const ir=await read(join(root,"production.ir.json"));
  const plan=await read(join(root,".runtime","render-plan.json"));
  const report=auditJob5Payload(ir,plan);
  await mkdir(join(root,".runtime"),{recursive:true});
  await writeFile(join(root,".runtime","payload-parity-report.json"),JSON.stringify(report,null,2)+"\n");
  if(report.ok){
    console.log(JSON.stringify({ok:true,scenes:report.scenes.length,errors:[]}));
  }else{
    // A structured error must be visible to Studio; stdout-only JSON was lost
    // by run_structured_command, producing the opaque "exit code 2" dialog.
    const first=report.errors[0]??"payload parity audit failed";
    console.error(JSON.stringify({
      ok:false,code:"RENDER_PLAN_PAYLOAD_MISMATCH",stage:"PLAN",
      message:"Render plan không khớp Job@5: "+first+
        " ("+report.errors.length+" lỗi; xem .runtime/payload-parity-report.json)",
      detail:{errors:report.errors,issue_count:report.errors.length,
        report_path:join(root,".runtime","payload-parity-report.json"),
        affected_scenes:[...new Set(report.errors.map(e=>e.split(" ")[1]).filter(Boolean))]},
    }));
    process.exitCode=2;
  }
}
