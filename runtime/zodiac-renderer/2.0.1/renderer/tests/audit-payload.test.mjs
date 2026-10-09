import test from "node:test";
import assert from "node:assert/strict";
import {auditJob5Payload} from "../scripts/audit-payload.mjs";
import {spawnSync} from "node:child_process";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const fixture=()=>({
  ir:{scenes:[{id:"S01",entities:[
    {id:"scorpio",states:{idle:{asset:"actor.svg"}}},
    {id:"story_prop",states:{idle:{asset:"phone.svg",visible:true}}}
  ],events:[{id:"E01"}],spatial_bindings:[{entity:"story_prop",anchor:"scorpio",relation:"held_by",max_distance_px:300}]}]},
  plan:{assets:{"actor.svg":{},"phone.svg":{}},scenes:[{id:"S01",entities:[
    {id:"scorpio",states:{idle:{asset:"actor.svg"}}},
    {id:"story_prop",states:{idle:{asset:"phone.svg",visible:true}}}
  ],events:[{event_id:"E01"}],spatial_bindings:[{entity:"story_prop",anchor:"scorpio",relation:"held_by",max_distance_px:300}]}]}
});
test("pass when visual payload and spatial roles survive compilation",()=>{const {ir,plan}=fixture();assert.equal(auditJob5Payload(ir,plan).ok,true)});
test("fail when prop disappears despite present package asset",()=>{const {ir,plan}=fixture();plan.scenes[0].entities.pop();assert.match(auditJob5Payload(ir,plan).errors.join(" "),/ENTITY_DROPPED.*story_prop/)});
test("fail when spatial ownership disappears",()=>{const {ir,plan}=fixture();plan.scenes[0].spatial_bindings=[];assert.match(auditJob5Payload(ir,plan).errors.join(" "),/SPATIAL_BINDINGS_CHANGED/)});
test("fail when every prop state is hidden",()=>{const {ir,plan}=fixture();plan.scenes[0].entities[1].states.idle.visible=false;assert.match(auditJob5Payload(ir,plan).errors.join(" "),/VISUAL_ROLE_INVISIBLE/)});

test("real CLI writes report and structured stderr on audit mismatch",async()=>{
  const root=await mkdtemp(join(tmpdir(),"zodiac-parity-test-"));
  try{
    const {ir,plan}=fixture();
    plan.scenes[0].entities.pop(); // remove story_prop => parity failure
    await mkdir(join(root,".runtime"));
    await writeFile(join(root,"production.ir.json"),JSON.stringify(ir));
    await writeFile(join(root,".runtime","render-plan.json"),JSON.stringify(plan));
    const result=spawnSync(process.execPath,[
      fileURLToPath(new URL("../scripts/audit-payload.mjs",import.meta.url)),root
    ],{encoding:"utf8"});
    assert.equal(result.status,2);
    const diagnostic=JSON.parse(result.stderr.trim());
    assert.equal(diagnostic.code,"RENDER_PLAN_PAYLOAD_MISMATCH");
    assert.equal(diagnostic.stage,"PLAN");
    assert.match(diagnostic.message,/S01 story_prop/);
    assert.equal(diagnostic.detail.issue_count,2);
    assert.ok(diagnostic.detail.errors.some(x=>x.includes("ENTITY_DROPPED S01 story_prop")));
    assert.ok(diagnostic.detail.errors.some(x=>x.includes("VISUAL_ROLE_INVISIBLE S01 story_prop")));
    const report=JSON.parse(await readFile(join(root,".runtime","payload-parity-report.json"),"utf8"));
    assert.equal(report.ok,false);
    assert.deepEqual(report.errors,diagnostic.detail.errors);
  }finally{await rm(root,{recursive:true,force:true})}
});


const sortedObjectKeys = value => {
  if(Array.isArray(value))return value.map(sortedObjectKeys);
  if(value!==null && typeof value==="object"){
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>[k,sortedObjectKeys(v)]));
  }
  return value;
};
const realWorldBindings = [
  [{entity:"question_effect",anchor:"gemini",relation:"emitted_by",max_distance_px:410}],
  [{entity:"notebook",anchor:"gemini",relation:"near",max_distance_px:310}],
  [{entity:"notebook",anchor:"gemini",relation:"near",max_distance_px:455}],
  [{entity:"story_effect",anchor:"classmate",relation:"emitted_by",max_distance_px:430},
   {entity:"notebook",anchor:"classmate",relation:"near",max_distance_px:310}],
  [{entity:"notebook",anchor:"gemini",relation:"near",max_distance_px:490}],
  [{entity:"pen",anchor:"classmate",relation:"near",max_distance_px:450}],
  [{entity:"notebook",anchor:"gemini",relation:"near",max_distance_px:455},
   {entity:"pen",anchor:"notebook",relation:"points_to",max_distance_px:360}],
  [{entity:"notebook",anchor:"gemini",relation:"near",max_distance_px:590}],
];

const eightScenes = () => {
  const {ir,plan}=fixture();
  const authored=ir.scenes[0],rendered=plan.scenes[0];
  ir.scenes=realWorldBindings.map((bindings,i)=>({
    ...structuredClone(authored),id:"s"+String(i+1).padStart(2,"0"),
    spatial_bindings:structuredClone(bindings)
  }));
  plan.scenes=ir.scenes.map((scene,i)=>({
    ...structuredClone(rendered),id:scene.id,
    // Python's json.dumps(sort_keys=True) rewrites object member order.
    spatial_bindings:sortedObjectKeys(realWorldBindings[i])
  }));
  return {ir,plan};
};

test("eight authentic Song Tu spatial bindings survive Python-sorted JSON serialization",()=>{
  const {ir,plan}=eightScenes();
  assert.notEqual(JSON.stringify(ir.scenes[0].spatial_bindings),
    JSON.stringify(plan.scenes[0].spatial_bindings));
  const report=auditJob5Payload(ir,plan);
  assert.equal(report.ok,true,report.errors.join(", "));
  assert.equal(report.scenes.length,8);
  assert.deepEqual(report.errors,[]);
});

test("semantic binding changes remain blocked despite object-order normalization",()=>{
  const changes=[
    {key:"anchor",newValue:"wrong_actor"},
    {key:"entity",newValue:"wrong_prop"},
    {key:"relation",newValue:"held_by"},
    {key:"max_distance_px",newValue:999}
  ];
  for(const change of changes){
    const {ir,plan}=eightScenes();
    plan.scenes[6].spatial_bindings[1][change.key]=change.newValue;
    const report=auditJob5Payload(ir,plan);
    assert.equal(report.ok,false,change.key);
    assert.deepEqual(report.errors,["SPATIAL_BINDINGS_CHANGED s07"],change.key);
  }
});

test("missing, extra or reordered binding array entries are still reported",()=>{
  for(const change of ["missing","extra","reorder"]){
    const {ir,plan}=eightScenes();
    const values=plan.scenes[6].spatial_bindings;
    if(change==="missing")values.pop();
    if(change==="extra")values.push({anchor:"gemini",entity:"phone",relation:"near",max_distance_px:450});
    if(change==="reorder")values.reverse();
    assert.deepEqual(auditJob5Payload(ir,plan).errors,["SPATIAL_BINDINGS_CHANGED s07"],change);
  }
});

test("real CLI accepts an authoring IR and sorted render plan for all eight scenes",async()=>{
  const root=await mkdtemp(join(tmpdir(),"zodiac-parity-sorted-"));
  try{
    const {ir,plan}=eightScenes();
    await mkdir(join(root,".runtime"));
    await writeFile(join(root,"production.ir.json"),JSON.stringify(ir));
    await writeFile(join(root,".runtime","render-plan.json"),JSON.stringify(sortedObjectKeys(plan)));
    const result=spawnSync(process.execPath,[
      fileURLToPath(new URL("../scripts/audit-payload.mjs",import.meta.url)),root
    ],{encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);
    const report=JSON.parse(await readFile(join(root,".runtime","payload-parity-report.json"),"utf8"));
    assert.equal(report.ok,true);
    assert.equal(report.scenes.length,8);
  }finally{await rm(root,{recursive:true,force:true})}
});
